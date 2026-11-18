const { publicName, safeText, supabaseRest } = require('./_lib');
const { randomInt, randomUUID } = require('node:crypto');
const adjectives = ('amber aqua autumn azure bold bright brisk bronze calm candy cedar cherry clear clever coral cozy crisp dawn dewy dapper dusky eager early electric emerald fair fancy fern fine fresh frost gentle ginger golden happy hazel honey icy indigo ivory jade jazzy jolly lemon lilac little lively lucky lunar mellow merry mint misty neon nimble ocean olive opal peach pearl pink playful plum polar poppy quiet rapid rosy royal ruby sandy satin silver silky sky sleek snowy soft solar spring starry still sunny swift teal tiny vivid warm wild windy wise witty').split(' ');
const nouns = ('acorn apple apricot atlas badge bamboo beach bean bear bee berry birch bloom boat bubble bunny cactus canyon cap cat cloud comet cookie copper cove crane creek daisy delta dice dove drift echo elm ember falcon fig finch fish flame flower foam forest fox frog galaxy garden gecko gem glow grape grove gull harbor hare hat hawk hill iris island kite lake lark leaf lotus lynx mango maple marble meadow melon moon moss moth mouse nest oak orchid otter owl palm panda paper path pebble petal pine pixel planet pond prawn prism puff quartz rain raven reef river robin rock rose sail seal seed shell shore slate smile snail snow spark spring star stone storm swan tide tiger toast trail tulip twig vale violet wave willow wing wren').split(' ');
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
 const rows = await db('playfeed_profiles', { query: 'select=display_name,bio,website,avatar,public_id,public_slug&user_id=eq.' + eq(user.id) });
 return rows[0] || { display_name: publicName(user), bio: '', website: '' };
}
function validUrl(value) {
 let url;
 try { url = new URL(safeText(value, { max: 1000 })); } catch { throw Object.assign(new Error('請提供有效的 HTTPS 網址。'), { status: 400 }); }
 if (url.protocol !== 'https:' || url.username || url.password || url.port || !/^([a-z0-9-]+\.)+[a-z][a-z0-9-]+$/i.test(url.hostname)) throw Object.assign(new Error('請提供有效的 HTTPS 網址。'), { status: 400 });
 url.hash = '';
 return url;
}
async function addLinkedRecommendations(requests, recommendations) {
  const ids = requests.filter(r=>r.status==='approved'&&r.published_game_id).map(r=>r.published_game_id);
  if (ids.length) {
   const linked = await db('playfeed_recommendations', { query: 'select=id,title,url,author,creator_url,created_at&id=in.(' + ids.join(',') + ')' });
   for (const row of linked) if (!recommendations.some(r=>r.id===row.id)) recommendations.push(row);
  }
}

function publicId(value) {
 return safeText(value, {name:'profile', max:36, pattern:/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i});
}

function profileFilter(value) {
 const slug = String(value ?? '');
 if (/^[a-z]{2,12}-[a-z]{2,12}$/.test(slug)) return 'public_slug=eq.' + slug;
 return 'public_id=eq.' + publicId(value);
}

async function publicProfileName(value) {
 const [row] = await db('playfeed_profiles', {query:'select=display_name&' + profileFilter(value)});
 return row?.display_name;
}

async function publicCollection(viewer, value) {
 const [row] = await db('playfeed_profiles', {query:'select=user_id,public_id,display_name,bio,website,avatar&' + profileFilter(value)});
 if (!row) throw Object.assign(new Error('找不到這個遊戲清單。'), {status:404});
 const {user_id, public_id:id, ...profile} = row;
 const owner = 'user_id=eq.' + eq(user_id);
 const isOwn = viewer?.id === user_id;
 const [actions, recommendations, requests, follows] = await Promise.all([
  db('playfeed_user_actions', {query:'select=game_key,kind&kind=eq.save&' + owner + '&order=created_at.desc'}),
  db('playfeed_recommendations', {query:'select=id,title,url&submitted_by=eq.' + eq(user_id) + '&order=created_at.desc'}),
  db('playfeed_requests', {query:'select=published_game_id,status&status=eq.approved&' + owner}),
  viewer && !isOwn ? db('playfeed_follows', {query:'select=target_id&follower_id=eq.' + eq(viewer.id) + '&target_id=eq.' + id}) : []
 ]);
 await addLinkedRecommendations(requests, recommendations);
 return {profile, actions, recommendations, isOwn, following:follows.length > 0};
}

