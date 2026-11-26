const recommendationApi = 'https://oimdeoszgxfumwtmapok.supabase.co/rest/v1';
const recommendationKey = 'sb_publishable_ZovEIH8JuRiKuf24MTIKLg_sz2Tnui8';
async function recommendationRequest(path, options = {}) {
  const attempts=['GET','HEAD'].includes((options.method||'GET').toUpperCase())?2:1;
  for(let attempt=0;attempt<attempts;attempt++){
    try{
      const response = await fetch(recommendationApi + path, {
        signal: AbortSignal.timeout(5000),
        ...options,
        headers: { apikey: recommendationKey, 'Content-Type': 'application/json', ...options.headers },
      });
      if (!response.ok) {
        const error=new Error(String(response.status));
        error.retryable=response.status===408||response.status===429||response.status>=500;
        throw error;
      }
      const body = await response.text();
      return body ? JSON.parse(body) : null;
    }catch(error){
      if(attempt+1===attempts||options.signal?.aborted||error.retryable===false)throw error;
      await new Promise(resolve=>setTimeout(resolve,300));
    }
  }
}

// A fresh same-origin response can recover from mobile-to-database network failures.
// Never fall back to an old saved catalog: owner removals must still be respected.
async function loadPlayfeedCatalog(){
  try{return await loadPlayfeedGames();}
  catch(directError){
    const response=await fetch('/api/catalog',{cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw directError;
    const data=await response.json();
    if(!Array.isArray(data.games)||!data.games.every(game=>typeof game.id==='string'&&typeof game.url==='string'&&typeof game.title==='string'))throw directError;
    return data.games;
  }
}
