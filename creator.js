import { parse } from './vendor/acorn.mjs';
import { FULL_SPEC, buildMechanicPrompt, buildRepairPrompt } from './creator-spec.js';
import { findReturnedGameInstance, hasGameInstanceMethod } from './validator-ast.mjs';

const host = window.PlayFeedHost;
if (!host) throw new Error('PlayFeedHost 尚未初始化');

const MAX_SCRIPT_BYTES = 150000;
const FORBIDDEN_IDENTIFIERS = new Set([
  'document', 'navigator', 'location', 'parent', 'top', 'opener', 'frames',
  'globalThis', 'localStorage', 'sessionStorage', 'indexedDB',
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource',
  'Worker', 'SharedWorker', 'ServiceWorker', 'BroadcastChannel',
  'eval', 'Function', 'Audio', 'Image'
]);
const VERTICAL_CONTROLS = /vertical|swipe[-_ ]?(up|down)|pan[-_ ]?y|drag[-_ ]?y|up[-_ ]?down/i;
const publishedRows = [];
const publishedPosts = [];
const LEGACY_BASE_ID = '__playfeed_script_v1__';
const DISLIKE_PREFIX = '__dislike__:';
let backendMode = null;
let draft = null;
let previewRuntime = null;
let draftHasPlaytested = false;
let playtestRuntime = null;
let playtestRoot = null;
let playtestGesture = null;
let playtestDone = null;
let validationFeedbackTimer = null;
let mechanicContext = null;
let publishedLoadComplete = false;
let officialSyncPromise = null;

function walk(node, visit, parent = null, parentKey = '') {
  if (!node || typeof node !== 'object') return;
  visit(node, parent, parentKey);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) {
      for (const child of value) if (child && typeof child.type === 'string') walk(child, visit, node, key);
    } else if (value && typeof value.type === 'string') {
      walk(value, visit, node, key);
    }
  }
}

function propertyName(prop) {
  if (!prop || prop.type !== 'Property') return null;
  if (!prop.computed && prop.key.type === 'Identifier') return prop.key.name;
  if (prop.key.type === 'Literal') return String(prop.key.value);
  return null;
}

function getProperty(objectNode, name) {
  return objectNode?.properties?.find(p => propertyName(p) === name) || null;
}

function staticValue(node) {
  if (!node) return undefined;
  if (node.type === 'Literal') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis.map(q => q.value.cooked).join('');
  }
  if (node.type === 'ArrayExpression') {
    const values = node.elements.map(staticValue);
    return values.some(v => v === undefined) ? undefined : values;
  }
  if (node.type === 'ObjectExpression') {
    const out = {};
    for (const prop of node.properties) {
      const key = propertyName(prop);
      const value = staticValue(prop.value);
      if (!key || value === undefined) return undefined;
      out[key] = value;
    }
    return out;
  }
  if (node.type === 'UnaryExpression' && node.operator === '-' && node.argument.type === 'Literal') {
    return -Number(node.argument.value);
  }
  return undefined;
}

function isWindowGames(node) {
  return node?.type === 'MemberExpression' && !node.computed &&
    node.object?.type === 'Identifier' && node.object.name === 'window' &&
    node.property?.type === 'Identifier' && node.property.name === 'GAMES';
}

function findRegistration(program) {
  const statements = program.body.filter(n => n.type !== 'EmptyStatement');
  if (statements.length !== 1 || statements[0].type !== 'ExpressionStatement') return null;
  const assignment = statements[0].expression;
  if (assignment.type !== 'AssignmentExpression' || assignment.operator !== '=' || !isWindowGames(assignment.left)) return null;
  const call = assignment.right;
  if (call.type !== 'CallExpression' || call.arguments.length !== 1) return null;
  if (call.callee.type !== 'MemberExpression' || call.callee.computed ||
      call.callee.property?.name !== 'concat') return null;
  const list = call.arguments[0];
  if (list.type !== 'ArrayExpression' || list.elements.length !== 1 ||
      list.elements[0]?.type !== 'ObjectExpression') return null;
  return list.elements[0];
}

function addIssue(list, message, node) {
  const line = node?.loc?.start?.line;
  list.push(line ? `第 ${line} 行：${message}` : message);
}

function extractScript(raw) {
  const input = String(raw || '').trim();
  if (!input) return { error: '請先貼上完整的 JavaScript Script。' };
  const blocks = [...input.matchAll(/```(?:javascript|js)?[ \t]*\r?\n([\s\S]*?)```/gi)];
  if (blocks.length > 1) return { error: '找到兩個以上的程式碼區塊。請只貼上一個完整 Script。' };
  if (blocks.length === 1) return { source: blocks[0][1].trim() };
  if (input.includes('```')) return { error: 'Markdown 程式碼圍欄不完整。請重新貼上完整 Script。' };
  return { source: input };
}

