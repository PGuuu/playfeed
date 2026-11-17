const {supabaseRest}=require('./_lib');
let ownersCache=null,ownersAt=0;
async function ownerIds(){
 if(ownersCache&&Date.now()-ownersAt<60000)return ownersCache;
 const r=await supabaseRest('playfeed_analytics_devices',{query:'select=id&is_owner=eq.true'});
 if(!r.ok||!Array.isArray(r.data))throw Error('Counts unavailable');
 ownersCache=r.data.map(d=>d.id).filter(id=>/^[0-9a-f-]{36}$/i.test(id));ownersAt=Date.now();return ownersCache;
}
module.exports=async(req,res)=>{
 if(!['GET','HEAD'].includes(req.method))return res.status(405).end();
 const id=req.query?.gameId;
 if(typeof id!=='string'||! /^[a-zA-Z0-9_-]{1,200}$/.test(id))return res.status(400).json({error:'Invalid game'});
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 try{
  const owners=await ownerIds();
  const query='select=id&game_id=eq.'+encodeURIComponent(id)+'&action=eq.game_view&is_bot=eq.false&limit=1'+(owners.length?'&device_id=not.in.('+owners.join(',')+')':'');
  const r=await supabaseRest('playfeed_analytics_events',{query,prefer:'count=exact'});
  if(!r.ok||!Number.isSafeInteger(r.count)||r.count<0)throw Error('Counts unavailable');
  return res.status(200).json({playCount:r.count});
 }catch{return res.status(503).json({error:'遊玩次數暫時無法載入。'});}
};
