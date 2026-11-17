(function(root){
 function focus(value={}){
  const clamp=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Number(v))):fallback;
  return {x:clamp(value?.x,0,1,.5),y:clamp(value?.y,0,1,.5),zoom:clamp(value?.zoom,1,3,1)};
 }
 function box(width,height,value){
  const f=focus(value),ratio=1200/630;
  const cropWidth=Math.max(1,Math.min(width,Math.round(Math.min(width,height*ratio)/f.zoom)));
  const cropHeight=Math.max(1,Math.min(height,Math.round(cropWidth/ratio)));
  return {left:Math.round((width-cropWidth)*f.x),top:Math.round((height-cropHeight)*f.y),width:cropWidth,height:cropHeight};
 }
 const api={focus,box};if(typeof module!=='undefined')module.exports=api;if(root)root.PlayFeedPreviewCrop=api;
})(typeof window==='undefined'?null:window);
