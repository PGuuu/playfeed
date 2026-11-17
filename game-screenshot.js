(()=>{
 const handle='playfeed-'+crypto.randomUUID();
 try{navigator.mediaDevices?.setCaptureHandleConfig?.({handle,exposeOrigin:true,permittedOrigins:[location.origin]})}catch{}
 let active=false;
 const styles=document.createElement('style');styles.textContent=`
 .screenshot-dialog{box-sizing:border-box;width:min(460px,calc(100vw - 24px));max-height:90dvh;overflow:auto;padding:18px;border:1px solid #cfb496;border-radius:16px;background:#fff7eb;color:#443323;touch-action:pan-y;font:15px system-ui}
 .screenshot-dialog::backdrop{background:#0009}.screenshot-dialog img{display:block;max-width:100%;height:auto;max-height:55dvh;object-fit:contain;margin:12px auto}.screenshot-dialog p{line-height:1.6}.screenshot-dialog button,.game-screenshot-button{min-height:44px;padding:10px 14px;border:0;border-radius:10px;background:#edc29c;color:#443323;cursor:pointer;font:600 14px system-ui}.screenshot-dialog button:disabled{opacity:.5}.screenshot-dialog .screenshot-actions{display:flex;gap:8px;flex-wrap:wrap}.screenshot-dialog [hidden]{display:none!important}.game-screenshot-tools{margin:12px 0;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.game-screenshot-tools small{font-size:12px}.loading-preview-image{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#1a1917;z-index:0}.game-loading.has-preview{background:#1a1917;color:#fff7eb}.game-loading.has-preview>:not(img){position:relative;z-index:1;background:#171717b8;border-radius:8px;padding:5px 10px}.game-loading.has-preview .loading-spinner{background:transparent}
 `;document.head.append(styles);
 styles.textContent+=`.screenshot-dialog .share-card{border:1px solid #cfb496;border-radius:12px;overflow:hidden;background:#fffdf8}.share-card canvas{display:block;width:100%;height:auto;aspect-ratio:1200/630;touch-action:none;cursor:grab}.share-card canvas:active{cursor:grabbing}.share-card-text{padding:10px 12px}.share-card-text small{display:block;color:#82664b;font-size:11px}.share-card-text strong{display:block;font-size:14px;margin-top:4px}.screenshot-dialog h3{font-size:15px;margin:14px 0 8px}.screenshot-dialog .crop-hint{font-size:12px;margin:8px 0}.screenshot-dialog .crop-controls label{display:grid;grid-template-columns:70px 1fr;align-items:center;gap:8px;margin:10px 0;font-size:13px}.crop-controls input{min-width:0;width:100%;accent-color:#a76935}.screenshot-dialog details{margin:12px 0;font-size:12px}.screenshot-dialog details img{max-height:24dvh}.screenshot-dialog button:focus-visible,.screenshot-dialog input:focus-visible,.share-card canvas:focus-visible{outline:2px solid #8b542b;outline-offset:3px}`;
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
 async function open({frame,onSave,beforeCapture,title='遊戲',author='',isCurrent=()=>true}){
  if(active||!frame)return;active=true;
  const mobile=navigator.userAgentData?.mobile===true||/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const uploadOnly=mobile||!navigator.mediaDevices?.getDisplayMedia;
  const dialog=document.createElement('dialog');dialog.className='screenshot-dialog';dialog.setAttribute('aria-label','遊戲截圖');
  dialog.innerHTML='<h2>遊戲截圖</h2><p>分享用橫向裁切，預載入保留完整截圖。</p><section data-editor hidden><h3>連結分享預覽</h3><div class="share-card"><canvas width="1200" height="630" aria-label="橫向分享圖片，可拖曳調整位置" tabindex="0"></canvas><div class="share-card-text"><small>playfeed-gilt.vercel.app</small><strong data-card-title></strong></div></div><p class="crop-hint">拖曳圖片調整重點位置，也可以用下方滑桿放大。<br>橫向 1200 × 630 · 平台可能依版面微調顯示。</p><div class="crop-controls"><label>上下位置<input data-y aria-label="上下位置" type="range" min="0" max="100" value="50"></label><label>左右位置<input data-x aria-label="左右位置" type="range" min="0" max="100" value="50"></label><label>放大<input data-zoom aria-label="放大" type="range" min="100" max="300" value="100"></label></div><details><summary>查看完整預載入圖</summary><img alt="完整遊戲截圖，作為預載入圖"></details></section><p class="screenshot-status" role="status"></p><div class="screenshot-actions"><button type="button" data-capture>重新截圖</button><button type="button" data-upload>上傳截圖</button><button type="button" data-save disabled>使用這張截圖</button><button type="button" data-cancel>取消</button></div><input type="file" accept="image/png,image/jpeg,image/webp" hidden>';
  document.body.append(dialog);
  const status=dialog.querySelector('.screenshot-status'),img=dialog.querySelector('img'),save=dialog.querySelector('[data-save]'),input=dialog.querySelector('input[type=file]');let data=null,busy=false,closed=false;
  const crop=window.PlayFeedPreviewCrop,canvas=dialog.querySelector('canvas'),editor=dialog.querySelector('[data-editor]');
  const sliders={x:dialog.querySelector('[data-x]'),y:dialog.querySelector('[data-y]'),zoom:dialog.querySelector('[data-zoom]')};let focus={x:.5,y:.5,zoom:1},imageVersion=0;
  dialog.querySelector('[data-card-title]').textContent=title+(author?' by '+author:'');
  function draw(){if(!img.naturalWidth)return;const box=crop.box(img.naturalWidth,img.naturalHeight,focus);canvas.getContext('2d').drawImage(img,box.left,box.top,box.width,box.height,0,0,1200,630);}
  for(const key of Object.keys(sliders))sliders[key].addEventListener('input',()=>{focus[key]=Number(sliders[key].value)/100;draw()});
  let drag=null;
  canvas.addEventListener('pointerdown',event=>{if(!img.naturalWidth)return;event.preventDefault();drag={x:event.clientX,y:event.clientY,focus:{...focus},box:crop.box(img.naturalWidth,img.naturalHeight,focus)};canvas.setPointerCapture(event.pointerId)});
  canvas.addEventListener('pointermove',event=>{if(!drag)return;const scale=canvas.getBoundingClientRect().width/drag.box.width;focus=crop.focus({...focus,x:drag.focus.x-(event.clientX-drag.x)/(Math.max(1,img.naturalWidth-drag.box.width)*scale),y:drag.focus.y-(event.clientY-drag.y)/(Math.max(1,img.naturalHeight-drag.box.height)*scale)});sliders.x.value=focus.x*100;sliders.y.value=focus.y*100;draw()});
  canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
  canvas.addEventListener('keydown',event=>{const axis={ArrowUp:['y',-.02],ArrowDown:['y',.02],ArrowLeft:['x',-.02],ArrowRight:['x',.02]}[event.key];if(!axis)return;event.preventDefault();focus=crop.focus({...focus,[axis[0]]:focus[axis[0]]+axis[1]});sliders[axis[0]].value=focus[axis[0]]*100;draw()});
  dialog.querySelector('[data-capture]').hidden=uploadOnly;
  if(mobile)dialog.querySelector('[data-upload]').textContent='選擇截圖';
  function close(){if(busy)return;closed=true;dialog.close();dialog.remove();active=false;}
  async function show(value){if(closed)return;const version=++imageVersion;data=value;save.disabled=true;img.src=value;await img.decode();if(closed||version!==imageVersion)return;focus={x:.5,y:.5,zoom:1};sliders.x.value=sliders.y.value=50;sliders.zoom.value=100;editor.hidden=false;draw();save.disabled=false;status.textContent='調整分享圖的重點位置後，按「使用這張截圖」。';}
  async function take(){
   if(busy)return;
   if(uploadOnly){status.textContent='請選擇已儲存的截圖，確認預覽後按「使用這張截圖」。';if(!dialog.open)dialog.showModal();input.click();return;}
   busy=true;const wasOpen=dialog.open;if(wasOpen)dialog.close();
   try{const value=await capture(frame,beforeCapture);if(!isCurrent())throw Error('遊戲已切換，請重新截圖。');await show(value)}
   catch(error){status.textContent=error.name==='NotAllowedError'?'已取消擷取；可以重試或上傳截圖。':error.message;}
   finally{busy=false;if(!closed&&!dialog.open)dialog.showModal();}
  }
  input.addEventListener('change',async()=>{
   const file=input.files?.[0];if(!file)return;
   if(file.size>15000000){status.textContent='圖片太大，請選擇 15 MB 以內的截圖。';return;}
   const url=URL.createObjectURL(file),image=new Image();
   try{image.src=url;await image.decode();await show(imageData(image,image.naturalWidth,image.naturalHeight))}catch{status.textContent='無法讀取圖片，請選擇 PNG、JPEG 或 WebP。'}finally{URL.revokeObjectURL(url);input.value='';}
  });
  dialog.querySelector('[data-capture]').addEventListener('click',take);
  dialog.querySelector('[data-upload]').addEventListener('click',()=>input.click());
  dialog.querySelector('[data-cancel]').addEventListener('click',close);
  dialog.addEventListener('cancel',e=>{if(e.target===dialog){e.preventDefault();close()}});
  save.addEventListener('click',async()=>{
   if(busy||!data)return;if(!isCurrent()){status.textContent='遊戲已切換，請取消並重新截圖。';return;}
   busy=true;save.disabled=true;status.textContent='正在儲存截圖…';
   try{await onSave(data,{...focus});busy=false;close()}catch(error){status.textContent=error.message;busy=false;save.disabled=false;}
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