function validateScript(raw) {
  const extracted = extractScript(raw);
  if (extracted.error) return { source: '', errors: [extracted.error], warnings: [] };
  const source = extracted.source;
  const errors = [];
  const warnings = [];
  if (new TextEncoder().encode(source).length > MAX_SCRIPT_BYTES) {
    errors.push(`Script 超過 ${Math.round(MAX_SCRIPT_BYTES / 1000)} KB 上限。`);
  }

  let program;
  try {
    program = parse(source, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
  } catch (error) {
    const line = error.loc?.line ? `第 ${error.loc.line} 行：` : '';
    return { source, errors: [`${line}JavaScript 語法錯誤：${error.message}`], warnings };
  }

  const game = findRegistration(program);
  if (!game) {
    errors.push('頂層必須且只能有一個 window.GAMES = (window.GAMES || []).concat([{ ... }]) 註冊。');
    return { source, errors, warnings };
  }

  const read = name => {
    const prop = getProperty(game, name);
    return prop ? staticValue(prop.value) : undefined;
  };
  const metadata = {
    apiVersion: read('apiVersion'),
    gameVersion: read('gameVersion') || '1.0.0',
    id: read('id'),
    title: read('title'),
    description: read('description'),
    author: read('author'),
    tip: read('tip'),
    bg: read('bg'),
    tags: read('tags'),
    controls: read('controls'),
    duration: read('duration'),
    score: read('score'),
    remixSlots: read('remixSlots') || []
  };

  if (metadata.apiVersion !== 1) addIssue(errors, 'apiVersion 必須是 1。', getProperty(game, 'apiVersion') || game);
  if (!getProperty(game, 'gameVersion')) warnings.push('未填 gameVersion，發布時會使用 1.0.0。');
  for (const field of ['id', 'title', 'description', 'tip', 'bg']) {
    if (typeof metadata[field] !== 'string' || !metadata[field].trim()) {
      addIssue(errors, `缺少可直接讀取的 ${field} 字串。`, getProperty(game, field) || game);
    }
  }
  if (metadata.title?.length > 80) errors.push('title 不可超過 80 個字元。');
  if (metadata.description?.length > 240) errors.push('description 不可超過 240 個字元。');
  if (metadata.tip?.length > 160) errors.push('tip 不可超過 160 個字元。');
  if (!/^#[0-9a-f]{3,8}$/i.test(metadata.bg || '')) errors.push('bg 必須是十六進位色碼。');
  if (!Array.isArray(metadata.tags) || metadata.tags.some(x => typeof x !== 'string')) errors.push('tags 必須是字串陣列。');
  if (!Array.isArray(metadata.controls) || metadata.controls.length === 0 ||
      metadata.controls.some(x => typeof x !== 'string')) {
    errors.push('controls 必須是至少含一項的字串陣列。');
  } else if (metadata.controls.some(x => VERTICAL_CONTROLS.test(x))) {
    errors.push('controls 包含垂直操作；垂直手勢必須保留給 Feed。');
  }
  if (metadata.duration === undefined) {
    metadata.duration = 45;
  } else if (!Number.isInteger(metadata.duration) || metadata.duration <= 0) {
    warnings.push('duration 只供平台估計；目前值無效，發布時會使用 45 秒。');
    metadata.duration = 45;
  }
  const scoreOrder = metadata.score?.order || metadata.score?.mode;
  if (!metadata.score || typeof metadata.score.label !== 'string' || !['higher', 'lower'].includes(scoreOrder)) {
    errors.push('score 必須包含 label，以及 higher 或 lower 的 order。');
  } else {
    metadata.score.order = scoreOrder;
    metadata.score.decimals = Number.isInteger(metadata.score.decimals) ? metadata.score.decimals : 0;
  }
  if (!Array.isArray(metadata.remixSlots)) errors.push('remixSlots 必須是陣列。');

  const createProp = getProperty(game, 'create');
  if (!createProp || !['FunctionExpression', 'ArrowFunctionExpression'].includes(createProp.value.type)) {
    addIssue(errors, '缺少 create(env) 方法。', createProp || game);
  } else {
    const instance = findReturnedGameInstance(createProp.value);
    if (!instance) {
      addIssue(errors, 'create(env) 必須回傳 GameInstance 物件。', createProp);
    } else {
      for (const method of ['start', 'stop', 'input']) {
        if (!hasGameInstanceMethod(createProp.value, instance, method)) {
          addIssue(errors, `GameInstance 缺少 ${method}()。`, instance);
        }
      }
    }

    const declared = new Set();
    const collectPattern = node => {
      if (!node) return;
      if (node.type === 'Identifier') declared.add(node.name);
      else if (node.type === 'ObjectPattern') node.properties.forEach(p => collectPattern(p.value));
      else if (node.type === 'ArrayPattern') node.elements.forEach(collectPattern);
      else if (node.type === 'RestElement') collectPattern(node.argument);
      else if (node.type === 'AssignmentPattern') collectPattern(node.left);
    };
    walk(createProp.value, node => {
      if (node.type === 'VariableDeclarator') collectPattern(node.id);
      if (node.type === 'FunctionDeclaration' && node.id) declared.add(node.id.name);
      if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') node.params.forEach(collectPattern);
      if (node.type === 'CatchClause') collectPattern(node.param);
    });

    let hasOver = false;
    let hasSetScore = false;
    let hasCancel = false;
    walk(createProp.value, (node, parent, parentKey) => {
      if (node.type === 'Literal' && node.value === 'cancel') hasCancel = true;
      if (node.type === 'CallExpression') {
        const callee = node.callee;
        if (callee.type === 'Identifier' && callee.name === 'over') hasOver = true;
        if (callee.type === 'Identifier' && callee.name === 'setScore') hasSetScore = true;
        if (callee.type === 'MemberExpression' && !callee.computed &&
            callee.object?.name === 'env' && callee.property?.name === 'over') hasOver = true;
        if (callee.type === 'MemberExpression' && !callee.computed &&
            callee.object?.name === 'env' && callee.property?.name === 'setScore') hasSetScore = true;
      }
      if (node.type === 'Identifier' && FORBIDDEN_IDENTIFIERS.has(node.name) && !declared.has(node.name)) {
        const isStaticKey = parent?.type === 'Property' && parentKey === 'key' && !parent.computed;
        const isStaticMember = parent?.type === 'MemberExpression' && parentKey === 'property' && !parent.computed;
        if (!isStaticKey && !isStaticMember) addIssue(errors, `使用了禁止的 ${node.name}。`, node);
      }
      if (node.type === 'Identifier' && node.name === 'window' && !declared.has('window')) {
        addIssue(errors, '遊戲內容不可使用 window。', node);
      }
      if (node.type === 'ImportExpression') addIssue(errors, '禁止動態 import。', node);
      if (node.type === 'WhileStatement' && node.test?.type === 'Literal' && node.test.value === true) {
        addIssue(errors, '禁止 while(true) 無限迴圈。', node);
      }
      if (node.type === 'ForStatement' && !node.test) addIssue(errors, '禁止沒有結束條件的 for 迴圈。', node);
    });
    if (!hasOver) addIssue(errors, '沒有偵測到 env.over(score)。', createProp);
    if (!hasSetScore) addIssue(errors, '沒有偵測到 env.setScore(number)。', createProp);
    if (!hasCancel) addIssue(errors, 'input() 沒有安全處理 cancel。', createProp);
  }

  return { source, errors: [...new Set(errors)], warnings: [...new Set(warnings)], metadata, program };
}

function encodeSource(source) {
  const bytes = new TextEncoder().encode(source);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function sandboxDocument(channel, source, duration) {
  const encoded = encodeSource(source);
  const hardLimit = 600;
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; media-src blob:; connect-src 'none'">
<style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#fff}canvas{display:block;width:100%;height:100%}</style>
</head><body><canvas width="400" height="700"></canvas><script>
(()=>{'use strict';
const CHANNEL=${JSON.stringify(channel)}, LIMIT=${hardLimit * 1000};
const canvas=document.querySelector('canvas'),DPR=Math.min(Math.max(devicePixelRatio||1,1),3);
const ctx=canvas.getContext('2d');
function fitCanvas(){const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight),pw=Math.round(w*DPR),ph=Math.round(h*DPR);if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;ctx.setTransform(pw/400,0,0,ph/700,0,0)}}
fitCanvas();
let definition=null,game=null,ended=true,score=0,hardTimer=null,autoTimer=null;
const timers=new Set(),intervals=new Set(),rafs=new Set();
const real={
  setTimeout:window.setTimeout.bind(window),
  clearTimeout:window.clearTimeout.bind(window),
  setInterval:window.setInterval.bind(window),
  clearInterval:window.clearInterval.bind(window),
  raf:window.requestAnimationFrame.bind(window),
  caf:window.cancelAnimationFrame.bind(window)
};
window.setTimeout=(fn,ms,...a)=>{const id=real.setTimeout(()=>{timers.delete(id);fn(...a)},Math.min(Number(ms)||0,60000));timers.add(id);return id};
window.clearTimeout=id=>{timers.delete(id);real.clearTimeout(id)};
window.setInterval=(fn,ms,...a)=>{const id=real.setInterval(fn,Math.max(16,Number(ms)||0),...a);intervals.add(id);return id};
window.clearInterval=id=>{intervals.delete(id);real.clearInterval(id)};
window.requestAnimationFrame=fn=>{const id=real.raf(t=>{rafs.delete(id);fn(t)});rafs.add(id);return id};
window.cancelAnimationFrame=id=>{rafs.delete(id);real.caf(id)};
function send(type,data={}){parent.postMessage({playfeed:true,channel:CHANNEL,type,...data},'*')}
function finite(n){n=Number(n);return Number.isFinite(n)?Math.max(-1e9,Math.min(1e9,n)):0}
function clearAll(){for(const id of timers)real.clearTimeout(id);for(const id of intervals)real.clearInterval(id);for(const id of rafs)real.caf(id);timers.clear();intervals.clear();rafs.clear();if(hardTimer)real.clearTimeout(hardTimer);if(autoTimer)real.clearInterval(autoTimer);hardTimer=autoTimer=null}
function stop(){if(game&&game.stop)try{game.stop()}catch(e){}clearAll();ended=true}
function beep(f1,f2,dur,vol,type){try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return;const ac=beep.ac||(beep.ac=new A()),o=ac.createOscillator(),g=ac.createGain();o.type=type||'sine';o.frequency.setValueAtTime(Math.max(20,finite(f1)),ac.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(20,finite(f2)),ac.currentTime+Math.min(2,Math.max(.01,finite(dur))));g.gain.setValueAtTime(Math.min(.5,Math.max(.001,finite(vol))),ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+Math.min(2,Math.max(.01,finite(dur))));o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+Math.min(2,Math.max(.01,finite(dur))))}catch(e){}}
const env={W:400,H:700,ctx,beep,sprite:()=>false,setScore(n){if(ended)return;score=finite(n);send('score',{score})},over(n){if(ended)return;score=finite(n);ended=true;clearAll();send('over',{score})}};
function start(auto){stop();fitCanvas();ended=false;score=0;ctx.clearRect(0,0,400,700);try{game=definition.create(env);game.start();send('score',{score:0});hardTimer=real.setTimeout(()=>{if(!ended)env.over(score)},LIMIT);if(auto)startAuto()}catch(e){ended=true;send('runtime-error',{message:String(e&&e.message||e)})}}
function input(type,x,y){if(ended||!game||!game.input)return;try{game.input(type,finite(x),finite(y))}catch(e){send('runtime-error',{message:String(e&&e.message||e)})}}
function startAuto(){if(autoTimer)real.clearInterval(autoTimer);autoTimer=real.setInterval(()=>{if(ended)return;const x=60+Math.random()*280,y=150+Math.random()*430;input('down',x,y);if(Math.random()<.45){input('move',Math.max(20,Math.min(380,x+(Math.random()-.5)*220)),y+(Math.random()-.5)*40)}real.setTimeout(()=>input('up',x,y),80+Math.random()*180)},380+Math.random()*240)}
addEventListener('message',e=>{if(e.source!==parent||!e.data||e.data.channel!==CHANNEL)return;const m=e.data;if(m.type==='start')start(false);else if(m.type==='auto')start(true);else if(m.type==='stop')stop();else if(m.type==='input')input(m.inputType,m.x,m.y);else if(m.type==='capture'){let image=null;try{image=canvas.toDataURL('image/webp',.78)}catch(_){}send('capture',{image})}});
addEventListener('error',e=>send('runtime-error',{message:String(e.message||'執行錯誤')}));
try{const binary=atob(${JSON.stringify(encoded)}),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0)),code=new TextDecoder().decode(bytes);window.GAMES=[];(new Function(code))();if(!Array.isArray(window.GAMES)||window.GAMES.length!==1)throw new Error('Script 沒有註冊恰好一款遊戲');definition=window.GAMES[0];send('ready')}catch(e){send('runtime-error',{message:String(e&&e.message||e)})}
})();<\/script></body></html>`;
}

function createRuntime(container, source, duration, onMessage) {
  const channel = `pf_${crypto.randomUUID()}`;
  const frame = document.createElement('iframe');
  frame.className = 'sandbox-frame';
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.setAttribute('title', 'PlayFeed 沙盒遊戲');
  frame.srcdoc = sandboxDocument(channel, source, duration);
  container.appendChild(frame);
  let ready = false;
  const queue = [];
  const listener = event => {
    const msg = event.data;
    if (event.source !== frame.contentWindow || !msg?.playfeed || msg.channel !== channel) return;
    if (msg.type === 'ready') {
      ready = true;
      while (queue.length) frame.contentWindow.postMessage(queue.shift(), '*');
    }
    onMessage?.(msg);
  };
  window.addEventListener('message', listener);
  return {
    frame,
    send(type, data = {}) {
      const message = { channel, type, ...data };
      if (!ready && type !== 'stop') queue.push(message);
      else frame.contentWindow?.postMessage(message, '*');
    },
    destroy() {
      window.removeEventListener('message', listener);
      try { frame.contentWindow?.postMessage({ channel, type: 'stop' }, '*'); } catch (_) {}
      frame.remove();
    }
  };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function copyText(text, message) {
  navigator.clipboard.writeText(text).then(() => host.toast(message)).catch(() => {
    const area = document.createElement('textarea');
    area.value = text; document.body.appendChild(area); area.select();
    document.execCommand('copy'); area.remove(); host.toast(message);
  });
}

function reportText(result) {
  return `這個 PlayFeed Script 沒有通過 v1 驗證。\n\n錯誤：\n` +
    result.errors.map((x, i) => `${i + 1}. ${x}`).join('\n') +
    `\n\n請依照 PlayFeed v1 規格修復以上問題，保留原本玩法，並重新輸出完整的單一 JavaScript 程式碼區塊。`;
}

function buildCreatorUI() {
  const root = el('section');
  root.id = 'creator';
  root.innerHTML = `
    <header class="creator-head"><b>創作 PlayFeed</b><button id="creatorClose">取消</button></header>
    <div class="creator-scroll"><main class="creator-wrap">
      <section class="creator-intro">
        <h1 id="creatorIntroTitle">五個步驟，<br>發布一款遊戲。</h1>
        <p id="creatorIntroText">你可以使用 ChatGPT、Claude、Gemini 或任何工具創作。PlayFeed 只負責規格、驗證、試玩與發布。</p>
      </section>
      <section class="creator-mechanic-context" id="creatorMechanicContext" hidden>
        <small>玩法來源</small>
        <h2 id="creatorMechanicTitle"></h2>
        <p id="creatorMechanicSummary"></p>
      </section>
      <section class="creator-step" data-step="1">
        <span class="creator-step-no">1</span><div class="creator-step-content">
          <h2 id="creatorCopyTitle">複製創作規格</h2>
          <p id="creatorCopyText">複製 PlayFeed 的執行格式、平台 API、安全限制與操作邊界；玩法由你決定。</p>
          <button class="creator-action" id="copyCreatorSpec">複製遊戲創作規格</button>
        </div>
      </section>
      <section class="creator-step" data-step="2">
        <span class="creator-step-no">2</span><div class="creator-step-content">
          <h2 id="creatorAiTitle">交給自己的 AI 創作</h2>
          <p id="creatorAiText">把規格貼給你使用的 AI，再告訴它你想製作什麼遊戲。它最後應只輸出一個完整 JavaScript 程式碼區塊。</p>
        </div>
      </section>
      <section class="creator-step" data-step="3">
        <span class="creator-step-no">3</span><div class="creator-step-content">
          <h2>貼上生成的程式碼</h2>
          <p>可以貼純 JavaScript，也可以直接貼含有單一程式碼區塊的完整回覆。</p>
          <textarea id="creatorSource" spellcheck="false" placeholder="在這裡貼上完整的遊戲 Script"></textarea>
          <div class="creator-source-actions">
            <button class="creator-ghost creator-paste" id="focusCreatorSource">從剪貼簿貼上</button>
            <button class="creator-ghost creator-clear" id="clearCreatorSource">全部刪除</button>
          </div>
        </div>
      </section>
      <section class="creator-step" data-step="4">
        <span class="creator-step-no">4</span><div class="creator-step-content">
          <h2>驗證</h2>
          <p>PlayFeed 會擷取顯示資料並檢查 Script；有問題時會產生可複製的修復報告。</p>
          <button class="creator-action creator-submit" id="validateCreatorSource">驗證遊戲 Script</button>
          <p class="creator-hint">正式作者與遊戲 ID 由平台建立，不採信 Script 裡的 author 與 id。</p>
        </div>
      </section>
      <section class="creator-step" data-step="5">
        <span class="creator-step-no">5</span><div class="creator-step-content creator-result-content">
          <h2>試玩</h2>
          <p>驗證通過後，全螢幕試玩一次；往上滑或遊戲結束即可離開並發布。</p>
          <div id="creatorResult"><div class="creator-result-empty">尚未驗證遊戲</div></div>
        </div>
      </section>
    </main></div>`;
  document.body.appendChild(root);
  root.querySelector('#creatorClose').addEventListener('click', closeCreator);
  root.querySelector('#copyCreatorSpec').addEventListener('click', event => {
    const text = mechanicContext ? buildMechanicPrompt(mechanicContext) : FULL_SPEC;
    copyText(text, mechanicContext ? '玩法模板與創作規格已複製' : '完整創作規格已複製');
    event.currentTarget.textContent = mechanicContext ? '✓ 已複製玩法模板' : '✓ 已複製創作規格';
    root.querySelector('[data-step="1"]').classList.add('done');
    root.querySelector('[data-step="2"]').classList.add('next');
  });
  root.querySelector('#focusCreatorSource').addEventListener('click', async () => {
    const area = root.querySelector('#creatorSource');
    let pasted = false;
    try {
      const text = await navigator.clipboard.readText();
      if (text && !area.value.trim()) {
        area.value = text;
        pasted = true;
      }
    } catch (_) {}
    if (pasted) area.dispatchEvent(new Event('input'));
    area.focus();
  });
  root.querySelector('#creatorSource').addEventListener('input', event => {
    if (draft) {
      draft = null;
      draftHasPlaytested = false;
      root.querySelector('#creatorResult').innerHTML = '<div class="creator-result-empty">程式碼已變更，請重新驗證</div>';
      root.querySelector('[data-step="4"]').classList.remove('done');
      root.querySelector('[data-step="5"]').classList.remove('next');
    }
    if (!event.currentTarget.value.trim()) return;
    root.querySelector('[data-step="2"]').classList.remove('next');
    root.querySelector('[data-step="2"]').classList.add('done');
    root.querySelector('[data-step="3"]').classList.add('next');
  });
  root.querySelector('#clearCreatorSource').addEventListener('click', () => {
    const area = root.querySelector('#creatorSource');
    const validate = root.querySelector('#validateCreatorSource');
    clearTimeout(validationFeedbackTimer);
    area.value = '';
    draft = null;
    draftHasPlaytested = false;
    root.querySelector('#creatorResult').innerHTML = '<div class="creator-result-empty">尚未驗證遊戲</div>';
    root.querySelector('[data-step="3"]').classList.add('next');
    root.querySelector('[data-step="4"]').classList.remove('done');
    root.querySelector('[data-step="5"]').classList.remove('next');
    validate.classList.remove('checking', 'passed', 'failed');
    validate.disabled = false;
    validate.textContent = '驗證遊戲 Script';
    area.focus();
    host.toast('程式碼已全部刪除');
  });
  root.querySelector('#validateCreatorSource').addEventListener('click', event => {
    const button = event.currentTarget;
    const source = root.querySelector('#creatorSource').value;
    clearTimeout(validationFeedbackTimer);
    button.disabled = true;
    button.classList.remove('passed', 'failed');
    button.classList.add('checking');
    button.textContent = '驗證中…';
    setTimeout(() => {
      const result = validateScript(source);
      renderValidation(result);
      button.classList.remove('checking');
      button.classList.add(result.errors.length ? 'failed' : 'passed');
      button.textContent = result.errors.length ? '驗證未通過' : '✓ 驗證通過';
      button.disabled = false;
      root.querySelector('[data-step="4"]').classList.toggle('done', !result.errors.length);
      root.querySelector('[data-step="5"]').classList.toggle('next', !result.errors.length);
      validationFeedbackTimer = setTimeout(() => {
        button.classList.remove('passed', 'failed');
        button.textContent = '重新驗證遊戲 Script';
      }, 1500);
    }, 180);
  });
  return root;
}

const creatorRoot = buildCreatorUI();

function setCreatorMode(context) {
  mechanicContext = context || null;
  const special = !!mechanicContext;
  creatorRoot.querySelector('#creatorMechanicContext').hidden = !special;
  creatorRoot.querySelector('#creatorIntroTitle').innerHTML = special
    ? '用熟悉的玩法，<br>做一款新遊戲。'
    : '五個步驟，<br>發布一款遊戲。';
  creatorRoot.querySelector('#creatorIntroText').textContent = special
    ? '保留核心互動，主題、角色與風格由你決定。PlayFeed 不會替你生成內容。'
    : '你可以使用 ChatGPT、Claude、Gemini 或任何工具創作。PlayFeed 只負責規格、驗證、試玩與發布。';
  creatorRoot.querySelector('#creatorCopyTitle').textContent = special ? '複製玩法模板' : '複製創作規格';
  creatorRoot.querySelector('#creatorCopyText').textContent = special
    ? '複製這款遊戲的玩法配方與 PlayFeed 執行規格。'
    : '複製 PlayFeed 的執行格式、平台 API、安全限制與操作邊界；玩法由你決定。';
  creatorRoot.querySelector('#creatorAiTitle').textContent = special ? '告訴 AI 你的新主題' : '交給自己的 AI 創作';
  creatorRoot.querySelector('#creatorAiText').textContent = special
    ? '把玩法模板貼給自己的 AI，再告訴它想換成什麼主題。它最後應只輸出一個完整 JavaScript 程式碼區塊。'
    : '把規格貼給你使用的 AI，再告訴它你想製作什麼遊戲。它最後應只輸出一個完整 JavaScript 程式碼區塊。';
  const copy = creatorRoot.querySelector('#copyCreatorSpec');
  copy.textContent = special ? '複製玩法模板＋創作規格' : '複製遊戲創作規格';
  if (special) {
    creatorRoot.querySelector('#creatorMechanicTitle').textContent = mechanicContext.sourceTitle;
    creatorRoot.querySelector('#creatorMechanicSummary').textContent = mechanicContext.summary;
  }
}

function showCreator() {
  host.closeProfile();
  host.closeStandalone();
  creatorRoot.classList.add('open');
  host.setMainNavActive('create');
  host.setNavVisible(true);
}

function openCreator() {
  if (mechanicContext) resetCreator();
  else setCreatorMode(null);
  showCreator();
}

function openMechanicCreator(context) {
  resetCreator();
  setCreatorMode(context);
  showCreator();
}

function closeCreator() {
  closePlaytest(false);
  creatorRoot.classList.remove('open');
  if (previewRuntime) { previewRuntime.destroy(); previewRuntime = null; }
  host.setMainNavActive('home');
}

function resetCreator() {
  closePlaytest(false);
  if (previewRuntime) { previewRuntime.destroy(); previewRuntime = null; }
  draft = null;
  draftHasPlaytested = false;
  creatorRoot.querySelector('#creatorSource').value = '';
  creatorRoot.querySelector('#creatorResult').innerHTML = '<div class="creator-result-empty">尚未驗證遊戲</div>';
  const copy = creatorRoot.querySelector('#copyCreatorSpec');
  const validate = creatorRoot.querySelector('#validateCreatorSource');
  clearTimeout(validationFeedbackTimer);
  copy.textContent = '複製遊戲創作規格';
  validate.classList.remove('checking', 'passed', 'failed');
  validate.disabled = false;
  validate.textContent = '驗證遊戲 Script';
  creatorRoot.querySelectorAll('.creator-step').forEach(step => step.classList.remove('done', 'next'));
  creatorRoot.querySelector('.creator-scroll').scrollTop = 0;
  setCreatorMode(null);
}

function setDraftMetadataFromEdits(card) {
  if (!draft) return;
  const title = card.querySelector('[data-edit="title"]')?.value.trim();
  const description = card.querySelector('[data-edit="description"]')?.value.trim();
  const tip = card.querySelector('[data-edit="tip"]')?.value.trim();
  if (title) draft.metadata.title = title.slice(0, 80);
  if (description) draft.metadata.description = description.slice(0, 240);
  if (tip) draft.metadata.tip = tip.slice(0, 160);
}

function closePlaytest(completed, message = '') {
  if (!playtestRoot) return;
  if (playtestGesture && playtestRuntime) {
    playtestRuntime.send('input', {
      inputType: 'cancel',
      x: playtestGesture.x,
      y: playtestGesture.y
    });
  }
  playtestGesture = null;
  if (playtestRuntime) playtestRuntime.destroy();
  playtestRuntime = null;
  playtestRoot.remove();
  playtestRoot = null;
  const done = playtestDone;
  playtestDone = null;
  if (creatorRoot.classList.contains('open')) host.setNavVisible(true);
  if (completed) done?.();
  if (message) host.toast(message);
}

function openPlaytest(result, onDone) {
  closePlaytest(false);
  const root = el('section', 'creator-playtest');
  root.innerHTML = `
    <div class="creator-playtest-stage">
      <div class="creator-playtest-frame"></div>
      <div class="creator-playtest-input"></div>
      <div class="creator-playtest-exit">↑ 往上滑離開試玩</div>
      <div class="creator-playtest-status"></div>
    </div>`;
  document.body.appendChild(root);
  playtestRoot = root;
  playtestDone = onDone;
  host.setNavVisible(false);

  const stage = root.querySelector('.creator-playtest-stage');
  const frameHost = root.querySelector('.creator-playtest-frame');
  const inputLayer = root.querySelector('.creator-playtest-input');
  const status = root.querySelector('.creator-playtest-status');
  const logical = event => {
    const rect = stage.getBoundingClientRect();
    return [
      (event.clientX - rect.left) / rect.width * 400,
      (event.clientY - rect.top) / rect.height * 700
    ];
  };

  playtestRuntime = createRuntime(frameHost, result.source, result.metadata.duration, msg => {
    if (msg.type === 'over' && root.dataset.failed !== 'true') {
      status.textContent = `遊戲結束 · ${msg.score}`;
      status.classList.add('show');
      setTimeout(() => closePlaytest(true, '試玩完成，可以發布'), 520);
    }
    if (msg.type === 'runtime-error') {
      root.dataset.failed = 'true';
      playtestRuntime?.send('stop');
      status.textContent = `執行錯誤：${msg.message} · 往上滑離開`;
      status.classList.add('show', 'bad');
    }
  });
  playtestRuntime.send('start');

  inputLayer.addEventListener('pointerdown', event => {
    if (!playtestRuntime) return;
    event.preventDefault();
    try { inputLayer.setPointerCapture(event.pointerId); } catch (_) {}
    const [x, y] = logical(event);
    playtestGesture = {
      id: event.pointerId,
      x0: event.clientX,
      y0: event.clientY,
      x,
      y,
      exiting: false
    };
    playtestRuntime.send('input', { inputType: 'down', x, y });
  });
  inputLayer.addEventListener('pointermove', event => {
    if (!playtestGesture || playtestGesture.id !== event.pointerId || !playtestRuntime) return;
    event.preventDefault();
    const [x, y] = logical(event);
    playtestGesture.x = x;
    playtestGesture.y = y;
    const dx = event.clientX - playtestGesture.x0;
    const dy = event.clientY - playtestGesture.y0;
    if (!playtestGesture.exiting && dy < -52 && Math.abs(dy) > Math.abs(dx) * 1.15) {
      playtestGesture.exiting = true;
      playtestRuntime.send('input', { inputType: 'cancel', x, y });
      const passed = root.dataset.failed !== 'true';
      closePlaytest(passed, passed ? '已離開試玩，可以發布' : '試玩有執行錯誤，請先修正');
      return;
    }
    if (!playtestGesture.exiting) {
      playtestRuntime.send('input', { inputType: 'move', x, y });
    }
  });
  const end = (event, cancelled) => {
    if (!playtestGesture || playtestGesture.id !== event.pointerId || !playtestRuntime) return;
    event.preventDefault();
    const [x, y] = logical(event);
    playtestRuntime.send('input', { inputType: cancelled ? 'cancel' : 'up', x, y });
    playtestGesture = null;
  };
  inputLayer.addEventListener('pointerup', event => end(event, false));
  inputLayer.addEventListener('pointercancel', event => end(event, true));
}

function renderValidation(result) {
  const out = creatorRoot.querySelector('#creatorResult');
  out.replaceChildren();
  if (previewRuntime) { previewRuntime.destroy(); previewRuntime = null; }
  const card = el('article', 'creator-card');
  const body = el('div', 'creator-card-body');
  card.appendChild(body);

  if (result.errors.length) {
    draft = null;
    draftHasPlaytested = false;
    body.appendChild(el('div', 'creator-status bad', '未通過 v1 驗證'));
    body.appendChild(el('h2', '', '需要修正 Script'));
    const list = el('ol', 'creator-errors');
    for (const error of result.errors) list.appendChild(el('li', '', error));
    body.appendChild(list);
    const buttons = el('div', 'creator-buttons');
    const copyReport = el('button', '', '複製錯誤報告');
    copyReport.addEventListener('click', () => copyText(reportText(result), '錯誤報告已複製'));
    const copyRepair = el('button', '', '複製修復規格＋原始 Script');
    copyRepair.addEventListener('click', () => copyText(buildRepairPrompt(reportText(result), result.source), '修復規格已複製'));
    buttons.append(copyReport, copyRepair);
    body.appendChild(buttons);
    if (result.source) {
      const details = el('details', 'creator-edit');
      details.innerHTML = '<summary>查看擷取到的 Script</summary>';
      details.appendChild(el('pre', 'creator-code', result.source));
      body.appendChild(details);
    }
    card.appendChild(body);
    out.appendChild(card);
    return;
  }

  draft = result;
  draftHasPlaytested = false;
  body.appendChild(el('div', 'creator-status ok', '✓ 通過 v1 靜態驗證'));
  body.appendChild(el('p', 'creator-edit-note', '點一下文字欄位即可直接修改顯示資料'));

  const titleInput = el('input', 'creator-title-input');
  titleInput.value = result.metadata.title;
  titleInput.dataset.edit = 'title';
  titleInput.maxLength = 80;
  titleInput.setAttribute('aria-label', '遊戲名稱');
  const descInput = el('textarea', 'creator-desc-input');
  descInput.value = result.metadata.description;
  descInput.dataset.edit = 'description';
  descInput.maxLength = 240;
  descInput.setAttribute('aria-label', '遊戲介紹');
  const tipInput = el('input', 'creator-tip-input');
  tipInput.value = result.metadata.tip;
  tipInput.dataset.edit = 'tip';
  tipInput.maxLength = 160;
  tipInput.setAttribute('aria-label', '操作說明');
  const directFields = el('div', 'creator-direct-fields');
  const directField = (label, input) => {
    const wrap = el('label');
    wrap.append(el('small', '', label), input);
    return wrap;
  };
  directFields.append(
    directField('遊戲名稱', titleInput),
    directField('一句話介紹', descInput),
    directField('操作說明', tipInput)
  );
  body.appendChild(directFields);

  const meta = el('div', 'creator-meta');
  const pairs = [
    ['結束方式', '依遊戲本身規則'],
    ['操作類型', result.metadata.controls.join('、')],
    ['Remix 元素', result.metadata.remixSlots.length ? result.metadata.remixSlots.map(x => x.label).join('、') : '無'],
    ['排行榜', `${result.metadata.score.label} · ${result.metadata.score.order === 'higher' ? '愈高愈好' : '愈低愈好'}`],
    ['版本', `API v${result.metadata.apiVersion} · 遊戲 ${result.metadata.gameVersion}`]
  ];
  for (const [label, value] of pairs) {
    const item = el('div');
    item.append(el('small', '', label), el('span', '', value));
    meta.appendChild(item);
  }
  body.appendChild(meta);
  if (result.warnings.length) body.appendChild(el('p', 'creator-warnings', result.warnings.join(' ')));

  const buttons = el('div', 'creator-buttons');
  const play = el('button', 'creator-play', '開始試玩');
  const publish = el('button', 'publish', '試玩後即可發布');
  publish.disabled = true;
  buttons.append(play, publish);
  body.appendChild(buttons);
  const playState = el('p', 'creator-play-state', '先完成一次試玩，發布按鈕就會開啟。');
  body.appendChild(playState);
  card.appendChild(body);
  out.appendChild(card);

  play.addEventListener('click', () => {
    setDraftMetadataFromEdits(card);
    openPlaytest(result, () => {
      draftHasPlaytested = true;
      publish.disabled = false;
      publish.textContent = '發布';
      playState.textContent = '✓ 已完成試玩，可以發布。';
      playState.classList.add('done');
    });
  });
  publish.addEventListener('click', () => {
    setDraftMetadataFromEdits(card);
    if (!draftHasPlaytested) return host.toast('請先完成一次試玩');
    if (!host.requireLogin(publishDraft)) return;
    publishDraft();
  });
}

function slugify(value) {
  const slug = String(value || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 54);
  return slug || `game-${crypto.randomUUID().slice(0, 8)}`;
}

function missingUserGamesTable(error) {
  return error && (error.code === 'PGRST205' || error.code === '42P01' ||
    /user_games.*schema cache|relation .*user_games.* does not exist|could not find.*user_games/i.test(error.message || ''));
}

function legacyRowToPublished(row) {
  const payload = row?.sprites?.playfeedSubmission;
  if (!payload || payload.apiVersion !== 1 || !payload.script) return null;
  return {
    id: row.id,
    slug: payload.slug,
    suggested_id: payload.suggestedId,
    api_version: 1,
    game_version: payload.gameVersion || '1.0.0',
    title: payload.title || row.name,
    description: payload.description || '',
    tip: payload.tip || '',
    bg: payload.bg || '#18354a',
    tags: payload.tags || [],
    controls: payload.controls || [],
    duration: payload.duration || 45,
    score: payload.score || { label: '分數', order: 'higher' },
    remix_slots: payload.remixSlots || [],
    script: payload.script,
    screenshot: payload.screenshot || null,
    author_id: row.user_id,
    author_name: row.author || '玩家',
    status: 'published',
    created_at: row.created_at,
    storage_mode: 'remixes'
  };
}

async function detectBackendMode() {
  if (backendMode) return backendMode;
  const { error } = await host.db.from('user_games').select('id').limit(1);
  backendMode = missingUserGamesTable(error) ? 'remixes' : 'user_games';
  return backendMode;
}

async function uniqueSlug(suggested) {
  const base = slugify(suggested);
  const mode = await detectBackendMode();
  let used;
  if (mode === 'user_games') {
    const { data } = await host.db.from('user_games').select('slug').like('slug', `${base}%`).limit(100);
    used = new Set((data || []).map(x => x.slug));
  } else {
    const { data } = await host.db.from('remixes').select('sprites').eq('base_id', LEGACY_BASE_ID).limit(500);
    used = new Set((data || []).map(x => x.sprites?.playfeedSubmission?.slug).filter(Boolean));
  }
  if (!used.has(base)) return base;
  for (let i = 2; i < 100; i++) if (!used.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${crypto.randomUUID().slice(0, 4)}`;
}

