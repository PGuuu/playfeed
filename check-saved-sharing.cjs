const assert=require('node:assert/strict');
const fs=require('node:fs');
const assets=require('./api/_share-assets');
async function main(){
 const calls=[];
 const lib=require('./api/_lib');
 lib.supabaseRest=async(table,options={})=>{
  calls.push([table,options.method||'GET']);
  const data=table==='playfeed_admins'?[{email:'owner@example.com'}]:table==='playfeed_profiles'?[{display_name:'Author'}]:table==='playfeed_requests'?[{url:'https://example.com/',user_id:'u'}]:table==='playfeed_recommendations'&&options.method==='POST'?[{id:'new-id'}]:[];
  return {ok:true,data};
 };
 const community=require('./api/_community');
 const user={id:'owner',email:'owner@example.com'};
 for(const body of [{action:'publish',url:'https://example.com/',interactionConfirmed:true},{action:'review',requestId:'12345678-1234-1234-1234-123456789abc',decision:'approve',title:'Game',interactionConfirmed:true}]){
  calls.length=0;assets.prepareAsset=async()=>{throw Error('image failed')};
  await assert.rejects(community.post(user,body),/image failed/);
  assert(!calls.some(([t,m])=>t==='playfeed_recommendations'&&m==='POST'));
  calls.length=0;assets.prepareAsset=async()=>{calls.push(['image','SAVED'])};
  await community.post(user,body);
  assert(calls.findIndex(([t])=>t==='image')<calls.findIndex(([t,m])=>t==='playfeed_recommendations'&&m==='POST'));
 }
 const game={id:'balcony-blanket',title:'陽台上的小被被',author:'sansword',url:'https://sansword.github.io/balcony-blanket/'};
 const saved=assets.staticAsset(game);assert(saved);assert(fs.existsSync('.'+saved));
 const png=fs.readFileSync('.'+saved);assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);
 const catalog=require('./catalog');catalog.loadPlayfeedGames=async()=>[game];
 const handler=require('./api/share');
 const res={headers:{},setHeader(k,v){this.headers[k]=v},status(s){this.code=s;return this},send(body){this.body=body;return this}};
 await handler({method:'GET',query:{id:game.id}},res);
 assert(res.body.includes('陽台上的小被被 by sansword'));assert(res.body.includes(saved));assert(!res.body.includes('/api/og?id='));
 console.log('PASS: saved PNG, attribution, static metadata, publication gating for admin and review');
}
main().catch(e=>{console.error(e);process.exitCode=1});
