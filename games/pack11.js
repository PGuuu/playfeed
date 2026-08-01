/* PlayFeed original: Ink Creature — a touch-responsive parametric life form. */
window.GAMES = (window.GAMES || []).concat([
{
  apiVersion: 1,
  gameVersion: '1.0.0',
  id: 'ink-creature',
  title: 'Ink Creature',
  author: '@playfeed official',
  description: 'A living form drawn from thousands of points, changing shape with every touch.',
  tip: 'Hold to reveal it, drag to bend its body, then release to transform it.',
  bg: '#030508',
  tags: ['generative-art', 'parametric', 'interactive-art', 'creature'],
  controls: ['tap', 'hold', 'drag'],
  preview: 'cover',
  duration: 180,
  score: { label: 'Forms', order: 'higher', decimals: 0 },
  remixSlots: [
    {
      key: 'creature-core',
      label: 'Creature core',
      hint: 'The glowing heart inside the point creature',
      default: '✦',
      shape: 'circle'
    },
    {
      key: 'living-spark',
      label: 'Living spark',
      hint: 'Rare marks that travel through the creature',
      default: '·',
      shape: 'square'
    }
  ],

  create(env) {
    const ctx = env.ctx;
    const sprite = env.sprite || (() => false);
    const MAX_POINTS = 3400;
    const offX = new Float32Array(MAX_POINTS);
    const offY = new Float32Array(MAX_POINTS);
    const velX = new Float32Array(MAX_POINTS);
    const velY = new Float32Array(MAX_POINTS);
    const twinkle = new Float32Array(MAX_POINTS);

    let alive = false;
    let raf = 0;
    let last = 0;
    let elapsed = 0;
    let held = false;
    let holdTime = 0;
    let startX = 0;
    let startY = 0;
    let pointerX = 0;
    let pointerY = 0;
    let baseYaw = 0;
    let targetYaw = 0;
    let yaw = 0;
    let baseStretch = 1;
    let targetStretch = 1;
    let stretch = 1;
    let coherence = .62;
    let mode = 0;
    let forms = 0;
    let seed = 0;
    let flash = 0;
    let pointCount = 3000;
    let slowFrames = 0;
    let clearFrames = 0;
    let toneStep = 1.2;

    function clamp(value, low, high) {
      return Math.max(low, Math.min(high, value));
    }

    function randomBetween(low, high) {
      return low + Math.random() * (high - low);
    }

    function resetOffsets() {
      for (let i = 0; i < MAX_POINTS; i++) {
        offX[i] = 0;
        offY[i] = 0;
        velX[i] = 0;
        velY[i] = 0;
        twinkle[i] = Math.random() * Math.PI * 2;
      }
    }

    function burst() {
      const power = Math.min(2.1, .7 + holdTime * .28);
      for (let i = 0; i < pointCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = randomBetween(28, 155) * power;
        velX[i] += Math.cos(angle) * speed;
        velY[i] += Math.sin(angle) * speed;
      }
      mode = (mode + 1 + (Math.random() < .28 ? 1 : 0)) % 3;
      seed = Math.random() * Math.PI * 2;
      forms += 1;
      env.setScore(forms);
      env.beep(190 + mode * 75, 560 + mode * 95, .25, .045, 'sine');
      flash = 1;
      clearFrames = 2;
    }

    function update(dt) {
      elapsed += dt;
      flash = Math.max(0, flash - dt * 1.8);
      yaw += (targetYaw - yaw) * Math.min(1, dt * 5.5);
      stretch += (targetStretch - stretch) * Math.min(1, dt * 5.5);
      const targetCoherence = held ? Math.min(1, .68 + holdTime * .13) : .62;
      coherence += (targetCoherence - coherence) * Math.min(1, dt * 3.5);
      if (held) {
        holdTime += dt;
        if (holdTime >= toneStep) {
          env.beep(260 + Math.min(420, holdTime * 55), 410 + Math.min(560, holdTime * 70), .1, .024, 'sine');
          toneStep += 1.3;
        }
      }
      const drag = Math.pow(.92, dt * 60);
      for (let i = 0; i < pointCount; i++) {
        offX[i] += velX[i] * dt;
        offY[i] += velY[i] * dt;
        velX[i] *= drag;
        velY[i] *= drag;
        offX[i] *= Math.pow(.985, dt * 60);
        offY[i] *= Math.pow(.985, dt * 60);
      }
    }

    function creaturePoint(index) {
      const n = pointCount;
      const q = index / n;
      const grain = ((index * 1597) % n) / n;
      const ring = grain * Math.PI * 2;
      const W = env.W;
      const H = env.H;
      const S = Math.min(W, H);
      let x = 0;
      let y = 0;
      let z = 0;

      if (q < .39) {
        const u = q / .39 * 2 - 1;
        const radius = (.12 + .08 * Math.cos(u * Math.PI * .82)) * S;
        const curl = mode === 0 ? .33 : mode === 1 ? .15 : .26;
        x = u * S * (mode === 1 ? .30 : .24) + Math.sin(u * Math.PI * 1.35 + elapsed * .34 + seed) * S * curl * .2;
        y = Math.sin(u * Math.PI * 1.1 + seed * .3) * S * curl + Math.cos(ring) * radius * .58;
        z = Math.sin(ring) * radius;
      } else if (q < .73) {
        const local = (q - .39) / .34;
        const side = local < .5 ? -1 : 1;
        const u = (local % .5) * 2;
        const fold = grain * 2 - 1;
        const span = mode === 1 ? .52 : mode === 0 ? .43 : .34;
        x = side * S * (.07 + Math.pow(u, .78) * span);
        y = -S * (.02 + u * (mode === 1 ? .32 : .24)) +
          Math.sin(u * Math.PI * (2.1 + mode * .35) + elapsed * 1.15 + side * seed) * S * .055 +
          fold * S * .065 * Math.sin(u * Math.PI);
        z = fold * S * .15 * Math.sin(u * Math.PI) + side * Math.sin(elapsed * .8 + u * 4) * S * .035;
      } else if (q < .89) {
        const u = (q - .73) / .16;
        const curl = u * Math.PI * (mode === 0 ? 2.1 : 1.35);
        const taper = 1 - u;
        x = -S * (.2 + u * .32) + Math.sin(curl + seed) * S * .13 * u;
        y = S * (.13 + u * .27) + Math.cos(curl + seed) * S * .12 * u;
        z = Math.sin(ring) * S * .055 * taper;
      } else {
        const local = (q - .89) / .11;
        const polar = Math.acos(1 - 2 * grain);
        const azimuth = local * Math.PI * 12 + seed;
        const radius = S * .085;
        x = S * .25 + Math.sin(polar) * Math.cos(azimuth) * radius;
        y = -S * .16 + Math.cos(polar) * radius;
        z = Math.sin(polar) * Math.sin(azimuth) * radius;
        if (local > .82) {
          const horn = (local - .82) / .18;
          const side = index % 2 ? -1 : 1;
          x += side * horn * S * .1;
          y -= horn * S * .16;
        }
      }

      if (mode === 2) {
        y *= .72;
        x += Math.sin((q * 18 + elapsed * .75) * Math.PI) * S * .022;
      }
      const breath = 1 + Math.sin(elapsed * 1.35 + q * 8) * .025;
      x *= breath;
      y *= breath * stretch;
      const cosine = Math.cos(yaw);
      const sine = Math.sin(yaw);
      const rotatedX = x * cosine + z * sine;
      const rotatedZ = -x * sine + z * cosine;
      const depth = clamp(1 + rotatedZ / S * .52, .58, 1.45);
      const jitter = (1 - coherence) * (3 + Math.sin(index * 12.9898 + seed) * 2.2);
      const jx = Math.sin(index * 1.618 + elapsed * 1.7 + seed) * jitter;
      const jy = Math.cos(index * 1.113 - elapsed * 1.35 + seed) * jitter;
      return {
        x: W / 2 + rotatedX + offX[index] + jx,
        y: H * .48 + y + offY[index] + jy,
        depth,
        q
      };
    }

    function drawBackground() {
      const W = env.W;
      const H = env.H;
      if (clearFrames > 0) {
        ctx.fillStyle = '#030508';
        ctx.fillRect(0, 0, W, H);
        clearFrames -= 1;
      } else {
        ctx.fillStyle = held ? 'rgba(3,5,8,.18)' : 'rgba(3,5,8,.25)';
        ctx.fillRect(0, 0, W, H);
      }
      const glow = ctx.createRadialGradient(W / 2, H * .48, 0, W / 2, H * .48, Math.max(W, H) * .52);
      glow.addColorStop(0, `rgba(34,79,92,${.12 + coherence * .04})`);
      glow.addColorStop(.5, 'rgba(18,28,45,.07)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      if (flash > 0) {
        ctx.fillStyle = `rgba(190,245,255,${flash * .12})`;
        ctx.fillRect(0, 0, W, H);
      }
    }

    function drawCreature() {
      const S = Math.min(env.W, env.H);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < pointCount; i++) {
        const point = creaturePoint(i);
        if (point.x < -8 || point.x > env.W + 8 || point.y < -8 || point.y > env.H + 8) continue;
        const pulse = .58 + .42 * Math.sin(elapsed * 2.2 + twinkle[i] + point.q * 16);
        const alpha = clamp((.18 + coherence * .48 + pulse * .24) * point.depth, .08, .95);
        const accent = i % 37 === 0;
        if (accent) ctx.fillStyle = `rgba(112,235,255,${alpha})`;
        else if (i % 53 === 0) ctx.fillStyle = `rgba(255,139,210,${alpha * .75})`;
        else ctx.fillStyle = `rgba(232,244,246,${alpha})`;
        const size = clamp((held ? 1.35 : 1.05) * point.depth, .72, 2.3);
        if (i % 263 === 0 && sprite('living-spark', point.x, point.y, 9 + size * 3)) continue;
        ctx.fillRect(point.x, point.y, size, size);
      }
      ctx.restore();

      const coreX = env.W / 2 + Math.cos(yaw) * S * .035;
      const coreY = env.H * .48 - S * .015;
      const coreSize = 28 + Math.sin(elapsed * 2.7) * 3 + (held ? Math.min(16, holdTime * 3) : 0);
      const coreGlow = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, coreSize * 2.4);
      coreGlow.addColorStop(0, 'rgba(255,255,255,.6)');
      coreGlow.addColorStop(.2, 'rgba(91,230,255,.32)');
      coreGlow.addColorStop(1, 'rgba(91,230,255,0)');
      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(coreX, coreY, coreSize * 2.4, 0, Math.PI * 2);
      ctx.fill();
      if (!sprite('creature-core', coreX, coreY, coreSize)) {
        ctx.fillStyle = 'rgba(245,253,255,.94)';
        ctx.font = `700 ${coreSize * .72}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✦', coreX, coreY + 1);
      }
    }

    function drawInstruction() {
      if (elapsed > 5.2 || held || forms > 0) return;
      const fade = clamp((5.2 - elapsed) / 1.4, 0, .72);
      ctx.fillStyle = `rgba(255,255,255,${fade})`;
      ctx.font = `500 ${clamp(env.W * .038, 14, 20)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('hold · bend · release', env.W / 2, env.H * .76);
    }

    function draw() {
      drawBackground();
      drawCreature();
      drawInstruction();
    }

    function loop(now) {
      if (!alive) return;
      const dt = last ? Math.min(.04, (now - last) / 1000) : 0;
      last = now;
      if (dt > .027) slowFrames += 1;
      else slowFrames = Math.max(0, slowFrames - 2);
      if (slowFrames > 24 && pointCount > 1900) {
        pointCount -= 250;
        slowFrames = 0;
      }
      update(dt);
      draw();
      if (alive) raf = requestAnimationFrame(loop);
    }

    function start() {
      cancelAnimationFrame(raf);
      alive = true;
      last = 0;
      elapsed = 0;
      held = false;
      holdTime = 0;
      forms = 0;
      mode = Math.floor(Math.random() * 3);
      seed = Math.random() * Math.PI * 2;
      yaw = targetYaw = baseYaw = randomBetween(-.22, .22);
      stretch = targetStretch = baseStretch = 1;
      coherence = .62;
      flash = 0;
      pointCount = Math.min(MAX_POINTS, env.W > env.H ? 3200 : 2850);
      slowFrames = 0;
      clearFrames = 3;
      toneStep = 1.2;
      resetOffsets();
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
        startX = pointerX;
        startY = pointerY;
        baseYaw = targetYaw;
        baseStretch = targetStretch;
        toneStep = 1.2;
        env.beep(145, 260, .09, .028, 'sine');
      } else if (type === 'move' && held) {
        targetYaw = baseYaw + (pointerX - startX) / Math.max(1, env.W) * Math.PI * 1.8;
        targetStretch = clamp(baseStretch + (pointerY - startY) / Math.max(1, env.H) * 1.5, .58, 1.55);
      } else if (type === 'up' && held) {
        held = false;
        burst();
        holdTime = 0;
        baseYaw = targetYaw;
        baseStretch = targetStretch;
      }
    }

    /* This artwork ends only when the viewer leaves through the platform gesture. */
    function finishArtwork() {
      env.over(forms);
    }
    void finishArtwork;

    return { start, stop, input };
  }
}
]);
