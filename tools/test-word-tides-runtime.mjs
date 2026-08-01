import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../games/pack10.js', import.meta.url), 'utf8');
let callback = null;
let now = 0;
let score = -1;
let sounds = 0;
const gradient = { addColorStop() {} };
const ctx = new Proxy({}, {
  get(target, key) {
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
    if (key === 'measureText') return value => ({ width: String(value).length * 12 });
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
  requestAnimationFrame(fn) {
    callback = fn;
    return 1;
  },
  cancelAnimationFrame() {
    callback = null;
  }
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'pack10.js' });

const definition = sandbox.window.GAMES[0];
assert.equal(definition.id, 'word-tides');
assert.equal(definition.preview, 'cover');
assert.equal(definition.remixSlots.length, 2);

const dimensions = [
  { W: 400, H: 760 },
  { W: 920, H: 700 }
];
for (const size of dimensions) {
  callback = null;
  now = 0;
  score = -1;
  const instance = definition.create({
    ...size,
    ctx,
    locale: 'zh-Hant',
    sprite: () => false,
    beep() { sounds += 1; },
    setScore(value) { score = value; },
    over() {}
  });
  instance.start();
  assert.equal(score, 0);
  for (let frame = 0; frame < 24; frame++) {
    const fn = callback;
    assert.equal(typeof fn, 'function', `animation missing on ${size.W}×${size.H}`);
    callback = null;
    now += 16.667;
    fn(now);
  }
  instance.input('down', size.W * .35, size.H * .48);
  for (let frame = 0; frame < 100; frame++) {
    const fn = callback;
    callback = null;
    now += 16.667;
    fn(now);
    if (frame % 8 === 0) {
      instance.input('move', size.W * (.35 + frame / 250), size.H * (.48 + frame / 800));
    }
  }
  instance.input('up', size.W * .72, size.H * .6);
  assert(score > 0, 'releasing a held gesture should create resonance');
  instance.input('cancel', 0, 0);
  instance.stop();
  assert.equal(callback, null, 'stop() must cancel the animation frame');
}
assert(sounds > 0, 'formal interaction should emit platform-routed sound cues');
console.log('word-tides responsive runtime test passed');
