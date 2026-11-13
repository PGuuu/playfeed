const { supabaseRest } = require('./_lib');
const { rankPopularGames } = require('./_popular-games');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  try {
    const result = await supabaseRest('rpc/playfeed_analytics_report', {
      method: 'POST', body: { p_days: 7, p_audience: 'external' },
    });
    if (!result.ok || !Array.isArray(result.data?.games)) throw Error('Popularity report unavailable');
    // Publish only ranking IDs. Never expose visitor, source, device or owner reports.
    const ids = rankPopularGames(result.data.games).map(game => game.id);
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).send(req.method === 'HEAD' ? '' : JSON.stringify({ ids }));
  } catch (error) {
    console.warn('Popularity ranking unavailable:', error.message);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).send(req.method === 'HEAD' ? '' : JSON.stringify({ ids: [] }));
  }
};
