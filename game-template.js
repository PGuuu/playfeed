/* PlayFeed 遊戲範本 —「太空閃避」
   一款完整合規的參考遊戲：點左右半邊移動太空船、閃落下的隕石、活越久分越高。
   示範了投稿規範的每一項：固定 400×700、只用點按、乾淨的 start/stop/input、
   over()/setScore()/beep()、以及 remix 換圖（主角＋隕石）。
   直接複製這支改成你的點子即可。詳見「投稿規範.md」。 */
window.GAMES = (window.GAMES || []).concat([

{
  id: 'space-dodge',
  title: '太空閃避：撐越久分越高',
  author: '@範本作者',
  tip: '點左右半邊移動，閃開隕石，活越久分越高',
  bg: '#0b1e33',
  /* 選配：宣告可被玩家換圖的元素 */
  remixSlots: [
    { key: 'player', label: '太空船（主角）', hint: '你操控的角色', default: '🚀', shape: 'free' },
    { key: 'rock',   label: '隕石',           hint: '要閃避的障礙', default: '☄️', shape: 'circle' }
  ],

  create(env) {
    const { ctx, setScore, over } = env;
    const W = env.W, H = env.H;
    const sprite = env.sprite || (() => false);   /* 兼容沒有 sprite 的環境 */
    const PY = H - 120;                            /* 太空船的固定高度 */
    let px, targetX, rocks, score, frames, spawnT, raf, alive, stars;

    function reset() {
      px = W / 2; targetX = W / 2;
      rocks = []; score = 0; frames = 0; spawnT = 0; alive = true;
      /* 背景星星（純視覺） */
      stars = [];
      for (let i = 0; i < 40; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 2 + 1 });
      setScore(0);
    }

    function die() {
      if (!alive) return;
      alive = false;
      cancelAnimationFrame(raf);
      env.beep(300, 60, 0.4, 0.2, 'sawtooth');
      over(Math.floor(score));
    }

    function loop() {
      frames++;
      /* 太空船平滑移動到目標 */
      px += (targetX - px) * 0.25;

      /* 生成隕石：越久越密、越快 */
      if (--spawnT <= 0) {
        rocks.push({ x: 30 + Math.random() * (W - 60), y: -30, r: 20 + Math.random() * 10,
                     vy: 3.5 + frames / 700, vx: (Math.random() - 0.5) * 2 });
        spawnT = Math.max(14, 40 - Math.floor(frames / 240) * 3);
      }

      /* 更新隕石、判定撞擊 */
      for (const rk of rocks) {
        rk.y += rk.vy; rk.x += rk.vx;
        const dx = rk.x - px, dy = rk.y - PY;
        if (dx * dx + dy * dy < (rk.r + 20) * (rk.r + 20)) { die(); return; }
      }
      rocks = rocks.filter(rk => rk.y < H + 40);

      /* 活著就加分 */
      score += 0.2 + frames / 2000;
      setScore(Math.floor(score));

      draw();
      raf = requestAnimationFrame(loop);
    }

    function draw() {
      /* 背景 */
      ctx.fillStyle = '#0b1e33'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (const st of stars) {
        st.y += 0.6 + frames / 4000; if (st.y > H) { st.y = 0; st.x = Math.random() * W; }
        ctx.fillRect(st.x, st.y, st.s, st.s);
      }

      /* 隕石（可換圖，否則畫石頭） */
      for (const rk of rocks) {
        if (!sprite('rock', rk.x, rk.y, rk.r * 2 + 8)) {
          ctx.fillStyle = '#8a6f5a';
          ctx.beginPath(); ctx.arc(rk.x, rk.y, rk.r, 0, 6.283); ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.beginPath(); ctx.arc(rk.x + rk.r * 0.3, rk.y - rk.r * 0.2, rk.r * 0.35, 0, 6.283); ctx.fill();
        }
      }

      /* 太空船（可換圖，否則畫三角船） */
      if (!sprite('player', px, PY, 60)) {
        ctx.fillStyle = '#e8eef7';
        ctx.beginPath();
        ctx.moveTo(px, PY - 24); ctx.lineTo(px + 18, PY + 18); ctx.lineTo(px - 18, PY + 18);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f0a13c';   /* 尾焰 */
        ctx.beginPath();
        ctx.moveTo(px - 8, PY + 18); ctx.lineTo(px, PY + 30 + Math.sin(frames / 3) * 6); ctx.lineTo(px + 8, PY + 18);
        ctx.closePath(); ctx.fill();
      }
    }

    return {
      start() { reset(); raf = requestAnimationFrame(loop); },
      stop() { alive = false; cancelAnimationFrame(raf); },
      /* 只吃點按：點左半邊往左、右半邊往右。沒有任何垂直手勢。 */
      input(t, x) {
        if (!alive) return;
        if (t === 'down' || t === 'move') targetX = x < W / 2 ? W * 0.25 : W * 0.75;
      }
    };
  }
}

]);
