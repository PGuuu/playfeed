import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../games/pack11.js', import.meta.url), 'utf8');
let callback = null;
let now = 0;
let score = -1;
let sounds = 0;
const gradient = { addColorStop() {} };
const ctx = new Proxy({}, {
  get(target, key) {
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
    if (key === 'measureText') return text => ({ width: String(text).length * 9 });
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
  Float32Array,
  requestAnimationFrame(fn) {
    callback = fn;
    return 1;
  },
  cancelAnimationFrame() {
    callback = null;
  }
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'pack11.js' });
const definition = sandbox.window.GAMES[0];
assert.equal(definition.id, 'ink-creature');
assert.equal(definition.title, 'Ink Creature');
assert.equal(definition.preview, 'cover');

for (const dimensions of [{ W: 400, H: 760 }, { W: 920, H: 700 }]) {
  callback = null;
  now = 0;
  score = -1;
  const instance = definition.create({
    ...dimensions,
    ctx,
    locale: 'en',
    sprite: () => false,
    beep() { sounds += 1; },
    setScore(value) { score = value; },
    over() {}
  });
  instance.start();
  assert.equal(score, 0);
  for (let frame = 0; frame < 20; frame++) {
    const fn = callback;
    assert.equal(typeof fn, 'function');
    callback = null;
    now += 16.667;
    fn(now);
  }
  instance.input('down', dimensions.W * .5, dimensions.H * .48);
  for (let frame = 0; frame < 90; frame++) {
    const fn = callback;
    callback = null;
    now += 16.667;
    fn(now);
    if (frame === 40) instance.input('move', dimensions.W * .7, dimensions.H * .62);
  }
  instance.input('up', dimensions.W * .7, dimensions.H * .62);
  assert.equal(score, 1, 'release should create a new form');
  for (let frame = 0; frame < 40; frame++) {
    const fn = callback;
    callback = null;
    now += 16.667;
    fn(now);
  }
  instance.input('cancel', 0, 0);
  instance.stop();
  assert.equal(callback, null);
}
assert(sounds > 0, 'interaction should route sound through env.beep');
console.log('ink-creature responsive runtime test passed');
