const https = require('node:https');
const dns = require('node:dns');
function publicAddress(ip) {
 const p=ip.split('.').map(Number);
 return p.length===4 && ![0,10,127].includes(p[0]) && p[0]<224 && !(p[0]===169&&p[1]===254) && !(p[0]===172&&p[1]>=16&&p[1]<=31) && !(p[0]===192&&(p[1]===168||p[1]===0)) && !(p[0]===100&&p[1]>=64&&p[1]<=127) && !(p[0]===198&&(p[1]===18||p[1]===19));
}
function readPage(value, redirects=0) {
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.port||redirects>3) return Promise.reject(Error('Invalid metadata URL'));
 return new Promise((resolve,reject)=>{
  const request=https.get(url,{headers:{'User-Agent':'PlayFeed metadata reader','Accept':'text/html','Accept-Encoding':'identity'},lookup(host,options,callback){dns.lookup(host,{family:4},(error,address)=>{
   if(error)return callback(error);
   if(!publicAddress(address))return callback(Error('Private metadata address'));
   callback(null,options.all?[{address,family:4}]:address,4);
  });}},response=>{
   if([301,302,303,307,308].includes(response.statusCode)){response.resume();return readPage(new URL(response.headers.location,url),redirects+1).then(resolve,reject);}
   if(response.statusCode!==200){response.resume();return reject(Error('Metadata unavailable'));}
   let size=0;const chunks=[];
   response.on('data',chunk=>{size+=chunk.length;if(size>1500000)request.destroy(Error('Metadata too large'));else chunks.push(chunk)});
   response.on('end',()=>resolve({html:Buffer.concat(chunks).toString('utf8'),url:url.href}));
   response.on('error',reject);
  });
  const timer=setTimeout(()=>request.destroy(Error('Metadata timeout')),5000);
  request.on('close',()=>clearTimeout(timer));request.on('error',reject);
 });
}
function clean(value,max=160){return String(value||'').replace(/<[^>]*>/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return code>0&&code<=0x10ffff?String.fromCodePoint(code):''}).replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim().slice(0,max);}
function extractMetadata(html,url){
 const meta={};
 for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){const attrs={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))attrs[m[1].toLowerCase()]=m[2]??m[3]??m[4];const key=attrs.name||attrs.property;if(key)meta[key.toLowerCase()]=attrs.content;}
 let author=clean(meta.author||meta['dc.creator']);let creator_url=url;
 for(const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{const visit=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node))return node.forEach(visit);const person=node.author||node.creator;const item=Array.isArray(person)?person[0]:person;if(!author&&item){author=clean(typeof item==='string'?item:item.name);try{const u=new URL(item.url,url);if(u.protocol==='https:')creator_url=u.href}catch{}};if(node['@graph'])visit(node['@graph'])};visit(JSON.parse(match[1]));}catch{}
 }
 const text=html.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,'\n');
 if(!author)author=clean(text.match(/(?:遊戲製作|製作|開發|Created|Developed)\s*(?:BY|by|：|:)\s*([^\n<>]{1,100})/i)?.[1]);
 return {title:clean(meta['og:title']||html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],300)||new URL(url).hostname,author:author||'來源：'+new URL(url).hostname,creator_url};
}
async function sourceMetadata(url){try{const page=await readPage(url);return extractMetadata(page.html,page.url)}catch{return {title:new URL(url).hostname,author:'來源：'+new URL(url).hostname,creator_url:url}}}
module.exports={sourceMetadata,extractMetadata,publicAddress};
