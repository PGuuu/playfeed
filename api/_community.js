const { publicName, safeText, supabaseRest } = require('./_lib');
const eq = value => encodeURIComponent(String(value));
async function db(table, options) {
 const result = await supabaseRest(table, options);
 if (!result.ok) throw Object.assign(new Error(result.error), { status: result.status === 409 ? 409 : 503 });
 return result.data || [];
}
async function isAdmin(user) {
 const rows = await db('playfeed_admins', { query: 'select=email&email=eq.' + eq(user.email.toLowerCase()) });
 return rows.length > 0;
}
async function profileFor(user) {
 const rows = await db('playfeed_profiles', { query: 'select=display_name,bio,website&user_id=eq.' + eq(user.id) });
 return rows[0] || { display_name: publicName(user), bio: '', website: '' };
}
function validUrl(value) {
 let url;
 try { url = new URL(safeText(value, { max: 1000 })); } catch { throw Object.assign(new Error('請提供有效的 HTTPS 網址。'), { status: 400 }); }
 if (url.protocol !== 'https:' || url.username || url.password || url.port || !/^([a-z0-9-]+\.)+[a-z][a-z0-9-]+$/i.test(url.hostname)) throw Object.assign(new Error('請提供有效的 HTTPS 網址。'), { status: 400 });
 url.hash = '';
 return url;
}
async function get(user, action) {
 if (action === 'me') return { user: { email: user.email, name: publicName(user) }, profile: await profileFor(user), isAdmin: await isAdmin(user) };
 if (action === 'review') {
  if (!await isAdmin(user)) throw Object.assign(new Error('僅管理者可以審核。'), { status: 403 });
  return { requests: await db('playfeed_requests', { query: 'select=*&status=eq.pending&order=created_at.asc' }) };
 }
 if (action === 'collection') {
  const [profile, admin, actions, requests, notifications, recommendations] = await Promise.all([
   profileFor(user), isAdmin(user),
   db('playfeed_user_actions', { query: 'select=game_key,kind,created_at&user_id=eq.' + eq(user.id) + '&order=created_at.desc' }),
   db('playfeed_requests', { query: 'select=*&user_id=eq.' + eq(user.id) + '&order=created_at.desc' }),
   db('playfeed_notifications', { query: 'select=*&user_id=eq.' + eq(user.id) + '&order=created_at.desc&limit=100' }),
   db('playfeed_recommendations', { query: 'select=id,title,url,author,creator_url,created_at&submitted_by=eq.' + eq(user.id) + '&order=created_at.desc' })
  ]);
  const ids = requests.filter(r=>r.status==='approved'&&r.published_game_id).map(r=>r.published_game_id);
  if (ids.length) {
   const linked = await db('playfeed_recommendations', { query: 'select=id,title,url,author,creator_url,created_at&id=in.(' + ids.join(',') + ')' });
   for (const row of linked) if (!recommendations.some(r=>r.id===row.id)) recommendations.push(row);
  }
  return { user: { id: user.id, email: user.email }, profile, isAdmin: admin, actions, requests, notifications, recommendations };
 }
}
async function post(user, body) {
 if(body.action==='delete-game'){
  if(String(user.email||'').toLowerCase()!=='paulvongulla@gmail.com'||!await isAdmin(user))throw Object.assign(new Error('只有管理員可以刪除遊戲。'),{status:403});
  const id=safeText(body.gameId,{name:'gameId',max:200,pattern:/^[a-zA-Z0-9_-]+$/});
  const {loadPlayfeedGames}=require('../catalog');
  const games=await loadPlayfeedGames(async resource=>{const offset=resource.indexOf('?');return db(resource.slice(1,offset),{query:resource.slice(offset+1)})},'https://playfeed-gilt.vercel.app/');
  const game=games.find(game=>game.id===id);
  if(!game)throw Object.assign(new Error('這款遊戲已刪除或不存在。'),{status:404});
  const url=new URL(game.url,'https://playfeed-gilt.vercel.app/').href;
  await db('playfeed_removed_games',{method:'POST',query:'on_conflict=game_url',body:{game_url:url,removed_by:user.id},prefer:'resolution=ignore-duplicates,return=minimal'});
  // Reporting history remains available; the removal itself is already authoritative.
  try{await db('playfeed_game_reports',{method:'PATCH',query:'game_url=eq.'+eq(url)+'&status=eq.pending',body:{status:'resolved'}})}catch(error){console.warn('Could not resolve reports after game removal')}
  return {ok:true,id:game.id};
 }

 if (body.action === 'profile') {
  const display_name = safeText(body.displayName, { name: '名稱', max: 40 });
  const bio = safeText(body.bio || '', { name: '自介', min: 0, max: 300 });
  let website = safeText(body.website || '', { name: '網址', min: 0, max: 500 });
  if (website) {
   let url; try { url = new URL(website); } catch {}
   if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Object.assign(new Error('網址必須以 https:// 或 http:// 開頭。'), { status: 400 });
   website = url.href;
  }
  const profile = { user_id: user.id, display_name, bio, website, updated_at: new Date().toISOString() };
  await db('playfeed_profiles', { method: 'POST', query: 'on_conflict=user_id', body: profile, prefer: 'resolution=merge-duplicates,return=minimal' });
  return { profile };
 }
 if (body.action === 'read-notifications') {
  await db('playfeed_notifications', { method: 'PATCH', query: 'user_id=eq.' + eq(user.id) + '&read_at=is.null', body: { read_at: new Date().toISOString() } });
  return { ok: true };
 }
 if (body.action === 'recommend' || body.action === 'publish') {
  const url = validUrl(body.url);
  const admin = await isAdmin(user);
  if (admin && body.action === 'recommend') return { status: 'preview', url: url.href };
  if (admin) {
   if (body.interactionConfirmed !== true) throw Object.assign(new Error('請先試玩並確認可以互動。'), { status: 400 });
   await require('./_share-assets').prepareAsset({url:url.href,title:url.hostname,author:(await profileFor(user)).display_name});
   const published = await db('playfeed_recommendations', { method: 'POST', body: { url: url.href, title: url.hostname, submitted_by: user.id, author: (await profileFor(user)).display_name }, prefer: 'resolution=ignore-duplicates,return=representation' });
   const row = published[0] || (await db('playfeed_recommendations', { query: 'select=id&url=eq.' + eq(url.href) }))[0];
   return { id: row.id, status: 'published' };
  }
  await db('playfeed_requests', { method: 'POST', body: { user_id: user.id, url: url.href }, prefer: 'resolution=ignore-duplicates,return=minimal' });
  return { status: 'pending', message: '謝謝你的推薦！已送交管理者審核，上架後會通知你。' };
 }
 if (body.action === 'review') {
  if (!await isAdmin(user)) throw Object.assign(new Error('僅管理者可以審核。'), { status: 403 });
  const id = safeText(body.requestId, { pattern: /^[0-9a-f-]{36}$/i, max: 36 });
  const request = (await db('playfeed_requests', { query: 'select=*&id=eq.' + id + '&status=eq.pending' }))[0];
  if (!request) throw Object.assign(new Error('這筆推薦已處理或不存在。'), { status: 404 });
  if (body.decision === 'reject') {
   await db('playfeed_requests', { method: 'PATCH', query: 'id=eq.' + id + '&status=eq.pending', body: { status: 'rejected', reviewed_at: new Date().toISOString() } });
   return { ok: true };
  }
  if (body.decision !== 'approve') throw Object.assign(new Error('審核操作無效。'), { status: 400 });
  if (body.interactionConfirmed !== true) throw Object.assign(new Error('請先試玩並確認可以互動。'), { status: 400 });
  const title = safeText(body.title || new URL(request.url).hostname, { max: 300 });
  const existing=(await db('playfeed_recommendations',{query:'select=title,author,url&url=eq.'+eq(request.url)}))[0];
  await require('./_share-assets').prepareAsset({url:request.url,title,author:existing?.author||new URL(request.url).hostname});
  const published = await db('playfeed_recommendations', { method: 'POST', body: { url: request.url, title, submitted_by: request.user_id }, prefer: 'resolution=ignore-duplicates,return=representation' });
  if (!published.length) {
   // Updating an existing listing also triggers matching recommendations and notifications.
   await db('playfeed_recommendations', { method: 'PATCH', query: 'url=eq.' + eq(request.url), body: { title } });
  }
  return { ok: true };
 }
}
module.exports = { get, post, profileFor, isAdmin };

