(()=>{
 'use strict';
 const dialog=document.querySelector('#ranking-dialog'),list=dialog.querySelector('.ranking-list'),status=dialog.querySelector('.ranking-status'),retry=dialog.querySelector('.ranking-retry');
 const bottom=dialog.querySelector('.ranking-bottom'),bottomList=dialog.querySelector('.ranking-bottom-list'),filters=dialog.querySelector('.ranking-filters'),total=dialog.querySelector('.ranking-catalog-total'),updated=dialog.querySelector('.ranking-updated'),sort=dialog.querySelector('.ranking-sort');
 const trigger=document.querySelector('.ranking-button'),badge=document.createElement('small');badge.className='ranking-total';trigger.append(badge);
 const categories=[
  {id:'all',label:'全部',matches:()=>true},
  {id:'recent',label:'近日上架',matches:game=>{const age=Date.now()-Date.parse(game.published_at);return age>=0&&age<7*86400000;}},
  {id:'food',label:'食物類',pattern:/食堂|食光|吃飯|放飯|餐廳|煎餅|珍奶|水果|壽司|炒飯|水餃|餃子|紅豆餅|雞蛋糕|蛋塔|牛排|豆腐|茶葉蛋|牛肉麵|可麗露|咖啡|手搖|燒臘|滷肉飯|便當|舒芙蕾|沙威瑪|地瓜|蘋果|霜淇淋|料理|手路菜|蛋糕|巧克力|披薩|海鮮丼|烤到|剝蚵|food|cook|sushi|ramen|boba|dumpling|choco|pizza|malatang|brothmaster|zhennai|tofu|tofunk|oyster|latte|softserve|ringo|serena|konbini|wok-hey|beef|steak/i},
  {id:'puzzle',label:'益智解謎',pattern:/解謎|推理|謎題|迷宮|迷站|連連看|三消|踩地雷|五子棋|暗棋|大老二|撿紅點|連珠|賓果|猜數字|俄羅斯|數學|方格|拼圖|分類|排序|鈕扣|puzzle|maze|mines|tetris|gomoku|banqi|bigtwo|bingo|boxsum|memory|deduction|one-line-defense/i},
  {id:'action',label:'動作反應',pattern:/射擊|火線|跑酷|閃避|反應|打磚|射氣球|接接|追人|追獵|格鬥|逃|搶位|保衛戰|飛鏢|打工|賽跑|棒球|羽球|足球|外送|爬|生存|求生|鬼抓|釣|撈|min(er|ing)|blaster|runner|shooter|breakout|arkanoid|flappy|clumsy|pacman|carball|fishing|balloon|badminton|darts|curling/i},
  {id:'simulation',label:'模擬經營',pattern:/模擬|經營|人生|大亨|收銀|補貨|操作員|販賣機|ATM|店員|駕駛|司機|生涯|養小孩|救援|salon|slaycure|lifesim|life-fork|life.?retry|footlife|yakyolife|tycoon|operator|cashier|konbini|trainsim/i},
  {id:'creative',label:'療癒創作',pattern:/紙上|針筆|畫畫|名畫|塗鴉|拼豆|陶藝|創作|調色|染髮|佈置|暖爐|擠擠|地毯|關燈|眉心|敲一下|祈願|心安宮|占卜|塔羅|看相|從頭相到腳|泡泡|剝|pimple|piggy-oracle|taroca|carpet|slowpoke|paper-ink|light-switch|brow-press|hammer-face|daisy-(paint|color|beads)|rough99|pottery|doodle/i}
 ];
 let games=[],ids=[],selected='all',revision=0,controller,timer,lastUpdated=null;
 const stamp=game=>Date.parse(game.published_at)||0;
 const textFor=game=>game.title+' '+(game.slug||'')+' '+new URL(game.url,location.origin).pathname;
 const matches=(game,category)=>category.matches?category.matches(game):category.pattern.test(textFor(game));
 function setCatalog(catalog){games=[...new Map(catalog.map(game=>[game.id,game])).values()];total.textContent='目前上架 '+games.length+' 款遊戲';badge.textContent=String(games.length);trigger.setAttribute('aria-label','遊戲列表，共 '+games.length+' 款');}
 function stop(){revision++;controller?.abort();clearInterval(timer);}
 function render(){
  const focusedFilter=filters.contains(document.activeElement)?document.activeElement.dataset.filter:null;
  filters.replaceChildren();
  for(const category of categories){
   const button=document.createElement('button'),count=games.filter(game=>matches(game,category)).length;
   button.type='button';button.dataset.filter=category.id;button.setAttribute('aria-pressed',String(selected===category.id));button.textContent=category.label+' '+count;
   if(category.id==='recent')button.title='最近 7 天上架';filters.append(button);
  }
  if(focusedFilter)filters.querySelector('[data-filter="'+focusedFilter+'"]').focus({preventScroll:true});
  const byId=new Map();for(const game of games){byId.set(game.id,game);if(game.slug)byId.set(game.slug,game);}
  const ranks=new Map();for(const id of ids){const game=byId.get(id);if(game&&!ranks.has(game.id))ranks.set(game.id,ranks.size+1);}
  const category=categories.find(item=>item.id===selected),visible=games.filter(game=>matches(game,category));
  const newest=sort.value==='newest';
  visible.sort((a,b)=>newest?(stamp(b)-stamp(a)||a.title.localeCompare(b.title,'zh-Hant')):((ranks.get(a.id)??Infinity)-(ranks.get(b.id)??Infinity)||a.title.localeCompare(b.title,'zh-Hant')));
  list.replaceChildren();bottomList.replaceChildren();bottom.hidden=true;
  status.textContent=(selected==='all'?'全部遊戲':category.label+(selected==='recent'?'（近 7 天）':''))+' · '+visible.length+' 款'+(visible.length?'':'，目前沒有符合的遊戲');
  list.setAttribute('aria-label',newest?'依上架時間排列的遊戲':'依排名排列的遊戲');
  for(const game of visible){
   const rankValue=ranks.get(game.id),target=!newest&&!rankValue?bottomList:list;
   const li=document.createElement('li'),link=document.createElement('a'),rank=document.createElement('span'),details=document.createElement('span'),title=document.createElement('strong'),author=document.createElement('small'),arrow=document.createElement('span');
   link.href='/g/'+encodeURIComponent(game.slug||game.id);rank.className='ranking-number';
   rank.textContent=rankValue?String(rankValue):'—';rank.setAttribute('aria-label',rankValue?'總排名第 '+rankValue+' 名':'尚未排名');
   li.classList.toggle('ranking-podium',!!rankValue&&rankValue<=3);
   if(rankValue)li.value=rankValue;
   details.className='ranking-details';title.textContent=game.title;author.textContent=game.creator?.name||game.author||'';
   arrow.className='ranking-arrow';arrow.textContent='›';arrow.setAttribute('aria-hidden','true');
   details.append(title,author);link.append(rank,details,arrow);li.append(link);target.append(li);
  }
  bottom.hidden=!bottomList.children.length;
 }
 async function load(){
  controller?.abort();const version=++revision,currentController=controller=new AbortController();
  retry.hidden=true;dialog.setAttribute('aria-busy','true');updated.textContent='更新中…';
  const timeout=setTimeout(()=>currentController.abort(),12000);
  try{
   let catalogFailed=false;
   const request=async path=>{try{return await recommendationRequest(path,{signal:currentController.signal});}catch(error){if(path.startsWith('/playfeed_recommendations?'))catalogFailed=true;throw error;}};
   const results=await Promise.allSettled([
    loadPlayfeedGames(request).then(catalog=>{if(catalogFailed)throw Error('清單更新失敗');return catalog;}),
    fetch('/api/popular-games',{signal:currentController.signal,cache:'no-cache'}).then(async response=>{if(!response.ok)throw Error('排名更新失敗');const data=await response.json();if(!Array.isArray(data.ids))throw Error('排名資料無效');return data.ids;})
   ]);
   if(version!==revision||!dialog.open)return;
   if(results[0].status==='fulfilled'){setCatalog(results[0].value);lastUpdated=new Date();}
   if(results[1].status==='fulfilled')ids=results[1].value;
   render();
   const time=lastUpdated?.toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false});
   if(results[0].status==='rejected'){updated.textContent='清單更新失敗，顯示上次資料'+(time?'（'+time+'）':'');retry.hidden=false;}
   else{updated.textContent='更新於 '+time+' · 每分鐘自動更新'+(results[1].status==='rejected'?' · 排名暫時無法更新':'');retry.hidden=results[1].status==='fulfilled';}
  }finally{clearTimeout(timeout);if(version===revision)dialog.setAttribute('aria-busy','false');}
 }
 filters.addEventListener('click',event=>{const button=event.target.closest('[data-filter]');if(!button)return;selected=button.dataset.filter;if(selected==='recent')sort.value='newest';render();});
 sort.addEventListener('change',render);
 dialog.addEventListener('close',stop);
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();});
 retry.addEventListener('click',load);
 document.addEventListener('visibilitychange',()=>{if(dialog.open&&!document.hidden)load();});
 window.PlayFeedRanking={setCatalog,open(catalog){if(!games.length)setCatalog(catalog);if(!dialog.open)dialog.showModal();render();load();clearInterval(timer);timer=setInterval(()=>{if(dialog.open&&!document.hidden)load();},60000);}};
})();
