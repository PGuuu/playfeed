const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.NODE_REPL_NODE_MODULE_DIRS + '/playwright');

(async () => {
 const browser = await chromium.launch({headless:true, executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {
  const context = await browser.newContext();
  const configure = fs.readFileSync(path.join(__dirname, '../game-frame.js'), 'utf8');
  await context.route('**/*', route => {
   const url = new URL(route.request().url());
   if (url.hostname === 'shop.test') return route.fulfill({contentType:'text/html', body:`<form action="/done"><button>Checkout</button></form><script>localStorage.setItem('shop','works')</script>`});
   if (url.pathname === '/game') return route.fulfill({contentType:'text/html', body:`
    <a href="https://shop.test/anchor" target="_blank" rel="noopener">Shop link</a>
    <button onclick="window.open('https://shop.test/script','_blank','noopener')">Shop button</button>
    <a href="https://shop.test/top" target="_top">Shop top</a>
    <script>try{parent.document.body.dataset.breached='yes'}catch{document.body.dataset.isolated='yes'}
    try{top.location.href='https://shop.test/automatic'}catch{document.body.dataset.redirectBlocked='yes'}</script>`});
   return route.fulfill({contentType:'text/html', body:`<body><script>${configure}</script></body>`});
  });
  for (const source of ['https://remote.test/game', 'https://platform.test/game']) {
   const page = await context.newPage();
   await page.goto('https://platform.test/');
   await page.evaluate(source => {
    const frame = document.createElement('iframe');
    frame.src = PlayFeedFrame.configure(frame, source);
    document.body.append(frame);
   }, source);
   const game = page.frameLocator('iframe');
   await game.locator('body[data-isolated="yes"][data-redirect-blocked="yes"]').waitFor();
   assert.equal(page.url(), 'https://platform.test/');
   assert.equal(await page.locator('body').getAttribute('data-breached'), null);
   for (const label of ['Shop link', 'Shop button']) {
    const opened = context.waitForEvent('page');
    await game.getByText(label, {exact:true}).click();
    const shop = await opened;
    await shop.waitForURL('https://shop.test/**');
    await shop.waitForLoadState('domcontentloaded');
    assert.equal(await shop.evaluate(() => localStorage.getItem('shop')), 'works');
    assert.equal(await shop.evaluate(() => window.opener), null);
    await shop.getByText('Checkout', {exact:true}).click();
    await shop.waitForURL('https://shop.test/done*');
    await shop.close();
   }
   await game.getByText('Shop top', {exact:true}).click();
   await page.waitForURL('https://shop.test/top');
   await page.close();
  }
  console.log('PASS remote/internal game links and window.open, shop storage/forms, opener isolation, user-activated top navigation, blocked automatic redirect and parent DOM isolation');
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