function capturePreview() {
  if (!previewRuntime) return Promise.resolve(null);
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), 1800);
    const handler = event => {
      if (event.data?.playfeed && event.data.type === 'capture') {
        clearTimeout(timer); window.removeEventListener('message', handler); resolve(event.data.image || null);
      }
    };
    window.addEventListener('message', handler);
    previewRuntime.send('capture');
  });
}

function captureDraftAutomatically() {
  if (previewRuntime) return capturePreview();
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:400px;height:700px;overflow:hidden;';
  document.body.appendChild(holder);
  return new Promise(resolve => {
    let settled = false;
    const finish = image => {
      if (settled) return;
      settled = true;
      runtime.destroy(); holder.remove(); resolve(image || null);
    };
    const runtime = createRuntime(holder, draft.source, draft.metadata.duration, msg => {
      if (msg.type === 'ready') {
        runtime.send('auto');
        setTimeout(() => runtime.send('capture'), 900);
      } else if (msg.type === 'capture') finish(msg.image);
      else if (msg.type === 'runtime-error') finish(null);
    });
    setTimeout(() => finish(null), 2600);
  });
}

async function publishDraft() {
  if (!draft || !host.user || !host.db) return;
  const button = creatorRoot.querySelector('.creator-buttons .publish');
  if (button) { button.disabled = true; button.textContent = '發布中…'; }
  try {
    const screenshot = await captureDraftAutomatically();
    const row = {
      suggested_id: draft.metadata.id,
      api_version: 1,
      game_version: draft.metadata.gameVersion,
      title: draft.metadata.title,
      description: draft.metadata.description,
      tip: draft.metadata.tip,
      bg: draft.metadata.bg,
      tags: draft.metadata.tags,
      controls: draft.metadata.controls,
      duration: Math.min(60, Math.max(20, draft.metadata.duration || 45)),
      score: draft.metadata.score,
      remix_slots: draft.metadata.remixSlots,
      script: draft.source,
      screenshot
    };
    const result = await host.secureWrite('publish-game', { game: row });
    const data = result.game;
    if (!data) throw new Error('後端沒有回傳已發布的遊戲資料。');
    publishedRows.push(data);
    const post = addSandboxPost(data);
    host.refreshProfile();
    host.toast('發布成功！已加入 PlayFeed');
    resetCreator();
    closeCreator();
    setTimeout(() => post.el.scrollIntoView({ behavior: 'smooth' }), 320);
  } catch (error) {
    host.toast(`發布失敗：${error.message || error}`);
  } finally {
    if (button) { button.disabled = false; button.textContent = '發布'; }
  }
}

