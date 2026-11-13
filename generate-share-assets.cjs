const fs=require('node:fs');
const path=require('node:path');
const {loadPlayfeedGames}=require('./catalog');
const {renderCard,WIDTH,HEIGHT}=require('./api/_render-card');
const {assetKey,ASSET_VERSION}=require('./api/_share-assets');
async function main(){
 const catalogArg=process.argv.indexOf('--catalog');
 const games=catalogArg>=0?JSON.parse(fs.readFileSync(process.argv[catalogArg+1],'utf8')):await loadPlayfeedGames(async resource=>{
  const r=await fetch('https://oimdeoszgxfumwtmapok.supabase.co/rest/v1'+resource,{headers:{apikey:'sb_publishable_ZovEIH8JuRiKuf24MTIKLg_sz2Tnui8'}});
  if(!r.ok)throw Error('Catalog unavailable');return r.json();
 },'https://playfeed-gilt.vercel.app/');
 const useBrowser=process.argv.includes('--browser');
 let browser;
 if(useBrowser){
  const {chromium}=require(path.join(process.env.NODE_REPL_NODE_MODULE_DIRS,'playwright'));
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYFEED_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 }
 fs.mkdirSync('share-cards/'+ASSET_VERSION,{recursive:true});
 const manifest=JSON.parse(fs.readFileSync('share-assets.json'));
 const failures=[];
 let next=0,ready=0;
 try{
 await Promise.all(Array.from({length:4},async()=>{while(next<games.length){
  const game=games[next++];const key=assetKey(game);
  if(manifest[key]?.startsWith('/share-cards/'+ASSET_VERSION+'/')&&fs.existsSync('.'+manifest[key])){ready++;continue;}
  console.log('START',game.id);
  let page;
  try{
   let image;
   if(browser){
    page=await browser.newPage({viewport:{width:360,height:640},deviceScaleFactor:2,reducedMotion:'reduce'});
    const response=await page.goto(new URL(game.url,'https://playfeed-gilt.vercel.app/').href,{waitUntil:'domcontentloaded',timeout:35000});
    if(!response?.ok())throw Error('Game returned '+response?.status());
    await page.waitForLoadState('networkidle',{timeout:5000}).catch(()=>{});
    await page.waitForTimeout(1600);
    await page.waitForFunction(()=>!/読み込んでいます|載入中|loading\.\.\./i.test(document.body.innerText),{},{timeout:10000}).catch(()=>{});
    await Promise.race([page.evaluate(()=>document.fonts.ready.then(()=>true)),new Promise(resolve=>setTimeout(resolve,1500))]);
    const text=await page.locator('body').innerText();
    if(/just a moment|performing security verification|checking your browser|this site can.t be reached|deployment_not_found|404: not_found/i.test(text))throw Error('Game screenshot unavailable');
    image=await page.screenshot({type:'png',animations:'disabled',timeout:10000});
    if(image.readUInt32BE(16)!==WIDTH||image.readUInt32BE(20)!==HEIGHT)throw Error('Incorrect image dimensions');
   }else image=await renderCard(game);
   const file='/share-cards/'+ASSET_VERSION+'/'+key+'.png';
   fs.writeFileSync('.'+file,image);manifest[key]=file;fs.writeFileSync('share-assets.json',JSON.stringify(manifest,null,2)+'\n');ready++;
   console.log('OK',game.id,image.length);
  }catch(e){failures.push({id:game.id,error:e.message});console.log('FAILED',game.id,e.message);}
  finally{await page?.close()}
 }}));
 }finally{await browser?.close()}
 fs.writeFileSync('share-assets-status.json',JSON.stringify({total:games.length,ready,failures},null,2));
 console.log('COMPLETE',JSON.stringify({total:games.length,ready,failures}));
 if(failures.length)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1});
