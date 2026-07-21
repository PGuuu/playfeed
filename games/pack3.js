/* PlayFeed 遊戲包 pack3 — 削馬鈴薯（點按節奏版）
   玩法：刀子在馬鈴薯上方左右來回移動，點一下畫面，刀子就在目前位置削下一整條皮。
   注意：遊戲互動只用「點按」，上下滑動保留給 feed 捲動。
*/
window.GAMES = (window.GAMES || []).concat([

{
  id: 'potato-peel', title: '削馬鈴薯：限時削皮大賽', author: '@廚房修行中', tip: '刀子左右來回移動，抓準時機點一下削掉整條皮，30 秒能削幾顆？', bg: '#f0e3cf',
  remixSlots: [
    { key: 'potato', label: '馬鈴薯', hint: '要削皮的東西（削掉後露出裡面）', default: '🥔', shape: 'circle' },
    { key: 'knife', label: '刀子', hint: '左右巡邏、點按下削的刀', default: '🔪', shape: 'tall' }
  ],
  create(env) {
    const { ctx, setScore, over } = env;
    const getSprite = env.getSprite || (() => null);
    const sprite = env.sprite || (() => false);
    const CX = 200, CY = 330, KY = 148, BASE_TIME = 30 * 60;   /* 30 秒（畫格） */
    let strips, nStrips, rx, ry, score, timeLeft, potatoes, raf, alive, banner, speckles, knife, peels, shake;

    function topY(x) { const t = 1 - ((x - CX) / rx) ** 2; return t <= 0 ? CY : CY - ry * Math.sqrt(t); }
    function botY(x) { const t = 1 - ((x - CX) / rx) ** 2; return t <= 0 ? CY : CY + ry * Math.sqrt(t); }

    function newPotato() {
      nStrips = Math.min(10, 5 + potatoes);
      rx = 150; ry = 100 + Math.random() * 14;
      strips = [];
      const w = (rx * 2) / nStrips;
      for (let i = 0; i < nStrips; i++) {
        const x0 = CX - rx + i * w, mid = x0 + w / 2;
        strips.push({ x0, w, front: topY(mid), done: false, peeling: false });
      }
      speckles = [];
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * 6.283, r = Math.random() * 0.9;
        speckles.push({ x: CX + Math.cos(a) * rx * r, y: CY + Math.sin(a) * ry * r, s: 1.5 + Math.random() * 2.5 });
      }
      knife.speed = 2.4 + potatoes * 0.5;   /* 每顆越來越快 */
    }
    function reset() {
      score = 0; potatoes = 0; timeLeft = BASE_TIME; banner = null; alive = true;
      knife = { x: CX, dir: 1, speed: 2.4, slice: 0 };
      peels = []; shake = 0;
      newPotato(); setScore(0);
    }
    function showBanner(t) { banner = { t, a: 1.3 }; }

    function doSlice() {
      knife.slice = 12;
      const st = strips.find(s => !s.done && knife.x >= s.x0 && knife.x <= s.x0 + s.w);
      if (st) {
        st.peeling = true;
        beep(200 + Math.random() * 50, 130, 0.09, 0.1, 'sawtooth');
      } else {
        /* 落空：削到砧板或已經削過的地方，扣 1 秒 */
        timeLeft = Math.max(1, timeLeft - 60);
        shake = 8;
        beep(120, 60, 0.12, 0.14, 'square');
      }
    }

    function loop() {
      if (!alive) return;
      if (--timeLeft <= 0) {
        alive = false; cancelAnimationFrame(raf);
        beep(500, 120, 0.4, 0.2, 'sawtooth');
        over(score); return;
      }
      /* 刀子左右巡邏 */
      knife.x += knife.dir * knife.speed;
      const lim = rx + 26;
      if (knife.x > CX + lim) { knife.x = CX + lim; knife.dir = -1; }
      if (knife.x < CX - lim) { knife.x = CX - lim; knife.dir = 1; }
      if (knife.slice > 0) knife.slice--;
      if (shake > 0) shake--;
      /* 削皮動畫 */
      for (const st of strips) {
        if (!st.peeling || st.done) continue;
        const mid = st.x0 + st.w / 2;
        st.front += (botY(mid) - topY(mid)) / 9;
        if (st.front >= botY(mid) - 3) {
          st.done = true; st.peeling = false; st.front = botY(mid);
          peels.push({ x: st.x0, w: st.w, y: botY(mid), vy: 2 + Math.random() * 2, rot: 0, vr: (Math.random() - 0.5) * 0.2 });
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
      }
      /* 掉落的皮 */
      for (const p of peels) { p.y += p.vy; p.vy += 0.25; p.rot += p.vr; }
      peels = peels.filter(p => p.y < env.H + 40);
      if (banner) { banner.a -= 0.018; if (banner.a <= 0) banner = null; }
      draw();
      raf = requestAnimationFrame(loop);
    }

    function potatoPath() {
      ctx.beginPath();
      ctx.ellipse(CX, CY, rx, ry, 0, 0, 6.283);
    }

    function draw() {
      ctx.save();
      if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      ctx.fillStyle = '#f0e3cf'; ctx.fillRect(-10, -10, env.W + 20, env.H + 20);
      /* 砧板 */
      ctx.fillStyle = '#d9b98a';
      ctx.beginPath(); ctx.roundRect(28, 170, 344, 348, 26); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      for (let i = 0; i < 5; i++) ctx.fillRect(48, 202 + i * 62, 304, 3);
      /* 時間條 */
      const tr = Math.max(0, timeLeft / BASE_TIME);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath(); ctx.roundRect(40, 66, 320, 14, 7); ctx.fill();
      ctx.fillStyle = tr < 0.25 ? '#d9534f' : '#8a6d3b';
      ctx.beginPath(); ctx.roundRect(40, 66, Math.max(10, 320 * Math.min(1, tr)), 14, 7); ctx.fill();
      ctx.fillStyle = '#6b5433'; ctx.font = '600 14px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('第 ' + (potatoes + 1) + ' 顆 · 剩 ' + Math.ceil(timeLeft / 60) + ' 秒', env.W / 2, 54);
      /* 掉落的皮（畫在馬鈴薯後面） */
      for (const p of peels) {
        ctx.save();
        ctx.translate(p.x + p.w / 2, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = '#b98d4f';
        ctx.beginPath(); ctx.roundRect(-p.w / 2, -5, p.w, 10, 5); ctx.fill();
        ctx.restore();
      }
      /* 馬鈴薯：生皮（可換圖，削掉後露出裡面的果肉） */
      ctx.save();
      potatoPath(); ctx.clip();
      const skin = getSprite('potato');
      if (skin) {
        ctx.drawImage(skin, CX - rx, CY - ry, rx * 2, ry * 2);
      } else {
        ctx.fillStyle = '#b98d4f';
        ctx.fillRect(CX - rx, CY - ry, rx * 2, ry * 2);
        ctx.fillStyle = 'rgba(90,60,25,0.25)';
        for (const s of speckles) { ctx.beginPath(); ctx.arc(s.x, s.y, s.s, 0, 6.283); ctx.fill(); }
      }
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
      /* 刀子：左右巡邏，點按時往下戳 */
      const plunge = knife.slice > 0 ? Math.sin((12 - knife.slice) / 12 * 3.1416) * 46 : 0;
      const kx = knife.x, ky = KY + plunge;
      ctx.save();
      /* 瞄準線 */
      ctx.strokeStyle = 'rgba(138,90,43,0.28)'; ctx.lineWidth = 2;
      ctx.setLineDash([6, 7]);
      ctx.beginPath(); ctx.moveTo(kx, ky + 46); ctx.lineTo(kx, botY(kx) || CY + ry); ctx.stroke();
      ctx.setLineDash([]);
      if (!sprite('knife', kx, ky, 96)) {
        /* 刀刃（朝下） */
        ctx.fillStyle = '#cfd6dc';
        ctx.beginPath();
        ctx.moveTo(kx - 11, ky - 12); ctx.lineTo(kx + 11, ky - 12);
        ctx.lineTo(kx + 7, ky + 34); ctx.lineTo(kx, ky + 46); ctx.lineTo(kx - 7, ky + 34);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1.5; ctx.stroke();
        /* 刀柄 */
        ctx.fillStyle = '#7a5230';
        ctx.beginPath(); ctx.roundRect(kx - 8, ky - 46, 16, 38, 7); ctx.fill();
      }
      ctx.restore();
      /* 提示 */
      ctx.fillStyle = 'rgba(107,84,51,0.65)'; ctx.font = '500 14px system-ui';
      ctx.fillText('點一下＝在刀子的位置削一刀（落空扣 1 秒）', env.W / 2, 590);
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
      ctx.restore();
    }

    return {
      start() { reset(); raf = requestAnimationFrame(loop); },
      stop() { alive = false; cancelAnimationFrame(raf); },
      input(t) {
        if (!alive) return;
        if (t === 'down' && knife.slice === 0) doSlice();
      }
    };
  }
}

]);
