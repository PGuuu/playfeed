const fs = require('node:fs');
const path = require('node:path');
const { loadPlayfeedGames } = require('../catalog.js');
const origin = 'https://playfeed-gilt.vercel.app';
const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

module.exports = async function handler(request, response) {
  if (!['GET', 'HEAD'].includes(request.method)) return response.status(405).end();
  const id = request.query?.id;
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(id)) return response.status(404).send('Game not found');
  try {
    const games = await loadPlayfeedGames(async resource => {
      const result = await fetch('https://oimdeoszgxfumwtmapok.supabase.co/rest/v1' + resource, {
        headers: { apikey: 'sb_publishable_ZovEIH8JuRiKuf24MTIKLg_sz2Tnui8' },
        signal: AbortSignal.timeout(3000),
      });
      if (!result.ok) throw new Error('Catalog unavailable');
      return result.json();
    }, origin + '/');
    const game = games.find(game => game.id === id);
    if (!game) {
      response.setHeader('Cache-Control', 'no-store');
      return response.status(404).send('Game not found');
    }
    const title = escape(game.title);
    const author = escape(game.creator?.name || game.author || 'Independent creator');
    const link = origin + '/g/' + encodeURIComponent(id);
    const gameUrl = new URL(game.url, origin + '/');
    if (!['https:', 'http:'].includes(gameUrl.protocol)) throw new Error('Invalid game URL');
    // Use the same static screenshot source as the account grid, including new recommendations.
    const image = escape(game.cover || game.screenshot || 'https://image.thum.io/get/noanimate/width/1200/maxAge/168/?url=' + encodeURIComponent(gameUrl.href));
    const description = author + ' — Play on PlayFeed.';
    const metadata = `<meta property="og:type" content="website"><meta property="og:site_name" content="PlayFeed"><meta property="og:locale" content="zh_TW"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${link}"><link rel="canonical" href="${link}"><meta property="og:image" content="${image}"><meta property="og:image:alt" content="${title} preview"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${image}">`;
    // Serve the actual feed here: redirects and hash URLs can lose per-game preview metadata.
    const page = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8')
      .replace(/<meta\b[^>]*(?:property="og:[^"]*"|name="twitter:[^"]*")[^>]*>/g, '')
      .replace(/<link\b[^>]*rel="canonical"[^>]*>/g, '')
      .replace(/<title>[^<]*<\/title>/, () => `<title>${title} | PlayFeed</title>`)
      .replace(/<meta name="description"[^>]*>/, () => `<meta name="description" content="${description}">`)
      .replace('</head>', () => metadata + '</head>');
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return response.send(page);
  } catch {
    response.setHeader('Cache-Control', 'no-store');
    return response.status(503).send('Share page temporarily unavailable');
  }
};

