(()=>{
 const endpoint='/api/analytics',uuid=()=>crypto.randomUUID();
 let current=null,last=performance.now(),queue=[],busy=false,ready=false,starting=false,session,sessionAt=0;
 const read=(key)=>{try{return localStorage.getItem(key)}catch{return null}};
 const write=(key,value)=>{try{localStorage.setItem(key,value)}catch{}};
 function visit(){
  const now=Date.now();
  if(now-sessionAt>30*60000){let stored;try{stored=JSON.parse(read('playfeed:analytics:session'))}catch{}
   session=stored&&now-stored.at<30*60000?stored.id:uuid();
  }
  sessionAt=now;write('playfeed:analytics:session',JSON.stringify({id:session,at:now}));return session;
 }
 function event(action,extra={}){
  queue.push({id:uuid(),session:visit(),action,game:current?.id||'',title:current?.title||'',path:location.pathname,referrer:document.referrer,...extra});
  if(queue.length>200)queue.splice(0,queue.length-200);
 }
 function elapsed(){const now=performance.now(),ms=Math.min(60000,Math.max(0,Math.round(now-last)));last=now;if(current&&document.visibilityState==='visible'&&ms)event('game_time',{ms});}
 async function flush(){
  if(!ready){initialize();return;}if(busy||!queue.length)return;
  busy=true;const batch=queue.slice(0,40);
  try{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'events',events:batch}),keepalive:true});if(r.ok){const ids=new Set(batch.map(e=>e.id));queue=queue.filter(e=>!ids.has(e.id));}}
  catch{}finally{busy=false;}
 }
 function leave(){elapsed();if(!ready)return;for(let i=0;i<queue.length;i+=40){const body=JSON.stringify({action:'events',events:queue.slice(i,i+40)});navigator.sendBeacon?.(endpoint,new Blob([body],{type:'application/json'}));}}
 document.addEventListener('visibilitychange',()=>{
  // A hidden tab must close the last visible interval before pausing.
  if(document.visibilityState==='hidden'){const ms=Math.min(60000,Math.max(0,Math.round(performance.now()-last)));if(current&&ms)event('game_time',{ms});last=performance.now();flush();}
  else last=performance.now();
 });
 window.addEventListener('pagehide',leave);
 window.addEventListener('pageshow',()=>{last=performance.now()});
 setInterval(()=>{elapsed();flush()},15000);
 window.PlayFeedAnalytics={event,setGame(game){elapsed();current=game?{id:String(game.id),title:String(game.title)}:null;last=performance.now();if(current){event('game_view');flush();}},flush};
 event('page_view',{game:'',title:''});
 async function initialize(){if(starting)return;starting=true;try{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'init'})});ready=r.ok;if(ready)flush();}catch{}finally{starting=false}}
 const boot=initialize();
 let identified='';
 window.PlayFeedAuth?.onChange(user=>{
  const token=window.PlayFeedAuth.token;
  if(!user||!token||identified===token)return;identified=token;
  // Authenticated identity is checked only on login, never on each heartbeat.
  boot.then(()=>fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action:'identify'})})).catch(()=>{identified=''});
 });
 const clicks=[['[data-kind="saved"]','save_click'],['.comments-button','comments_open'],['.share','share_click'],['.byline','creator_open'],['.account-link','account_open'],['.search-button','search_open'],['.search-results a','search_select'],['#previous-game','previous_game'],['#next-game','next_game'],['.game-more','menu_open'],['#open-report','report_open'],['.recommend-button','recommend_open'],['a[href="/submit.html"]','recommend_open'],['#edit-profile','settings_open']];
 document.addEventListener('click',e=>{const target=e.target instanceof Element?e.target:null;if(!target)return;for(const [selector,action]of clicks)if(target.closest(selector)){event(action);break;}},true);
 // Deliberately do not inspect iframe contents or record input/search/comment text.
})();
