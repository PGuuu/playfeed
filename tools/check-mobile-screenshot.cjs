const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('../../.vanilla-test/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  for(const device of ['iphone','android','ipad']){
   const page=await browser.newPage({viewport:{width:390,height:844}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://playfeed.test/**',route=>route.fulfill({contentType:'text/html',body:'<meta charset="utf-8"><button id="open">截圖</button><iframe></iframe>'}));
   await page.goto('https://playfeed.test/');
   await page.evaluate(device=>{
    Object.defineProperty(navigator,'userAgentData',{configurable:true,value:{mobile:device==='android'}});
    Object.defineProperty(navigator,'userAgent',{configurable:true,value:device==='iphone'?'Mozilla/5.0 (iPhone)':device==='android'?'Mozilla/5.0 (Linux; Android 16)':'Mozilla/5.0 (Macintosh)'});
    Object.defineProperty(navigator,'platform',{configurable:true,value:device==='ipad'?'MacIntel':'test'});
    Object.defineProperty(navigator,'maxTouchPoints',{configurable:true,value:5});
    window.captureCalls=0;
    navigator.mediaDevices.getDisplayMedia=async()=>{window.captureCalls++;throw Error('Unexpected screen sharing');};
   },device);
   await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../game-preview-crop.js'),'utf8')});
   await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../game-screenshot.js'),'utf8')});
   await page.evaluate(()=>document.querySelector('#open').onclick=()=>PlayFeedScreenshot.open({frame:document.querySelector('iframe'),title:'漆黑清洗店',onSave:async (image,focus)=>{window.savedImage=image;window.savedFocus=focus}}));
   const chooserPromise=page.waitForEvent('filechooser',{timeout:8000});chooserPromise.catch(()=>{});await page.locator('#open').click({timeout:5000});
   const chooser=await chooserPromise;assert.equal(await page.evaluate(()=>window.captureCalls),0);
   assert.equal(await page.locator('[data-capture]').isVisible(),false);
   await chooser.setFiles(path.join(__dirname,'../share-cards/screenshots/carpet-20261117.png'));
   await page.waitForFunction(()=>!document.querySelector('[data-save]').disabled);
   assert.equal(await page.locator('.share-card canvas').isVisible(),true);
   if(device==='iphone')await page.screenshot({path:path.join(__dirname,'../../share-focus-mobile-preview.png')});
   const before=await page.locator('canvas').evaluate(c=>c.toDataURL());
   await page.locator('[data-y]').press('Home');await page.locator('[data-zoom]').press('End');
   assert.notEqual(await page.locator('canvas').evaluate(c=>c.toDataURL()),before);
   await page.getByText('查看完整預載入圖').click();assert.equal(await page.locator('.screenshot-dialog img').isVisible(),true);
   await page.getByRole('button',{name:'使用這張截圖'}).click();
   assert.match(await page.evaluate(()=>window.savedImage),/^data:image\/jpeg;base64,/);
   assert.deepEqual(await page.evaluate(()=>window.savedFocus),{x:.5,y:0,zoom:3});
   assert.equal(await page.locator('.screenshot-dialog').count(),0);assert.deepEqual(errors,[]);
   console.log('PASS '+device+': photo chooser opens, no screen sharing, selected image previews and saves.');await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
