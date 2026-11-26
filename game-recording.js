window.PlayFeedRecording = (() => {
  let session;

  function stop() {
    if (!session) return;
    if (session.recorder?.state === 'recording') {
      session.recorder.stop();
    }
    session.close();
  }

  function toggle(card, {expand, title, notify}) {
    if (session) {
      stop();
      return;
    }
    const viewport = card.querySelector('.game-viewport');
    const button = card.querySelector('.expanded-record');
    const countdown = card.querySelector('.record-countdown');
    const controller = new AbortController();
    const {signal} = controller;
    const stopTracks = stream => stream?.getTracks().forEach(track => track.stop());
    function setState(state, label) {
      button.dataset.state = state;
      button.setAttribute('aria-label', label);
      button.title = label;
    }
    const current = session = {
      close() {
        if (session !== current) return;
        session = null;
        controller.abort();
        stopTracks(current.stream);
        countdown.textContent = '';
        setState('idle', '錄影');
      }
    };

    const fail = message => {
      current.close();
      notify(message);
    };

    async function start() {
      expand?.();
      if (!navigator.mediaDevices?.getDisplayMedia || !globalThis.CropTarget || !globalThis.MediaRecorder) {
        fail('遊戲錄影需要支援分頁裁切的桌面瀏覽器，例如 Chrome 或 Edge。');
        return;
      }
      setState('pending', '取消錄影');
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {displaySurface: 'browser', frameRate: {ideal: 30}},
          audio: false,
          preferCurrentTab: true,
          selfBrowserSurface: 'include',
          surfaceSwitching: 'exclude'
        });
        if (signal.aborted) {
          stopTracks(stream);
          return;
        }
        current.stream = stream;
        const [track] = stream.getVideoTracks();
        if (!track?.cropTo || track.getSettings().displaySurface !== 'browser') {
          fail('請選擇目前的 FanGame 分頁，再試一次。');
          return;
        }
        track.addEventListener('ended', stop, {once: true, signal});
        const target = await CropTarget.fromElement(viewport);
        if (signal.aborted) return;
        try {
          await track.cropTo(target);
        } catch {
          if (!signal.aborted) fail('請選擇目前的 FanGame 分頁，再試一次。');
          return;
        }
        if (signal.aborted) return;
        for (let count = 3; count > 0; count--) {
          countdown.textContent = count;
          await new Promise(resolve => {
            const timer = setTimeout(resolve, 1000);
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              resolve();
            }, {once: true});
          });
          if (signal.aborted) return;
        }
        countdown.textContent = '';
        // Keep the recorder from receiving a lingering countdown frame.
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (signal.aborted) return;

        const recorder = new MediaRecorder(stream);
        const chunks = [];
        current.recorder = recorder;
        recorder.addEventListener('dataavailable', ({data}) => {
          if (data.size) chunks.push(data);
        });
        recorder.addEventListener('stop', () => {
          current.close();
          if (!chunks.length) return;
          const type = recorder.mimeType || chunks[0].type;
          const url = URL.createObjectURL(new Blob(chunks, {type}));
          const link = document.createElement('a');
          link.href = url;
          const filename = title.replace(/[<>:"/\\|?*]/g, '-').trim() || 'FanGame';
          link.download = filename + '-錄影.' + (type.includes('mp4') ? 'mp4' : 'webm');
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 30000);
        }, {once: true});
        recorder.addEventListener('error', () => {
          if (!signal.aborted) fail('錄影中斷，請再試一次。');
        }, {once: true});
        recorder.start(1000);
        setState('recording', '停止錄影並存檔');
      } catch (error) {
        if (!signal.aborted) fail(error.name === 'NotAllowedError' ? '錄影已取消。' : '無法開始錄影，請再試一次。');
      }
    }
    void start();
  }

  return {toggle, stop};
})();
