function createAvatarEditor() {
  const file = document.querySelector('#avatar-file');
  const canvas = document.querySelector('#avatar-crop');
  const controls = document.querySelector('#avatar-adjust');
  const zoom = document.querySelector('#avatar-zoom');
  const x = document.querySelector('#avatar-x');
  const y = document.querySelector('#avatar-y');
  const remove = document.querySelector('#remove-avatar');
  const ctx = canvas.getContext('2d');
  let source, saved, changed, loading, version = 0, drag;

  function draw() {
    const size = canvas.width;
    const scale = size / Math.min(source.width, source.height) * Number(zoom.value);
    const width = source.width * scale;
    const height = source.height * scale;
    ctx.fillStyle = '#fff3df';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(source, (size - width) * (1 - Number(x.value)) / 2,
      (size - height) * (1 - Number(y.value)) / 2, width, height);
  }

  function sync() {
    canvas.hidden = !source;
    controls.hidden = !source || !changed;
    remove.hidden = !source && !saved;
    if (source) draw();
  }

  function setPosition() {
    zoom.value = '1';
    x.value = y.value = '0';
  }

  function reset(value) {
    const current = ++version;
    source = null;
    saved = value;
    changed = loading = false;
    file.value = '';
    setPosition();
    sync();
    if (!value) return;
    const image = new Image();
    image.onload = () => {
      if (current !== version) return;
      source = image;
      sync();
    };
    image.src = value;
  }

  file.addEventListener('change', async () => {
    const selected = file.files[0];
    if (!selected) return;
    const current = ++version;
    const status = document.querySelector('#profile-status');
    const url = URL.createObjectURL(selected);
    loading = true;
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (current !== version) return;
      source = image;
      changed = true;
      setPosition();
      sync();
      status.textContent = '';
    } catch {
      if (current === version) status.textContent = '無法讀取圖片，請換一張照片。';
    } finally {
      URL.revokeObjectURL(url);
      if (current === version) loading = false;
    }
  });

  for (const control of [zoom, x, y]) control.addEventListener('input', draw);
  remove.addEventListener('click', () => {
    reset();
    changed = true;
  });
  canvas.addEventListener('pointerdown', event => {
    if (!changed || !source) return;
    drag = { id:event.pointerId, left:event.clientX, top:event.clientY, x:Number(x.value), y:Number(y.value) };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId || !source) return;
    const scale = canvas.clientWidth / Math.min(source.width, source.height) * Number(zoom.value);
    const horizontal = (source.width * scale - canvas.clientWidth) / 2;
    const vertical = (source.height * scale - canvas.clientWidth) / 2;
    if (horizontal > 0) x.value = Math.max(-1, Math.min(1, drag.x + (event.clientX - drag.left) / horizontal));
    if (vertical > 0) y.value = Math.max(-1, Math.min(1, drag.y + (event.clientY - drag.top) / vertical));
    draw();
  });
  canvas.addEventListener('lostpointercapture', () => { drag = null; });

  return {
    reset,
    value() {
      if (loading) throw new Error('頭貼載入中，請稍後再儲存。');
      if (!changed) return undefined;
      if (!source) return null;
      return canvas.toDataURL('image/jpeg', .82);
    }
  };
}
