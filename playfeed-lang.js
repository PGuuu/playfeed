const HEADER = /^\s*playfeed\s+1\s*(?:\r?\n|$)/i;
const MODES = new Set(['flow', 'catcher', 'region-grid']);

function fail(message) {
  throw new Error(`PlayFeed Language：${message}`);
}

function cleanText(value, name, max) {
  if (typeof value !== 'string' || !value.trim()) fail(`${name} 必須是文字。`);
  if (value.length > max) fail(`${name} 不可超過 ${max} 個字元。`);
  return value;
}

function cleanNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function normaliseRemix(items) {
  if (!Array.isArray(items) || items.length === 0) fail('remix 至少要有一個可換皮元素。');
  const seen = new Set();
  return items.map((item, index) => {
    if (!item || typeof item !== 'object') fail(`remix 第 ${index + 1} 項格式錯誤。`);
    const key = cleanText(item.key, 'remix.key', 40);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) fail(`remix.key「${key}」格式錯誤。`);
    if (seen.has(key)) fail(`remix.key「${key}」重複。`);
    seen.add(key);
    const shape = item.shape || 'free';
    if (!['free', 'circle', 'wide', 'tall'].includes(shape)) fail(`remix「${key}」的 shape 無效。`);
    return {
      key,
      label: cleanText(item.label, 'remix.label', 50),
      hint: cleanText(item.hint, 'remix.hint', 100),
      default: String(item.default || item.label),
      shape,
    };
  });
}

