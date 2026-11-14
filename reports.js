(() => {
 const $=selector=>document.querySelector(selector), reasons={not_playable:'無法載入或操作',inappropriate:'內容不適合',attribution:'作者或版權問題',other:'其他'};
 let reports=[],selected=null,identity=0,busy=false;
 const reason=r=>reasons[r.reason]||r.reason||'未提供原因';
 const date=r=>new Date(r.created_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false});
 function clearDetail(){selected=null;$('#detail').hidden=true;$('#player').replaceChildren();$('#confirmed').checked=false;$('#remove').disabled=true;$('#remove-form').hidden=true;$('#result').textContent='';}
 function render(){
  $('#list').replaceChildren();
  const visible=reports.filter(r=>$('#filter').value==='all'||r.status===$('#filter').value);
  const pending=reports.filter(r=>r.status==='pending').length;
  $('#message').textContent=pending+' 筆待處理檢舉，共 '+reports.length+' 筆紀錄。';
  for(const report of visible){
   const row=document.createElement('article');row.className='row';const title=document.createElement('h2');title.textContent=report.game_title;row.append(title);
   for(const text of ['檢舉原因：'+reason(report),'補充說明：'+(report.details||'未填寫'),date(report)+'（台北時間） · '+(report.status==='pending'?'待處理':'已處理')+(report.available?'':' · 遊戲已下架')]){const p=document.createElement('p');p.textContent=text;row.append(p)}
   const view=document.createElement('button');view.type='button';view.textContent='查看遊戲與檢舉';view.addEventListener('click',()=>open(report));row.append(view);$('#list').append(row);
  }
  if(!visible.length)$('#list').textContent='目前沒有這個狀態的檢舉。';
 }
 function open(report){
  clearDetail();selected=report;$('#listing').hidden=true;$('#detail').hidden=false;
  history.replaceState(null,'','?report='+encodeURIComponent(report.id));
  $('#detail-title').textContent=report.game_title;
  $('#summary').textContent='檢舉原因：'+reason(report)+'\n補充說明：'+(report.details||'未填寫')+'\n檢舉時間：'+date(report)+'（台北時間）\n處理狀態：'+(report.status==='pending'?'待處理':'已處理');
  $('#playfeed-link').hidden=!report.available;$('#playfeed-link').href='/g/'+encodeURIComponent(report.game_id);
  $('#source-link').hidden=true;$('#source-link').removeAttribute('href');
  try{const url=new URL(report.game_url);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error('invalid');$('#source-link').href=url.href;$('#source-link').hidden=false;
   if(report.available){const frame=document.createElement('iframe');frame.title='查看被檢舉遊戲：'+report.game_title;frame.src=PlayFeedFrame.configure(frame,url.href);$('#player').append(frame)}
  }catch{$('#availability').textContent='遊戲網址無效，無法預覽。';return;}
  $('#availability').textContent=report.available?'請實際查看。若內嵌無法載入，可另開原網站比較。':'此遊戲已下架，保留檢舉紀錄供查閱。';
  $('#remove-form').hidden=!report.available||report.status!=='pending';
  $('#detail').scrollIntoView({block:'start'});
 }
 $('#back').addEventListener('click',()=>{if(busy)return;clearDetail();$('#listing').hidden=false;history.replaceState(null,'',location.pathname);render()});
 $('#filter').addEventListener('change',render);
 $('#confirmed').addEventListener('change',()=>{$('#remove').disabled=!$('#confirmed').checked||busy});
 $('#remove-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!selected||!$('#confirmed').checked||busy)return;
  const report=selected,version=identity;busy=true;$('#remove').disabled=true;$('#back').disabled=true;$('#result').textContent='正在下架…';
  try{await PlayFeedAuth.api('/api/account',{method:'POST',body:JSON.stringify({action:'remove-reported-game',reportId:report.id,reviewConfirmed:true})});if(version!==identity)return;
   try{sessionStorage.removeItem('playfeed:catalog:v1')}catch{}
   for(const r of reports)if(r.game_url===report.game_url){r.available=false;if(r.status==='pending')r.status='resolved'}
   open(report);$('#result').textContent='已下架遊戲，相關檢舉已標為已處理。';render();
  }catch(error){if(version===identity)$('#result').textContent=error.message}finally{busy=false;$('#back').disabled=false;$('#remove').disabled=!$('#confirmed').checked}
 });
 PlayFeedAuth.onChange(async user=>{
  const version=++identity;clearDetail();reports=[];$('#listing').hidden=true;$('#list').replaceChildren();
  if(!user){$('#message').textContent='請先以管理員帳號登入。';return;}
  $('#message').textContent='正在讀取檢舉…';
  try{const data=await PlayFeedAuth.api('/api/account?action=reports');if(version!==identity)return;reports=data.reports;$('#listing').hidden=false;render();const id=new URLSearchParams(location.search).get('report');if(id){const report=reports.find(r=>r.id===id);if(report)open(report);else $('#message').textContent='找不到這筆檢舉。'}}
  catch(error){if(version===identity)$('#message').textContent=error.message}
 });
})();
