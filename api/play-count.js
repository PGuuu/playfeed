const {supabaseRest}=require('./_lib');
const historical=require('./_historical-plays.json');
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
  const tail='&is_bot=eq.false&limit=1'+(owners.length?'&device_id=not.in.('+owners.join(',')+')':'');
  const count=async action=>{const r=await supabaseRest('playfeed_analytics_events',{query:'select=id&game_id=eq.'+encodeURIComponent(id)+'&action=eq.'+action+tail,prefer:'count=exact'});if(!r.ok||!Number.isSafeInteger(r.count)||r.count<0)throw Error('Counts unavailable');return r.count;};
  const [exposureCount,playCount]=await Promise.all([count('game_view'),count('game_play')]);
  const historicalPlayCount=historical.counts[id] || 0;
  return res.status(200).json({exposureCount,playCount:playCount+historicalPlayCount,playThresholdSeconds:10});
 }catch{return res.status(503).json({error:'遊玩次數暫時無法載入。'});}
};
