(() => {
  const key = 'fangame:update-notice:collections-20261118';
  const dialog = document.querySelector('#update-notice');
  const card = dialog.querySelector('.update-notice-card');
  const button = dialog.querySelector('button');
  const effects = dialog.querySelector('.update-notice-effects');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let drift;
  let nudge;
  let shooting = false;

  try {
    if (localStorage.getItem(key)) return;
  } catch {
    try { if (sessionStorage.getItem(key)) return; } catch {}
  }
  if (typeof dialog.showModal !== 'function') return;

  function move() {
    if (shooting || !dialog.open || reducedMotion.matches) return;
    const x = Math.min(90, Math.max(0, (dialog.clientWidth - card.offsetWidth) / 2 - 12));
    const y = Math.min(75, Math.max(0, (dialog.clientHeight - card.offsetHeight) / 2 - 75));
    drift = card.animate([
      {transform: getComputedStyle(card).transform},
      {transform: `translate(${(Math.random() * 2 - 1) * x}px, ${(Math.random() * 2 - 1) * y}px)`}
    ], {duration: 2800 + Math.random() * 1600, fill:'forwards', easing:'ease-in-out'});
    drift.onfinish = () => {
      if (shooting || !dialog.open) return;
      card.style.transform = getComputedStyle(card).transform;
      drift.cancel();
      move();
    };
  }

  function effect(className, x, y) {
    const node = document.createElement('div');
    node.className = className;
    node.style.left = x + 'px';
    node.style.top = y + 'px';
    effects.append(node);
    return node;
  }

  async function shoot() {
    if (shooting) return;
    shooting = true;
    nudge?.cancel();
    button.disabled = true;
    drift?.pause();
    try {
      if (reducedMotion.matches) return;
      const from = button.getBoundingClientRect();
      const target = card.getBoundingClientRect();
      const startX = from.left + from.width / 2;
      const startY = from.top;
      const hitX = target.left + target.width / 2;
      const hitY = target.top + target.height / 2;
      const rotation = 'rotate(' + Math.atan2(hitY - startY, hitX - startX) + 'rad)';
      const beam = effect('update-notice-beam', startX, startY);
      beam.style.width = Math.hypot(hitX - startX, hitY - startY) + 'px';
      await beam.animate([
        {transform: rotation + ' scaleX(0)'}, {transform: rotation + ' scaleX(1)'}
      ], {duration:160, fill:'forwards'}).finished;
      beam.remove();
      card.hidden = true;
      const sparks = Array.from({length:18}, (_, index) => {
        const angle = index * Math.PI / 9;
        const distance = 26 + Math.random() * 66;
        const spark = effect('update-notice-spark', hitX, hitY);
        return spark.animate([
          {opacity:1, transform:'scale(1.2)'},
          {opacity:0, transform:`translate(${Math.cos(angle) * distance}px,${Math.sin(angle) * distance}px) rotate(120deg) scale(.2)`}
        ], {duration:380, easing:'ease-out', fill:'forwards'}).finished;
      });
      await Promise.all(sparks);
    } finally {
      dialog.close();
    }
  }

  button.addEventListener('click', shoot);
  dialog.addEventListener('click', event => {
    if (shooting || button.contains(event.target)) return;
    nudge?.cancel();
    const resting = {transform:'translateY(0)'};
    const lifted = {transform:'translateY(-8px)'};
    nudge = reducedMotion.matches
      ? button.animate([{outline:'3px solid #fff3df'}, {outline:'3px solid #fff3df'}], {duration:550})
      : button.animate([resting, lifted, resting, lifted, resting], {duration:520, easing:'ease-in-out'});
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); shoot(); });
  dialog.addEventListener('close', () => {
    drift?.cancel();
    document.body.classList.remove('update-notice-open');
  });
  dialog.showModal();
  document.body.classList.add('update-notice-open');
  try { localStorage.setItem(key, '1'); }
  catch { try { sessionStorage.setItem(key, '1'); } catch {} }
  move();
})();
