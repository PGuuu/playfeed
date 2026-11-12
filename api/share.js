const fs = require('node:fs');
const path = require('node:path');

module.exports = function handler(request, response) {
  const id = String(request.query?.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  const source = fs.readFileSync(path.join(process.cwd(), 'catalog.js'), 'utf8');
  const match = source.match(new RegExp("id:\\s*['\"]" + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "['\"][\\s\\S]{0,260}?title:\\s*['\"]([^'\"]+)['\"]"));
  const title = (match?.[1] || 'PlayFeed').replace(/[<>&\"]/g, value => ({'<':'&lt;','>':'&gt;','&':'&amp;','\"':'&quot;'}[value]));
  const origin = `https://${request.headers.host || 'playfeed-gilt.vercel.app'}`;
  const destination = `${origin}/#${encodeURIComponent(id)}`;
  const cardPath = path.join(process.cwd(), 'share-cards', `${id}.png`);
  const imageName = fs.existsSync(cardPath) ? `${id}.png` : 'default.png';
  const image = `${origin}/share-cards/${encodeURIComponent(imageName)}`;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
  response.send(`<!doctype html><html><head><meta charset="utf-8"><title>${title} · PlayFeed</title><meta property="og:title" content="${title}"><meta property="og:site_name" content="PlayFeed"><meta property="og:type" content="website"><meta property="og:url" content="${destination}"><meta property="og:image" content="${image}"><meta name="twitter:card" content="summary_large_image"><meta http-equiv="refresh" content="0;url=${destination}"></head><body><a href="${destination}">前往 ${title}</a></body></html>`);
};