function publishedAuthorText(authorId, name) {
  return host.user && authorId === host.user.id ? '@我' : `@${name || '玩家'}`;
}

function normalisePublished(row) {
  const officialBase = (window.GAMES || []).find(game => game.id === row.slug) || null;
  const entry = {
    id: `game:${row.slug}`,
    databaseId: row.id,
    storageMode: row.storage_mode || 'user_games',
    scoreKey: `game:${row.slug}@${row.game_version || '1.0.0'}`,
    slug: row.slug,
    gameVersion: row.game_version || '1.0.0',
    title: row.title,
    description: row.description,
    tip: row.tip,
    bg: row.bg,
    author: publishedAuthorText(row.author_id, row.author_name),
    authorId: row.author_id,
    authorName: row.author_name || '玩家',
    duration: row.duration,
    score: row.score || { label: '分數', order: 'higher' },
    remixSlots: row.remix_slots?.length ? row.remix_slots : (officialBase?.remixSlots || []),
    screenshot: row.screenshot || null,
    script: row.script,
    base: officialBase,
    sprites: {},
    spriteData: {},
    isOfficial: !!officialBase
  };
  entry.mechanicContext = publishedMechanicContext(entry);
  return entry;
}

function refreshPublishedAuthors() {
  for (const post of publishedPosts) {
    post.entry.author = publishedAuthorText(post.entry.authorId, post.entry.authorName);
    post.el.querySelectorAll('.author-link').forEach(button => {
      button.textContent = post.entry.author;
    });
  }
}

