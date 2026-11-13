const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.NODE_REPL_NODE_MODULE_DIRS+'/playwright');
const games=['one','two','three','four'].map(id=>({id,title:id[0].toUpperCase()+id.slice(1),author:'Author',url:'https://game.test/'+id,external:true}));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 for(const member of [false,true]){
  const context=await browser.newContext({viewport:{width:390,height:740}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let reverseCatalog=false;
  const keys=games.filter(g=>g.id!=='two').map(g=>g.url),members=new Set(member?keys:[]),guests=new Set(member?[]:keys);
  if(!member)await context.addInitScript(({games,keys})=>{if(!localStorage.getItem('fixture:seeded')){const entries={};for(const g of games)if(keys.includes(g.url))entries[g.url]={...g,savedAt:g.id};localStorage.setItem('playfeed:guest-saves:v1',JSON.stringify({entries,pending:{}}));localStorage.setItem('fixture:seeded','1')}},{games,keys});
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());let body={};try{if(request.method()==='POST')body=request.postDataJSON()||{}}catch{}
   const json=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
   if(url.pathname==='/api/analytics')return json({ok:true});
   if(url.pathname==='/api/account'){
    if(url.searchParams.get('action')==='collection')return json({profile:{display_name:'Member',bio:'',website:''},actions:[...members].map(game_key=>({kind:'save',game_key})),requests:[],recommendations:[],notifications:[],isAdmin:false});
    if(body.action==='save'){if(body.active)members.add(body.gameKey);else members.delete(body.gameKey)}
    if(body.action==='guest-save'){for(const c of body.changes){if(c.active)guests.add(c.gameKey);else guests.delete(c.gameKey)}return json({ok:true})}
    if(body.action==='merge-saves'){for(const key of body.gameKeys)members.add(key);guests.clear();return json({ok:true})}
    const key=body.gameKey||url.searchParams.get('gameKey');return json({saveCount:Number(members.has(key))+Number(guests.has(key)),commentCount:0,shareCount:0,guestSaved:guests.has(key),saved:members.has(key)});
   }
   if(url.hostname==='game.test')return route.fulfill({contentType:'text/html',body:'<body style="margin:0;background:#e7bd91;font:30px system-ui;padding:20px">'+url.pathname.slice(1)+'</body>'});
   if(url.pathname==='/auth.js')return route.fulfill({contentType:'text/javascript',body:`window.PlayFeedAuth={user:${member?JSON.stringify({id:'member',email:'member@example.com'}):'null'},checking:false,token:'',onChange(fn){fn(this.user)},takeCollection(){return null},async api(url,options){const r=await fetch(url,options);if(!r.ok)throw Error('API');return r.json()},openLogin(){document.querySelector('#login-dialog')?.showModal()}}`});
   if(url.pathname==='/catalog.js')return route.fulfill({contentType:'text/javascript',body:'async function loadPlayfeedGames(){return '+JSON.stringify(reverseCatalog?[...games].reverse():games)+'}'});
   if(url.pathname==='/feed-order.js')return route.fulfill({contentType:'text/javascript',body:'function orderPlayfeedGames(games){return [...games].reverse()}'});
   if(url.pathname==='/recommendations.js'||url.pathname==='/analytics-owner-link.js')return route.fulfill({body:''});
   if(url.hostname!=='playfeed.test')return route.fulfill({body:''});
   const name=url.pathname==='/'||url.pathname.startsWith('/g/')?'index.html':url.pathname.slice(1),file=path.join(__dirname,'..',name);
   if(!fs.existsSync(file))return route.fulfill({body:''});
   return route.fulfill({body:fs.readFileSync(file),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'});
  });
  const card=page.locator('article:not([hidden])'),title=card.locator('.game-title'),label=page.locator('.saved-list-label');
  const active=async text=>{await page.waitForFunction(expected=>document.querySelector('article:not([hidden]) .game-title')?.textContent===expected,text)};
  await page.goto('https://playfeed.test/account.html');await page.locator('.grid .tile').filter({hasText:'Three'}).waitFor();assert.equal(await page.locator('.grid .tile').count(),3);
  const selected=page.locator('.grid .tile').filter({hasText:'Three'});assert((await selected.getAttribute('href')).includes('?list=saved'));reverseCatalog=true;await selected.click();await active('Three');assert.equal(await label.innerText(),'儲存清單（2/3）');
  await page.locator('#next-game').click();await active('Four');assert(!await page.locator('#next-game').isDisabled());await page.locator('#next-game').click();await active('One');assert.equal(await label.innerText(),'儲存清單（1/3）');await page.locator('#previous-game').click();await active('Four');
  await page.locator('#previous-game').click();await active('Three');await page.locator('#previous-game').click();await active('One');assert(!await page.locator('#previous-game').isDisabled());await page.locator('#previous-game').click();await active('Four');await page.locator('#next-game').click();await active('One');
  await page.locator('#next-game').click();await active('Three');await page.reload();await active('Three');assert(page.url().includes('list=saved'));
  await page.locator('.search-button').click();await page.locator('#game-search').fill('Two');assert.equal(await page.locator('.search-results a').count(),0);await page.getByRole('button',{name:'關閉搜尋'}).click();
  await card.locator('.reaction').click();await active('Four');assert.equal(await label.innerText(),'儲存清單（2/2）');
  for(const size of [{width:320,height:568},{width:844,height:390},{width:390,height:740}]){await page.setViewportSize(size);await page.waitForTimeout(150);const r=await label.boundingBox();assert(r&&r.x>=0&&r.x+r.width<=size.width);assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))}
  await page.screenshot({path:path.join(__dirname,'../../.vanilla-test/saved-feed-'+(member?'member':'guest')+'.png')});
  await card.locator('.reaction').click();await active('One');assert.equal(await label.innerText(),'儲存清單（1/1）');assert(!await page.locator('#previous-game').isDisabled());assert(!await page.locator('#next-game').isDisabled());await page.locator('#next-game').click();await active('One');
  await card.locator('.reaction').click();await page.locator('.collection-empty').waitFor();assert.equal(await label.innerText(),'儲存清單（0/0）');assert.equal(await page.locator('article:not([hidden]) iframe').count(),0);
  await page.reload();await page.locator('.collection-empty').waitFor();assert.equal(await page.locator('article:not([hidden]) iframe').count(),0);
  reverseCatalog=false;await page.locator('.feed-logo').click();await active('Four');await page.locator('#previous-game').click();await active('One');await page.locator('#next-game').click();await active('Four');assert.equal(await label.isVisible(),false);assert.equal(new URL(page.url()).searchParams.has('list'),false);
  await page.locator('.search-button').click();await page.locator('#game-search').fill('Two');await page.locator('.search-results a').filter({hasText:'Two'}).waitFor();await page.getByRole('button',{name:'關閉搜尋'}).click();
  await page.goto('https://playfeed.test/g/two?list=saved');await page.locator('.collection-empty').waitFor();assert.equal(await page.locator('article:not([hidden]) iframe').count(),0);
  assert.deepEqual(errors,[]);console.log('PASS '+(member?'member':'guest')+': selected saved game, saved-only order, cyclic navigation and position/total, reload, filtered search, remove-current advance, live total, empty list, responsive heading, logo exit and fresh homepage');await context.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
