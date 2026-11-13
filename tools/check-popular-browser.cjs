const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.join(__dirname, '..');
const games = ['cold', 'best', 'second', 'third'].map(id => ({ id, title: id, author: 'Author', url: 'https://game.test/' + id, external: true }));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const scenario of ['home', 'link', 'saved', 'failure', 'timeout', 'legacy-script','member-success','member-failure']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 740 } });
      const page = await context.newPage(), errors = []; let rankingRequests = 0, completedShares=0;
      page.on('pageerror', error => errors.push(error.message));
      await context.addInitScript(scenario => {
        Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{}});
        if(scenario==='home'||scenario.startsWith('member-'))return;
        localStorage.setItem('playfeed:guest-saves:v1', JSON.stringify({ entries: { 'https://game.test/cold': { id: 'cold', title: 'cold', url: 'https://game.test/cold', savedAt: '1' } }, pending: {} }));
      },scenario);
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
        if (url.pathname === '/api/popular-games') {
          rankingRequests++;
          if (scenario === 'failure') return route.fulfill({ status: 503, body: '{}' });
          if (scenario === 'timeout') { await new Promise(resolve => setTimeout(resolve, 1600)); return route.fulfill({ body: '{}' }).catch(() => {}); }
          return json({ ids: ['best', 'second', 'third'] });
        }
        if (url.pathname === '/api/analytics') {let body={};try{body=route.request().postDataJSON()||{}}catch{} completedShares+=(body.events||[]).filter(e=>e.action==='share_success').length;await new Promise(resolve=>setTimeout(resolve,80));return json({ok:true});}
        if(url.pathname==='/api/account'&&route.request().method()==='POST'&&route.request().postDataJSON()?.action==='save'){await new Promise(resolve=>setTimeout(resolve,1000));return route.fulfill({status:scenario==='member-failure'?503:200,contentType:'application/json',body:JSON.stringify(scenario==='member-failure'?{error:'fixture save failure'}:{saved:true,saveCount:1,displaySaveCount:1,shareCount:0})});}
        if (url.pathname === '/api/account') return json({ saveCount: 0, commentCount: 0, shareCount: completedShares, guestSaved: false, saved: false });
        if (url.pathname === '/auth.js') return route.fulfill({ contentType: 'text/javascript', body: "window.PlayFeedAuth={user:"+JSON.stringify(scenario.startsWith('member-')?{id:'member',email:'member@example.com'}:null)+",checking:false,token:'',onChange(fn){fn(this.user)},async api(url,options){const r=await fetch(url,options),data=await r.json();if(!r.ok)throw Error(data.error);return data},openLogin(){}}" });
        if (url.pathname === '/catalog.js') return route.fulfill({ contentType: 'text/javascript', body: 'async function loadPlayfeedGames(){return ' + JSON.stringify(games) + '}' });
        if (scenario === 'legacy-script' && url.pathname === '/feed-order.js') return route.fulfill({ contentType: 'text/javascript', body: 'function orderPlayfeedGames(games){return games}' });
        if (url.pathname === '/recommendations.js' || url.pathname === '/analytics-owner-link.js') return route.fulfill({ body: '' });
        if (url.hostname !== 'playfeed.test') return route.fulfill({ contentType: 'text/html', body: '<body>Game</body>' });
        const name = url.pathname === '/' || url.pathname.startsWith('/g/') ? 'index.html' : url.pathname.slice(1);
        const file = path.join(root, name);
        if (!fs.existsSync(file)) return route.fulfill({ body: '' });
        return route.fulfill({ body: fs.readFileSync(file), contentType: name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html' });
      });
      const active = title => page.waitForFunction(expected => document.querySelector('article:not([hidden]) .game-title')?.textContent === expected, title);
      await page.goto('https://playfeed.test/' + (scenario === 'link' ? 'g/cold' : scenario === 'saved' ? 'g/cold?list=saved' : ''));
      if (scenario === 'home') {
        await page.waitForFunction(()=>Boolean(document.querySelector('article:not([hidden]) .game-title')?.textContent));
        const save=page.locator('article:not([hidden]) [data-kind="saved"]');
        assert.equal(await save.getAttribute('aria-pressed'),'false');
        await save.click();assert.equal(await save.getAttribute('aria-pressed'),'true');
        assert.equal(await page.locator('.save-laser').count(),3);
        await page.waitForTimeout(800);
        assert(await page.locator('.account-link').evaluate(el=>el.getAnimations().length>0));
        await save.click();assert.equal(await save.getAttribute('aria-pressed'),'false');
        assert.equal(await page.locator('#save-feedback').isVisible(),false);
        await page.waitForFunction(()=>document.querySelector('.action-status').textContent==='');
        await page.locator('#next-game').click();await page.waitForFunction(()=>Boolean(document.querySelector('article:not([hidden]) .game-title')?.textContent));
        assert.equal(await save.getAttribute('aria-pressed'),'false');
        await page.reload();await page.waitForFunction(()=>Boolean(document.querySelector('article:not([hidden]) .game-title')?.textContent));
        await page.locator('article:not([hidden]) .share').click();
        await page.locator('.share-plane').waitFor();
        assert.equal(await page.locator('.share-plane').evaluate(el=>el.getAnimations()[0].effect.getTiming().duration),5000);
        await page.waitForFunction(()=>document.querySelector('article:not([hidden]) [data-count=shares]')?.textContent==='1');
        await page.locator('.share-plane').waitFor({state:'detached',timeout:7000});
        assert.equal(completedShares,1);
        assert.equal(await page.locator('article:not([hidden]) [data-count=shares]').textContent(),'1');

      }
      else if(scenario.startsWith('member-')){
        await page.waitForFunction(()=>Boolean(document.querySelector('article:not([hidden]) .game-title')?.textContent));
        const save=page.locator('article:not([hidden]) [data-kind=saved]');
        await save.click();assert.equal(await save.getAttribute('aria-pressed'),'true');
        assert.equal(await save.isDisabled(),true);assert.equal(await page.locator('.save-laser').count(),3);
        await page.waitForFunction(()=>!document.querySelector('article:not([hidden]) [data-kind=saved]').disabled);
        assert.equal(await save.getAttribute('aria-pressed'),String(scenario==='member-success'));
        assert.equal(await save.locator('.action-count').textContent(),scenario==='member-success'?'1':'0');
        if(scenario==='member-failure')assert((await page.locator('.action-status').textContent()).includes('未能完成'));
      }
      else if (scenario === 'link') { await active('cold'); await page.locator('#next-game').click(); await page.waitForFunction(()=>location.pathname!=='/g/cold'&&Boolean(document.querySelector('article:not([hidden]) .game-title')?.textContent)); await page.locator('#previous-game').click(); await active('cold'); }
      else if (scenario === 'saved') { await active('cold'); await page.locator('#next-game').click(); await active('cold'); assert.equal(rankingRequests, 0); }
      else await page.waitForFunction(() => Boolean(document.querySelector('article:not([hidden]) .game-title')));
      assert.deepEqual(errors, []);
      console.log('PASS browser:', scenario);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
