/* PlayFeed 遊戲包 pack5 — 冰淇淋機（按住倒、放開停）
   互動：按住畫面倒冰淇淋、放開停止（「按住＋放開」，無滑動手勢，符合遊戲規範）。
*/
window.GAMES = (window.GAMES || []).concat([

{
  id: 'softserve', title: '冰淇淋機：倒越高分越高', author: '@夏日限定工讀生', tip: '按住螢幕倒冰淇淋，放開停止。越高分越高，但倒過頭整坨會塌',
  bg: '#ffe8ef',
  create(env) {
    const { ctx, setScore, over } = env;
    const W = env.W, H = env.H;
    const NOZZLE_Y = 150, CONE_TOP = 520, CONE_W = 92;
    const FLAVORS = [
      { name: '香草', a: '#fff4dc', b: '#f0dcae' },
      { name: '巧克力', a: '#7b4b2a', b: '#5d3520' },
      { name: '草莓', a: '#ffc0cf', b: '#ef92ac' },
      { name: '抹茶', a: '#b7cf8e', b: '#93b169' }
    ];
    const SPRINKLE_COLS = ['#e24b4a','#f0c33c','#4f8fd0','#97c459','#d4537e','#ff8ac0'];

    let h, maxH, targetH, holding, phase, settleT, wobble, wobT, score, lives, cones,
        pourRate, flavor, blobs, tickT, banner, shake, raf, alive, frames, lastScore,
        sprinkles, topper;

    function newCone() {
      cones++;
      /* 越後面：目標更高、容錯更窄、出料更快 */
      targetH = 170 + Math.min(120, cones * 14) + Math.random() * 30;
      const margin = Math.max(26, 86 - cones * 8);
      maxH = targetH + margin;
      pourRate = 1.5 + Math.min(1.6, cones * 0.16);
      h = 0; holding = false; phase = 'pour'; wobble = 0; wobT = 0; blobs = null; tickT = 0;
      sprinkles = null; topper = null;
      flavor = FLAVORS[(cones - 1) % FLAVORS.length];
    }
    function reset() {
      score = 0; lives = 3; cones = 0; banner = null; shake = 0; frames = 0; alive = true; lastScore = 0;
      newCone(); setScore(0);
    }
    function showBanner(t, c) { banner = { t, a: 1.5, c: c || '#c8437a' }; }

    function collapse() {
      phase = 'collapse'; settleT = 46; shake = 14;
      lives--;
      beep(320, 70, 0.4, 0.22, 'sawtooth');
      blobs = [];
      const n = Math.max(4, Math.floor(h / 26));
      for (let i = 0; i < n; i++) {
        const y = CONE_TOP - (i / n) * h;
        blobs.push({ x: W/2 + (Math.random()-0.5)*30, y, vx: (Math.random()-0.5)*7,
                     vy: -2 - Math.random()*3, r: 30 - (i/n)*14, rot: 0, vr: (Math.random()-0.5)*0.3 });
      }
      showBanner('塌了！', '#c8437a');
    }
    function serve() {
      phase = 'settle'; settleT = 44; wobble = Math.min(16, 5 + (h / maxH) * 12);
      const ratio = h / maxH;
      let pts = Math.round(h * 0.6);
      let msg = '出餐 +' + pts;
      if (ratio >= 0.93) { pts += 120; msg = '完美！ +' + pts; beep(900, 1600, 0.18, 0.16); beep(1300, 1900, 0.2, 0.1); }
      else if (ratio >= 0.8) { pts += 50; msg = '漂亮 +' + pts; beep(760, 1300, 0.15, 0.15); }
      else if (h < targetH) { pts = Math.round(pts * 0.5); msg = '太少了 +' + pts; beep(420, 300, 0.16, 0.12); }
      else beep(650, 1000, 0.13, 0.14);
      score += pts; lastScore = pts; setScore(score);
      /* 出餐獎勵：漂亮以上灑糖粒，完美再加一顆櫻桃 */
      if (ratio >= 0.8) {
        sprinkles = [];
        for (let i = 0; i < (ratio >= 0.93 ? 26 : 14); i++)
          sprinkles.push({ t: Math.random(), off: (Math.random()-0.5)*0.85, c: SPRINKLE_COLS[i % SPRINKLE_COLS.length] });
        if (ratio >= 0.93) topper = '🍒';
      }
      showBanner(msg, ratio >= 0.93 ? '#e8a020' : '#3f8f5f');
    }

    function loop() {
      frames++;
      if (shake > 0) shake *= 0.86;
      if (banner) { banner.a -= 0.016; if (banner.a <= 0) banner = null; }

      if (phase === 'pour') {
        if (holding) {
          h += pourRate;
          wobble = Math.max(0, (h - targetH * 0.75) * 0.06);
          /* 越接近極限，滴答越快越高 */
          const risk = Math.max(0, (h - targetH * 0.7) / (maxH - targetH * 0.7));
          if (--tickT <= 0) {
            beep(300 + risk * 900, 260 + risk * 800, 0.04, 0.05 + risk * 0.07, 'square');
            tickT = Math.max(3, Math.round(16 - risk * 13));
          }
          if (h >= maxH) { collapse(); }
        } else if (h > 0) {
          wobble *= 0.94;
        }
      } else if (phase === 'settle') {
        wobble *= 0.9;
        if (--settleT <= 0) { newCone(); }
      } else if (phase === 'collapse') {
        for (const b of blobs) { b.vy += 0.55; b.x += b.vx; b.y += b.vy; b.rot += b.vr;
          if (b.y > 620) { b.y = 620; b.vy *= -0.25; b.vx *= 0.7; } }
        if (--settleT <= 0) {
          if (lives <= 0) { alive = false; cancelAnimationFrame(raf); over(score); return; }
          newCone();
        }
      }
      wobT += 0.22;
      draw();
      raf = requestAnimationFrame(loop);
    }

    function swirlX(y) {
      /* y：距離甜筒口的高度 */
      const t = h > 0 ? y / h : 0;
      return Math.sin(wobT + t * 3.4) * wobble * (0.35 + t * 0.9);
    }

    function draw() {
      const sx = shake > 0.4 ? (Math.random() - 0.5) * shake : 0;
      ctx.save();
      ctx.translate(sx, 0);

      /* 背景 */
      ctx.fillStyle = '#ffe8ef'; ctx.fillRect(-20, 0, W + 40, H);
      ctx.fillStyle = '#f7d3de';
      for (let i = 0; i < 6; i++) ctx.fillRect(-20, 220 + i * 80, W + 40, 26);
      /* 檯面 */
      ctx.fillStyle = '#e6b8c8'; ctx.fillRect(-20, 600, W + 40, H - 600);
      ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(-20, 600, W + 40, 8);

      /* 機器 */
      ctx.fillStyle = '#cfd6de';
      ctx.beginPath(); ctx.roundRect(W/2 - 96, 20, 192, 110, 18); ctx.fill();
      ctx.fillStyle = '#aab4c0';
      ctx.beginPath(); ctx.roundRect(W/2 - 26, 118, 52, 34, 8); ctx.fill();
      ctx.fillStyle = '#8e99a6';
      ctx.beginPath(); ctx.roundRect(W/2 - 18, NOZZLE_Y - 6, 36, 12, 5); ctx.fill();
      ctx.fillStyle = '#7f8b98'; ctx.font = '600 13px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('SOFT SERVE', W/2, 84);

      /* 目標線 */
      const ty = CONE_TOP - targetH;
      ctx.strokeStyle = 'rgba(80,150,110,0.85)'; ctx.lineWidth = 2.5; ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(30, ty); ctx.lineTo(W - 30, ty); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(60,130,95,0.9)'; ctx.font = '600 12px system-ui'; ctx.textAlign = 'left';
      ctx.fillText('目標線（超過才算合格）', 32, ty - 8);

      /* 危險紅暈 */
      if (phase === 'pour' && h > targetH * 0.8) {
        const risk = Math.min(1, (h - targetH * 0.8) / (maxH - targetH * 0.8));
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, `rgba(220,60,90,${risk * 0.3})`);
        g.addColorStop(1, 'rgba(220,60,90,0)');
        ctx.fillStyle = g; ctx.fillRect(-20, 0, W + 40, H);
      }

      /* 出料柱 */
      if (phase === 'pour' && holding) {
        const topY = CONE_TOP - h;
        ctx.fillStyle = flavor.a;
        ctx.beginPath(); ctx.roundRect(W/2 - 11 + swirlX(h) * 0.4, NOZZLE_Y, 22, Math.max(0, topY - NOZZLE_Y + 8), 10); ctx.fill();
      }

      /* 冰淇淋塔 */
      if (phase === 'collapse' && blobs) {
        for (const b of blobs) {
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
          ctx.fillStyle = flavor.a;
          ctx.beginPath(); ctx.ellipse(0, 0, b.r, b.r * 0.82, 0, 0, 6.283); ctx.fill();
          ctx.restore();
        }
      } else if (h > 0) {
        const layers = Math.max(1, Math.floor(h / 9));
        for (let i = layers; i >= 0; i--) {
          const y = (i / layers) * h;
          const r = (CONE_W / 2 - 4) * (1 - 0.62 * (y / Math.max(h, 1))) * (h < 40 ? 0.75 + h / 160 : 1);
          const x = W/2 + swirlX(y);
          ctx.fillStyle = i % 2 ? flavor.a : flavor.b;
          ctx.beginPath(); ctx.ellipse(x, CONE_TOP - y, r, r * 0.62, 0, 0, 6.283); ctx.fill();
        }
        /* 頂端小尖 */
        const tx = W/2 + swirlX(h);
        ctx.fillStyle = flavor.a;
        ctx.beginPath();
        ctx.moveTo(tx - 9, CONE_TOP - h);
        ctx.quadraticCurveTo(tx, CONE_TOP - h - 20, tx + 9, CONE_TOP - h);
        ctx.fill();
        /* 灑糖粒（出餐獎勵） */
        if (sprinkles) {
          for (const s of sprinkles) {
            const y = s.t * h;
            const r = (CONE_W / 2 - 4) * (1 - 0.62 * (y / Math.max(h, 1)));
            const x = W/2 + swirlX(y) + s.off * r;
            ctx.fillStyle = s.c;
            ctx.beginPath(); ctx.arc(x, CONE_TOP - y, 2.6, 0, 6.283); ctx.fill();
          }
        }
        /* 完美櫻桃 */
        if (topper) {
          ctx.font = '26px serif'; ctx.textAlign = 'center';
          ctx.fillText(topper, tx, CONE_TOP - h - 10);
        }
      }

      /* 甜筒 */
      const cw = CONE_W / 2;
      ctx.fillStyle = '#d9a05b';
      ctx.beginPath();
      ctx.moveTo(W/2 - cw, CONE_TOP);
      ctx.lineTo(W/2 + cw, CONE_TOP);
      ctx.lineTo(W/2, CONE_TOP + 104);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(140,88,36,0.45)'; ctx.lineWidth = 2;
      for (let i = 1; i <= 3; i++) {
        const t = i / 4;
        ctx.beginPath();
        ctx.moveTo(W/2 - cw * (1 - t), CONE_TOP + 104 * t);
        ctx.lineTo(W/2 + cw * (1 - t), CONE_TOP + 104 * t);
        ctx.stroke();
      }
      ctx.fillStyle = '#c98f4a';
      ctx.beginPath(); ctx.roundRect(W/2 - cw - 3, CONE_TOP - 7, cw * 2 + 6, 14, 6); ctx.fill();

      /* HUD：生命與提示 */
      ctx.textAlign = 'left'; ctx.font = '600 22px serif';
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = i < lives ? 1 : 0.22;
        ctx.fillText('🍦', 24 + i * 30, 48);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(120,70,90,0.8)'; ctx.font = '600 14px system-ui';
      ctx.fillText('第 ' + cones + ' 支 · ' + flavor.name, W/2, 664);
      if (phase === 'pour' && h < 6) {
        ctx.fillStyle = 'rgba(120,70,90,0.65)'; ctx.font = '500 15px system-ui';
        ctx.fillText('按住畫面開始倒 ↓', W/2, CONE_TOP - 150);
      }

      /* 橫幅 */
      if (banner) {
        ctx.globalAlpha = Math.min(1, banner.a);
        ctx.fillStyle = 'rgba(255,255,255,0.94)';
        ctx.font = '800 26px system-ui';
        const tw = ctx.measureText(banner.t).width;
        ctx.beginPath(); ctx.roundRect(W/2 - tw/2 - 20, 230, tw + 40, 54, 14); ctx.fill();
        ctx.fillStyle = banner.c;
        ctx.fillText(banner.t, W/2, 266);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    return {
      start() { reset(); raf = requestAnimationFrame(loop); },
      stop() { alive = false; cancelAnimationFrame(raf); },
      input(t) {
        if (!alive) return;
        if (t === 'down' && phase === 'pour') holding = true;
        else if (t === 'up' && phase === 'pour') {
          holding = false;
          if (h > 8) serve();
        }
      }
    };
  }
}

]);
