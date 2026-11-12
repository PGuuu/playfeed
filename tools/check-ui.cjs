const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.NODE_REPL_NODE_MODULE_DIRS + '/playwright');
for (const file of ['index.html','account.html','submit.html']) {
 const html=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
 for(const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
  if(!match[2].trim())continue;
  new vm.Script(match[1].includes('module')?'(async()=>{'+match[2]+'})()':match[2],{filename:file});
 }
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const catalog="async function loadPlayfeedGames(){return [{id:'one',title:'One',author:'Author',url:'https://game.test/one',external:true},{id:'two',title:'Two',author:'Author',url:'https://game.test/two',external:true}]}";
 const auth="window.PlayFeedAuth={user:{id:'user',email:'test@example.com'},onChange(fn){fn(this.user)},requireLogin(fn){fn()},api:async(path,options)=>{if(path.includes('collection'))return {profile:{display_name:'Test',bio:'Bio',website:'https://example.com'},actions:[{kind:'save',game_key:'https://game.test/one'}],requests:[],notifications:[],recommendations:[],isAdmin:false};if(path.includes('state'))return {saved:false,count:0};return {status:'pending',message:'Thanks'}}}";
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='game.test')return route.fulfill({contentType:'text/html',body:'<body style="background:orange">Game</body>'});
  if(url.hostname!=='playfeed.test')return route.fulfill({body:''});
  let body,contentType='text/javascript';
  if(url.pathname==='/auth.js')body=auth;
  else if(url.pathname==='/catalog.js')body=catalog;
  else if(url.pathname==='/recommendations.js')body='';
  else {const name=url.pathname==='/'?'index.html':url.pathname.slice(1);const file=path.join(__dirname,'..',name);if(fs.existsSync(file)){body=fs.readFileSync(file);contentType='text/html'}else body=''}
  return route.fulfill({body,contentType});
 });
 await page.goto('https://playfeed.test/');
 await page.waitForSelector('article:not([hidden]) iframe');
 assert.equal(await page.locator('.like').count(),0);
 assert.equal(await page.locator('article:not([hidden]) footer').isVisible(),true);
 await page.locator('#toggle-controls').click();
 assert.equal(await page.locator('article:not([hidden]) footer').isVisible(),false);
 await page.locator('#toggle-controls').click();
 assert.equal(await page.locator('article:not([hidden]) footer').isVisible(),true);
 assert.equal(await page.locator('#toggle-controls').getAttribute('aria-expanded'),'true');
 assert.deepEqual(await page.locator('article:not([hidden]) .actions').innerText(), '留言\n儲存\n分享\n推薦新遊戲');
 await page.locator('article:not([hidden]) iframe').click({position:{x:30,y:100}});
 await page.waitForTimeout(100);
 assert.equal(await page.locator('#toggle-controls').getAttribute('aria-expanded'),'false');
 await page.locator('#toggle-controls').click();
 await page.locator('#next-game').click();
 assert.equal(await page.locator('#toggle-controls').getAttribute('aria-expanded'),'true');
 await page.waitForTimeout(1100);
 assert.equal(await page.locator('#toggle-controls').getAttribute('aria-expanded'),'false');
 await page.locator('#toggle-controls').click();
 await page.waitForTimeout(1100);
 assert.equal(await page.locator('#toggle-controls').getAttribute('aria-expanded'),'true');
 assert.equal((await page.locator('.game-switcher').boundingBox()).width,24);
 await page.goto('https://playfeed.test/account.html');
 await page.waitForSelector('.tile iframe');
 const tile=await page.locator('.tile').boundingBox();
 assert.ok(Math.abs(tile.width/tile.height-390/700)<0.01);
 assert.equal(await page.locator('#edit-profile').isVisible(),true);
 await page.locator('#edit-profile').click();
 assert.equal(await page.locator('[name=displayName]').inputValue(),'Test');
 await page.goto('https://playfeed.test/submit.html');
 await page.locator('[name=url]').fill('https://game.test/new');
 await page.locator('button[type=submit]').click();
 assert.equal(await page.locator('#message').innerText(),'Thanks');
 assert.equal(await page.locator('iframe').count(),0);
 assert.deepEqual(errors,[]);
 await browser.close();
 console.log('PASS: inline syntax, mobile controls, iframe focus hiding, switching, portrait previews, profile form, recommendation submission');
})().catch(error=>{console.error(error);process.exit(1)});
