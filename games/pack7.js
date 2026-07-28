/* PlayFeed 原創療癒互動：彩砂流畫
   操作：先點選砂罐，再點畫布中帶有同色提示的區塊。 */
window.GAMES = (window.GAMES || []).concat([
{
  apiVersion: 1,
  gameVersion: '1.0.0',
  id: 'sand-canvas',
  title: '彩砂流畫',
  author: '@playfeed 官方',
  description: '挑選彩砂，讓一片片顏色流進抽象畫布，完成自己的砂畫。',
  tip: '先點砂罐選色，再點畫布中帶有同色提示的區塊',
  bg: '#F6E2B8',
  tags: ['relaxing', 'color', 'sorting', 'art'],
  controls: ['tap'],
  preview: 'cover',
  duration: 45,
  score: { label: '完成度', order: 'higher', decimals: 0 },
  remixSlots: [
    {
      key: 'sand-tool',
      label: '彩砂工具',
      hint: '畫面下方目前選中的砂罐或倒砂工具',
      default: '圓形彩砂罐',
      shape: 'tall'
    },
    {
      key: 'canvas-stamp',
      label: '完成印記',
      hint: '完成整幅砂畫後出現在畫布中央的裝飾',
      default: '發光星形印記',
      shape: 'free'
    }
  ],

  create(env) {
    const ctx = env.ctx;
    const W = env.W, H = env.H;
    const colors = ['#163A5F', '#1E7591', '#35AFA2', '#72BD45', '#F5A623', '#E85B24', '#D83B86'];
    const boundary = [
      [0, 0], [.23, 0], [.49, 0], [.76, 0], [1, 0],
      [1, .27], [1, .58], [1, 1], [.73, 1], [.45, 1],
      [.18, 1], [0, 1], [0, .64], [0, .31]
    ];
    const targets = [5, 4, 6, 1, 0, 5, 3, 4, 2, 0, 1, 2, 3, 6];
    const center = [.47, .49];
    let alive = false, raf = 0, last = 0, elapsed = 0;
    let selected = 2, mistakes = 0, completed = 0, finishDelay = 0;
    let progress = [], particles = [], flashes = [], intro = 0;

    function frame() {
      return { x: 22, y: 82, w: W - 44, h: Math.max(300, H - 265) };
    }

    function point(regionIndex, pointIndex) {
      const box = frame();
      const source = pointIndex === 0
        ? center
        : boundary[(regionIndex + pointIndex - 1) % boundary.length];
      return [box.x + source[0] * box.w, box.y + source[1] * box.h];
    }

    function polygon(regionIndex) {
      return [
        point(regionIndex, 0),
        point(regionIndex, 1),
        point(regionIndex, 2)
      ];
    }

    function trace(poly) {
      ctx.beginPath();
      ctx.moveTo(poly[0][0], poly[0][1]);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
      ctx.closePath();
    }

    function inside(x, y, poly) {
      let hit = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1];
        const xj = poly[j][0], yj = poly[j][1];
        const crosses = (yi > y) !== (yj > y) &&
          x < (xj - xi) * (y - yi) / ((yj - yi) || .0001) + xi;
        if (crosses) hit = !hit;
      }
      return hit;
    }

    function centroid(poly) {
      return [
        (poly[0][0] + poly[1][0] + poly[2][0]) / 3,
        (poly[0][1] + poly[1][1] + poly[2][1]) / 3
      ];
    }

    function noise(value) {
      const raw = Math.sin(value * 91.17 + 17.31) * 43758.5453;
      return raw - Math.floor(raw);
    }

    function roundRect(x, y, w, h, r) {
      const radius = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.arcTo(x + w, y, x + w, y + h, radius);
      ctx.arcTo(x + w, y + h, x, y + h, radius);
      ctx.arcTo(x, y + h, x, y, radius);
      ctx.arcTo(x, y, x + w, y, radius);
      ctx.closePath();
    }

    function spawnPour(regionIndex) {
      const poly = polygon(regionIndex);
      const target = centroid(poly);
      const palette = paletteLayout();
      const sourceX = palette.start + selected * palette.gap;
      for (let i = 0; i < 34; i++) {
        particles.push({
          sx: sourceX,
          sy: palette.y - 18,
          tx: target[0],
          ty: target[1],
          age: -i * .012,
          life: .42 + noise(i + regionIndex * 9) * .24,
          bend: (noise(i * 3.7 + regionIndex) - .5) * 70,
          size: 2 + noise(i * 8.1) * 3,
          color: colors[selected]
        });
      }
    }

    function paletteLayout() {
      const gap = Math.min(48, (W - 46) / colors.length);
      return {
        gap,
        start: (W - gap * (colors.length - 1)) / 2,
        y: H - 78
      };
    }

    function update(dt) {
      elapsed += dt;
      intro += dt;
      for (let i = 0; i < progress.length; i++) {
        if (progress[i] > 0 && progress[i] < 1) {
          progress[i] = Math.min(1, progress[i] + dt * 1.45);
          if (progress[i] === 1) {
            completed++;
            env.beep(520, 880, .1, .07, 'sine');
            const current = completed * 100 - mistakes * 20;
            env.setScore(Math.max(0, current));
            if (completed === progress.length) finishDelay = .9;
          }
        }
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].age += dt;
        if (particles[i].age > particles[i].life) particles.splice(i, 1);
      }
      for (let i = flashes.length - 1; i >= 0; i--) {
        flashes[i].time -= dt;
        if (flashes[i].time <= 0) flashes.splice(i, 1);
      }
      if (finishDelay > 0) {
        finishDelay -= dt;
        if (finishDelay <= 0) {
          const finalScore = Math.max(1, 1600 - Math.round(elapsed * 11) - mistakes * 70);
          alive = false;
          cancelAnimationFrame(raf);
          env.over(finalScore);
        }
      }
    }

    function drawRegion(regionIndex) {
      const poly = polygon(regionIndex);
      const amount = progress[regionIndex];
      const box = frame();
      ctx.save();
      trace(poly);
      ctx.clip();
      ctx.fillStyle = '#25303A';
      ctx.fillRect(box.x, box.y, box.w, box.h);
      if (amount > 0) {
        const fillTop = box.y + box.h * (1 - amount);
        ctx.fillStyle = colors[targets[regionIndex]];
        ctx.fillRect(box.x, fillTop, box.w, box.h * amount);
        ctx.globalAlpha = .34;
        ctx.fillStyle = '#0B1722';
        for (let grain = 0; grain < 75; grain++) {
          const gx = box.x + noise(grain + regionIndex * 101) * box.w;
          const gy = box.y + noise(grain * 3.13 + regionIndex * 43) * box.h;
          if (gy >= fillTop) {
            const radius = .7 + noise(grain * 7.9) * 1.5;
            ctx.beginPath();
            ctx.arc(gx, gy, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.restore();

      trace(poly);
      ctx.strokeStyle = 'rgba(255,255,255,.74)';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (amount === 0) {
        const middle = centroid(poly);
        ctx.fillStyle = colors[targets[regionIndex]];
        ctx.shadowColor = colors[targets[regionIndex]];
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(middle[0], middle[1], 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      const flash = flashes.find(item => item.region === regionIndex);
      if (flash) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, flash.time * 3);
        trace(poly);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.restore();
      }
    }

    function drawParticles() {
      for (const particle of particles) {
        if (particle.age < 0) continue;
        const t = Math.min(1, particle.age / particle.life);
        const arc = Math.sin(t * Math.PI) * particle.bend;
        const x = particle.sx + (particle.tx - particle.sx) * t + arc;
        const y = particle.sy + (particle.ty - particle.sy) * t - Math.sin(t * Math.PI) * 80;
        ctx.globalAlpha = 1 - t * .35;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(x, y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawPalette() {
      const layout = paletteLayout();
      ctx.fillStyle = 'rgba(30,37,48,.94)';
      roundRect(13, H - 126, W - 26, 105, 23);
      ctx.fill();
      for (let i = 0; i < colors.length; i++) {
        const x = layout.start + i * layout.gap;
        const active = i === selected;
        ctx.save();
        ctx.shadowColor = active ? colors[i] : 'transparent';
        ctx.shadowBlur = active ? 20 : 0;
        ctx.fillStyle = colors[i];
        roundRect(x - 16, layout.y - 29, 32, 43, 11);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.28)';
        ctx.beginPath();
        ctx.ellipse(x, layout.y - 29, 16, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = active ? '#fff' : 'rgba(255,255,255,.28)';
        ctx.lineWidth = active ? 4 : 2;
        roundRect(x - 18, layout.y - 33, 36, 51, 12);
        ctx.stroke();
        ctx.restore();
      }
      const toolX = layout.start + selected * layout.gap;
      env.sprite('sand-tool', toolX, layout.y - 8, 38);
    }

    function draw() {
      const box = frame();
      const gradient = ctx.createLinearGradient(0, 0, 0, H);
      gradient.addColorStop(0, '#F7E7C4');
      gradient.addColorStop(1, '#E9C58A');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = '#24303B';
      ctx.font = '900 25px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('彩砂流畫', W / 2, 40);
      ctx.fillStyle = '#6B5945';
      ctx.font = '700 13px sans-serif';
      ctx.fillText(completed === progress.length ? '完成你的砂畫' : '選砂罐，再點同色提示', W / 2, 64);

      ctx.save();
      ctx.shadowColor = 'rgba(44,31,18,.32)';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#F8F4E9';
      roundRect(box.x - 9, box.y - 9, box.w + 18, box.h + 18, 17);
      ctx.fill();
      ctx.restore();

      for (let i = 0; i < progress.length; i++) drawRegion(i);
      drawParticles();
      drawPalette();

      if (completed === progress.length) {
        const stampDrawn = env.sprite('canvas-stamp', W / 2, box.y + box.h / 2, 82);
        if (!stampDrawn) {
          ctx.fillStyle = 'rgba(255,255,255,.9)';
          ctx.font = '900 54px sans-serif';
          ctx.shadowColor = '#FFE888';
          ctx.shadowBlur = 22;
          ctx.fillText('✦', W / 2, box.y + box.h / 2 + 18);
          ctx.shadowBlur = 0;
        }
      }

      if (intro < 3.2 && completed === 0) {
        ctx.fillStyle = 'rgba(20,28,37,.88)';
        roundRect(54, box.y + box.h / 2 - 35, W - 108, 70, 18);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '800 15px sans-serif';
        ctx.fillText('① 選彩砂　② 點同色區塊', W / 2, box.y + box.h / 2 + 6);
      }
    }

    function loop(now) {
      if (!alive) return;
      const dt = last ? Math.min(.034, (now - last) / 1000) : 0;
      last = now;
      update(dt);
      draw();
      if (alive) raf = requestAnimationFrame(loop);
    }

    function start() {
      cancelAnimationFrame(raf);
      alive = true;
      last = 0;
      elapsed = 0;
      selected = 2;
      mistakes = 0;
      completed = 0;
      finishDelay = 0;
      intro = 0;
      progress = new Array(boundary.length).fill(0);
      particles = [];
      flashes = [];
      env.setScore(0);
      raf = requestAnimationFrame(loop);
    }

    function stop() {
      alive = false;
      cancelAnimationFrame(raf);
      particles = [];
    }

    function input(type, x, y) {
      if (type === 'cancel') return;
      if (!alive || type !== 'down' || finishDelay > 0) return;
      const layout = paletteLayout();
      if (y > H - 135) {
        let nearest = Math.round((x - layout.start) / layout.gap);
        nearest = Math.max(0, Math.min(colors.length - 1, nearest));
        selected = nearest;
        env.beep(340 + selected * 45, 420 + selected * 45, .05, .045, 'sine');
        return;
      }
      for (let i = 0; i < progress.length; i++) {
        if (inside(x, y, polygon(i))) {
          if (progress[i] > 0) return;
          if (targets[i] === selected) {
            progress[i] = .01;
            spawnPour(i);
            env.beep(420, 720, .08, .06, 'sine');
          } else {
            mistakes++;
            flashes.push({ region: i, time: .3 });
            env.beep(210, 130, .1, .06, 'square');
            env.setScore(Math.max(0, completed * 100 - mistakes * 20));
          }
          return;
        }
      }
    }

    return { start, stop, input };
  }
}
]);
