import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../vendor/acorn.mjs';
import { compilePlayFeedLanguage } from '../playfeed-lang.js';
import { findReturnedGameInstance, hasGameInstanceMethod } from '../validator-ast.mjs';
import serverValidator from '../api/_validate.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const examples = ['answer-book.pfl', 'coin-rain.pfl', 'shikaku.pfl'];

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(item => walk(item, visit));
    else if (value && typeof value.type === 'string') walk(value, visit);
  }
}

function registration(program) {
  let game = null;
  walk(program, node => {
    if (node.type !== 'CallExpression' || node.callee?.property?.name !== 'concat') return;
    const value = node.arguments?.[0]?.elements?.[0];
    if (value?.type === 'ObjectExpression') game = value;
  });
  return game;
}

function property(object, name) {
  return object.properties.find(item =>
    item.type === 'Property' && (item.key?.name === name || item.key?.value === name));
}

function createHarness(source) {
  let nextFrame = 1;
  const frames = new Map();
  globalThis.requestAnimationFrame = callback => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  globalThis.window = { GAMES: [] };
  new Function(source)();
  const game = window.GAMES[0];
  const events = { scores: [], over: [], sprites: 0 };
  const gradient = { addColorStop() {} };
  const context = new Proxy({
    measureText(text) { return { width: String(text).length * 9 }; },
    createLinearGradient() { return gradient; },
  }, {
    get(target, key) {
      if (key in target) return target[key];
      return () => {};
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
  const env = {
    ctx: context,
    W: 400,
    H: 700,
    setScore(value) { events.scores.push(value); },
    over(value) { events.over.push(value); },
    beep() {},
    sprite() { events.sprites++; return false; },
  };
  return {
    game,
    instance: game.create(env),
    events,
    runFrames(count, start = 0, step = 33) {
      let now = start;
      for (let index = 0; index < count; index++) {
        const callbacks = [...frames.values()];
        frames.clear();
        now += step;
        callbacks.forEach(callback => callback(now));
      }
    },
  };
}

const compiled = new Map();
for (const name of examples) {
  const input = fs.readFileSync(path.join(root, 'examples', name), 'utf8');
  const result = compilePlayFeedLanguage(input);
  compiled.set(name, result);
  const bytes = Buffer.byteLength(result.source);
  assert.ok(bytes < 150_000, `${name} exceeds publish limit: ${bytes}`);
  new Function(result.source);
  const program = parse(result.source, { ecmaVersion: 'latest', sourceType: 'script' });
  const game = registration(program);
  assert.ok(game, `${name} has no registration`);
  const create = property(game, 'create')?.value;
  const instance = findReturnedGameInstance(create);
  for (const method of ['start', 'stop', 'input']) {
    assert.ok(hasGameInstanceMethod(create, instance, method), `${name} is missing ${method}()`);
  }
  assert.match(result.source, /env\.setScore\s*\(/);
  assert.match(result.source, /env\.over\s*\(/);
  assert.match(result.source, /env\.sprite\s*\(/);
  assert.match(result.source, /['"]cancel['"]/);
  assert.deepEqual(
    await serverValidator.validatePublishedScript(result.source),
    [],
    `${name} must pass the production server validator`,
  );
  console.log(`${name}: ${bytes} bytes, mode=${result.spec.mode}`);
}

assert.throws(
  () => compilePlayFeedLanguage('playfeed 1\n{"mode":"unknown"}'),
  /mode/,
  'unknown modes must fail before compilation',
);
assert.throws(
  () => compilePlayFeedLanguage('playfeed 1\n{"mode":"flow","meta":{},"remix":[]}'),
  /meta\.id|remix/,
  'missing required metadata and reskin data must fail',
);
assert.throws(
  () => compilePlayFeedLanguage('playfeed 1\n{not json}'),
  /JSON/,
  'malformed JSON must produce a language error',
);

{
  const harness = createHarness(compiled.get('answer-book.pfl').source);
  harness.instance.start();
  harness.instance.input('down', 200, 400);
  harness.instance.input('up', 200, 400);
  harness.runFrames(2);
  assert.equal(harness.events.over.length, 0, 'a short hold must not reveal or finish the answer');
  harness.instance.input('down', 200, 400);
  harness.runFrames(80);
  harness.instance.input('up', 200, 400);
  harness.runFrames(1);
  harness.instance.input('down', 100, 600);
  harness.instance.input('up', 100, 600);
  assert.equal(harness.events.over.length, 1, 'answer book should finish after choosing 完成');
  assert.ok(Number.isFinite(harness.events.over[0]));
}

{
  const harness = createHarness(compiled.get('coin-rain.pfl').source);
  harness.instance.start();
  harness.instance.input('down', 200, 620);
  harness.instance.input('move', 320, 620);
  harness.instance.input('up', 320, 620);
  harness.runFrames(120);
  harness.instance.input('cancel', 320, 620);
  harness.instance.stop();
  assert.ok(harness.events.scores.length >= 1);
}

{
  const harness = createHarness(compiled.get('shikaku.pfl').source);
  const center = (r, c) => [20 + (c + .5) * 72, 170 + (r + .5) * 72];
  const regions = [
    [[0, 0], [1, 1]],
    [[0, 2], [0, 4]],
    [[1, 2], [2, 4]],
    [[2, 0], [4, 1]],
    [[3, 2], [4, 4]],
  ];
  harness.instance.start();
  for (const [a, b] of regions) {
    harness.instance.input('down', ...center(...a));
    harness.instance.input('down', ...center(...b));
    harness.runFrames(1);
  }
  assert.equal(harness.events.over.length, 1, 'Shikaku should finish after covering the board');
  assert.ok(harness.events.sprites > 0, 'Shikaku should expose its reskin slot');
}

console.log('PlayFeed Language tests passed.');
