const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.NODE_REPL_NODE_MODULE_DIRS+'/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const gameRequests=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jlpQAAAAASUVORK5CYII=','base64');
 const games=[{id:'one',title:'One',url:'https://game.example/one',cover:'https://covers.example/broken.png'},{id:'two',title:'Two',url:'https://game.example/two'}];
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='game.example'){gameRequests.push(url.href);return route.fulfill({body:'Unexpected game load'})}
  if(url.hostname==='covers.example')return route.fulfill({status:404,body:''});
  if(url.hostname==='image.thum.io'||url.pathname.startsWith('/share-cards/'))return route.fulfill({contentType:'image/png',body:pixel});
  if(url.pathname==='/auth.js')return route.fulfill({contentType:'text/javascript',body:"window.PlayFeedAuth={user:{id:'member',email:'test@example.com'},onChange(fn){fn(this.user)},api:async()=>({profile:{display_name:'Name',bio:'',website:''},actions:[{kind:'save',game_key:'https://game.example/one'},{kind:'save',game_key:'https://game.example/two'}],requests:[],notifications:[],recommendations:[{id:'recommendation-id',title:'Two',url:'https://game.example/two'}],isAdmin:false})}"});
  if(url.pathname==='/catalog.js')return route.fulfill({contentType:'text/javascript',body:'async function loadPlayfeedGames(){return '+JSON.stringify(games)+'}'});
  if(url.pathname==='/recommendations.js')return route.fulfill({body:''});
  return route.fulfill({contentType:'text/html; charset=utf-8',body:fs.readFileSync(path.join(__dirname,'..','account.html'),'utf8')});
 });
 await page.goto('https://playfeed.test/account.html');
 await page.waitForFunction(()=>document.querySelectorAll('.tile img').length===2&&[...document.querySelectorAll('.tile img')].every(img=>img.complete&&img.naturalWidth>0));
 assert.deepEqual(await page.locator('[data-tab]').allTextContents(),['儲存','我推薦的']);
 assert.equal(await page.locator('iframe').count(),0);
 assert.ok((await page.locator('.tile img').first().getAttribute('src')).startsWith('https://image.thum.io/get/noanimate/'));
 assert.equal(await page.locator('.tile img').first().getAttribute('loading'),'lazy');
 await page.locator('[data-tab=recommended]').click();
 assert.equal(await page.locator('.tile').count(),1);
 assert.equal(await page.locator('.tile').getAttribute('href'),'/#two');
 assert.equal(await page.locator('iframe').count(),0);
 assert.deepEqual(gameRequests,[]);assert.deepEqual(errors,[]);
 await browser.close();console.log('PASS: only saved/recommended tabs; static lazy images; broken-cover fallback; canonical game links; zero game iframe or origin requests');
})().catch(error=>{console.error(error);process.exit(1)});
