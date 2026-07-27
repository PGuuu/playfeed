/* PlayFeed 互動故事範例 — 末班雨公車
   操作：點擊翻開故事，再點左／右選項推進；不使用垂直手勢。 */
window.GAMES = (window.GAMES || []).concat([

{
  id: 'last-rain-bus',
  title: '末班雨公車：寫給明天的信',
  author: '@playfeed 官方',
  tip: '點擊翻開故事，再選擇畫面左邊或右邊，走向不同結局',
  bg: '#7ed6df',
  preview: 'cover',
  score: { label: '結局', order: 'higher' },
  remixSlots: [
    { key: 'traveler', label: '旅人', hint: '站在雨夜車站、代表讀者的主角', default: '黃色雨衣旅人', shape: 'tall' },
    { key: 'fox', label: '發光小狐狸', hint: '藏在候車椅下的神祕同行者', default: '藍色發光狐狸', shape: 'free' },
    { key: 'letter', label: '寫給明天的信', hint: '掛在站牌上的白色信封', default: '星星封蠟信', shape: 'wide' },
    { key: 'bus', label: '末班公車', hint: '會駛進天空的雨夜公車', default: '珊瑚紅公車', shape: 'wide' }
  ],

  create(env) {
    const ctx = env.ctx;
    const W = env.W, H = env.H;
    const sprite = env.sprite || (() => false);
    const beep = env.beep || (() => {});
    let raf = 0, alive = false, page = 0, route = '', finalChoice = '';
    let pressed = false, pressX = 0, transition = 0, ending = 0, endingTitle = '';
    let rain = [], stars = [], time = 0;

    const pages = {
      1: {
        kicker: '第一頁 · 雨停以前',
        text: '午夜十二點，城市只剩最後一班公車還沒來。候車椅下有一隻發著微光的小狐狸，站牌上則夾著一封「寫給明天」的信。',
        left: '抱起小狐狸',
        right: '先取下那封信'
      },
      2: {
        kicker: '第二頁 · 沒有路線的車',
        text: '一輛沒有號碼的公車停在你面前。司機指著空白的路線圖說：「今晚只能帶一件重要的東西上車。」',
        left: '相信最初的選擇',
        right: '回頭交換另一件'
      },
      3: {
        kicker: '第三頁 · 城市飛到腳下',
        text: '車窗外的街道慢慢沉下去，公車沿著雨滴駛上天空。下車鈴亮了，遠方同時出現一座熟悉的家，和一道從沒見過的黎明。',
        left: '按鈴，回熟悉的地方',
        right: '不按鈴，坐到最後一站'
      }
    };

    function rounded(x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    }

    function wrap(text, x, y, maxWidth, lineHeight, maxLines) {
      const chars = Array.from(text);
      let line = '', lines = [];
      for (const char of chars) {
        const test = line + char;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = char;
        } else line = test;
      }
      if (line) lines.push(line);
      if (maxLines && lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
        lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…';
      }
      lines.forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight));
      return lines.length;
    }

    function drawRain(alpha) {
      ctx.save();
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = 1.5;
      for (const drop of rain) {
        const y = (drop.y + time * drop.s) % (H + 60) - 30;
        ctx.beginPath();
        ctx.moveTo(drop.x, y);
        ctx.lineTo(drop.x - 7, y + 18);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawSky() {
      const gradient = ctx.createLinearGradient(0, 0, 0, H);
      gradient.addColorStop(0, page >= 3 ? '#4746a3' : '#244d72');
      gradient.addColorStop(.56, page >= 3 ? '#f08ba3' : '#4d8ca8');
      gradient.addColorStop(1, '#f8cf8f');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);
      for (const star of stars) {
        const twinkle = .45 + Math.sin(time * .03 + star.p) * .3;
        ctx.fillStyle = `rgba(255,248,205,${twinkle})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
      drawRain(page >= 3 ? .18 : .35);
    }

    function drawTraveler(x, y, size) {
      if (sprite('traveler', x, y, size)) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = '#ffd84f';
      ctx.beginPath();
      ctx.arc(0, -size * .25, size * .18, Math.PI, 0);
      ctx.lineTo(size * .27, size * .36);
      ctx.lineTo(-size * .27, size * .36);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#26374a';
      ctx.beginPath(); ctx.arc(-size * .06, -size * .25, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(size * .06, -size * .25, 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function drawFox(x, y, size) {
      if (sprite('fox', x, y, size)) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.shadowColor = '#8ff6ff';
      ctx.shadowBlur = 22;
      ctx.fillStyle = '#70e1f5';
      ctx.beginPath();
      ctx.moveTo(-size * .28, -size * .1);
      ctx.lineTo(-size * .2, -size * .38);
      ctx.lineTo(-size * .03, -size * .22);
      ctx.lineTo(size * .2, -size * .38);
      ctx.lineTo(size * .28, -size * .08);
      ctx.quadraticCurveTo(size * .2, size * .27, 0, size * .3);
      ctx.quadraticCurveTo(-size * .24, size * .2, -size * .28, -size * .1);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#173e5a';
      ctx.beginPath(); ctx.arc(-size * .08, -size * .06, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(size * .08, -size * .06, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function drawLetter(x, y, size) {
      if (sprite('letter', x, y, size)) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-.08);
      ctx.fillStyle = '#fff9e9';
      ctx.strokeStyle = '#d9cba6';
      ctx.lineWidth = 2;
      rounded(-size * .45, -size * .27, size * .9, size * .54, 5);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size * .43, -size * .23);
      ctx.lineTo(0, size * .05);
      ctx.lineTo(size * .43, -size * .23);
      ctx.stroke();
      ctx.fillStyle = '#ef6f7b';
      ctx.beginPath(); ctx.arc(0, size * .05, size * .1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff1a8';
      ctx.font = `700 ${Math.round(size * .12)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('★', 0, size * .05);
      ctx.restore();
    }

    function drawBus(x, y, size) {
      if (sprite('bus', x, y, size)) return;
      ctx.save();
      ctx.translate(x, y);
      const w = size, h = size * .48;
      ctx.fillStyle = '#f36f67';
      rounded(-w / 2, -h / 2, w, h, 14);
      ctx.fill();
      ctx.fillStyle = '#bff0f0';
      for (let i = 0; i < 4; i++) {
        rounded(-w * .37 + i * w * .19, -h * .32, w * .14, h * .34, 4);
        ctx.fill();
      }
      ctx.fillStyle = '#26374a';
      ctx.beginPath(); ctx.arc(-w * .3, h * .47, h * .13, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(w * .3, h * .47, h * .13, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function drawCover() {
      drawSky();
      ctx.fillStyle = 'rgba(15,30,53,.25)';
      ctx.fillRect(0, H * .69, W, H * .31);
      ctx.fillStyle = '#1c2d3c';
      ctx.fillRect(45, 420, 12, 190);
      ctx.fillRect(45, 425, 180, 12);
      ctx.fillStyle = '#ffdf73';
      rounded(69, 450, 125, 54, 8); ctx.fill();
      ctx.fillStyle = '#17304b';
      ctx.font = '800 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('末班車', 131, 484);
      drawTraveler(115, 585, 105);
      drawFox(265, 575, 75);
      drawLetter(318, 440, 62);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,.3)';
      ctx.shadowBlur = 12;
      ctx.font = '900 34px sans-serif';
      ctx.fillText('末班雨公車', W / 2, 116);
      ctx.font = '700 16px sans-serif';
      ctx.fillStyle = '#fff6cb';
      ctx.fillText('寫給明天的信', W / 2, 151);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.font = '600 13px sans-serif';
      ctx.fillText('點一下翻開故事', W / 2, 665);
    }

    function drawChoice(x, y, w, h, label, active) {
      ctx.save();
      ctx.fillStyle = active ? 'rgba(255,239,171,.96)' : 'rgba(255,255,255,.88)';
      ctx.strokeStyle = active ? '#ef9b68' : 'rgba(255,255,255,.72)';
      ctx.lineWidth = active ? 3 : 1;
      rounded(x, y, w, h, 17); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#21364a';
      ctx.font = '800 15px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      wrap(label, x + w / 2, y + h / 2 - 3, w - 24, 20, 2);
      ctx.restore();
    }

    function drawStoryPage() {
      drawSky();
      if (page === 1) {
        ctx.fillStyle = 'rgba(24,45,65,.35)'; ctx.fillRect(0, 455, W, 245);
        drawTraveler(90, 445, 88); drawFox(210, 438, 72); drawLetter(315, 363, 62);
      } else if (page === 2) {
        drawBus(205, 360, 255);
        if (route === 'fox') drawFox(112, 460, 70);
        else drawLetter(112, 455, 70);
        drawTraveler(280, 470, 88);
      } else {
        drawBus(205 + Math.sin(time * .02) * 6, 325, 245);
        drawTraveler(122, 438, 78);
        if (route === 'fox') drawFox(250, 438, 65);
        else drawLetter(255, 430, 65);
      }

      const data = pages[page];
      ctx.fillStyle = 'rgba(20,34,56,.82)';
      rounded(24, 40, W - 48, 235, 22); ctx.fill();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#8ff0e3';
      ctx.font = '800 12px sans-serif';
      ctx.fillText(data.kicker, 45, 72);
      ctx.fillStyle = '#fff';
      ctx.font = '700 18px sans-serif';
      wrap(data.text, 45, 110, W - 90, 30, 5);

      const activeLeft = pressed && pressX < W / 2;
      const activeRight = pressed && pressX >= W / 2;
      drawChoice(20, 570, 174, 82, data.left, activeLeft);
      drawChoice(206, 570, 174, 82, data.right, activeRight);
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.font = '600 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('點左邊或右邊，替故事做選擇', W / 2, 680);
    }

    function chooseEnding() {
      if (finalChoice === 'home' && route === 'fox') {
        ending = 1; endingTitle = '被留一盞燈的家';
      } else if (finalChoice === 'home') {
        ending = 2; endingTitle = '明天寄來的回信';
      } else if (route === 'fox') {
        ending = 3; endingTitle = '把黎明帶回城市';
      } else {
        ending = 4; endingTitle = '最後一站叫作勇氣';
      }
      beep(520, 1040, .32, .12, 'sine');
    }

    function endingText() {
      if (ending === 1) return '你在熟悉的巷口下車。小狐狸跳進窗邊那盞一直亮著的燈，原來有人相信你今晚一定會回來。';
      if (ending === 2) return '信封在家門前化成清晨的霧。門縫裡躺著一封新的回信，上面只有一句：「謝謝你沒有忘記明天。」';
      if (ending === 3) return '最後一站沒有月台，只有第一道晨光。小狐狸甩了甩尾巴，整座城市的屋頂便一盞一盞亮了起來。';
      return '你把信交給黎明。空白的紙上慢慢浮出你的筆跡：「不知道答案也沒關係，我還是會往前坐一站。」';
    }

    function drawEnding() {
      drawSky();
      drawBus(200, 260, 275);
      if (route === 'fox') drawFox(200, 390, 95);
      else drawLetter(200, 390, 100);
      ctx.fillStyle = 'rgba(17,31,55,.84)';
      rounded(28, 440, W - 56, 205, 24); ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#9df3e4';
      ctx.font = '800 12px sans-serif';
      ctx.fillText(`結局 ${ending}／4`, W / 2, 475);
      ctx.fillStyle = '#fff';
      ctx.font = '900 23px sans-serif';
      ctx.fillText(endingTitle, W / 2, 514);
      ctx.font = '600 15px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      wrap(endingText(), W / 2, 552, W - 105, 25, 4);
      ctx.fillStyle = '#ffe7a6';
      ctx.font = '700 12px sans-serif';
      ctx.fillText('點一下收起故事', W / 2, 674);
    }

    function draw() {
      if (!alive) return;
      time++;
      if (page === 0) drawCover();
      else if (page <= 3) drawStoryPage();
      else drawEnding();
      if (transition > 0) {
        transition -= .08;
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0, transition)})`;
        ctx.fillRect(0, 0, W, H);
      }
      raf = requestAnimationFrame(draw);
    }

    function advance(left) {
      beep(left ? 430 : 620, left ? 650 : 880, .09, .07, 'sine');
      transition = .7;
      if (page === 0) {
        page = 1;
      } else if (page === 1) {
        route = left ? 'fox' : 'letter';
        page = 2;
      } else if (page === 2) {
        if (left) route = route === 'fox' ? 'fox' : 'letter';
        else route = route === 'fox' ? 'letter' : 'fox';
        page = 3;
      } else if (page === 3) {
        finalChoice = left ? 'home' : 'last-stop';
        chooseEnding();
        page = 4;
        env.setScore(ending);
      } else {
        alive = false;
        cancelAnimationFrame(raf);
        env.over(ending);
      }
    }

    function start() {
      cancelAnimationFrame(raf);
      page = 0; route = ''; finalChoice = ''; ending = 0; endingTitle = '';
      pressed = false; transition = 0; time = 0; alive = true;
      rain = Array.from({ length: 46 }, () => ({
        x: Math.random() * W, y: Math.random() * H, s: 2.4 + Math.random() * 3.8
      }));
      stars = Array.from({ length: 34 }, () => ({
        x: 18 + Math.random() * (W - 36), y: 25 + Math.random() * 330,
        r: .6 + Math.random() * 1.4, p: Math.random() * Math.PI * 2
      }));
      env.setScore(0);
      draw();
    }

    function stop() {
      alive = false;
      pressed = false;
      cancelAnimationFrame(raf);
    }

    function input(type, x) {
      if (!alive) return;
      if (type === 'cancel') {
        pressed = false;
        return;
      }
      if (type === 'down') {
        pressed = true;
        pressX = x;
      } else if (type === 'move' && pressed) {
        pressX = x;
      } else if (type === 'up' && pressed) {
        const left = pressX < W / 2;
        pressed = false;
        advance(left);
      }
    }

    return { start, stop, input };
  }
}

]);
