(()=>{
 const $=s=>document.querySelector(s),status=$('#status');let version=0;
 const labels={page_view:'頁面瀏覽',game_view:'切入遊戲',game_time:'停留時間',save_click:'按儲存',save_success:'儲存成功',unsave_success:'取消儲存',comments_open:'開啟留言',comment_success:'留言成功',share_click:'按分享',share_success:'分享／複製完成',report_open:'開啟檢舉',report_success:'檢舉成功',creator_open:'查看作者',account_open:'開啟會員頁',search_open:'開啟搜尋',search_select:'選擇搜尋結果',previous_game:'上一款',next_game:'下一款',menu_open:'遊戲選單',recommend_open:'開啟推薦',recommend_success:'推薦送出',login_open:'開啟登入',external_open:'開啟外部網站',settings_open:'個人設定'};
 const number=n=>Number(n||0).toLocaleString('zh-TW');
 function duration(ms){const s=Math.round(Number(ms||0)/1000);return s>=3600?`${Math.floor(s/3600)} 小時 ${Math.floor(s%3600/60)} 分`:s>=60?`${Math.floor(s/60)} 分 ${s%60} 秒`:`${s} 秒`;}
 async function api(action,body={}){return PlayFeedAuth.api('/api/analytics',{method:'POST',body:JSON.stringify({action,...body})});}
 function table(selector,rows){const host=$(selector);host.replaceChildren();for(const values of rows){const tr=document.createElement('tr');for(const value of values){const td=document.createElement('td');if(value instanceof Node)td.append(value);else td.textContent=String(value);tr.append(td)}host.append(tr)}if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.textContent='尚無資料';td.colSpan=20;tr.append(td);host.append(tr)}}
 async function load(){
  const run=++version;status.textContent='正在讀取統計…';$('#refresh').disabled=true;
  try{
   const {report:r,devices}=await PlayFeedAuth.api('/api/analytics?days='+$('#days').value+'&audience='+$('#audience').value);
   if(run!==version)return;
   $('#dashboard').hidden=false;$('#summary').replaceChildren();
   for(const [label,value]of [['不同瀏覽器訪客',number(r.summary.visitors)],['造訪',number(r.summary.sessions)],['遊戲瀏覽',number(r.summary.game_views)],['遊戲停留總計',duration(r.summary.duration_ms)]]){const box=document.createElement('div');box.className='card';const name=document.createElement('div');name.textContent=label;const val=document.createElement('div');val.className='value';val.textContent=value;box.append(name,val);$('#summary').append(box)}
   $('#since').textContent='頁面瀏覽 '+number(r.summary.page_views)+' 次。'+(r.started_at?'開始累積：'+new Date(r.started_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})+'。':'尚未收到瀏覽紀錄。');
   table('#games',r.games.map(g=>{const link=document.createElement('a');link.className='game-title';link.href='/g/'+encodeURIComponent(g.game_id);link.textContent=g.title||g.game_id;link.target='_blank';link.rel='noopener';return [link,number(g.views),number(g.visitors),duration(g.duration_ms),g.views?duration(g.duration_ms/g.views):'—',number(g.save_clicks),number(g.saves),number(g.unsaves),number(g.comments_open),number(g.comments),number(g.share_clicks),number(g.shares),number(g.reports),number(g.creator_opens)]}));
   const entryNames={next:'站內 · 下一款',previous:'站內 · 上一款',search_selection:'站內 · 搜尋選擇',saved_selection:'站內 · 個人收藏',creator_selection:'站內 · 作者頁',internal_selection:'站內 · 其他選擇',external_entry:'外部進站',direct_entry:'直接連結／來源不明',feed_initial:'首頁 · 首次顯示',reload:'重新整理',unknown:'未記錄（舊資料）'};
   const totals=new Map(r.games.map(g=>[g.game_id,Number(g.views)]));
   table('#entries',(r.entries||[]).map(e=>[e.title||e.game_id,entryNames[e.entry_source]||entryNames.unknown,number(e.views),totals.get(e.game_id)?(Number(e.views)/totals.get(e.game_id)*100).toFixed(1)+'%':'—',duration(e.duration_ms),e.views?duration(e.duration_ms/e.views):'—']));
   table('#platforms',r.devices.map(d=>[d.family,d.browser,number(d.visitors),number(d.page_views)]));
   table('#sources',r.sources.map(s=>[s.source,number(s.visits)]));
   table('#daily',r.days.map(d=>[d.date,number(d.visitors),number(d.views),duration(d.duration_ms)]));
   table('#actions',r.actions.map(a=>[labels[a.action]||a.action,number(a.count)]));
   $('#devices').replaceChildren();for(const d of devices){const box=document.createElement('div');box.className='device';const row=document.createElement('div');row.className='row';const input=document.createElement('input');input.value=d.label;input.maxLength=60;input.setAttribute('aria-label','裝置名稱');const save=document.createElement('button');save.textContent='儲存名稱';save.onclick=async()=>{save.disabled=true;try{await api('label',{id:d.id,label:input.value});status.textContent='裝置名稱已更新。'}catch(e){status.textContent=e.message}finally{save.disabled=false}};const desc=document.createElement('span');desc.textContent=d.family+' · '+d.browser+' · 最近使用 '+new Date(d.last_seen).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'});row.append(input,save);box.append(row,desc);$('#devices').append(box)}
   status.textContent='已更新 · '+new Date().toLocaleTimeString('zh-TW',{timeZone:'Asia/Taipei'});
  }catch(e){if(run===version){$('#dashboard').hidden=true;status.textContent=e.message}}
  finally{if(run===version)$('#refresh').disabled=false}
 }
 $('#login').onclick=()=>PlayFeedAuth.openLogin();$('#refresh').onclick=load;$('#days').onchange=load;$('#audience').onchange=load;
 $('#mark-current').onclick=async()=>{try{await api('identify');await load();status.textContent='目前瀏覽器已標記，先前未登入的紀錄也會排除。'}catch(e){status.textContent=e.message}};
 $('#pair').onclick=async()=>{const b=$('#pair');b.disabled=true;try{const r=await api('pair-link',{label:'iPhone 13'});$('#pair-url').hidden=false;$('#pair-url').value=r.url;try{await navigator.clipboard.writeText(r.url);$('#pair-message').textContent='已複製。請只傳給自己，並在 iPhone 常用瀏覽器於 15 分鐘內開啟。'}catch{$('#pair-url').select();$('#pair-message').textContent='請複製這個連結，在 iPhone 常用瀏覽器開啟。'}}catch(e){$('#pair-message').textContent=e.message}finally{b.disabled=false}};
 const token=location.hash.startsWith('#pair=')?location.hash.slice(6):'';
 if(token){history.replaceState(null,'',location.pathname);$('#login').hidden=true;status.textContent='正在標記這個瀏覽器…';fetch('/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'claim',token})}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error);$('#paired').hidden=false;status.textContent='已標記：'+data.label;}).catch(e=>{status.textContent=e.message});return;}
 PlayFeedAuth.onChange(async user=>{version++;$('#dashboard').hidden=true;$('#login').hidden=Boolean(user);if(!user){status.textContent='請以網站擁有者帳號登入。';return;}try{await api('identify');await load();}catch(e){status.textContent=e.message}});
})();
