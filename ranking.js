(()=>{
 const dialog=document.querySelector('#ranking-dialog'),list=dialog.querySelector('.ranking-list'),status=dialog.querySelector('.ranking-status'),retry=dialog.querySelector('.ranking-retry');
 const bottom=dialog.querySelector('.ranking-bottom'),bottomList=dialog.querySelector('.ranking-bottom-list');
 let games=[],revision=0,controller;
 function stop(){revision++;controller?.abort();}
 async function load(){
  stop();const version=revision,currentController=controller=new AbortController();
  status.textContent='正在讀取排行榜…';list.replaceChildren();bottomList.replaceChildren();bottom.hidden=true;retry.hidden=true;dialog.setAttribute('aria-busy','true');
  const timeout=setTimeout(()=>currentController.abort(),8000);
  try{
   const response=await fetch('/api/popular-games',{signal:currentController.signal});
   if(!response.ok)throw Error('排行榜暫時無法載入，請稍後重試。');
   const data=await response.json();if(!Array.isArray(data.ids))throw Error('排行榜資料暫時無法讀取。');
   if(version!==revision||!dialog.open)return;
   // Join only against the current public catalog so removed or private games stay out.
   const byId=new Map();for(const game of games){byId.set(game.id,game);if(game.slug)byId.set(game.slug,game);}
   const seen=new Set(),ranked=[];
   for(const id of data.ids){const game=byId.get(id);if(game&&!seen.has(game.id)){seen.add(game.id);ranked.push(game);}}
   status.textContent=ranked.length?'近 7 天 · 前 '+Math.min(10,ranked.length)+' 名':'近期的遊玩資料還不足，暫時沒有上榜遊戲。';
   function appendGame(game,index,target){
    const li=document.createElement('li'),link=document.createElement('a'),rank=document.createElement('span'),details=document.createElement('span'),title=document.createElement('strong'),author=document.createElement('small'),arrow=document.createElement('span');
    link.href='/g/'+encodeURIComponent(game.slug||game.id);
    rank.className='ranking-number';rank.textContent=String(index+1);rank.setAttribute('aria-label','第 '+(index+1)+' 名');
    details.className='ranking-details';title.textContent=game.title;author.textContent=game.creator?.name||game.author||'';
    arrow.className='ranking-arrow';arrow.textContent='›';arrow.setAttribute('aria-hidden','true');
    details.append(title,author);link.append(rank,details,arrow);li.append(link);target.append(li);
   }
   ranked.slice(0,10).forEach((game,index)=>appendGame(game,index,list));
   // Avoid repeating the top ten when fewer than twenty games qualify.
   const bottomStart=Math.max(10,ranked.length-10);
   ranked.slice(bottomStart).forEach((game,index)=>appendGame(game,bottomStart+index,bottomList));
   bottom.hidden=!bottomList.children.length;
  }catch(error){if(version!==revision||!dialog.open)return;status.textContent=error.name==='AbortError'?'讀取逾時，請再試一次。':error.message;retry.hidden=false;}
  finally{clearTimeout(timeout);if(version===revision)dialog.setAttribute('aria-busy','false');}
 }
 dialog.addEventListener('close',stop);
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();});
 retry.addEventListener('click',load);
 window.PlayFeedRanking={open(catalog){games=catalog;if(!dialog.open)dialog.showModal();load();}};
})();