async function get(user, action) {
 if (action === 'following') {
  const rows = await db('playfeed_follows', {query:'select=profile:playfeed_profiles!inner(public_id,public_slug,display_name,avatar)&follower_id=eq.' + eq(user.id) + '&order=created_at.desc'});
  return {profiles:rows.map(row=>row.profile)};
 }
 if (action === 'me') return { user: { email: user.email, name: publicName(user) }, profile: await profileFor(user), isAdmin: await isAdmin(user) };
 if (action === 'reports') {
  if (!await isAdmin(user)) throw Object.assign(new Error('僅管理員可以查看檢舉。'), { status: 403 });
  const [reports, games] = await Promise.all([
   db('playfeed_game_reports', { query: 'select=id,game_id,game_url,game_title,reason,details,created_at,status&order=created_at.desc&limit=1000' }),
   catalogGames()
  ]);
  const byUrl = new Map(games.map(game => [new URL(game.url, PLAYFEED_BASE).href, game]));
  return { reports: reports.map(report => {
   const game = byUrl.get(report.game_url);
   return { ...report, game_id: game?.id || report.game_id, game_title: game?.title || report.game_title, available: Boolean(game) };
  }) };
 }
 if (action === 'review') {
  require('./_waiting').owner(user);
  if (!await isAdmin(user)) throw Object.assign(new Error('僅管理者可以審核。'), { status: 403 });
  return { requests: await db('playfeed_requests', { query: 'select=*&status=eq.pending&order=created_at.asc' }) };
 }
 if (action === 'collection') {
  const [profile, admin, actions, requests, notifications, recommendations] = await Promise.all([
   profileFor(user), isAdmin(user),
   db('playfeed_user_actions', { query: 'select=game_key,kind,created_at&user_id=eq.' + eq(user.id) + '&order=created_at.desc' }),
   db('playfeed_requests', { query: 'select=*&user_id=eq.' + eq(user.id) + '&order=created_at.desc' }),
   db('playfeed_notifications', { query: 'select=*&user_id=eq.' + eq(user.id) + '&dismissed_at=is.null&order=created_at.desc&limit=100' }),
   db('playfeed_recommendations', { query: 'select=id,title,url,author,creator_url,created_at&submitted_by=eq.' + eq(user.id) + '&order=created_at.desc' })
  ]);
  await addLinkedRecommendations(requests, recommendations);
  return { user: { id: user.id, email: user.email }, profile, isAdmin: admin, actions, requests, notifications, recommendations };
 }
}

const PLAYFEED_BASE = 'https://playfeed-gilt.vercel.app/';
async function catalogGames() {
 const { loadPlayfeedGames } = require('../catalog');
 const games = await loadPlayfeedGames(async resource => {
  const offset = resource.indexOf('?');
  return db(resource.slice(1, offset), { query: resource.slice(offset + 1) });
 }, PLAYFEED_BASE);
 return games;
}
async function listedGame(url) {
 return (await catalogGames()).find(game => new URL(game.url, PLAYFEED_BASE).href === url);
}
function existingResult(game) {
 return { status: 'existing', id: game.id, title: game.title, gamePath: '/g/' + encodeURIComponent(game.slug || game.id), message: '這款遊戲已經上架，點下方按鈕即可在 FanGame 確認。' };
}

