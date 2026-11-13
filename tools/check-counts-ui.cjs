const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.NODE_REPL_NODE_MODULE_DIRS+'/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 let saveCount=9,commentCount=5,saved=false;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  const json=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  if(url.pathname==='/api/account'){
   const body=req.method()==='POST'?req.postDataJSON():{};
   if(body.action==='save'){saved=body.active;saveCount=saved?10:9}
   if(body.action==='comment')commentCount++;
   if(url.searchParams.get('action')==='comments')return json({comments:[],commentCount,saveCount,displaySaveCount:saveCount+6});
   return json({saved,commentCount,saveCount,displaySaveCount:saveCount+6});
  }
  if(url.pathname==='/auth.js')return route.fulfill({contentType:'text/javascript',body:"window.PlayFeedAuth={user:{id:'member',email:'test@example.com'},onChange(fn){fn(this.user)},requireLogin(fn){fn()},api:async(path,options)=>{const response=await fetch(path,options);return response.json()}}"});
  if(url.pathname==='/catalog.js')return route.fulfill({contentType:'text/javascript',body:"async function loadPlayfeedGames(){return [{id:'one',title:'One',author:'Author',url:'https://game.example/',external:true}]}"});
  if(url.pathname==='/feed-order.js')return route.fulfill({contentType:'text/javascript',body:'function orderPlayfeedGames(games){return games}'});
  if(url.pathname==='/feed-layout.css')return route.fulfill({contentType:'text/css',body:fs.readFileSync(path.join(__dirname,'..','feed-layout.css'),'utf8')});
  if(url.pathname==='/saves.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'..','saves.js'),'utf8')});
  if(url.pathname==='/game-frame.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'..','game-frame.js'),'utf8')});
  if(['/recommendations.js','/analytics.js'].includes(url.pathname))return route.fulfill({body:''});
  if(url.hostname==='game.example')return route.fulfill({contentType:'text/html',body:'Game'});
  return route.fulfill({contentType:'text/html; charset=utf-8',body:fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8')});
 });
 await page.goto('https://playfeed.test/');
 const card=page.locator('article:not([hidden])'),save=card.locator('[data-kind=saved]');
 await card.locator('[data-count=comments]').filter({hasText:'5'}).waitFor();
 assert.equal(await card.locator('[data-count=saves]').textContent(),'15');

 await save.click();await save.locator('.action-count').filter({hasText:'16'}).waitFor();
 assert.equal(await save.locator('.action-label').textContent(),'save');
 await save.click();await save.locator('.action-count').filter({hasText:'15'}).waitFor();
 assert.equal(await save.locator('.action-label').textContent(),'save');
 await card.locator('.comments-button').click();
 await page.locator('.comments-form input').fill('Test comment');
 await page.locator('.comments-form button').click();
 await card.locator('[data-count=comments]').filter({hasText:'6'}).waitFor({state:'attached'});
 assert.ok((await card.locator('.comments-button').getAttribute('aria-label')).includes('6'));
 assert.deepEqual(errors,[]);await browser.close();
 console.log('PASS: visible badges; save/unsave count updates; comment count updates; accessible total labels; no browser errors');
})().catch(error=>{console.error(error);process.exit(1)});
