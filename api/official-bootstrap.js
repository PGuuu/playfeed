const crypto = require('crypto');
const { readJson, sendJson, supabaseRest } = require('./_lib');
const { validatePublishedScript } = require('./_validate');

const EXPECTED_TOKEN_HASH = '1a424458a030d152225f353dc272bd630b6aa2f00d31f739fd6fea47dbdd0164';

function tokenAllowed(request) {
  const received = String(request.headers['x-playfeed-bootstrap'] || '');
  const actual = crypto.createHash('sha256').update(received).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(EXPECTED_TOKEN_HASH));
}

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }
  if (!tokenAllowed(request)) return sendJson(response, 404, { error: 'Not found.' });

  try {
    const body = await readJson(request, 180_000);
    const script = String(body.script || '');
    const errors = await validatePublishedScript(script);
    if (errors.length) return sendJson(response, 400, { error: errors.join(' ') });

    const ownerResult = await supabaseRest('user_games', {
      query: 'select=author_id,author_name&order=created_at.asc&limit=1',
    });
    if (!ownerResult.ok) throw Object.assign(new Error(ownerResult.error), { status: ownerResult.status });
    const owner = Array.isArray(ownerResult.data) ? ownerResult.data[0] : null;
    if (!owner?.author_id) throw Object.assign(new Error('Official owner not found.'), { status: 409 });

    const row = {
      slug: 'book-of-answers',
      suggested_id: 'book-of-answers',
      api_version: 1,
      game_version: 'official-1.0.0',
      title: '解答之書',
      description: '先在心裡想一個問題，按住書本，再放開得到一句回答。',
      tip: '按住書本思考，放開揭曉答案',
      bg: '#151936',
      tags: ['official', 'oracle', 'reflection'],
      controls: ['hold'],
      duration: 45,
      score: { label: '答案', order: 'higher', decimals: 0 },
      remix_slots: [{
        key: 'book',
        label: '解答之書',
        hint: '畫面中央會發光的書本封面',
        default: '深藍星空書本',
        shape: 'wide',
      }],
      script,
      screenshot: null,
      author_id: owner.author_id,
      author_name: owner.author_name || '我',
      status: 'published',
      created_at: '2026-07-28T12:00:00.000Z',
      updated_at: new Date().toISOString(),
    };
    const result = await supabaseRest('user_games', {
      method: 'POST',
      query: 'on_conflict=slug',
      body: row,
      prefer: 'resolution=merge-duplicates,return=representation',
    });
    if (!result.ok) throw Object.assign(new Error(result.error), { status: result.status });
    return sendJson(response, 200, { ok: true, game: result.data?.[0] || result.data });
  } catch (error) {
    return sendJson(response, Number(error.status) || 500, {
      error: Number(error.status) && Number(error.status) < 500
        ? error.message
        : 'Bootstrap failed.',
    });
  }
};
