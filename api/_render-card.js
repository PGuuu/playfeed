const origin = 'https://playfeed-gilt.vercel.app';
const el = (type, style, children, props = {}) => ({ type, props: { ...props, style, children } });
function card(game, image) {
 const title=Array.from(String(game.title)).slice(0,72).join('');
 const author=String(game.creator?.name || game.author || 'Independent creator').slice(0,100);
 const left=el('div',{display:'flex',flexDirection:'column',width:720,height:630,padding:'48px 52px',justifyContent:'space-between'},[
  el('div',{color:'#d6fb65',fontSize:32,fontWeight:700},'PlayFeed'),
  el('div',{display:'flex',flexDirection:'column',gap:24},[
   el('div',{fontSize:title.length>36?44:56,fontWeight:700,lineHeight:1.25,overflow:'hidden',maxHeight:300},title),
   el('div',{fontSize:28,color:'#d6fb65',lineHeight:1.4,maxHeight:80,overflow:'hidden'},'by '+author)
  ]),
  el('div',{color:'#b2b2bf',fontSize:22},'playfeed-gilt.vercel.app')
 ]);
 const right=el('div',{display:'flex',width:480,height:630,padding:'24px 24px 24px 0'},[
  image?el('img',{width:456,height:582,objectFit:'cover',objectPosition:'top',borderRadius:22},undefined,{src:image}):el('div',{display:'flex',alignItems:'center',justifyContent:'center',width:456,height:582,borderRadius:22,background:'linear-gradient(145deg,#283832,#242535)',color:'#d6fb65',fontSize:76},'PLAY')
 ]);
 return el('div',{display:'flex',width:1200,height:630,background:'#101014',color:'#faf8f2',fontFamily:'Noto Sans TC'},[left,right]);
}
async function fontFor(text){
 const css=await fetch('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@700&text='+encodeURIComponent(text),{signal:AbortSignal.timeout(10000)}).then(r=>r.text());
 const resource=css.match(/src:\s*url\(([^)]+)\)\s*format\(['"](?:opentype|truetype)['"]\)/);
 if(!resource)throw Error('Font unavailable');
 const response=await fetch(resource[1],{signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('Font unavailable');
 return response.arrayBuffer();
}
async function screenshotFor(game){
 // Only contact the fixed screenshot provider; never fetch a submitted URL server-side.
 const url=new URL(game.url,origin+'/');
 if(!['https:','http:'].includes(url.protocol))return null;
 const response=await fetch('https://image.thum.io/get/noanimate/width/600/maxAge/168/?url='+encodeURIComponent(url.href),{signal:AbortSignal.timeout(25000),redirect:'error'});
 const type=(response.headers.get('content-type')||'').split(';')[0];
 if(!response.ok||!['image/png','image/jpeg','image/webp'].includes(type))return null;
 const chunks=[];let size=0;
 for await(const chunk of response.body){size+=chunk.length;if(size>4000000)throw Error('Image too large');chunks.push(chunk);}
 return 'data:'+type+';base64,'+Buffer.concat(chunks).toString('base64');
}
async function renderCard(game){
 const {ImageResponse}=await import('@vercel/og');
 const author=game.creator?.name||game.author||'Independent creator';
 const [image,font]=await Promise.all([screenshotFor(game),fontFor(game.title+'by '+author+'PlayFeedplayfeed-gilt.vercel.appPLAY')]);
 if(!image)throw Object.assign(Error('無法取得遊戲截圖，請稍後重試上架。'),{status:503});
 return Buffer.from(await new ImageResponse(card(game,image),{width:1200,height:630,fonts:[{name:'Noto Sans TC',data:font,weight:700,style:'normal'}]}).arrayBuffer());
}
module.exports={renderCard,card};
