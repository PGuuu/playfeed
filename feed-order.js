function orderPlayfeedGames(games, options = {}) {
  const now = options.now ?? Date.now();
  const random = options.random || Math.random;
  let storage = options.storage;
  if (storage === undefined) { try { storage = globalThis.localStorage; } catch { storage = null; } }
  const key = 'playfeed:known-games:v1';
  let known = new Set();
  try {
    const saved = JSON.parse(storage?.getItem(key) || '[]');
    if (Array.isArray(saved)) known = new Set(saved.filter(id => typeof id === 'string'));
  } catch {}
  // One newly published game gets a first introduction, never the whole recent batch.
  const fresh = games.filter(game => {
    const published = Date.parse(game.published_at);
    return !known.has(game.id) && Number.isFinite(published) && published <= now && now - published <= 48 * 60 * 60 * 1000;
  }).sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))[0];
  const ordered = games.filter(game => game !== fresh);
  for (let index = ordered.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [ordered[index], ordered[other]] = [ordered[other], ordered[index]];
  }
  const popular = new Map((Array.isArray(options.popularIds) ? options.popularIds : []).map((id, index) => [id, index]));
  if (popular.size) ordered.sort((a, b) => (popular.get(a.id) ?? Infinity) - (popular.get(b.id) ?? Infinity));
  // Good performers lead; retain one discovery slot for a recent, unseen game.
  if (fresh) ordered.splice(popular.size ? Math.min(4, ordered.length) : 0, 0, fresh);
  const requestedIndex = ordered.findIndex(game => game.id === options.requestedId);
  if (requestedIndex > 0) ordered.unshift(...ordered.splice(requestedIndex, 1));
  try { storage?.setItem(key, JSON.stringify(games.map(game => game.id))); } catch {}
  return ordered;
}

async function loadPlayfeedPopularIds(options = {}) {
  const request = options.fetch || globalThis.fetch;
  let storage = options.storage;
  if (storage === undefined) { try { storage = globalThis.sessionStorage; } catch { storage = null; } }
  const key = 'playfeed:popular-games:v1', now = options.now ?? Date.now();
  const valid = ids => Array.isArray(ids) && ids.length <= 1000 && ids.every(id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(id));
  try {
    const cached = JSON.parse(storage?.getItem(key) || 'null');
    if (cached && now - cached.time >= 0 && now - cached.time < 300000 && valid(cached.ids)) return cached.ids;
  } catch {}
  // Ranking is optional; a stalled endpoint must never block the game catalog.
  const controller = new AbortController();
  let timer;
  try {
    const data = await Promise.race([
      Promise.resolve().then(async () => {
        const response = await request('/api/popular-games', { signal: controller.signal });
        if (!response.ok) throw Error('Ranking unavailable');
        return response.json();
      }),
      new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Error('Ranking timeout')); }, options.timeoutMs ?? 1200); }),
    ]);
    if (!valid(data?.ids)) return [];
    try { storage?.setItem(key, JSON.stringify({ time: now, ids: data.ids })); } catch {}
    return data.ids;
  } catch { return []; }
  finally { clearTimeout(timer); }
}
if (typeof module !== 'undefined') module.exports = { orderPlayfeedGames, loadPlayfeedPopularIds };
