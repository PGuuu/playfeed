const assert=require('node:assert/strict'),sharp=require('sharp');
const lib=require.resolve('../api/_lib'),writes=[],uploads=[];
require.cache[lib]={id:lib,filename:lib,loaded:true,exports:{supabaseRest:async(table,options)=>{writes.push(options.body);return {ok:true};}}};
process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';global.fetch=async(url,options)=>{uploads.push({url,body:options.body});return {ok:true}};
const {savePreview}=require('../api/_game-preview');
(async()=>{
 const red=await sharp({create:{width:400,height:500,channels:3,background:'red'}}).png().toBuffer();
 const blue=await sharp({create:{width:400,height:500,channels:3,background:'blue'}}).png().toBuffer();
 const original=await sharp({create:{width:400,height:1000,channels:3,background:'white'}}).composite([{input:red,top:0,left:0},{input:blue,top:500,left:0}]).png().toBuffer();
 const image='data:image/png;base64,'+original.toString('base64'),user={id:'fixture'};
 const top=await savePreview('https://game.test/',image,user,{x:.5,y:0,zoom:1});
 const bottom=await savePreview('https://game.test/',image,user,{x:.5,y:1,zoom:1});
 assert.equal(top.image,bottom.image);assert.notEqual(top.shareImage,bottom.shareImage);
 for(const i of [1,3]){const m=await sharp(uploads[i].body).metadata();assert.equal(m.width,1200);assert.equal(m.height,630);}
 const pixel=async buffer=>Array.from(await sharp(buffer).extract({left:600,top:315,width:1,height:1}).removeAlpha().raw().toBuffer());
 assert.deepEqual(await pixel(uploads[1].body),[255,0,0]);assert.deepEqual(await pixel(uploads[3].body),[0,0,255]);
 assert.equal(writes.at(-1).focus_y,1);assert.equal(writes.at(-1).share_image_url,bottom.shareImage);
 const catalog=require.resolve('../catalog');require.cache[catalog]={id:catalog,filename:catalog,loaded:true,exports:{loadPlayfeedGames:async()=>[{id:'fixture',title:'Game',author:'Creator',url:'https://game.test/',preview_image:bottom.image,share_image:bottom.shareImage,preview_width:400,preview_height:1000}]}};
 function response(){return {headers:{},status(code){this.code=code;return this},setHeader(key,value){this.headers[key]=value},send(body){this.body=body;return this},end(){return this}}}
 const res=response();await require('../api/share')({method:'GET',query:{id:'fixture'}},res);
 assert.ok(res.body.includes('content="https://playfeed-gilt.vercel.app'+bottom.shareImage+'"'));assert.match(res.body,/og:image:width" content="1200"/);assert.match(res.body,/og:image:height" content="630"/);
 const og=response();await require('../api/og')({method:'GET',query:{id:'fixture'}},og);assert.equal(og.headers.Location,'https://playfeed-gilt.vercel.app'+bottom.shareImage);
 console.log('PASS: exact 1200×630 output, top/bottom focus changes shared pixels and URL, full loading image stays intact.');
})().catch(e=>{console.error(e);process.exitCode=1});
