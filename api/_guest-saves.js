const {supabaseRest}=require('./_lib');
const {deviceId,deviceInfo}=require('./_device');
const rates=new Map();
function urlKey(value){
 if(typeof value!=='string'||value.length>500)throw Object.assign(Error('Invalid game URL'),{status:400});
 let url;try{url=new URL(value)}catch{throw Object.assign(Error('Invalid game URL'),{status:400})}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.href.length>500)throw Object.assign(Error('Invalid game URL'),{status:400});
 return url.href;
}
async function rpc(name,body){const r=await supabaseRest('rpc/'+name,{method:'POST',body});if(!r.ok)throw Error('Save sync unavailable');return r.data;}
async function saveGuest(req,res,body){
 const changes=body.changes;
 if(!Array.isArray(changes)||!changes.length||changes.length>32)throw Object.assign(Error('Invalid save batch'),{status:400});
 const validated=changes.map(change=>{if(typeof change.active!=='boolean')throw Object.assign(Error('Invalid save state'),{status:400});return {gameKey:urlKey(change.gameKey),active:change.active}});
 const id=deviceId(req,res),minute=Math.floor(Date.now()/60000),prior=rates.get(id),count=prior?.minute===minute?prior.count+1:1;
 rates.set(id,{minute,count});if(rates.size>5000)for(const [key,v]of rates)if(v.minute<minute)rates.delete(key);
 if(count>60)throw Object.assign(Error('Too many saves, please try again shortly.'),{status:429});
 const info=deviceInfo(req);
 const device=await supabaseRest('playfeed_analytics_devices',{method:'POST',query:'on_conflict=id',body:{id,family:info.family,browser:info.browser},prefer:'resolution=ignore-duplicates,return=minimal'});
 if(!device.ok)throw Error('Save sync unavailable');
 return rpc('playfeed_guest_save_batch',{p_device_id:id,p_changes:validated,p_countable:!info.is_bot});
}
async function mergeGuest(req,res,user,body){
 if(!Array.isArray(body.gameKeys)||body.gameKeys.length>500)throw Object.assign(Error('Invalid collection'),{status:400});
 return rpc('playfeed_merge_guest_saves',{p_device_id:deviceId(req,res),p_user_id:user.id,p_games:[...new Set(body.gameKeys.map(urlKey))]});
}
module.exports={saveGuest,mergeGuest};
