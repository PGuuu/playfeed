(function(root){
 'use strict';
 function create({canvas,renderFrame,onState=()=>{},onReady=()=>{},onError=()=>{}},env=globalThis){
  let current=null,disposed=false;
  const clock=()=>env.performance.now();
  function cleanup(session){if(session.cleaned)return;session.cleaned=true;if(session.raf)env.cancelAnimationFrame(session.raf);session.raf=0;session.stream?.getTracks().forEach(track=>track.stop())}
  function fail(session,error){
   if(session.failed)return;session.failed=true;const active=current===session;if(active)current=null;
   try{if(session.recorder?.state!=='inactive')session.recorder?.stop()}catch{}
   cleanup(session);if(active&&!disposed){onState({state:'idle',seconds:0});onError(error)}
  }
  return {
   get active(){return !!current},
   start(){
    if(current||disposed)return false;
    const session={chunks:[],raf:0,stream:null,recorder:null,failed:false,start:clock(),lastFrame:-Infinity,lastSecond:-1};current=session;
    try{
     if(typeof env.MediaRecorder!=='function'||typeof canvas.captureStream!=='function')throw Error('unsupported');
     renderFrame(clock());session.stream=canvas.captureStream(30);
     const candidates=['video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
     for(const mimeType of candidates){
      if(!env.MediaRecorder.isTypeSupported(mimeType))continue;
      try{session.recorder=new env.MediaRecorder(session.stream,{mimeType,videoBitsPerSecond:3000000});break}catch{}
     }
     if(!session.recorder)session.recorder=new env.MediaRecorder(session.stream);
     const recorder=session.recorder;
     recorder.ondataavailable=event=>{if(!session.failed&&event.data?.size)session.chunks.push(event.data)};
     recorder.onerror=event=>fail(session,event.error||Error('recording'));
     recorder.onstop=()=>{
      cleanup(session);if(current!==session)return;current=null;
      if(disposed||session.failed)return;
      onState({state:'idle',seconds:0});
      const mimeType=(recorder.mimeType||session.chunks[0]?.type||'video/webm').split(';')[0];
      const blob=new env.Blob(session.chunks,{type:mimeType});
      if(!blob.size){onError(Error('empty'));return}
      onReady({blob,filename:'按按眉心錄影.'+(mimeType==='video/mp4'?'mp4':'webm')});
     };
     recorder.start(1000);onState({state:'recording',seconds:0});
     function frame(time){
      if(current!==session||recorder.state!=='recording')return;
      try{
       if(time-session.lastFrame>=1000/30){renderFrame(time);session.lastFrame=time}
       const seconds=Math.floor((time-session.start)/1000);
       if(seconds!==session.lastSecond){session.lastSecond=seconds;onState({state:'recording',seconds})}
       session.raf=env.requestAnimationFrame(frame);
      }catch(error){fail(session,error)}
     }
     session.raf=env.requestAnimationFrame(frame);return true;
    }catch(error){fail(session,error);return false}
   },
   stop(){
    const session=current;if(!session||session.recorder?.state!=='recording')return;
    env.cancelAnimationFrame(session.raf);session.raf=0;onState({state:'stopping',seconds:0});
    try{session.recorder.stop()}catch(error){fail(session,error)}
   },
   dispose(){disposed=true;const session=current;if(!session)return;current=null;try{if(session.recorder?.state!=='inactive')session.recorder?.stop()}catch{}cleanup(session)}
  };
 }
 if(root)root.BrowRecording={create};
 if(typeof module!=='undefined'&&module.exports)module.exports={create};
})(typeof window!=='undefined'?window:null);
