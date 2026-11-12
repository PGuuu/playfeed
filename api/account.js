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

async function stateFor(game, userId) {
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
  };
}

module.exports = async function handler(request, response) {
  if (!requestOriginAllowed(request)) return sendJson(response, 403, { error: '不允許的來源。' });
  try {
    if (request.method === 'GET') {
      const action = String(request.query?.action || 'state');
      if (action === 'state') {
        const user = await userFromRequest(request, false);
        return sendJson(response, 200, await stateFor(gameKey(request.query?.gameKey), user?.id));
      }
      if (action === 'comments') {
        const game = gameKey(request.query?.gameKey);
        const rows = await supabaseRest('playfeed_game_comments', { query: `select=id,body,display_name,created_at&game_key=eq.${encoded(game)}&order=created_at.asc,id.asc&limit=100` });
        if (!rows.ok) throw new Error(rows.error);
        return sendJson(response, 200, { comments: rows.data || [] });
      }
      const user = await userFromRequest(request);
      if (['me', 'collection', 'review'].includes(action)) return sendJson(response, 200, await community.get(user, action));
      throw Object.assign(new Error('未知的操作。'), { status: 400 });
    }

    if (request.method !== 'POST') return sendJson(response, 405, { error: 'Method not allowed.' });
    const user = await userFromRequest(request);
    const body = await readJson(request, 30_000);
    const action = safeText(body.action, { name: 'action', max: 30 });

    if (['profile', 'read-notifications', 'recommend', 'publish', 'review'].includes(action)) return sendJson(response, 200, await community.post(user, body));

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
      return sendJson(response, 200, await stateFor(game, user.id));
    }

    if (action === 'comment') {
      const row = { id: crypto.randomUUID(), game_key: gameKey(body.gameKey), body: safeText(body.body, { name: '留言', max: 1000 }), display_name: (await community.profileFor(user)).display_name, user_id: user.id };
      const write = await supabaseRest('playfeed_game_comments', { method: 'POST', body: row, prefer: 'return=minimal' });
      if (!write.ok) throw new Error(write.error);
      return sendJson(response, 201, { ok: true });
    }


    throw Object.assign(new Error('未知的操作。'), { status: 400 });
  } catch (error) {
    sendJson(response, error.status || 500, { error: error.status ? error.message : '目前無法完成操作，請稍後再試。' });
  }
};
