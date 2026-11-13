const origin = 'https://playfeed-gilt.vercel.app';
const WIDTH = 720, HEIGHT = 1280;
function card(game, image) {
 return {type:'div',props:{style:{display:'flex',width:WIDTH,height:HEIGHT,background:'#fff7eb'},children:{type:'img',props:{src:image,style:{width:WIDTH,height:HEIGHT,objectFit:'cover',objectPosition:'top'}}}}};
}
async function screenshotFor(game){
 // Only contact the fixed screenshot provider; never fetch a submitted URL server-side.
 const url=new URL(game.url,origin+'/');
 if(!['https:','http:'].includes(url.protocol))return null;
 const cropHeight=Math.ceil(1200*HEIGHT/WIDTH);
 const response=await fetch('https://image.thum.io/get/noanimate/width/'+WIDTH+'/crop/'+cropHeight+'/maxAge/168/?url='+encodeURIComponent(url.href),{signal:AbortSignal.timeout(25000),redirect:'error'});
 const type=(response.headers.get('content-type')||'').split(';')[0];
 if(!response.ok||!['image/png','image/jpeg','image/webp'].includes(type))return null;
 const chunks=[];let size=0;
 for await(const chunk of response.body){size+=chunk.length;if(size>4000000)throw Error('Image too large');chunks.push(chunk);}
 return 'data:'+type+';base64,'+Buffer.concat(chunks).toString('base64');
}
async function renderCard(game){
 const {ImageResponse}=await import('@vercel/og');
 const image=await screenshotFor(game);
 if(!image)throw Object.assign(Error('無法取得遊戲截圖，請稍後重試上架。'),{status:503});
 return Buffer.from(await new ImageResponse(card(game,image),{width:WIDTH,height:HEIGHT}).arrayBuffer());
}
module.exports={renderCard,card,WIDTH,HEIGHT};
