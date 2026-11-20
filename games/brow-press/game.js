(()=>{
 'use strict';
 const $=s=>document.querySelector(s),surface=$('#surface'),canvas=$('#portrait'),ctx=canvas.getContext('2d');
 const fileInput=$('#file'),upload=$('#upload'),reposition=$('#reposition'),status=$('#status');
 const {clamp,point,near,deformPoint,fitPhoto,zoomPhoto,panPhoto}=BrowGeometry;
 const W=720,H=912,base=document.createElement('canvas'),patch=document.createElement('canvas');
 base.width=W;base.height=H;const b=base.getContext('2d');
 patch.width=440;patch.height=440;const p=patch.getContext('2d');
 let anchor={x:.5,y:.35},held=false,pointerId=null,pressure=0,raf=0,version=0,started=0;
 let photo=null,editor=null,gesture=null,pressUntil=0,deformationKey='';const pointers=new Map();
 const controls=$('.controls'),editorControls=$('#editor-controls'),crosshair=$('#crosshair'),zoom=$('#zoom');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function ellipse(cx,cy,rx,ry,color){b.fillStyle=color;b.beginPath();b.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);b.fill()}
 function defaultPortrait(){
  const bg=b.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#e9d9c8');bg.addColorStop(1,'#d4beaa');b.fillStyle=bg;b.fillRect(0,0,W,H);
  ellipse(360,897,280,190,'#afb1a0');
  b.fillStyle='#cf9b7c';b.beginPath();b.roundRect(297,616,126,160,48);b.fill();
  ellipse(183,429,36,65,'#dab08f');ellipse(537,429,36,65,'#dab08f');
  const skin=b.createRadialGradient(290,345,20,365,440,302);skin.addColorStop(0,'#f2d1ae');skin.addColorStop(.7,'#e7bb96');skin.addColorStop(1,'#d9a77f');
  b.fillStyle=skin;b.beginPath();b.moveTo(184,332);b.bezierCurveTo(184,164,534,164,536,332);b.bezierCurveTo(557,509,499,691,363,705);b.bezierCurveTo(226,693,163,510,184,332);b.fill();
  b.fillStyle='#493b32';b.beginPath();b.moveTo(179,397);b.bezierCurveTo(125,217,220,133,368,143);b.bezierCurveTo(516,123,583,249,540,402);b.lineTo(513,313);b.bezierCurveTo(423,323,334,272,311,231);b.bezierCurveTo(267,312,229,289,206,326);b.closePath();b.fill();
  b.strokeStyle='#735343';b.lineWidth=10;b.lineCap='round';
  for(const side of [-1,1]){b.beginPath();b.moveTo(360+side*49,333);b.quadraticCurveTo(360+side*99,315,360+side*139,337);b.stroke()}
  b.strokeStyle='#8c6650';b.lineWidth=7;
  for(const side of [-1,1]){b.beginPath();b.moveTo(360+side*55,403);b.quadraticCurveTo(360+side*102,424,360+side*143,400);b.stroke()}
  b.strokeStyle='#c49675';b.lineWidth=5;b.beginPath();b.moveTo(365,435);b.quadraticCurveTo(340,507,368,512);b.stroke();
  b.strokeStyle='#a7725d';b.lineWidth=6;b.beginPath();b.moveTo(328,567);b.quadraticCurveTo(364,580,399,566);b.stroke();
  ellipse(255,490,41,19,'#dfa88b44');ellipse(464,490,41,19,'#dfa88b44');
 }
 function position(){surface.style.setProperty('--x',(anchor.x*100)+'%');surface.style.setProperty('--y',(anchor.y*100)+'%')}
 function drawPhoto(target,value){
  target.clearRect(0,0,W,H);target.fillStyle='#e7dbcb';target.fillRect(0,0,W,H);
  const fit=fitPhoto(value.source.width,value.source.height,W,H,value.zoom);
  target.drawImage(value.source,value.x-fit.width/2,value.y-fit.height/2,fit.width,fit.height);
  deformationKey='';
 }
 function triangle(origin,across,down,sx,sy,dx,dy,x,y){
  const a=(across.x-origin.x)/dx,bv=(across.y-origin.y)/dx,c=(down.x-origin.x)/dy,d=(down.y-origin.y)/dy;
  const center={x:(origin.x+across.x+down.x)/3,y:(origin.y+across.y+down.y)/3};
  const edge=v=>{const vx=v.x-center.x,vy=v.y-center.y,length=Math.hypot(vx,vy)||1;return {x:v.x+vx/length*.5,y:v.y+vy/length*.5}};
  const vertices=[origin,across,down].map(edge);p.save();p.beginPath();p.moveTo(vertices[0].x,vertices[0].y);p.lineTo(vertices[1].x,vertices[1].y);p.lineTo(vertices[2].x,vertices[2].y);p.closePath();p.clip();
  p.setTransform(a,bv,c,d,origin.x-a*sx-c*sy,origin.y-bv*sx-d*sy);p.drawImage(base,-x,-y);p.restore();
 }
 function draw(time=performance.now()){
  if(editor){drawPhoto(ctx,editor);return}
  ctx.clearRect(0,0,W,H);ctx.drawImage(base,0,0);if(pressure<.001)return;
  const radius=220,cx=anchor.x*W,cy=anchor.y*H,x=cx-radius,y=cy-radius;
  const key=[Math.round(pressure*1000),cx,cy].join(':');
  if(key!==deformationKey){
   p.clearRect(0,0,440,440);
   const size=440/16,vertices=Array.from({length:17},(_,row)=>Array.from({length:17},(_,column)=>deformPoint(column*size,row*size,radius,pressure)));
   for(let row=0;row<16;row++)for(let column=0;column<16;column++){
    const sx=column*size,sy=row*size,tl=vertices[row][column],tr=vertices[row][column+1],bl=vertices[row+1][column],br=vertices[row+1][column+1];
    triangle(tl,tr,bl,sx,sy,size,size,x,y);triangle(br,bl,tr,sx+size,sy+size,-size,-size,x,y);
   }
   deformationKey=key;
  }
  ctx.drawImage(patch,x,y);
  const shadow=ctx.createRadialGradient(cx,cy+18,2,cx,cy+18,78);
  shadow.addColorStop(0,'rgba(88,47,27,'+pressure*.3+')');shadow.addColorStop(.5,'rgba(104,65,40,'+pressure*.12+')');shadow.addColorStop(1,'rgba(104,65,40,0)');
  ctx.fillStyle=shadow;ctx.beginPath();ctx.arc(cx,cy+18,78,0,Math.PI*2);ctx.fill();
  if(!reduced){const cycle=((time-started)%1400)/1400;ctx.strokeStyle='rgba(255,244,218,'+(1-cycle)*.26*pressure+')';ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx,cy,38+cycle*100,0,Math.PI*2);ctx.stroke()}
 }
 function animate(time){
  raf=0;const target=held||time<pressUntil?1:0;pressure+=(target-pressure)*(reduced ? .7 : target ? .3 : .16);
  if(Math.abs(target-pressure)<.001)pressure=target;draw(time);if(!editor&&(held||pressure>0))raf=requestAnimationFrame(animate);
 }
 function schedule(){if(!raf)raf=requestAnimationFrame(animate)}
 function press(){held=true;started=performance.now();pressUntil=started+140;pressure=Math.max(.2,pressure);surface.classList.add('pressing');surface.setAttribute('aria-pressed','true');draw();schedule()}
 function release(){held=false;pointerId=null;surface.classList.remove('pressing');surface.setAttribute('aria-pressed','false');schedule()}
 function finishPointers(){for(const id of pointers.keys())if(surface.hasPointerCapture(id))surface.releasePointerCapture(id);pointers.clear();gesture=null}
 function editorView(){
  const editing=!!editor;surface.classList.toggle('editing',editing);crosshair.toggleAttribute('hidden',!editing);controls.hidden=editing;editorControls.hidden=!editing;
  surface.setAttribute('role',editing?'img':'button');if(editing)surface.removeAttribute('aria-pressed');else surface.setAttribute('aria-pressed','false');
  surface.setAttribute('aria-label',editing?'拖曳、縮放照片，將眉心對準中央十字':'按住眉心，放開回彈');
  upload.classList.toggle('compact',!!photo);upload.setAttribute('aria-label',photo?'更換照片':'上傳照片');reposition.hidden=!photo;
 }
 function beginEdit(value){
  release();finishPointers();pressure=0;editor={...value};zoom.min=String(Math.min(W/value.source.width,H/value.source.height)/Math.max(W/value.source.width,H/value.source.height));
  zoom.value=String(editor.zoom);editorView();draw();
 }
 function updateZoom(value,pivot={x:W/2,y:H/2}){if(!editor)return;editor=zoomPhoto(editor,clamp(value,Number(zoom.min),4),pivot,W,H);zoom.value=String(editor.zoom);draw()}
 function at(event){const rect=surface.getBoundingClientRect(),normalized=point(event.clientX,event.clientY,rect);return {x:normalized.x*W,y:normalized.y*H}}
 function resetGesture(){
  const points=[...pointers.values()];
  gesture=points.length>1?{distance:Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y),mid:{x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2},edit:{...editor}}:
   points.length?{point:points[0],edit:{...editor}}:null;
 }
 surface.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;surface.classList.add('pointer-focus');
  if(editor){event.preventDefault();pointers.set(event.pointerId,at(event));surface.setPointerCapture(event.pointerId);resetGesture();return}
  if(!event.isPrimary||pointerId!==null)return;
  const rect=surface.getBoundingClientRect(),where=point(event.clientX,event.clientY,rect);
  if(!near(where,anchor,Math.max(48/rect.width,.17)))return;
  event.preventDefault();surface.focus({preventScroll:true});pointerId=event.pointerId;surface.setPointerCapture(pointerId);press();
 });
 surface.addEventListener('pointermove',event=>{
  if(editor){
   if(!pointers.has(event.pointerId)||!gesture)return;event.preventDefault();pointers.set(event.pointerId,at(event));const points=[...pointers.values()];
   if(points.length>1&&gesture.distance){
    const mid={x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2},distance=Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y);
    const scaled=zoomPhoto(gesture.edit,clamp(gesture.edit.zoom*distance/gesture.distance,Number(zoom.min),4),gesture.mid,W,H);
    editor=panPhoto(scaled,mid.x-gesture.mid.x,mid.y-gesture.mid.y,W,H);zoom.value=String(editor.zoom);
   }else if(gesture.point){editor=panPhoto(gesture.edit,points[0].x-gesture.point.x,points[0].y-gesture.point.y,W,H)}
   draw();return;
  }
  if(event.pointerId!==pointerId||!held)return;const rect=surface.getBoundingClientRect();
  if(!near(point(event.clientX,event.clientY,rect),anchor,.3))release();
 },{passive:false});
 function endPointer(event){if(pointers.has(event.pointerId)){pointers.delete(event.pointerId);if(editor)resetGesture()}if(event.pointerId===pointerId)release()}
 for(const type of ['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(type,endPointer);
 surface.addEventListener('wheel',event=>{if(!editor)return;event.preventDefault();updateZoom(editor.zoom*Math.exp(-event.deltaY*.002),at(event))},{passive:false});
 surface.addEventListener('keydown',event=>{
  surface.classList.remove('pointer-focus');
  if(editor){
   const delta={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]}[event.key];
   if(delta){event.preventDefault();editor=panPhoto(editor,...delta,W,H);draw()}return;
  }
  if(![' ','Enter'].includes(event.key)||event.repeat)return;event.preventDefault();press();
 });
 surface.addEventListener('keyup',event=>{if(!editor&&[' ','Enter'].includes(event.key)){event.preventDefault();release()}});
 surface.addEventListener('blur',()=>{if(held)release()});
 window.addEventListener('pointerup',event=>{if(event.pointerId===pointerId)release()});
 window.addEventListener('blur',()=>{finishPointers();release()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){finishPointers();held=false;pressure=0;cancelAnimationFrame(raf);raf=0;pointerId=null;surface.classList.remove('pressing');if(!editor)surface.setAttribute('aria-pressed','false');draw()}});
 reposition.addEventListener('click',()=>{if(photo)beginEdit(photo)});
 zoom.addEventListener('input',()=>updateZoom(Number(zoom.value)));
 $('#zoom-in').addEventListener('click',()=>{if(editor)updateZoom(editor.zoom*1.15)});
 $('#zoom-out').addEventListener('click',()=>{if(editor)updateZoom(editor.zoom/1.15)});
 $('#confirm').addEventListener('click',()=>{
  if(!editor)return;finishPointers();photo={...editor};drawPhoto(b,photo);editor=null;pressure=0;anchor={x:.5,y:.5};position();editorView();draw();
 });
 $('#cancel').addEventListener('click',()=>{if(editor){finishPointers();editor=null;pressure=0;editorView();draw()}});
 upload.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();fileInput.click()}});
 fileInput.addEventListener('change',async()=>{
  const file=fileInput.files?.[0];if(!file)return;const ticket=++version;status.textContent='';release();
  if(file.size>25*1024*1024){status.textContent='照片需小於 25 MB';fileInput.value='';return}
  const url=URL.createObjectURL(file);
  try{
   const image=new Image();image.src=url;await image.decode();if(ticket!==version)return;
   if(!image.naturalWidth||!image.naturalHeight||Math.max(image.naturalWidth,image.naturalHeight)>16384)throw Error('size');
   const source=document.createElement('canvas'),scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
   source.width=Math.max(1,Math.round(image.naturalWidth*scale));source.height=Math.max(1,Math.round(image.naturalHeight*scale));source.getContext('2d').drawImage(image,0,0,source.width,source.height);
   beginEdit({source,x:W/2,y:H/2,zoom:1});
  }catch{if(ticket===version)status.textContent='無法讀取照片'}
  finally{URL.revokeObjectURL(url);fileInput.value=''}
 });
 defaultPortrait();position();draw();schedule();
})();