function normaliseSpec(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('主體必須是一個 JSON 物件。');
  const meta = input.meta || {};
  const mode = input.mode;
  if (!MODES.has(mode)) fail(`mode 必須是 ${[...MODES].join('、')} 之一。`);
  const controls = Array.isArray(meta.controls) && meta.controls.length
    ? meta.controls.map(String)
    : ['tap'];
  if (controls.some(value => /vertical|up-down|swipe-up|swipe-down/i.test(value))) {
    fail('controls 不可使用垂直手勢。');
  }
  const preview = input.preview || 'cover';
  if (!['cover', 'demo'].includes(preview)) fail('preview 只能是 cover 或 demo。');
  const score = meta.score || { label: '結果', order: 'higher', decimals: 0 };
  if (!score || typeof score.label !== 'string' || !['higher', 'lower'].includes(score.order)) {
    fail('meta.score 必須包含 label 與 higher／lower order。');
  }
  const spec = {
    languageVersion: 1,
    mode,
    preview,
    meta: {
      apiVersion: 1,
      gameVersion: String(meta.gameVersion || '1.0.0'),
      id: cleanText(meta.id, 'meta.id', 80),
      title: cleanText(meta.title, 'meta.title', 80),
      description: cleanText(meta.description, 'meta.description', 240),
      author: String(meta.author || '@draft-only'),
      tip: cleanText(meta.tip, 'meta.tip', 160),
      bg: String(meta.bg || '#18354a'),
      tags: Array.isArray(meta.tags) ? meta.tags.map(String).slice(0, 12) : [],
      controls,
      duration: Math.round(cleanNumber(meta.duration, 45, 1, 600)),
      score: {
        label: score.label,
        order: score.order,
        decimals: Number.isInteger(score.decimals) ? score.decimals : 0,
      },
    },
    remix: normaliseRemix(input.remix),
  };
  const remixKeys = new Set(spec.remix.map(item => item.key));
  if (!/^#[0-9a-f]{3,8}$/i.test(spec.meta.bg)) fail('meta.bg 必須是十六進位色碼。');

  if (mode === 'flow') {
    const flow = input.flow || {};
    if (!Array.isArray(flow.scenes) || flow.scenes.length === 0) fail('flow.scenes 至少要有一個場景。');
    if (flow.scenes.length > 30) fail('flow.scenes 最多 30 個場景。');
    const ids = new Set();
    for (const scene of flow.scenes) {
      if (!scene || typeof scene !== 'object') fail('每個 scene 都必須是物件。');
      const id = cleanText(scene.id, 'scene.id', 50);
      if (ids.has(id)) fail(`scene.id「${id}」重複。`);
      ids.add(id);
    }
    const data = flow.data && typeof flow.data === 'object' && !Array.isArray(flow.data) ? flow.data : {};
    const validateActions = (actions, label) => {
      if (!Array.isArray(actions)) fail(`${label} 必須是 action 陣列。`);
      if (actions.length > 12) fail(`${label} 最多 12 個 action。`);
      for (const action of actions) {
        if (!action || typeof action !== 'object' || Array.isArray(action)) fail(`${label} 內含無效 action。`);
        const known = ['set', 'random', 'go', 'score', 'end'].filter(key => action[key] !== undefined);
        if (known.length !== 1) fail(`${label} 的每個 action 必須且只能使用 set、random、go、score、end 其中一種。`);
        if (action.go !== undefined && !ids.has(String(action.go))) fail(`${label} 的 go 找不到場景「${action.go}」。`);
        if (action.random !== undefined) {
          const random = action.random;
          if (!random || typeof random !== 'object' || typeof random.target !== 'string' ||
              !Array.isArray(data[random.from]) || data[random.from].length === 0) {
            fail(`${label} 的 random 必須指定 target 與非空的 data 陣列。`);
          }
        }
        if (action.set !== undefined && (!action.set || typeof action.set !== 'object' || Array.isArray(action.set))) {
          fail(`${label} 的 set 必須是物件。`);
        }
        if (action.score !== undefined && !Number.isFinite(Number(action.score))) fail(`${label} 的 score 必須是數字。`);
        if (action.end !== undefined && typeof action.end !== 'string' && !Number.isFinite(Number(action.end))) {
          fail(`${label} 的 end 必須是分數或狀態變數名稱。`);
        }
      }
    };
    for (const scene of flow.scenes) {
      for (const key of ['title', 'text', 'hint']) {
        if (scene[key] !== undefined && typeof scene[key] !== 'string') fail(`scene.${key} 必須是文字。`);
      }
      if (scene.visual !== undefined) {
        if (!scene.visual || typeof scene.visual !== 'object' || Array.isArray(scene.visual)) fail('scene.visual 必須是物件。');
        if (scene.visual.remix && !remixKeys.has(scene.visual.remix)) {
          fail(`scene.visual.remix 找不到「${scene.visual.remix}」。`);
        }
      }
      if (scene.hold !== undefined) {
        const hold = scene.hold;
        if (!hold || typeof hold !== 'object' || Array.isArray(hold)) fail('scene.hold 必須是物件。');
        if (hold.effect !== undefined && hold.effect !== 'page-flip') fail('scene.hold.effect 目前只支援 page-flip。');
        if (hold.minSeconds !== undefined && !(Number(hold.minSeconds) >= 0 && Number(hold.minSeconds) <= 10)) {
          fail('scene.hold.minSeconds 必須介於 0 到 10 秒。');
        }
        if (hold.phraseSeconds !== undefined && !(Number(hold.phraseSeconds) >= .25 && Number(hold.phraseSeconds) <= 5)) {
          fail('scene.hold.phraseSeconds 必須介於 0.25 到 5 秒。');
        }
        for (const key of ['label', 'activeLabel', 'shortLabel', 'phraseColor', 'buttonColor', 'glow']) {
          if (hold[key] !== undefined && typeof hold[key] !== 'string') fail(`scene.hold.${key} 必須是文字。`);
        }
        if (hold.phrases !== undefined) {
          if (!Array.isArray(hold.phrases) || hold.phrases.length < 1 || hold.phrases.length > 30 ||
              hold.phrases.some(phrase => typeof phrase !== 'string' || !phrase.trim() || phrase.length > 80)) {
            fail('scene.hold.phrases 必須是一至三十句、每句不超過 80 字的文字陣列。');
          }
        }
      }
      if (scene.on !== undefined) {
        if (!scene.on || typeof scene.on !== 'object' || Array.isArray(scene.on)) fail('scene.on 必須是物件。');
        for (const [eventName, actions] of Object.entries(scene.on)) {
          if (!['down', 'tap', 'release'].includes(eventName)) fail(`scene.on 不支援「${eventName}」。`);
          validateActions(actions, `scene「${scene.id}」的 on.${eventName}`);
        }
      }
      if (scene.choices !== undefined) {
        if (!Array.isArray(scene.choices) || scene.choices.length < 1 || scene.choices.length > 2) {
          fail(`scene「${scene.id}」的 choices 必須有一至兩項。`);
        }
        scene.choices.forEach((choice, index) => {
          if (!choice || typeof choice !== 'object') fail(`scene「${scene.id}」的 choice ${index + 1} 無效。`);
          cleanText(choice.label, 'choice.label', 50);
          validateActions(choice.actions, `scene「${scene.id}」的 choice「${choice.label}」`);
        });
      }
    }
    spec.flow = {
      initial: String(flow.initial || flow.scenes[0].id),
      data,
      scenes: flow.scenes,
    };
    if (!ids.has(spec.flow.initial)) fail('flow.initial 找不到對應場景。');
  } else if (mode === 'catcher') {
    const catcher = input.catcher || {};
    if (!Array.isArray(catcher.items) || catcher.items.length === 0) fail('catcher.items 至少要有一項。');
    if (catcher.items.length > 20) fail('catcher.items 最多 20 項。');
    const player = catcher.player || {};
    if (player.remix && !remixKeys.has(player.remix)) fail(`catcher.player.remix 找不到「${player.remix}」。`);
    catcher.items.forEach((item, index) => {
      if (!item || typeof item !== 'object') fail(`catcher.items 第 ${index + 1} 項無效。`);
      if (item.remix && !remixKeys.has(item.remix)) fail(`catcher.items 第 ${index + 1} 項的 remix 找不到「${item.remix}」。`);
      if (typeof item.label !== 'string') fail(`catcher.items 第 ${index + 1} 項需要 label。`);
      if (item.every !== undefined && !(Number(item.every) > 0)) fail(`catcher.items 第 ${index + 1} 項的 every 必須大於 0。`);
      if (item.speed !== undefined && !(Number(item.speed) > 0)) fail(`catcher.items 第 ${index + 1} 項的 speed 必須大於 0。`);
    });
    spec.catcher = {
      duration: cleanNumber(catcher.duration, 45, 5, 600),
      lives: Math.round(cleanNumber(catcher.lives, 3, 1, 99)),
      player,
      items: catcher.items,
    };
  } else {
    const grid = input.grid || {};
    const rows = Math.round(cleanNumber(grid.rows, 5, 2, 12));
    const cols = Math.round(cleanNumber(grid.cols, 5, 2, 12));
    if (!Array.isArray(grid.clues) || grid.clues.length === 0) fail('grid.clues 至少要有一項。');
    if (grid.clues.length > rows * cols) fail('grid.clues 數量不可超過格子數。');
    const positions = new Set();
    for (const clue of grid.clues) {
      if (!Number.isInteger(clue.r) || !Number.isInteger(clue.c) || !Number.isInteger(clue.n) ||
          clue.r < 0 || clue.r >= rows || clue.c < 0 || clue.c >= cols || clue.n < 1 || clue.n > rows * cols) {
        fail('grid.clues 的 r、c、n 無效。');
      }
      const position = `${clue.r}:${clue.c}`;
      if (positions.has(position)) fail(`grid.clues 的座標 ${position} 重複。`);
      positions.add(position);
    }
    spec.grid = { rows, cols, clues: grid.clues, palette: grid.palette || [] };
  }
  return spec;
}

function flowEngine(env, spec) {
  const ctx = env.ctx, W = env.W, H = env.H;
  let alive = false, raf = 0, sceneId = spec.flow.initial, held = false, time = 0;
  let holdStarted = 0, holdNudgeUntil = 0;
  let state = {}, lastResult = 0;
  const scenes = {};
  for (const scene of spec.flow.scenes) scenes[scene.id] = scene;

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr); ctx.closePath();
  }
  function textValue(value) {
    return String(value == null ? '' : value).replace(/\{\{([A-Za-z0-9_-]+)\}\}/g, (_, key) =>
      state[key] == null ? '' : String(state[key]));
  }
  function wrap(text, x, y, maxWidth, lineHeight, maxLines) {
    const chars = Array.from(textValue(text)); let line = '', lines = [];
    for (const char of chars) {
      const test = line + char;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = char; }
      else line = test;
    }
    if (line) lines.push(line);
    if (maxLines && lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…';
    }
    lines.forEach((lineText, index) => ctx.fillText(lineText, x, y + index * lineHeight));
  }
  function run(actions) {
    for (const action of Array.isArray(actions) ? actions : []) {
      if (action.set && typeof action.set === 'object') {
        for (const key in action.set) state[key] = action.set[key];
      }
      if (action.random) {
        const values = spec.flow.data[action.random.from];
        if (Array.isArray(values) && values.length) {
          const index = Math.floor(Math.random() * values.length);
          state[action.random.target] = values[index];
          state[`${action.random.target}Index`] = index + 1;
          lastResult = index + 1;
        }
      }
      if (action.go && scenes[action.go]) sceneId = action.go;
      if (action.score != null) {
        lastResult = Number(action.score) || 0;
        env.setScore(lastResult);
      }
      if (action.end != null) {
        const value = typeof action.end === 'string' ? state[action.end] : action.end;
        const result = Number(value) || lastResult || 1;
        alive = false; cancelAnimationFrame(raf); env.over(result); return;
      }
    }
  }
  function event(name) {
    const scene = scenes[sceneId];
    if (!scene) return;
    run(scene.on && scene.on[name]);
  }
  function drawVisual(scene) {
    const visual = scene.visual || {};
    const x = Number(visual.x) || W / 2, y = Number(visual.y) || H * .52;
    const size = Number(visual.size) || 170;
    const pageFlip = held && scene.hold && scene.hold.effect === 'page-flip';
    ctx.save();
    const pulse = 1 + Math.sin(time * .035) * (held ? .045 : .018);
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);
    if (pageFlip) ctx.rotate(Math.sin(time * .28) * .025);
    ctx.translate(-x, -y);
    if (visual.remix && env.sprite(visual.remix, x, y, size)) { ctx.restore(); return; }
    ctx.shadowColor = visual.glow || '#91f5ff'; ctx.shadowBlur = held ? 34 : 15;
    if (pageFlip) {
      const flip = (Math.sin(time * .42) + 1) / 2;
      for (let page = 3; page >= 1; page--) {
        const offset = page * 4 + flip * page * 2;
        ctx.fillStyle = `rgba(255,248,218,${.16 + page * .09})`;
        roundRect(
          x - size * .42 + offset,
          y - size * .3 - offset * .35,
          size * .84,
          size * .6,
          18
        );
        ctx.fill();
      }
    }
    ctx.fillStyle = visual.color || '#f4d58d';
    if (visual.shape === 'circle') {
      ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2); ctx.fill();
    } else {
      roundRect(x - size * .42, y - size * .3, size * .84, size * .6, 18); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.42)';
      roundRect(x - size * .34, y - size * .22, size * .68, size * .08, 4); ctx.fill();
    }
    ctx.restore();
  }
  function drawHold(scene) {
    const hold = scene.hold;
    if (!hold || typeof hold !== 'object') return;
    const phrases = Array.isArray(hold.phrases) ? hold.phrases : [];
    if (held && phrases.length) {
      const phraseFrames = Math.max(18, (Number(hold.phraseSeconds) || .72) * 60);
      const cycle = time - holdStarted;
      const phrase = phrases[Math.floor(cycle / phraseFrames) % phrases.length];
      const phase = (cycle % phraseFrames) / phraseFrames;
      const alpha = Math.max(0, Math.sin(Math.PI * phase)) * .72;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = hold.phraseColor || '#fff8cf';
      ctx.font = '700 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = hold.glow || '#8ce8ff';
      ctx.shadowBlur = 16;
      wrap(phrase, W / 2, 258 - Math.sin(Math.PI * phase) * 9, W - 72, 22, 2);
      ctx.restore();
    }

    const nudging = time < holdNudgeUntil;
    const label = nudging
      ? (hold.shortLabel || '再按久一點')
      : held
        ? (hold.activeLabel || '正在翻閱…')
        : (hold.label || '按住');
    const width = Math.min(W - 60, Number(hold.buttonWidth) || 270);
    const x = (W - width) / 2, y = H - 132;
    ctx.save();
    ctx.shadowColor = nudging ? '#ff8d8d' : (hold.glow || '#8ce8ff');
    ctx.shadowBlur = held || nudging ? 28 : 18 + Math.sin(time * .09) * 7;
    ctx.fillStyle = held ? 'rgba(255,248,207,.96)' : 'rgba(15,20,46,.88)';
    roundRect(x, y, width, 64, 32); ctx.fill();
    ctx.lineWidth = nudging ? 4 : 3;
    ctx.strokeStyle = nudging ? '#ff8d8d' : (hold.buttonColor || '#fff0a6');
    roundRect(x, y, width, 64, 32); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = held ? '#1a1d34' : '#fff';
    ctx.font = '900 17px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, W / 2, y + 39);
    ctx.restore();
  }
  function draw() {
    if (!alive) return;
    time++;
    const scene = scenes[sceneId] || scenes[spec.flow.initial];
    const bg = scene.background || spec.meta.bg;
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, bg); gradient.addColorStop(1, scene.backgroundEnd || '#101426');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H);
    drawVisual(scene);
    drawHold(scene);
    ctx.textAlign = 'center';
    ctx.fillStyle = scene.titleColor || '#fff';
    ctx.font = `800 ${Number(scene.titleSize) || 28}px sans-serif`;
    wrap(scene.title || spec.meta.title, W / 2, 92, W - 56, 34, 3);
    ctx.fillStyle = scene.textColor || 'rgba(255,255,255,.92)';
    ctx.font = `600 ${Number(scene.textSize) || 17}px sans-serif`;
    wrap(scene.text || '', W / 2, 155, W - 72, 28, 6);
    const choices = Array.isArray(scene.choices) ? scene.choices.slice(0, 2) : [];
    if (choices.length) {
      choices.forEach((choice, index) => {
        const width = choices.length === 1 ? 250 : 172;
        const x = choices.length === 1 ? (W - width) / 2 : 18 + index * 192;
        ctx.fillStyle = 'rgba(255,255,255,.9)'; roundRect(x, H - 126, width, 72, 17); ctx.fill();
        ctx.fillStyle = '#182235'; ctx.font = '800 15px sans-serif';
        wrap(choice.label, x + width / 2, H - 89, width - 22, 19, 2);
      });
    }
    ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.font = '600 12px sans-serif';
    ctx.fillText(textValue(scene.hint || spec.meta.tip), W / 2, H - 24);
    raf = requestAnimationFrame(draw);
  }
  function start() {
    cancelAnimationFrame(raf); alive = true; held = false; time = 0;
    holdStarted = 0; holdNudgeUntil = 0;
    sceneId = spec.flow.initial; state = {}; lastResult = 0; env.setScore(0); draw();
  }
  function stop() { alive = false; held = false; holdStarted = 0; cancelAnimationFrame(raf); }
  function input(type, x) {
    if (!alive) return;
    if (type === 'cancel') { held = false; holdStarted = 0; return; }
    if (type === 'down') { held = true; holdStarted = time; holdNudgeUntil = 0; event('down'); }
    if (type === 'up') {
      const scene = scenes[sceneId] || {};
      const heldFrames = Math.max(0, time - holdStarted);
      held = false;
      if (scene.hold && heldFrames < (Number(scene.hold.minSeconds) || 0) * 60) {
        holdNudgeUntil = time + 60;
        return;
      }
      const choices = Array.isArray(scene.choices) ? scene.choices.slice(0, 2) : [];
      if (choices.length) {
        const choice = choices.length === 1 ? choices[0] : choices[x < W / 2 ? 0 : 1];
        run(choice.actions || []);
      } else if (scene.on && scene.on.release) {
        event('release');
      } else {
        event('tap');
      }
    }
  }
  return { start, stop, input };
}

