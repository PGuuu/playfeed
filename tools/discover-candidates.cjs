// Discovery only: writes a local report. It never publishes or contacts the database.
const fs=require('node:fs');
const {extractMetadata}=require('../api/_source-metadata');
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node tools/discover-candidates.cjs seeds.json report.json');
const seeds=JSON.parse(fs.readFileSync(input,'utf8'));
let cursor=0;const report=[];
async function inspect(value){
 const url=new URL(value);if(url.protocol!=='https:'||!(/\.github\.io$|\.netlify\.app$/.test(url.hostname)))return;
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'PlayFeed candidate discovery'}});
  const type=r.headers.get('content-type')||'';
  if(!r.ok||!type.includes('text/html'))return report.push({url:value,status:r.status,eligible:false,reason:'Unavailable or not an HTML page'});
  const reader=r.body.getReader(),chunks=[];let size=0;
  while(true){const {value:chunk,done}=await reader.read();if(done)break;size+=chunk.byteLength;if(size>1500000){await reader.cancel();throw Error('Page too large')}chunks.push(Buffer.from(chunk));}
  const html=Buffer.concat(chunks).toString('utf8');
  const frame=r.headers.get('x-frame-options'),csp=r.headers.get('content-security-policy')||'';
  const blocked=Boolean(frame)||/frame-ancestors\s+(?!\*)([^;]+)/i.test(csp)||/http-equiv\s*=\s*["']?(?:x-frame-options)/i.test(html);
  report.push({url:r.url,discoveredFrom:value,status:r.status,eligible:!blocked,reason:blocked?'Embedding restrictions':'Candidate only; manual review required',...extractMetadata(html,r.url),language:html.match(/<html[^>]+lang=["']([^"']+)/i)?.[1]||'',canvas:/<canvas\b/i.test(html)});
 }catch(e){report.push({url:value,eligible:false,reason:e.message})}
}
(async()=>{await Promise.all(Array.from({length:3},async()=>{while(cursor<seeds.length){const item=seeds[cursor++];await inspect(item)}}));report.sort((a,b)=>seeds.indexOf(a.discoveredFrom||a.url)-seeds.indexOf(b.discoveredFrom||b.url));fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));})().catch(e=>{console.error(e);process.exitCode=1});
