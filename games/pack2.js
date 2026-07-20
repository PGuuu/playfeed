/* PlayFeed 遊戲包 pack2 — 像素猜猜（移植自獨立版）
   啟用方法：在 index.html 的 pack1 底下加一行
   <script src="games/pack2.js"></script>
*/
window.GAMES = (window.GAMES || []).concat([

{
  id: 'pixel-guess', title: '像素猜猜：馬賽克裡是什麼', author: '@眼力檢定所', tip: '圖會慢慢變清楚，越早猜中分越高，猜錯扣 30', bg: '#0f2a1a',
  create(env) {
    const { ctx, setScore, over } = env;
    /* ---- 題庫與參數（與獨立版相同） ---- */
    const POOL = {
      "動物": [["🐶","狗"],["🐱","貓"],["🦊","狐狸"],["🐼","熊貓"],["🐷","豬"],["🐸","青蛙"],["🦁","獅子"],["🐵","猴子"],["🐧","企鵝"],["🦉","貓頭鷹"],["🐢","烏龜"],["🐙","章魚"],["🦀","螃蟹"],["🦋","蝴蝶"],["🐘","大象"],["🦈","鯊魚"],["🐔","雞"],["🦄","獨角獸"]],
      "食物": [["🍕","披薩"],["🍔","漢堡"],["🍟","薯條"],["🍣","壽司"],["🍜","拉麵"],["🍩","甜甜圈"],["🍦","冰淇淋"],["🍎","蘋果"],["🍌","香蕉"],["🍉","西瓜"],["🍓","草莓"],["🥑","酪梨"],["🌽","玉米"],["🍤","炸蝦"],["🥟","餃子"],["🍳","荷包蛋"],["🥦","花椰菜"],["🍇","葡萄"]],
      "東西": [["🚗","汽車"],["✈️","飛機"],["🚀","火箭"],["⌚","手錶"],["📱","手機"],["🎸","吉他"],["🎹","鋼琴"],["⚽","足球"],["🏀","籃球"],["🎮","遊戲手把"],["📷","相機"],["💡","燈泡"],["✂️","剪刀"],["🔑","鑰匙"],["☂️","雨傘"],["👟","球鞋"],["💍","戒指"],["🧻","衛生紙"]]
    };
    const STAGES = [3, 5, 8, 13, 22, 48];
    const STAGE_PTS = [100, 80, 60, 40, 20, 10];
    const STAGE_FRAMES = 114;              /* ≈1.9 秒 */
    const ROUNDS = 6;
    const GOOD = ["天眼！","這也看得出來？","高手","眼力怪物","運氣吧","嗯不錯"];
    const BAD = ["瞎猜喔","-30 心痛嗎","再看清楚","亂按齁"];

    /* ---- 版面（400x700 畫布座標） ---- */
    const IMG = { x: 32, y: 64, s: 336 };
    const BTNS = [
      { x: 20,  y: 496, w: 172, h: 78 },
      { x: 208, y: 496, w: 172, h: 78 },
      { x: 20,  y: 588, w: 172, h: 78 },
      { x: 208, y: 588, w: 172, h: 78 }
    ];
    const C = { bg: '#0f2a1a', panel: '#2e5c3a', mid: '#7fb069', light: '#d8e8a8', hot: '#ff5c8a', ink: '#0b1f13' };

    /* ---- 離屏畫布 ---- */
    const off = document.createElement('canvas');
    off.width = off.height = 128;
    const octx = off.getContext('2d');
    const tiny = document.createElement('canvas');
    const tctx = tiny.getContext('2d');

    /* ---- 狀態 ---- */
    let score, roundNo, stage, stageT, phase, revealT, answer, options, dead, hitIdx, banner, raf, alive;
    const rand = a => a[Math.floor(Math.random() * a.length)];
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

    function renderEmoji(em) {
      octx.clearRect(0, 0, 128, 128);
      octx.font = "100px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
      octx.textAlign = 'center'; octx.textBaseline = 'middle';
      octx.fillText(em, 64, 72);
    }
    function newRound() {
      roundNo++; stage = 0; stageT = STAGE_FRAMES; phase = 'play';
      dead = [false, false, false, false]; hitIdx = -1;
      const cat = rand(Object.keys(POOL));
      const picks = shuffle([...POOL[cat]]).slice(0, 4);
      answer = picks[0];
      options = shuffle([...picks]);
      renderEmoji(answer[0]);
    }
    function reset() { score = 0; roundNo = 0; banner = null; alive = true; newRound(); setScore(0); }
    function showBanner(t, color) { banner = { t, a: 1.4, color: color || C.ink }; }
    function toReveal(msg, color) {
      phase = 'reveal'; revealT = 92; stage = STAGES.length - 1;
      showBanner(msg, color);
    }

    function loop() {
      if (!alive) return;
      if (phase === 'play') {
        if (--stageT <= 0) {
          if (stage < STAGES.length - 1) { stage++; stageT = STAGE_FRAMES; }
          else toReveal('這麼清楚還認不出來… 是' + answer[1], C.hot);
        }
      } else if (phase === 'reveal') {
        if (--revealT <= 0) {
          if (roundNo >= ROUNDS) {
            alive = false; cancelAnimationFrame(raf);
            over(score); return;
          }
          newRound();
        }
      }
      if (banner) { banner.a -= 0.012; if (banner.a <= 0) banner = null; }
      draw();
      raf = requestAnimationFrame(loop);
    }

    function draw() {
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, env.W, env.H);
      /* 標題列 */
      ctx.fillStyle = C.mid; ctx.font = '700 15px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('第 ' + roundNo + ' / ' + ROUNDS + ' 題', 32, 50);
      /* 圖框 */
      ctx.fillStyle = C.panel;
      ctx.beginPath(); ctx.roundRect(IMG.x - 8, IMG.y - 8, IMG.s + 16, IMG.s + 16, 14); ctx.fill();
      const res = STAGES[stage];
      tiny.width = tiny.height = res;
      tctx.imageSmoothingEnabled = true;
      tctx.clearRect(0, 0, res, res);
      tctx.drawImage(off, 0, 0, res, res);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = C.light;
      ctx.fillRect(IMG.x, IMG.y, IMG.s, IMG.s);
      ctx.drawImage(tiny, IMG.x, IMG.y, IMG.s, IMG.s);
      ctx.imageSmoothingEnabled = true;
      /* 階段燈與提示 */
      const dotW = 14, gap = 10, total = STAGES.length * dotW + (STAGES.length - 1) * gap;
      for (let i = 0; i < STAGES.length; i++) {
        ctx.fillStyle = i <= stage ? C.mid : 'rgba(216,232,168,0.18)';
        ctx.beginPath(); ctx.roundRect(env.W/2 - total/2 + i * (dotW + gap), 428, dotW, 14, 3); ctx.fill();
      }
      ctx.fillStyle = C.mid; ctx.font = '500 14px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(phase === 'play' ? '這階段答對 +' + STAGE_PTS[stage] : '答案是「' + answer[1] + '」', env.W/2, 472);
      /* 選項 */
      for (let i = 0; i < 4; i++) {
        const b = BTNS[i];
        const isHit = i === hitIdx || (phase === 'reveal' && options[i] === answer);
        ctx.fillStyle = isHit ? C.mid : C.panel;
        ctx.globalAlpha = dead[i] ? 0.28 : 1;
        ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 12); ctx.fill();
        ctx.fillStyle = isHit ? C.ink : C.light;
        ctx.font = '700 19px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(options[i][1], b.x + b.w/2, b.y + b.h/2);
        if (dead[i]) {
          ctx.strokeStyle = C.hot; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(b.x + 24, b.y + b.h/2); ctx.lineTo(b.x + b.w - 24, b.y + b.h/2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      ctx.textBaseline = 'alphabetic';
      /* 橫幅 */
      if (banner) {
        ctx.globalAlpha = Math.min(1, banner.a);
        ctx.fillStyle = 'rgba(216,232,168,0.92)';
        ctx.font = '800 24px system-ui'; ctx.textAlign = 'center';
        const tw = ctx.measureText(banner.t).width;
        ctx.beginPath(); ctx.roundRect(env.W/2 - tw/2 - 18, IMG.y + IMG.s/2 - 26, tw + 36, 52, 12); ctx.fill();
        ctx.fillStyle = banner.color;
        ctx.fillText(banner.t, env.W/2, IMG.y + IMG.s/2 + 9);
        ctx.globalAlpha = 1;
      }
    }

    return {
      start() { reset(); raf = requestAnimationFrame(loop); },
      stop() { alive = false; cancelAnimationFrame(raf); },
      input(t, x, y) {
        if (t !== 'down' || !alive || phase !== 'play') return;
        for (let i = 0; i < 4; i++) {
          const b = BTNS[i];
          if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h || dead[i]) continue;
          if (options[i] === answer) {
            score += STAGE_PTS[stage]; setScore(score); hitIdx = i;
            beep(700, 1300, 0.14, 0.16);
            toReveal(rand(GOOD) + ' +' + STAGE_PTS[stage], C.ink);
          } else {
            score = Math.max(0, score - 30); setScore(score);
            dead[i] = true;
            beep(260, 90, 0.18, 0.16, 'square');
            showBanner(rand(BAD), C.hot);
            if (dead.filter(Boolean).length >= 3) toReveal('全錯，是' + answer[1], C.hot);
          }
          return;
        }
      }
    };
  }
}

]);
