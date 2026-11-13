const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
async function main(){
 process.env.SUPABASE_SERVICE_ROLE_KEY='test-only-key';
 const devices=new Map(),events=new Map(),pairings=new Map();
 const lib=require('./api/_lib');lib.verifyPhuzeSession=async req=>({user:{email:req.headers.authorization==='Bearer owner'?'paulvongulla@gmail.com':req.headers.authorization==='Bearer nycu'?'paulwu.hs10@nycu.edu.tw':'outsider@example.com',id:'u'}});
 lib.supabaseRest=async(table,o={})=>{
  if(table==='playfeed_analytics_devices'){
   if(o.method==='POST'){if(!devices.has(o.body.id))devices.set(o.body.id,{...o.body,is_owner:false});}
   if(o.method==='PATCH'){const id=o.query.match(/id=eq.([^&]+)/)[1];Object.assign(devices.get(id)||{},o.body);}
  }
  if(table==='playfeed_analytics_events')for(const e of o.body)events.set(e.id,e);
  if(table==='playfeed_analytics_pairings'){
   if(o.method==='POST')pairings.set(o.body.token_hash,o.body);
   else{const key=o.query.match(/token_hash=eq.([^&]+)/)[1],p=pairings.get(key);if(p&&!p.used_at&&Date.parse(p.expires_at)>Date.now()){Object.assign(p,o.body);return {ok:true,data:[p]}}return {ok:true,data:[]};}
  }
  return {ok:true,data:[]};
 };
 const handler=require('./api/analytics');
 async function call(body={},headers={},method='POST'){
  const res={headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},send(data){this.data=JSON.parse(data);return this}};
  await handler({method,headers:{host:'playfeed-gilt.vercel.app','user-agent':'iPhone Safari/605',...headers},body,query:{}},res);return res;
 }
 const init=await call({action:'init'});assert.equal(init.code,200);const cookie=init.headers['Set-Cookie'].split(';')[0];
 const event={id:crypto.randomUUID(),session:crypto.randomUUID(),action:'game_time',game:'test',title:'Test',entry:'next',previous:'prior-game',ms:15000,referrer:'https://example.com/private?q=secret',path:'/'};
 await call({action:'events',events:[event]},{cookie});await call({action:'events',events:[event]},{cookie});assert.equal(events.size,1);assert.equal([...events.values()][0].referrer,'example.com');
 assert.equal([...events.values()][0].entry_source,'next');assert.equal([...events.values()][0].previous_game_id,'prior-game');
 const id=[...devices.keys()][0];assert(!devices.get(id).is_owner);
 await call({action:'identify'},{cookie,authorization:'Bearer owner'});assert(devices.get(id).is_owner);
 assert.equal((await call({}, {},'GET')).code,403);
 assert.equal((await call({action:'pair-link'},{cookie,authorization:'Bearer outsider'})).code,403);
 const link=await call({action:'pair-link',label:'iPhone 13'},{cookie,authorization:'Bearer nycu'});assert.equal(link.code,200);
 const token=link.data.url.split('#pair=')[1];const claim=await call({action:'claim',token});assert.equal(claim.code,200);assert.equal(claim.data.label,'iPhone 13');
 assert.equal((await call({action:'claim',token})).code,410);
 assert.equal((await call({action:'events',events:[{...event,action:'typed-password'}]},{cookie})).code,400);
 assert.equal((await call({action:'events',events:[{...event,ms:999999}]},{cookie})).code,400);
 assert.equal((await call({action:'init'},{origin:'https://evil.example'})).code,403);
 const before=devices.size;await call({action:'init'},{cookie:cookie.slice(0,-1)+'x'});assert.equal(devices.size,before+1);
 assert.equal(handler.deviceInfo({headers:{'user-agent':'iPhone CriOS/123 Safari/605'}}).family,'iPhone');
 // Browser lifecycle: background time is excluded, switching closes the old game's interval.
 let clock=0;const callbacks={},sent=[],storage=new Map(),document={visibilityState:'visible',referrer:'',addEventListener(n,f){callbacks[n]=f}};
 const context={crypto,URL,URLSearchParams,performance:{now:()=>clock},Date,location:{pathname:'/',origin:'https://playfeed-gilt.vercel.app',hash:'',search:''},document,Element:class{},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},navigator:{sendBeacon:()=>true},Blob,Headers,setTimeout,setInterval:f=>{callbacks.tick=f},fetch:async(_,o)=>{sent.push(JSON.parse(o.body));return {ok:true}},window:{addEventListener(){}}};
 vm.runInNewContext(fs.readFileSync('analytics.js','utf8'),context);
 await new Promise(r=>setImmediate(r));const analytics=context.window.PlayFeedAnalytics;
 analytics.setGame({id:'a',title:'A'});clock=5000;analytics.setGame(null);analytics.setGame({id:'b',title:'B'},'next');clock=12000;document.visibilityState='hidden';callbacks.visibilitychange();clock=45000;callbacks.tick();document.visibilityState='visible';callbacks.visibilitychange();clock=48000;analytics.setGame(null);await analytics.flush();await new Promise(r=>setImmediate(r));await analytics.flush();
 const all=sent.flatMap(b=>b.events||[]),unique=[...new Map(all.map(e=>[e.id,e])).values()];
 assert.equal(unique.filter(e=>e.game==='a'&&e.action==='game_time').reduce((s,e)=>s+e.ms,0),5000);
 assert.equal(unique.filter(e=>e.game==='b'&&e.action==='game_time').reduce((s,e)=>s+e.ms,0),10000);
 assert.equal(unique.filter(e=>e.action==='game_view').length,2);
 assert.equal(unique.find(e=>e.action==='game_view'&&e.game==='a').entry,'feed_initial');
 assert.equal(unique.find(e=>e.action==='game_view'&&e.game==='b').entry,'next');
 assert.equal(unique.find(e=>e.action==='game_view'&&e.game==='b').previous,'a');
 assert(unique.filter(e=>e.action==='game_time'&&e.game==='b').every(e=>e.entry==='next'));
 analytics.setGame({id:'a',title:'A'},'previous');await new Promise(r=>setImmediate(r));await analytics.flush();
 assert(sent.flatMap(b=>b.events||[]).some(e=>e.game==='a'&&e.action==='game_view'&&e.entry==='previous'&&e.previous==='b'));
 for(const [referrer,path,navigation,expected]of [['https://outside.example/post','/g/a','navigate','external_entry'],['','/g/a','navigate','direct_entry'],['https://playfeed-gilt.vercel.app/account.html','/g/a','navigate','saved_selection'],['','/g/a','reload','reload']]){
  const batches=[];
  const ctx={...context,document:{...document,referrer,visibilityState:'visible'},location:{...context.location,pathname:path},performance:{now:()=>0,getEntriesByType:()=>[{type:navigation}]},window:{addEventListener(){}},fetch:async(_,o)=>{batches.push(JSON.parse(o.body));return {ok:true}}};
  vm.runInNewContext(fs.readFileSync('analytics.js','utf8'),ctx);await new Promise(r=>setImmediate(r));ctx.window.PlayFeedAnalytics.setGame({id:'a',title:'A'});await new Promise(r=>setImmediate(r));await ctx.window.PlayFeedAnalytics.flush();
  assert.equal(batches.flatMap(b=>b.events||[]).find(e=>e.action==='game_view').entry,expected);
 }
 console.log('PASS: signed device cookies, both owner emails, event deduplication, private report, one-use device link, input validation, visible-only dwell and game switching');
}
main().catch(e=>{console.error(e);process.exitCode=1});
