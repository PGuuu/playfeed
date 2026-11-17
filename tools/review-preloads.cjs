const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.join(__dirname,'..'),manifest=require('../preload-assets.json');
(async()=>{
 const entries=Object.entries(manifest);for(let start=0;start<entries.length;start+=36){
  const batch=entries.slice(start,start+36),layers=[];
  for(let i=0;i<batch.length;i++){
   const tile=await sharp(path.join(root,batch[i][1].image.slice(1))).resize(120,190,{fit:'contain',background:'#000'}).jpeg().toBuffer();
   const x=(i%6)*126,y=Math.floor(i/6)*214;
   layers.push({input:tile,left:x,top:y});
   layers.push({input:Buffer.from('<svg width="126" height="24"><text x="5" y="17" font-size="13" fill="white">'+(start+i+1)+'</text></svg>'),left:x,top:y+190});
  }
  await sharp({create:{width:756,height:Math.ceil(batch.length/6)*214,channels:3,background:'#222'}}).composite(layers).jpeg({quality:85}).toFile(path.join(root,'../preload-review-'+(start/36+1)+'.jpg'));
 }console.log('Review sheets:',Math.ceil(entries.length/36));
})();
