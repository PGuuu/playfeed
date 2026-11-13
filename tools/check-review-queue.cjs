const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage(),errors=[],decisions=[];page.setDefaultTimeout(6000);page.on('pageerror',e=>console.log('PAGEERROR',e.message));
  let requests=[1,2,3].map(n=>({id:`00000000-0000-4000-8000-00000000000${n}`,url:`https://game.test/${n}`,status:'pending'})),admin=true;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url()),json=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
   if(url.pathname==='/auth.js')return route.fulfill({contentType:'text/javascript',body:"window.PlayFeedAuth={user:{id:'owner',email:'owner@example.com'},checking:false,onChange(fn){fn(this.user)},requireLogin(fn){return fn()},takeCollection(){return null},async api(url,options){const r=await fetch(url,options),data=await r.json();if(!r.ok)throw Error(data.error);return data}}"});
   if(url.pathname==='/saves.js')return route.fulfill({contentType:'text/javascript',body:'window.PlayFeedSaves={list(){return []},async merge(){return true},error:""}'});
   if(['/analytics.js','/analytics-owner-link.js','/recommendations.js'].includes(url.pathname))return route.fulfill({body:''});
   if(url.pathname==='/catalog.js')return route.fulfill({contentType:'text/javascript',body:'async function loadPlayfeedGames(){return []}'});
   if(url.pathname==='/api/account'){
    const body=route.request().method()==='POST'?route.request().postDataJSON():null;
    if(body){assert.equal(body.action,'review');assert.equal(body.decision,'reject');assert(!('title'in body));decisions.push(body.requestId);requests=requests.filter(r=>r.id!==body.requestId);return json({ok:true})}
    if(url.searchParams.get('action')==='review')return json({requests});
    return json({isAdmin:admin,profile:{display_name:'Owner',bio:'',website:''},requests:[],actions:[],notifications:[],recommendations:[]});
   }
   if(url.hostname==='game.test')return route.fulfill({body:'<body>Playable fixture</body>',contentType:'text/html'});
   const file=path.join(__dirname,'..',url.pathname==='/'?'index.html':url.pathname.slice(1));
   return route.fulfill({body:fs.existsSync(file)?fs.readFileSync(file):'',contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});
  });
  await page.goto('https://playfeed.test/account.html');console.log('Loaded account');
  await page.getByRole('button',{name:'待審核（3）',exact:true}).waitFor();
  assert.equal(await page.locator('#review').isVisible(),false);
  await page.locator('#open-review').click();assert.equal(await page.locator('.review-row').count(),3);
  await page.getByRole('button',{name:'不予上架',exact:true}).first().click();
  await page.getByRole('button',{name:'待審核（2）',exact:true}).waitFor();assert.equal(await page.locator('.review-row').count(),2);
  await page.getByRole('link',{name:'預覽試玩與審核'}).first().click();
  await page.locator('#preview iframe').waitFor();assert.equal(await page.locator('#preview iframe').getAttribute('src'),'https://game.test/2');
  await page.locator('#reject-review').click();await page.getByRole('button',{name:'待審核（1）',exact:true}).waitFor();
  assert.equal(await page.locator('#review').isVisible(),true);assert.equal(await page.locator('.review-row').count(),1);assert.equal(decisions.length,2);
  await page.locator('#close-review').click();assert.equal(await page.locator('#review').isVisible(),false);
  admin=false;await page.reload();await page.waitForFunction(()=>document.querySelector('.identity h1').textContent==='Owner');assert.equal(await page.locator('#open-review').isVisible(),false);
  assert.deepEqual(errors,[]);console.log('PASS: three pending URLs, collapsed counted queue, reject without undefined input, preview correct URL, reject from preview, return with remaining queue, non-admin hidden');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