function publishedMechanicContext(entry) {
  return {
    sourceGameId: entry.id,
    sourceTitle: entry.title,
    summary: `${entry.description || ''} 操作方式：${entry.tip || '依畫面提示操作'}`.trim(),
    preserve: ['保留來源遊戲的核心操作、勝負條件、計分方式與主要節奏'],
    sourceScript: entry.script
  };
}

function scoreIsBetter(order, next, previous) {
  return previous === null || previous === undefined ||
    (order === 'lower' ? next < previous : next > previous);
}

async function readPublishedBest(entry, bestChip) {
  if (!host.db || !host.user) { bestChip.style.display = 'none'; return null; }
  let result;
  if (entry.storageMode === 'remixes') {
    result = await host.db.from('scores').select('score')
      .eq('game_id', entry.scoreKey).eq('user_id', host.user.id).maybeSingle();
  } else {
    result = await host.db.from('user_game_scores').select('score')
      .eq('game_id', entry.databaseId)
      .eq('game_version', entry.gameVersion)
      .eq('user_id', host.user.id)
      .maybeSingle();
  }
  const data = result.data;
  if (!data) { bestChip.style.display = 'none'; return null; }
  bestChip.style.display = '';
  bestChip.querySelector('.bs').textContent = String(data.score);
  return Number(data.score);
}

