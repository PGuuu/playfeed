const {supabaseRest,safeText,verifyPhuzeSession}=require('./_lib');
const {deviceId,deviceInfo}=require('./_device');
const rates=new Map();
function key(value){let url;try{url=new URL(value)}catch{}if(!url||!['https:','http:'].includes(url.protocol)||url.username||url.password||url.href.length>500)throw Object.assign(Error('遊戲網址無效。'),{status:400});return url.href}
async function user(req){if(!req.headers.authorization)return null;const auth=await verifyPhuzeSession(req);if(!auth.user)throw Object.assign(Error('登入已失效，請重新登入。'),{status:auth.error?.status||401});return auth.user}
async function rpc(name,body){const result=await supabaseRest('rpc/'+name,{method:'POST',body});if(!result.ok)throw Error('Ratings unavailable');return result.data}
async function get(req){
 let identity=null;
 if(req.headers.authorization)try{identity=(await verifyPhuzeSession(req)).user}catch{}
 return rpc('playfeed_game_rating_summary',{p_game_key:key(req.query?.gameKey),p_device_id:deviceId(req,null,false),p_user_id:identity?.id||null});
}
async function post(req,res,body){
 const game=key(body.gameKey),stars=body.stars;
 if(!Number.isInteger(stars)||stars<1||stars>3)throw Object.assign(Error('請選擇 1 至 3 顆星。'),{status:400});
 const review=safeText(body.body,{name:'評語',min:1,max:1000}),identity=await user(req),id=deviceId(req,res),minute=Math.floor(Date.now()/60000),previous=rates.get(id),count=previous?.minute===minute?previous.count+1:1;
 rates.set(id,{minute,count});if(rates.size>5000)for(const [key,value]of rates)if(value.minute<minute)rates.delete(key);
 if(count>20)throw Object.assign(Error('評分送出太頻繁，請稍後再試。'),{status:429});
 const info=deviceInfo(req),device=await supabaseRest('playfeed_analytics_devices',{method:'POST',query:'on_conflict=id',body:{id,family:info.family,browser:info.browser},prefer:'resolution=ignore-duplicates,return=minimal'});
 if(!device.ok)throw Error('Ratings unavailable');
 const name=identity?(await require('./_community').profileFor(identity)).display_name:'訪客';
 await rpc('playfeed_rate_game',{p_game_key:game,p_device_id:id,p_user_id:identity?.id||null,p_name:name,p_stars:stars,p_body:review});
 return rpc('playfeed_game_rating_summary',{p_game_key:game,p_device_id:id,p_user_id:identity?.id||null});
}
module.exports={get,post};
