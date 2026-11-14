const assert=require('node:assert/strict');
const lib=require.resolve('../api/_lib'),writes=[];
require.cache[lib]={id:lib,filename:lib,loaded:true,exports:{publicName:()=>'',safeText(value,{pattern,max=1000}={}){const text=String(value||'');if(!text||text.length>max||(pattern&&!pattern.test(text)))throw Object.assign(Error('invalid'),{status:400});return text},async supabaseRest(table,options={}){
 if(options.method&&options.method!=='GET'){writes.push({table,...options});return {ok:true,data:[{id:'published'}]};}
 return {ok:true,data:table==='playfeed_admins'?(options.query.includes('owner%40')?[{}]:[]):table==='playfeed_requests'?[{id:'11111111-1111-4111-8111-111111111111',url:'https://example.test/game',user_id:'member'}]:[]};
}}};
for(const [name,exports]of [['../api/_source-metadata',{sourceMetadata:async()=>({title:'Fixture',author:'Fixture'})}],['../api/_share-assets',{prepareAsset:async()=>{}}]]){const id=require.resolve(name);require.cache[id]={id,filename:id,loaded:true,exports};}
const {post}=require('../api/_community'),member={id:'member',email:'member@example.test'},owner={id:'owner',email:'owner@example.test'};
(async()=>{
 assert.equal((await post(member,{action:'recommend',url:'https://example.test/game'})).status,'pending');assert.equal(writes[0].table,'playfeed_requests');
 writes.length=0;assert.equal((await post(owner,{action:'recommend',url:'https://example.test/game'})).status,'preview');assert.equal(writes.length,0);
 const review={action:'review',requestId:'11111111-1111-4111-8111-111111111111',decision:'approve'};
 await assert.rejects(post(member,{...review,interactionConfirmed:true}),error=>error.status===403);
 await assert.rejects(post(owner,review),error=>error.status===400);assert.equal(writes.length,0);
 await post(owner,{...review,interactionConfirmed:true});assert.equal(writes[0].table,'playfeed_recommendations');assert.equal(writes[0].body.submitted_by,'member');
 console.log('PASS: member submissions stay pending; only admins preview/approve; approval requires interaction confirmation; recommendation credit stays with submitter.');
})().catch(error=>{console.error(error);process.exit(1)});
