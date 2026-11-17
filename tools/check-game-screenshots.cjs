const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),vm=require('vm');
const {chromium}=require('../../.vanilla-test/node_modules/playwright');
const root=path.join(__dirname,'..');
for(const file of ['index.html','submit.html'])for(const match of fs.readFileSync(path.join(root,file),'utf8').matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(match[2].trim())new vm.Script(match[1].includes('module')?'(async()=>{'+match[2]+'})()':match[2],{filename:file});
async function serverTests(){
 const libPath=require.resolve('../api/_lib'),writes=[];let admin=true;
 require.cache[libPath]={id:libPath,filename:libPath,loaded:true,exports:{safeText:v=>v,publicName:()=>'',supabaseRest:async(table,options={})=>{
  if(options.method){writes.push({table,...options});return {ok:true,data:[]};}
  return {ok:true,data:table==='playfeed_admins'&&admin?[{}]:[]};
 }}};
 const {post}=require('../api/_community');
 const owner={id:'d28b1149fa6dc857b3086bf77acf5073',email:'paulvongulla@gmail.com'};
 await assert.rejects(post({id:'member',email:'test@test.com'},{action:'game-screenshot',gameId:'light-switch',image:'bad'}),e=>e.status===403);
 admin=false;await assert.rejects(post(owner,{action:'game-screenshot',gameId:'light-switch',image:'bad'}),e=>e.status===403);admin=true;
 await assert.rejects(post(owner,{action:'game-screenshot',gameId:'missing',image:'bad'}),e=>e.status===404);
 await assert.rejects(post(owner,{action:'game-screenshot',gameId:'light-switch',image:'data:image/png;base64,YWJj'}),e=>e.status===400);
 const sharp=require('sharp'),buffer=await sharp({create:{width:880,height:1280,channels:3,background:'#a45a31'}}).jpeg().toBuffer();
 process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';let uploaded;
 global.fetch=async(url,options)=>{uploaded={url,options};return {ok:true}};
 const saved=await post(owner,{action:'game-screenshot',gameId:'light-switch',image:'data:image/jpeg;base64,'+buffer.toString('base64')});
 assert.match(saved.image,/^\/api\/game-image\?key=[a-f0-9]{64}$/);assert.equal(saved.width,880);assert.equal(saved.height,1280);
 assert.match(uploaded.url,/screenshots\/[a-f0-9]{64}\.png$/);
 assert.equal(writes.at(-1).table,'playfeed_game_previews');assert.equal(writes.at(-1).body.game_url,'https://playfeed-gilt.vercel.app/games/light-switch/index.html');
 assert.equal((await sharp(uploaded.options.body).metadata()).format,'png');
 console.log('PASS server: owner and admin checks, missing game, invalid image, normalized upload, durable metadata.');
}
async function browserTests(){
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],posts=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   let config;
   navigator.mediaDevices.setCaptureHandleConfig=value=>config=value;
   navigator.mediaDevices.getDisplayMedia=async()=>{
    const c=document.createElement('canvas');c.width=1280;c.height=900;c.getContext('2d').fillRect(0,0,1280,900);
    const stream=c.captureStream(30),track=stream.getVideoTracks()[0];const timer=setInterval(()=>c.getContext('2d').fillRect(0,0,1280,900),30);track.addEventListener('ended',()=>clearInterval(timer));track.getSettings=()=>({displaySurface:'browser'});track.getCaptureHandle=()=>({handle:config.handle});return stream;
   };
  });
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url()),json=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
   if(u.pathname==='/auth.js')return route.fulfill({contentType:'text/javascript',body:`window.PlayFeedAuth={user:{id:'d28b1149fa6dc857b3086bf77acf5073',email:'paulvongulla@gmail.com'},checking:false,onChange(fn){fn(this.user)},requireLogin(fn){return fn()},takeCollection(){return null},async api(url,options){const r=await fetch(url,options);const data=await r.json();if(!r.ok)throw Error(data.error);return data}}`});
   if(u.pathname==='/api/account'){
    const b=route.request().method()==='POST'?route.request().postDataJSON():null;
    if(b){posts.push(b);return json(b.action==='recommend'?{status:'preview',url:b.url}:b.action==='game-screenshot'?{image:'/api/game-image?key='+('a'.repeat(64)),width:880,height:1280}:{id:'fixture',status:'published'});}
    if(u.searchParams.get('action')==='waiting-list')return json({requests:[{id:'11111111-1111-4111-8111-111111111111',url:'https://game.test/play'}]});
    if(u.searchParams.get('action')==='waiting-detail')return json({metadata:{title:'Fixture',author:'Creator'}});
    return json({isAdmin:true,comments:[],ratings:[],counts:{},total:0});
   }
   if(u.pathname==='/catalog.js')return route.fulfill({contentType:'text/javascript',body:'async function loadPlayfeedGames(){return [{id:"fixture",title:"Fixture",author:"Creator",url:"https://game.test/play",preview_image:"/share-cards/screenshots/carpet-20261117.png"}]}'});
   if(['/analytics.js','/analytics-owner-link.js','/recommendations.js'].includes(u.pathname))return route.fulfill({body:''});
   if(u.hostname==='game.test')return route.fulfill({contentType:'text/html',body:'<body style="background:#a45a31"><button>Play fixture</button></body>'});
   if(u.pathname==='/saves.js')return route.fulfill({contentType:'text/javascript',body:'window.PlayFeedSaves={has(){return false},list(){return []},async merge(){return true},error:""}'});
   const file=path.join(root,u.pathname==='/'?'index.html':u.pathname.slice(1));
   if(!fs.existsSync(file))return json([]);
   return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html'});
  });
  // New game: capture actual frame pixels, accept, then publish with selected image.
  await page.goto('https://playfeed.test/submit.html');await page.getByRole('button',{name:'預覽試玩',exact:true}).waitFor();
  await page.locator('[name=url]').fill('https://game.test/play');await page.getByRole('button',{name:'預覽試玩',exact:true}).click();
  await page.locator('#preview iframe').waitFor();await page.getByRole('button',{name:'截圖',exact:true}).click();
  await page.getByRole('button',{name:'使用這張截圖'}).waitFor();await page.getByRole('button',{name:'使用這張截圖'}).click();
  await page.getByRole('button',{name:'截圖（已選好）'}).waitFor();await page.locator('[name=confirmed]').check();
  await page.getByRole('button',{name:'確認上架'}).click();await page.waitForTimeout(100);
  assert.match(posts.find(b=>b.action==='publish').screenshot,/^data:image\/jpeg;base64,/);
  // Waiting room: unsupported mobile capture uses upload and keeps image with that candidate.
  await page.goto('https://playfeed.test/waiting.html');await page.locator('#player iframe').waitFor();
  await page.evaluate(()=>navigator.mediaDevices.getDisplayMedia=undefined);
  await page.getByRole('button',{name:'截圖',exact:true}).click();
  await page.locator('.screenshot-dialog input').setInputFiles(path.join(root,'share-cards/screenshots/carpet-20261117.png'));
  await page.getByRole('button',{name:'使用這張截圖'}).click();await page.locator('[name=confirmed]').check();
  await page.getByRole('button',{name:'公開',exact:true}).click();await page.waitForTimeout(100);
  assert.match(posts.find(b=>b.action==='waiting-review').screenshot,/^data:image\/jpeg;base64,/);
  // Existing game source sheet saves to exact game ID, with no iframe restart.
  await page.goto('https://playfeed.test/');await page.locator('article:not([hidden]) iframe').waitFor();
  await page.locator('article:not([hidden]) .comments-button').click();
  await page.getByRole('button',{name:'截圖',exact:true}).click();
  await page.locator('.screenshot-dialog img').waitFor();await page.getByRole('button',{name:'使用這張截圖'}).click();
  await page.waitForTimeout(100);assert.equal(posts.find(b=>b.action==='game-screenshot').gameId,'fixture');
  await page.screenshot({path:path.join(root,'../screenshot-feature-verified.png')});
  assert.deepEqual(errors,[]);console.log('PASS browser: frame capture, publish, mobile upload, waiting publish, existing source screenshot, no runtime errors.');
 }finally{await browser.close();}
}
(async()=>{await serverTests();await browserTests()})().catch(e=>{console.error(e);process.exitCode=1});
