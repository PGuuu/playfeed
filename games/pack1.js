/* PlayFeed 遊戲包 pack1 — 十款示範遊戲
   新增一批遊戲 = 複製這個檔案改名 pack2.js，換掉裡面的遊戲，
   然後在 index.html 的遊戲包清單加一行 <script src="games/pack2.js"></script>
*/
window.GAMES = (window.GAMES || []).concat([

/* 1. 毛怪過馬路：左右閃避 + 貼身加分 */
{
  id: 'dodge', title: '毛怪過馬路：離車越近分越高', author: '@playfeed 官方', tip: '點左右半邊移動，貼著車走有加分', bg: '#8a8a8a',
  create(env) {
    const { ctx, setScore, over } = env;
    const LANES = 3, LW = W / LANES, PY = H - 110;
    const colors = ['#e6c229','#c0392b','#2e6da4','#4a7c3a','#8e5aa8'];
    let lane, px, cars, score, frames, spawnT, raf, alive;
    const lx = l => LW * l + LW / 2;
    function reset() { lane = 1; px = lx(1); cars = []; score = 0; frames = 0; spawnT = 0; alive = true; }
    function loop() {
      frames++;
      px += (lx(lane) - px) * 0.35;
      if (--spawnT <= 0) {
        const l = Math.floor(Math.random() * LANES);
        if (!cars.some(c => c.lane === l && c.y < 120)) cars.push({ lane: l, y: -110, c: colors[Math.floor(Math.random()*colors.length)], grazed: false });
        spawnT = Math.max(28, 66 - Math.floor(frames / 150) * 4);
      }
      const sp = 4 + frames / 800;
      let danger = 0;
      for (const c of cars) {
        c.y += sp;
        const dx = Math.abs(lx(c.lane) - px);
        if (c.y + 100 > PY - 130 && c.y < PY + 60) {
          danger = Math.max(danger, Math.max(0, 1 - dx / (LW * 1.4)));
        }
        if (dx < LW * 0.42 && PY > c.y + 12 && PY < c.y + 112) { die(); return; }
        if (!c.grazed && c.y > PY && dx < LW * 1.15 && dx > LW * 0.42) {
          c.grazed = true;
          const b = Math.round(35 * (1 - (dx - LW * 0.42) / (LW * 0.73)));
          if (b > 4) { score += b; beep(700, 1300, 0.12, 0.14); }
        }
      }
      cars = cars.filter(c => c.y < H + 140);
      score += (1 + danger * 4) * 0.16;
      setScore(Math.floor(score));
      /* draw */
      ctx.fillStyle = '#8a8a8a'; ctx.fillRect(0, 0, W, H);
      if (danger > 0.55) { ctx.fillStyle = `rgba(200,40,40,${(danger-0.55)*0.3})`; ctx.fillRect(0,0,W,H); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.setLineDash([28, 24]);
      for (let i = 1; i < LANES; i++) { ctx.beginPath(); ctx.moveTo(LW*i, 0); ctx.lineTo(LW*i, H); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 7; i++) ctx.fillRect(i*60+10, H-96, 42, 16);
      for (const c of cars) {
        const x = lx(c.lane) - LW*0.31;
        ctx.fillStyle = c.c;
        ctx.beginPath(); ctx.roundRect(x, c.y, LW*0.62, 100, 12); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.roundRect(x+9, c.y+12, LW*0.62-18, 22, 6); ctx.fill();
      }
      const jit = danger > 0.6 ? (Math.random()-0.5) * danger * 5 : 0, X = px + jit;
      ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.arc(X, PY, 30, 0, 7); ctx.fill();
      ctx.fillStyle = '#3a3a3a';
      for (let i = 0; i < 8; i++) { const a = i/8*6.283; ctx.beginPath(); ctx.arc(X+Math.cos(a)*23, PY+Math.sin(a)*23, 10, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X-10, PY-5, 7, 0, 7); ctx.arc(X+10, PY-5, 7, 0, 7); ctx.fill();
      ctx.fillStyle = '#111'; const p = 3 + danger * 2;
      ctx.beginPath(); ctx.arc(X-9, PY-5, p, 0, 7); ctx.arc(X+11, PY-5, p, 0, 7); ctx.fill();
      if (alive) raf = requestAnimationFrame(loop);
    }
    function die() {
      alive = false; cancelAnimationFrame(raf);
      beep(160, 40, 0.3, 0.25, 'sawtooth');
      over(Math.floor(score));
    }
    return {
      start() { reset(); raf = requestAnimationFrame(loop); },
      stop() { alive = false; cancelAnimationFrame(raf); },
      input(t, x) { if (t === 'down' && alive) lane = Math.max(0, Math.min(LANES-1, lane + (x < W/2 ? -1 : 1))); }
    };
  }
},

/* 2. 珍珠快接：拖曳杯子接珍珠，別接到炸彈 */
{
  id: 'boba', title: '珍珠快接：手搖店打工日常', author: '@奶茶研究所', tip: '左右拖曳杯子，接珍珠、閃炸彈', bg: '#f3e2c8',
  create(env) {
    const { ctx, setScore, over } = env;
    let cupX, items, score, lives, frames, raf, alive, spawnT;
    function reset() { cupX = W/2; items = []; score = 0; lives = 3; frames = 0; spawnT = 0; alive = true; }
    function loop() {
      frames++;
      if (--spawnT <= 0) {
        const bomb = Math.random() < Math.min(0.32, 0.1 + frames/3000);
        items.push({ x: 40 + Math.random()*(W-80), y: -20, bomb, vy: 3.5 + frames/700 + Math.random()*1.5 });
        spawnT = Math.max(16, 42 - Math.floor(frames/200)*3);
      }
      const cupY = H - 130;
      for (const it of items) {
        it.y += it.vy;
        if (it.y > cupY - 14 && it.y < cupY + 40 && Math.abs(it.x - cupX) < 52) {
          it.hit = true;
          if (it.bomb) { lose(); }
          else { score += 10; setScore(score); beep(600 + Math.random()*300, 1100, 0.08, 0.12); }
        } else if (!it.bomb && it.y > H + 20) {
          it.hit = true; lose();
        }
      }
      items = items.filter(it => !it.hit && it.y < H + 40);
      /* draw */
      ctx.fillStyle = '#f3e2c8'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#e8d2ae';
      for (let i = 0; i < 5; i++) ctx.fillRect(0, i*160+30, W, 14);
      for (const it of items) {
        if (it.bomb) {
          ctx.fillStyle = '#33313b'; ctx.beginPath(); ctx.arc(it.x, it.y, 16, 0, 7); ctx.fill();
          ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(it.x+8, it.y-12); ctx.lineTo(it.x+16, it.y-22); ctx.stroke();
        } else {
          ctx.fillStyle = '#3a2417'; ctx.beginPath(); ctx.arc(it.x, it.y, 13, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(it.x-4, it.y-4, 4, 0, 7); ctx.fill();
        }
      }
      /* cup */
      ctx.fillStyle = 'rgba(190,140,80,0.35)';
      ctx.beginPath(); ctx.moveTo(cupX-52, cupY-10); ctx.lineTo(cupX+52, cupY-10); ctx.lineTo(cupX+40, cupY+80); ctx.lineTo(cupX-40, cupY+80); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = '#c9915a';
      ctx.fillRect(cupX-46, cupY+40, 92, 36);
      /* lives */
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i < lives ? '#d85a30' : 'rgba(0,0,0,0.15)';
        ctx.beginPath(); ctx.arc(28 + i*30, 30, 9, 0, 7); ctx.fill();
      }
      if (alive) raf = requestAnimationFrame(loop);
    }
    function lose() {
      lives--; beep(300, 90, 0.2, 0.2, 'square');
      if (lives <= 0) { alive = false; cancelAnimationFrame(raf); over(score); }
    }
    return {
      start() { reset(); raf = requestAnimationFrame(loop); },
      stop() { alive = false; cancelAnimationFrame(raf); },
      input(t, x) { if ((t === 'down' || t === 'move') && alive) cupX = Math.max(52, Math.min(W-52, x)); }
    };
  }
},

/* 3. 對頻打卡：指針掃過綠區時點擊 */
{
  id: 'timing', title: '對頻打卡：手速與節奏', author: '@節奏檢定中心', tip: '指針進綠區的瞬間點擊，連續命中倍率翻倍', bg: '#1d2430',
  create(env) {
    const { ctx, setScore, over } = env;
    let ang, sp, zoneA, zoneW, score, combo, misses, raf, alive, flash;
    function reset() { ang = 0; sp = 0.035; zoneA = Math.random()*6.283; zoneW = 0.85; score = 0; combo = 0; misses = 0; alive = true; flash = 0; }
    function norm(a) { a %= 6.283; return a < 0 ? a + 6.283 : a; }
    function loop() {
      ang = norm(ang + sp); flash *= 0.9;
      const cx = W/2, cy = H/2 - 30, R = 130;
      ctx.fillStyle = '#1d2430'; ctx.fillRect(0, 0, W, H);
      if (flash > 0.02) { ctx.fillStyle = `rgba(120,220,140,${flash*0.25})`; ctx.fillRect(0,0,W,H); }
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 26;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.stroke();
      ctx.strokeStyle = '#57c96b'; 
      ctx.beginPath(); ctx.arc(cx, cy, R, zoneA, zoneA + zoneW); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(ang)*(R-30), cy + Math.sin(ang)*(R-30));
      ctx.lineTo(cx + Math.cos(ang)*(R+30), cy + Math.sin(ang)*(R+30)); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '600 46px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('x' + (combo + 1), cx, cy + 14);
      ctx.font = '500 15px system-ui'; ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText('連擊倍率', cx, cy + 42);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i < 3 - misses ? '#e0355f' : 'rgba(255,255,255,0.15)';
        ctx.beginPath(); ctx.arc(cx - 30 + i*30, cy + R + 70, 9, 0, 7); ctx.fill();
      }
      if (alive) raf = requestAnimationFrame(loop);
    }
    return {
      start() { reset(); raf = requestAnimationFrame(loop); },
      stop() { alive = false; cancelAnimationFrame(raf); },
      input(t) {
        if (t !== 'down' || !alive) return;
        const d = norm(ang - zoneA);
        if (d >= 0 && d <= zoneW) {
          combo++; score += 10 * combo; setScore(score); flash = 1;
          beep(500 + combo*60, 900 + combo*80, 0.1, 0.15);
          zoneA = norm(zoneA + 2 + Math.random()*2.5);
          zoneW = Math.max(0.32, zoneW - 0.03);
          sp = Math.min(0.09, sp + 0.002) * (Math.random() < 0.25 ? -1 : 1) * Math.sign(sp || 1);
          sp = Math.abs(sp) * (Math.random() < 0.2 ? -1 : Math.sign(sp));
        } else {
          combo = 0; misses++;
          beep(220, 80, 0.18, 0.18, 'square');
          if (misses >= 3) { alive = false; cancelAnimationFrame(raf); over(score); }
        }
      }
    };
  }
},

/* 4. 泡泡上升：點擊上浮，穿過縫隙 */
{
  id: 'bubble', title: '泡泡上升：辦公室逃脫', author: '@社畜救援隊', tip: '點一下浮一下，穿過縫隙別破掉', bg: '#12333f',
  create(env) {
    const { ctx, setScore, over } = env;
    let y, vy, walls, score, frames, raf, alive;
    function reset() { y = H/2; vy = 0; walls = []; score = 0; frames = 0; alive = true; }
    function loop() {
      frames++;
      vy += 0.32; y += vy;
      if (frames % 95 === 0) {
        const gap = Math.max(170, 240 - frames/40);
        const gy = 90 + Math.random() * (H - 180 - gap);
        walls.push({ x: W + 40, gy, gap, passed: false });
      }
      const sp = 3.4 + frames/1200;
      for (const w of walls) {
        w.x -= sp;
        if (!w.passed && w.x < W*0.3 - 24) {
          w.passed = true; score++; setScore(score);
          beep(700 + score*25, 1000 + score*25, 0.09, 0.13);
        }
        if (Math.abs(w.x - W*0.3) < 44 && (y - 20 < w.gy || y + 20 > w.gy + w.gap)) { die(); return; }
      }
      walls = walls.filter(w => w.x > -60);
      if (y < 18 || y > H - 18) { die(); return; }
      /* draw */
      ctx.fillStyle = '#12333f'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let i = 0; i < 6; i++) ctx.fillRect(((frames*0.4 + i*90) % (W+60)) - 60, 60 + i*105, 46, 16);
      ctx.fillStyle = '#28566b';
      for (const w of walls) {
        ctx.fillRect(w.x - 26, 0, 52, w.gy);
        ctx.fillRect(w.x - 26, w.gy + w.gap, 52, H);
        ctx.fillStyle = '#356e88';
        ctx.fillRect(w.x - 26, w.gy - 14, 52, 14);
        ctx.fillRect(w.x - 26, w.gy + w.gap, 52, 14);
        ctx.fillStyle = '#28566b';
      }
      const bx = W*0.3;
      ctx.fillStyle = 'rgba(150,220,255,0.85)';
      ctx.beginPath(); ctx.arc(bx, y, 20, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(bx - 7, y - 7, 6, 0, 7); ctx.fill();
      if (alive) raf = requestAnimationFrame(loop);
    }
    function die() {
      alive = false; cancelAnimationFrame(raf);
      beep(500, 60, 0.3, 0.22, 'sawtooth');
      over(score);
    }
    return {
      start() { reset(); raf = requestAnimationFrame(loop); },
      stop() { alive = false; cancelAnimationFrame(raf); },
      input(t) { if (t === 'down' && alive) { vy = -6.4; beep(300, 460, 0.07, 0.08); } }
    };
  }
},

/* 5. 疊高高：點擊放下滑動的樓層 */
{
  id: 'stack', title: '疊高高：違章建築大賽', author: '@都更小組', tip: '樓層對準的瞬間點擊放下，歪掉會越疊越窄', bg: '#241d33',
  create(env) {
    const { ctx, setScore, over } = env;
    let tower, cur, dir, score, raf, alive, camY;
    const BH = 42;
    const palette = ['#7f77dd','#d4537e','#1d9e75','#ef9f27','#378add'];
    function reset() {
      tower = [{ x: W/2 - 90, w: 180 }];
      score = 0; camY = 0; alive = true;
      newBlock();
    }
    function newBlock() {
      const top = tower[tower.length - 1];
      cur = { x: -top.w, w: top.w, y: 0 };
      dir = 3 + score * 0.12;
    }
    function loop() {
      cur.x += dir;
      if (cur.x < -cur.w - 10 || cur.x > W + 10) dir = -dir;
      const targetCam = Math.max(0, tower.length * BH - 320);
      camY += (targetCam - camY) * 0.1;
      ctx.fillStyle = '#241d33'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      for (let i = 0; i < 30; i++) ctx.fillRect((i*73)%W, (i*131)%H, 2, 2);
      const base = H - 90;
      for (let i = 0; i < tower.length; i++) {
        const b = tower[i];
        ctx.fillStyle = palette[i % palette.length];
        ctx.fillRect(b.x, base - (i+1)*BH + camY, b.w, BH - 3);
      }
      ctx.fillStyle = palette[tower.length % palette.length];
      ctx.fillRect(cur.x, base - (tower.length+1)*BH + camY, cur.w, BH - 3);
      if (alive) raf = requestAnimationFrame(loop);
    }
    return {
      start() { reset(); raf = requestAnimationFrame(loop); },
      stop() { alive = false; cancelAnimationFrame(raf); },
      input(t) {
        if (t !== 'down' || !alive) return;
        const top = tower[tower.length - 1];
        const L = Math.max(cur.x, top.x), R = Math.min(cur.x + cur.w, top.x + top.w);
        const wNew = R - L;
        if (wNew <= 8) {
          alive = false; cancelAnimationFrame(raf);
          beep(400, 50, 0.35, 0.25, 'sawtooth');
          over(score); return;
        }
        const perfect = wNew > cur.w - 6;
        tower.push({ x: L, w: perfect ? cur.w : wNew });
        if (perfect) { score += 3; beep(900, 1500, 0.12, 0.16); }
        else { score += 1; beep(500, 750, 0.08, 0.12); }
        setScore(score);
        newBlock();
      }
    };
  }
},

/* 6. 打地鼠：點地鼠別點炸彈 */
{
  id: 'mole', title: '打地鼠：下班壓力釋放', author: '@打卡下班委員會', tip: '點地鼠加分、炸彈別碰，讓地鼠跑掉會扣命', bg: '#3f6b3a',
  create(env) {
    const { ctx, setScore, over } = env;
    const cols = [72, 200, 328], rows = [210, 370, 530];
    let moles, score, misses, frames, spawnT, raf, alive;
    function reset() { moles = []; score = 0; misses = 0; frames = 0; spawnT = 26; alive = true; }
    function end() { alive = false; cancelAnimationFrame(raf); beep(300, 60, 0.3, 0.22, 'sawtooth'); over(score); }
    function loop() {
      frames++;
      if (--spawnT <= 0) {
        const free = [];
        for (let i = 0; i < 9; i++) if (!moles.some(m => m.cell === i)) free.push(i);
        if (free.length) moles.push({
          cell: free[Math.floor(Math.random()*free.length)],
          t: Math.max(42, 85 - frames/50), bomb: Math.random() < 0.2, pop: 0
        });
        spawnT = Math.max(16, 44 - Math.floor(frames/280)*4);
      }
      for (const m of moles) {
        m.pop = Math.min(1, m.pop + 0.15);
        if (--m.t <= 0) {
          m.dead = true;
          if (!m.bomb) {
            misses++; beep(240, 90, 0.15, 0.15, 'square');
            if (misses >= 3) { end(); return; }
          }
        }
      }
      moles = moles.filter(m => !m.dead);
      ctx.fillStyle = '#3f6b3a'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      for (let i = 0; i < 14; i++) ctx.fillRect((i*61)%W, (i*127)%H, 20, 5);
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = '#26421f';
        ctx.beginPath(); ctx.ellipse(cols[i%3], rows[(i/3)|0] + 26, 48, 20, 0, 0, 7); ctx.fill();
      }
      for (const m of moles) {
        const x = cols[m.cell%3], y = rows[(m.cell/3)|0] - m.pop * 26 + 10;
        if (m.bomb) {
          ctx.fillStyle = '#26262e'; ctx.beginPath(); ctx.arc(x, y, 30, 0, 7); ctx.fill();
          ctx.strokeStyle = '#e24b4a'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(x-11, y-11); ctx.lineTo(x+11, y+11);
          ctx.moveTo(x+11, y-11); ctx.lineTo(x-11, y+11); ctx.stroke();
        } else {
          ctx.fillStyle = '#7a5230'; ctx.beginPath(); ctx.arc(x, y, 30, 0, 7); ctx.fill();
          ctx.fillStyle = '#a8794f'; ctx.beginPath(); ctx.arc(x, y+9, 17, 0, 7); ctx.fill();
          ctx.fillStyle = '#111';
          ctx.beginPath(); ctx.arc(x-10, y-6, 4, 0, 7); ctx.arc(x+10, y-6, 4, 0, 7); ctx.fill();
          ctx.fillStyle = '#e58a8a'; ctx.beginPath(); ctx.arc(x, y+3, 5, 0, 7); ctx.fill();
        }
      }
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i < 3 - misses ? '#e0355f' : 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.arc(28 + i*30, 90, 9, 0, 7); ctx.fill();
      }
      if (alive) raf = requestAnimationFrame(loop);
    }
    return {
      start() { reset(); raf = requestAnimationFrame(loop); },
      stop() { alive = false; cancelAnimationFrame(raf); },
      input(t, x, y) {
        if (t !== 'down' || !alive) return;
        for (const m of moles) {
          const mx = cols[m.cell%3], my = rows[(m.cell/3)|0] - m.pop * 26 + 10;
          if ((x-mx)*(x-mx) + (y-my)*(y-my) < 44*44) {
            if (m.bomb) { end(); return; }
            m.dead = true; score += 10; setScore(score);
            beep(500 + Math.random()*250, 950, 0.09, 0.14);
            return;
          }
        }
      }
    };
  }
},

