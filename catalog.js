async function loadPlayfeedGames(request = recommendationRequest, baseUrl = location.origin + "/") {
  // Preserve stored game URL identities across the domain migration.
  baseUrl = 'https://playfeed-gilt.vercel.app/';
  // Automatic first screens are loading assets only. Sharing stays owner-controlled.
  const preloadsResult=typeof window==='undefined'?Promise.resolve({}):fetch(new URL('/preload-assets.json',baseUrl)).then(r=>r.ok?r.json():{}).catch(()=>({}));
  const previewsResult=Promise.resolve().then(()=>request('/playfeed_game_previews?select=game_url,image_url,share_image_url,width,height,updated_at')).catch(()=>[]);
  const removalResult=Promise.resolve().then(()=>request('/playfeed_removed_games?select=game_url')).then(data=>({data}),error=>({error}));
  const metadataResult=Promise.resolve().then(()=>request('/playfeed_game_metadata?select=game_url,title,author,updated_at')).then(data=>({data}),error=>({error}));
  const creator = { name: '阿李阿斗 @ali_aaa_do', url: 'https://aicooksyourbrain.com/', hash: '#creator-ali-aaa-do' };
  const playfeed = { name: 'FanGame', url: 'https://fangame.app/', hash: '#creator-playfeed' };
  const games = [
    { id: 'paper-ink', title: '紙上 · 針筆畫室', creator: playfeed, author: 'FanGame', url: './games/paper-ink/index.html', published_at: '2026-11-24T00:00:00.000Z', viewport: { width: 390, height: 740 } },
    { id: 'brow-press', title: '按按眉心', creator: playfeed, author: 'FanGame', url: './games/brow-press/index.html', cover: '/share-cards/v4/brow-press.png', published_at: '2026-11-20T04:38:55.000Z', viewport: { width: 390, height: 740 } },
    { id: 'hammer-face', title: '敲一下！', creator: playfeed, author: 'FanGame', url: './games/hammer-face/index.html', published_at: '2026-11-18T06:00:00.000Z', viewport: { width: 390, height: 740 } },
    { id: 'light-switch', title: '幫我關燈', creator: playfeed, author: 'FanGame', url: './games/light-switch/index.html', cover: '/share-cards/v4/light-switch.png', published_at: '2026-11-15T07:55:06.000Z' },
    { id: 'sticker-chat', title: '寶貝，這張你有嗎？', author: 'FanGame', creator: playfeed, url: './games/sticker-chat/index.html', cover: '/share-cards/v4/sticker-chat.png', published_at: '2026-11-14T07:58:33.000Z', viewport: { width: 390, height: 740 } },
    { id: 'vanilla-cloud', title: '香草雲朵 Vanilla Cloud', author: 'FanGame', creator: playfeed, url: './vanilla.html', cover: '/share-cards/vanilla-cloud.png', published_at: '2026-11-13T04:16:00.000Z', viewport: { width: 390, height: 740 } },
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
    { id: 'spark-tap', title: '追光', author: 'FanGame 測試遊戲', url: './arcade.html#tap' },
    { id: 'memory-grid', title: '記憶方格', author: 'FanGame 測試遊戲', url: './arcade.html#memory' },

  ];
  const leluneBackyard = [
    { id: "lelune-mohuang-herb-shop", title: "莫慌本草堂", url: "https://mohuang-herb-shop.pages.dev/", cover: "https://world.lelunevale.com/assets/backyard/gameplay/mohuang-herb-shop.webp" },
    { id: "lelune-ama-hungry", title: "阿嬤覺得你會餓", url: "https://ama-hungry.culaliya-877.workers.dev/", cover: "https://world.lelunevale.com/assets/backyard/gameplay/ama-hungry.webp" },
    { id: "lelune-full-sugar-lab", title: "全糖實驗室", url: "https://full-sugar-lab.pages.dev/", cover: "https://world.lelunevale.com/assets/backyard/gameplay/full-sugar-lab.webp" },
    { id: "lelune-molten-gold-bench", title: "熔金：夜班金工台", url: "https://molten-gold-bench.pages.dev/", cover: "https://world.lelunevale.com/assets/backyard/gameplay/molten-gold-bench.webp" },
    { id: "lelune-tangerine-bowl", title: "橘子自帶碗", url: "https://tangerine-bowl.culaliya-877.workers.dev/", cover: "https://world.lelunevale.com/assets/backyard/gameplay/tangerine-bowl.webp" },
    { id: "lelune-craft-bistro-burger", title: "匠心鐵板漢堡屋", url: "https://craft-bistro-burger.culaliya-877.workers.dev/", cover: "https://world.lelunevale.com/assets/backyard/gameplay/craft-bistro-burger.webp" },
    { id: "lelune-bread-person-factory", title: "小麵包人繁殖工廠", url: "https://bread-person-factory.culaliya-877.workers.dev/", cover: "https://world.lelunevale.com/assets/backyard/gameplay/bread-person-factory.webp" },
    { id: "lelune-knit-for-you", title: "織給你", url: "https://knit-for-you.pages.dev/", cover: "https://world.lelunevale.com/assets/backyard/gameplay/knit-for-you.webp" },
    { id: "lelune-aye-moon-kiln", title: "穿越了，只好煉丹", url: "https://world.lelunevale.com/tiny-worlds/aye-moon-kiln/", cover: "https://world.lelunevale.com/assets/backyard/gameplay/aye-moon-kiln.webp" },
    { id: "lelune-aye-cretaceous-mudwatch", title: "白堊紀・泥灘守夜", url: "https://world.lelunevale.com/tiny-worlds/aye-cretaceous-mudwatch/", cover: "https://world.lelunevale.com/assets/backyard/gameplay/aye-cretaceous-mudwatch.webp" },
    { id: "lelune-aye-cretaceous-rivercall", title: "白堊紀・河霧裡的長鳴", url: "https://world.lelunevale.com/tiny-worlds/aye-cretaceous-rivercall/", cover: "https://world.lelunevale.com/assets/backyard/gameplay/aye-cretaceous-rivercall.webp" },
    { id: "lelune-aye-pluto-ice-traverse", title: "冥王星・冰谷回聲", url: "https://world.lelunevale.com/tiny-worlds/aye-pluto-ice-traverse/", cover: "https://world.lelunevale.com/assets/backyard/gameplay/aye-pluto-ice-traverse.webp" },
    { id: "lelune-douhua-stall", title: "老樣子豆花攤", url: "https://world.lelunevale.com/tiny-worlds/douhua-stall/", cover: "https://world.lelunevale.com/assets/backyard/gameplay/douhua-stall.webp" },
    { id: "lelune-crustacean-harbor", title: "甲殼海鮮攤", url: "https://crustacean-harbor.pages.dev/", cover: "https://world.lelunevale.com/assets/backyard/gameplay/crustacean-harbor.webp" },
    { id: "lelune-scone-shop-chaos", title: "司康出爐了沒？", url: "https://scone-shop-chaos.pages.dev/", cover: "https://world.lelunevale.com/assets/backyard/gameplay/scone-shop-chaos.webp" },
    { id: "lelune-jintian-kaidian", title: "今天我們開店", url: "https://jintian-kaidian.vercel.app/", cover: "https://world.lelunevale.com/assets/backyard/gameplay/jintian-kaidian.webp" },
    { id: "lelune-wintercrown-atelier", title: "冬冠織坊", url: "https://wintercrown-atelier.pages.dev/", cover: "https://world.lelunevale.com/assets/backyard/gameplay/wintercrown-atelier.webp" },
    { id: "lelune-meow-this-is-mine", title: "喵的，這塊我的！", url: "https://world.lelunevale.com/backyard/games/meow-this-is-mine/", cover: "https://world.lelunevale.com/assets/backyard/gameplay/meow-this-is-mine.webp", outboundOnly: "download" },
    { id: "lelune-dream-box-the-tenth-door", title: "Dream Box: The Tenth Door", url: "https://html-classic.itch.zone/html/20229308/index.html?v=1793622724", cover: "https://world.lelunevale.com/assets/backyard/gameplay/dream-box-the-tenth-door.webp" },
    { id: "lelune-mao-jieguo", title: "貓，借過一下", url: "https://mao-jieguo.vercel.app/", cover: "https://world.lelunevale.com/assets/backyard/gameplay/mao-jieguo.webp" },
    { id: "lelune-temple-keeper-no-overtime", title: "Temple Keeper: No Overtime Today", url: "https://temple-keeper-no-overtime.pages.dev/", cover: "https://world.lelunevale.com/assets/backyard/gameplay/temple-keeper-no-overtime.webp" },
    { id: "lelune-toga-rex-toilet-oracle", title: "托加暴龍與馬桶神諭", url: "https://toga-rex-toilet-oracle.pages.dev/", cover: "https://world.lelunevale.com/assets/backyard/gameplay/toga-rex-toilet-oracle.webp" },
    { id: "lelune-seven-realms-chess", title: "七境棋旅", url: "https://seven-realms-chess.pages.dev/", cover: "https://world.lelunevale.com/assets/backyard/gameplay/seven-realms-chess.webp" },
    { id: "lelune-shanhai-sanctuary", title: "山海經動物園 · 青丘水院", url: "https://shanhai-sanctuary.pages.dev/", cover: "https://world.lelunevale.com/assets/backyard/gameplay/shanhai-sanctuary.webp" },
    { id: "lelune-witchs-halloween-shop", title: "女巫的萬聖夜雜貨店", url: "https://world.lelunevale.com/little-worlds/witch-shop/", cover: "https://world.lelunevale.com/assets/backyard/gameplay/witchs-halloween-shop.webp" },
    { id: "lelune-nolight-night-orderly", title: "忌向：無光之域", url: "https://horror.lelunevale.com/play/nolight-night-orderly/#player", cover: "https://horror.lelunevale.com/media/nolight-night-orderly.webp", outboundOnly: "play" },
    { id: "lelune-seven-chimes", title: "第七聲，開飯", url: "https://horror.lelunevale.com/play/seven-chimes/", cover: "https://horror.lelunevale.com/media/seven-chimes.webp", outboundOnly: "play" },
    { id: "lelune-wuzuo", title: "無座", url: "https://horror.lelunevale.com/play/wuzuo/", cover: "https://horror.lelunevale.com/media/wuzuo.webp", outboundOnly: "play" },
    { id: "lelune-last-exit", title: "末班出口", url: "https://horror.lelunevale.com/play/last-exit/", cover: "https://horror.lelunevale.com/media/last-exit.webp", outboundOnly: "play" },
    { id: "lelune-luna-park", title: "廢棄深夜遊樂園", url: "https://horror.lelunevale.com/play/luna-park/", cover: "https://horror.lelunevale.com/media/luna-park.webp", outboundOnly: "play" },
    { id: "lelune-blackthorn", title: "真的是鬼屋", url: "https://horror.lelunevale.com/play/blackthorn/", cover: "https://horror.lelunevale.com/media/blackthorn.webp", outboundOnly: "play" },
    { id: "lelune-gravekeeper", title: "認真的守墓鵝", url: "https://horror.lelunevale.com/play/gravekeeper/", cover: "https://horror.lelunevale.com/media/gravekeeper.webp", outboundOnly: "play" },
    { id: "lelune-code-philosophy", title: "程式碼哲學空間", url: "https://horror.lelunevale.com/play/code-philosophy/", cover: "https://horror.lelunevale.com/media/code-philosophy.webp", outboundOnly: "play" },
    { id: "lelune-next-stop", title: "永遠的下一站", url: "https://horror.lelunevale.com/play/next-stop/", cover: "https://horror.lelunevale.com/media/next-stop.webp", outboundOnly: "play" },
    { id: "lelune-dont-greet", title: "不要和不存在的人打招呼", url: "https://horror.lelunevale.com/play/dont-greet/", cover: "https://horror.lelunevale.com/media/dont-greet.webp", outboundOnly: "play" },
    { id: "lelune-after-school", title: "放學後17:47：最後一個醒來的人", url: "https://horror.lelunevale.com/play/after-school/", cover: "https://horror.lelunevale.com/media/after-school.webp", outboundOnly: "play" },
    { id: "lelune-mini-cabinet", title: "迷你鬼屋標本箱", url: "https://horror.lelunevale.com/play/mini-cabinet/", cover: "https://horror.lelunevale.com/media/mini-cabinet.webp", outboundOnly: "play" },
    { id: "lelune-spiral", title: "無盡的樓梯", url: "https://horror.lelunevale.com/play/spiral/", cover: "https://horror.lelunevale.com/media/spiral.webp", outboundOnly: "play" },
    { id: "lelune-sundown", title: "SUNDOWN ROAD", url: "https://horror.lelunevale.com/play/sundown/", cover: "https://horror.lelunevale.com/media/sundown.webp", outboundOnly: "play" },
    { id: "lelune-castle", title: "城堡：房間會記得", url: "https://horror.lelunevale.com/case/castle/", cover: "https://horror.lelunevale.com/media/castle.webp", outboundOnly: "download" },
    { id: "lelune-flight-zero", title: "第零航班：餐飲服務已結束", url: "https://horror.lelunevale.com/play/flight-zero/", cover: "https://horror.lelunevale.com/media/flight-zero.webp", outboundOnly: "play" },
    { id: "lelune-brass-leviathan", title: "黃銅蒸汽輪船密室", url: "https://horror.lelunevale.com/play/brass-leviathan/", cover: "https://horror.lelunevale.com/media/brass-leviathan.webp", outboundOnly: "play" },
    { id: "lelune-after-hours-stacks", title: "閉館請走防火梯", url: "https://horror.lelunevale.com/play/after-hours-stacks/", cover: "https://horror.lelunevale.com/media/after-hours-stacks.webp", outboundOnly: "play" },
  ];
  const lelune = { name: 'AYE & LELUNE', url: 'https://world.lelunevale.com/backyard.html', hash: '#creator-lelune-backyard' };
  for (const game of leluneBackyard) {
    games.push({ ...game, creator: lelune, author: lelune.name, external: true, published_at: '2026-11-26T12:57:00.000Z' });
  }

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
    const published = await request('/playfeed_recommendations?select=id,title,url,author,creator_url,created_at,preload_image_url&order=created_at.desc,id.desc');
    const existing = new Map(games.map(game => [new URL(game.url, baseUrl).href, game]));
    for (const game of published) {
      const url = new URL(game.url, baseUrl).href;
      const original = existing.get(url);
      if (original) {
        original.published_at ||= game.created_at;
        if(game.preload_image_url)original.preload_image=game.preload_image_url;
      } else {
        const entry = { ...game,preload_image:game.preload_image_url, published_at: game.created_at, author: game.author || '來源：' + new URL(url).hostname, external: true, recommended: true };
        games.push(entry);
        existing.set(url, entry);
      }
    }
  } catch (error) {
    console.warn('推薦清單暫時無法載入', error);
    throw error;
  }
  // One authoritative display record for static games and recommendations alike.
  const metadata=await metadataResult;
  if(metadata.error||!Array.isArray(metadata.data))throw new Error('遊戲資料暫時無法載入，請重新整理。');
  const metadataByUrl=new Map(metadata.data.map(row=>[row.game_url,row]));
  for(const game of games){
    const row=metadataByUrl.get(new URL(game.url,baseUrl).href)||metadataByUrl.get(new URL(game.url,'https://playfeed-gilt.vercel.app/').href);
    if(!row)continue;
    game.title=row.title;
    game.author=row.author;
    game.creator_url ||= game.creator?.url;
    game.creator=undefined;
    game.metadata_updated_at=row.updated_at;
  }
  const previews=new Map((await previewsResult).map(row=>[row.game_url,row]));
  const preloads=await preloadsResult;
  for(const game of games){
    const preload=preloads[new URL(game.url,'https://playfeed-gilt.vercel.app/').href];
    if(preload&&!game.preload_image)game.preload_image=preload.image;
    const row=previews.get(new URL(game.url,baseUrl).href)||previews.get(new URL(game.url,'https://playfeed-gilt.vercel.app/').href);
    if(row){game.preview_image=row.image_url;game.share_image=row.share_image_url;game.cover=row.image_url;game.preview_width=row.width;game.preview_height=row.height;}
  }
  // All catalog consumers (feed, profile, sharing and images) respect owner removals.
  const removal=await removalResult;
  if(removal.error||!Array.isArray(removal.data))throw new Error('遊戲清單暫時無法載入，請重新整理。');
  const removedUrls=new Set(removal.data.map(row=>row.game_url));
  // Stable ties retain the original batch order; legacy entries without a known date stay in their existing order.
  const time = game => Number.isFinite(Date.parse(game.published_at)) ? Date.parse(game.published_at) : 0;
  for (const game of games) game.url = new URL(game.url, baseUrl).href;
  for (const game of games) game.slug = readableGameSlug(game);
  return games.filter(game=>!removedUrls.has(new URL(game.url,baseUrl).href)).sort((a, b) => time(b) - time(a));
}