async function submitPublishedScore(entry, value, bestChip) {
  if (!host.db || !host.user || !Number.isFinite(Number(value))) return;
  const score = Math.max(-1e9, Math.min(1e9, Number(value)));
  const previous = await readPublishedBest(entry, bestChip);
  if (!scoreIsBetter(entry.score.order, score, previous)) return;
  try {
    await host.secureWrite('user-game-score', {
      storageMode: entry.storageMode,
      databaseId: entry.databaseId,
      gameVersion: entry.gameVersion,
      scoreKey: entry.scoreKey,
      score
    });
    bestChip.style.display = '';
    bestChip.querySelector('.bs').textContent = String(score);
  } catch (error) {}
}

function addSandboxPost(row, options = {}) {
  const entry = normalisePublished(row);
  const post = el('section', 'post sandbox-post');
  if (options.standalone) post.classList.add('standalone-post');
  post.dataset.gameId = entry.id;
  post.style.background = entry.bg;
  const stage = el('div', 'stage');
  const frameHost = el('div', 'sandbox-frame-host');
  frameHost.style.cssText = 'position:absolute;inset:0;';
  const inputLayer = el('div', 'sandbox-input');
  const hud = el('div', 'hud');
  const scoreChip = el('span', 'chip score-chip');
  scoreChip.append(document.createTextNode(`${entry.score.label || '分數'} `), el('b', 'sc', '0'));
  const bestChip = el('span', 'chip best-chip');
  bestChip.style.display = 'none';
  bestChip.append(document.createTextNode('最佳 '), el('span', 'bs', '0'));
  hud.append(scoreChip, bestChip);
  const rail = el('div', 'rail');
  const makeRailButton = (klass, icon, label) => {
    const button = el('button', klass);
    if (klass === 'like') button.setAttribute('aria-label', '按讚');
    if (klass === 'dislike') button.setAttribute('aria-label', '倒讚');
    const ic = el('span', 'ic'); ic.innerHTML = host.icons[icon] || '';
    const counterClass = klass === 'like' ? 'lc' : (klass === 'dislike' ? 'dc' : '');
    button.append(ic, el('span', counterClass, counterClass ? '0' : label));
    return button;
  };
  const like = makeRailButton('like', 'like', '');
  const dislike = makeRailButton('dislike', 'dislike', '');
  const comment = makeRailButton('cmt', 'comment', '留言');
  const save = makeRailButton('sv', 'save', '儲存');
  const share = makeRailButton('shr', 'share', '分享');
  rail.append(like, dislike, comment, save, share);
  const overlay = el('div', 'overlay');
  const resetOverlay = (finalScore = null) => {
    overlay.replaceChildren();
    const card = el('div', 'overlay-main');
    const author = el('button', 'author-link', entry.author);
    author.addEventListener('click', event => {
      event.stopPropagation();
      destroyRuntime();
      playing = false;
      previewing = false;
      stage.classList.remove('playing');
      host.openAuthorProfile(entry.authorId, entry.authorName);
    });
    if (finalScore === null) {
      card.append(author, el('h2', '', entry.title.split('：')[0]));
    } else {
      card.append(el('div', 'final', String(finalScore)));
    }
    const buttons = el('div', 'ov-btns');
    if (finalScore === null) buttons.classList.add('initial-actions');
    if (finalScore !== null) {
      const shareResult = el('button', 'share-score', '分享成績');
      shareResult.addEventListener('click', event => {
        event.stopPropagation();
        host.shareResult(entry, finalScore);
      });
      buttons.append(shareResult);
    }
    const go = el('button', 'go', finalScore === null ? '開始' : '再玩一次');
    go.addEventListener('click', event => { event.stopPropagation(); begin(); });
    const mechanic = el('button', 'mechanic-create', '二創');
    mechanic.addEventListener('click', event => {
      event.stopPropagation();
      destroyRuntime();
      playing = false;
      previewing = false;
      stage.classList.remove('playing');
      host.openRemix(entry);
    });
    buttons.append(go, mechanic);
    card.appendChild(buttons);
    overlay.appendChild(card);
  };
  resetOverlay();
  const errorBox = el('div', 'sandbox-error');
  stage.append(frameHost, inputLayer, hud, rail, overlay, errorBox);
  post.appendChild(stage);
  if (options.container) options.container.appendChild(post);
  else host.feed.prepend(post);

  let runtime = null;
  let playing = false;
  let previewing = false;
  let gesture = null;
  const destroyRuntime = () => { if (runtime) runtime.destroy(); runtime = null; frameHost.replaceChildren(); };
  const spawn = mode => {
    destroyRuntime();
    errorBox.style.display = 'none';
    runtime = createRuntime(frameHost, entry.script, entry.duration, msg => {
      if (msg.type === 'score') scoreChip.querySelector('b').textContent = String(msg.score);
      if (msg.type === 'over' && playing) {
        playing = false; stage.classList.remove('playing'); overlay.classList.remove('hidden');
        resetOverlay(msg.score); submitPublishedScore(entry, msg.score, bestChip);
      }
      if (msg.type === 'runtime-error') {
        errorBox.textContent = `遊戲執行錯誤：${msg.message}`; errorBox.style.display = 'block';
        playing = false; stage.classList.remove('playing');
      }
    });
    runtime.send(mode);
  };
  const begin = () => {
    playing = true; previewing = false; scoreChip.querySelector('b').textContent = '0';
    overlay.classList.add('hidden'); stage.classList.add('playing'); spawn('start');
  };
  const startPreview = () => {
    if (playing || previewing) return;
    previewing = true; spawn('auto');
  };
  const stopAll = () => {
    if (gesture && runtime) runtime.send('input', { inputType: 'cancel', x: gesture.x, y: gesture.y });
    gesture = null; playing = false; previewing = false; stage.classList.remove('playing');
    destroyRuntime(); overlay.classList.remove('hidden'); resetOverlay();
  };

  function logical(event) {
    const r = inputLayer.getBoundingClientRect();
    return [(event.clientX - r.left) / r.width * 400, (event.clientY - r.top) / r.height * 700];
  }
  inputLayer.addEventListener('pointerdown', event => {
    try { inputLayer.setPointerCapture(event.pointerId); } catch (_) {}
    const [x, y] = logical(event);
    const gaveDown = !!(playing && runtime);
    gesture = {
      id: event.pointerId, x0: event.clientX, y0: event.clientY,
      x, y, claimed: false, swiped: false, gaveDown
    };
    if (gaveDown) runtime.send('input', { inputType: 'down', x, y });
  });
  inputLayer.addEventListener('pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x0, dy = event.clientY - gesture.y0;
    const [x, y] = logical(event); gesture.x = x; gesture.y = y;
    if (!gesture.claimed && !gesture.swiped) {
      if (Math.abs(dx) > 12 && Math.abs(dx) >= Math.abs(dy)) gesture.claimed = true;
      else if (Math.abs(dy) > 46 && Math.abs(dy) > Math.abs(dx) * 1.15) {
        gesture.swiped = true;
        if (gesture.gaveDown && runtime) runtime.send('input', { inputType: 'cancel', x, y });
        if (options.onSwipe) {
          options.onSwipe(dy < 0 ? 1 : -1);
          return;
        }
        const all = [...host.feed.querySelectorAll(':scope > .post')];
        const index = all.indexOf(post);
        const next = (index + (dy < 0 ? 1 : -1) + all.length) % all.length;
        all[next]?.scrollIntoView({ behavior: next === 0 ? 'auto' : 'smooth' });
        return;
      }
    }
    if (!gesture.swiped && gesture.gaveDown && runtime) runtime.send('input', { inputType: 'move', x, y });
  });
  const end = (event, cancelled) => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const [x, y] = logical(event);
    if (!gesture.swiped && gesture.gaveDown && runtime) {
      runtime.send('input', { inputType: cancelled ? 'cancel' : 'up', x, y });
    }
    gesture = null;
  };
  inputLayer.addEventListener('pointerup', event => end(event, false));
  inputLayer.addEventListener('pointercancel', event => end(event, true));

  like.addEventListener('click', () => host.toggleReaction(entry.id, 'like'));
  dislike.addEventListener('click', () => host.toggleReaction(entry.id, 'dislike'));
  save.addEventListener('click', () => host.toggleSave(entry.id));
  comment.addEventListener('click', () => host.openComments(entry));
  share.addEventListener('click', () => host.shareGame(entry));
  const record = {
    el: post, id: entry.id, entry, like, dislike, save,
    activate: startPreview,
    deactivate: stopAll,
    setReactions(count, mine, dislikeCount, disliked) {
      like.classList.toggle('liked', mine); like.querySelector('.lc').textContent = String(count);
      dislike.classList.toggle('disliked', disliked);
      dislike.querySelector('.dc').textContent = String(dislikeCount);
    },
    setSave(mine) { save.classList.toggle('saved', mine); }
  };
  if (!options.standalone) {
    publishedPosts.push(record);
    sandboxObserver.observe(post);
  }
  readPublishedBest(entry, bestChip);
  return record;
}

