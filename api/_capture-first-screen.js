const dns=require('node:dns/promises');
const {publicAddress}=require('./_source-metadata');
async function captureFirstScreen(game){
 const {chromium}=require('playwright-core');
 const local=process.platform==='win32';
 let binary;
 if(!local)binary=(await import('@sparticuz/chromium')).default;
 const browserEnv={};for(const name of ['PATH','SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','LOCALAPPDATA','LD_LIBRARY_PATH','FONTCONFIG_PATH'])if(process.env[name])browserEnv[name]=process.env[name];
 if(!local){browserEnv.HOME='/tmp';browserEnv.TMPDIR='/tmp';browserEnv.LANG='en_US.UTF-8';}
 const browser=await chromium.launch({headless:true,executablePath:local?'C:/Program Files/Google/Chrome/Application/chrome.exe':await binary.executablePath(),args:local?['--enable-unsafe-swiftshader']:binary.args,env:browserEnv,timeout:20000});
 try{
  const page=await browser.newPage({viewport:{width:game.viewport?.width||390,height:game.viewport?.height||700},deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block',acceptDownloads:false});
  const hosts=new Map();
  async function allowed(value){
   let u;try{u=new URL(value)}catch{return false}
   if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port||!/^([a-z0-9-]+\.)+[a-z][a-z0-9-]+$/i.test(u.hostname))return false;
   if(!hosts.has(u.hostname))hosts.set(u.hostname,dns.lookup(u.hostname,{family:4,all:true}).then(a=>a.length>0&&a.every(item=>publicAddress(item.address))).catch(()=>false));
   return hosts.get(u.hostname);
  }
  await page.route('**/*',async route=>{if(await allowed(route.request().url()))await route.continue().catch(()=>{});else await route.abort().catch(()=>{})});
  await page.routeWebSocket('**/*',route=>route.close());
  await page.addInitScript(()=>{window.RTCPeerConnection=undefined;window.webkitRTCPeerConnection=undefined;});
  const url=new URL(game.url,'https://playfeed-gilt.vercel.app/').href;
  if(!await allowed(url))throw Error('Invalid screenshot URL');
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
  if(response&&!response.ok())throw Error('Game returned '+response.status());
  await page.waitForLoadState('load',{timeout:4000}).catch(()=>{});
  await new Promise(resolve=>setTimeout(resolve,2000));
  let text=await page.locator('body').innerText({timeout:3000});
  if(text.length<300&&/請把手機橫過來|請.{0,10}橫.{0,6}螢幕|rotate.{0,20}device/i.test(text))await page.setViewportSize({width:700,height:390});
  await page.waitForFunction(()=>{
   const text=document.body.innerText.trim();
   return !(text.length<300&&/loading|載入中|読み込|載入資源|正在生成|正在準備|generating|building/i.test(text));
  },{},{timeout:18000});
  text=await page.locator('body').innerText();
  if(/vercel security checkpoint|just a moment|performing security verification|checking your browser|deployment_not_found|404: not_found/i.test(text))throw Error('Game screenshot unavailable');
  const image=await page.screenshot({type:'png',animations:'disabled',timeout:10000});
  const stats=await require('sharp')(image).stats();if(stats.channels.every(c=>c.stdev<2))throw Error('Game screen is blank');
  return image;
 }catch(error){console.warn('Automatic first screen failed:',error.message);throw Object.assign(Error('尚未取得遊戲首畫面，請稍後重試上架。'),{status:503});}
 finally{await browser.close();}
}
module.exports={captureFirstScreen};
