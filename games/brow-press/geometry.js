(function(root){
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function point(clientX,clientY,rect){return {x:clamp((clientX-rect.left)/rect.width,0,1),y:clamp((clientY-rect.top)/rect.height,0,1)}}
 function cover(width,height,w,h){const scale=Math.max(w/width,h/height);return {x:(w-width*scale)/2,y:(h-height*scale)/2,width:width*scale,height:height*scale}}
 function near(a,b,radius){return Math.hypot(a.x-b.x,a.y-b.y)<=radius}
 function sampleRow(y,radius,pressure){const q=y/radius,falloff=Math.max(0,1-q*q)**2;return {dx:radius*.09*clamp(pressure,0,1)*falloff,dy:radius*.055*clamp(pressure,0,1)*falloff}}
 const api={clamp,point,cover,near,sampleRow};
 if(root)root.BrowGeometry=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:null);