async function post(user, body) {
 if(body.action==='game-screenshot'){
  require('./_waiting').owner(user);
  if(!await isAdmin(user))throw Object.assign(Error('只有站長可以更新截圖。'),{status:403});
  const game=(await catalogGames()).find(game=>game.id===body.gameId);
  if(!game)throw Object.assign(Error('這款遊戲已下架或不存在。'),{status:404});
  return require('./_game-preview').savePreview(new URL(game.url,PLAYFEED_BASE).href,body.image,user,body.focus);
 }
 if(body.action==='edit-game'){
  if(String(user.email||'').toLowerCase()!=='paulvongulla@gmail.com'||!await isAdmin(user))throw Object.assign(new Error('只有站長可以修改遊戲資料。'),{status:403});
  const id=safeText(body.gameId,{name:'gameId',max:200,pattern:/^[a-zA-Z0-9_-]+$/});
  const title=safeText(body.title,{name:'遊戲名稱',max:300});
  const author=safeText(body.author,{name:'創作者',max:120});
  const game=(await catalogGames()).find(game=>game.id===id);
  if(!game)throw Object.assign(new Error('這款遊戲已下架或不存在。'),{status:404});
  const result=await supabaseRest('rpc/playfeed_edit_game_metadata',{method:'POST',body:{p_game_url:new URL(game.url,PLAYFEED_BASE).href,p_title:title,p_author:author,p_updated_by:user.id}});
  if(!result.ok||!result.data)throw Object.assign(new Error('修改未儲存，請稍後再試。'),{status:503});
  return {ok:true,game:{id:game.id,...result.data}};
 }
 if (body.action === 'remove-reported-game') {
  if (String(user.email || '').toLowerCase() !== 'paulvongulla@gmail.com' || !await isAdmin(user)) throw Object.assign(new Error('只有管理員可以下架遊戲。'), { status: 403 });
  if (body.reviewConfirmed !== true) throw Object.assign(new Error('請先查看遊戲與檢舉內容，再確認下架。'), { status: 400 });
  const reportId = safeText(body.reportId, { pattern: /^[0-9a-f-]{36}$/i, max: 36 });
  const report = (await db('playfeed_game_reports', { query: 'select=id,game_url,status&id=eq.' + eq(reportId) }))[0];
  if (!report || report.status !== 'pending') throw Object.assign(new Error('這筆檢舉已處理或不存在，請重新整理。'), { status: 409 });
  const game = await listedGame(report.game_url);
  if (!game) throw Object.assign(new Error('這款遊戲已下架或不存在。'), { status: 404 });
  // Resolve the game from the stored report, never a client-supplied game ID or URL.
  return post(user, { action: 'delete-game', gameId: game.id });
 }
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

 if (body.action === 'share-profile') {
  const owner = 'user_id=eq.' + eq(user.id);
  await db('playfeed_profiles', {method:'POST',query:'on_conflict=user_id',body:{user_id:user.id,display_name:'玩家'},prefer:'resolution=ignore-duplicates,return=minimal'});
  await db('playfeed_profiles', {method:'PATCH',query:owner + '&public_id=is.null',body:{public_id:randomUUID()},prefer:'return=minimal'});
  for (let attempt = 0; attempt < 20; attempt++) {
   const [row] = await db('playfeed_profiles', {query:'select=public_id,public_slug&' + owner});
   if (row.public_slug) return {id:row.public_id, slug:row.public_slug};
   const slug = adjectives[randomInt(adjectives.length)] + '-' + nouns[randomInt(nouns.length)];
   try {
    const [saved] = await db('playfeed_profiles', {
     method:'PATCH', query:owner + '&public_slug=is.null&select=public_id,public_slug',
     body:{public_slug:slug}, prefer:'return=representation'
    });
    if (saved) return {id:saved.public_id, slug:saved.public_slug};
   } catch (error) {
    if (error.status !== 409) throw error;
   }
  }
  throw Object.assign(new Error('目前無法建立分享網址，請再試一次。'), {status:503});
 }
 if (body.action === 'follow') {
  if (typeof body.active !== 'boolean') throw Object.assign(new Error('無效的追蹤操作。'), {status:400});
  const [target] = await db('playfeed_profiles', {query:'select=user_id,public_id&' + profileFilter(body.profile)});
  if (!target) throw Object.assign(new Error('找不到這個遊戲清單。'), {status:404});
  const id = target.public_id;
  if (target.user_id === user.id) throw Object.assign(new Error('無法追蹤自己。'), {status:400});
  if (body.active) {
   await db('playfeed_follows', {method:'POST',query:'on_conflict=follower_id,target_id',body:{follower_id:user.id,target_id:id},prefer:'resolution=ignore-duplicates,return=minimal'});
  } else {
   await db('playfeed_follows', {method:'DELETE',query:'follower_id=eq.' + eq(user.id) + '&target_id=eq.' + id});
  }
  return {following:body.active};
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
  if (body.avatar !== undefined) {
   const value = body.avatar;
   if (value !== null && (typeof value !== 'string' || value.length > 140000 ||
    !/^data:image\/jpeg;base64,\/9j\/[a-z0-9+/]+={0,2}$/i.test(value))) {
    throw Object.assign(new Error('頭貼必須是有效的 JPEG 圖片。'), {status:400});
   }
   profile.avatar = value;
  }
  await db('playfeed_profiles', { method: 'POST', query: 'on_conflict=user_id', body: profile, prefer: 'resolution=merge-duplicates,return=minimal' });
  return { profile };
 }
 if (body.action === 'dismiss-notification') {
  const id = publicId(body.id);
  await db('playfeed_notifications', {method:'PATCH', query:'id=eq.' + id + '&user_id=eq.' + eq(user.id) + '&dismissed_at=is.null', body:{dismissed_at:new Date().toISOString()}});
  return {ok:true};
 }
 if (body.action === 'read-notifications') {
  await db('playfeed_notifications', { method: 'PATCH', query: 'user_id=eq.' + eq(user.id) + '&read_at=is.null', body: { read_at: new Date().toISOString() } });
  return { ok: true };
 }
 if (body.action === 'recommend' || body.action === 'publish') {
  const url = validUrl(body.url);
  const existing = await listedGame(url.href);
  if (existing) return existingResult(existing);
  const admin = await isAdmin(user);
  if (admin && body.action === 'recommend') return { status: 'preview', url: url.href };
  if (admin) {
   if (body.interactionConfirmed !== true) throw Object.assign(new Error('請先試玩並確認可以互動。'), { status: 400 });
   const metadata = await require('./_source-metadata').sourceMetadata(url.href);
   const preload_image_url=await require('./_game-preload').preparePreload({url:url.href,...metadata});
   if(body.screenshot){require('./_waiting').owner(user);await require('./_game-preview').savePreview(url.href,body.screenshot,user,body.screenshotFocus);}
   const published = await db('playfeed_recommendations', { method: 'POST', query: 'on_conflict=url', body: { url: url.href, ...metadata, submitted_by: user.id,preload_image_url }, prefer: 'resolution=ignore-duplicates,return=representation' });
   const row = published[0] || (await db('playfeed_recommendations', { query: 'select=id&url=eq.' + eq(url.href) }))[0];
   if (!row) throw Object.assign(new Error('遊戲上架結果暫時無法確認，請稍後重試。'), { status: 503 });
   if (!published.length) return existingResult((await listedGame(url.href)) || row);
   return { id: row.id, status: 'published' };
  }
  await db('playfeed_requests', { method: 'POST', query: 'on_conflict=user_id,url', body: { user_id: user.id, url: url.href }, prefer: 'resolution=ignore-duplicates,return=minimal' });
  const publishedMeanwhile = await listedGame(url.href);
  if (publishedMeanwhile) return existingResult(publishedMeanwhile);
  return { status: 'pending', message: '謝謝你的推薦！已送交管理者審核，上架後會通知你。' };
 }
 if (body.action === 'review') {
  require('./_waiting').owner(user);
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
  const metadata = await require('./_source-metadata').sourceMetadata(request.url);
  const title = safeText(body.title || metadata.title, { max: 300 });
  const preload_image_url=await require('./_game-preload').preparePreload({url:request.url,title,author:metadata.author,creator_url:metadata.creator_url});
  if(body.screenshot)await require('./_game-preview').savePreview(request.url,body.screenshot,user,body.screenshotFocus);
  const published = await db('playfeed_recommendations', { method: 'POST', query: 'on_conflict=url', body: { url: request.url, ...metadata, title, submitted_by: request.user_id,preload_image_url }, prefer: 'resolution=ignore-duplicates,return=representation' });
  if (!published.length) {
   // Updating an existing listing also triggers matching recommendations and notifications.
   await db('playfeed_recommendations', { method: 'PATCH', query: 'url=eq.' + eq(request.url), body: { ...metadata, title } });
  }
  if (!published.length) {
   const existing = await listedGame(request.url);
   if (existing) return existingResult(existing);
  }
  return { ok: true };
 }
}
module.exports = { get, post, profileFor, publicCollection, publicProfileName, isAdmin };


