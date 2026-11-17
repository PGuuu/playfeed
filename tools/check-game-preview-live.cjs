const assert=require('node:assert/strict'),path=require('path');
const {chromium}=require('../../.vanilla-test/node_modules/playwright');
const origin='https://playfeed-gilt.vercel.app',id='fbe586c6-91f2-43ef-95c7-eac861d44335';
(async()=>{
 const pageResponse=await fetch(origin+'/g/'+id),html=await pageResponse.text();
 assert.equal(pageResponse.status,200);assert.match(html,/og:image" content="https:\/\/playfeed-gilt.vercel.app\/share-cards\/screenshots\/carpet-20261117.png"/);
 const og=await fetch(origin+'/api/og?id='+id,{redirect:'manual'});assert.equal(og.status,302);assert.equal(og.headers.get('location'),origin+'/share-cards/screenshots/carpet-20261117.png');
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let release;const hold=new Promise(r=>release=r);
  await page.route('https://asobi-lounge.com/carpet',async route=>{await hold;await route.fulfill({contentType:'text/html',body:'<body>Loaded game fixture</body>'}).catch(()=>{});});
  await page.goto(origin+'/g/'+id,{waitUntil:'domcontentloaded'});
  const image=page.locator('article:not([hidden]) .loading-preview-image');await image.waitFor();
  assert.equal(await image.getAttribute('src'),'/share-cards/screenshots/carpet-20261117.png');
  await page.waitForFunction(()=>document.querySelector('article:not([hidden]) .loading-preview-image')?.naturalWidth===880);
  assert.equal(await page.locator('article:not([hidden]) .game-loading').isVisible(),true);
  await page.screenshot({path:path.join(__dirname,'../../carpet-loading-live.png')});
  release();await page.locator('article:not([hidden]) .game-loading').waitFor({state:'hidden'});
  await page.locator('article:not([hidden]) .comments-button').click();
  assert.equal(await page.locator('.owner-screenshot').isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('PASS production: supplied image in OG tags and image endpoint; mobile loading shows exact image, disappears after load, screenshot tools hidden from guests.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
