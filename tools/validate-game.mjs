#!/usr/bin/env node
/* PlayFeed 投稿遊戲靜態檢查器
   用法：node tools/validate-game.mjs 你的遊戲.js
   對照「投稿規範.md」做第一道自動篩檢——副檔名、大小、必要結構、以及禁用 API。
   這只是「pre-screen（預篩）」，不是安全邊界。真正的安全靠沙盒執行（見投稿規範 §7）。
   通過這支不代表程式安全，只代表沒踩到明顯的規則地雷。 */

import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';

const MAX_BYTES = 200 * 1024;

const path = process.argv[2];
if (!path) { console.error('用法：node tools/validate-game.mjs <遊戲.js>'); process.exit(2); }

const fails = [], warns = [];
const fail = m => fails.push(m);
const warn = m => warns.push(m);

/* ---- 檔案層級 ---- */
if (!path.toLowerCase().endsWith('.js')) fail('副檔名必須是 .js');
let raw = '';
try {
  const bytes = statSync(path).size;
  if (bytes > MAX_BYTES) fail(`檔案太大：${(bytes/1024).toFixed(1)} KB（上限 200 KB）`);
  raw = readFileSync(path, 'utf8');
} catch (e) { console.error('讀不到檔案：' + e.message); process.exit(2); }

if (raw.indexOf(String.fromCharCode(0)) !== -1) fail('檔案含有 null 位元組，可能不是純文字');

/* ---- 去掉註解與字串內容，降低誤判（只掃真正的程式碼識別字） ---- */
function strip(src) {
  let out = '', i = 0; const n = src.length;
  while (i < n) {
    const c = src[i], c2 = src[i + 1];
    if (c === '/' && c2 === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && c2 === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < n && src[i] !== q) { if (src[i] === '\\') i++; i++; }
      i++; out += '""'; continue;
    }
    out += c; i++;
  }
  return out;
}
const code = strip(raw);

/* ---- 必要結構 ---- */
if (!/window\.GAMES\s*=\s*\(\s*window\.GAMES\s*\|\|\s*\[\]\s*\)\.concat\s*\(/.test(code))
  fail('缺少註冊：必須用 window.GAMES = (window.GAMES || []).concat([ { … } ])');

for (const field of ['id', 'title', 'author', 'tip', 'bg'])
  if (!new RegExp('\\b' + field + '\\s*:').test(code)) fail(`遊戲物件缺少欄位：${field}`);

if (!/\bcreate\s*(\(|:)/.test(code)) fail('遊戲物件缺少 create(env) 方法');
for (const m of ['start', 'stop', 'input'])
  if (!new RegExp('\\b' + m + '\\s*(\\(|:)').test(code)) fail(`create(env) 回傳的物件缺少 ${m}()`);

if (!/\bover\s*\(/.test(code)) fail('程式從未呼叫 over(score)——遊戲會無法結束');
if (!/\bsetScore\s*\(/.test(code)) warn('沒看到 setScore(n)——確認你有在更新分數');
if (/requestAnimationFrame\s*\(/.test(code) && !/cancelAnimationFrame\s*\(/.test(code))
  fail('用了 requestAnimationFrame 卻沒有 cancelAnimationFrame——stop() 要能停乾淨');

/* ---- 禁用 API（違反規範 §1.3） ---- */
const FORBIDDEN = [
  [/\bfetch\s*\(/, '禁止連網：fetch()'],
  [/\bXMLHttpRequest\b/, '禁止連網：XMLHttpRequest'],
  [/\bWebSocket\b/, '禁止連網：WebSocket'],
  [/\bEventSource\b/, '禁止連網：EventSource'],
  [/\bsendBeacon\b/, '禁止連網：navigator.sendBeacon'],
  [/\bimport\s*\(/, '禁止動態載入：import()'],
  [/^\s*import\s+/m, '禁止 ES import'],
  [/\brequire\s*\(/, '禁止 require()'],
  [/\blocalStorage\b/, '禁止儲存：localStorage'],
  [/\bsessionStorage\b/, '禁止儲存：sessionStorage'],
  [/\bindexedDB\b/, '禁止儲存：indexedDB'],
  [/\bdocument\b/, '禁止碰 DOM：document'],
  [/\blocation\b/, '禁止：location'],
  [/\beval\s*\(/, '禁止動態程式碼：eval()'],
  [/\bnew\s+Function\b/, '禁止動態程式碼：new Function()'],
  [/\baddEventListener\s*\(/, '禁止自行監聽事件：addEventListener（輸入只從 input() 來）'],
  [/\bgetUserMedia\b/, '禁止取用裝置：getUserMedia（相機/麥克風）'],
  [/\bgeolocation\b/, '禁止取用裝置：geolocation'],
  [/\bclipboard\b/, '禁止取用：clipboard'],
  [/touch-action/, '禁止更動 touch-action（feed 捲動由平台控制）'],
  [/\bpreventDefault\s*\(/, '禁止 preventDefault（可能干擾 feed 手勢）'],
  [/\bscroll(To|By|IntoView)\s*\(/, '禁止操作捲動'],
];
for (const [re, msg] of FORBIDDEN) if (re.test(code)) fail(msg);

/* navigator.* 一律禁止 */
if (/\bnavigator\b/.test(code)) fail('禁止碰 navigator.*（裝置/網路能力）');

/* window.* 只允許 window.GAMES */
const winRefs = code.match(/\bwindow\s*\.\s*[A-Za-z_$][\w$]*/g) || [];
for (const w of winRefs) if (!/window\s*\.\s*GAMES\b/.test(w)) fail(`禁止存取 ${w.replace(/\s+/g, '')}（除了 window.GAMES）`);

/* 外部資源 */
if (/\bnew\s+Audio\b/.test(code)) fail('禁止載入外部音檔：new Audio（聲音只能用 env.beep）');
if (/\bnew\s+Image\b/.test(code)) warn('偵測到 new Image——不可從網址載圖；換圖請用 env.getSprite/env.sprite');
if (/https?:\/\//.test(raw)) warn('內容含有網址——確認不是要載入外部資源');

/* ---- 報告 ---- */
const name = basename(path);
console.log('\nPlayFeed 投稿檢查：' + name + '\n' + '='.repeat(40));
if (warns.length) { console.log('\n[提醒] 不一定要改，但請確認：'); for (const w of warns) console.log('  - ' + w); }
if (fails.length) {
  console.log('\n[未通過] ' + fails.length + ' 項必須修正：');
  for (const f of fails) console.log('  - ' + f);
  console.log('\n退件。修正後再跑一次。\n');
  process.exit(1);
}
console.log('\n[通過] 靜態檢查 OK。');
console.log('（提醒：這只是預篩，正式上架仍須沙盒執行＋人工審核，見投稿規範 §7）\n');
process.exit(0);
