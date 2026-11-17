const {createHash}=require('node:crypto');
const {supabaseRest}=require('./_lib');
const base='https://oimdeoszgxfumwtmapok.supabase.co';
function headers(){
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.supabase_service_role_key;
 if(!key)throw Object.assign(Error('圖片儲存暫時無法使用。'),{status:503});
 return {apikey:key,...(key.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+key})};
}
async function savePreview(url,image,user){
 if(typeof image!=='string'||image.length>2000000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(image))throw Object.assign(Error('請選擇有效的截圖（最大 1.5 MB）。'),{status:400});
 let buffer,info;
 try{
  ({data:buffer,info}=await require('sharp')(Buffer.from(image.split(',')[1],'base64'),{limitInputPixels:20000000,animated:false}).rotate().resize({width:1280,height:1280,fit:'inside',withoutEnlargement:true}).png().toBuffer({resolveWithObject:true}));
  if(info.width<100||info.height<100)throw Error('too small');
 }catch{throw Object.assign(Error('無法讀取這張截圖，請重新選擇。'),{status:400});}
 const key=createHash('sha256').update(url).update(buffer).digest('hex');
 const response=await fetch(base+'/storage/v1/object/playfeed-share-cards/screenshots/'+key+'.png',{method:'POST',headers:{...headers(),'Content-Type':'image/png','x-upsert':'true'},body:buffer,signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Object.assign(Error('截圖未儲存，請稍後再試。'),{status:503});
 const preview={game_url:url,image_url:'/api/game-image?key='+key,width:info.width,height:info.height,updated_by:user.id,updated_at:new Date().toISOString()};
 const saved=await supabaseRest('playfeed_game_previews',{method:'POST',query:'on_conflict=game_url',body:preview,prefer:'resolution=merge-duplicates,return=minimal'});
 if(!saved.ok)throw Object.assign(Error('截圖未儲存，請稍後再試。'),{status:503});
 return {image:preview.image_url,width:info.width,height:info.height};
}
async function readPreview(key){
 const response=await fetch(base+'/storage/v1/object/authenticated/playfeed-share-cards/screenshots/'+key+'.png',{headers:headers(),signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw Object.assign(Error('Image unavailable'),{status:response.status===404?404:503});
 return Buffer.from(await response.arrayBuffer());
}
module.exports={savePreview,readPreview};
