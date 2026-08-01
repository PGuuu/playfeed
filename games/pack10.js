/* PlayFeed original: Word Tides — an endless, touch-responsive generative artwork. */
window.GAMES = (window.GAMES || []).concat([
{
  apiVersion: 1,
  gameVersion: '1.0.0',
  id: 'word-tides',
  title: '字的潮汐',
  author: '@playfeed 官方',
  description: '以手指改變文字、光與流場；每次觸碰都長出一幅不會重複的作品。',
  tip: '按住聚集文字，拖曳畫出潮汐，放開讓一句話浮現。',
  bg: '#102D38',
  tags: ['generative-art', 'interactive-art', 'relaxing', 'typography'],
  controls: ['tap', 'hold', 'drag'],
  preview: 'cover',
  duration: 180,
  score: { label: '共鳴', order: 'higher', decimals: 0 },
  remixSlots: [
    {
      key: 'glyph-seed',
      label: '漂浮字種',
      hint: '偶爾隨著文字潮汐漂流的小圖像',
      default: '字',
      shape: 'square'
    },
    {
      key: 'touch-core',
      label: '觸碰核心',
      hint: '手指按住時浮現的發光核心',
      default: '✦',
      shape: 'round'
    }
  ],

  create(env) {
    const ctx = env.ctx;
    const sprite = env.sprite || (() => false);
    const english = String(env.locale || '').toLowerCase().startsWith('en');
    const glyphSets = english
      ? ['tide', 'air', 'here', 'drift', 'echo', 'soft', 'now', 'light']
      : ['潮', '光', '此刻', '漂流', '呼吸', '回聲', '靠近', '慢慢'];
    const phrases = english
      ? [
          'the tide remembers your hand',
          'a quiet shape becomes light',
          'stay where the current turns',
          'every touch changes the weather',
          'let the small things gather'
        ]
      : [
          '潮水記得手指的方向',
          '安靜的形狀正在發光',
          '停在水流轉彎的地方',
          '每次觸碰都改變了天氣',
          '讓微小的事物聚在一起'
        ];
    const palettes = [
      ['#63F3D1', '#8BE7FF', '#FFD66B', '#FF7EB6', '#BBA7FF'],
      ['#FF725E', '#FFCA62', '#F7F4A5', '#55D6BE', '#6EA8FE'],
      ['#F58BD8', '#9D8CFF', '#60D8FF', '#7EF2C5', '#FFF08A'],
      ['#FF8A65', '#FFCB77', '#7DE2D1', '#70A1FF', '#D6A2FF']
    ];

    let alive = false;
    let raf = 0;
    let last = 0;
    let elapsed = 0;
    let spawnClock = 0;
    let held = false;
    let pointerX = 0;
    let pointerY = 0;
    let holdTime = 0;
    let resonance = 0;
    let nextTone = 1.25;
    let particles = [];
    let ribbon = [];
    let ripples = [];
    let phrase = null;
    let palette = palettes[0];
    let fieldSeed = 0;
    let washHue = 0;

    function clamp(value, low, high) {
      return Math.max(low, Math.min(high, value));
    }

    function randomBetween(low, high) {
      return low + Math.random() * (high - low);
    }

    function roundRect(x, y, w, h, radius) {
      const r = Math.min(radius, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function makeParticle(burstX, burstY) {
      const W = env.W;
      const H = env.H;
      const burst = Number.isFinite(burstX) && Number.isFinite(burstY);
      const edge = Math.floor(Math.random() * 3);
      let x = randomBetween(0, W);
      let y = -24;
      if (!burst && edge === 1) {
        x = -24;
        y = randomBetween(H * .08, H * .82);
      } else if (!burst && edge === 2) {
        x = W + 24;
        y = randomBetween(H * .08, H * .82);
      } else if (burst) {
        x = burstX + randomBetween(-18, 18);
        y = burstY + randomBetween(-18, 18);
      }
      const colorIndex = Math.floor(Math.random() * palette.length);
      return {
        x,
        y,
        px: x,
        py: y,
        vx: burst ? randomBetween(-26, 26) : randomBetween(-7, 7),
        vy: burst ? randomBetween(-26, 26) : randomBetween(10, 24),
        size: randomBetween(10, 22),
        alpha: randomBetween(.48, .94),
        age: 0,
        life: randomBetween(8, 16),
        glyph: glyphSets[Math.floor(Math.random() * glyphSets.length)],
        color: palette[colorIndex],
        phase: Math.random() * Math.PI * 2,
        image: Math.random() < .12
      };
    }

    function nearestRibbonPoint(particle) {
      if (!ribbon.length) return null;
      let nearest = null;
      let best = Infinity;
      for (let i = Math.max(0, ribbon.length - 34); i < ribbon.length; i += 2) {
        const point = ribbon[i];
        const dx = point.x - particle.x;
        const dy = point.y - particle.y;
        const distance = dx * dx + dy * dy;
        if (distance < best) {
          best = distance;
          nearest = point;
        }
      }
      return nearest ? { point: nearest, distance: Math.sqrt(best) } : null;
    }

    function releasePhrase() {
      if (holdTime < .22) return;
      const text = phrases[Math.floor(Math.random() * phrases.length)];
      phrase = {
        text,
        x: pointerX,
        y: pointerY,
        age: 0,
        life: 5.4,
        color: palette[Math.floor(Math.random() * palette.length)]
      };
      ripples.push({ x: pointerX, y: pointerY, age: 0, life: 2.2, power: 1.2 });
      for (let i = 0; i < 20; i++) particles.push(makeParticle(pointerX, pointerY));
      resonance += Math.max(1, Math.round(holdTime * 2));
      env.setScore(resonance);
      env.beep(330, 610, .2, .045, 'sine');
    }

    function update(dt) {
      const W = env.W;
      const H = env.H;
      elapsed += dt;
      washHue += dt * .08;
      if (held) {
        holdTime += dt;
        spawnClock += dt * (2.5 + Math.min(7, holdTime * 1.4));
        if (holdTime >= nextTone) {
          const note = 300 + Math.min(360, holdTime * 52);
          env.beep(note, note * 1.45, .09, .025, 'sine');
          nextTone += 1.35;
        }
      } else {
        spawnClock += dt * 3;
      }
      while (spawnClock >= 1) {
        spawnClock -= 1;
        particles.push(makeParticle());
      }
      while (particles.length > 190) particles.shift();

      for (let i = ribbon.length - 1; i >= 0; i--) {
        ribbon[i].age += dt;
        if (ribbon[i].age > ribbon[i].life) ribbon.splice(i, 1);
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        ripples[i].age += dt;
        if (ripples[i].age > ripples[i].life) ripples.splice(i, 1);
      }
      if (phrase) {
        phrase.age += dt;
        if (phrase.age > phrase.life) phrase = null;
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age += dt;
        p.px = p.x;
        p.py = p.y;
        const waveX = Math.sin(p.y * .014 + elapsed * .7 + p.phase + fieldSeed) * 6;
        const waveY = Math.cos(p.x * .012 - elapsed * .45 + p.phase) * 3;
        p.vx += waveX * dt;
        p.vy += waveY * dt;

        const near = nearestRibbonPoint(p);
        if (near && near.distance < Math.min(W, H) * .31) {
          const dx = near.point.x - p.x;
          const dy = near.point.y - p.y;
          const force = held ? 34 : 15;
          const length = Math.max(18, near.distance);
          p.vx += dx / length * force * dt;
          p.vy += dy / length * force * dt;
          p.vx += -dy / length * 11 * dt;
          p.vy += dx / length * 11 * dt;
        }
        if (held) {
          const dx = pointerX - p.x;
          const dy = pointerY - p.y;
          const distance = Math.max(24, Math.hypot(dx, dy));
          if (distance < Math.min(W, H) * .42) {
            const pull = clamp(175 / distance, .18, 3.2);
            p.vx += dx / distance * pull * 32 * dt;
            p.vy += dy / distance * pull * 32 * dt;
          }
        }
        for (let j = 0; j < ripples.length; j++) {
          const ripple = ripples[j];
          const dx = p.x - ripple.x;
          const dy = p.y - ripple.y;
          const distance = Math.max(12, Math.hypot(dx, dy));
          const ring = ripple.age / ripple.life * Math.min(W, H) * .58;
          if (Math.abs(distance - ring) < 54) {
            const push = (1 - ripple.age / ripple.life) * ripple.power * 58;
            p.vx += dx / distance * push * dt;
            p.vy += dy / distance * push * dt;
          }
        }
        p.vx *= Math.pow(.988, dt * 60);
        p.vy *= Math.pow(.991, dt * 60);
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (p.age > p.life || p.x < -90 || p.x > W + 90 || p.y > H + 90) {
          particles.splice(i, 1);
        }
      }
    }

    function background() {
      const W = env.W;
      const H = env.H;
      const gradient = ctx.createLinearGradient(0, 0, W, H);
      gradient.addColorStop(0, '#071D27');
      gradient.addColorStop(.5, '#102D38');
      gradient.addColorStop(1, '#192449');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      const glow = ctx.createRadialGradient(
        W * (.2 + Math.sin(washHue) * .06), H * .18, 0,
        W * .3, H * .22, Math.max(W, H) * .8
      );
      glow.addColorStop(0, 'rgba(83,240,207,.14)');
      glow.addColorStop(.48, 'rgba(111,121,255,.07)');
      glow.addColorStop(1, 'rgba(4,17,26,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
    }

    function drawRibbon() {
      if (ribbon.length < 2) return;
      const layers = [
        { width: 30, alpha: .035 },
        { width: 12, alpha: .09 },
        { width: 2, alpha: .48 }
      ];
      for (let layer = 0; layer < layers.length; layer++) {
        ctx.beginPath();
        for (let i = 0; i < ribbon.length; i++) {
          const point = ribbon[i];
          if (i === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        }
        ctx.strokeStyle = `rgba(126,242,213,${layers[layer].alpha})`;
        ctx.lineWidth = layers[layer].width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    }

    function drawRipples() {
      const maxRadius = Math.min(env.W, env.H) * .58;
      for (let i = 0; i < ripples.length; i++) {
        const ripple = ripples[i];
        const t = ripple.age / ripple.life;
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, 12 + maxRadius * t, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(139,231,255,${(1 - t) * .32})`;
        ctx.lineWidth = 1.5 + (1 - t) * 3;
        ctx.stroke();
      }
    }

    function drawParticles() {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const fadeIn = clamp(p.age * 2, 0, 1);
        const fadeOut = clamp((p.life - p.age) * .55, 0, 1);
        const alpha = p.alpha * fadeIn * fadeOut;
        if (alpha <= .01) continue;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(p.vy, p.vx) * .18);
        if (p.image && sprite('glyph-seed', 0, 0, p.size * 1.7)) {
          ctx.restore();
          continue;
        }
        ctx.shadowColor = p.color;
        ctx.shadowBlur = held ? 12 : 6;
        ctx.fillStyle = p.color;
        ctx.font = `${p.glyph.length > 2 ? 500 : 650} ${p.size}px system-ui, sans-serif`;
        ctx.fillText(p.glyph, 0, 0);
        ctx.restore();
      }
    }

    function drawCore() {
      if (!held) return;
      const pulse = 1 + Math.sin(elapsed * 5) * .08;
      const radius = (30 + Math.min(34, holdTime * 7)) * pulse;
      const glow = ctx.createRadialGradient(pointerX, pointerY, 0, pointerX, pointerY, radius * 2.2);
      glow.addColorStop(0, 'rgba(255,255,255,.36)');
      glow.addColorStop(.25, 'rgba(99,243,209,.22)');
      glow.addColorStop(1, 'rgba(99,243,209,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(pointerX, pointerY, radius * 2.2, 0, Math.PI * 2);
      ctx.fill();
      if (!sprite('touch-core', pointerX, pointerY, radius * .92)) {
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        ctx.font = `700 ${Math.max(20, radius * .72)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✦', pointerX, pointerY + 1);
      }
    }

    function drawPhrase() {
      if (!phrase) return;
      const t = phrase.age / phrase.life;
      const alpha = clamp(t * 4, 0, 1) * clamp((1 - t) * 3.4, 0, 1);
      const W = env.W;
      const size = clamp(W * .052, 17, 27);
      const padding = size * 1.15;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `650 ${size}px system-ui, sans-serif`;
      const width = Math.min(W - 38, ctx.measureText(phrase.text).width + padding * 2);
      const x = clamp(phrase.x - width / 2, 19, W - width - 19);
      const y = clamp(phrase.y - 80 - Math.sin(t * Math.PI) * 18, 72, env.H - 120);
      ctx.fillStyle = 'rgba(5,18,28,.52)';
      roundRect(x, y - size * 1.25, width, size * 2.5, size * 1.25);
      ctx.fill();
      ctx.shadowColor = phrase.color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(phrase.text, x + width / 2, y);
      ctx.restore();
    }

    function draw() {
      background();
      drawRipples();
      drawRibbon();
      drawParticles();
      drawPhrase();
      drawCore();

      if (elapsed < 5 && !held && ribbon.length === 0) {
        const alpha = clamp((5 - elapsed) / 1.5, 0, .72);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.font = `500 ${clamp(env.W * .038, 14, 20)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(english ? 'hold · drift · release' : '按住 · 漂流 · 放開', env.W / 2, env.H * .72);
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
      spawnClock = 0;
      held = false;
      holdTime = 0;
      resonance = 0;
      nextTone = 1.25;
      particles = [];
      ribbon = [];
      ripples = [];
      phrase = null;
      palette = palettes[Math.floor(Math.random() * palettes.length)];
      fieldSeed = Math.random() * Math.PI * 2;
      pointerX = env.W / 2;
      pointerY = env.H * .56;
      for (let i = 0; i < 48; i++) {
        const particle = makeParticle();
        particle.x = Math.random() * env.W;
        particle.y = Math.random() * env.H;
        particle.px = particle.x;
        particle.py = particle.y;
        particle.age = Math.random() * 4;
        particles.push(particle);
      }
      env.setScore(0);
      raf = requestAnimationFrame(loop);
    }

    function stop() {
      alive = false;
      held = false;
      cancelAnimationFrame(raf);
    }

    function input(type, x, y) {
      if (type === 'cancel') {
        held = false;
        holdTime = 0;
        return;
      }
      if (!alive) return;
      pointerX = clamp(x, 0, env.W);
      pointerY = clamp(y, 0, env.H);
      if (type === 'down') {
        held = true;
        holdTime = 0;
        nextTone = 1.25;
        ribbon.push({ x: pointerX, y: pointerY, age: 0, life: 8 });
        ripples.push({ x: pointerX, y: pointerY, age: 0, life: 1.5, power: -.35 });
        env.beep(220, 360, .08, .03, 'sine');
      } else if (type === 'move' && held) {
        const previous = ribbon[ribbon.length - 1];
        if (!previous || Math.hypot(pointerX - previous.x, pointerY - previous.y) > 7) {
          ribbon.push({ x: pointerX, y: pointerY, age: 0, life: 8 });
          if (ribbon.length > 80) ribbon.shift();
        }
      } else if (type === 'up' && held) {
        held = false;
        releasePhrase();
        holdTime = 0;
      }
    }

    /* The artwork has no forced ending; the platform's bottom swipe leaves it. */
    function finishArtwork() {
      env.over(resonance);
    }
    void finishArtwork;

    return { start, stop, input };
  }
}
]);