const sandboxObserver = new IntersectionObserver(entries => {
  for (const item of entries) {
    const post = publishedPosts.find(x => x.el === item.target);
    if (!post) continue;
    if (item.isIntersecting && item.intersectionRatio >= .5) post.activate();
    else post.deactivate();
  }
}, { threshold: [0, .5, 1] });

async function refreshPublishedInteractions() {
  if (!host.db || !publishedPosts.length) return;
  const ids = publishedPosts.map(x => x.entry.id);
  const reactionIds = ids.concat(ids.map(id => DISLIKE_PREFIX + id));
  const [{ data: likes }, savesResult] = await Promise.all([
    host.db.from('likes').select('game_id,user_id').in('game_id', reactionIds),
    host.user ? host.db.from('saves').select('game_id,user_id').in('game_id', ids).eq('user_id', host.user.id) : Promise.resolve({ data: [] })
  ]);
  for (const post of publishedPosts) {
    const upRows = (likes || []).filter(x => x.game_id === post.entry.id);
    const downRows = (likes || []).filter(x => x.game_id === DISLIKE_PREFIX + post.entry.id);
    post.setReactions(
      upRows.length,
      !!host.user && upRows.some(x => x.user_id === host.user.id),
      downRows.length,
      !!host.user && downRows.some(x => x.user_id === host.user.id)
    );
    post.setSave((savesResult.data || []).some(x => x.game_id === post.entry.id));
  }
}

