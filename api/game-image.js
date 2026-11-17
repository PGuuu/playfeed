module.exports=async function(req,res){
 if(!['GET','HEAD'].includes(req.method))return res.status(405).end();
 const key=req.query?.key;
 if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))return res.status(404).end();
 try{
  const image=await require('./_game-preview').readPreview(key);
  res.setHeader('Content-Type','image/png');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control','public, max-age=31536000, immutable');
  return req.method==='HEAD'?res.end():res.send(image);
 }catch(error){res.setHeader('Cache-Control','no-store');return res.status(error.status||503).end();}
};
