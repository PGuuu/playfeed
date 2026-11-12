const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.NODE_REPL_NODE_MODULE_DIRS+'/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const game={id:'one',title:'One',url:'https://game.example/one',cover:'https://covers.example/one.png'};
 const data={user:{id:'member',email:'test@example.com'},profile:{display_name:'Member',bio:'Bio',website:''},actions:[{kind:'save',game_key:game.url}],requests:[],notifications:[],recommendations:[],isAdmin:false};
 await page.addInitScript(game=>{
  localStorage.setItem('phuze_session','st_fixture');
  sessionStorage.setItem('playfeed:catalog:v1',JSON.stringify({time:Date.now(),games:[game]}));
 },game);
 let collectionCalls=0,authCalls=0;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/api/account'){
   collectionCalls++;assert.equal(route.request().headers().authorization,'Bearer st_fixture');
   await new Promise(resolve=>setTimeout(resolve,350));
   return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  }
  if(url.pathname==='/api/auth'){authCalls++;return route.fulfill({contentType:'application/json',body:JSON.stringify({user:data.user})})}
  if(url.pathname==='/auth.js')return route.fulfill({contentType:'text/javascript; charset=utf-8',body:fs.readFileSync(path.join(__dirname,'..','auth.js'),'utf8')});
  if(url.pathname==='/catalog.js')return route.fulfill({contentType:'text/javascript',body:'async function loadPlayfeedGames(){await new Promise(r=>setTimeout(r,1500));window.freshCatalogDone=true;return '+JSON.stringify([game])+'}'});
  if(url.pathname==='/recommendations.js')return route.fulfill({body:''});
  if(url.hostname==='covers.example')return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jlpQAAAAASUVORK5CYII=','base64')});
  return route.fulfill({contentType:'text/html; charset=utf-8',body:fs.readFileSync(path.join(__dirname,'..','account.html'),'utf8')});
 });
 await page.goto('https://playfeed.test/account.html');
 await page.waitForSelector('.tile');
 assert.equal(collectionCalls,1);assert.equal(authCalls,0);
 assert.equal(await page.evaluate(()=>Boolean(window.freshCatalogDone)),false);
 assert.equal(await page.locator('.identity h1').textContent(),'Member');
 assert.equal(await page.locator('iframe').count(),0);
 assert.deepEqual(errors,[]);
 await browser.close();
 console.log('PASS: one authenticated collection bootstrap; zero redundant auth/collection requests; saved tiles appear from cached public catalog before slow background refresh');
})().catch(error=>{console.error(error);process.exit(1)});
