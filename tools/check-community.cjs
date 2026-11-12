const assert=require('node:assert/strict');
const libPath=require.resolve('../api/_lib');
let writes=[];
const normal={id:'member',email:'member@example.com'},admin={id:'owner',email:'owner@example.com'};
require.cache[libPath]={id:libPath,filename:libPath,loaded:true,exports:{
 publicName:user=>user.email.split('@')[0],
 safeText:(value,{min=1,max=200,pattern}={})=>{const text=String(value??'').trim();if(text.length<min||text.length>max||(pattern&&!pattern.test(text)))throw Object.assign(new Error('invalid'),{status:400});return text},
 supabaseRest:async(table,options={})=>{
  if(options.method&&options.method!=='GET'){writes.push({table,...options});return {ok:true,data:options.method==='POST'?[{id:'published',...options.body}]:[]}}
  let data=[];
  if(table==='playfeed_admins'&&options.query.includes('owner%40'))data=[{email:admin.email}];
  if(table==='playfeed_requests'&&options.query.includes('status=eq.pending'))data=[{id:'00000000-0000-0000-0000-000000000001',user_id:normal.id,url:'https://game.example/'}];
  return {ok:true,data};
 }
}};
const community=require('../api/_community');
(async()=>{
 writes=[];
 assert.equal((await community.post(normal,{action:'publish',url:'https://game.example/'})).status,'pending');
 assert.equal(writes.length,1);assert.equal(writes[0].table,'playfeed_requests');
 assert.equal(writes[0].body.user_id,normal.id);assert.equal(writes[0].body.status,undefined);
 await assert.rejects(community.post(normal,{action:'review',decision:'approve',requestId:'00000000-0000-0000-0000-000000000001'}),e=>e.status===403);
 assert.equal((await community.post(admin,{action:'recommend',url:'https://game.example/'})).status,'published');
 await assert.rejects(community.post(normal,{action:'profile',displayName:'Test',website:'javascript:alert(1)'}),e=>e.status===400);
 await assert.rejects(community.post(normal,{action:'recommend',url:'http://game.example/'}),e=>e.status===400);
 writes=[];await community.post(normal,{action:'profile',user_id:'victim',displayName:'Name',bio:'Bio',website:'https://example.com'});
 assert.equal(writes[0].body.user_id,normal.id);
 writes=[];await community.post(normal,{action:'read-notifications'});
 assert.ok(writes[0].query.includes('user_id=eq.member'));
 console.log('PASS: member publish queues only, admin-only review, admin publishing, profile ownership, unsafe URLs, notification ownership');
})().catch(error=>{console.error(error);process.exit(1)});
