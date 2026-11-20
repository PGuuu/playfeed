(()=>{
 'use strict';
 const $=s=>document.querySelector(s),surface=$('#surface'),canvas=$('#portrait'),ctx=canvas.getContext('2d');
 const fileInput=$('#file'),upload=$('#upload'),reposition=$('#reposition'),hint=$('#hint'),status=$('#status');
 const {clamp,point,cover,near,sampleRow}=BrowGeometry;
 const W=720,H=912,base=document.createElement('canvas'),patch=document.createElement('canvas');
 base.width=W;base.height=H;const b=base.getContext('2d');
 patch.width=280;patch.height=280;const p=patch.getContext('2d');
 let anchor={x:.5,y:.35},locating=false,held=false,pointerId=null,pressure=0,raf=0,version=0,started=0;
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
 function draw(time=performance.now()){
  ctx.clearRect(0,0,W,H);ctx.drawImage(base,0,0);
  if(pressure<.001)return;
  const radius=140,cx=anchor.x*W,cy=anchor.y*H,x=cx-radius,y=cy-radius;
  p.clearRect(0,0,280,280);p.globalCompositeOperation='source-over';
  for(let row=0;row<280;row+=3){
   const {dx,dy}=sampleRow(row-radius,radius,pressure);
   const sourceY=clamp(y+row+dy,0,H-3),sourceX=clamp(x-dx,0,W-1),sourceWidth=Math.min(280+dx*2,W-sourceX);
   p.drawImage(base,sourceX,sourceY,sourceWidth,Math.min(3,H-sourceY),0,row,280,3);
  }
  p.globalCompositeOperation='destination-in';const mask=p.createRadialGradient(radius,radius,radius*.35,radius,radius,radius);mask.addColorStop(0,'#000');mask.addColorStop(.7,'#000');mask.addColorStop(1,'#0000');p.fillStyle=mask;p.fillRect(0,0,280,280);
  p.globalCompositeOperation='source-over';ctx.drawImage(patch,x,y);
  const shadow=ctx.createRadialGradient(cx,cy,3,cx,cy,52);shadow.addColorStop(0,'rgba(104,65,40,'+pressure*.13+')');shadow.addColorStop(.5,'rgba(104,65,40,'+pressure*.055+')');shadow.addColorStop(1,'rgba(104,65,40,0)');ctx.fillStyle=shadow;ctx.beginPath();ctx.arc(cx,cy,52,0,Math.PI*2);ctx.fill();
  if(!reduced){const cycle=((time-started)%1800)/1800;ctx.strokeStyle='rgba(255,244,218,'+(1-cycle)*.18*pressure+')';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,30+cycle*65,0,Math.PI*2);ctx.stroke()}
 }
 function animate(time){
  raf=0;const target=held?1:0;pressure+=(target-pressure)*(reduced ? .55 : .17);if(Math.abs(target-pressure)<.001)pressure=target;draw(time);
  if(held||pressure>0)raf=requestAnimationFrame(animate);
 }
 function schedule(){if(!raf)raf=requestAnimationFrame(animate)}
 function press(){held=true;started=performance.now();surface.classList.add('pressing');surface.setAttribute('aria-pressed','true');schedule()}
 function release(){held=false;pointerId=null;surface.classList.remove('pressing');surface.setAttribute('aria-pressed','false');schedule()}
 function setLocating(value){locating=value;surface.classList.toggle('locating',value);hint.hidden=!value;surface.setAttribute('aria-label',value?'點一下照片的眉心位置':'按住眉心，放開回彈')}
 surface.addEventListener('pointerdown',event=>{
  if(!event.isPrimary||event.button!==0||pointerId!==null)return;
  const rect=surface.getBoundingClientRect(),at=point(event.clientX,event.clientY,rect);
  if(locating){anchor={x:clamp(at.x,.08,.92),y:clamp(at.y,.08,.9)};position();setLocating(false)}
  const hitRadius=Math.max(35/rect.width,.11);
  if(!near(at,anchor,hitRadius))return;
  event.preventDefault();surface.focus({preventScroll:true});pointerId=event.pointerId;surface.setPointerCapture(pointerId);press();
 });
 surface.addEventListener('pointermove',event=>{
  if(event.pointerId!==pointerId||!held)return;
  const rect=surface.getBoundingClientRect();if(!near(point(event.clientX,event.clientY,rect),anchor,.25))release();
 });
 for(const type of ['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(type,release);
 surface.addEventListener('keydown',event=>{if(![' ','Enter'].includes(event.key)||event.repeat)return;event.preventDefault();if(locating)setLocating(false);press()});
 surface.addEventListener('keyup',event=>{if([' ','Enter'].includes(event.key)){event.preventDefault();release()}});
 window.addEventListener('pointerup',()=>{if(held)release()});window.addEventListener('blur',release);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){held=false;pressure=0;cancelAnimationFrame(raf);raf=0;pointerId=null;surface.classList.remove('pressing');surface.setAttribute('aria-pressed','false');draw()}});
 reposition.addEventListener('click',()=>{release();setLocating(true)});
 upload.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();fileInput.click()}});
 fileInput.addEventListener('change',async()=>{
  const file=fileInput.files?.[0];if(!file)return;
  const ticket=++version;status.textContent='';release();
  if(file.size>25*1024*1024){status.textContent='照片需小於 25 MB';fileInput.value='';return}
  const url=URL.createObjectURL(file);
  try{
   const image=new Image();image.src=url;await image.decode();if(ticket!==version)return;
   if(!image.naturalWidth||!image.naturalHeight||Math.max(image.naturalWidth,image.naturalHeight)>16384)throw Error('size');
   const source=document.createElement('canvas'),scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));source.width=Math.max(1,Math.round(image.naturalWidth*scale));source.height=Math.max(1,Math.round(image.naturalHeight*scale));source.getContext('2d').drawImage(image,0,0,source.width,source.height);
   const fit=cover(source.width,source.height,W,H);b.clearRect(0,0,W,H);b.drawImage(source,fit.x,fit.y,fit.width,fit.height);
   pressure=0;anchor={x:.5,y:.35};position();draw();upload.classList.add('compact');upload.setAttribute('aria-label','更換照片');reposition.hidden=false;setLocating(true);
  }catch{if(ticket===version)status.textContent='無法讀取照片'}
  finally{URL.revokeObjectURL(url);fileInput.value=''}
 });
 defaultPortrait();position();draw();schedule();
})();
