(()=>{
 const dialog=document.querySelector('#ranking-dialog'),list=dialog.querySelector('.ranking-list'),status=dialog.querySelector('.ranking-status'),retry=dialog.querySelector('.ranking-retry');
 const bottom=dialog.querySelector('.ranking-bottom'),bottomList=dialog.querySelector('.ranking-bottom-list');
 let games=[],revision=0,controller;
 function stop(){revision++;controller?.abort();}
 async function load(){
  stop();const version=revision,currentController=controller=new AbortController();
  status.textContent='正在讀取遊戲列表…';list.replaceChildren();bottomList.replaceChildren();bottom.hidden=true;retry.hidden=true;dialog.setAttribute('aria-busy','true');
  const timeout=setTimeout(()=>currentController.abort(),8000);
  try{
   const response=await fetch('/api/popular-games',{signal:currentController.signal});
   if(!response.ok)throw Error('排名暫時無法載入，先顯示全部遊戲。');
   const data=await response.json();if(!Array.isArray(data.ids))throw Error('排名資料暫時無法讀取，先顯示全部遊戲。');
   if(version!==revision||!dialog.open)return;
   render(data.ids);
  }catch(error){if(version!==revision||!dialog.open)return;render([]);status.textContent=(error.name==='AbortError'?'排名讀取逾時，先顯示全部遊戲。':error.message)+' 共 '+bottomList.children.length+' 款';retry.hidden=false;}
  finally{clearTimeout(timeout);if(version===revision)dialog.setAttribute('aria-busy','false');}
 }
 function render(ids){
   list.replaceChildren();bottomList.replaceChildren();
   // Join only against the current public catalog so removed or private games stay out.
   const byId=new Map();for(const game of games){byId.set(game.id,game);if(game.slug)byId.set(game.slug,game);}
   const seen=new Set(),ranked=[];
   for(const id of ids){const game=byId.get(id);if(game&&!seen.has(game.id)){seen.add(game.id);ranked.push(game);}}
   const unranked=games.filter(game=>{if(seen.has(game.id))return false;seen.add(game.id);return true;}).sort((a,b)=>a.title.localeCompare(b.title,'zh-Hant'));
   status.textContent='共 '+(ranked.length+unranked.length)+' 款 · 近 7 天排名'+(unranked.length?'，尚未排名的作品列於後方':'');
   function appendGame(game,index,target){
    const li=document.createElement('li'),link=document.createElement('a'),rank=document.createElement('span'),details=document.createElement('span'),title=document.createElement('strong'),author=document.createElement('small'),arrow=document.createElement('span');
    link.href='/g/'+encodeURIComponent(game.slug||game.id);
    rank.className='ranking-number';rank.textContent=index===null?'—':String(index+1);rank.setAttribute('aria-label',index===null?'尚未排名':'第 '+(index+1)+' 名');
    details.className='ranking-details';title.textContent=game.title;author.textContent=game.creator?.name||game.author||'';
    arrow.className='ranking-arrow';arrow.textContent='›';arrow.setAttribute('aria-hidden','true');
    details.append(title,author);link.append(rank,details,arrow);li.append(link);target.append(li);
   }
   ranked.forEach((game,index)=>appendGame(game,index,list));
   unranked.forEach(game=>appendGame(game,null,bottomList));
   bottom.hidden=!bottomList.children.length;
 }
 dialog.addEventListener('close',stop);
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();});
 retry.addEventListener('click',load);
 window.PlayFeedRanking={open(catalog){games=catalog;if(!dialog.open)dialog.showModal();load();}};
})();
