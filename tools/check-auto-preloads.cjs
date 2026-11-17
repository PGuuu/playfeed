const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),sharp=require('sharp');
const {chromium}=require('../../.vanilla-test/node_modules/playwright');
const root=path.join(__dirname,'..'),manifest=require('../preload-assets.json');
(async()=>{
 let automatic=true;
 const context=vm.createContext({window:{},URL,console,location:{origin:'https://playfeed-gilt.vercel.app'},fetch:async()=>({ok:true,json:async()=>automatic?manifest:{}})});
 vm.runInContext(fs.readFileSync(path.join(root,'catalog.js'),'utf8'),context);
 const request=async url=>url.startsWith('/playfeed_game_previews')?[{game_url:'https://playfeed-gilt.vercel.app/arcade.html#tap',image_url:'/manual.png',share_image_url:'/manual-share.png',width:390,height:700}]:[];
 const games=await context.loadPlayfeedGames(request,'https://playfeed-gilt.vercel.app/');
 const manual=games.find(g=>g.id==='spark-tap');assert.equal(manual.preview_image,'/manual.png');assert.equal(manual.share_image,'/manual-share.png');assert.ok(manual.preload_image);
 automatic=false;const before=await context.loadPlayfeedGames(request,'https://playfeed-gilt.vercel.app/');
 const shareFields=list=>JSON.stringify(list.map(g=>({id:g.id,title:g.title,cover:g.cover,share:g.share_image})));
 assert.equal(shareFields(games),shareFields(before),'automatic first screens must not change sharing');
 for(const [url,asset]of Object.entries(manifest)){
  assert.match(asset.image,/^\/preload-cards\/[a-f0-9]{24}\.webp$/);
  const metadata=await sharp(path.join(root,asset.image.slice(1))).metadata();assert.equal(metadata.width,asset.width);assert.equal(metadata.height,asset.height);
 }
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage();await page.setContent('<div class="game-viewport"><div class="stage"><iframe></iframe></div></div><div class="game-loading"></div>');
  await page.addStyleTag({content:fs.readFileSync(path.join(root,'feed-layout.css'),'utf8')});await page.addScriptTag({path:path.join(root,'game-frame.js')});
  await page.evaluate(()=>PlayFeedFrame.configure(document.querySelector('iframe'),'https://game.test/','https://playfeed.test/'));
  for(const dark of [false,true]){
   await page.evaluate(dark=>document.body.classList.toggle('switch-dark',dark),dark);
   for(const selector of ['.game-viewport','.stage','iframe','.game-loading'])assert.equal(await page.locator(selector).evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(0, 0, 0)');
  }
 }finally{await browser.close()}
 console.log('PASS: '+Object.keys(manifest).length+' valid loading images, manual images take priority, sharing unchanged, iframe/stage/loading backgrounds black.');
})().catch(e=>{console.error(e);process.exitCode=1});