function catcherEngine(env, spec) {
  const ctx = env.ctx, W = env.W, H = env.H, config = spec.catcher;
  let alive = false, raf = 0, last = 0, elapsed = 0, score = 0, lives = config.lives;
  let playerX = W / 2, dragging = false, objects = [], spawnClock = [];
  const player = config.player || {};
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function spawn(item, index) {
    const size = Number(item.size) || 34;
    objects.push({
      type: index, x: size + Math.random() * (W - size * 2), y: -size,
      size, speed: Number(item.speed) || 220,
    });
  }
  function drawEntity(key, fallback, x, y, size, color) {
    if (key && env.sprite(key, x, y, size)) return;
    ctx.fillStyle = color || '#ffd65a'; ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#382d16'; ctx.font = `800 ${Math.max(13, size * .42)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(fallback || '●', x, y);
  }
  function finish() { if (!alive) return; alive = false; cancelAnimationFrame(raf); env.over(score); }
  function update(dt) {
    elapsed += dt;
    config.items.forEach((item, index) => {
      spawnClock[index] -= dt;
      if (spawnClock[index] <= 0) {
        spawn(item, index);
        spawnClock[index] = Math.max(.12, Number(item.every) || .8);
      }
    });
    const pw = Number(player.width) || 82, ph = Number(player.height) || 42;
    for (let index = objects.length - 1; index >= 0; index--) {
      const object = objects[index], item = config.items[object.type];
      object.y += object.speed * dt * (1 + elapsed / Math.max(20, config.duration) * .35);
      if (Math.abs(object.x - playerX) < pw / 2 + object.size / 2 &&
          Math.abs(object.y - (H - 100)) < ph / 2 + object.size / 2) {
        if (item.danger) {
          lives--; env.beep(220, 70, .18, .12, 'sawtooth');
        } else {
          score += Number(item.points) || 1; env.setScore(score); env.beep(650, 1050, .08, .08, 'sine');
        }
        objects.splice(index, 1);
      } else if (object.y > H + object.size) {
        if (item.missLife) lives--;
        objects.splice(index, 1);
      }
    }
    if (elapsed >= config.duration || lives <= 0) finish();
  }
  function draw() {
    ctx.fillStyle = spec.meta.bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.13)';
    for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.arc((i * 83 + elapsed * 12) % W, 75 + i * 49, 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,.35)'; roundRect(18, 18, W - 36, 62, 16); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '800 17px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`${spec.meta.score.label} ${score}`, 38, 49);
    ctx.textAlign = 'right'; ctx.fillText(`♥ ${lives}   ${Math.max(0, Math.ceil(config.duration - elapsed))}s`, W - 38, 49);
    for (const object of objects) {
      const item = config.items[object.type];
      drawEntity(item.remix, item.label, object.x, object.y, object.size, item.color);
    }
    const pw = Number(player.width) || 82, ph = Number(player.height) || 42, py = H - 100;
    if (!(player.remix && env.sprite(player.remix, playerX, py, Math.max(pw, ph)))) {
      ctx.fillStyle = player.color || '#65e0d0'; roundRect(playerX - pw / 2, py - ph / 2, pw, ph, 14); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,.82)'; ctx.font = '600 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(spec.meta.tip, W / 2, H - 28);
  }
  function loop(now) {
    if (!alive) return;
    const dt = last ? Math.min(.033, (now - last) / 1000) : 0; last = now;
    update(dt); draw(); if (alive) raf = requestAnimationFrame(loop);
  }
  function start() {
    cancelAnimationFrame(raf); alive = true; last = 0; elapsed = 0; score = 0; lives = config.lives;
    playerX = W / 2; dragging = false; objects = []; spawnClock = config.items.map(() => .25 + Math.random() * .5);
    env.setScore(0); raf = requestAnimationFrame(loop);
  }
  function stop() { alive = false; dragging = false; cancelAnimationFrame(raf); }
  function input(type, x) {
    if (type === 'cancel') { dragging = false; return; }
    if (!alive) return;
    if (type === 'down') dragging = true;
    if ((type === 'down' || type === 'move') && dragging) playerX = clamp(x, 35, W - 35);
    if (type === 'up') { playerX = clamp(x, 35, W - 35); dragging = false; }
  }
  return { start, stop, input };
}

