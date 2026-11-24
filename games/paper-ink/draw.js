(()=>{
 'use strict';
 const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),sheet=document.querySelector('.sheet'),desk=document.querySelector('.desk'),hint=document.querySelector('.hint'),status=document.querySelector('.status');
 const undo=document.querySelector('#undo'),redo=document.querySelector('#redo'),clear=document.querySelector('#clear'),save=document.querySelector('#save');
 const W=900,H=1200,paper=document.createElement('canvas');paper.width=W;paper.height=H;
 const pc=paper.getContext('2d');let seed=20261124;
 function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
 const texture=pc.createImageData(W,H);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=(y*W+x)*4,grain=(random()-.5)*13,wave=Math.sin(x*.09+y*.07)*1.1,edge=Math.pow(Math.max(Math.abs(x/W-.5),Math.abs(y/H-.5))*2,5)*3;
  texture.data[i]=246+grain+wave-edge;texture.data[i+1]=240+grain+wave-edge;texture.data[i+2]=222+grain+wave-edge;texture.data[i+3]=255;
 }
 pc.putImageData(texture,0,0);
 for(let i=0;i<11000;i++){const x=random()*W,y=random()*H;pc.strokeStyle=random()>.5?'rgba(105,83,46,.035)':'rgba(255,255,248,.13)';pc.lineWidth=.35;pc.beginPath();pc.moveTo(x,y);pc.lineTo(x+(random()-.5)*5,y+random()*3);pc.stroke();}
 let strokes=[],history=[],future=[],active=null,pointer=null,pen=3.5;
 function refresh(){undo.disabled=!history.length||!!active;redo.disabled=!future.length||!!active;clear.disabled=!strokes.length||!!active;hint.hidden=!!strokes.length||!!active;save.disabled=!!active;}
 function dot(x,y,width,salt){
  const jitter=Math.sin(salt*12.9898)*.12;
  ctx.fillStyle='rgba(25,23,20,.22)';ctx.beginPath();ctx.ellipse(x,y,width*.66,width*.57,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(24,22,19,.78)';ctx.beginPath();ctx.ellipse(x+jitter,y-jitter,width*.46,width*.43,.3,0,Math.PI*2);ctx.fill();
 }
 function segment(from,control,to,salt){
  const length=Math.hypot(control.x-from.x,control.y-from.y)+Math.hypot(to.x-control.x,to.y-control.y),steps=Math.max(1,Math.ceil(length/.65));
  for(let i=1;i<=steps;i++){const t=i/steps,u=1-t;dot(u*u*from.x+2*u*t*control.x+t*t*to.x,u*u*from.y+2*u*t*control.y+t*t*to.y,from.w+(to.w-from.w)*t,salt+i);}
 }
 const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2,w:(a.w+b.w)/2});
 function extend(stroke,n=stroke.points.length){const p=stroke.points;if(n===1){dot(p[0].x,p[0].y,p[0].w*1.08,stroke.seed);return;}const a=p[n-2],b=p[n-1],from=n===2?a:midpoint(p[n-3],a);segment(from,a,midpoint(a,b),stroke.seed+n*107);}
 function finishInk(stroke){const p=stroke.points;if(p.length>1){const last=p[p.length-1];segment(midpoint(p[p.length-2],last),last,last,stroke.seed+p.length*107+31);}}
 function redraw(){ctx.drawImage(paper,0,0);for(const stroke of strokes){for(let i=1;i<=stroke.points.length;i++)extend(stroke,i);finishInk(stroke);}refresh();}
 function point(event){const r=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(W,(event.clientX-r.left)/r.width*W)),y:Math.max(0,Math.min(H,(event.clientY-r.top)/r.height*H)),t:event.timeStamp};}
 function sample(event){const p=point(event),previous=active.points.at(-1);const distance=previous?Math.hypot(p.x-previous.x,p.y-previous.y):0;if(previous&&distance<.45)return;
  const speed=previous?distance/Math.max(1,p.t-previous.t):0,pressure=event.pointerType==='pen'?(.65+Math.max(.05,event.pressure)*.7):1;
  const target=pen*pressure*(1.12-Math.min(.34,speed*.035));p.w=previous?previous.w*.7+target*.3:target;active.points.push(p);extend(active);
 }
 canvas.addEventListener('pointerdown',event=>{if(pointer!==null||event.button!==0)return;event.preventDefault();pointer=event.pointerId;canvas.setPointerCapture(pointer);active={points:[],seed:Math.floor(random()*100000)};sample(event);refresh();});
 canvas.addEventListener('pointermove',event=>{if(event.pointerId!==pointer||!active)return;event.preventDefault();const events=event.getCoalescedEvents?.()||[];for(const item of events.length?events:[event])sample(item);});
 function end(event){if(event.pointerId!==pointer||!active)return;if(event.type==='pointerup')sample(event);finishInk(active);history.push(strokes);strokes=[...strokes,active];active=null;future=[];pointer=null;refresh();persist();}
 for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,end);
 const storageKey='fangame:paper-ink:v1';
 function persist(){try{localStorage.setItem(storageKey,JSON.stringify(strokes));}catch{}}
 undo.addEventListener('click',()=>{if(!history.length||active)return;future.push(strokes);strokes=history.pop();redraw();persist();status.textContent='退回上一步。';});
 redo.addEventListener('click',()=>{if(!future.length||active)return;history.push(strokes);strokes=future.pop();redraw();persist();status.textContent='重做上一步。';});
 clear.addEventListener('click',()=>{if(active||!strokes.length)return;history.push(strokes);strokes=[];future=[];redraw();persist();status.textContent='新的一張紙。按「復原」可找回剛才的畫。';});
 document.querySelectorAll('[data-size]').forEach(button=>button.addEventListener('click',()=>{if(active)return;pen=Number(button.dataset.size);document.querySelectorAll('[data-size]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));}));
 document.addEventListener('keydown',event=>{if(active||!(event.ctrlKey||event.metaKey)||event.key.toLowerCase()!=='z')return;event.preventDefault();(event.shiftKey?redo:undo).click();});
 save.addEventListener('click',()=>{canvas.toBlob(async blob=>{if(!blob){status.textContent='圖片未能產生，請再試一次。';return;}const file=new File([blob],'紙上-'+new Date().toISOString().slice(0,10)+'.png',{type:'image/png'});try{if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'紙上 · 我的針筆畫'});status.textContent='把這一張，留給自己。';return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);status.textContent='已送出存圖，圖片也會保留紙張紋理。';}catch(error){status.textContent=error.name==='AbortError'?'畫還在這裡，想存時再按一次。':'未能存圖，請用外部瀏覽器開啟後再試。';}},'image/png');});
 function fit(){const style=getComputedStyle(desk),w=desk.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),h=desk.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom),scale=Math.max(0,Math.min(w/W,h/H));sheet.style.width=W*scale+'px';sheet.style.height=H*scale+'px';}
 new ResizeObserver(fit).observe(desk);
 try{const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(saved)&&saved.length<10000&&saved.every(s=>Array.isArray(s.points)&&s.points.length&&Number.isFinite(s.seed)&&s.points.every(p=>[p.x,p.y,p.w].every(Number.isFinite))))strokes=saved;}catch{}
 redraw();fit();
})();
