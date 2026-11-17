(()=>{
 const handle='playfeed-'+crypto.randomUUID();
 try{navigator.mediaDevices?.setCaptureHandleConfig?.({handle,exposeOrigin:true,permittedOrigins:[location.origin]})}catch{}
 let active=false;
 const styles=document.createElement('style');styles.textContent=`
 .screenshot-dialog{box-sizing:border-box;width:min(460px,calc(100vw - 24px));max-height:90dvh;overflow:auto;padding:18px;border:1px solid #cfb496;border-radius:16px;background:#fff7eb;color:#443323;touch-action:pan-y;font:15px system-ui}
 .screenshot-dialog::backdrop{background:#0009}.screenshot-dialog img{display:block;max-width:100%;height:auto;max-height:55dvh;object-fit:contain;margin:12px auto}.screenshot-dialog p{line-height:1.6}.screenshot-dialog button,.game-screenshot-button{min-height:44px;padding:10px 14px;border:0;border-radius:10px;background:#edc29c;color:#443323;cursor:pointer;font:600 14px system-ui}.screenshot-dialog button:disabled{opacity:.5}.screenshot-dialog .screenshot-actions{display:flex;gap:8px;flex-wrap:wrap}.screenshot-dialog [hidden]{display:none!important}.game-screenshot-tools{margin:12px 0;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.game-screenshot-tools small{font-size:12px}.loading-preview-image{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#1a1917;z-index:0}.game-loading.has-preview{background:#1a1917;color:#fff7eb}.game-loading.has-preview>:not(img){position:relative;z-index:1;background:#171717b8;border-radius:8px;padding:5px 10px}.game-loading.has-preview .loading-spinner{background:transparent}
 `;document.head.append(styles);
 function imageData(source,width,height){
  const ratio=Math.min(1,1000/Math.max(width,height)),c=document.createElement('canvas');
  c.width=Math.round(width*ratio);c.height=Math.round(height*ratio);
  c.getContext('2d').drawImage(source,0,0,c.width,c.height);
  let data=c.toDataURL('image/jpeg',.9);
  if(data.length>1900000)data=c.toDataURL('image/jpeg',.7);
  if(data.length>1900000)throw Error('截圖太大，請換一張較小的圖片。');
  return data;
 }
 async function capture(frame,beforeCapture){
  // Request synchronously from the button gesture; crop only the game's visible frame.
  const stream=await navigator.mediaDevices.getDisplayMedia({video:{displaySurface:'browser'},audio:false,preferCurrentTab:true,selfBrowserSurface:'include'});
  const video=document.createElement('video');video.muted=true;video.playsInline=true;video.srcObject=stream;
  try{
   const track=stream.getVideoTracks()[0],settings=track.getSettings(),captured=track.getCaptureHandle?.();
   if(settings.displaySurface!=='browser'||(captured&&captured.handle!==handle))throw Error('請選擇目前的 PlayFeed 分頁，再試一次。');
   await beforeCapture?.();frame.scrollIntoView({block:'center',behavior:'instant'});
   await Promise.race([video.play(),new Promise((_,reject)=>setTimeout(()=>reject(Error('畫面擷取逾時，請重試或上傳截圖。')),8000))]);
   await new Promise(resolve=>setTimeout(resolve,220));
   const r=frame.getBoundingClientRect();
   if(r.width<50||r.height<50||r.top< -1||r.left< -1||r.bottom>innerHeight+1||r.right>innerWidth+1)throw Error('請先讓整個遊戲出現在畫面中，再按截圖。');
   if(!video.videoWidth||!video.videoHeight)throw Error('無法擷取畫面，請改用上傳截圖。');
   const sx=video.videoWidth/innerWidth,sy=video.videoHeight/innerHeight;
   const c=document.createElement('canvas');c.width=Math.round(r.width*sx);c.height=Math.round(r.height*sy);
   c.getContext('2d').drawImage(video,r.left*sx,r.top*sy,r.width*sx,r.height*sy,0,0,c.width,c.height);
   return imageData(c,c.width,c.height);
  }finally{stream.getTracks().forEach(track=>track.stop());video.srcObject=null;}
 }
 async function open({frame,onSave,beforeCapture,isCurrent=()=>true}){
  if(active||!frame)return;active=true;
  const dialog=document.createElement('dialog');dialog.className='screenshot-dialog';dialog.setAttribute('aria-label','遊戲截圖');
  dialog.innerHTML='<h2>遊戲截圖</h2><p>這張圖會用於分享連結預覽與遊戲載入畫面。</p><img alt="即將使用的遊戲截圖" hidden><p class="screenshot-status" role="status"></p><div class="screenshot-actions"><button type="button" data-capture>重新截圖</button><button type="button" data-upload>上傳截圖</button><button type="button" data-save disabled>使用這張截圖</button><button type="button" data-cancel>取消</button></div><input type="file" accept="image/png,image/jpeg,image/webp" hidden>';
  document.body.append(dialog);
  const status=dialog.querySelector('.screenshot-status'),img=dialog.querySelector('img'),save=dialog.querySelector('[data-save]'),input=dialog.querySelector('input');let data=null,busy=false,closed=false;
  function close(){if(busy)return;closed=true;dialog.close();dialog.remove();active=false;}
  function show(value){if(closed)return;data=value;img.src=value;img.hidden=false;save.disabled=false;status.textContent='確認畫面後，按「使用這張截圖」。';}
  async function take(){
   if(busy)return;
   if(!navigator.mediaDevices?.getDisplayMedia){status.textContent='此瀏覽器請使用裝置截圖，再按「上傳截圖」。';input.click();if(!dialog.open)dialog.showModal();return;}
   busy=true;const wasOpen=dialog.open;if(wasOpen)dialog.close();
   try{const value=await capture(frame,beforeCapture);if(!isCurrent())throw Error('遊戲已切換，請重新截圖。');show(value)}
   catch(error){status.textContent=error.name==='NotAllowedError'?'已取消擷取；可以重試或上傳截圖。':error.message;}
   finally{busy=false;if(!closed&&!dialog.open)dialog.showModal();}
  }
  input.addEventListener('change',async()=>{
   const file=input.files?.[0];if(!file)return;
   if(file.size>15000000){status.textContent='圖片太大，請選擇 15 MB 以內的截圖。';return;}
   const url=URL.createObjectURL(file),image=new Image();
   try{image.src=url;await image.decode();show(imageData(image,image.naturalWidth,image.naturalHeight))}catch{status.textContent='無法讀取圖片，請選擇 PNG、JPEG 或 WebP。'}finally{URL.revokeObjectURL(url);input.value='';}
  });
  dialog.querySelector('[data-capture]').addEventListener('click',take);
  dialog.querySelector('[data-upload]').addEventListener('click',()=>input.click());
  dialog.querySelector('[data-cancel]').addEventListener('click',close);
  dialog.addEventListener('cancel',e=>{if(e.target===dialog){e.preventDefault();close()}});
  save.addEventListener('click',async()=>{
   if(busy||!data)return;if(!isCurrent()){status.textContent='遊戲已切換，請取消並重新截圖。';return;}
   busy=true;save.disabled=true;status.textContent='正在儲存截圖…';
   try{await onSave(data);busy=false;close()}catch(error){status.textContent=error.message;busy=false;save.disabled=false;}
  });
  await take();
 }
 function mount(host,options){
  const tools=document.createElement('div');tools.className='game-screenshot-tools';
  const button=document.createElement('button');button.type='button';button.textContent='截圖';button.className='game-screenshot-button';
  button.addEventListener('click',()=>open(options()));tools.append(button);host.append(tools);return tools;
 }
 window.PlayFeedScreenshot={open,mount};
})();
