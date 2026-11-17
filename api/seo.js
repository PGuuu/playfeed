const { loadPlayfeedGames } = require('../catalog');
const origin = 'https://fangame.app';
const escape = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
module.exports = async (req,res) => {
 if (!['GET','HEAD'].includes(req.method)) return res.status(405).end();
 try {
  const games = await loadPlayfeedGames(async resource => {
   const r = await fetch('https://oimdeoszgxfumwtmapok.supabase.co/rest/v1' + resource, {headers:{apikey:'sb_publishable_ZovEIH8JuRiKuf24MTIKLg_sz2Tnui8'},signal:AbortSignal.timeout(5000)});
   if(!r.ok)throw Error('Catalog unavailable');
   return r.json();
  },origin+'/');
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=300');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.query?.format === 'xml'){
   res.setHeader('Content-Type','application/xml; charset=utf-8');
   const urls=[origin+'/',origin+'/games.html',...games.map(g=>origin+'/g/'+encodeURIComponent(g.id))];
   return res.send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(u=>'<url><loc>'+escape(u)+'</loc></url>').join('')+'</urlset>');
  }
  res.setHeader('Content-Type','text/html; charset=utf-8');
  const list=games.map(g=>'<li><a href="/g/'+encodeURIComponent(g.id)+'">'+escape(g.title)+'</a><p>by '+escape(g.creator?.name||g.author||'獨立創作者')+'</p></li>').join('');
  return res.send('<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>遊戲目錄｜FanGame 糞Game — 免費網頁小遊戲</title><meta name="description" content="探索 FanGame 糞Game 收錄的獨立創作者網頁小遊戲。點開就玩，收藏喜歡的作品，分享給朋友。"><link rel="canonical" href="'+origin+'/games.html"><style>body{margin:0;background:#fff7eb;color:#482515;font:16px system-ui,sans-serif}main{max-width:900px;margin:auto;padding:28px 20px}a{color:inherit}h1{font-size:32px}ul{padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}li{background:#ffead2;border-radius:16px;padding:18px}li a{font-weight:750}p{line-height:1.7}li p{font-size:13px;margin:8px 0 0}</style></head><body><main><a href="/">fangame. 回遊戲牆</a><h1>FanGame 糞Game：遊戲目錄</h1><p>我們是遊戲與創作者的粉絲。這裡收錄大家創作的網頁小遊戲，從荒謬有趣的互動，到益智、反應與模擬遊戲。選一款直接開玩，也能在遊戲牆收藏、分享或推薦作品。</p><ul>'+list+'</ul></main></body></html>');
 }catch{res.setHeader('Cache-Control','no-store');return res.status(503).send('遊戲目錄暫時無法載入，請稍後再試。');}
};
