import assert from 'node:assert/strict';
import validator from '../api/_validate.js';

const { validatePublishedScript } = validator;

function script(createBody) {
  return `window.GAMES = (window.GAMES || []).concat([{
    apiVersion: 1,
    id: 'validator-test',
    title: 'Validator test',
    description: 'Regression test',
    tip: 'Tap',
    bg: '#123456',
    tags: ['test'],
    controls: ['tap'],
    duration: 30,
    score: { label: 'Score', order: 'higher' },
    remixSlots: [],
    create(env) {
      ${createBody}
    }
  }]);`;
}

const helperObjectAndShorthand = script(`
  function randomEmptyCell() {
    const x = 1;
    const y = 2;
    return { x, y };
  }
  function start() {
    randomEmptyCell();
    env.setScore(0);
  }
  function stop() {}
  function input(type) {
    if (type === 'cancel') return;
    env.over(1);
  }
  return { start, stop, input };
`);

assert.deepEqual(
  await validatePublishedScript(helperObjectAndShorthand),
  [],
  'nested helper object returns and shorthand lifecycle methods must be accepted',
);

const returnedIdentifier = script(`
  function start() { env.setScore(0); }
  function stop() {}
  function input(type) {
    if (type === 'cancel') return;
    env.over(1);
  }
  const instance = { start, stop, input };
  return instance;
`);

assert.deepEqual(
  await validatePublishedScript(returnedIdentifier),
  [],
  'a locally declared GameInstance object may be returned by identifier',
);

const genuinelyMissingStart = script(`
  function helper() {
    return { start() {} };
  }
  function stop() {}
  function input(type) {
    helper();
    if (type === 'cancel') return;
    env.setScore(0);
    env.over(1);
  }
  return { stop, input };
`);

const missingErrors = await validatePublishedScript(genuinelyMissingStart);
assert.ok(
  missingErrors.includes('GameInstance must define start().'),
  'a lifecycle method missing from the actual create() return must still fail',
);

console.log('validator regression tests passed');