/* 7. 一二三木頭人：按住前進，紅燈別動 */
{
  id: 'redlight', title: '一二三木頭人：膽量測試', author: '@操場守門員', tip: '按住前進、放開停下，紅燈還在動就出局', bg: '#c9b98f',
  create(env) {
    const { ctx, setScore, over } = env;
    let y, holding, light, lt, redAge, rounds, score, raf, alive, stepT;
    function reset() { y = H - 120; holding = false; light = 'green'; lt = 120; redAge = 0; rounds = 0; score = 0; stepT = 0; alive = true; }
    function loop() {
      lt--;
      if (light === 'red') redAge++;
      if (lt <= 0) {
        if (light === 'green') { light = 'warn'; lt = Math.max(18, 34 - rounds*2); beep(700, 700, 0.1, 0.12); }
        else if (light === 'warn') { light = 'red'; redAge = 0; lt = 55 + Math.random()*70; beep(320, 200, 0.25, 0.18, 'square'); }
        else { light = 'green'; lt = 60 + Math.random()*100; beep(500, 800, 0.12, 0.12); }
      }
      if (holding && alive) {
        if (light === 'red' && redAge > 9) { die(); return; }
        y -= 3 + rounds * 0.35;
        if (--stepT <= 0) { beep(180, 160, 0.04, 0.05); stepT = 10; }
      }
      if (y <= 130) {
        rounds++; score += 50 + rounds * 10; setScore(score);
        beep(800, 1400, 0.2, 0.16); y = H - 120;
      }
      /* draw */
      ctx.fillStyle = '#c9b98f'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(120,90,50,0.35)'; ctx.lineWidth = 3; ctx.setLineDash([14, 18]);
      for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(W/4*i, 150); ctx.lineTo(W/4*i, H); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.fillStyle = '#8a5a2b'; ctx.fillRect(0, 118, W, 10);
      const lc = light === 'green' ? '#57c96b' : light === 'warn' ? '#f0c33c' : '#e24b4a';
      ctx.fillStyle = '#33313b'; ctx.beginPath(); ctx.arc(W/2, 66, 40, 0, 7); ctx.fill();
      ctx.fillStyle = lc; ctx.beginPath(); ctx.arc(W/2, 66, 26, 0, 7); ctx.fill();
      ctx.fillStyle = '#f8f8f8'; ctx.font = '600 16px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(light === 'red' ? '木頭人！' : '一二三…', W/2, 66 - 52);
      const wob = holding && light !== 'red' ? Math.sin(Date.now()/60) * 4 : 0;
      ctx.fillStyle = '#2b2b2b';
      ctx.beginPath(); ctx.arc(W/2 + wob, y - 26, 16, 0, 7); ctx.fill();
      ctx.fillRect(W/2 - 9 + wob, y - 12, 18, 34);
      ctx.fillRect(W/2 - 9 + wob, y + 22, 7, 20);
      ctx.fillRect(W/2 + 2 + wob, y + 22, 7, 20);
      if (alive) raf = requestAnimationFrame(loop);
    }
    function die() {
      alive = false; cancelAnimationFrame(raf);
      beep(400, 50, 0.4, 0.25, 'sawtooth');
      over(score);
    }
    return {
      start() { reset(); raf = requestAnimationFrame(loop); },
      stop() { alive = false; cancelAnimationFrame(raf); },
      input(t) { if (t === 'down') holding = true; if (t === 'up') holding = false; }
    };
  }
},

