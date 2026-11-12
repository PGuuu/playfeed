const { loadPlayfeedGames } = require('../catalog.js');
const origin = 'https://playfeed-gilt.vercel.app';
module.exports=async function handler(req,res){
 if(!['GET','HEAD'].includes(req.method))return res.status(405).end();
 const id=req.query?.id;
 if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,200}$/.test(id))return res.status(404).end();
 try{
  const games=await loadPlayfeedGames(async resource=>{const r=await fetch('https://oimdeoszgxfumwtmapok.supabase.co/rest/v1'+resource,{headers:{apikey:'sb_publishable_ZovEIH8JuRiKuf24MTIKLg_sz2Tnui8'},signal:AbortSignal.timeout(3000)});if(!r.ok)throw Error('Catalog unavailable');return r.json();},origin+'/');
  const game=games.find(g=>g.id===id);
  if(!game){res.setHeader('Cache-Control','no-store');return res.status(404).end();}
  const {staticAsset,readAsset}=require('./_share-assets');
  const saved=staticAsset(game);
  if(saved){res.setHeader('Location',origin+saved);res.setHeader('Cache-Control','public, max-age=0, s-maxage=60');return res.status(302).end();}
  let result;
  try { result=await readAsset(game); }
  catch { result=await require('./_render-card').renderCard(game); }
  res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','public, max-age=0, s-maxage=3600');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method==='HEAD')return res.end();return res.send(result);
 }catch(error){console.error('OG image failed',error.message);res.setHeader('Cache-Control','no-store');return res.status(503).send('Preview temporarily unavailable');}
};
