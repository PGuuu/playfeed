import assert from 'node:assert/strict';

globalThis.window = { GAMES: [] };
let nextFrame = null;
let frameId = 0;
globalThis.requestAnimationFrame = callback => {
  nextFrame = callback;
  return ++frameId;
};
globalThis.cancelAnimationFrame = () => {
  nextFrame = null;
};
await import('../games/pack9.js');
const definition = window.GAMES.find(game => game.id === 'sky-drop-3d');
assert(definition, 'sky-drop-3d should be registered');

function fakeGL() {
  const noop = () => {};
  const object = () => ({});
  return {
    canvas: { width: 400, height: 700 },
    ARRAY_BUFFER: 1, BLEND: 2, COLOR_BUFFER_BIT: 4, COMPILE_STATUS: 5,
    DEPTH_BUFFER_BIT: 8, DEPTH_TEST: 9, DYNAMIC_DRAW: 10, FLOAT: 11,
    FRAGMENT_SHADER: 12, LEQUAL: 13, LINK_STATUS: 14,
    ONE_MINUS_SRC_ALPHA: 15, SRC_ALPHA: 16, STATIC_DRAW: 17,
    TEXTURE0: 18, TEXTURE_2D: 19, TRIANGLES: 20, VERTEX_SHADER: 21,
    activeTexture: noop, attachShader: noop, bindBuffer: noop, bindTexture: noop,
    blendFunc: noop, bufferData: noop, clear: noop, clearColor: noop,
    compileShader: noop, createBuffer: object, createProgram: object,
    createShader: object, depthFunc: noop, disable: noop, drawArrays: noop,
    enable: noop, enableVertexAttribArray: noop, getAttribLocation: () => 0,
    getProgramInfoLog: () => '', getProgramParameter: () => true,
    getShaderInfoLog: () => '', getShaderParameter: () => true,
    getUniformLocation: object, linkProgram: noop, shaderSource: noop,
    uniform1i: noop, uniform4fv: noop, uniformMatrix4fv: noop,
    useProgram: noop, vertexAttribPointer: noop, viewport: noop
  };
}

function simulate(verticalGesture) {
  nextFrame = null;
  let score = null;
  let elapsed = 0;
  const origin = performance.now();
  const env = {
    W: 400, H: 700, gl: fakeGL(), mode: 'play',
    texture: () => null,
    setScore: () => {},
    over: value => { score = value; },
    beep: () => {}
  };
  const game = definition.create(env);
  const originalRandom = Math.random;
  Math.random = () => .5;
  game.start();
  Math.random = originalRandom;
  const advance = milliseconds => {
    const end = elapsed + milliseconds;
    while (elapsed < end && score === null) {
      elapsed += Math.min(40, end - elapsed);
      const callback = nextFrame;
      nextFrame = null;
      if (callback) callback(origin + elapsed);
    }
  };

  advance(300);
  game.input('down', 200, 350);
  advance(520);
  game.input('up', 200, 350);
  advance(300);
  if (verticalGesture === 'guided') {
    game.input('down', 200, 350);
    game.input('move', 189, 350);
  } else if (verticalGesture === 'dive') {
    game.input('down', 200, 390);
    game.input('move', 200, 210);
    game.input('up', 200, 210);
  } else if (verticalGesture === 'brake') {
    game.input('down', 200, 280);
    game.input('move', 200, 470);
    game.input('up', 200, 470);
  }
  advance(30_000);
  game.stop();
  assert.notEqual(score, null, `${verticalGesture || 'neutral'} run should finish`);
  return { elapsed, score };
}

const neutral = simulate('neutral');
const dive = simulate('dive');
const brake = simulate('brake');
const guided = simulate('guided');
assert(dive.elapsed < neutral.elapsed - 250,
  `up swipe should accelerate descent (${dive.elapsed} < ${neutral.elapsed})`);
assert(brake.elapsed > neutral.elapsed + 250,
  `down swipe should slow descent (${brake.elapsed} > ${neutral.elapsed})`);
assert(guided.score > 0, `a controlled approach should be able to reach the target (${guided.score})`);
console.log('sky-drop vertical controls passed', { neutral, dive, brake, guided });
