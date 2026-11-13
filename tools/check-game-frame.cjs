const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.NODE_REPL_NODE_MODULE_DIRS+'/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const root=path.join(__dirname,'..');
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='remote.game'){
   if(url.pathname==='/boot.js')return route.fulfill({contentType:'text/javascript',body:"localStorage.setItem('loaded','yes');document.body.dataset.ready='true';try{parent.document.body.dataset.breached='true'}catch{document.body.dataset.parentIsolated='true'}document.querySelector('button').onclick=()=>document.querySelector('button').textContent='Played'"});
   return route.fulfill({contentType:'text/html',body:'<button>Play</button><script type="module" src="/boot.js"></script>'});
  }
  if(url.hostname!=='playfeed.test')return route.fulfill({body:''});
  if(url.pathname==='/auth.js')return route.fulfill({contentType:'text/javascript',body:`window.PlayFeedAuth={user:{id:'test',email:'test@example.com'},checking:false,token:'',onChange(fn){fn(this.user)},requireLogin(fn){fn()},async api(url,options){if(url.includes('action=me'))return {isAdmin:true};if(options&&JSON.parse(options.body).action==='recommend')return {status:'preview',url:'https://remote.game/'};return {saved:false,saveCount:0,commentCount:0,shareCount:0}}}`});
  if(url.pathname==='/catalog.js')return route.fulfill({contentType:'text/javascript',body:"async function loadPlayfeedGames(){return [{id:'reviewed',title:'Reviewed',author:'Author',url:'https://remote.game/',external:true,recommended:true},{id:'legacy',title:'Legacy',author:'Author',url:'https://remote.game/',external:true}]}"});
  if(url.pathname==='/feed-order.js')return route.fulfill({contentType:'text/javascript',body:'function orderPlayfeedGames(games){return games}'});
  if(url.pathname==='/recommendations.js')return route.fulfill({body:''});
  if(url.pathname==='/api/analytics')return route.fulfill({contentType:'application/json',body:'{"ok":true}'});
  if(url.pathname==='/internal.html')return route.fulfill({contentType:'text/html',body:"<body><script>try{parent.document.body.dataset.breached='true';document.body.textContent='Unsafe'}catch{document.body.textContent='Isolated'}</script></body>"});
  const name=url.pathname==='/'?'index.html':url.pathname.slice(1),file=path.join(root,name);
  return route.fulfill({body:fs.existsSync(file)?fs.readFileSync(file):'',contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'});
 });
 await page.goto('https://playfeed.test/submit.html');await page.waitForFunction(()=>document.querySelector('#recommend button').textContent==='預覽試玩');await page.locator('#recommend input').fill('https://remote.game/');await page.locator('#recommend button').click();
 const preview=page.locator('#player iframe');await page.frameLocator('#player iframe').locator('body[data-ready=true]').waitFor();const previewPolicy=await preview.getAttribute('sandbox');
 assert.equal(await page.frameLocator('#player iframe').locator('body').getAttribute('data-parent-isolated'),'true');await page.frameLocator('#player iframe').locator('button').click();assert.equal(await page.frameLocator('#player iframe').locator('button').textContent(),'Played');
 await page.goto('https://playfeed.test/');let frame=page.locator('article:not([hidden]) iframe');const game=page.frameLocator('article:not([hidden]) iframe');
 await game.locator('body[data-ready=true]').waitFor();assert.equal(await frame.getAttribute('sandbox'),previewPolicy);assert.equal(await frame.getAttribute('referrerpolicy'),'no-referrer');assert.equal(await game.locator('body').evaluate(()=>localStorage.getItem('loaded')),'yes');assert.equal(await game.locator('body').getAttribute('data-parent-isolated'),'true');await game.locator('button').click();assert.equal(await game.locator('button').textContent(),'Played');
 await page.locator('#next-game').click();await game.locator('body[data-ready=true]').waitFor();assert.equal(await frame.getAttribute('sandbox'),previewPolicy,'review status must not change game capabilities');
 const unsafe=await page.evaluate(()=>{const frame=document.createElement('iframe');try{PlayFeedFrame.configure(frame,'javascript:alert(1)');return true}catch{return false}});assert.equal(unsafe,false);
 await page.evaluate(()=>{const frame=document.createElement('iframe');frame.id='isolation-test';frame.src=PlayFeedFrame.configure(frame,'/internal.html');document.body.append(frame)});
 await page.frameLocator('#isolation-test').locator('body').filter({hasText:'Isolated'}).waitFor();assert.equal(await page.locator('#isolation-test').getAttribute('sandbox'),'allow-scripts');assert.equal(await page.locator('body').getAttribute('data-breached'),null);assert.deepEqual(errors,[]);
 console.log('PASS actual preview/feed parity, reviewed/legacy remote module loading without CORS headers, game storage, gameplay click, cross-origin parent isolation, same-origin sandbox isolation and invalid URL rejection');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
