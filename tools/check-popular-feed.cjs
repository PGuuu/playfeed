const assert = require('node:assert/strict');
const { rankPopularGames } = require('../api/_popular-games');
const { orderPlayfeedGames, loadPlayfeedPopularIds } = require('../feed-order');
const storage = () => { const values = new Map(); return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }; };

(async () => {
  const sample = (id, extra = {}) => ({ game_id: id, views: 20, visitors: 15, duration_ms: 20 * 30000, saves: 0, shares: 0, ...extra });
  assert.equal(rankPopularGames([sample('base'), sample('engaged', { duration_ms: 20 * 90000, saves: 2, shares: 1 })])[0].id, 'engaged');
  assert.deepEqual(rankPopularGames([sample('one-idle-tab', { views: 100, visitors: 1, duration_ms: 99999999 })]), []);
  assert.equal(rankPopularGames([sample('a', { duration_ms: 99999999 })])[0].score, rankPopularGames([sample('a', { duration_ms: 20 * 180000 })])[0].score);
  const games = ['cold', 'best', 'second', 'third', 'fourth', 'new'].map(id => ({ id, published_at: id === 'new' ? '2026-11-13T00:00:00Z' : null }));
  const opts = { now: Date.parse('2026-11-13T01:00:00Z'), storage: storage(), random: () => 0.5, popularIds: ['removed', 'best', 'second', 'third', 'fourth'] };
  const ordered = orderPlayfeedGames(games, opts);
  assert.deepEqual(ordered.slice(0, 5).map(g => g.id), ['best', 'second', 'third', 'fourth', 'new']);
  const linked = orderPlayfeedGames(games, { ...opts, requestedId: 'cold' });
  assert.deepEqual(linked.slice(0, 3).map(g => g.id), ['cold', 'best', 'second']);
  assert.equal(new Set(linked.map(g => g.id)).size, games.length);
  assert.deepEqual(games.map(g => g.id), ['cold', 'best', 'second', 'third', 'fourth', 'new']);
  const cache = storage(); let requests = 0;
  const fetch = async () => { requests++; return { ok: true, json: async () => ({ ids: ['best'] }) }; };
  assert.deepEqual(await loadPlayfeedPopularIds({ storage: cache, fetch, now: 1000 }), ['best']);
  assert.deepEqual(await loadPlayfeedPopularIds({ storage: cache, fetch, now: 2000 }), ['best']);
  assert.equal(requests, 1);
  assert.deepEqual(await loadPlayfeedPopularIds({ storage: cache, fetch, now: 301001 }), ['best']);
  assert.equal(requests, 2);
  assert.deepEqual(await loadPlayfeedPopularIds({ storage: null, fetch: async () => { throw Error('offline'); } }), []);
  assert.deepEqual(await loadPlayfeedPopularIds({ storage: null, fetch: () => new Promise(() => {}), timeoutMs: 10 }), []);
  assert.deepEqual(await loadPlayfeedPopularIds({ storage: null, fetch: async () => ({ ok: true, json: async () => ({ ids: [null] }) }) }), []);
  console.log('PASS: engagement ranking, small-sample protection, dwell cap, discovery slot, pinned link followed by best games, no duplicates, cache expiry and timeout/offline fallback');

  const lib = require('../api/_lib');
  lib.supabaseRest = async (table, options) => {
    assert.equal(table, 'rpc/playfeed_analytics_report');
    assert.deepEqual(options.body, { p_days: 7, p_audience: 'external' });
    return { ok: true, data: { games: [sample('best')], devices: ['private'], summary: { visitors: 100 } } };
  };
  const handler = require('../api/popular-games');
  const response = () => ({ headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(s) { this.code = s; return this; }, send(body) { this.body = body; }, end() {} });
  const res = response(); await handler({ method: 'GET' }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(JSON.parse(res.body), { ids: ['best'] });
  assert.match(res.headers['Cache-Control'], /s-maxage=300/);
  const rejected = response(); await handler({ method: 'POST' }, rejected); assert.equal(rejected.code, 405);
  console.log('PASS: public endpoint exposes only IDs, excludes owner audience and caches rankings');
})().catch(error => { console.error(error); process.exitCode = 1; });
