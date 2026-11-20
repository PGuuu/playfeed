(function(root){
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function point(clientX,clientY,rect){return {x:clamp((clientX-rect.left)/rect.width,0,1),y:clamp((clientY-rect.top)/rect.height,0,1)}}
 function cover(width,height,w,h){const scale=Math.max(w/width,h/height);return {x:(w-width*scale)/2,y:(h-height*scale)/2,width:width*scale,height:height*scale}}
 function near(a,b,radius){return Math.hypot(a.x-b.x,a.y-b.y)<=radius}
 function sampleRow(y,radius,pressure){const q=y/radius,falloff=Math.max(0,1-q*q)**2,amount=clamp(pressure,0,1)*falloff;return {dx:radius*.55*amount,dy:-radius*.34*amount}}
 function fitPhoto(width,height,w,h,zoom){const fit=cover(width,height,w,h);return {width:fit.width*zoom,height:fit.height*zoom}}
 function panPhoto(value,dx,dy,w,h){const fit=fitPhoto(value.source.width,value.source.height,w,h,value.zoom);return {...value,x:clamp(value.x+dx,w/2-fit.width/2,w/2+fit.width/2),y:clamp(value.y+dy,h/2-fit.height/2,h/2+fit.height/2)}}
 function zoomPhoto(value,zoom,pivot,w,h){const ratio=zoom/value.zoom;return panPhoto({...value,zoom,x:pivot.x+(value.x-pivot.x)*ratio,y:pivot.y+(value.y-pivot.y)*ratio},0,0,w,h)}
 function deformPoint(x,y,radius,pressure){const dx=x-radius,dy=y-radius,falloff=Math.max(0,1-(dx*dx+dy*dy)/(radius*radius))**2,amount=clamp(pressure,0,1)*falloff;return {x:x-dx*.65*amount,y:y+radius*.42*amount}}
 const api={clamp,point,cover,near,sampleRow,fitPhoto,panPhoto,zoomPhoto,deformPoint};
 if(root)root.BrowGeometry=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:null);