// Public URL names are pinned so title/source edits never break shared links.
const GAME_PUBLIC_SLUGS = {
  "hammer-face": "hammer-face",
  "60f6b2bb-9eed-4343-8044-0890c8a9663e": "slowpoke",
  "b7b7412f-5817-4cd6-8d52-0b4b965c4b0e": "hamelin",
  "fbe586c6-91f2-43ef-95c7-eac861d44335": "carpet",
  "44bcaef1-16ff-4937-8299-21a20be1d855": "red-bean-lab-dumpling",
  "527c43c2-599a-4a2e-8258-d361c693750a": "slaycure",
  "d5633f2f-ea28-428e-bc2b-5d48e63aba37": "marble-knockout",
  "ad4185ab-081c-4c8a-b2d6-d058396f0689": "taroca-sky",
  "6cc75af3-9f4f-4ff2-9ebe-fef70881a599": "world-destroyer",
  "1208c084-6a9f-48a6-9cbb-3164044654b1": "fashion-master",
  "06baed68-895a-4862-8859-440b1b964e87": "nekolike-coin-pusher",
  "fd97dbe6-34ee-4645-8f76-b44b57e81fea": "adhd-life",
  "1623526a-41d6-4b56-a548-1184ca8f6f8d": "bobing",
  "9887c019-12eb-46c8-89e8-5790b64271da": "slidespuzzle",
  "13be422e-1516-4ed5-81aa-4d8ef8a5d81e": "math-fun-kids",
  "f0cf1c6a-e976-4e5e-bad2-cceb181dccf2": "clumsy-bird",
  "f2c1fbc1-eb0e-4d1b-966c-1883384c84b3": "15puzzle",
  "fb6af3fa-532f-4a69-a826-12c28c19d4f6": "daisy-xray",
  "f20eaec0-61e7-45b9-8330-cb98d6d9f444": "daisy-catch",
  "c679d47d-7a48-4af2-aa03-c5442602d5c4": "daisy-dinner",
  "b090ca7f-96e2-49c1-b174-2f0e9200941b": "daisy-stamp",
  "8c3915ea-4d73-466e-b9f5-1df1999c48bd": "daisy-litter",
  "4817cdbc-eb97-4185-ab22-bbb504d76e5c": "daisy-meow",
  "304357b6-31ef-4cb2-ad75-1f3feac701f7": "daisy-color",
  "8dce4664-a1a7-452b-981b-5aba805d499a": "daisy-buttons",
  "e08dc15a-7172-4120-97e1-47e998481cf1": "station-maze",
  "2e86c85a-5194-4980-b55a-670c3e12e4a6": "daisy-beads",
  "6ee181aa-ff07-4411-b112-f3f463887c85": "dianshi",
  "ebd7f4b0-a36b-46e2-8ca5-256024f504f9": "oyster-sim",
  "69fdb773-47c8-4d61-bc17-def5d4a72af5": "lifesim1",
  "cae5214f-6dde-40b6-9f12-9a6daec7d705": "chocostick",
  "0601b3fd-cf5d-4408-bd7d-35dc207184ad": "beibei",
  "3bebf6b5-0bb9-4814-8c46-9ed16f727032": "daisy-paint",
  "fbe1052e-a284-415e-ae49-c36495291cac": "zombie-deduction",
  "deec12c5-574c-4d23-be24-28170d722382": "mrt-line-tap",
  "d61ebb28-bacf-4730-a0c1-4d6a7c642e79": "isittaiwan",
  "c8cb237e-ab99-4a48-b872-1a36a3e0ab41": "recycle-challenge",
  "c8ad3ac9-830d-4016-a18b-17cc7ad84276": "finger-rasengan",
  "c478a000-fd32-4c69-99ca-a060d7555f65": "everyday-is-good",
  "c29cf932-2313-4689-b8ce-22b7e176133c": "mrt-direction",
  "b89da42a-c578-45fb-b6a8-f4bf49e4d2c4": "shopping-spree",
  "98e34041-779f-4ca0-acfc-c8972b3c7aef": "tiny-pottery",
  "60d18ff8-a656-44ae-8e85-2093db40445e": "traffic-light-game",
  "34d8d4ba-f3e3-46a6-a34d-46074d6b8722": "popdarts-mini-game",
  "2de60a88-7ed9-4b25-b740-4e58f7b4dfce": "shiba-not-home",
  "2bd2af65-2b82-4f3f-b856-1641c324de1c": "gradient-track",
  "13a3583d-6c19-49c5-8759-67bf61c07596": "mrt-challenge-guide",
  "0f31237d-d418-4f2e-a9be-e895048fe038": "mrt-challenge",
  "a1d275db-1165-4a1e-b6f2-2d26a7182b4d": "inme-escape",
  "256ed354-2d57-41ef-8fe2-867a5d92f908": "nemo",
  "light-switch": "light-switch",
  "edd498a3-8db7-400d-a820-671f8efdf74c": "dubaimochi",
  "af77a09e-5d45-4f7f-9793-fa2fd85edf8e": "whats-this-money-for",
  "7dd8efd6-602d-4591-932e-af977f86c154": "dumpling",
  "75abc2b2-b483-405a-8cd1-85b804651ce5": "teashop",
  "8ff80908-0407-4fc9-8a5b-f069df4694de": "translation-text-oddities",
  "25f07fef-5831-4440-ab4b-8e0dccfbf91a": "kylehsia-apps",
  "d56d1dc5-00e6-4274-80a5-297b1dee4021": "dive-valley",
  "53dde9bf-d618-4e87-a3e0-63fea3789483": "s-drama-maker",
  "sticker-chat": "sticker-chat",
  "0a7e6320-eeb5-4153-abee-cec3746c2999": "gyoza",
  "8c9e06a3-0116-4af5-b229-e15de0ac8b4c": "braised-pork-rice-master",
  "f4383b3d-9186-426e-98ad-ca218cc37f7e": "eggcake",
  "cc720624-8ceb-4702-8fc9-e7478d382390": "bubble-shooter-game",
  "692e24fc-e477-4d6a-b1a7-695a3da783a1": "snake-game",
  "abdeb266-24c6-45ee-a60b-da268d41593e": "modern-tetris",
  "42ee5cb5-065b-4c50-982a-b9ed6d14fb87": "mines",
  "350e6671-8ce4-4d27-8f5c-e2d52cef76da": "pacman-pwa",
  "fdfc08d5-6a1c-4bdc-b4e3-45ef70edb77f": "snake",
  "faa7c9a8-2837-40be-b6d9-24e3933920bd": "playminesweeper",
  "a67e80a1-96aa-487c-bfc9-e62f5b3d9978": "toilet-escape",
  "5a5e5287-287f-4ac7-af38-c0d814ea053c": "wildlife-origins-play",
  "8042906b-173b-4fdf-8a44-3c6d9ada6cac": "taipeibike",
  "23d59911-c427-435f-adf1-302cc2ff5601": "pc-entrepreneur",
  "3c43562e-4034-4ca2-89be-d25afafd1bac": "youth-growth",
  "a29fa899-dd93-4274-af82-5e9ec480e5c4": "f1-career-simulator",
  "94ece5a6-e33c-4a63-97ac-54264d7c9102": "raising-a-kid",
  "0f494c93-0dbf-4fd0-990e-06b6de1f61ca": "carball",
  "b0ee84d0-0618-43cd-a26f-a46b43489280": "situationship",
  "d42be236-f091-4c2f-aa82-829f10171f62": "taiwansaga-quiz",
  "2f8dbb01-644a-4348-8f94-0123d70a1c41": "edwina-demo1",
  "f04ceee1-ec15-4a95-94af-54e25eb14c63": "ufo-street-smash",
  "6c7af878-b12a-45e2-9cf9-9c03d09a544f": "pimple-pop-clinic",
  "d9880068-d22b-46ed-b2a8-b8ecfa90cccc": "bento",
  "1becf2db-9807-4f63-b191-8246af26a23c": "liferetry",
  "9f9b3d3c-2e83-4acb-bd09-1a73f6c3199a": "perfectpitchtw",
  "90af69ae-943c-4a0f-b66c-0d065c232182": "rough99-haircolorgame",
  "cf1df37e-ab59-49fe-ad82-6a326031a9b1": "daisy-pop",
  "a9eb09c3-fba7-45ef-91f3-72d974591acc": "mountain-school",
  "514d1500-e715-45c7-ad80-10c0b348d9c6": "souffle",
  "c3d101df-272d-457f-9834-9a6d8bbb27ba": "catgroup-shawarma",
  "84964fe3-bbae-4513-9719-a56457552262": "boxsum",
  "eb69ed52-f745-49b3-95f3-06920c9ab5a8": "baodao-monsters",
  "aaad242d-7a17-4839-a743-72dc38379660": "bossisout",
  "a4b27309-1c0c-4282-8893-7cdcd5543b00": "train-sim-hk",
  "vanilla-cloud": "vanilla-cloud",
  "13905965-6978-451f-98f4-1be81e4c809d": "chop-chop-siu-mei",
  "7490ff89-ddd5-4c38-9d85-c5ae45272406": "rush",
  "e6d94217-a969-4e53-a8ca-d2676a7d04c9": "brake-test",
  "0ee25661-8d41-401c-9371-18c987b0cd95": "cornerlab",
  "3d89b0fe-5952-488d-83ee-ca97e43f0c19": "taiwan-prehistory-shihsanhang",
  "fcf55af8-951a-4874-85d8-f3ad52befd1b": "group-survival",
  "5ab97dda-9119-4599-a533-ddf21b1922d9": "daisy-pack",
  "6bc82192-e375-4c8d-bce5-e65243696eba": "kaisendon",
  "f1f6c1d2-563e-4414-bb2c-c982cfb79075": "geotw",
  "a8cb0963-9fb1-4edd-a660-13335a81c31e": "steak",
  "57baf5af-701b-4a9d-a572-4dde55723cb0": "fermentedtofustall",
  "d481728e-de9f-43d8-9664-7503117f658c": "tea-egg",
  "1683dccd-ac56-41cb-bd54-bac6d16612e7": "taiwan-beef-noodle-kitchen",
  "ae6ae5f6-225f-451e-8ad9-627809e8e325": "petlife1in2billion",
  "5a93312b-53fd-4dba-97e0-c9b25f3424a3": "latte",
  "c462a823-cb74-4e18-a55c-17c6964bc624": "3d-game",
  "8de187bf-290d-4881-9fee-67173572706e": "qinghe-mail",
  "6d327876-d6ae-4bfe-ad78-030387877f4f": "volvo-driving-lab",
  "cd0200c4-4bdf-4037-9fe3-314fa20bb5d1": "bianshu",
  "3b6fb300-3ae0-4578-a78b-59e9eb3fad97": "15cm",
  "16cec917-f79e-469f-afc3-1c57da3a430a": "yilan-policy-map",
  "c980eb06-b7fd-4679-96ed-5e9bbed18243": "mlb",
  "7df81ddb-5347-4556-92e1-d87c80723d0e": "witch-and-bear-fish-catch",
  "cdec6995-6833-44a2-95f7-42ba1b25885a": "bingxiang",
  "deca5d34-ca71-47ef-a7fe-431b4efdf7a0": "zh-hant",
  "3afb5905-7daf-4526-afec-99adcb736760": "herbmaze",
  "c86d888c-7961-48f8-a8d0-2c664faa699f": "daiwan-grading-play",
  "15b9a633-4f17-4c7a-8099-5909e52586d7": "bubblespop",
  "f548e8f1-9caa-4e11-8b29-675b75f08a87": "daybreak-orcin",
  "a4ed7791-7dad-4972-8dee-408e91a80d7a": "height",
  "9b8b6fdd-049c-4ae9-9aa4-ae2021737f12": "pit-window",
  "f1743680-f2d9-4e7b-9685-123a687244ad": "color-hue-test",
  "28e65772-7984-4acc-aded-5d1954c4fe77": "1157",
  "b559d44c-d3a2-4124-b04c-01956713bd26": "thekingofall",
  "738fd113-a8b6-4896-a280-8100f7fbe041": "sand-pixel-sorter",
  "8c19c124-5b47-4e8c-bddb-e5182734b695": "relic-caravan",
  "96ccd39a-6ab3-433a-85ce-0573fb9a3ffb": "shotengai-tycoon",
  "015752d9-876d-4fb2-99dc-f28fcfb3a51f": "taiwan-procession",
  "74605b37-88fe-4293-b43f-60a18e889469": "cpr-game",
  "7547e266-afd3-4d7b-b740-7f2b8b8feb1a": "oitt-zh-hant",
  "058b29be-fcea-4f75-86f2-4d1ac64a0b84": "caacaanteng",
  "243e8047-b405-47ce-a744-47c585f7dd73": "neon-wasteland-last-outpost",
  "3a228659-d748-4ca9-975b-aabc5f348077": "beyond-the-door",
  "f5de85f2-99b5-49d5-81c1-cce7732dc3f7": "pillowspy",
  "5df77cc7-3fa9-46ce-aea0-d1faf8f74902": "wage-slave",
  "8c8b9f88-0ba5-491e-b175-61edf21de7cd": "zhennai",
  "591259c4-244a-4320-bfe9-4abb65230d61": "brothmaster",
  "5a056e4d-aaa5-4bf2-8ef5-d650ee86e6ff": "2026chef",
  "a4552577-bbee-4c7f-a1a0-47323515b04a": "sengoku-samoyed",
  "luck-rolls": "luck-rolls",
  "taistorm": "taistorm",
  "balcony-blanket": "balcony-blanket",
  "mt24hr": "mt24hr",
  "night-market-balloon": "night-market-balloon",
  "fu3dai": "fu3dai",
  "448bae23-268f-4811-b908-5f0e5cacb308": "uuumpire",
  "a07fe895-18dc-4ee8-bd75-adf6d67d70a3": "mizukiri",
  "3036594e-d54b-4c56-853c-2f4a8d4afcd9": "ringo-no-kawamuki",
  "2ea6cd98-1b06-4793-bcc0-82f58ab8de36": "softserve",
  "gold-miner": "gold-miner",
  "slowboot": "slowboot",
  "footlife": "footlife",
  "hk-red-van": "hk-red-van",
  "candle-clash": "candle-clash",
  "fishing-fever": "fishing-fever",
  "konbini-rush": "konbini-rush",
  "konbini-cashier": "konbini-cashier",
  "parking-panic": "parking-panic",
  "museo-art-puzzle": "museo-art-puzzle",
  "lawn-master": "lawn-master",
  "yakyolife": "yakyolife",
  "2c745de2-3b55-4d1e-aae6-f14ec3870b5b": "tooth-out-words-off",
  "f057bd54-db9f-4456-bc63-7da8fbcfa5cc": "malatanggame",
  "e01a80fd-783d-4582-99eb-a8edd5caa3fb": "kugi-uchi",
  "oil-restorer": "oil-restorer",
  "convenience-chaos": "convenience-chaos",
  "taiwan-guessr": "taiwan-guessr",
  "windcity-sidewalk": "windcity-sidewalk",
  "wok-hey": "wok-hey",
  "doodle-pizza": "doodle-pizza",
  "eyeball-master": "eyeball-master",
  "stay-on-track": "stay-on-track",
  "badminton-iq": "badminton-iq",
  "chihuahua-sim": "chihuahua-sim",
  "earth-online": "earth-online",
  "shanshenbu": "shanshenbu",
  "doodle-coaster": "doodle-coaster",
  "conveyor-sushi": "conveyor-sushi",
  "nurse-shift": "nurse-shift",
  "rooftop-scaper": "rooftop-scaper",
  "taiwan-sanbao-driver": "taiwan-sanbao-driver",
  "spark-tap": "spark-tap",
  "memory-grid": "memory-grid"
};
function readableGameSlug(game) {
  if (GAME_PUBLIC_SLUGS[game.id]) return GAME_PUBLIC_SLUGS[game.id];
  const url = new URL(game.url, "https://fangame.app/");
  const parts = url.pathname.split("/").filter(Boolean).filter(p => !/^(index\.html?|game\.html?|play|embed|en|zh(-tw)?)$/i.test(p));
  const name = (parts.pop() || url.hostname.replace(/^www\./, "").split(".")[0]).toLowerCase().replace(/\.html?$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0,60) || "game";
  return name + "-" + String(game.id).replace(/[^a-z0-9]/gi, "").slice(0,8).toLowerCase();
}

if (typeof module !== "undefined") module.exports = { loadPlayfeedGames, readableGameSlug };



