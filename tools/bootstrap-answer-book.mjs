import fs from 'node:fs';
import { compilePlayFeedLanguage } from '../playfeed-lang.js';

const token = process.env.PLAYFEED_BOOTSTRAP_TOKEN;
if (!token) throw new Error('PLAYFEED_BOOTSTRAP_TOKEN is required.');

const input = fs.readFileSync(new URL('../examples/answer-book.pfl', import.meta.url), 'utf8');
const { source } = compilePlayFeedLanguage(input);
const response = await fetch('https://playfeed-gilt.vercel.app/api/official-bootstrap', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-PlayFeed-Bootstrap': token,
  },
  body: JSON.stringify({ script: source }),
});
const result = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(result.error || `Bootstrap failed (${response.status}).`);
console.log(JSON.stringify({ ok: true, slug: result.game?.slug, title: result.game?.title }));
