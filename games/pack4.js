/* PlayFeed 遊戲包 pack4 — 小雞過馬路（Crossy Road 式無盡跳格）
   互動：純點按。點中間往前跳、點左右兩側橫移（無任何滑動手勢，符合遊戲規範）。
*/
window.GAMES = (window.GAMES || []).concat([

{
  id: 'crossy-chicken', title: '小雞過馬路：能過幾條是幾條', author: '@馬路安全宣導大使', tip: '點中間往前跳、點左右兩側橫移，發呆太久會被老鷹抓走', bg: '#7ec850',
  remixSlots: [
    { key: 'player', label: '主角小雞', hint: '你的角色，在最下面跳', default: '🐔', shape: 'free' },
    { key: 'car',    label: '車子',     hint: '路上會撞死你的車',     default: '🚗', shape: 'wide' },
    { key: 'tree',   label: '樹',       hint: '草地上的障礙物',       default: '🌳', shape: 'free' },
    { key: 'eagle',  label: '老鷹',     hint: '發呆太久會俯衝抓你',   default: '🦅', shape: 'free' }
  ],
  create(env) {
    const { ctx, setScore, over } = env;
    const W = env.W, H = env.H;
    /* 可換圖元素：有上傳圖片就畫圖，否則畫預設 emoji */
    function spr(key, emoji, cx, cy, size, flip) {
      if (env.sprite && env.sprite(key, cx, cy, size, flip)) return;
      ctx.save(); ctx.translate(cx, cy); if (flip) ctx.scale(-1, 1);
      ctx.font = size + 'px serif'; ctx.fillText(emoji, 0, 0);
      ctx.restore();
    }
    const T = 58, NC = 6, CW = W / NC, BASE = H - 190;
    const CAR_EMOJI = ['🚗','🚙','🚕','🚌','🛻'];
    let rows, pr, prF, px, hop, maxR, cam, alive, raf, idleT, eagle, deadT, deadGlyph, frames, land, splash;
    const rand = a => a[Math.floor(Math.random() * a.length)];

    function genRow(r) {
      if (r < 3) return { type: 'grass', trees: new Set() };
      let type = Math.random() < 0.34 ? 'grass' : Math.random() < 0.62 ? 'road' : 'river';
      if (rows[r-1] && rows[r-1].type === 'river' && rows[r-2] && rows[r-2].type === 'river' && type === 'river') type = 'road';
      if (type === 'grass') {
        const trees = new Set();
        for (let c = 0; c < NC; c++) if (Math.random() < 0.26) trees.add(c);
        if (trees.size >= NC - 1) { trees.clear(); trees.add(0); }
        return { type, trees };
      }
      const dir = Math.random() < 0.5 ? -1 : 1;
      const sp = 1.1 + Math.random() * 1.3 + Math.min(1.3, r / 55);
      if (type === 'road') {
        const n = 2 + (Math.random() < 0.5 ? 1 : 0);
        const cars = [];
        const gap = (W + 180) / n;
        for (let i = 0; i < n; i++) cars.push(i * gap + Math.random() * 70);
        return { type, dir, sp, cars, glyph: rand(CAR_EMOJI) };
      }
      const n = 2 + (Math.random() < 0.6 ? 1 : 0);
      const logs = [];
      const gap = (W + 220) / n;
      for (let i = 0; i < n; i++) logs.push({ x: i * gap + Math.random() * 60, w: 116 + Math.random() * 66 });
      return { type: 'river', dir, sp, logs };
    }
    function ensureRows(upTo) { while (rows.length <= upTo) rows.push(genRow(rows.length)); }
    function reset() {
      rows = []; ensureRows(20);
      pr = 0; prF = 0; px = W / 2; hop = null;
      maxR = 0; cam = 0; idleT = 0; eagle = null; deadT = 0; frames = 0; alive = true;
      land = 0; splash = [];
      setScore(0);
    }
    const colOf = x => Math.max(0, Math.min(NC - 1, Math.floor(x / CW)));

    function tryMove(dr, dx) {
      if (!alive || hop || eagle) return;
      const nr = pr + dr;
      if (nr < Math.max(0, Math.floor(cam))) return;
      const nx = Math.max(CW * 0.5, Math.min(W - CW * 0.5, px + dx));
      ensureRows(nr + 14);
      const dest = rows[nr];
      if (dest.type === 'grass' && dest.trees.has(colOf(nx))) {
        beep(180, 120, 0.06, 0.08, 'square'); return;   /* 撞樹，跳不過去 */
      }
      hop = { fr: pr, fx: px, tr: nr, tx: nx, t: 0 };
      idleT = 0;
      beep(500 + Math.min(400, maxR * 6), 700 + Math.min(400, maxR * 6), 0.06, 0.09);
    }

    function die(kind) {
      if (!alive) return;
      alive = false;
      deadGlyph = kind === 'water' ? '💦' : kind === 'eagle' ? '🪶' : '💥';
      deadT = 34;
      if (kind === 'water') {
        beep(400, 80, 0.3, 0.2);
        const py = BASE - (prF - cam) * T;
        for (let i = 0; i < 12; i++)
          splash.push({ x: px, y: py, vx: (Math.random()-0.5)*8, vy: -3 - Math.random()*4, r: 2 + Math.random()*4, a: 1 });
      } else beep(200, 40, 0.35, 0.25, 'sawtooth');
    }

    function loop() {
      frames++;
      if (land > 0) land = Math.max(0, land - 0.14);
      /* 跳躍動畫 */
      if (hop) {
        hop.t += 0.16;
        if (hop.t >= 1) {
          pr = hop.tr; prF = pr; px = hop.tx; hop = null; land = 1;
          if (pr > maxR) { maxR = pr; setScore(maxR); }
        } else {
          prF = hop.fr + (hop.tr - hop.fr) * hop.t;
          px = hop.fx + (hop.tx - hop.fx) * hop.t;
        }
      }
      /* 移動車與浮木 */
      const lo = Math.floor(cam) - 2, hi = Math.floor(cam) + 13;
      ensureRows(hi + 2);
      for (let r = Math.max(0, lo); r <= hi; r++) {
        const row = rows[r];
        if (row.type === 'road') {
          for (let i = 0; i < row.cars.length; i++) {
            row.cars[i] += row.dir * row.sp;
            if (row.cars[i] < -120) row.cars[i] += W + 240;
            if (row.cars[i] > W + 120) row.cars[i] -= W + 240;
          }
        } else if (row.type === 'river') {
          for (const l of row.logs) {
            l.x += row.dir * row.sp;
            if (l.x < -l.w - 60) l.x += W + l.w + 120;
            if (l.x > W + 60) l.x -= W + l.w + 120;
          }
        }
      }
      if (alive && !hop) {
        const row = rows[pr];
        if (row.type === 'river') {
          const log = row.logs.find(l => px >= l.x - 8 && px <= l.x + l.w + 8);
          if (!log) { die('water'); }
          else {
            px += row.dir * row.sp;
            if (px < 16 || px > W - 16) die('water');
          }
        } else if (row.type === 'road') {
          for (const cx of row.cars) if (Math.abs(cx - px) < 42) { die('car'); break; }
        }
        /* 老鷹 */
        idleT++;
        if (idleT > 400 && !eagle) { eagle = { y: -90 }; beep(900, 500, 0.3, 0.12, 'square'); }
      }
      if (eagle) {
        eagle.y += 11;
        const py = BASE - (prF - cam) * T;
        if (eagle.y >= py - 20 && alive) die('eagle');
      }
      /* 水花 */
      for (const s of splash) { s.x += s.vx; s.y += s.vy; s.vy += 0.4; s.a -= 0.05; }
      splash = splash.filter(s => s.a > 0);
      /* 鏡頭 */
      cam += (Math.max(cam, prF - 2.4) - cam) * 0.09;
      /* 死亡結算 */
      if (!alive) {
        if (--deadT <= 0) { cancelAnimationFrame(raf); over(maxR); return; }
      }
      draw();
      raf = requestAnimationFrame(loop);
    }

    function draw() {
      ctx.fillStyle = '#7ec850'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lo = Math.floor(cam) - 1, hi = Math.floor(cam) + 12;
      for (let r = Math.max(0, lo); r <= hi; r++) {
        const row = rows[r];
        const y = BASE - (r - cam) * T;
        if (y < -T || y > H + T) continue;
        if (row.type === 'grass') {
          ctx.fillStyle = r % 2 ? '#8fd45e' : '#7ec850';
          ctx.fillRect(0, y - T/2, W, T);
          /* 立體感：上緣提亮、下緣壓暗 */
          ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(0, y - T/2, W, 3);
          ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(0, y + T/2 - 4, W, 4);
          for (const c of row.trees) {
            ctx.fillStyle = 'rgba(0,0,0,0.12)';
            ctx.beginPath(); ctx.ellipse((c + 0.5) * CW, y + 16, 17, 6, 0, 0, 6.283); ctx.fill();
            spr('tree', '🌳', (c + 0.5) * CW, y - 6, 40);
          }
        } else if (row.type === 'road') {
          ctx.fillStyle = '#5a5a62'; ctx.fillRect(0, y - T/2, W, T);
          ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0, y + T/2 - 4, W, 4);
          ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3; ctx.setLineDash([16, 16]);
          ctx.beginPath(); ctx.moveTo(0, y + T/2); ctx.lineTo(W, y + T/2); ctx.stroke();
          ctx.setLineDash([]);
          for (const cx of row.cars) {
            /* 車底陰影 */
            ctx.fillStyle = 'rgba(0,0,0,0.16)';
            ctx.beginPath(); ctx.ellipse(cx, y + 14, 24, 6, 0, 0, 6.283); ctx.fill();
            spr('car', row.glyph, cx, y, 42, row.dir < 0);
          }
        } else {
          ctx.fillStyle = '#4f8fd0'; ctx.fillRect(0, y - T/2, W, T);
          ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.fillRect(0, y - T/2, W, 3);
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          for (let i = 0; i < 4; i++) ctx.fillRect(((frames * row.dir * row.sp * 0.4 + i * 110) % (W+60) + W+60) % (W+60) - 30, y - 12 + (i%2)*14, 34, 4);
          for (const l of row.logs) {
            ctx.fillStyle = '#8a5a2b';
            ctx.beginPath(); ctx.roundRect(l.x, y - 15, l.w, 30, 13); ctx.fill();
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            ctx.beginPath(); ctx.roundRect(l.x, y + 9, l.w, 6, 3); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.16)';
            ctx.beginPath(); ctx.roundRect(l.x + 8, y - 8, l.w - 16, 5, 3); ctx.fill();
          }
        }
      }
      /* 水花 */
      for (const s of splash) {
        ctx.globalAlpha = Math.max(0, s.a);
        ctx.fillStyle = '#cfe8ff';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
        ctx.globalAlpha = 1;
      }
      /* 玩家 */
      const py = BASE - (prF - cam) * T;
      const arc = hop ? -Math.sin(hop.t * Math.PI) * 18 : 0;
      /* 影子（跳起時變小） */
      const shR = hop ? 12 - Math.sin(hop.t * Math.PI) * 5 : 15;
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(px, py + 14, shR, shR * 0.36, 0, 0, 6.283); ctx.fill();
      /* 本體（落地時擠壓一下） */
      ctx.save();
      ctx.translate(px, py - 8 + arc);
      ctx.scale(1 + land * 0.22, 1 - land * 0.22);
      const playerDrawn = alive && env.sprite && env.sprite('player', 0, 0, 44);
      if (!playerDrawn) {
        ctx.font = '44px serif';
        ctx.fillText(alive ? '🐔' : deadGlyph, 0, 0);
      }
      ctx.restore();
      /* 老鷹 */
      if (eagle) {
        ctx.fillStyle = 'rgba(0,0,0,0.14)';
        ctx.beginPath(); ctx.ellipse(px, py + 14, 20, 6, 0, 0, 6.283); ctx.fill();
        spr('eagle', '🦅', px, eagle.y, 60);
      }
      /* 發呆警告 */
      if (alive && idleT > 280 && !eagle && Math.floor(frames / 14) % 2 === 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.font = '700 17px system-ui';
        const t = '快動！有東西在盯著你…';
        const tw = ctx.measureText(t).width;
        ctx.beginPath(); ctx.roundRect(W/2 - tw/2 - 14, 90, tw + 28, 40, 10); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(t, W/2, 111);
      }
      ctx.textBaseline = 'alphabetic';
    }

    return {
      start() { reset(); raf = requestAnimationFrame(loop); },
      stop() { alive = false; deadT = 0; cancelAnimationFrame(raf); },
      input(t, x, y) {
        if (t !== 'down') return;
        if (x < W * 0.32) tryMove(0, -CW);
        else if (x > W * 0.68) tryMove(0, CW);
        else tryMove(1, 0);
      }
    };
  }
}

]);