/* 8. 快刀切水果：滑動切，炸彈別切 */
{
  id: 'slice', title: '快刀切水果：手滑注意', author: '@夜市快刀手', tip: '手指滑過水果就能切，切到炸彈直接結束', bg: '#20242e',
  create(env) {
    const { ctx, setScore, over } = env;
    const colors = ['#e24b4a','#ef9f27','#97c459','#d4537e','#f0c33c'];
    let fruits, trail, score, lives, frames, spawnT, raf, alive;
    function reset() { fruits = []; trail = []; score = 0; lives = 3; frames = 0; spawnT = 40; alive = true; }
    function end() { alive = false; cancelAnimationFrame(raf); beep(200, 40, 0.4, 0.25, 'sawtooth'); over(score); }
    function loop() {
      frames++;
      if (--spawnT <= 0) {
        const n = 1 + (Math.random() < 0.4 ? 1 : 0) + (Math.random() < 0.15 ? 1 : 0);
        for (let i = 0; i < n; i++) fruits.push({
          x: 60 + Math.random()*(W-120), y: H + 30,
          vx: (Math.random()-0.5)*4, vy: -(13 + Math.random()*4),
          r: 26, c: colors[Math.floor(Math.random()*colors.length)],
          bomb: Math.random() < 0.18
        });
        spawnT = Math.max(30, 60 - Math.floor(frames/400)*5);
      }
      for (const f of fruits) {
        f.vy += 0.28; f.x += f.vx; f.y += f.vy;
        if (f.y > H + 60 && f.vy > 0) {
          f.dead = true;
          if (!f.bomb) {
            lives--; beep(240, 90, 0.15, 0.15, 'square');
            if (lives <= 0) { end(); return; }
          }
        }
      }
      fruits = fruits.filter(f => !f.dead);
      for (const p of trail) p.a -= 0.07;
      trail = trail.filter(p => p.a > 0);
      /* draw */
      ctx.fillStyle = '#20242e'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let i = 0; i < 20; i++) ctx.fillRect((i*83)%W, (i*149)%H, 2, 2);
      for (const f of fruits) {
        if (f.bomb) {
          ctx.fillStyle = '#26262e'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill();
          ctx.strokeStyle = '#e24b4a'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(f.x + 12, f.y - 18); ctx.lineTo(f.x + 22, f.y - 32); ctx.stroke();
          ctx.fillStyle = '#f0c33c'; ctx.beginPath(); ctx.arc(f.x + 24, f.y - 34, 4, 0, 7); ctx.fill();
        } else {
          ctx.fillStyle = f.c; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.beginPath(); ctx.arc(f.x - 8, f.y - 8, 8, 0, 7); ctx.fill();
        }
      }
      if (trail.length > 1) {
        ctx.lineCap = 'round';
        for (let i = 1; i < trail.length; i++) {
          ctx.strokeStyle = `rgba(255,255,255,${trail[i].a})`;
          ctx.lineWidth = 6 * trail[i].a + 1;
          ctx.beginPath(); ctx.moveTo(trail[i-1].x, trail[i-1].y);
          ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke();
        }
      }
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i < lives ? '#e0355f' : 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.arc(28 + i*30, 90, 9, 0, 7); ctx.fill();
      }
      if (alive) raf = requestAnimationFrame(loop);
    }
    function cut(x, y) {
      for (const f of fruits) {
        if (f.dead) continue;
        if ((x-f.x)*(x-f.x) + (y-f.y)*(y-f.y) < (f.r+10)*(f.r+10)) {
          if (f.bomb) { end(); return; }
          f.dead = true; score += 10; setScore(score);
          beep(600 + Math.random()*400, 1300, 0.08, 0.13);
        }
      }
    }
    return {
      start() { reset(); raf = requestAnimationFrame(loop); },
      stop() { alive = false; cancelAnimationFrame(raf); },
      input(t, x, y) {
        if (!alive) return;
        if (t === 'down' || t === 'move') {
          trail.push({ x, y, a: 1 });
          if (trail.length > 24) trail.shift();
          cut(x, y);
        }
        if (t === 'up') trail = [];
      }
    };
  }
},

