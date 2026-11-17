const {createHash}=require('node:crypto');
async function preparePreload(game){
 // Reuse the existing publication capture; the loading URL is stored separately.
 const image=await require('./_share-assets').prepareAsset(game)||await require('./_render-card').renderCard(game);
 const metadata=await require('sharp')(image,{limitInputPixels:20000000}).metadata();
 if(!metadata.width||!metadata.height)throw Object.assign(Error('無法取得預載入截圖，請重試。'),{status:503});
 const url=new URL(game.url,'https://playfeed-gilt.vercel.app/').href;
 const key=createHash('sha256').update(url).update(image).digest('hex');
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.supabase_service_role_key;
 if(!secret)throw Object.assign(Error('預載入圖片儲存暫時無法使用。'),{status:503});
 const response=await fetch('https://oimdeoszgxfumwtmapok.supabase.co/storage/v1/object/playfeed-share-cards/screenshots/'+key+'.png',{
  method:'POST',headers:{apikey:secret,...(secret.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+secret}),'Content-Type':'image/png','x-upsert':'true'},body:image,signal:AbortSignal.timeout(10000)
 });
 if(!response.ok)throw Object.assign(Error('預載入截圖尚未儲存，請重試上架。'),{status:503});
 return '/api/game-image?key='+key;
}
module.exports={preparePreload};
