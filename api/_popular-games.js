// Only real, external audience events enter this score; display/seed counts do not.
function rankPopularGames(games = []) {
  const number = value => Math.max(0, Number(value) || 0);
  const eligible = games.filter(g => typeof g.game_id === 'string' && number(g.visitors) >= 3 && number(g.views) >= 5);
  const maxReach = Math.max(1, ...eligible.map(g => Math.log1p(number(g.visitors))));
  return eligible.map(g => {
    const views = number(g.views), visitors = number(g.visitors);
    // Cap dwell and shrink small samples toward 30 seconds, rather than rewarding one idle tab.
    const dwell = (Math.min(180, number(g.duration_ms) / views / 1000) * visitors + 30 * 10) / (visitors + 10);
    const saves = Math.max(0, number(g.saves) - number(g.unsaves));
    const saveRate = Math.min(1, Math.min(saves, visitors) / (visitors + 10) * 10);
    const shareRate = Math.min(1, Math.min(number(g.shares), visitors) / (visitors + 10) * 10);
    const score = 0.30 * Math.log1p(visitors) / maxReach + 0.45 * dwell / 180 + 0.15 * saveRate + 0.10 * shareRate;
    return { id: g.game_id, score };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

function discoveryPriorities(games = []) {
  const valid=games.filter(game=>typeof game.game_id==='string'&&/^[a-zA-Z0-9_-]{1,200}$/.test(game.game_id));
  const ranked=valid.map(game=>({id:game.game_id,views:Math.max(0,Number(game.views)||0)})).sort((a,b)=>a.views-b.views||a.id.localeCompare(b.id));
  const observedIds=[...new Set(ranked.map(game=>game.id))];
  // The least-exposed third of observed games; games absent from the report have zero recent views.
  const threshold=ranked.length?ranked[Math.max(0,Math.ceil(ranked.length/3)-1)].views:0;
  const lowExposureIds=[...new Set(ranked.filter(game=>game.views<=threshold).map(game=>game.id))];
  return {observedIds,lowExposureIds};
}
module.exports = { rankPopularGames, discoveryPriorities };