function originalCreateExpression(game) {
  const source = Function.prototype.toString.call(game.create);
  return /^\s*(?:async\s+)?function\b/.test(source) ? source : `function ${source}`;
}

function officialSubmission(game) {
  const createExpression = originalCreateExpression(game);
  const metadata = {
    apiVersion: 1,
    gameVersion: 'official-1.0.0',
    id: game.id,
    title: game.title,
    description: game.tip,
    author: '@我',
    tip: game.tip,
    bg: game.bg,
    tags: ['official'],
    controls: ['tap'],
    score: { label: '分數', order: 'higher' },
    remixSlots: game.remixSlots || [],
  };
  const fields = Object.entries(metadata)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(',\n    ');
  const script = `window.GAMES = (window.GAMES || []).concat([{\n` +
    `    ${fields},\n` +
    `    create(env) {\n` +
    `      const W = env.W, H = env.H, beep = env.beep;\n` +
    `      const originalCreate = ${createExpression};\n` +
    `      return originalCreate(env);\n` +
    `    }\n` +
    `  }]);`;
  return {
    id: game.id,
    title: game.title,
    description: game.tip,
    tip: game.tip,
    tags: ['official'],
    controls: ['tap'],
    score: { label: '分數', order: 'higher' },
    remix_slots: game.remixSlots || [],
    script,
  };
}

async function syncOfficialGamesIfNeeded() {
  if (!publishedLoadComplete) return false;
  const officialIds = new Set((window.GAMES || []).map(game => game.id));
  const existing = new Set(publishedRows.filter(row => officialIds.has(row.slug)).map(row => row.slug));
  if (existing.size === officialIds.size) return false;
  if (!host.user || !host.db || officialSyncPromise) return false;
  officialSyncPromise = (async () => {
    try {
      const games = (window.GAMES || []).map(officialSubmission);
      await host.secureWrite('sync-official-games', { games });
      location.reload();
      return true;
    } catch (error) {
      host.toast(`官方遊戲同步失敗：${error.message || error}`);
      host.finishBoot();
      return false;
    }
  })();
  return officialSyncPromise;
}

async function loadPublishedGames() {
  if (!host.db) { host.finishBoot(); return; }
  const [nativeResult, legacyResult] = await Promise.all([
    host.db.from('user_games')
      .select('*').eq('status', 'published').order('created_at', { ascending: false }),
    host.db.from('remixes')
      .select('*').eq('base_id', LEGACY_BASE_ID).order('created_at', { ascending: false })
  ]);
  if (nativeResult.error) console.warn('PlayFeed 新版投稿載入失敗', nativeResult.error);
  if (legacyResult.error) console.warn('PlayFeed 舊版投稿載入失敗', legacyResult.error);

  const nativeRows = nativeResult.data || [];
  const legacyRows = (legacyResult.data || []).map(legacyRowToPublished).filter(Boolean);
  const rows = [];
  const seenSlugs = new Set();
  const newestFirst = [...nativeRows, ...legacyRows].sort((a, b) =>
    new Date(b.created_at || 0) - new Date(a.created_at || 0)
  );
  for (const row of newestFirst) {
    if (!row.slug || seenSlugs.has(row.slug)) continue;
    seenSlugs.add(row.slug);
    rows.push(row);
  }
  const ownerRow = rows
    .filter(row => row.author_id)
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))[0];
  if (ownerRow) host.registerOfficialOwner(ownerRow.author_id, ownerRow.author_name || '我');
  for (const row of rows) {
    publishedRows.push(row);
  }
  publishedLoadComplete = true;
  for (const row of [...rows].reverse()) {
    addSandboxPost(row);
  }
  refreshPublishedInteractions();
  host.refreshProfile();
  goToPublishedHash();
  const synchronized = await syncOfficialGamesIfNeeded();
  if (!synchronized) {
    if (!location.hash) host.feed.scrollTop = 0;
    host.finishBoot();
  }
}

function goToPublishedHash() {
  if (!location.hash) return;
  const id = decodeURIComponent(location.hash.slice(1));
  const normalizedId = id.startsWith('game:') ? id : `game:${id}`;
  const target = publishedPosts.find(post => post.entry.id === normalizedId);
  if (target) setTimeout(() => target.el.scrollIntoView(), 80);
}

const publishedThumbnailJobs = new Map();
function capturePublishedThumbnail(id) {
  const slug = id.startsWith('game:') ? id.slice(5) : id;
  const row = publishedRows.find(item => item.slug === slug);
  if (!row) return Promise.resolve(null);
  if (row.screenshot) return Promise.resolve(row.screenshot);
  if (publishedThumbnailJobs.has(slug)) return publishedThumbnailJobs.get(slug);
  const job = new Promise(resolve => {
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:400px;height:700px;overflow:hidden;';
    document.body.appendChild(holder);
    let settled = false;
    let runtime = null;
    const finish = image => {
      if (settled) return;
      settled = true;
      runtime?.destroy();
      holder.remove();
      if (image) row.screenshot = image;
      resolve(image || null);
    };
    runtime = createRuntime(holder, row.script, row.duration, msg => {
      if (msg.type === 'ready') {
        runtime.send('auto');
        setTimeout(() => runtime?.send('capture'), 900);
      } else if (msg.type === 'capture') {
        finish(msg.image);
      } else if (msg.type === 'runtime-error') {
        finish(null);
      }
    });
    setTimeout(() => finish(null), 2800);
  });
  publishedThumbnailJobs.set(slug, job);
  return job;
}

window.PlayFeedCreator = {
  open: openCreator,
  openMechanic: openMechanicCreator,
  close: closeCreator,
  validateScript,
  captureThumbnail: capturePublishedThumbnail,
  refreshAuthors: refreshPublishedAuthors,
  refreshInteractions: refreshPublishedInteractions,
  syncOfficialGames: syncOfficialGamesIfNeeded,
  resumePreview(id) {
    const post = publishedPosts.find(item => item.entry.id === id);
    if (post) setTimeout(() => post.activate(), 40);
  },
  mountStandalone(id, container, onSwipe) {
    const slug = id.startsWith('game:') ? id.slice(5) : id;
    const row = publishedRows.find(item => item.slug === slug);
    if (!row) return null;
    const record = addSandboxPost(row, { container, onSwipe, standalone: true });
    record.activate();
    return record;
  },
  entryFor(id) {
    const slug = id.startsWith('game:') ? id.slice(5) : id;
    const row = publishedRows.find(item => item.slug === slug);
    if (!row) return null;
    return {
      id: `game:${row.slug}`,
      title: row.title,
      bg: row.bg,
      screenshot: row.screenshot,
      authorId: row.author_id,
      authorName: row.author_name || '玩家',
      userScript: true
    };
  },
  profileEntries(userId) {
    return publishedRows.filter(row => row.author_id === userId).map(row => ({
      id: `game:${row.slug}`,
      title: row.title,
      bg: row.bg,
      screenshot: row.screenshot,
      authorId: row.author_id,
      authorName: row.author_name || '玩家',
      userScript: true
    }));
  },
  rows: publishedRows
};

loadPublishedGames();
window.addEventListener('hashchange', goToPublishedHash);
