const crypto=require('node:crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function secret(){const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.supabase_service_role_key;if(!key)throw Error('Analytics unavailable');return key;}
function signature(id){return crypto.createHmac('sha256',secret()).update('playfeed-analytics-device:'+id).digest('hex');}
function deviceId(req,res,create=true){
 const match=String(req.headers.cookie||'').match(/(?:^|;\s*)pf_device=([^;]+)/);
 if(match){const [id,sig]=match[1].split('.');if(UUID.test(id)&&/^[a-f0-9]{64}$/.test(sig||'')&&crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(signature(id))))return id;}
 if(!create)return null;
 const id=crypto.randomUUID();res.setHeader('Set-Cookie',`pf_device=${id}.${signature(id)}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`);return id;
}
function deviceInfo(req){
 const ua=String(req.headers['user-agent']||'');
 return {family:/iPhone/i.test(ua)?'iPhone':/iPad/i.test(ua)?'iPad':/Android/i.test(ua)?'Android':/Macintosh/i.test(ua)?'Mac':'Windows / Desktop',browser:/Edg\//.test(ua)?'Edge':/CriOS|Chrome\//.test(ua)?'Chrome':/FxiOS|Firefox\//.test(ua)?'Firefox':/Safari\//.test(ua)?'Safari':'Other',is_bot:/bot|crawler|spider|headless|facebookexternalhit|preview|slurp/i.test(ua)};
}
module.exports={deviceId,deviceInfo};
