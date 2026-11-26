const {loadPlayfeedGames}=require('../catalog');
// Use the same public fields and role as the browser, never a privileged query.
const base='https://oimdeoszgxfumwtmapok.supabase.co/rest/v1';
const key='sb_publishable_ZovEIH8JuRiKuf24MTIKLg_sz2Tnui8';
module.exports=async function(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return res.status(405).end();}
 try{
  const games=await loadPlayfeedGames(async path=>{
   const response=await fetch(base+path,{headers:{apikey:key},signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw Error('Public catalog unavailable');
   const data=await response.json();if(!Array.isArray(data))throw Error('Invalid public catalog');return data;
  },'https://fangame.app/');
  return res.status(200).send(req.method==='HEAD'?'':JSON.stringify({games}));
 }catch{return res.status(503).send(req.method==='HEAD'?'':JSON.stringify({error:'遊戲清單暫時無法載入，請稍後重試。'}));}
};
