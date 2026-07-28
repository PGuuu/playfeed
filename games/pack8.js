/* PlayFeed original: Neon Last Stand — compact portrait defense with roguelike choices. */
window.GAMES = (window.GAMES || []).concat([
{
  apiVersion: 1,
  gameVersion: '1.3.0',
  id: 'neon-last-stand',
  title: '霓虹終線',
  author: '@playfeed 官方',
  description: '左右移動守衛，持續突破愈來愈危險的霓虹防線與頭目。',
  tip: '左右拖曳守衛；強化出現時點選左邊或右邊',
  bg: '#160C29',
  tags: ['defense', 'roguelike', 'shooter', 'neon'],
  controls: ['horizontal-drag', 'tap'],
  preview: 'demo',
  duration: 60,
  score: { label: '擊破 / Kills', order: 'higher', decimals: 0 },
  remixSlots: [
    {
      key: 'defender',
      label: '守衛',
      hint: '畫面底部自動射擊的角色',
      default: '🛡️',
      shape: 'square'
    },
    {
      key: 'enemy-core',
      label: '敵方核心',
      hint: '從上方逐步逼近的霓虹敵人',
      default: '👾',
      shape: 'square'
    }
  ],

  create(env) {
    const ctx = env.ctx;
    const W = env.W;
    const H = env.H;
    const sprite = env.sprite || (() => false);
    const english = String(env.locale || '').toLowerCase().startsWith('en');
    const text = (zh, en) => english ? en : zh;
    const colors = ['#FF2E93', '#FF7A38', '#9B5CFF', '#37E6FF', '#F9D84A'];
    const upgrades = [
      ['rapid', '極速砲管', 'Rapid Barrel', '射擊速度 +18%', 'Fire rate +18%', '⚡'],
      ['power', '增幅彈頭', 'Power Rounds', '每發傷害 +1', 'Damage +1', '✦'],
      ['multi', '分裂射擊', 'Split Shot', '增加一條彈道', 'Add one firing lane', '⑶'],
      ['shield', '量子護盾', 'Quantum Shield', '修復 40% 防線', 'Restore 40% shield', '⬡'],
      ['chain', '連鎖電弧', 'Chain Arc', '命中時電擊鄰近敵人', 'Shock nearby enemies', 'ϟ']
    ];

    let alive = false;
    let raf = 0;
    let last = 0;
    let battleTime = 0;
    let introTime = 0;
    let playerX = W / 2;
    let targetX = W / 2;
    let dragging = false;
    let bullets = [];
    let enemies = [];
    let particles = [];
    let arcs = [];
    let stars = [];
    let score = 0;
    let shield = 100;
    let energy = 0;
    let nextEnergy = 7;
    let upgradeCount = 0;
    let midUpgradeTaken = false;
    let choices = null;
    let rewardChoice = false;
    let fireClock = 0;
    let spawnClock = 0;
    let fireInterval = 0.31;
    let damage = 1;
    let lanes = 1;
    let chainLevel = 0;
    let shake = 0;
    let flash = 0;
    let bossSpawned = false;
    let spawnedCount = 0;
    let zone = 1;
    let zonePower = 1;
    let zoneLeaks = 0;
    let zoneStartShield = 100;
    let threatBonus = 0;
    let perfectClear = false;

    function zoneTarget() {
      return Math.min(28, 16 + (zone - 1) * 2);
    }

    function playerPower() {
      const laneFactor = 1 + (lanes - 1) * 0.72;
      const chainFactor = 1 + chainLevel * 0.14;
      return damage * laneFactor * chainFactor / fireInterval;
    }

    function challengeLevel() {
      return Math.max(0, zone - 1 + threatBonus);
    }

    function clamp(value, low, high) {
      return Math.max(low, Math.min(high, value));
    }

    function roundedRect(x, y, w, h, r) {
      const radius = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    }

    function makeStars() {
      stars = [];
      for (let i = 0; i < 55; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: 0.4 + Math.random() * 1.4,
          a: 0.18 + Math.random() * 0.55
        });
      }
    }

    function spawnEnemy(isBoss) {
      const progress = Math.min(1, spawnedCount / zoneTarget());
      const challenge = challengeLevel();
      const kindRoll = Math.random();
      const kind = isBoss
        ? 'boss'
        : challenge >= 3 && kindRoll < Math.min(0.28, 0.11 + challenge * 0.018)
          ? 'armored'
          : challenge >= 2 && kindRoll < Math.min(0.53, 0.3 + challenge * 0.025)
            ? 'swift'
            : challenge >= 1 && kindRoll < Math.min(0.78, 0.52 + challenge * 0.025)
              ? 'zigzag'
              : 'normal';
      const size = isBoss
        ? Math.min(W * 0.46, 184)
        : kind === 'swift'
          ? 36 + Math.random() * 20
          : 44 + Math.random() * 38;
      const healthBudget = zonePower * (0.62 + challenge * 0.055) + progress * (1.5 + challenge * 0.2);
      const kindHealth = kind === 'armored' ? 1.55 : kind === 'swift' ? 0.72 : 1;
      const hp = isBoss
        ? Math.max(28, Math.round(zonePower * (3.8 + challenge * 0.3)))
        : Math.max(2, Math.round(healthBudget * kindHealth * (0.88 + Math.random() * 0.24)));
      const baseSpeed = 19 + Math.min(43, challenge * 3.2) + progress * 8 + Math.random() * 6;
      enemies.push({
        x: 24 + size / 2 + Math.random() * Math.max(1, W - 48 - size),
        y: isBoss ? 74 : 58,
        w: size,
        h: isBoss ? 82 : size * (0.58 + Math.random() * 0.25),
        hp,
        maxHp: hp,
        speed: isBoss ? Math.min(18, 8 + zone * 0.8) : baseSpeed * (kind === 'swift' ? 1.45 : 1),
        color: isBoss ? '#FF2E93' : colors[Math.floor(Math.random() * colors.length)],
        boss: !!isBoss,
        kind,
        armor: kind === 'armored' ? Math.min(3, Math.floor(1 + challenge / 5)) : 0,
        vx: kind === 'zigzag' ? (Math.random() < 0.5 ? -1 : 1) * (24 + zone * 2) : 0,
        hit: 0,
        phase: Math.random() * Math.PI * 2
      });
      if (!isBoss) spawnedCount += 1;
    }

    function burst(x, y, color, amount) {
      for (let i = 0; i < amount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 35 + Math.random() * 115;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.32 + Math.random() * 0.45,
          max: 0.77,
          color,
          r: 1.5 + Math.random() * 3
        });
      }
    }

    function shoot() {
      const offsets = lanes === 1 ? [0] : lanes === 2 ? [-9, 9] : [-15, 0, 15];
      for (let i = 0; i < offsets.length; i++) {
        bullets.push({
          x: playerX + offsets[i],
          y: H - 128,
          vx: offsets[i] * 0.8,
          vy: -465,
          damage
        });
      }
    }

    function nearestEnemy(source, excluded) {
      let chosen = null;
      let distance = Infinity;
      for (let i = 0; i < enemies.length; i++) {
        const candidate = enemies[i];
        if (candidate === source || candidate === excluded || candidate.hp <= 0) continue;
        const dx = candidate.x - source.x;
        const dy = candidate.y - source.y;
        const d = dx * dx + dy * dy;
        if (d < distance && d < 23000) {
          distance = d;
          chosen = candidate;
        }
      }
      return chosen;
    }

    function destroyEnemy(enemy) {
      enemy.hp = 0;
      score += enemy.boss ? 8 : 1;
      energy += enemy.boss ? 5 : 1;
      flash = Math.max(flash, enemy.boss ? 0.3 : 0.08);
      burst(enemy.x, enemy.y, enemy.color, enemy.boss ? 42 : 16);
      env.setScore(score);
      if (enemy.boss) {
        const clearedZone = zone;
        perfectClear = zoneLeaks === 0 && shield >= zoneStartShield;
        if (perfectClear) threatBonus = Math.min(7, threatBonus + 0.7);
        else if (zoneLeaks <= 1) threatBonus = Math.min(7, threatBonus + 0.2);
        zone += 1;
        bossSpawned = false;
        spawnedCount = 0;
        midUpgradeTaken = false;
        shield = Math.min(100, shield + 12);
        energy = 0;
        nextEnergy = Math.max(7, Math.ceil(zoneTarget() * 0.55));
        zoneLeaks = 0;
        spawnClock = 1;
        showUpgrade(true, clearedZone);
        return;
      }
      if (energy >= nextEnergy && !midUpgradeTaken && !choices) {
        midUpgradeTaken = true;
        showUpgrade(false, zone);
      }
    }

    function hitEnemy(enemy, amount) {
      if (!enemy || enemy.hp <= 0) return;
      const actualDamage = enemy.armor ? Math.max(0.5, amount - enemy.armor) : amount;
      enemy.hp -= actualDamage;
      enemy.hit = 0.11;
      burst(enemy.x, enemy.y, '#DFFFFF', 4);
      if (chainLevel > 0) {
        let from = enemy;
        let previous = null;
        for (let jump = 0; jump < chainLevel; jump++) {
          const target = nearestEnemy(from, previous);
          if (!target) break;
          arcs.push({ ax: from.x, ay: from.y, bx: target.x, by: target.y, life: 0.14 });
          target.hp -= target.armor ? 0.5 : 1;
          target.hit = 0.1;
          if (target.hp <= 0) destroyEnemy(target);
          previous = from;
          from = target;
        }
      }
      if (enemy.hp <= 0) destroyEnemy(enemy);
    }

    function showUpgrade(isReward, clearedZone) {
      const available = upgrades.filter(item => {
        if (item[0] === 'rapid') return fireInterval > 0.155;
        if (item[0] === 'multi') return lanes < 3;
        if (item[0] === 'chain') return chainLevel < 3;
        return true;
      });
      const firstIndex = (upgradeCount + Math.floor(Math.random() * available.length)) % available.length;
      let secondIndex = (firstIndex + 1 + Math.floor(Math.random() * Math.max(1, available.length - 1))) % available.length;
      if (secondIndex === firstIndex) secondIndex = (secondIndex + 1) % available.length;
      choices = [available[firstIndex], available[secondIndex]];
      rewardChoice = !!isReward;
      choices.clearedZone = clearedZone || zone;
      dragging = false;
      burst(W / 2, H * 0.48, '#37E6FF', 24);
    }

    function applyUpgrade(choice) {
      if (!choice) return;
      const wasReward = rewardChoice;
      if (choice[0] === 'rapid') fireInterval = Math.max(0.15, fireInterval * 0.82);
      if (choice[0] === 'power') damage += 1;
      if (choice[0] === 'multi' && lanes < 3) lanes += 1;
      if (choice[0] === 'shield') shield = Math.min(100, shield + 40);
      if (choice[0] === 'chain' && chainLevel < 3) chainLevel += 1;
      choices = null;
      rewardChoice = false;
      upgradeCount += 1;
      energy = 0;
      if (wasReward) {
        zonePower = playerPower();
        zoneStartShield = shield;
      }
      flash = 0.28;
    }

    function update(dt) {
      introTime += dt;
      shake = Math.max(0, shake - dt * 16);
      flash = Math.max(0, flash - dt);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 85 * dt;
        if (p.life <= 0) particles.splice(i, 1);
      }
      for (let i = arcs.length - 1; i >= 0; i--) {
        arcs[i].life -= dt;
        if (arcs[i].life <= 0) arcs.splice(i, 1);
      }
      if (choices) return;

      battleTime += dt;
      playerX += (targetX - playerX) * Math.min(1, dt * 13);
      fireClock -= dt;
      if (fireClock <= 0) {
        shoot();
        fireClock = fireInterval;
      }

      spawnClock -= dt;
      const target = zoneTarget();
      const challenge = challengeLevel();
      const spawnEvery = Math.max(0.25, 0.84 - challenge * 0.043 - spawnedCount * 0.006);
      if (spawnClock <= 0 && spawnedCount < target) {
        spawnEnemy(false);
        if (challenge >= 5 && spawnedCount < target && Math.random() < Math.min(0.32, 0.08 + challenge * 0.018)) {
          spawnEnemy(false);
        }
        spawnClock = spawnEvery;
      }
      if (!bossSpawned && spawnedCount >= target && enemies.length === 0) {
        bossSpawned = true;
        spawnEnemy(true);
      }

      for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        let consumed = false;
        for (let j = 0; j < enemies.length; j++) {
          const enemy = enemies[j];
          if (
            enemy.hp > 0 &&
            bullet.x > enemy.x - enemy.w / 2 &&
            bullet.x < enemy.x + enemy.w / 2 &&
            bullet.y > enemy.y - enemy.h / 2 &&
            bullet.y < enemy.y + enemy.h / 2
          ) {
            hitEnemy(enemy, bullet.damage);
            consumed = true;
            break;
          }
        }
        if (consumed || bullet.y < 35 || bullet.x < -20 || bullet.x > W + 20) {
          bullets.splice(i, 1);
        }
      }
      if (!alive) return;

      const defenseY = H - 102;
      for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.y += enemy.speed * dt;
        enemy.x += enemy.vx * dt;
        if (enemy.x < enemy.w / 2 + 12 || enemy.x > W - enemy.w / 2 - 12) {
          enemy.vx *= -1;
          enemy.x = clamp(enemy.x, enemy.w / 2 + 12, W - enemy.w / 2 - 12);
        }
        enemy.phase += dt * 3;
        enemy.hit = Math.max(0, enemy.hit - dt);
        if (enemy.hp <= 0) {
          enemies.splice(i, 1);
        } else if (enemy.y + enemy.h / 2 >= defenseY) {
          const leakDamage = 10 + Math.min(20, zone * 1.7) + (enemy.kind === 'armored' ? 5 : 0);
          shield = enemy.boss ? 0 : Math.max(0, shield - leakDamage);
          if (!enemy.boss) zoneLeaks += 1;
          shake = enemy.boss ? 14 : 7;
          flash = 0.22;
          burst(enemy.x, defenseY, '#FF496D', enemy.boss ? 36 : 18);
          enemies.splice(i, 1);
        }
      }

      if (shield <= 0) {
        alive = false;
        env.over(score);
      }
    }

    function drawBackground() {
      const gradient = ctx.createLinearGradient(0, 0, 0, H);
      gradient.addColorStop(0, '#0A1029');
      gradient.addColorStop(0.55, '#251035');
      gradient.addColorStop(1, '#5B163F');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        ctx.globalAlpha = star.a * (0.7 + Math.sin(battleTime * 2 + i) * 0.3);
        ctx.fillStyle = i % 3 ? '#B8F7FF' : '#FF8AD1';
        ctx.beginPath();
        ctx.arc(star.x, (star.y + battleTime * (4 + i % 5)) % H, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const horizon = H - 90;
      const glow = ctx.createLinearGradient(0, horizon - 150, 0, horizon + 20);
      glow.addColorStop(0, 'rgba(255,46,147,0)');
      glow.addColorStop(1, 'rgba(255,46,147,.35)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, horizon - 150, W, 170);

      ctx.strokeStyle = 'rgba(55,230,255,.12)';
      ctx.lineWidth = 1;
      for (let y = horizon; y > horizon - 145; y -= 24) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      for (let x = -W; x < W * 2; x += 42) {
        ctx.beginPath();
        ctx.moveTo(W / 2, horizon - 150);
        ctx.lineTo(x, horizon);
        ctx.stroke();
      }
    }

    function drawEnemy(enemy) {
      ctx.save();
      ctx.translate(enemy.x, enemy.y + Math.sin(enemy.phase) * 2);
      ctx.shadowColor = enemy.color;
      ctx.shadowBlur = enemy.hit ? 30 : 13;
      ctx.globalAlpha = enemy.hit ? 0.65 : 1;
      ctx.fillStyle = enemy.color;
      roundedRect(-enemy.w / 2, -enemy.h / 2, enemy.w, enemy.h, enemy.boss ? 9 : 5);
      ctx.fill();
      ctx.lineWidth = enemy.boss ? 4 : enemy.kind === 'armored' ? 5 : 2;
      ctx.strokeStyle = '#FFE6FA';
      ctx.stroke();
      if (enemy.kind === 'armored') {
        ctx.globalAlpha = 0.68;
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#37E6FF';
        roundedRect(-enemy.w / 2 + 7, -enemy.h / 2 + 7, enemy.w - 14, enemy.h - 14, 4);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (enemy.kind === 'swift') {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(-9, -enemy.h / 2 - 7);
        ctx.lineTo(0, -enemy.h / 2 - 17);
        ctx.lineTo(9, -enemy.h / 2 - 7);
        ctx.fill();
      }

      if (!sprite('enemy-core', 0, 0, Math.min(enemy.w, enemy.h) * 0.54)) {
        ctx.fillStyle = 'rgba(18,8,35,.82)';
        ctx.beginPath();
        ctx.arc(0, 0, Math.min(enemy.w, enemy.h) * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `800 ${enemy.boss ? 22 : 17}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(Math.max(0, Math.ceil(enemy.hp))), 0, 1);
      ctx.restore();

      if (enemy.boss) {
        const barW = enemy.w * 0.76;
        ctx.fillStyle = 'rgba(0,0,0,.5)';
        roundedRect(enemy.x - barW / 2, enemy.y - enemy.h / 2 - 15, barW, 7, 4);
        ctx.fill();
        ctx.fillStyle = '#37E6FF';
        roundedRect(enemy.x - barW / 2, enemy.y - enemy.h / 2 - 15, barW * enemy.hp / enemy.maxHp, 7, 4);
        ctx.fill();
      }
    }

    function drawPlayer() {
      const y = H - 121;
      ctx.save();
      ctx.translate(playerX, y);
      ctx.shadowColor = '#37E6FF';
      ctx.shadowBlur = 24;
      ctx.strokeStyle = '#A9FAFF';
      ctx.fillStyle = '#123A58';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-24, 18);
      ctx.lineTo(-17, -10);
      ctx.lineTo(-7, -18);
      ctx.lineTo(-4, -38);
      ctx.lineTo(4, -38);
      ctx.lineTo(7, -18);
      ctx.lineTo(17, -10);
      ctx.lineTo(24, 18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (!sprite('defender', 0, -5, 42)) {
        ctx.fillStyle = '#37E6FF';
        ctx.beginPath();
        ctx.arc(0, -8, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.shadowColor = '#37E6FF';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#37E6FF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(playerX, y + 7, 34, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    function drawHud() {
      ctx.fillStyle = 'rgba(5,8,25,.72)';
      roundedRect(16, 16, W - 32, 52, 16);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 18px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${text('擊破', 'Kills')} ${score}`, 34, 42);
      ctx.textAlign = 'right';
      const target = zoneTarget();
      ctx.fillText(
        bossSpawned
          ? `${text('區域', 'ZONE')} ${zone} · ${text('頭目', 'BOSS')}`
          : `${text('區域', 'ZONE')} ${zone} · ${Math.min(spawnedCount, target)}/${target}`,
        W - 34,
        42
      );

      const shieldW = W - 68;
      ctx.fillStyle = 'rgba(255,255,255,.15)';
      roundedRect(34, H - 74, shieldW, 12, 6);
      ctx.fill();
      const shieldColor = shield > 35 ? '#37E6FF' : '#FF496D';
      ctx.fillStyle = shieldColor;
      roundedRect(34, H - 74, shieldW * shield / 100, 12, 6);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${text('防線', 'Shield')} ${Math.ceil(shield)}%`, W / 2, H - 50);

      const meterW = Math.min(150, W * 0.38);
      const meterX = (W - meterW) / 2;
      ctx.fillStyle = 'rgba(255,255,255,.13)';
      roundedRect(meterX, 78, meterW, 8, 4);
      ctx.fill();
      ctx.fillStyle = '#FFD84A';
      roundedRect(meterX, 78, meterW * Math.min(1, energy / nextEnergy), 8, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.72)';
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.fillText(text('強化充能', 'UPGRADE CHARGE'), W / 2, 98);
    }

    function drawUpgrade() {
      if (!choices) return;
      ctx.fillStyle = 'rgba(4,5,18,.76)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `900 ${english && rewardChoice ? 22 : 25}px system-ui, sans-serif`;
      const upgradeTitle = rewardChoice
        ? perfectClear
          ? text(`區域 ${choices.clearedZone} 完美突破`, `ZONE ${choices.clearedZone} PERFECT`)
          : text(`區域 ${choices.clearedZone} 突破`, `ZONE ${choices.clearedZone} CLEARED`)
        : text('選擇一項強化', 'CHOOSE AN UPGRADE');
      ctx.fillText(upgradeTitle, W / 2, H * 0.29);
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.fillText(
        rewardChoice
          ? perfectClear
            ? text(`防線修復 12%，無傷使下一區威脅提高`, `Shield +12%. Perfect defense raises the threat`)
            : text(`防線修復 12%，選擇強化進入區域 ${zone}`, `Shield +12%. Choose an upgrade for Zone ${zone}`)
          : text('點左邊或右邊，戰鬥會立刻繼續', 'Tap left or right to continue'),
        W / 2,
        H * 0.335
      );

      const gap = 14;
      const cardW = (W - 46 - gap) / 2;
      const cardY = H * 0.38;
      const cardH = 178;
      for (let i = 0; i < 2; i++) {
        const choice = choices[i];
        const x = 23 + i * (cardW + gap);
        const color = i === 0 ? '#37E6FF' : '#FF2E93';
        ctx.shadowColor = color;
        ctx.shadowBlur = 18;
        ctx.fillStyle = 'rgba(20,19,49,.97)';
        roundedRect(x, cardY, cardW, cardH, 18);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = color;
        ctx.font = '900 43px system-ui, sans-serif';
        ctx.fillText(choice[5], x + cardW / 2, cardY + 48);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `800 ${english ? 15 : 17}px system-ui, sans-serif`;
        ctx.fillText(english ? choice[2] : choice[1], x + cardW / 2, cardY + 102);
        ctx.fillStyle = 'rgba(255,255,255,.72)';
        ctx.font = `600 ${english ? 12 : 13}px system-ui, sans-serif`;
        ctx.fillText(english ? choice[4] : choice[3], x + cardW / 2, cardY + 136);
      }
    }

    function drawIntro() {
      if (introTime > 3.2 || choices) return;
      const alpha = introTime < 2.5 ? 1 : Math.max(0, (3.2 - introTime) / 0.7);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(5,8,25,.78)';
      roundedRect(W / 2 - 150, H * 0.52 - 46, 300, 92, 20);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 20px system-ui, sans-serif';
      ctx.fillText(text('左右拖曳，自動射擊', 'DRAG LEFT OR RIGHT'), W / 2, H * 0.52 - 12);
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillStyle = '#A9FAFF';
      ctx.fillText(text('別讓霓虹核心突破防線', 'Stop every core before it breaks through'), W / 2, H * 0.52 + 19);
      ctx.globalAlpha = 1;
    }

    function draw() {
      ctx.save();
      if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      drawBackground();

      for (let i = 0; i < bullets.length; i++) {
        const bullet = bullets[i];
        ctx.shadowColor = '#37E6FF';
        ctx.shadowBlur = 13;
        ctx.strokeStyle = '#D7FFFF';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bullet.x, bullet.y + 12);
        ctx.lineTo(bullet.x, bullet.y - 9);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      for (let i = 0; i < enemies.length; i++) drawEnemy(enemies[i]);
      for (let i = 0; i < arcs.length; i++) {
        const arc = arcs[i];
        ctx.globalAlpha = Math.min(1, arc.life * 8);
        ctx.strokeStyle = '#F9D84A';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#F9D84A';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(arc.ax, arc.ay);
        ctx.lineTo((arc.ax + arc.bx) / 2 + (Math.random() - 0.5) * 18, (arc.ay + arc.by) / 2);
        ctx.lineTo(arc.bx, arc.by);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.strokeStyle = shield > 35 ? 'rgba(55,230,255,.8)' : 'rgba(255,73,109,.9)';
      ctx.shadowColor = shield > 35 ? '#37E6FF' : '#FF496D';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(18, H - 101);
      ctx.lineTo(W - 18, H - 101);
      ctx.stroke();
      ctx.shadowBlur = 0;

      drawPlayer();
      drawHud();
      drawIntro();
      drawUpgrade();
      if (flash > 0) {
        ctx.globalAlpha = Math.min(0.34, flash);
        ctx.fillStyle = flash > 0.2 ? '#FFFFFF' : '#FF2E93';
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    function loop(now) {
      if (!alive) return;
      const dt = Math.min(0.04, Math.max(0, (now - last) / 1000 || 0.016));
      last = now;
      update(dt);
      draw();
      if (alive) raf = requestAnimationFrame(loop);
    }

    function start() {
      stop();
      alive = true;
      last = performance.now();
      battleTime = 0;
      introTime = 0;
      playerX = W / 2;
      targetX = W / 2;
      dragging = false;
      bullets = [];
      enemies = [];
      particles = [];
      arcs = [];
      score = 0;
      shield = 100;
      energy = 0;
      nextEnergy = 7;
      upgradeCount = 0;
      midUpgradeTaken = false;
      choices = null;
      rewardChoice = false;
      fireClock = 0.18;
      spawnClock = 0.45;
      fireInterval = 0.31;
      damage = 1;
      lanes = 1;
      chainLevel = 0;
      shake = 0;
      flash = 0;
      bossSpawned = false;
      spawnedCount = 0;
      zone = 1;
      zonePower = playerPower();
      zoneLeaks = 0;
      zoneStartShield = 100;
      threatBonus = 0;
      perfectClear = false;
      makeStars();
      raf = requestAnimationFrame(loop);
    }

    function stop() {
      alive = false;
      dragging = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    function input(type, x, y) {
      if (!alive) return;
      if (type === 'cancel') {
        dragging = false;
        return;
      }
      if (choices && type === 'down') {
        applyUpgrade(choices[x < W / 2 ? 0 : 1]);
        return;
      }
      if (choices) return;
      if (type === 'down') {
        dragging = true;
        targetX = clamp(x, 34, W - 34);
      } else if (type === 'move' && dragging) {
        targetX = clamp(x, 34, W - 34);
      } else if (type === 'up') {
        targetX = clamp(x, 34, W - 34);
        dragging = false;
      }
    }

    return { start, stop, input };
  }
}
]);
