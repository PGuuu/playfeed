const assert=require('node:assert/strict');
const config=require('../api/_initial-saves.json');
const helper=require('../api/_save-counts');
assert(config.games.some(g=>g.initialCount===0));assert(config.games.every(g=>Number.isInteger(g.initialCount)&&g.initialCount>=0&&g.initialCount<=6));
const url='https://play.cybernatsume.org/g/tooth_out_words_off/';
assert.equal(helper.initialSaveCount(url),6);assert.equal(helper.initialSaveCount('https://new-game.example/'),0);
const libPath=require.resolve('../api/_lib'),real=require(libPath);let saves=new Set(),writes=0;
require.cache[libPath].exports={...real,verifyPhuzeSession:async()=>({user:{id:'member',email:'member@example.com'}}),supabaseRest:async(table,o={})=>{
 if(table==='rpc/playfeed_engagement_counts')return {ok:true,data:{saveCount:saves.size,commentCount:0,shareCount:2,guestSaved:false}};
 if(o.method==='HEAD')return {ok:true,count:table==='playfeed_user_actions'?saves.size:0};
 if(table==='playfeed_user_actions'){
  if(o.method==='POST'){writes++;saves.add(o.body.user_id)}
  if(o.method==='DELETE'){writes++;saves.delete('member')}
  if(o.query?.includes('limit=1000'))return {ok:true,data:[...saves].map(()=>({game_key:url}))};
  return {ok:true,data:[...saves].map(user_id=>({user_id,kind:'save'}))};
 }
 return {ok:true,data:[]};
}};
const handler=require('../api/account');
async function call(method,action,extra={}){let status,data;await handler({method,headers:{},query:{action,gameKey:url},body:{action,gameKey:url,...extra}},{status(v){status=v},setHeader(){},send(v){data=JSON.parse(v)}});assert.equal(status,200);return data;}
(async()=>{
 let r=await call('GET','counts');assert.equal(r.saveCount,0);assert.equal(r.displaySaveCount,6);assert.equal(writes,0);
 r=await call('POST','save',{active:true});assert.equal(r.saveCount,1);assert.equal(r.displaySaveCount,7);
 r=await call('POST','save',{active:true});assert.equal(r.saveCount,1);assert.equal(r.displaySaveCount,7);
 let summary=await helper.saveCountSummary();let row=summary.find(r=>r.url===url);assert.deepEqual([row.initialCount,row.realCount,row.displayCount],[6,1,7]);
 r=await call('POST','save',{active:false});assert.equal(r.saveCount,0);assert.equal(r.displaySaveCount,6);
 r=await call('POST','save',{active:false});assert.equal(r.saveCount,0);assert.equal(r.displaySaveCount,6);
 summary=await helper.saveCountSummary();row=summary.find(r=>r.url===url);assert.deepEqual([row.initialCount,row.realCount,row.displayCount],[6,0,6]);
 // Summary pagination must count every real save, including totals above REST's page limit.
 require.cache[libPath].exports.supabaseRest=async(table,o)=>({ok:true,data:table==='playfeed_guest_saves'?[]:Array.from({length:o.query.includes('offset=0')?1000:3},()=>({game_key:url}))});
 row=(await helper.saveCountSummary()).find(r=>r.url===url);assert.equal(row.realCount,1003);assert.equal(row.displayCount,1009);
 console.log('PASS: bounded fixed starters; zero defaults; real and displayed totals separated; save/unsave +1/-1; repeated writes idempotent; owner summary and pagination');
})().catch(e=>{console.error(e);process.exit(1)});