function regionGridEngine(env, spec) {
  const ctx = env.ctx, W = env.W, H = env.H, config = spec.grid;
  let alive = false, raf = 0, selected = null, regions = [], moves = 0, flash = '';
  const colors = config.palette.length ? config.palette : ['#ffd166', '#80ed99', '#72ddf7', '#cdb4db', '#ff9b85'];
  const boardSize = Math.min(W - 40, 420), cell = boardSize / config.cols;
  const left = (W - boardSize) / 2, boardTop = 170;
  function cellAt(x, y) {
    const c = Math.floor((x - left) / cell), r = Math.floor((y - boardTop) / cell);
    return r >= 0 && r < config.rows && c >= 0 && c < config.cols ? { r, c } : null;
  }
  function occupied(r, c) {
    return regions.some(region => r >= region.r1 && r <= region.r2 && c >= region.c1 && c <= region.c2);
  }
  function tryRegion(a, b) {
    const r1 = Math.min(a.r, b.r), r2 = Math.max(a.r, b.r), c1 = Math.min(a.c, b.c), c2 = Math.max(a.c, b.c);
    const area = (r2 - r1 + 1) * (c2 - c1 + 1);
    const clues = config.clues.filter(clue => clue.r >= r1 && clue.r <= r2 && clue.c >= c1 && clue.c <= c2);
    let blocked = false;
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (occupied(r, c)) blocked = true;
    moves++;
    if (!blocked && clues.length === 1 && clues[0].n === area) {
      regions.push({ r1, r2, c1, c2, color: colors[regions.length % colors.length] });
      flash = `正確 · ${area} 格`; env.beep(620, 980, .1, .08, 'sine');
      const filled = regions.reduce((sum, region) => sum + (region.r2 - region.r1 + 1) * (region.c2 - region.c1 + 1), 0);
      const score = Math.max(1, 1000 - moves * 10); env.setScore(score);
      if (filled === config.rows * config.cols) {
        alive = false; cancelAnimationFrame(raf); env.over(score);
      }
    } else {
      flash = blocked ? '這些格子已經使用' : '面積或提示數字不符合';
      env.beep(260, 140, .12, .08, 'square');
    }
  }
  function draw() {
    if (!alive) return;
    ctx.fillStyle = spec.meta.bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '900 28px sans-serif';
    ctx.fillText(spec.meta.title, W / 2, 72);
    ctx.fillStyle = 'rgba(255,255,255,.78)'; ctx.font = '600 14px sans-serif';
    ctx.fillText('點兩個角，框出符合數字面積的長方形', W / 2, 108);
    for (const region of regions) {
      ctx.fillStyle = region.color;
      ctx.fillRect(left + region.c1 * cell + 2, boardTop + region.r1 * cell + 2,
        (region.c2 - region.c1 + 1) * cell - 4, (region.r2 - region.r1 + 1) * cell - 4);
      const remixKey = spec.remix[0] && spec.remix[0].key;
      if (remixKey) {
        env.sprite(
          remixKey,
          left + (region.c1 + region.c2 + 1) * cell / 2,
          boardTop + (region.r1 + region.r2 + 1) * cell / 2,
          Math.min(34, cell * .48)
        );
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1;
    for (let r = 0; r <= config.rows; r++) { ctx.beginPath(); ctx.moveTo(left, boardTop + r * cell); ctx.lineTo(left + boardSize, boardTop + r * cell); ctx.stroke(); }
    for (let c = 0; c <= config.cols; c++) { ctx.beginPath(); ctx.moveTo(left + c * cell, boardTop); ctx.lineTo(left + c * cell, boardTop + boardSize); ctx.stroke(); }
    if (selected) {
      ctx.strokeStyle = '#fff36a'; ctx.lineWidth = 4;
      ctx.strokeRect(left + selected.c * cell + 3, boardTop + selected.r * cell + 3, cell - 6, cell - 6);
    }
    ctx.fillStyle = '#16243a'; ctx.font = `900 ${Math.max(16, cell * .3)}px sans-serif`;
    for (const clue of config.clues) ctx.fillText(String(clue.n), left + (clue.c + .5) * cell, boardTop + (clue.r + .61) * cell);
    ctx.fillStyle = '#fff'; ctx.font = '700 14px sans-serif';
    ctx.fillText(flash || spec.meta.tip, W / 2, boardTop + boardSize + 58);
    raf = requestAnimationFrame(draw);
  }
  function start() {
    cancelAnimationFrame(raf); alive = true; selected = null; regions = []; moves = 0; flash = '';
    env.setScore(0); draw();
  }
  function stop() { alive = false; selected = null; cancelAnimationFrame(raf); }
  function input(type, x, y) {
    if (type === 'cancel') { selected = null; return; }
    if (!alive || type !== 'down') return;
    const current = cellAt(x, y); if (!current) return;
    if (!selected) { selected = current; flash = '再點另一個角'; }
    else { const first = selected; selected = null; tryRegion(first, current); }
  }
  return { start, stop, input };
}

const ENGINES = {
  flow: flowEngine,
  catcher: catcherEngine,
  'region-grid': regionGridEngine,
};

export function isPlayFeedLanguage(source) {
  return HEADER.test(String(source || ''));
}

export function parsePlayFeedLanguage(source) {
  const text = String(source || '');
  if (!HEADER.test(text)) fail('開頭必須是 playfeed 1。');
  const body = text.replace(HEADER, '').trim();
  if (!body) fail('缺少 JSON 主體。');
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    fail(`JSON 語法錯誤：${error.message}`);
  }
  return normaliseSpec(parsed);
}

export function compilePlayFeedLanguage(source) {
  const spec = parsePlayFeedLanguage(source);
  const engine = ENGINES[spec.mode];
  const meta = spec.meta;
  const registration = {
    apiVersion: 1,
    gameVersion: meta.gameVersion,
    id: meta.id,
    title: meta.title,
    description: meta.description,
    author: meta.author,
    tip: meta.tip,
    bg: meta.bg,
    tags: meta.tags,
    controls: meta.controls,
    preview: spec.preview,
    duration: meta.duration,
    score: meta.score,
    remixSlots: spec.remix,
  };
  const fields = Object.entries(registration)
    .map(([key, value]) => `    ${key}: ${JSON.stringify(value)}`)
    .join(',\n');
  const original = String(source).replace(/\*\//g, '* /');
  const compiled = `/* PlayFeed Language v1 source:\n${original}\n*/\n` +
`window.GAMES = (window.GAMES || []).concat([{\n${fields},\n` +
`    create(env) {\n` +
`      const spec = ${JSON.stringify(spec)};\n` +
`      const makeEngine = ${engine.toString()};\n` +
`      const engine = makeEngine(env, spec);\n` +
`      function start() { engine.start(); }\n` +
`      function stop() { engine.stop(); }\n` +
`      function input(type, x, y) { if (type === 'cancel') { engine.input('cancel', x, y); return; } engine.input(type, x, y); }\n` +
`      return { start, stop, input };\n` +
`    }\n` +
`  }]);`;
  return { source: compiled, spec };
}
