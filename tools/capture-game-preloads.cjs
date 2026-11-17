const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const sharp=require('sharp'),{chromium}=require('../../.vanilla-test/node_modules/playwright');
const {loadPlayfeedGames}=require('../catalog');
const root=path.join(__dirname,'..'),origin='https://playfeed-gilt.vercel.app/';
const manifestPath=path.join(root,'preload-assets.json'),reportPath=path.join(root,'preload-capture-report.json');
async function main(){
 const games=await loadPlayfeedGames(async resource=>{
  const r=await fetch('https://oimdeoszgxfumwtmapok.supabase.co/rest/v1'+resource,{headers:{apikey:'sb_publishable_ZovEIH8JuRiKuf24MTIKLg_sz2Tnui8'},signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error('Catalog '+r.status);return r.json();
 },origin);
 const manifest=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath)):{};
 const report={started_at:new Date().toISOString(),total:games.length,ready:[],failed:[]};
 fs.mkdirSync(path.join(root,'preload-cards'),{recursive:true});
 const slow=process.argv.includes('--slow');
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:slow?['--enable-unsafe-swiftshader']:[]});
 let next=0;
 const persist=()=>{fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n')};
 console.log('CATALOG',games.length,'manual',games.filter(g=>g.preview_image).length);
 try{
 await Promise.all(Array.from({length:4},async()=>{while(next<games.length){
  const game=games[next++],url=new URL(game.url,origin).href;
  if(manifest[url]&&fs.existsSync(path.join(root,manifest[url].image.slice(1)))){report.ready.push({id:game.id,url,reused:true});continue;}
  let page;
  try{
   const w=game.viewport?.width||390,h=game.viewport?.height||700;
   page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:1,reducedMotion:'reduce',colorScheme:'dark'});
   const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
   if(response&&!response.ok())throw Error('HTTP '+response.status());
   await page.waitForLoadState('load',{timeout:5000}).catch(()=>{});
   await page.waitForTimeout(slow?8000:1200);
   let text=await page.locator('body').innerText({timeout:3000}).catch(()=>'');
   if(text.length<250&&/請把手機橫過來|請.{0,10}橫.{0,6}螢幕|rotate.{0,20}device/i.test(text)){
    await page.setViewportSize({width:Math.max(w,h),height:Math.min(w,h)});await page.waitForTimeout(1800);text=await page.locator('body').innerText().catch(()=>'');
   }
   if(text.length<250&&/loading|載入中|読み込|載入資源|正在生成|正在準備|generating|building/i.test(text)){
    await page.waitForFunction(()=>!/loading|載入中|読み込|載入資源|正在生成|正在準備|generating|building/i.test(document.body.innerText),{},{timeout:20000}).catch(()=>{});
    text=await page.locator('body').innerText().catch(()=>'');
    if(text.length<250&&/loading|載入中|読み込|載入資源|正在生成|正在準備|generating|building/i.test(text))throw Error('Still on loading screen');
   }
   if(/vercel security checkpoint|just a moment|performing security verification|checking your browser|this site can.t be reached|deployment_not_found|404: not_found|^\s*(404|not found|access denied)\s*$/i.test(text))throw Error('Unavailable or verification page');
   const raw=await page.screenshot({type:'png',animations:'disabled',timeout:slow?20000:10000});
   const stats=await sharp(raw).stats();
   if(stats.channels.every(c=>c.stdev<2))throw Error('Blank first screen');
   const image=await sharp(raw).resize({width:960,height:1280,fit:'inside',withoutEnlargement:true}).webp({quality:80}).toBuffer({resolveWithObject:true});
   const key=createHash('sha256').update(url).update(image.data).digest('hex').slice(0,24),file='/preload-cards/'+key+'.webp';
   fs.writeFileSync(path.join(root,file.slice(1)),image.data);
   manifest[url]={image:file,width:image.info.width,height:image.info.height};
   report.ready.push({id:game.id,title:game.title,url,bytes:image.data.length});console.log('OK',report.ready.length+'/'+games.length,game.id,image.data.length);
  }catch(error){report.failed.push({id:game.id,title:game.title,url,error:error.message});console.log('FAILED',game.id,error.message)}
  finally{await page?.close();persist();}
 }}));
 }finally{await browser.close();report.finished_at=new Date().toISOString();persist();}
 console.log('COMPLETE',JSON.stringify({total:report.total,ready:report.ready.length,failed:report.failed}));
}
main().catch(error=>{console.error(error);process.exitCode=1});
