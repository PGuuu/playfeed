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
  if (fresh) ordered.unshift(fresh);
  try { storage?.setItem(key, JSON.stringify(games.map(game => game.id))); } catch {}
  return ordered;
}
if (typeof module !== 'undefined') module.exports = { orderPlayfeedGames };
