async function loadPlayfeedGames(request = recommendationRequest, baseUrl = location.origin + "/") {
  const removalResult=Promise.resolve().then(()=>request('/playfeed_removed_games?select=game_url')).then(data=>({data}),error=>({error}));
  const creator = { name: '阿李阿斗 @ali_aaa_do', url: 'https://aicooksyourbrain.com/', hash: '#creator-ali-aaa-do' };
  const playfeed = { name: 'PlayFeed', url: 'https://playfeed-gilt.vercel.app/', hash: '#creator-playfeed' };
  const games = [
    { id: 'sticker-chat', title: '寶貝，這張你有嗎？', author: 'PlayFeed', creator: playfeed, url: './games/sticker-chat/index.html', cover: '/share-cards/v4/sticker-chat.png', published_at: '2026-11-14T07:58:33.000Z', viewport: { width: 390, height: 740 } },
    { id: 'vanilla-cloud', title: '香草雲朵 Vanilla Cloud', author: 'PlayFeed', creator: playfeed, url: './vanilla.html', cover: '/share-cards/vanilla-cloud.png', published_at: '2026-11-13T04:16:00.000Z', viewport: { width: 390, height: 740 } },
    { id: 'luck-rolls', title: '好運捲捲來', author: '喜年來 Serena', creator_url: 'https://www.serenafoods.com.tw/', url: 'https://play.serenafoods.com.tw/luck/', external: true, recommended: true, published_at: '2026-11-11T05:57:23.514Z' },
    { id: 'taistorm', title: '台灣氣象戰 Taistorm', author: '無夜霜', creator_url: 'https://github.com/nonightcream', url: 'https://nonightcream.github.io/Taistorm/', external: true, recommended: true, allowStorage: true, published_at: '2026-11-11T05:57:23.514Z' },
    { id: 'balcony-blanket', title: '陽台上的小被被', author: 'sansword', url: 'https://sansword.github.io/balcony-blanket/', external: true, recommended: true },
    { id: 'mt24hr', title: 'MT24Hr 醫檢師的一天', author: 'Henry423', url: 'https://mt24hr.pages.dev/', external: true, recommended: true },
    { id: 'night-market-balloon', title: '夜市射氣球', author: '20daysmessage', url: 'https://20daysmessage.github.io/balloon-game/', external: true, recommended: true },
    { id: 'fu3dai', title: '富不過三代？清朝求生錄', author: 'Louisa Tsai', url: 'https://fu3dai.netlify.app/', external: true, recommended: true },
    { id: 'gold-miner', title: '黃金礦工', author: 'hwzh4640', url: 'https://arcade.hz.ax/gold-miner/', external: true, recommended: true },
    { id: 'slowboot', title: '慢慢開機 Slow Boot', author: '@misskw3_3', url: 'https://misskatyw.github.io/slowboot/', external: true, recommended: true },
    { id: 'footlife', title: 'FootLife 足球人生模擬器', author: 'Anty', url: 'https://footlife-eta.vercel.app/', external: true, recommended: true },
    { id: 'hk-red-van', title: '紅van司機', author: 'TickBreeze', url: 'https://hkredvan.tickbreeze.com/', external: true, recommended: true },
    { id: 'candle-clash', title: 'Candle Clash K線對決', author: 'Pick The Wheel', url: 'https://pickthewheel.com/candle-clash/', external: true, recommended: true },
    { id: 'fishing-fever', title: 'Fishing Fever 釣魚狂熱', author: 'Pick The Wheel', url: 'https://pickthewheel.com/fishing-fever/', external: true, recommended: true },
    { id: 'konbini-rush', title: '便利商店補貨狂熱', author: 'Pick The Wheel', url: 'https://pickthewheel.com/konbini-rush/', external: true, recommended: true },
    { id: 'konbini-cashier', title: '便利商店收銀達人', author: 'Pick The Wheel', url: 'https://pickthewheel.com/konbini-cashier/', external: true, recommended: true },
    { id: 'parking-panic', title: 'PARKING PANIC! 代客泊車', author: 'smalldesire', url: 'https://parking-panic.pages.dev/', external: true, recommended: true },
    { id: 'museo-art-puzzle', title: 'Museo 每日名畫拼圖', author: 'Pick The Wheel', url: 'https://pickthewheel.com/museo-art-printing-puzzle/', external: true, recommended: true },
    { id: 'lawn-master', title: 'Lawn Master 剪草大師', author: 'Pick The Wheel', url: 'https://pickthewheel.com/lawn-master/', external: true, recommended: true },
    { id: 'yakyolife', title: 'YaKyoLife 棒球人生模擬器', author: '最先生 Mr.TheMost', url: 'https://www.yakyolife.com/', external: true, recommended: true },
    { id: 'oil-restorer', title: '油畫修補師', author: 'smalldesire', url: 'https://oil-restorer.pages.dev/', external: true },
    {"id":"convenience-chaos","title":"超商店員崩潰中","author":"超商店員崩潰中（原站）","url":"https://convenience-chaos.pages.dev/","external":true},
    {"id":"taiwan-guessr","title":"台灣 Guessr","author":"台灣 Guessr","url":"https://taiwanguessr.com/","external":true},
    {"id":"windcity-sidewalk","title":"風城人行道","author":"stanfc","url":"https://stanfc.github.io/windcity-sidewalk/","external":true},
    {"id":"wok-hey","title":"鍋氣炒飯","author":"鍋氣炒飯（原站）","url":"https://wok-hey-fried-rice.vercel.app/","external":true},
    {"id":"doodle-pizza","title":"塗鴉披薩工房","author":"遊び道場","url":"https://asobi-dojo.com/oekaki-pizza/","external":true},
    {"id":"eyeball-master","title":"目測達人","author":"Asobi Lounge","url":"https://asobi-lounge.com/meibunryo","external":true},
    {"id":"mochi-moon","title":"麻糬回月亮","author":"Asobi Lounge","url":"https://asobi-lounge.com/mochi","external":true},
    { id: 'stay-on-track', title: '不出軌宣言 · Stay on Track', creator, url: 'https://aicooksyourbrain.com/stay-on-track/', cover: 'https://aicooksyourbrain.com/stay-on-track/og.jpg', external: true, viewport: { width: 390, height: 740 } },
    { id: 'badminton-iq', title: '羽球腦', creator, url: 'https://aicooksyourbrain.com/badminton-iq/', cover: 'https://aicooksyourbrain.com/badminton-iq/og.jpg', external: true, viewport: { width: 390, height: 740 } },
    { id: 'chihuahua-sim', title: '吉娃娃模擬器', author: '來源：chihuahua-sim.pages.dev', url: 'https://chihuahua-sim.pages.dev/', external: true, viewport: { width: 390, height: 740 } },
    { id: 'earth-online', title: '地球Online', author: '來源：a330900neo / GitHub Pages', url: 'https://a330900neo.github.io/EarthOnlinememe/', external: true, viewport: { width: 740, height: 390 } },
    { id: 'shanshenbu', title: '閃身步大亂鬥', author: '@flash_step666', url: 'https://shanshenbu.net/', external: true, viewport: { width: 740, height: 390 } },
    { id: 'doodle-coaster', title: '塗鴉雲霄飛車', author: '@kikuchitls', cover: 'https://playfeed-gilt.vercel.app/share-cards/doodle-coaster-preview.jpg', url: 'https://rakugaki-coaster.pages.dev/', external: true, viewport: { width: 390, height: 740 } },
    { id: 'conveyor-sushi', title: '迴轉壽司，壽司要逃跑！', author: 'Kei Games Studio', url: 'https://keigamesstudio.com/baka/nigeru/', external: true, viewport: { width: 390, height: 740, nativeSize: true } },
    { id: 'nurse-shift', title: '上班不要吃鳳梨：護理師輪班模擬', author: '來源：busy-nurse.vercel.app', url: 'https://busy-nurse.vercel.app/', external: true, viewport: { width: 390, height: 740 } },
    { id: 'rooftop-scaper', title: '頂樓加蓋 Scaper', author: '來源：rooftop-scaper.pages.dev', url: 'https://rooftop-scaper.pages.dev/', external: true, viewport: { width: 390, height: 740 } },
    { id: 'taiwan-sanbao-driver', title: '台灣三寶駕駛模擬器', author: '陳品叡', url: 'https://pinruichen.github.io/taiwan-sanbao-driver.html', external: true, viewport: { width: 390, height: 740 } },
    { id: 'spark-tap', title: '追光', author: 'PlayFeed 測試遊戲', url: './arcade.html#tap' },
    { id: 'memory-grid', title: '記憶方格', author: 'PlayFeed 測試遊戲', url: './arcade.html#memory' },

  ];
  // Recovered from publication records; code updates never bump a game.
  const originalPublicationTimes = {
    'yakyolife': '2026-11-10T20:52:17.000Z',
    'balcony-blanket': '2026-11-11T04:46:32.000Z',
    'mt24hr': '2026-11-11T04:46:32.000Z',
    'night-market-balloon': '2026-11-11T04:46:32.000Z',
    'fu3dai': '2026-11-11T03:52:46.000Z',
    'gold-miner': '2026-11-11T03:22:43.000Z',
    'slowboot': '2026-11-11T02:52:41.000Z',
    'footlife': '2026-11-11T02:22:38.000Z',
    'hk-red-van': '2026-11-11T01:22:56.000Z',
    'candle-clash': '2026-11-11T00:52:47.000Z',
    'fishing-fever': '2026-11-11T00:22:40.000Z',
    'konbini-rush': '2026-11-10T23:52:35.000Z',
    'konbini-cashier': '2026-11-10T22:52:41.000Z',
    'parking-panic': '2026-11-10T22:22:33.000Z',
    'museo-art-puzzle': '2026-11-10T21:52:18.000Z',
    'oil-restorer': '2026-11-10T14:54:02.000Z',
    'lawn-master': '2026-11-10T21:22:20.000Z',
    'convenience-chaos': '2026-11-10T14:33:18.000Z',
    'taiwan-guessr': '2026-11-10T14:33:18.000Z',
    'windcity-sidewalk': '2026-11-10T14:33:18.000Z',
    'wok-hey': '2026-11-10T14:33:18.000Z',
  };
  for (const game of games) game.published_at ||= originalPublicationTimes[game.id] || null;
  try {
    const published = await request('/playfeed_recommendations?select=id,title,url,author,creator_url,created_at&order=created_at.desc,id.desc');
    const existing = new Map(games.map(game => [new URL(game.url, baseUrl).href, game]));
    for (const game of published) {
      const url = new URL(game.url, baseUrl).href;
      const original = existing.get(url);
      if (original) {
        original.published_at ||= game.created_at;
      } else {
        const entry = { ...game, published_at: game.created_at, author: game.author || '來源：' + new URL(url).hostname, external: true, recommended: true };
        games.push(entry);
        existing.set(url, entry);
      }
    }
  } catch (error) {
    console.warn('推薦清單暫時無法載入', error);
  }
  // All catalog consumers (feed, profile, sharing and images) respect owner removals.
  const removal=await removalResult;
  if(removal.error||!Array.isArray(removal.data))throw new Error('遊戲清單暫時無法載入，請重新整理。');
  const removedUrls=new Set(removal.data.map(row=>row.game_url));
  // Stable ties retain the original batch order; legacy entries without a known date stay in their existing order.
  const time = game => Number.isFinite(Date.parse(game.published_at)) ? Date.parse(game.published_at) : 0;
  return games.filter(game=>!removedUrls.has(new URL(game.url,baseUrl).href)).sort((a, b) => time(b) - time(a));
}

if (typeof module !== "undefined") module.exports = { loadPlayfeedGames };