/* 9. 閃電反應：變綠瞬間點下去 */
{
  id: 'react', title: '閃電反應：毫秒之戰', author: '@神經科實驗室', tip: '變綠的瞬間點下去，偷跑直接出局', bg: '#2a1f2e',
  create(env) {
    const { ctx, setScore, over } = env;
    let state, waitT, goStart, goT, score, round, lastMs, raf, alive;
    function reset() { state = 'wait'; waitT = 60 + Math.random()*110; goT = 0; score = 0; round = 1; lastMs = null; alive = true; }
    function next() { state = 'wait'; waitT = 45 + Math.random()*110; round++; }
    function loop() {
      if (state === 'wait' && --waitT <= 0) {
        state = 'go'; goStart = performance.now(); goT = 80;
        beep(900, 1300, 0.08, 0.15);
      } else if (state === 'go' && --goT <= 0) {
        lastMs = '太慢'; beep(240, 90, 0.15, 0.15, 'square'); next();
      }
      ctx.fillStyle = state === 'go' ? '#2f9e44' : '#a83232';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.font = '700 62px system-ui';
      ctx.fillText(state === 'go' ? '點！' : '等…', W/2, H/2 - 20);
      ctx.font = '500 17px system-ui';
      ctx.fillText(state === 'go' ? '' : '偷跑會直接出局', W/2, H/2 + 30);
      if (lastMs !== null) {
        ctx.font = '600 26px system-ui';
        ctx.fillText(typeof lastMs === 'number' ? lastMs + ' ms' : lastMs, W/2, H/2 + 90);
      }
      ctx.font = '500 15px system-ui'; ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText('第 ' + round + ' 回合', W/2, 110);
      if (alive) raf = requestAnimationFrame(loop);
    }
    return {
      start() { reset(); raf = requestAnimationFrame(loop); },
      stop() { alive = false; cancelAnimationFrame(raf); },
      input(t) {
        if (t !== 'down' || !alive) return;
        if (state === 'wait') {
          alive = false; cancelAnimationFrame(raf);
          beep(300, 50, 0.4, 0.25, 'sawtooth');
          over(score); return;
        }
        const ms = Math.round(performance.now() - goStart);
        lastMs = ms;
        const gain = Math.max(5, 60 - Math.floor(ms/10));
        score += gain; setScore(score);
        beep(700, 1200 + gain*10, 0.1, 0.15);
        next();
      }
    };
  }
},

