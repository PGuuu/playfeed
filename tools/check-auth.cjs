const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.NODE_REPL_NODE_MODULE_DIRS+'/playwright');
const auth=fs.readFileSync(path.join(__dirname,'..','auth.js'),'utf8');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 let mode='limited',ready=false,sendCount=0,verifyCount=0,receivedPending;
 const errors=[];
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.pathname==='/api/login'){
   const body=request.postDataJSON();
   if(body.action==='send'){
    sendCount++;receivedPending=body.pendingId;
    if(mode==='limited')return json({error:{code:'rate_limited',message:'Too many',retry_after_seconds:1}},429);
    if(mode==='forbidden')return json({error:{code:'forbidden',message:'Origin rejected'}},403);
    return json({message:'Check email'});
   }
   if(body.action==='pickup')return json(ready?{ready:true,session_token:'st_test_fixture'}:{ready:false});
   if(body.action==='logout')return json({logged_out:true});
   throw Error('Unexpected provider request: '+url.pathname);
  }
  if(url.pathname==='/api/auth'){
   verifyCount++;
   assert.equal(request.headers()['authorization'],'Bearer st_test_fixture');
   return json({user:{id:'u_fixture',email:'test@example.com'}});
  }
  if(url.pathname==='/auth.js')return route.fulfill({contentType:'text/javascript; charset=utf-8',body:auth});
  return route.fulfill({contentType:'text/html',body:'<button id="login">Login</button><p id="user"></p><dialog id="login-dialog"><div id="phuze-widget"></div><button data-close-login>Cancel</button></dialog><script src="/auth.js"></script><script>document.querySelector("#login").onclick=()=>PlayFeedAuth.openLogin();PlayFeedAuth.onChange(user=>document.querySelector("#user").textContent=user?.email||"anonymous")</script>'});
 });
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto('https://playfeed.test/');await page.locator('#login').click();
 await page.getByLabel('登入 Email').fill('test@example.com');
 await page.getByRole('button',{name:'寄登入連結給我',exact:true}).click();
 await page.getByRole('status').filter({hasText:'寄信次數暫時受限'}).waitFor();
 assert.equal(sendCount,1);
 mode='success';
 await page.waitForTimeout(1100);
 await page.getByRole('button',{name:'寄登入連結給我',exact:true}).click();
 await page.getByRole('status').filter({hasText:'登入信已送出'}).waitFor();
 assert.match(receivedPending,/^[a-f0-9-]{36}$/);
 assert.ok(await page.evaluate(()=>localStorage.getItem('playfeed:phuze-pending')));
 // Mobile returns after backgrounding and reloads: pending handoff must survive.
 await page.reload();ready=true;
 await page.locator('#login').click();
 await page.waitForFunction(()=>document.querySelector('#user').textContent==='test@example.com');
 assert.equal(await page.locator('#login-dialog').isVisible(),false);
 assert.ok(verifyCount>=1);
 await page.reload();
 await page.waitForFunction(()=>document.querySelector('#user').textContent==='test@example.com');
 await page.evaluate(()=>PlayFeedAuth.logout());
 assert.equal(await page.locator('#user').textContent(),'anonymous');
 // Safari storage failure: submit and pickup continue in memory, and no uncaught exception.
 const privateContext=await browser.newContext({viewport:{width:390,height:844}});
 await privateContext.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new DOMException('Blocked','SecurityError')};Storage.prototype.setItem=()=>{throw new DOMException('Blocked','SecurityError')};Storage.prototype.removeItem=()=>{throw new DOMException('Blocked','SecurityError')}});
 await privateContext.route('**/*',async route=>{
  const url=new URL(route.request().url());
  const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.pathname==='/api/login'){
   const body=route.request().postDataJSON();
   if(body.action==='send')return json({message:'Sent'});
   if(body.action==='pickup')return json({ready:true,session_token:'st_test_fixture'});
  }
  if(url.pathname==='/api/auth')return json({user:{id:'u_fixture',email:'test@example.com'}});
  if(url.pathname==='/auth.js')return route.fulfill({contentType:'text/javascript; charset=utf-8',body:auth});
  return route.fulfill({contentType:'text/html',body:'<button id="login">Login</button><p id="user"></p><dialog id="login-dialog"><div id="phuze-widget"></div><button data-close-login>Cancel</button></dialog><script src="/auth.js"></script><script>document.querySelector("#login").onclick=()=>PlayFeedAuth.openLogin();PlayFeedAuth.onChange(user=>document.querySelector("#user").textContent=user?.email||"anonymous")</script>'});
 });
 const safari=await privateContext.newPage();safari.on('pageerror',error=>errors.push(error.message));
 await safari.goto('https://playfeed.test/');await safari.locator('#login').click();
 await safari.getByLabel('登入 Email').fill('test@example.com');
 await safari.getByRole('button',{name:'寄登入連結給我',exact:true}).click();
 await safari.waitForFunction(()=>document.querySelector('#user').textContent==='test@example.com');
 assert.deepEqual(errors,[]);
 await browser.close();
 console.log('PASS: visible send-limit error; retry; persisted pending pickup after reload; server-verified login; restored session; logout; blocked storage fallback');
})().catch(error=>{console.error(error);process.exit(1)});
