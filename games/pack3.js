/* PlayFeed 遊戲包 pack3 — 削馬鈴薯（致敬 IG AR 濾鏡削皮遊戲的觸控版）
   啟用方法：在 index.html 的 pack2 底下加一行
   <script src="games/pack3.js"></script>
*/
window.GAMES = (window.GAMES || []).concat([

{
  id: 'potato-peel', title: '削馬鈴薯：限時削皮大賽', author: '@廚房修行中', tip: '手指由上往下刷，把皮一條一條削掉，30 秒內能削幾顆？', bg: '#f0e3cf',
  create(env) {
    const { ctx, setScore, over } = env;
    const CX = 200, CY = 310, BASE_TIME = 30 * 60;   /* 30 秒（畫格） */
    let strips, nStrips, rx, ry, score, timeLeft, potatoes, raf, alive, banner, scrapeT, speckles;

    function topY(x) { const t = 1 - ((x - CX) / rx) ** 2; return t <= 0 ? CY : CY - ry * Math.sqrt(t); }
    function botY(x) { const t = 1 - ((x - CX) / rx) ** 2; return t <= 0 ? CY : CY + ry * Math.sqrt(t); }

    function newPotato() {
      nStrips = Math.min(10, 5 + potatoes);
      rx = 150; ry = 100 + Math.random() * 14;
      strips = [];
      const w = (rx * 2) / nStrips;
      for (let i = 0; i < nStrips; i++) {
        const x0 = CX - rx + i * w, mid = x0 + w / 2;
        strips.push({ x0, w, front: topY(mid), done: false });
      }
      speckles = [];
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * 6.283, r = Math.random() * 0.9;
        speckles.push({ x: CX + Math.cos(a) * rx * r, y: CY + Math.sin(a) * ry * r, s: 1.5 + Math.random() * 2.5 });
      }
    }
    function reset() { score = 0; potatoes = 0; timeLeft = BASE_TIME; banner = null; scrapeT = 0; alive = true; newPotato(); setScore(0); }
    function showBanner(t) { banner = { t, a: 1.3 }; }

    function loop() {
      if (!alive) return;
      if (--timeLeft <= 0) {
        alive = false; cancelAnimationFrame(raf);
        beep(500, 120, 0.4, 0.2, 'sawtooth');
        over(score); return;
      }
      if (banner) { banner.a -= 0.018; if (banner.a <= 0) banner = null; }
      draw();
      raf = requestAnimationFrame(loop);
    }

    function potatoPath() {
      ctx.beginPath();
      ctx.ellipse(CX, CY, rx, ry, 0, 0, 6.283);
    }

    function draw() {
      ctx.fillStyle = '#f0e3cf'; ctx.fillRect(0, 0, env.W, env.H);
      /* 砧板 */
      ctx.fillStyle = '#d9b98a';
      ctx.beginPath(); ctx.roundRect(28, 140, 344, 348, 26); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      for (let i = 0; i < 5; i++) ctx.fillRect(48, 172 + i * 62, 304, 3);
      /* 時間條 */
      const tr = Math.max(0, timeLeft / BASE_TIME);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath(); ctx.roundRect(40, 96, 320, 14, 7); ctx.fill();
      ctx.fillStyle = tr < 0.25 ? '#d9534f' : '#8a6d3b';
      ctx.beginPath(); ctx.roundRect(40, 96, Math.max(10, 320 * Math.min(1, tr)), 14, 7); ctx.fill();
      ctx.fillStyle = '#6b5433'; ctx.font = '600 14px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('第 ' + (potatoes + 1) + ' 顆 · 剩 ' + Math.ceil(timeLeft / 60) + ' 秒', env.W / 2, 84);
      /* 馬鈴薯：生皮 */
      ctx.save();
      potatoPath(); ctx.clip();
      ctx.fillStyle = '#b98d4f';
      ctx.fillRect(CX - rx, CY - ry, rx * 2, ry * 2);
      ctx.fillStyle = 'rgba(90,60,25,0.25)';
      for (const s of speckles) { ctx.beginPath(); ctx.arc(s.x, s.y, s.s, 0, 6.283); ctx.fill(); }
      /* 已削的部分 */
      for (const st of strips) {
        ctx.fillStyle = '#ecd9a4';
        ctx.fillRect(st.x0, CY - ry - 4, st.w + 0.6, st.front - (CY - ry - 4));
        if (!st.done) {
          ctx.fillStyle = 'rgba(120,85,40,0.55)';
          ctx.fillRect(st.x0, st.front - 2.5, st.w + 0.6, 5);
        }
      }
      /* 果肉光澤 */
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath(); ctx.ellipse(CX - rx * 0.35, CY - ry * 0.4, rx * 0.3, ry * 0.22, -0.5, 0, 6.283); ctx.fill();
      ctx.restore();
      /* 輪廓 */
      potatoPath();
      ctx.strokeStyle = 'rgba(90,60,25,0.5)'; ctx.lineWidth = 4; ctx.stroke();
      /* 提示 */
      ctx.fillStyle = 'rgba(107,84,51,0.65)'; ctx.font = '500 14px system-ui';
      ctx.fillText('↓ 由上往下刷，一次削一條 ↓', env.W / 2, 560);
      /* 橫幅 */
      if (banner) {
        ctx.globalAlpha = Math.min(1, banner.a);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.font = '800 26px system-ui';
        const tw = ctx.measureText(banner.t).width;
        ctx.beginPath(); ctx.roundRect(env.W/2 - tw/2 - 18, 190, tw + 36, 52, 12); ctx.fill();
        ctx.fillStyle = '#8a5a2b';
        ctx.fillText(banner.t, env.W / 2, 226);
        ctx.globalAlpha = 1;
      }
    }

    function peelAt(x, y, dy) {
      if (dy <= 0) return;                       /* 只吃往下的動作 */
      for (const st of strips) {
        if (st.done || x < st.x0 || x > st.x0 + st.w) continue;
        if (y < st.front - 90 || y > st.front + 90) continue;   /* 要接在削到一半的地方 */
        st.front += dy * 1.25;
        if (--scrapeT <= 0) { beep(180 + Math.random() * 60, 140, 0.05, 0.06, 'sawtooth'); scrapeT = 5; }
        const mid = st.x0 + st.w / 2;
        if (st.front >= botY(mid) - 3) {
          st.done = true; st.front = botY(mid);
          score += 5; setScore(score);
          beep(600, 950, 0.1, 0.13);
          if (strips.every(s => s.done)) {
            potatoes++;
            score += 20; setScore(score);
            timeLeft += 5 * 60;
            showBanner('削好一顆！ +20 · 加 5 秒');
            beep(700, 1200, 0.14, 0.16); beep(1000, 1500, 0.16, 0.12);
            newPotato();
          }
        }
        return;
      }
    }

    let lastY = null;
    return {
      start() { reset(); raf = requestAnimationFrame(loop); },
      stop() { alive = false; cancelAnimationFrame(raf); },
      input(t, x, y) {
        if (!alive) return;
        if (t === 'down') { lastY = y; peelAt(x, y, 2); }
        else if (t === 'move' && lastY !== null) { peelAt(x, y, y - lastY); lastY = y; }
        else if (t === 'up') lastY = null;
      }
    };
  }
}

]);
