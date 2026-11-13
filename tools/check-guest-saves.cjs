const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.NODE_REPL_NODE_MODULE_DIRS+'/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext({viewport:{width:390,height:740}}),page=await context.newPage();
 const root=path.join(__dirname,'..'),gameKey='https://game.test/one',members=new Set(),guests=new Set(),events=[];
 let offline=false,mergeFail=false,merges=0,shares=2,inits=0;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const counts=()=>({saveCount:members.size+guests.size,displaySaveCount:6+members.size+guests.size,commentCount:0,shareCount:shares,guestSaved:guests.has(gameKey),saved:members.has(gameKey)});
 await context.addInitScript(()=>{Object.defineProperty(navigator,'share',{value:undefined,configurable:true});Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{window.copiedShare=value}},configurable:true})});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),body=req.method()==='POST'?req.postDataJSON():{};
  const json=(data,status=200)=>route.fulfill({contentType:'application/json',status,body:JSON.stringify(data)});
  if(url.pathname==='/api/analytics'){
   if(body.action==='init')inits++;
   for(const event of body.events||[]){if(!events.some(e=>e.id===event.id)){events.push(event);if(event.action==='share_success')shares++}}
   return json({ok:true});
  }
  if(url.pathname==='/api/account'){
   if(body.action==='guest-save'){if(offline)return route.abort();for(const c of body.changes){if(c.active)guests.add(c.gameKey);else guests.delete(c.gameKey)}return json({ok:true})}
   if(body.action==='merge-saves'){merges++;if(mergeFail)return json({error:'Temporary failure'},503);for(const key of body.gameKeys)members.add(key);guests.clear();return json({ok:true})}
   if(body.action==='save'){if(body.active)members.add(body.gameKey);else members.delete(body.gameKey)}
   if(url.searchParams.get('action')==='collection')return json({profile:{display_name:'Member',bio:'',website:''},actions:[...members].map(game_key=>({kind:'save',game_key})),requests:[],recommendations:[],notifications:[],isAdmin:false});
   return json(counts());
  }
  if(url.hostname==='game.test')return route.fulfill({contentType:'text/html',body:'<button onclick="this.textContent=\'Played\'">Game</button>'});
  if(url.pathname==='/auth.js')return route.fulfill({contentType:'text/javascript',body:`(()=>{const listeners=[];window.PlayFeedAuth={user:null,checking:false,token:'',takeCollection(){return null},onChange(fn){listeners.push(fn);fn(this.user)},login(){this.user={id:'member',email:'member@example.com'};listeners.forEach(fn=>fn(this.user))},logout(){this.user=null;listeners.forEach(fn=>fn(null))},openLogin(){document.querySelector('#login-dialog').showModal()},requireLogin(fn){this.user?fn():this.openLogin()},async api(url,options){const r=await fetch(url,options),data=await r.json();if(!r.ok)throw Error(data.error);return data}}})();`});
  if(url.pathname==='/catalog.js')return route.fulfill({contentType:'text/javascript',body:`async function loadPlayfeedGames(){return [{id:'sushi',title:'Sushi',author:'Author',url:'${gameKey}',external:true,viewport:{width:390,height:740}},{id:'two',title:'Two',author:'Author',url:'https://game.test/two',external:true}]}`});
  if(url.pathname==='/feed-order.js')return route.fulfill({contentType:'text/javascript',body:'function orderPlayfeedGames(games){return games}'});
  if(url.pathname==='/recommendations.js'||url.pathname==='/analytics-owner-link.js')return route.fulfill({body:''});
  if(url.hostname!=='playfeed.test')return route.fulfill({body:''});
  const name=url.pathname==='/'||url.pathname.startsWith('/g/')?'index.html':url.pathname.slice(1),file=path.join(root,name);
  if(!fs.existsSync(file))return route.fulfill({body:''});
  return route.fulfill({body:fs.readFileSync(file),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'});
 });
 await page.goto('https://playfeed.test/g/sushi');
 const card=page.locator('article:not([hidden])'),save=card.locator('.reaction'),share=card.locator('.share');
 await share.locator('.action-count').filter({hasText:'2'}).waitFor();assert((await share.getAttribute('aria-label')).includes('2 次分享'));
 await save.click();await page.waitForFunction(()=>document.querySelector('article:not([hidden]) .reaction .action-count').textContent==='7');
 assert.equal(await save.getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#login-dialog').isVisible(),false);assert(await page.locator('#save-feedback').isVisible());
 const feedback=await page.locator('#save-feedback').boundingBox(),avatar=await page.locator('.account-link').boundingBox();assert(feedback.y>=avatar.y+avatar.height&&feedback.y<avatar.y+avatar.height+30);
 assert.equal(inits,1,'saves and analytics must share one device initialization');
 await page.screenshot({path:path.join(root,'../.vanilla-test/guest-save-feedback.png')});
 await page.waitForTimeout(2300);assert.equal(await page.locator('#save-feedback').isVisible(),false);
 await page.reload();await save.waitFor();await page.waitForFunction(()=>document.querySelector('article:not([hidden]) .reaction').getAttribute('aria-pressed')==='true');
 await page.locator('.account-link').click();await page.locator('.grid .tile').waitFor();assert.equal(await page.locator('.identity h1').innerText(),'我的收藏');assert.equal(await page.locator('#login-dialog').isVisible(),false);
 await page.reload();await page.locator('.grid .tile').waitFor();
 await page.goto('https://playfeed.test/g/sushi');await save.waitFor();await page.waitForFunction(()=>document.querySelector('article:not([hidden]) .reaction').getAttribute('aria-pressed')==='true');
 await save.click();await page.waitForFunction(()=>document.querySelector('article:not([hidden]) .reaction .action-count').textContent==='6');
 offline=true;await save.click();assert.equal(await save.getAttribute('aria-pressed'),'true');assert(await page.evaluate(()=>PlayFeedSaves.list().length===1));
 await page.goto('https://playfeed.test/account.html');await page.locator('.grid .tile').waitFor();
 mergeFail=true;await page.evaluate(()=>PlayFeedAuth.login());await page.waitForFunction(()=>Boolean(PlayFeedSaves.error));assert.equal(await page.locator('.grid .tile').count(),1);assert(await page.evaluate(()=>PlayFeedSaves.list().length===1));
 offline=false;mergeFail=false;await page.locator('#backup-action').click();await page.waitForFunction(()=>PlayFeedSaves.list().length===0);await page.locator('.grid .tile').waitFor();assert(members.has(gameKey));assert.equal(guests.size,0);assert.equal(members.size,1);
 await page.goto('https://playfeed.test/g/sushi');await page.evaluate(()=>PlayFeedAuth.login());await page.waitForFunction(()=>document.querySelector('article:not([hidden]) .reaction')?.getAttribute('aria-pressed')==='true');
 await save.click();await page.waitForFunction(()=>document.querySelector('article:not([hidden]) .reaction .action-count').textContent==='6');
 await share.click();await page.waitForFunction(()=>document.querySelector('article:not([hidden]) .share .action-count').textContent==='3');assert((await page.evaluate(()=>window.copiedShare)).includes('v=4'));
 for(const size of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]){await page.setViewportSize(size);await page.waitForTimeout(150);assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));for(const button of [save,share]){const b=await button.boundingBox(),n=await button.locator('.action-count').boundingBox();assert(n.x>=b.x-1&&n.x+n.width<=b.x+b.width+1,'count must fit inside action');assert(Number(await button.locator('.action-count').evaluate(el=>getComputedStyle(el).fontSize.replace('px','')))>=12)}}
 await save.click();await page.locator('#save-feedback').waitFor();const landscapeHint=await page.locator('#save-feedback').boundingBox();assert(landscapeHint.x>=0&&landscapeHint.x+landscapeHint.width<=844);await save.click();
 await page.setViewportSize({width:390,height:740});await page.screenshot({path:path.join(root,'../.vanilla-test/social-counts.png')});
 assert(events.some(e=>e.action==='guest_save_success'));assert(events.some(e=>e.action==='save_sync_success'));assert.deepEqual(errors,[]);
 const blocked=await context.newPage();await blocked.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='playfeed:guest-saves:v1')throw new DOMException('Blocked','QuotaExceededError');return original.call(this,k,v)}});
 await blocked.goto('https://playfeed.test/g/sushi');await blocked.locator('article:not([hidden]) .reaction').waitFor();await blocked.locator('article:not([hidden]) .reaction').click();assert.equal(await blocked.locator('article:not([hidden]) .reaction').getAttribute('aria-pressed'),'false');assert((await blocked.locator('.action-status').innerText()).includes('無法保存收藏'));
 console.log('PASS guest save without login, one device bootstrap, top-right feedback, reload persistence, guest collection, offline save, failed/successful merge, no duplicate count, member unsave, share count, responsive badges, storage failure and analytics');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
