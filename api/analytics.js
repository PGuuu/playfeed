const crypto=require('node:crypto');
const {readJson,sendJson,requestOriginAllowed,supabaseRest,verifyPhuzeSession}=require('./_lib');
const OWNERS=new Set(['paulvongulla@gmail.com','paulwu.hs10@nycu.edu.tw']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ENTRIES=new Set(['next','previous','search_selection','saved_selection','creator_selection','internal_selection','external_entry','direct_entry','feed_initial','reload','unknown']);
const ACTIONS=new Set(['page_view','game_view','game_time','save_click','save_success','guest_save_success','save_sync_success','unsave_success','guest_unsave_success','comments_open','comment_success','rating_open','rating_success','share_click','share_success','report_open','report_success','creator_open','account_open','search_open','search_select','previous_game','next_game','menu_open','recommend_open','recommend_success','login_open','external_open','settings_open']);
const { saveCountSummary } = require('./_save-counts');
const rates=new Map();
const {deviceId,deviceInfo}=require('./_device');
async function db(table,options){const r=await supabaseRest(table,options);if(!r.ok)throw Error('Analytics database unavailable');return r.data;}
async function ensureDevice(id,info){
 await db('playfeed_analytics_devices',{method:'POST',query:'on_conflict=id',body:{id,family:info.family,browser:info.browser},prefer:'resolution=ignore-duplicates,return=minimal'});
}
async function owner(req){const result=await verifyPhuzeSession(req);if(!result.user||!OWNERS.has(result.user.email.toLowerCase()))throw Object.assign(Error('僅限網站擁有者查看統計。'),{status:403});return result.user;}
async function markOwner(id,label,overwrite=true){
 await db('playfeed_analytics_devices',{method:'PATCH',query:'id=eq.'+id,body:{is_owner:true,...(overwrite?{label:String(label||'我的裝置').slice(0,60)}:{}),last_seen:new Date().toISOString()}});
 if(!overwrite)await db('playfeed_analytics_devices',{method:'PATCH',query:'id=eq.'+id+'&label=eq.',body:{label:String(label||'我的裝置').slice(0,60)}});
}
function text(v,max){return typeof v==='string'?v.slice(0,max):'';}
module.exports=async(req,res)=>{
 if(!requestOriginAllowed(req))return sendJson(res,403,{error:'Origin not allowed'});
 try{
  if(req.method==='GET'){
   await owner(req);
   const days=Math.min(90,Math.max(1,Number(req.query?.days)||7));
   const audience=['external','owner','all'].includes(req.query?.audience)?req.query.audience:'external';
   const [report,devices,saveCounts,memberProfiles,impact]=await Promise.all([db('rpc/playfeed_analytics_report',{method:'POST',body:{p_days:Math.round(days),p_audience:audience}}),db('playfeed_analytics_devices',{query:'select=id,label,family,browser,first_seen,last_seen&is_owner=eq.true&order=last_seen.desc'}),saveCountSummary(),db('playfeed_profiles',{query:'select=display_name,updated_at&order=updated_at.desc&limit=500'}),require('./_impact-summary').impactSummary()]);
   return sendJson(res,200,{report,devices,saveCounts,memberProfiles,impact,audience,days});
  }
  if(req.method!=='POST')return sendJson(res,405,{error:'Method not allowed'});
  const body=await readJson(req,40000),action=body.action;
  const id=deviceId(req,res),info=deviceInfo(req);
  const minute=Math.floor(Date.now()/60000),rate=rates.get(id);
  const count=rate?.minute===minute?rate.count+1:1;
  rates.set(id,{minute,count});if(rates.size>5000)for(const [key,value]of rates)if(value.minute<minute)rates.delete(key);
  if(count>120)return sendJson(res,429,{error:'Too many analytics requests'});
  await ensureDevice(id,info);
  if(action==='init')return sendJson(res,200,{ok:true});
  if(action==='identify'){
   const verified=await verifyPhuzeSession(req);
   if(verified.user&&OWNERS.has(verified.user.email.toLowerCase())){await markOwner(id,'我的 '+info.family+' · '+info.browser,false);return sendJson(res,200,{isOwner:true});}
   return sendJson(res,200,{isOwner:false});
  }
  if(action==='pair-link'){
   await owner(req);const token=crypto.randomBytes(32).toString('hex');
   await db('playfeed_analytics_pairings',{method:'POST',body:{token_hash:crypto.createHash('sha256').update(token).digest('hex'),expires_at:new Date(Date.now()+15*60000).toISOString(),label:text(body.label,60)||'我的 iPhone'}});
   return sendJson(res,200,{url:'https://playfeed-gilt.vercel.app/analytics.html#pair='+token});
  }
  if(action==='claim'){
   if(!/^[a-f0-9]{64}$/.test(body.token||''))return sendJson(res,400,{error:'裝置標記連結無效。'});
   const rows=await db('playfeed_analytics_pairings',{method:'PATCH',query:'token_hash=eq.'+crypto.createHash('sha256').update(body.token).digest('hex')+'&used_at=is.null&expires_at=gt.'+encodeURIComponent(new Date().toISOString()),body:{used_at:new Date().toISOString()},prefer:'return=representation'});
   if(!rows?.length)return sendJson(res,410,{error:'連結已使用或超過 15 分鐘，請重新產生。'});
   await markOwner(id,rows[0].label);return sendJson(res,200,{ok:true,label:rows[0].label});
  }
  if(action==='label'){
   await owner(req);if(!UUID.test(body.id||''))return sendJson(res,400,{error:'Invalid device'});
   await db('playfeed_analytics_devices',{method:'PATCH',query:'id=eq.'+body.id+'&is_owner=eq.true',body:{label:text(body.label,60)}});return sendJson(res,200,{ok:true});
  }
  if(action!=='events'||!Array.isArray(body.events)||body.events.length>40)return sendJson(res,400,{error:'Invalid analytics batch'});
  const rows=body.events.map(e=>{
   if(!UUID.test(e.id||'')||!UUID.test(e.session||'')||!ACTIONS.has(e.action)||!Number.isInteger(e.ms||0)||(e.ms||0)<0||(e.ms||0)>60000)throw Object.assign(Error('Invalid event'),{status:400});
   let referrer='';try{referrer=new URL(e.referrer).hostname.slice(0,200)}catch{}
   return {id:e.id,device_id:id,session_id:e.session,game_id:text(e.game,200),game_title:text(e.title,300),action:e.action,entry_source:ENTRIES.has(e.entry)?e.entry:'unknown',previous_game_id:text(e.previous,200),duration_ms:e.action==='game_time'?(e.ms||0):0,path:['/','/account.html','/submit.html','/analytics.html'].includes(e.path)?e.path:e.path?.startsWith('/g/')?'/g/':'/',referrer,is_bot:info.is_bot};
  });
  if(rows.length)await db('playfeed_analytics_events',{method:'POST',query:'on_conflict=id',body:rows,prefer:'resolution=ignore-duplicates,return=minimal'});
  await db('playfeed_analytics_devices',{method:'PATCH',query:'id=eq.'+id,body:{last_seen:new Date().toISOString()}});
  return sendJson(res,200,{ok:true});
 }catch(e){return sendJson(res,e.status||503,{error:e.status?e.message:'統計暫時無法使用。'});}
};
module.exports.deviceInfo=deviceInfo;
