const assert=require('node:assert/strict');
const libPath=require.resolve('../api/_lib'),real=require(libPath);
const key='https://game.example/',saves=new Set();
let commentCount=1110,verificationCalls=0;
require.cache[libPath].exports={
 ...real,
 verifyPhuzeSession:async()=>{verificationCalls++;return {user:{id:'member',email:'test@example.com'}}},
 supabaseRest:async(table,options={})=>{
  if(options.method==='HEAD'){
   assert.equal(options.prefer,'count=exact');
   assert.ok(options.query.includes(encodeURIComponent(key)));
   return {ok:true,count:table==='playfeed_user_actions'?1400+saves.size:commentCount};
  }
  if(table==='playfeed_user_actions'){
   if(options.method==='POST')saves.add(options.body.user_id);
   else if(options.method==='DELETE')saves.delete('member');
   return {ok:true,data:saves.has('member')?[{user_id:'member',kind:'save'}]:[]};
  }
  if(table==='playfeed_game_comments'){
   if(options.method==='POST')commentCount++;
   return {ok:true,data:[]};
  }
  if(table==='playfeed_profiles')return {ok:true,data:[]};
  return {ok:true,data:[]};
 }
};
const handler=require('../api/account');
async function call(method,action,body={}){
 let status,payload;
 await handler({method,headers:{},query:{action,gameKey:key},body:{action,gameKey:key,...body}},
 {status(value){status=value},setHeader(){},send(value){payload=JSON.parse(value)}});
 assert.ok(status<300,JSON.stringify(payload));return payload;
}
(async()=>{
 assert.deepEqual(await call('GET','counts'),{saveCount:1400,displaySaveCount:1400,commentCount:1110});
 assert.equal(verificationCalls,0,'Public counts must not require authentication');
 let result=await call('POST','save',{active:true});
 assert.equal(result.saveCount,1401);assert.equal(result.saved,true);
 result=await call('POST','save',{active:true});assert.equal(result.saveCount,1401);
 result=await call('POST','save',{active:false});assert.equal(result.saveCount,1400);assert.equal(result.saved,false);
 result=await call('POST','comment',{body:'Hello'});assert.equal(result.commentCount,1111);
 result=await call('GET','comments');assert.equal(result.comments.length,0);assert.equal(result.commentCount,1111);
 process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';
 global.fetch=async()=>new Response(null,{status:200,headers:{'Content-Range':'*/2345'}});
 assert.equal((await real.supabaseRest('playfeed_game_comments',{method:'HEAD',prefer:'count=exact'})).count,2345);
 console.log('PASS: public totals without login; exact totals beyond page limit; idempotent saves; unsave decrement; comment increment; Content-Range parsing');
})().catch(error=>{console.error(error);process.exit(1)});
