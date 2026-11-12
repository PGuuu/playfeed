const assert=require('node:assert/strict');
const handler=require('../api/login');
let fetches=0;
global.fetch=async(url,options)=>{
 fetches++;
 assert.ok(url.startsWith('https://phuze.edato.me/api/v1/'));
 assert.equal(options.headers.Origin,'https://playfeed.test');
 assert.ok(options.headers.Authorization.startsWith('Publishable '));
 if(url.endsWith('/auth/magic-link')){
  const body=JSON.parse(options.body);
  assert.equal(body.redirect_url,'https://playfeed.test/account.html');
  assert.equal(body.email,'test@example.com');
 }
 return {ok:true,status:200,headers:{get:()=>null},json:async()=>({message:'Sent'})};
};
async function call(body,origin='https://playfeed.test'){
 let status,payload;
 const req={method:'POST',headers:{host:'playfeed.test',origin},body};
 const res={status(value){status=value},setHeader(){},send(value){payload=JSON.parse(value)}};
 await handler(req,res);return {status,payload};
}
(async()=>{
 const pendingId='00000000-0000-4000-8000-000000000001';
 assert.equal((await call({action:'send',email:'test@example.com',pendingId})).status,200);
 assert.equal((await call({action:'send',email:'test@example.com',pendingId},'https://evil.example')).status,403);
 assert.equal((await call({action:'send',email:'test@example.com',pendingId},null)).status,403);
 assert.equal((await call({action:'pickup',pendingId:'guessable'})).status,400);
 assert.equal((await call({action:'unknown',url:'https://evil.example'})).status,400);
 assert.equal(fetches,1);
 console.log('PASS: fixed Phuze upstream, same-origin protection, valid pending UUID, controlled redirect, invalid actions blocked');
})().catch(error=>{console.error(error);process.exit(1)});
