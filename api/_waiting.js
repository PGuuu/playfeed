const {supabaseRest,safeText}=require('./_lib');
const OWNER_ID='d28b1149fa6dc857b3086bf77acf5073';
const OWNER_EMAIL='paulvongulla@gmail.com';
const base='https://playfeed-gilt.vercel.app/';
function owner(user){
 if(user?.id!==OWNER_ID||String(user.email||'').toLowerCase()!==OWNER_EMAIL)throw Object.assign(new Error('這個等待區只開放給站長帳號。'),{status:403});
}
async function db(table,options){const r=await supabaseRest(table,options);if(!r.ok)throw Object.assign(new Error('等待區暫時無法讀取或儲存，請稍後再試。'),{status:503});return r.data||[]}
async function rowFor(user,id){
 const requestId=safeText(id,{name:'候選編號',max:36,pattern:/^[0-9a-f-]{36}$/i});
 const row=(await db('playfeed_requests',{query:'select=*&user_id=eq.'+OWNER_ID+'&id=eq.'+requestId}))[0];
 if(!row)throw Object.assign(new Error('找不到這款候選遊戲。'),{status:404});
 return row;
}
async function get(user,request){
 owner(user);
 if(request.query?.action==='waiting-detail'){
  const row=await rowFor(user,request.query.id);
  if(row.status!=='pending')throw Object.assign(new Error('這款遊戲已經處理。'),{status:409});
  const metadata=await require('./_source-metadata').sourceMetadata(row.url);
  return {request:row,metadata};
 }
 const requests=await db('playfeed_requests',{query:'select=id,url,status,created_at&user_id=eq.'+OWNER_ID+'&status=eq.pending&order=created_at.asc,id.asc&limit=100'});
 return {requests};
}
async function post(user,body){
 owner(user);
 const row=await rowFor(user,body.requestId);
 if(row.status==='approved')return {status:'published',id:row.published_game_id};
 if(row.status!=='pending')throw Object.assign(new Error('這款遊戲已經處理，請重新整理。'),{status:409});
 if(body.decision==='reject'){
  await db('playfeed_requests',{method:'PATCH',query:'user_id=eq.'+OWNER_ID+'&id=eq.'+row.id+'&status=eq.pending',body:{status:'rejected',reviewed_at:new Date().toISOString()}});
  return {status:'rejected'};
 }
 if(body.decision!=='publish'||body.interactionConfirmed!==true)throw Object.assign(new Error('請先試玩並勾選確認，再按公開。'),{status:400});
 const removed=await db('playfeed_removed_games',{query:'select=game_url&game_url=eq.'+encodeURIComponent(row.url)});
 if(removed.length)throw Object.assign(new Error('這款遊戲已有下架紀錄，不會重新公開。'),{status:409});
 const {loadPlayfeedGames}=require('../catalog');
 const listed=await loadPlayfeedGames(async resource=>{const p=resource.indexOf('?');return db(resource.slice(1,p),{query:resource.slice(p+1)})},base);
 const existing=listed.find(g=>new URL(g.url,base).href===row.url);
 if(existing){
  await db('playfeed_requests',{method:'PATCH',query:'user_id=eq.'+OWNER_ID+'&id=eq.'+row.id+'&status=eq.pending',body:{status:'approved',reviewed_at:new Date().toISOString(),...(/^[0-9a-f-]{36}$/i.test(existing.id)?{published_game_id:existing.id}:{})}});
  return {status:'existing',id:existing.id};
 }
 const metadata={creator_url:row.url};
 const title=safeText(body.title,{name:'遊戲名稱',max:300});
 const author=safeText(body.author,{name:'創作者',max:120});
 if(body.screenshot)await require('./_game-preview').savePreview(row.url,body.screenshot,user,body.screenshotFocus);
 else await require('./_share-assets').prepareAsset({url:row.url,title,author,creator_url:metadata.creator_url});
 // The existing database trigger approves matching requests in the same transaction.
 const inserted=await db('playfeed_recommendations',{method:'POST',query:'on_conflict=url',body:{url:row.url,title,author,creator_url:metadata.creator_url,submitted_by:user.id},prefer:'resolution=ignore-duplicates,return=representation'});
 const game=inserted[0]||(await db('playfeed_recommendations',{query:'select=id&url=eq.'+encodeURIComponent(row.url)}))[0];
 if(!game)throw Object.assign(new Error('公開結果暫時無法確認，請重新整理。'),{status:503});
 if(!inserted.length)await db('playfeed_requests',{method:'PATCH',query:'user_id=eq.'+OWNER_ID+'&id=eq.'+row.id+'&status=eq.pending',body:{status:'approved',published_game_id:game.id,reviewed_at:new Date().toISOString()}});
 return {status:inserted.length?'published':'existing',id:game.id};
}
module.exports={get,post,owner,OWNER_ID};
