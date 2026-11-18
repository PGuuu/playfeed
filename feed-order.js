
function playfeedExposureKey(options = {}) {
  return 'playfeed:game-exposure:v1:' + (options.playerId ? 'member:' + encodeURIComponent(options.playerId) : 'guest');
}
function readPlayfeedExposure(storage, options = {}) {
  try {
    const value=JSON.parse(storage?.getItem(playfeedExposureKey(options)) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
function recordPlayfeedGameExposure(id, options = {}) {
  if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,200}$/.test(id))return;
  let storage=options.storage;
  if(storage===undefined){try{storage=globalThis.localStorage}catch{return}}
  const history=readPlayfeedExposure(storage,options),previous=history[id];
  history[id]={views:Math.min(10000,Math.max(0,Number(previous?.views)||0)+1),lastSeen:options.now ?? Date.now()};
  const entries=Object.entries(history).sort((a,b)=>(Number(b[1]?.lastSeen)||0)-(Number(a[1]?.lastSeen)||0)).slice(0,1000);
  try{storage?.setItem(playfeedExposureKey(options),JSON.stringify(Object.fromEntries(entries)))}catch{}
}

function orderPlayfeedGames(games, options = {}) {
  const now = options.now ?? Date.now();
  const random = options.random || Math.random;
  let storage = options.storage;
  if (storage === undefined) { try { storage = globalThis.localStorage; } catch { storage = null; } }
  const key = 'playfeed:known-games:v1';
  const exposure=readPlayfeedExposure(storage,options);
  const discovery=options.discovery;
  const observed=new Set(discovery?.observedIds||[]),lowExposure=new Set(discovery?.lowExposureIds||[]);
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
  // Weighted random sampling without replacement: each visitor keeps variety.
  const ordered = games.filter(game => game !== fresh).map((game,index)=>{
    const personal=exposure[game.id],views=Math.max(0,Number(personal?.views)||0);
    const age=now-(Number(personal?.lastSeen)||0);
    let weight=1;
    if(discovery?.available){
      if(!observed.has(game.id))weight*=3.5;
      else if(lowExposure.has(game.id))weight*=2.5;
    }
    weight/=1+views*.65;
    if(personal&&age>=0&&age<86400000)weight*=.3;
    else if(personal&&age>=0&&age<7*86400000)weight*=.65;
    if(game.id==='light-switch')weight*=4;
    const draw=Math.max(1e-9,Math.min(1-1e-9,random()));
    return {game,index,rank:-Math.log(draw)/weight};
  }).sort((a,b)=>a.rank-b.rank||a.index-b.index).map(item=>item.game);
  // Shuffle every visit and move the previous opening batch back for freshness.
  let previous=[];
  try{previous=JSON.parse(storage?.getItem('playfeed:last-opening:v1')||'[]');if(!Array.isArray(previous))previous=[]}catch{}
  if(ordered.length>previous.length+3){
    const recent=new Set(previous),tail=ordered.filter(game=>recent.has(game.id));
    const unseen=ordered.filter(game=>!recent.has(game.id));
    ordered.splice(0,ordered.length,...unseen,...tail);
  }
  if (fresh) ordered.splice(Math.min(4, ordered.length), 0, fresh);
  // Introduce the updated spotlight early, then relax it once this player saw it.
  const spotlight=ordered.findIndex(game=>game.id==='light-switch');
  const lastSpotlight=Number(exposure['light-switch']?.lastSeen)||0;
  if(spotlight>=0&&(!lastSpotlight||now-lastSpotlight>=86400000)){
    const [game]=ordered.splice(spotlight,1);
    ordered.splice(Math.min(1+Math.floor(Math.max(0,Math.min(.999999,random()))*4),ordered.length),0,game);
  }
  const requestedIndex = ordered.findIndex(game => game.id === options.requestedId);
  if (requestedIndex > 0) ordered.unshift(...ordered.splice(requestedIndex, 1));
  try{storage?.setItem('playfeed:last-opening:v1',JSON.stringify(ordered.slice(0,4).map(game=>game.id)))}catch{}
  try { storage?.setItem(key, JSON.stringify(games.map(game => game.id))); } catch {}
  return ordered;
}


function createPlayfeedFeaturedVisit(games, options = {}) {
  const featuredId = 'light-switch';
  const now = options.now || Date.now;
  const inCampaign = () => now() >= Date.parse('2026-11-15T00:00:00+08:00') && now() < Date.parse('2026-11-16T00:00:00+08:00');
  const directGame = games.some(game => game.id === options.entryId);
  let pending = !options.savedMode && !directGame && !String(options.entryId || '').startsWith('creator-') && inCampaign() && games.some(game => game.id === featuredId);
  return {
    shown(gameId, source) {
      if (gameId === featuredId || ['search_selection', 'creator_selection', 'saved_selection'].includes(source)) pending = false;
    },
    take(currentId, availableIds) {
      if (!pending) return null;
      pending = false;
      if (!inCampaign() || currentId === featuredId || !availableIds.includes(featuredId)) return null;
      return featuredId;
    }
  };
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

async function loadPlayfeedDiscoveryPriorities(options = {}) {
  const request=options.fetch||globalThis.fetch,now=options.now??Date.now();
  let storage=options.storage;
  if(storage===undefined){try{storage=globalThis.sessionStorage}catch{storage=null}}
  const key='playfeed:discovery-priorities:v1';
  const validIds=value=>Array.isArray(value)&&value.length<=3000&&value.every(id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,200}$/.test(id));
  const valid=value=>value&&validIds(value.observedIds)&&validIds(value.lowExposureIds);
  try{const cached=JSON.parse(storage?.getItem(key)||'null');if(cached&&now-cached.time>=0&&now-cached.time<300000&&valid(cached.data))return {...cached.data,available:true}}catch{}
  const controller=new AbortController();let timer;
  try{
    const data=await Promise.race([
      Promise.resolve().then(async()=>{const r=await request('/api/popular-games',{signal:controller.signal});if(!r.ok)throw Error('Discovery unavailable');return r.json()}),
      new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Discovery timeout'))},options.timeoutMs??750)})
    ]);
    if(!valid(data))return {available:false,observedIds:[],lowExposureIds:[]};
    const result={observedIds:data.observedIds,lowExposureIds:data.lowExposureIds};
    try{storage?.setItem(key,JSON.stringify({time:now,data:result}))}catch{}
    return {...result,available:true};
  }catch{return {available:false,observedIds:[],lowExposureIds:[]}}
  finally{clearTimeout(timer)}
}

if (typeof module !== 'undefined') module.exports = { orderPlayfeedGames, loadPlayfeedPopularIds, createPlayfeedFeaturedVisit, recordPlayfeedGameExposure, loadPlayfeedDiscoveryPriorities };
