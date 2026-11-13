const { initialSaveCount } = require('./_save-counts');
const community = require('./_community');
const { publicName, readJson, requestOriginAllowed, safeText, sendJson, supabaseRest, verifyPhuzeSession } = require('./_lib');

function encoded(value) { return encodeURIComponent(String(value)); }
function gameKey(value) { return safeText(value, { name: 'gameKey', min: 3, max: 500 }); }

async function userFromRequest(request, required = true) {
  const auth = await verifyPhuzeSession(request);
  if (auth.user) return auth.user;
  if (!required && auth.error?.status === 401) return null;
  throw Object.assign(new Error(auth.error?.message || '登入已失效。'), { status: auth.error?.status || 401 });
}

async function publicCounts(game, gameId = '', request) {
  const device = request ? require('./_device').deviceId(request, null, false) : null;
  const result = await supabaseRest('rpc/playfeed_engagement_counts', {method:'POST',body:{p_game_key:game,p_game_id:String(gameId).slice(0,200),p_device_id:device}});
  const counts=result.data;
  if(!result.ok||!counts||!['saveCount','commentCount','shareCount'].every(key=>Number.isSafeInteger(counts[key])&&counts[key]>=0))throw Error('Could not load engagement counts.');
  return {...counts,displaySaveCount:counts.saveCount+initialSaveCount(game)};
}

async function stateFor(game, userId, gameId = '', request) {
  const [legacyLikes, accountLikes, saves] = await Promise.all([
    supabaseRest('playfeed_game_likes', { query: `select=game_key&game_key=eq.${encoded(game)}` }),
    supabaseRest('playfeed_user_actions', { query: `select=kind&game_key=eq.${encoded(game)}${userId ? `&user_id=eq.${encoded(userId)}` : ''}` }),
    userId ? supabaseRest('playfeed_user_actions', { query: `select=kind&game_key=eq.${encoded(game)}&user_id=eq.${encoded(userId)}&kind=eq.save` }) : Promise.resolve({ ok: true, data: [] }),
  ]);
  for (const result of [legacyLikes, accountLikes, saves]) if (!result.ok) throw new Error(result.error);
  const allAccountLikes = await supabaseRest('playfeed_user_actions', { query: `select=user_id&game_key=eq.${encoded(game)}&kind=eq.like` });
  if (!allAccountLikes.ok) throw new Error(allAccountLikes.error);
  return {
    count: (legacyLikes.data?.length || 0) + (allAccountLikes.data?.length || 0),
    liked: Boolean(userId && accountLikes.data?.some(row => row.kind === 'like')),
    saved: Boolean(userId && saves.data?.length),
    ...await publicCounts(game, gameId, request),
  };
}

module.exports = async function handler(request, response) {
  if (!requestOriginAllowed(request)) return sendJson(response, 403, { error: '不允許的來源。' });
  try {
    if (request.method === 'GET') {
      const action = String(request.query?.action || 'state');
      if (action === 'ratings') return sendJson(response,200,await require('./_ratings').get(request));
      if (action === 'counts') return sendJson(response, 200, await publicCounts(gameKey(request.query?.gameKey),request.query?.gameId,request));
      if (action === 'state') {
        const user = await userFromRequest(request, false);
        return sendJson(response, 200, await stateFor(gameKey(request.query?.gameKey), user?.id,request.query?.gameId,request));
      }
      if (action === 'comments') {
        const game = gameKey(request.query?.gameKey);
        const rows = await supabaseRest('playfeed_game_comments', { query: `select=id,body,display_name,created_at&game_key=eq.${encoded(game)}&order=created_at.asc,id.asc&limit=100` });
        if (!rows.ok) throw new Error(rows.error);
        return sendJson(response, 200, { comments: rows.data || [], ...await publicCounts(game,request.query?.gameId,request) });
      }
      const user = await userFromRequest(request);
      if (['me', 'collection', 'review'].includes(action)) return sendJson(response, 200, await community.get(user, action));
      throw Object.assign(new Error('未知的操作。'), { status: 400 });
    }

    if (request.method !== 'POST') return sendJson(response, 405, { error: 'Method not allowed.' });
    const body = await readJson(request, 300_000);
    const action = safeText(body.action, { name: 'action', max: 30 });
    if(action==='rate')return sendJson(response,200,await require('./_ratings').post(request,response,body));
    if(action==='guest-save')return sendJson(response,200,await require('./_guest-saves').saveGuest(request,response,body));
    const user = await userFromRequest(request);
    if(action==='merge-saves')return sendJson(response,200,await require('./_guest-saves').mergeGuest(request,response,user,body));

    if (['profile', 'read-notifications', 'recommend', 'publish', 'review', 'delete-game'].includes(action)) return sendJson(response, 200, await community.post(user, body));

    if (action === 'like' || action === 'save') {
      const game = gameKey(body.gameKey);
      const kind = action;
      if (body.active) {
        const write = await supabaseRest('playfeed_user_actions', { method: 'POST', body: { user_id: user.id, game_key: game, kind }, prefer: 'resolution=merge-duplicates,return=minimal' });
        if (!write.ok) throw new Error(write.error);
      } else {
        const write = await supabaseRest('playfeed_user_actions', { method: 'DELETE', query: `user_id=eq.${encoded(user.id)}&game_key=eq.${encoded(game)}&kind=eq.${kind}` });
        if (!write.ok) throw new Error(write.error);
      }
      return sendJson(response, 200, await stateFor(game, user.id,body.gameId,request));
    }

    if (action === 'comment') {
      const row = { id: crypto.randomUUID(), game_key: gameKey(body.gameKey), body: safeText(body.body, { name: '留言', max: 1000 }), display_name: (await community.profileFor(user)).display_name, user_id: user.id };
      const write = await supabaseRest('playfeed_game_comments', { method: 'POST', body: row, prefer: 'return=minimal' });
      if (!write.ok) throw new Error(write.error);
      return sendJson(response, 201, { ok: true, ...await publicCounts(row.game_key,body.gameId,request) });
    }


    throw Object.assign(new Error('未知的操作。'), { status: 400 });
  } catch (error) {
    sendJson(response, error.status || 500, { error: error.status ? error.message : '目前無法完成操作，請稍後再試。' });
  }
};

