const assert = require('node:assert/strict');
process.env.PHUZE_SECRET_KEY = 'sk_fixture';
function directory() { delete require.cache[require.resolve('../api/_email-links')]; return require('../api/_email-links').emailLinks; }
const user = (uid,email) => ({uid,email,first_seen_at:'2026-11-12T08:00:00Z',last_active_at:'2026-11-14T08:00:00Z',login_count:2});
(async()=>{
 let calls = 0;
 global.fetch = async (url,options) => {
  calls++; assert.equal(options.headers.Authorization,'Secret sk_fixture');
  assert.equal(url.origin,'https://phuze.edato.me'); assert.equal(url.searchParams.get('limit'),'25');
  return {ok:true,json:async()=>calls===1
   ? {users:[user('u_owner','paulvongulla@gmail.com'),user('u_no_profile','player@example.test')],next_cursor:'u_no_profile'}
   : {users:[user('u_no_profile','player@example.test'),user('u_earlier','other@example.test')],next_cursor:null}};
 };
 const read=directory(); const [a,b]=await Promise.all([read(),read()]);
 assert.equal(a.total,3); assert.equal(a.owners,1); assert.equal(b,a); assert.equal(calls,2);
 assert(a.users.some(row=>row.uid==='u_no_profile')); await read(); assert.equal(calls,2);
 global.fetch=async()=>({ok:false,status:503}); await assert.rejects(directory()());
 global.fetch=async()=>({ok:true,json:async()=>({users:[],next_cursor:'repeat'})}); await assert.rejects(directory()());
 global.fetch=async()=>({ok:true,json:async()=>({users:[]})}); await assert.rejects(directory()());
 const lib=require('../api/_lib');
 const original=lib.supabaseRest; const tables=[];
 lib.supabaseRest=async(table)=>{tables.push(table);return {ok:true,count:table==='playfeed_profiles'?99:tables.length===1?12:4}};
 delete require.cache[require.resolve('../api/_impact-summary')];
 const impact=await require('../api/_impact-summary').impactSummary();
 assert.deepEqual(impact,{externalSaves:12,externalShares:4});assert(!tables.includes('playfeed_profiles'));
 lib.supabaseRest=original;
 console.log('PASS: full paginated directory includes users without profiles; UID deduplication; owner flag; cache; provider/pagination errors never produce partial counts; save/share counts preserved.');
})().catch(error=>{console.error(error);process.exit(1)});
