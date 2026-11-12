const fs=require('node:fs');
const {loadPlayfeedGames}=require('./catalog');
const {renderCard}=require('./api/_render-card');
const {assetKey}=require('./api/_share-assets');
async function main(){
 const games=await loadPlayfeedGames(async resource=>{
  const r=await fetch('https://oimdeoszgxfumwtmapok.supabase.co/rest/v1'+resource,{headers:{apikey:'sb_publishable_ZovEIH8JuRiKuf24MTIKLg_sz2Tnui8'}});
  if(!r.ok)throw Error('Catalog unavailable');return r.json();
 },'https://playfeed-gilt.vercel.app/');
 fs.mkdirSync('share-cards/v3',{recursive:true});
 const manifest=JSON.parse(fs.readFileSync('share-assets.json'));
 const failures=[];
 let next=0;
 await Promise.all(Array.from({length:4},async()=>{while(next<games.length){
  const game=games[next++];const key=assetKey(game);
  if(manifest[key]&&fs.existsSync('.'+manifest[key]))continue;
  console.log('START',game.id);
  try{const image=await renderCard(game);const file='/share-cards/v3/'+key+'.png';fs.writeFileSync('.'+file,image);manifest[key]=file;fs.writeFileSync('share-assets.json',JSON.stringify(manifest,null,2));console.log('OK',game.id,image.length);}
  catch(e){failures.push(game.id);console.log('FAILED',game.id,e.message);}
 }}));
 fs.writeFileSync('share-assets-status.json',JSON.stringify({total:games.length,ready:Object.keys(manifest).length,failures}));
 if(failures.length)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1});
