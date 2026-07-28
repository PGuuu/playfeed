import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../games/pack8.js', import.meta.url), 'utf8');
let callback = null;
let now = 0;
let finalScore = null;
let currentScore = 0;
const gradient = { addColorStop() {} };
const ctx = new Proxy({}, {
  get(target, key) {
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
    if (key === 'measureText') return text => ({ width: String(text).length * 8 });
    if (!(key in target)) target[key] = () => {};
    return target[key];
  },
  set(target, key, value) {
    target[key] = value;
    return true;
  }
});
const sandbox = {
  window: { GAMES: [] },
  Math,
  console,
  performance: { now: () => now },
  requestAnimationFrame(fn) {
    callback = fn;
    return 1;
  },
  cancelAnimationFrame() {
    callback = null;
  }
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'pack8.js' });
const game = sandbox.window.GAMES[0];
if (!game || game.id !== 'neon-last-stand') throw new Error('Game registration failed');
const instance = game.create({
  ctx,
  W: 400,
  H: 700,
  locale: 'en',
  sprite: () => false,
  setScore(score) {
    currentScore = score;
  },
  over(score) {
    finalScore = score;
  }
});
instance.start();
for (let frame = 0; frame < 5000 && finalScore === null; frame++) {
  const fn = callback;
  if (!fn) throw new Error(`Animation stopped before env.over() at frame ${frame}`);
  callback = null;
  now += 16.667;
  fn(now);
  if (frame % 20 === 0) {
    const x = 40 + ((frame * 19) % 320);
    instance.input('down', x, 500);
    instance.input('move', x, 500);
    instance.input('up', x, 500);
  }
}
instance.stop();
if (!Number.isFinite(currentScore) || currentScore <= 24) {
  throw new Error(`Endless run did not continue beyond the first boss (score ${currentScore})`);
}
if (finalScore !== null && !Number.isFinite(finalScore)) throw new Error('Game ended with a non-finite score');
const endlessScore = currentScore;

callback = null;
now = 0;
finalScore = null;
currentScore = 0;
const doomed = game.create({
  ctx,
  W: 400,
  H: 700,
  locale: 'zh-Hant',
  sprite: () => false,
  setScore(score) {
    currentScore = score;
  },
  over(score) {
    finalScore = score;
  }
});
doomed.start();
for (let frame = 0; frame < 6000 && finalScore === null; frame++) {
  const fn = callback;
  if (!fn) throw new Error(`Animation stopped before loss at frame ${frame}`);
  callback = null;
  now += 16.667;
  fn(now);
}
doomed.stop();
if (!Number.isFinite(finalScore)) throw new Error('An unattended run did not end when the shield failed');
console.log(`pack8 endless runtime test passed (continued score ${endlessScore}, loss score ${finalScore})`);
