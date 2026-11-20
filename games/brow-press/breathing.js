(function(root){
 function create(){
  let phase='idle',started=0;
  return {
   get active(){return phase!=='idle'},
   start(time){phase='inhale';started=time},
   release(time){if(phase==='inhale'){phase='exhale';started=time}},
   reset(){phase='idle'},
   sample(time){
    const elapsed=Math.max(0,time-started),progress=Math.min(1,elapsed/5000);
    if(phase==='exhale'&&elapsed>=5000)phase='idle';
    if(phase==='idle')return {phase,label:'',remaining:0,fill:0};
    return {phase,label:phase==='inhale'?(progress===1?'放開':'吸氣'):'吐氣',remaining:Math.max(0,Math.ceil((5000-elapsed)/1000)),fill:phase==='inhale'?progress:1-progress};
   }
  };
 }
 if(root)root.BrowBreathing={create};
 if(typeof module!=='undefined'&&module.exports)module.exports={create};
})(typeof window!=='undefined'?window:null);
