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
  else if(url.pathname==='/feed-order.js')body='function orderPlayfeedGames(games){return games}';
  else if(url.pathname==='/recommendations.js')body='';
  else {const name=url.pathname==='/'?'index.html':url.pathname.slice(1);const file=path.join(__dirname,'..',name);if(fs.existsSync(file)){body=fs.readFileSync(file);contentType=name.endsWith('.css')?'text/css':'text/html'}else body=''}
  return route.fulfill({body,contentType});
 });
 await page.goto('https://playfeed.test/');
 await page.waitForSelector('article:not([hidden]) iframe');

 const frame=page.locator('article:not([hidden]) iframe');
 const original=await frame.elementHandle();
 for(const size of [{width:844,height:390},{width:667,height:375},{width:568,height:320},{width:390,height:844}]){
  await page.setViewportSize(size);
  await page.waitForTimeout(300);
  const result=await page.evaluate(()=>{
   const article=document.querySelector('article:not([hidden])');
   const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
   const iframe=article.querySelector('iframe');
   return {footer:rect(article.querySelector('footer')),stage:rect(article.querySelector('.stage')),rail:rect(document.querySelector('.feed-rail')),frame:rect(iframe),overflow:document.documentElement.scrollWidth>innerWidth};
  });
  Object.assign(result,await (await frame.elementHandle()).contentFrame().then(f=>f.evaluate(()=>({innerWidth,innerHeight}))));
  assert(!result.overflow);
  if(size.width>size.height){
   assert(result.rail.right<=result.stage.x);
   assert(result.stage.right<=result.footer.x);
   assert(result.innerWidth>result.innerHeight);
   assert(result.frame.width>result.frame.height);
  }else{
   assert(result.footer.y>=result.stage.bottom);
   assert(result.innerWidth<result.innerHeight);
  }
  assert(result.rail.bottom<=size.height+1);
  const ui=await page.evaluate(()=>{
   const card=document.querySelector('article:not([hidden])');const rect=s=>{const r=card.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};
   return {save:rect('.reaction'),comment:rect('.comments-button'),share:rect('.share'),nav:rect('.game-switcher'),prev:rect('#previous-game'),next:rect('#next-game'),text:card.querySelector('.reaction .action-label').textContent};
  });
  assert.equal(ui.text,'save');
  if(size.width>size.height){assert(ui.share.y<ui.save.y);assert(ui.save.y<ui.nav.y);assert(ui.prev.y<ui.next.y)}
  else{assert(ui.comment.x<ui.share.x);assert(ui.share.x<ui.save.x);assert(ui.save.x<ui.nav.x);assert(ui.prev.x<ui.next.x);assert(Math.abs(ui.save.x+ui.save.w/2-(result.stage.x+result.stage.width/2))<8)}
  assert(await original.evaluate(el=>el.isConnected),'rotation must preserve the running game');
  console.log('PASS',size,result.innerWidth,result.innerHeight);
 }
 await page.evaluate(()=>{window.switchAnimations=[];const original=Element.prototype.animate;Element.prototype.animate=function(frames,options){if(this.classList.contains('game-viewport'))window.switchAnimations.push(frames[0].transform);return original.call(this,frames,options)}});
 await page.locator('#next-game').click();
 await page.waitForTimeout(300);
 assert.equal(await page.locator('article:not([hidden]) .game-title').textContent(),'Two');
 await page.locator('#previous-game').click();
 await page.waitForTimeout(300);
 assert.equal(await page.locator('article:not([hidden]) .game-title').textContent(),'One');
 assert.deepEqual(await page.evaluate(()=>window.switchAnimations),['translateX(100%)','translateX(-100%)']);
 await page.locator('article:not([hidden]) .comments-button').click();
 assert.equal(await page.locator('#comments-sheet').isVisible(),true);
 assert.deepEqual(errors,[]);
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
