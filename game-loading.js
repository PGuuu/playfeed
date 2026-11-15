(function(root){
 function start({indicator,stage,frame}){
  let stopped=false;
  const title=indicator.querySelector('.loading-title');
  const note=indicator.querySelector('.loading-note');
  const help=indicator.querySelector('.loading-help');
  indicator.hidden=true;help.hidden=true;
  title.textContent='Loading…';note.textContent='請稍後';
  stage.setAttribute('aria-busy','true');
  const revealTimer=setTimeout(()=>{if(!stopped)indicator.hidden=false},1000);
  const slowTimer=setTimeout(()=>{
   if(stopped)return;
   note.textContent='載入時間較久，請稍後';help.hidden=false;
  },8000);
  function cleanup(){
   if(stopped)return;
   stopped=true;clearTimeout(revealTimer);clearTimeout(slowTimer);
   frame.removeEventListener('load',loaded);frame.removeEventListener('error',failed);
   indicator.hidden=true;stage.removeAttribute('aria-busy');
  }
  function loaded(){if(frame.getAttribute('src'))cleanup()}
  function failed(){
   if(stopped)return;
   clearTimeout(revealTimer);clearTimeout(slowTimer);indicator.hidden=false;
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
