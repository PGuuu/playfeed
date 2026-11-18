const fs = require('node:fs');
const path = require('node:path');
const { loadPlayfeedGames } = require('../catalog.js');
const origin = 'https://fangame.app';
const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

async function memberPage(profile, response) {
  response.setHeader('Cache-Control', 'no-store');
  try {
    const nickname = await require('./_community').publicProfileName(profile);
    if (!nickname) return response.status(404).send('找不到這個遊戲清單。');
    const title = escape(nickname + '的FanGame');
    const description = '看看這位玩家收藏與推薦的遊戲。';
    const url = /^[a-z]+-[a-z]+$/.test(profile) ? origin + '/u/' + profile : origin + '/account.html?profile=' + encodeURIComponent(profile);
    const image = origin + '/share-cards/fangame-platform.png';
    const metadata = [
      ['og:type', 'website'], ['og:site_name', 'FanGame'], ['og:locale', 'zh_TW'],
      ['og:title', title], ['og:description', description], ['og:url', escape(url)],
      ['og:image', image], ['og:image:width', '1200'], ['og:image:height', '630']
    ].map(([property, content]) => `<meta property="${property}" content="${content}">`).join('');
    const page = fs.readFileSync(path.join(process.cwd(), 'account.html'), 'utf8')
      .replace(/<title>[^<]*<\/title>/, () => `<title>${title}</title>${metadata}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${image}">`);
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return response.send(page);
  } catch (error) {
    if (error.status === 400) return response.status(404).send('找不到這個遊戲清單。');
    return response.status(503).send('暫時無法載入遊戲清單。');
  }
}

module.exports = async function handler(request, response) {
  if (!['GET', 'HEAD'].includes(request.method)) return response.status(405).end();
  if (request.query?.profile !== undefined) return memberPage(request.query.profile, response);
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
    const game = games.find(game => game.id === id || game.slug === id);
    if (!game) {
      response.setHeader('Cache-Control', 'no-store');
      return response.status(404).send('Game not found');
    }
    if (id !== game.slug) {
      const search = new URL(request.url || '/', origin).searchParams;
      search.delete('id');
      const suffix = search.toString();
      response.setHeader('Location', origin + '/g/' + encodeURIComponent(game.slug) + (suffix ? '?' + suffix : ''));
      response.setHeader('Cache-Control', 'public, max-age=3600');
      return response.status(308).end();
    }
    const title = escape(game.title);
    const author = escape(game.creator?.name || game.author || 'Independent creator');
    const link = origin + '/g/' + encodeURIComponent(game.slug);
    const gameUrl = new URL(game.url, origin + '/');
    if (!['https:', 'http:'].includes(gameUrl.protocol)) throw new Error('Invalid game URL');
    // Share the owner's landscape crop; loading keeps the complete screenshot.
    const saved = game.share_image || game.preview_image || require('./_share-assets').staticAsset(game);
    const image = escape(saved ? new URL(saved, origin).href : origin + '/api/og?id=' + encodeURIComponent(game.id) + '&v=4' + (game.metadata_updated_at ? '&m=' + encodeURIComponent(game.metadata_updated_at) : ''));
    const shareTitle = title + ' by ' + author;
    const description = shareTitle + ' — Play on FanGame.';
    const metadata = `<meta property="og:type" content="website"><meta property="og:site_name" content="FanGame"><meta property="og:locale" content="zh_TW"><meta property="og:title" content="${shareTitle}"><meta property="og:description" content="${description}"><meta property="og:url" content="${link}"><link rel="canonical" href="${link}"><meta property="og:image" content="${image}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="${game.share_image ? 1200 : game.preview_width || 720}"><meta property="og:image:height" content="${game.share_image ? 630 : game.preview_height || 1280}"><meta property="og:image:alt" content="${shareTitle}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${shareTitle}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${image}">`;
    // Serve the actual feed here: redirects and hash URLs can lose per-game preview metadata.
    const page = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8')
      .replace(/<meta\b[^>]*(?:property="og:[^"]*"|name="twitter:[^"]*")[^>]*>/g, '')
      .replace(/<link\b[^>]*rel="canonical"[^>]*>/g, '')
      .replace(/<title>[^<]*<\/title>/, () => `<title>${title} | FanGame</title>`)
      .replace(/<meta name="description"[^>]*>/, () => `<meta name="description" content="${description}">`)
      .replace('</head>', () => metadata + '</head>');
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return response.send(page);
  } catch {
    response.setHeader('Cache-Control', 'no-store');
    return response.status(503).send('Share page temporarily unavailable');
  }
};


