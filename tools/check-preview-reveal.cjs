const assert=require('node:assert/strict'),path=require('path');
const {chromium}=require('../../.vanilla-test/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage();
  await page.setContent('<div id="stage"></div><div id="indicator"><strong class="loading-title"></strong><span class="loading-note"></span><small class="loading-help"></small></div><iframe></iframe>');
  await page.addScriptTag({path:path.join(__dirname,'../game-loading.js')});
  async function start(image){await page.evaluate(image=>{
   window.stopLoading?.();const frame=window.testFrame=new EventTarget();frame.getAttribute=()=>'/game';
   window.stopLoading=PlayFeedLoading.start({indicator:document.querySelector('#indicator'),stage:document.querySelector('#stage'),frame,image:image?'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>':undefined});
  },image);}
  await start(true);await page.waitForFunction(()=>document.querySelector('img')?.naturalWidth===100);
  const began=Date.now();await page.evaluate(()=>window.testFrame.dispatchEvent(new Event('load')));
  await page.waitForTimeout(200);assert.equal(await page.locator('#indicator').isVisible(),true);
  await page.waitForFunction(()=>document.querySelector('#indicator').hidden);assert.ok(Date.now()-began>=600);
  await start(true);await page.waitForFunction(()=>document.querySelector('img')?.naturalWidth===100);await page.evaluate(()=>window.stopLoading());
  assert.equal(await page.locator('#indicator').isVisible(),false);await page.waitForTimeout(550);assert.equal(await page.locator('#indicator').isVisible(),false);
  await start(false);await page.waitForTimeout(1050);assert.equal(await page.locator('#indicator').isVisible(),true);
  await page.evaluate(()=>window.testFrame.dispatchEvent(new Event('load')));assert.equal(await page.locator('#indicator').isVisible(),false);
  console.log('PASS: screenshot stays at least 0.5 seconds then fades; switching cancels reveal; games without screenshots keep original loading behavior.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