/* 10. 跳跳羊：點擊跳過柵欄 */
{
  id: 'sheep', title: '跳跳羊：翻過柵欄回家', author: '@牧場物語同好會', tip: '點一下起跳，柵欄會越來越快', bg: '#87b5d6',
  create(env) {
    const { ctx, setScore, over } = env;
    const GY = H - 150, SX = 100;
    let y, vy, fences, score, frames, spawnT, raf, alive;
    function reset() { y = GY; vy = 0; fences = []; score = 0; frames = 0; spawnT = 60; alive = true; }
    function loop() {
      frames++;
      vy += 0.6; y += vy;
      if (y > GY) { y = GY; vy = 0; }
      const sp = 5 + frames/500;
      if (--spawnT <= 0) {
        fences.push({ x: W + 30, h: 46 + Math.random()*36, passed: false });
        spawnT = Math.max(38, 85 - Math.floor(frames/300)*6) + Math.random()*30;
      }
      for (const f of fences) {
        f.x -= sp;
        if (!f.passed && f.x < SX - 20) {
          f.passed = true; score++; setScore(score);
          beep(650 + score*20, 950 + score*20, 0.08, 0.12);
        }
        if (Math.abs(f.x - SX) < 32 && y > GY - f.h + 6) { die(); return; }
      }
      fences = fences.filter(f => f.x > -50);
      /* draw */
      ctx.fillStyle = '#87b5d6'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f5d76e'; ctx.beginPath(); ctx.arc(W - 70, 100, 34, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 3; i++) {
        const cx2 = ((frames*0.5 + i*170) % (W+140)) - 70;
        ctx.beginPath(); ctx.arc(cx2, 150 + i*55, 24, 0, 7);
        ctx.arc(cx2+26, 150 + i*55 + 6, 18, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#6ca24f'; ctx.fillRect(0, GY + 26, W, H - GY);
      ctx.fillStyle = '#578540'; ctx.fillRect(0, GY + 26, W, 8);
      ctx.fillStyle = '#8a5a2b';
      for (const f of fences) {
        ctx.fillRect(f.x - 14, GY + 28 - f.h, 8, f.h);
        ctx.fillRect(f.x + 6, GY + 28 - f.h, 8, f.h);
        ctx.fillRect(f.x - 20, GY + 34 - f.h, 40, 7);
        ctx.fillRect(f.x - 20, GY + 30 - f.h/2, 40, 7);
      }
      const hop = y < GY ? -4 : 0;
      ctx.fillStyle = '#f5f5f0';
      ctx.beginPath(); ctx.arc(SX, y - 6 + hop, 24, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(SX - 14, y - 12 + hop, 13, 0, 7);
      ctx.arc(SX + 12, y - 18 + hop, 13, 0, 7); ctx.arc(SX + 2, y - 22 + hop, 13, 0, 7); ctx.fill();
      ctx.fillStyle = '#33313b';
      ctx.beginPath(); ctx.arc(SX + 24, y - 8 + hop, 11, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(SX + 27, y - 11 + hop, 3.4, 0, 7); ctx.fill();
      if (y >= GY) {
        ctx.fillStyle = '#33313b';
        ctx.fillRect(SX - 14, y + 12, 6, 14); ctx.fillRect(SX + 8, y + 12, 6, 14);
      }
      if (alive) raf = requestAnimationFrame(loop);
    }
    function die() {
      alive = false; cancelAnimationFrame(raf);
      beep(400, 60, 0.35, 0.25, 'sawtooth');
      over(score);
    }
    return {
      start() { reset(); raf = requestAnimationFrame(loop); },
      stop() { alive = false; cancelAnimationFrame(raf); },
      input(t) { if (t === 'down' && alive && y >= GY - 1) { vy = -12.5; beep(350, 550, 0.08, 0.1); } }
    };
  }
}

]);
