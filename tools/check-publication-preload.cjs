const assert=require('node:assert/strict'),sharp=require('sharp');
const owner={id:'d28b1149fa6dc857b3086bf77acf5073',email:'paulvongulla@gmail.com'},url='https://new.game.test/',writes=[],events=[];
let fail=false;
function stub(name,exports){const id=require.resolve(name);require.cache[id]={id,filename:id,loaded:true,exports};}
stub('../api/_lib',{publicName:()=>'',safeText:v=>v,supabaseRest:async(table,options={})=>{
 if(options.method){events.push(table);writes.push({table,...options});return {ok:true,data:options.method==='POST'?[{id:'new-game',...options.body}]:[]};}
 return {ok:true,data:table==='playfeed_admins'?[{}]:table==='playfeed_requests'?[{id:'11111111-1111-4111-8111-111111111111',url,user_id:owner.id,status:'pending'}]:[]};
}});
stub('../api/_source-metadata',{sourceMetadata:async()=>({title:'New game',author:'Creator',creator_url:url})});
stub('../api/_game-preload',{preparePreload:async()=>{events.push('capture');if(fail)throw Object.assign(Error('Capture failed'),{status:503});return '/api/game-image?key='+'a'.repeat(64)}});
stub('../api/_game-preview',{savePreview:async()=>{events.push('manual')}});
const community=require('../api/_community'),waiting=require('../api/_waiting');
(async()=>{
 const cases=[screenshot=>community.post(owner,{action:'publish',url,interactionConfirmed:true,screenshot}),screenshot=>community.post(owner,{action:'review',requestId:'11111111-1111-4111-8111-111111111111',decision:'approve',interactionConfirmed:true,screenshot}),screenshot=>waiting.post(owner,{requestId:'11111111-1111-4111-8111-111111111111',decision:'publish',interactionConfirmed:true,title:'New game',author:'Creator',screenshot})];
 for(const publish of cases){writes.length=events.length=0;await publish();const row=writes.find(w=>w.table==='playfeed_recommendations'&&w.method==='POST');assert.match(row.body.preload_image_url,/^\/api\/game-image\?key=a{64}$/);assert.ok(events.indexOf('capture')<events.indexOf('playfeed_recommendations'));}
 for(const publish of cases){writes.length=events.length=0;await publish('fixture');assert.ok(events.includes('manual'));assert.ok(events.includes('capture'));assert.match(writes.find(w=>w.table==='playfeed_recommendations'&&w.method==='POST').body.preload_image_url,/^\/api\/game-image\?key=a{64}$/);}
 fail=true;writes.length=0;await assert.rejects(cases[0](),e=>e.status===503);assert.ok(!writes.some(w=>w.table==='playfeed_recommendations'));fail=false;
 const {loadPlayfeedGames}=require('../catalog');const games=await loadPlayfeedGames(async p=>p.startsWith('/playfeed_recommendations')?[{id:'new-game',title:'New game',url,preload_image_url:'/api/game-image?key='+'a'.repeat(64)}]:[],'https://playfeed-gilt.vercel.app/');
 const game=games.find(g=>g.id==='new-game');assert.ok(game.preload_image);assert.equal(game.cover,undefined);assert.equal(game.share_image,undefined);
 // Verify real helper saves the captured image without adding manual preview records.
 delete require.cache[require.resolve('../api/_game-preload')];
 const image=await sharp({create:{width:720,height:1280,channels:3,background:'#123456'}}).png().toBuffer();
 stub('../api/_capture-first-screen',{captureFirstScreen:async()=>image});process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';let stored;
 global.fetch=async(u,o)=>{stored={url:u,...o};return {ok:true}};
 const result=await require('../api/_game-preload').preparePreload({url,title:'New game'});assert.match(result,/^\/api\/game-image\?key=[a-f0-9]{64}$/);assert.ok(stored.body.equals(image));
 global.fetch=async()=>({ok:false});await assert.rejects(require('../api/_game-preload').preparePreload({url}),e=>e.status===503);
 console.log('PASS: all publication paths capture auto preloads with or without manual share screenshots; capture failures prevent incomplete publication; catalog keeps sharing separate.');
})().catch(e=>{console.error(e);process.exitCode=1});
