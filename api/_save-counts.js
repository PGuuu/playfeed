const { games } = require('./_initial-saves.json');
const base = 'https://playfeed-gilt.vercel.app/';
const keyFor = value => { try { return new URL(value, base).href; } catch { return String(value); } };
const starters = new Map(games.map(game => [keyFor(game.url), game]));
function initialSaveCount(game) { return starters.get(keyFor(game))?.initialCount || 0; }
async function saveCountSummary() {
 const { supabaseRest } = require('./_lib');
 const rows = new Map([...starters].map(([url,game]) => [url, { url, title:game.title, initialCount:game.initialCount, realCount:0 }]));
 for(const source of ['member','guest'])for(let offset=0;;offset+=1000){
  const result=await supabaseRest(source==='member'?'playfeed_user_actions':'playfeed_guest_saves',{query:source==='member'?'select=game_key&kind=eq.save&order=game_key.asc,user_id.asc&limit=1000&offset='+offset:'select=game_key,playfeed_analytics_devices!inner(is_owner)&countable=eq.true&playfeed_analytics_devices.is_owner=eq.false&order=game_key.asc,device_id.asc&limit=1000&offset='+offset});
  if(!result.ok||!Array.isArray(result.data))throw Error('Could not load real save counts.');
  for(const action of result.data){
   const url=keyFor(action.game_key);
   if(!rows.has(url))rows.set(url,{url,title:url,initialCount:0,realCount:0});
   rows.get(url).realCount++;
  }
  if(result.data.length<1000)break;
 }
 return [...rows.values()].map(row=>({...row,displayCount:row.initialCount+row.realCount})).sort((a,b)=>b.displayCount-a.displayCount||b.realCount-a.realCount||a.url.localeCompare(b.url));
}
module.exports={initialSaveCount,saveCountSummary};
