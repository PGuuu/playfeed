const assert=require('node:assert/strict');
process.env.PHUZE_SECRET_KEY='sk_test_fixture';
const {verifyPhuzeSession}=require('../api/_lib');
const request={headers:{authorization:'Bearer st_test_fixture'}};
(async()=>{
 global.fetch=async()=>({ok:true,status:200,json:async()=>({valid:true,uid:'u_fixture',email:'test@example.com'})});
 assert.deepEqual((await verifyPhuzeSession(request)).user,{id:'u_fixture',email:'test@example.com'});
 global.fetch=async()=>({ok:true,status:200,json:async()=>({valid:false,reason:'expired'})});
 assert.equal((await verifyPhuzeSession(request)).error.status,401);
 for(const status of [403,429,500]){
  global.fetch=async()=>({ok:false,status,json:async()=>({error:{message:'Provider error'}})});
  assert.equal((await verifyPhuzeSession(request)).error.status,status===429?429:502);
 }
 global.fetch=async()=>{throw Error('Offline')};
 assert.equal((await verifyPhuzeSession(request)).error.status,502);
 console.log('PASS: verified identity, expired token rejection, provider errors preserve login, offline handling');
})().catch(error=>{console.error(error);process.exit(1)});
