(() => {
 const KEY='playfeed:guest-saves:v1';
 let syncing=null,merging=null,lastError='';
 const keyFor=value=>new URL(typeof value==='string'?value:value.url,location.origin+'/').href;
 function deviceReady(){
  if(!window.PlayFeedDeviceReady)window.PlayFeedDeviceReady=fetch('/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'init'}),signal:AbortSignal.timeout(15000)}).then(r=>r.ok).catch(()=>false);
  return window.PlayFeedDeviceReady;
 }
 function read(){try{const value=JSON.parse(localStorage.getItem(KEY)||'null');return value&&value.entries&&value.pending?value:{entries:{},pending:{}}}catch{return {entries:{},pending:{}}}}
 function write(value){try{localStorage.setItem(KEY,JSON.stringify(value))}catch{throw Error('此瀏覽器無法保存收藏，請允許網站儲存資料後再試。')}}
 function changed(reason){window.dispatchEvent(new CustomEvent('playfeed:saves-change',{detail:{reason}}))}
 function list(){return Object.values(read().entries)}
 function has(game){return Boolean(read().entries[keyFor(game)])}
 function set(game,active){
  const state=read(),key=keyFor(game);
  if(active){if(!state.entries[key]&&Object.keys(state.entries).length>=500)throw Error('此瀏覽器已收藏 500 款遊戲，請先登入備份。');state.entries[key]={id:game.id,title:game.title,url:key,cover:game.cover,savedAt:crypto.randomUUID()}}
  else delete state.entries[key];
  state.pending[key]={active,revision:crypto.randomUUID()};write(state);
  window.PlayFeedAnalytics?.event(active?'guest_save_success':'guest_unsave_success',{game:game.id,title:game.title});
  changed('local');
  sync();return active;
 }
 async function sync(){
  if(syncing)return syncing;
  if(window.PlayFeedAuth?.user||window.PlayFeedAuth?.checking)return;
  syncing=(async()=>{
   while(!window.PlayFeedAuth?.user){
    const batch=Object.entries(read().pending).slice(0,32);if(!batch.length)break;
    try{
     if(!await deviceReady()){window.PlayFeedDeviceReady=null;break}
     const response=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),body:JSON.stringify({action:'guest-save',changes:batch.map(([gameKey,value])=>({gameKey,active:value.active}))})});
     if(!response.ok)break;
     const state=read();for(const [key,value]of batch)if(state.pending[key]?.revision===value.revision)delete state.pending[key];write(state);changed('synced');
    }catch{break}
   }
  })();try{await syncing}finally{syncing=null}
 }
 async function merge(){
  if(merging)return merging;
  if(!window.PlayFeedAuth?.user)return true;
  const snapshot=read();if(!Object.keys(snapshot.entries).length&&!Object.keys(snapshot.pending).length)return true;
  const userId=PlayFeedAuth.user.id;
  merging=(async()=>{
   try{
    await syncing;
    if(!await deviceReady()){window.PlayFeedDeviceReady=null;throw Error('Device initialization unavailable')}
    await PlayFeedAuth.api('/api/account',{method:'POST',body:JSON.stringify({action:'merge-saves',gameKeys:Object.keys(snapshot.entries)})});
    if(PlayFeedAuth.user?.id!==userId)return false;
    const state=read();for(const [key,value]of Object.entries(snapshot.entries))if(state.entries[key]?.savedAt===value.savedAt)delete state.entries[key];
    for(const [key,value]of Object.entries(snapshot.pending))if(state.pending[key]?.revision===value.revision)delete state.pending[key];
    write(state);lastError='';PlayFeedAuth.takeCollection?.();
    for(const game of Object.values(snapshot.entries))window.PlayFeedAnalytics?.event('save_sync_success',{game:game.id,title:game.title});
    changed('merged');return true;
   }catch{lastError='瀏覽器收藏仍保留，同步暫時未完成，稍後會再試。';changed('merge-error');return false}
  })();try{return await merging}finally{merging=null}
 }
 window.PlayFeedSaves={list,has,set,sync,merge,get error(){return lastError}};
 window.addEventListener('storage',event=>{if(event.key===KEY)changed('storage')});
 window.addEventListener('online',()=>{PlayFeedAuth.user?merge():sync()});
 window.addEventListener('focus',()=>{PlayFeedAuth.user?merge():sync()});
 setInterval(()=>{PlayFeedAuth.user?merge():sync()},30000);
 PlayFeedAuth.onChange(user=>{user?merge():sync()});
})();
