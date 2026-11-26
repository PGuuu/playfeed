(()=>{
 const endpoint='/api/analytics',uuid=()=>crypto.randomUUID();
 let lastViewed='',seenGame=false,playTimer=null;
 let current=null,last=performance.now(),queue=[],busy=false,ready=false,session,sessionAt=0;
 const read=(key)=>{try{return localStorage.getItem(key)}catch{return null}};
 const write=(key,value)=>{try{localStorage.setItem(key,value)}catch{}};
 const deviceKey='playfeed:analytics:device-token';
 let deviceToken=read(deviceKey)||'', startingRequest;
 function payload(body){return JSON.stringify({...body,deviceToken});}
 function visit(){
  const now=Date.now();
  if(now-sessionAt>30*60000){let stored;try{stored=JSON.parse(read('playfeed:analytics:session'))}catch{}
   session=stored&&now-stored.at<30*60000?stored.id:uuid();
  }
  sessionAt=now;write('playfeed:analytics:session',JSON.stringify({id:session,at:now}));return session;
 }
 function event(action,extra={}){
  queue.push({id:uuid(),session:visit(),action,game:current?.id||'',title:current?.title||'',entry:current?.entry||'unknown',previous:current?.previous||'',path:location.pathname,referrer:document.referrer,...extra});
  if(queue.length>200)queue.splice(0,queue.length-200);
  if(['guest_save_success','guest_unsave_success','save_sync_success','rating_success','game_expand','expanded_previous_game','expanded_next_game'].includes(action))Promise.resolve().then(flush);
 }
 function accountVisible(ms){
  if(!current||ms<=0)return;
  current.visibleMs+=ms;
  if(!current.played&&current.visibleMs>10000){current.played=true;event('game_play');Promise.resolve().then(flush);}
 }
 function schedulePlay(){
  clearTimeout(playTimer);playTimer=null;
  if(!current||current.played||document.visibilityState!=='visible')return;
  playTimer=setTimeout(()=>{elapsed();schedulePlay()},Math.max(1,10001-current.visibleMs));
 }
 function elapsed(){const now=performance.now(),ms=Math.min(60000,Math.max(0,Math.round(now-last)));last=now;if(current&&document.visibilityState==='visible'&&ms){accountVisible(ms);event('game_time',{ms});}}

 async function flush(){
  if(!ready){initialize();return;}if(busy||!queue.length)return;
  busy=true;const batch=queue.slice(0,40);let sent=false;
  try{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:payload({action:'events',events:batch}),keepalive:true});if(r.ok){sent=true;const ids=new Set(batch.map(e=>e.id));queue=queue.filter(e=>!ids.has(e.id));}}
  catch{}finally{busy=false;if(sent&&queue.length)Promise.resolve().then(flush);}
 }
 function leave(){elapsed();if(!ready)return;for(let i=0;i<queue.length;i+=40){const body=payload({action:'events',events:queue.slice(i,i+40)});navigator.sendBeacon?.(endpoint,new Blob([body],{type:'application/json'}));}}
 document.addEventListener('visibilitychange',()=>{
  // A hidden tab must close the last visible interval before pausing.
  if(document.visibilityState==='hidden'){const ms=Math.min(60000,Math.max(0,Math.round(performance.now()-last)));if(current&&ms){accountVisible(ms);event('game_time',{ms});}last=performance.now();clearTimeout(playTimer);flush();}
  else {last=performance.now();schedulePlay();}
 });
 window.addEventListener('pagehide',leave);
 window.addEventListener('pageshow',()=>{last=performance.now()});
 setInterval(()=>{elapsed();flush()},15000);
 function initialEntry(){
  if(performance.getEntriesByType?.('navigation')?.[0]?.type==='reload')return 'reload';
  try{const ref=new URL(document.referrer);if(ref.origin===location.origin)return ref.pathname==='/account.html'?'saved_selection':'internal_selection';return 'external_entry';}catch{}
  return location.pathname.startsWith('/g/')||location.hash||new URLSearchParams(location.search).has('id')?'direct_entry':'feed_initial';
 }
 window.PlayFeedAnalytics={event,setGame(game,entry){
  elapsed();clearTimeout(playTimer);
  if(!game){current=null;last=performance.now();return;}
  const source=entry||(!seenGame?initialEntry():'internal_selection');
  current={id:String(game.id),title:String(game.title),entry:source,previous:seenGame?lastViewed:'',visibleMs:0,played:false};
  seenGame=true;lastViewed=current.id;last=performance.now();event('game_view');flush();schedulePlay();
 },async flush(){
   // Wait for initialization and an existing batch before sending newly queued events.
   await initialize();
   for(let attempt=0;attempt<100&&(!ready||busy);attempt++)await new Promise(resolve=>setTimeout(resolve,50));
   if(!ready||busy)return false;
   await flush();return queue.length===0;
 }};
 event('page_view',{game:'',title:''});
 function initialize(){
  if(ready)return Promise.resolve(true);
  if(startingRequest)return startingRequest;
  const existing=window.PlayFeedDeviceReady;
  startingRequest=(async()=>{
   await existing;
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:payload({action:'init'})});
   if(!response.ok)return false;
   const data=await response.json();
   deviceToken=data.deviceToken||'';
   if(deviceToken)write(deviceKey,deviceToken);
   ready=Boolean(deviceToken);
   if(ready)flush();
   return ready;
  })().catch(()=>false).finally(()=>{startingRequest=null;});
  window.PlayFeedDeviceReady=startingRequest;
  return startingRequest;
 }
 const boot=initialize();
 let identified='';
 window.PlayFeedAuth?.onChange(user=>{
  const token=window.PlayFeedAuth.token;
  if(!user||!token||identified===token)return;identified=token;
  // Authenticated identity is checked only on login, never on each heartbeat.
  boot.then(ok=>ok&&fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:payload({action:'identify'})})).catch(()=>{identified=''});
 });
 const clicks=[['[data-kind="saved"]','save_click'],['.comments-button','source_open'],['.share','share_click'],['.byline','creator_open'],['.account-link','account_open'],['.search-button','search_open'],['.search-results a','search_select'],['.game-more','menu_open'],['#open-report','report_open'],['.recommend-button','recommend_open'],['a[href="/submit.html"]','recommend_open'],['#edit-profile','settings_open']];
 document.addEventListener('click',e=>{const target=e.target instanceof Element?e.target:null;if(!target)return;for(const [selector,action]of clicks)if(target.closest(selector)){event(action);break;}},true);
 // Deliberately do not inspect iframe contents or record input/search/comment text.
})();
