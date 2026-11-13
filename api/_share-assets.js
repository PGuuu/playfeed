const { createHash } = require('node:crypto');
const manifest = require('../share-assets.json');
const base = 'https://oimdeoszgxfumwtmapok.supabase.co';
const ASSET_VERSION = 'v4';
function assetKey(game) {
 return createHash('sha256').update(JSON.stringify([new URL(game.url,'https://playfeed-gilt.vercel.app/').href,game.title,game.creator?.name||game.author||'Independent creator'])).digest('hex');
}
function staticAsset(game) {
 const saved=manifest[assetKey(game)];
 return saved?.startsWith('/share-cards/'+ASSET_VERSION+'/') ? saved : undefined;
}
function headers() {
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.supabase_service_role_key;
 if(!key)throw Error('Image storage unavailable');
 return {apikey:key,...(key.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+key})};
}
async function readAsset(game) {
 const r=await fetch(base+'/storage/v1/object/authenticated/playfeed-share-cards/'+ASSET_VERSION+'/'+assetKey(game)+'.png',{headers:headers(),signal:AbortSignal.timeout(3000)});
 if(!r.ok)throw Error('Saved preview unavailable');
 return Buffer.from(await r.arrayBuffer());
}
async function prepareAsset(game) {
 if(staticAsset(game))return;
 const {renderCard}=require('./_render-card');
 const image=await renderCard(game);
 const r=await fetch(base+'/storage/v1/object/playfeed-share-cards/'+ASSET_VERSION+'/'+assetKey(game)+'.png',{method:'POST',headers:{...headers(),'Content-Type':'image/png','x-upsert':'true','Cache-Control':'max-age=31536000'},body:image,signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Object.assign(Error('無法保存遊戲預覽圖，請稍後重試上架。'),{status:503});
}
module.exports={assetKey,staticAsset,readAsset,prepareAsset,ASSET_VERSION};
