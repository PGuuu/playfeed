(()=>{
 const $=id=>document.getElementById(id),form=$('review-form');
 let rows=[],index=-1,identity=0,revision=0,busy=false,metadataReady=false,screenshot=null,screenshotFocus=null;
 const shot=PlayFeedScreenshot.mount($('player').parentElement,()=>{const current=revision;return {frame:$('player').querySelector('iframe'),isCurrent:()=>current===revision&&!busy,title:form.elements.title.value,author:form.elements.author.value,onSave:async (image,focus)=>{screenshot=image;screenshotFocus=focus;shot.querySelector('button').textContent='截圖（已選好）';}}});
 $('player').after(shot);
 const label=row=>{const url=new URL(row.url);return decodeURIComponent(url.pathname.split('/').filter(Boolean).pop()||url.hostname)};
 function locked(message,login=false){revision++;rows=[];index=-1;metadataReady=false;$('player').replaceChildren();$('workspace').hidden=true;$('gate').hidden=false;$('gate-message').textContent=message;$('login').hidden=!login;$('retry').hidden=login;}
 function controls(){shot.hidden=index<0;shot.querySelector('button').disabled=busy;for(const el of [form.querySelector('[type=submit]'),$('reject'),$('previous'),$('next')])el.disabled=busy||index<0||(!metadataReady&&el.type==='submit');for(const el of form.querySelectorAll('input'))el.disabled=busy;}
 function renderQueue(){
  $('count').textContent='（'+rows.length+'）';$('queue-list').replaceChildren();
  rows.forEach((row,i)=>{const b=document.createElement('button');b.type='button';b.textContent=row.title||label(row);b.setAttribute('aria-current',String(i===index));b.addEventListener('click',()=>{if(!busy)select(i)});$('queue-list').append(b)});
 }
 async function select(next){
  if(busy||!rows.length)return;const current=++revision,session=identity;index=(next+rows.length)%rows.length;metadataReady=false;renderQueue();
  const row=rows[index];screenshot=null;screenshotFocus=null;shot.querySelector('button').textContent='截圖';form.reset();$('action-message').textContent='';$('metadata-message').textContent='正在讀取名稱與作者…';$('game-title').textContent=row.title||label(row);$('position').textContent=(index+1)+' / '+rows.length;
  form.elements.title.value=row.title||label(row);form.elements.author.value='';
  const frame=document.createElement('iframe');frame.title=row.title||label(row);frame.src=PlayFeedFrame.configure(frame,row.url);$('player').replaceChildren(frame);$('original').href=row.url;$('original').hidden=false;form.hidden=false;controls();
  try{
   const result=await PlayFeedAuth.api('/api/account?action=waiting-detail&id='+encodeURIComponent(row.id));
   if(current!==revision||session!==identity)return;
   const m=result.metadata;row.title=m.title;form.elements.title.value=m.title;form.elements.author.value=m.author;$('game-title').textContent=m.title;frame.title=m.title;metadataReady=true;renderQueue();
   $('metadata-message').textContent=m.author.startsWith('來源：')?'尚未找到明確作者署名，請查看原站並補上；目前僅標示來源網站。':'公開前可以在這裡修正名稱與創作者。';
  }catch(error){if(current!==revision||session!==identity)return;$('metadata-message').textContent=error.message+' 你也可以自行填寫名稱與作者。';metadataReady=true;}
  controls();
 }
 function empty(){revision++;index=-1;$('player').textContent='這一批已全部處理完了。';form.hidden=true;$('original').hidden=true;$('position').textContent='沒有待審遊戲';renderQueue();controls();}
 async function load(){
  const version=++identity;locked('正在確認帳號…');$('retry').hidden=true;
  try{const result=await PlayFeedAuth.api('/api/account?action=waiting-list');if(version!==identity)return;rows=result.requests;$('gate').hidden=true;$('workspace').hidden=false;if(rows.length)await select(0);else empty();}
  catch(error){if(version!==identity)return;locked(error.status===403?'這個等待區只開放給站長帳號。':error.message,error.status===401);}
 }
 async function decide(decision){
  if(busy||index<0)return;const row=rows[index],position=index,session=identity;
  if(decision==='publish'&&(!metadataReady||!form.reportValidity()))return;
  busy=true;controls();$('action-message').textContent=decision==='publish'?'正在公開，請稍候…':'正在略過…';
  try{
   const result=await PlayFeedAuth.api('/api/account',{timeoutMs:115000,method:'POST',body:JSON.stringify({action:'waiting-review',requestId:row.id,decision,interactionConfirmed:form.elements.confirmed.checked,title:form.elements.title.value,author:form.elements.author.value,screenshot,screenshotFocus})});
   if(session!==identity)return;
   rows=rows.filter(r=>r.id!==row.id);$('flash').replaceChildren(document.createTextNode(decision==='publish'?'「'+(row.title||label(row))+'」已公開。':'已略過這款遊戲。'));
   if(result.id){const a=document.createElement('a');a.href='/g/'+encodeURIComponent(result.id);a.target='_blank';a.rel='noopener';a.textContent=' 查看公開遊戲 ↗';$('flash').append(a);}
   busy=false;if(rows.length)await select(Math.min(position,rows.length-1));else empty();
  }catch(error){if(session===identity)$('action-message').textContent=error.message;}
  finally{busy=false;controls();}
 }
 form.addEventListener('submit',event=>{event.preventDefault();decide('publish')});$('reject').addEventListener('click',()=>decide('reject'));
 $('previous').addEventListener('click',()=>select(index-1));$('next').addEventListener('click',()=>select(index+1));$('login').addEventListener('click',()=>PlayFeedAuth.openLogin());$('retry').addEventListener('click',load);
 for(const mode of ['portrait','landscape'])$(mode).addEventListener('click',()=>{$('player').classList.toggle('landscape',mode==='landscape');$('portrait').setAttribute('aria-pressed',String(mode==='portrait'));$('landscape').setAttribute('aria-pressed',String(mode==='landscape'));});
 PlayFeedAuth.onChange(user=>{identity++;busy=false;$('flash').textContent='';locked(user?'正在確認帳號…':'請使用站長帳號認證 Email 後，進入私人等待區。',!user);if(user)load();});
})();
