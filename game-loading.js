(function(root){
 function start({indicator,stage,frame,image}){
  let stopped=false,hasImage=Boolean(image),gameReady=false,shownAt=null,minTimer=null,imageTimer=null,revealAnimation=null;
  const title=indicator.querySelector('.loading-title');
  const note=indicator.querySelector('.loading-note');
  const help=indicator.querySelector('.loading-help');
  indicator.querySelector('.loading-preview-image')?.remove();
  indicator.classList.toggle('has-preview',Boolean(image));
  if(image){
   const img=document.createElement('img');img.className='loading-preview-image';img.alt='';
   function imageFailed(){if(stopped)return;clearTimeout(imageTimer);hasImage=false;img.remove();indicator.classList.remove('has-preview');maybeReveal();}
   img.addEventListener('load',()=>{if(stopped||!hasImage)return;clearTimeout(imageTimer);shownAt=Date.now();maybeReveal()},{once:true});
   img.addEventListener('error',imageFailed,{once:true});indicator.prepend(img);img.src=image;
   imageTimer=setTimeout(imageFailed,2500);
  }
  indicator.hidden=!image;help.hidden=true;
  title.textContent='Loading…';note.textContent='請稍後';
  stage.setAttribute('aria-busy','true');
  const revealTimer=setTimeout(()=>{if(!stopped)indicator.hidden=false},1000);
  const slowTimer=setTimeout(()=>{
   if(stopped)return;
   note.textContent='載入時間較久，請稍後';help.hidden=false;
  },8000);
  function cleanup(){
   if(stopped)return;
   stopped=true;clearTimeout(revealTimer);clearTimeout(slowTimer);clearTimeout(minTimer);clearTimeout(imageTimer);revealAnimation?.cancel();
   frame.removeEventListener('load',loaded);frame.removeEventListener('error',failed);
   indicator.hidden=true;stage.removeAttribute('aria-busy');
  }
  function maybeReveal(){
   if(stopped||!gameReady)return;
   if(!hasImage){cleanup();return;}
   if(shownAt===null||minTimer!==null)return;
   minTimer=setTimeout(()=>{
    if(stopped)return;
    if(typeof indicator.animate!=='function'||root?.matchMedia?.('(prefers-reduced-motion: reduce)').matches){cleanup();return;}
    revealAnimation=indicator.animate([{opacity:1},{opacity:0}],{duration:220,fill:'forwards',easing:'ease-out'});
    revealAnimation.finished.then(cleanup,()=>{});
   },Math.max(0,500-(Date.now()-shownAt)));
  }
  function loaded(){if(frame.getAttribute('src')){gameReady=true;maybeReveal()}}
  function failed(){
   if(stopped)return;
   clearTimeout(revealTimer);clearTimeout(slowTimer);clearTimeout(minTimer);clearTimeout(imageTimer);revealAnimation?.cancel();gameReady=false;indicator.hidden=false;
   title.textContent='暫時無法載入';note.textContent='可以先切換其他遊戲';help.hidden=true;
   stage.removeAttribute('aria-busy');
  }
  frame.addEventListener('load',loaded);frame.addEventListener('error',failed);
  return cleanup;
 }
 const api={start};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.PlayFeedLoading=api;
})(typeof window!=='undefined'?window:null);
