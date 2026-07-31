import assert from 'node:assert/strict';
import fs from 'node:fs';

const creator = fs.readFileSync(new URL('../creator.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const spec = fs.readFileSync(new URL('../creator-spec.js', import.meta.url), 'utf8');

function logicalSize(pixelWidth, pixelHeight) {
  const baseWidth = 400;
  const baseHeight = 700;
  const wide = pixelWidth / pixelHeight >= baseWidth / baseHeight;
  return wide
    ? { W: baseHeight * pixelWidth / pixelHeight, H: baseHeight }
    : { W: baseWidth, H: baseWidth * pixelHeight / pixelWidth };
}

for (const [pixelWidth, pixelHeight] of [[390, 760], [430, 700], [900, 600]]) {
  const { W, H } = logicalSize(pixelWidth, pixelHeight);
  assert(W >= 400 && H >= 700, 'the legacy 400×700 safe area must remain fully visible');
  assert(Math.abs(pixelWidth / W - pixelHeight / H) < 1e-10,
    'the runtime must use one uniform scale on both axes');
}

assert(!creator.includes('ctx.setTransform(pw/400,0,0,ph/700,0,0)'),
  'sandbox runtime must not stretch 400×700 independently');
assert(!index.includes('ctx.setTransform(pixelWidth / W, 0, 0, pixelHeight / H, 0, 0)'),
  'built-in runtime must not stretch its canvas independently');
assert(creator.includes("send('ready',{W:env.W,H:env.H})"),
  'sandbox must report its logical viewport to input handling');
assert(creator.includes('(runtime?.W || 400)') &&
  creator.includes('(runtime?.H || 700)'),
  'published Script input must use the runtime viewport');
assert(!spec.includes('currently 400 × 700') && !spec.includes('目前是 400 × 700'),
  'creator guidance must not advertise a fixed canvas size');

console.log('responsive runtime regression tests passed');
