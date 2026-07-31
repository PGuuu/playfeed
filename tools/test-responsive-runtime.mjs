import assert from 'node:assert/strict';
import fs from 'node:fs';

const creator = fs.readFileSync(new URL('../creator.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const spec = fs.readFileSync(new URL('../creator-spec.js', import.meta.url), 'utf8');
const creatorStyles = fs.readFileSync(new URL('../creator.css', import.meta.url), 'utf8');
const importedSpec = await import('../creator-spec.js');

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
assert(importedSpec.FULL_SPEC.includes('Math.min(env.W, env.H)') &&
  importedSpec.FULL_SPEC_EN.includes('Math.min(env.W, env.H)'),
  'creator guidance module must load completely instead of ending at inline code');
assert(!creatorStyles.includes('.creator-playtest-frame, .creator-playtest-frame iframe,'),
  'creator playtest iframe must not inherit height:auto from the play-area rule');
assert(/\.creator-playtest-frame iframe\s*\{[^}]*height:\s*100%/s.test(creatorStyles),
  'creator playtest iframe must explicitly fill the playtest frame');
assert(index.includes('beep, setScore: () => {}'),
  'built-in feed previews must receive the game sound API');
assert(index.includes("window.addEventListener('pointerdown', unlockFeedAudio"),
  'feed audio must unlock after the first user gesture');
assert(creator.includes("m.type==='audio-on'") &&
  creator.includes("m.type==='audio-off'") &&
  creator.includes("runtime.send('audio-on')"),
  'sandbox previews must enable sound only after the host unlocks audio');
assert(importedSpec.FULL_SPEC.includes('最後只輸出一個完整 JavaScript 程式碼區塊') &&
  importedSpec.FULL_SPEC_EN.includes('Finally, output exactly one complete JavaScript code block'),
  'both creator specifications must remain intact through their final instruction');

console.log('responsive runtime regression tests passed');
