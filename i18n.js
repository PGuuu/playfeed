(() => {
  'use strict';

  const STORAGE_KEY = 'playfeed-locale';
  const saved = localStorage.getItem(STORAGE_KEY);
  let locale = saved === 'en' || saved === 'zh-Hant'
    ? saved
    : ((navigator.languages?.[0] || navigator.language || '').toLowerCase().startsWith('zh') ? 'zh-Hant' : 'en');

  const en = {
    'PlayFeed 載入中': 'PlayFeed loading',
    '登入': 'Log in',
    '登出': 'Log out',
    '取消': 'Cancel',
    '返回': 'Back',
    '關閉': 'Close',
    '送出': 'Send',
    '留言': 'Comments',
    '留下你的 feedback…': 'Leave your feedback…',
    '個人頁': 'Profile',
    '遊戲': 'Games',
    '被追蹤': 'Followers',
    '追蹤中': 'Following',
    '編輯個人資料': 'Edit profile',
    '顯示名稱': 'Display name',
    '自我介紹': 'Bio',
    'https://你的網站': 'https://your-website.com',
    '儲存': 'Save',
    '自創': 'Created',
    '改造': 'Remixed',
    '按讚': 'Like',
    '倒讚': 'Dislike',
    '通知': 'Activity',
    '全部已讀': 'Mark all read',
    '搜尋': 'Search',
    '搜尋帳號或遊戲': 'Search accounts or games',
    '首頁': 'Home',
    '創作': 'Create',
    '個人': 'Profile',
    '切換遊戲': 'Switch games',
    '點一下開始': 'Tap to play',
    '預覽方式': 'Preview',
    '封面待機': 'Cover',
    '自動示範': 'Auto demo',
    'preview 只能是 cover 或 demo。': 'preview must be either cover or demo.',
    '切換這個分類的遊戲': 'Switch games in this section',
    '上一個遊戲': 'Previous game',
    '下一個遊戲': 'Next game',
    '二創這個遊戲': 'Remix this game',
    '換皮': 'Reskin',
    '玩法不變，替換角色或物件的外觀。': 'Keep the gameplay and replace the look of characters or objects.',
    '複製玩法創作': 'Create from gameplay',
    '複製玩法規格，交給自己的 AI 製作不同主題。': 'Copy the gameplay spec and use your own AI to create a different theme.',
    '上傳圖片替換遊戲元素（支援透明圖檔）。圖片會置中縮放、對齊虛線輪廓，並即時顯示在上面的畫面。儲存後會變成大家都能玩的新遊戲（需登入）。': 'Upload images to replace game elements (transparent images supported). Images are centered, scaled to the guide, and previewed live. Saving publishes a new playable game (login required).',
    '幫你的新版本取個名字': 'Name your new version',
    '儲存成新遊戲': 'Save as a new game',
    '登入 PlayFeed': 'Log in to PlayFeed',
    '輸入 Email，點信裡的連結就完成登入。': 'Enter your email and open the link we send you.',
    '登入後就能按讚、留言、把遊戲收進「我的頁面」。': 'Log in to like, comment, and save games to your profile.',
    '先不用，我玩玩就好': 'Not now, let me play',
    '寄登入連結給我': 'Send me a login link',
    '寄送中…': 'Sending…',
    '去收信！': 'Check your inbox!',
    '點信裡的連結，這個畫面會自動完成登入。': 'Open the link in the email to finish logging in.',
    '登入成功！': 'Logged in!',
    '已登出': 'Logged out',
    '追蹤': 'Follow',
    '已追蹤': 'Following',
    '更換頭貼': 'Change profile photo',
    '個人資料已儲存': 'Profile saved',
    '還沒有新通知。': 'No new activity yet.',
    '剛剛': 'Just now',
    '輸入遊戲名稱或創作者帳號': 'Enter a game title or creator account',
    '帳號': 'Accounts',
    '查看創作者頁面': 'View creator profile',
    '找不到符合的帳號或遊戲': 'No matching accounts or games',
    '還沒有自創遊戲。到「創作」貼上 Script，就能發布第一款。': 'No created games yet. Paste a Script in Create to publish your first game.',
    '還沒有改造遊戲。從 Feed 選一款支援改造的遊戲開始。': 'No remixes yet. Choose a remixable game from the feed.',
    '還沒有收藏。看到喜歡的遊戲按「儲存」。': 'Nothing saved yet. Tap Save on a game you like.',
    '還沒有按讚的遊戲。': 'No liked games yet.',
    '還沒有倒讚的遊戲。': 'No disliked games yet.',
    '已收藏到我的頁面 🔖': 'Saved to your profile 🔖',
    '載入中…': 'Loading…',
    '載入失敗，稍後再試': 'Could not load. Try again later.',
    '還沒有留言，搶頭香吧。': 'No comments yet. Be the first.',
    '連結已複製，貼給朋友挑戰吧': 'Link copied. Send it to a friend.',
    '精華圖已下載，文字連結也複製好了': 'Score image downloaded and link copied',
    '精華圖已下載': 'Score image downloaded',
    '成績與連結已複製': 'Score and link copied',
    '這款遊戲目前沒有玩法模板': 'This game does not have a gameplay template yet.',
    '請上傳圖片檔（支援透明圖檔）': 'Upload an image file (transparent images supported).',
    '圖片讀取失敗': 'Could not read the image.',
    '這款遊戲目前沒有可用的二創方式': 'This game has no available remix options.',
    '這款遊戲目前沒有提供可替換的外觀元素。': 'This game does not provide replaceable visual elements.',
    '原版': 'Original',
    '換一張': 'Replace',
    '上傳圖片': 'Upload image',
    '還原': 'Reset',
    '換好了！看上面的畫面 👆': 'Replaced! Check the preview above 👆',
    '先換上至少一張圖再儲存': 'Replace at least one image before saving.',
    '沒有可儲存的內容': 'There is nothing to save.',
    '發佈中…': 'Publishing…',
    '已發佈！這就是你的新遊戲 🎉': 'Published! Your new game is ready 🎉',
    '分數': 'Score',
    '最佳': 'Best',
    '分享': 'Share',
    '二創': 'Remix',
    '開始': 'Play',
    '重新玩': 'Play again',
    '新紀錄': 'New best',
    '成績圖產生中，再按一次': 'Score image is being prepared. Tap again.',
    '找不到這個遊戲': 'Game not found',
    '創作 PlayFeed': 'Create for PlayFeed',
    '五個步驟，': 'Five steps,',
    '發布一款遊戲。': 'publish a game.',
    '你可以使用 ChatGPT、Claude、Gemini 或任何工具創作。PlayFeed 只負責規格、驗證、試玩與發布。': 'Create with ChatGPT, Claude, Gemini, any other tool, or by hand. PlayFeed handles the spec, validation, playtesting, and publishing.',
    '玩法來源': 'Gameplay source',
    '複製創作規格': 'Copy creation spec',
    '複製 PlayFeed 的執行格式、平台 API、安全限制與操作邊界；玩法由你決定。': 'Copy PlayFeed’s runtime format, platform API, safety rules, and input boundaries. The gameplay is up to you.',
    '複製精簡的 PlayFeed Language 規格，交給自己的 AI 製作互動。': 'Copy the concise PlayFeed Language spec and give it to your own AI to create an interaction.',
    '複製遊戲創作規格': 'Copy game creation spec',
    '特殊玩法：複製完整 JavaScript 規格': 'Custom gameplay: copy full JavaScript spec',
    '✓ 已複製完整 JavaScript 規格': '✓ Full JavaScript spec copied',
    '完整 JavaScript 規格已複製': 'Full JavaScript spec copied',
    '交給自己的 AI 創作': 'Create with your own AI',
    '把規格貼給你使用的 AI，再告訴它你想製作什麼遊戲。它最後應只輸出一個完整 JavaScript 程式碼區塊。': 'Paste the spec into your AI and describe the game you want. It should output one complete JavaScript code block.',
    '把規格貼給你使用的 AI，再告訴它你想製作什麼互動。它最後應只輸出一個完整 PlayFeed 程式碼區塊。': 'Paste the spec into your AI and describe the interaction you want. It should output one complete PlayFeed code block.',
    '貼上生成的程式碼': 'Paste the generated code',
    '可以貼純 JavaScript，也可以直接貼含有單一程式碼區塊的完整回覆。': 'Paste plain JavaScript or a complete response containing one code block.',
    '可以貼 PlayFeed Language 或既有 JavaScript，也可以直接貼含有單一程式碼區塊的完整回覆。': 'Paste PlayFeed Language, existing JavaScript, or a complete response containing one code block.',
    '在這裡貼上完整的遊戲 Script': 'Paste the complete game Script here',
    '從剪貼簿貼上': 'Paste from clipboard',
    '全部刪除': 'Clear all',
    '驗證': 'Validate',
    'PlayFeed 會擷取顯示資料並檢查 Script；有問題時會產生可複製的修復報告。': 'PlayFeed extracts display data and checks the Script. If something is wrong, it creates a repair report you can copy.',
    '驗證遊戲 Script': 'Validate game Script',
    '正式作者與遊戲 ID 由平台建立，不採信 Script 裡的 author 與 id。': 'The platform assigns the official creator and game ID; author and id inside the Script are not trusted.',
    '試玩': 'Playtest',
    '驗證通過後，全螢幕試玩一次；往上滑或遊戲結束即可離開並發布。': 'After validation, playtest in full screen. Swipe up or finish the game to leave and publish.',
    '尚未驗證遊戲': 'Game not validated yet',
    '完整創作規格已複製': 'Full creation spec copied',
    '玩法模板與創作規格已複製': 'Gameplay template and creation spec copied',
    '✓ 已複製玩法模板': '✓ Gameplay template copied',
    '✓ 已複製創作規格': '✓ Creation spec copied',
    '程式碼已變更，請重新驗證': 'Code changed. Validate again.',
    '程式碼已全部刪除': 'Code cleared',
    '驗證中…': 'Validating…',
    '驗證未通過': 'Validation failed',
    '✓ 驗證通過': '✓ Validation passed',
    '重新驗證遊戲 Script': 'Validate game Script again',
    '用熟悉的玩法，': 'Use familiar gameplay',
    '做一款新遊戲。': 'to make a new game.',
    '保留核心互動，主題、角色與風格由你決定。PlayFeed 不會替你生成內容。': 'Keep the core interaction. The theme, characters, and style are up to you. PlayFeed does not generate the content.',
    '複製玩法模板': 'Copy gameplay template',
    '複製這款遊戲的玩法配方與 PlayFeed 執行規格。': 'Copy this game’s gameplay recipe and the PlayFeed runtime spec.',
    '告訴 AI 你的新主題': 'Give your AI a new theme',
    '把玩法模板貼給自己的 AI，再告訴它想換成什麼主題。它最後應只輸出一個完整 JavaScript 程式碼區塊。': 'Paste the gameplay template into your AI and describe the new theme. It should output one complete JavaScript code block.',
    '複製玩法模板＋創作規格': 'Copy gameplay template + creation spec',
    '↑ 往上滑離開試玩': '↑ Swipe up to leave playtest',
    '試玩完成，可以發布': 'Playtest complete. Ready to publish.',
    '已離開試玩，可以發布': 'Playtest closed. Ready to publish.',
    '試玩有執行錯誤，請先修正': 'The playtest had a runtime error. Fix it first.',
    '未通過 v1 驗證': 'Failed v1 validation',
    '需要修正 Script': 'Script needs fixes',
    '複製錯誤報告': 'Copy error report',
    '錯誤報告已複製': 'Error report copied',
    '複製修復規格＋原始 Script': 'Copy repair spec + original Script',
    '修復規格已複製': 'Repair spec copied',
    '查看擷取到的 Script': 'View extracted Script',
    '✓ 通過 v1 靜態驗證': '✓ Passed v1 static validation',
    '點一下文字欄位即可直接修改顯示資料': 'Tap a text field to edit its display data.',
    '遊戲名稱': 'Game title',
    '遊戲介紹': 'Game description',
    '一句話介紹': 'One-line description',
    '操作說明': 'How to play',
    '格式': 'Format',
    '結束方式': 'End condition',
    '依遊戲本身規則': 'Defined by the game',
    '操作類型': 'Controls',
    'Remix 元素': 'Remix elements',
    '無': 'None',
    '排行榜': 'Leaderboard',
    '愈高愈好': 'Higher is better',
    '愈低愈好': 'Lower is better',
    '版本': 'Version',
    '開始試玩': 'Start playtest',
    '試玩後即可發布': 'Playtest to unlock publishing',
    '先完成一次試玩，發布按鈕就會開啟。': 'Complete one playtest to enable publishing.',
    '發布': 'Publish',
    '✓ 已完成試玩，可以發布。': '✓ Playtest complete. Ready to publish.',
    '請先完成一次試玩': 'Complete a playtest first.',
    '發布中…': 'Publishing…',
    '這份 Script 的檔案過大，請精簡後再發布。': 'This Script is too large. Make it smaller before publishing.',
    '後端沒有回傳已發布的遊戲資料。': 'The server did not return the published game.',
    '發布成功！已加入 PlayFeed': 'Published! Your game is now on PlayFeed.',
    '玩家': 'Player',
    '我': 'Me',
    '@我': '@Me',
    '遊戲執行錯誤': 'Game runtime error',
    '執行錯誤': 'Runtime error',
    'PlayFeed 沙盒遊戲': 'PlayFeed sandbox game',
    '創作工具載入中，請再按一次': 'The creation tools are loading. Tap again.',
    '體驗模式：尚未連接後台，互動先不會被儲存': 'Demo mode: the backend is not connected, so interactions will not be saved.',
    '尚未連接後台，設定 config.js 之後留言就會是真的。': 'The backend is not connected. Comments will work after config.js is configured.',
    '請選擇 8MB 以下的 PNG、JPG 或 WebP 圖片': 'Choose a PNG, JPG, or WebP image under 8 MB.',
    '圖片壓縮後仍然太大': 'The image is still too large after compression.',
    '頭貼已更新': 'Profile photo updated',
    '請換一張圖片': 'Try another image',
    '開始追蹤你': 'started following you',
    '按讚了': 'liked',
    '儲存了': 'saved',
    '分 · 換你來破紀錄': ' pts · Can you beat it?',
    '語言': 'Language',
    '請先貼上完整的 JavaScript Script。': 'Paste a complete JavaScript Script first.',
    '請先貼上完整的 PlayFeed Language 或 JavaScript Script。': 'Paste a complete PlayFeed Language or JavaScript Script first.',
    '找到兩個以上的程式碼區塊。請只貼上一個完整 Script。': 'More than one code block was found. Paste exactly one complete Script.',
    'Markdown 程式碼圍欄不完整。請重新貼上完整 Script。': 'The Markdown code fence is incomplete. Paste the complete Script again.',
    '頂層必須且只能有一個 window.GAMES = (window.GAMES || []).concat([{ ... }]) 註冊。': 'The top level must contain exactly one window.GAMES = (window.GAMES || []).concat([{ ... }]) registration.',
    'apiVersion 必須是 1。': 'apiVersion must be 1.',
    '未填 gameVersion，發布時會使用 1.0.0。': 'gameVersion is missing; 1.0.0 will be used when publishing.',
    'title 不可超過 80 個字元。': 'title cannot exceed 80 characters.',
    'description 不可超過 240 個字元。': 'description cannot exceed 240 characters.',
    'tip 不可超過 160 個字元。': 'tip cannot exceed 160 characters.',
    'bg 必須是十六進位色碼。': 'bg must be a hexadecimal color.',
    'tags 必須是字串陣列。': 'tags must be an array of strings.',
    'controls 必須是至少含一項的字串陣列。': 'controls must be a non-empty array of strings.',
    'controls 包含垂直操作；垂直手勢必須保留給 Feed。': 'controls contains a vertical gesture; vertical gestures must remain available to the Feed.',
    'duration 只供平台估計；目前值無效，發布時會使用 45 秒。': 'duration is only an estimate. The current value is invalid, so 45 seconds will be used.',
    'score 必須包含 label，以及 higher 或 lower 的 order。': 'score must contain label and an order of higher or lower.',
    '每款遊戲都必須提供至少一個 remixSlots 換皮元素。': 'Every game must provide at least one remixSlots reskin element.',
    'remixSlots 的每一項都必須是物件。': 'Every remixSlots item must be an object.',
    'remixSlots.key 只能使用小寫英文字母、數字與連字號。': 'remixSlots.key may only contain lowercase letters, digits, and dashes.',
    '每個 remix slot 都需要 label。': 'Every remix slot needs a label.',
    '每個 remix slot 都需要 hint。': 'Every remix slot needs a hint.',
    'remixSlots.shape 必須是 free、circle、wide 或 tall。': 'remixSlots.shape must be free, circle, wide, or tall.',
    '已提供 remixSlots，但程式沒有使用 env.sprite() 繪製換皮元素。': 'remixSlots is provided, but env.sprite() is not used to draw reskin elements.',
    '缺少 create(env) 方法。': 'The create(env) method is missing.',
    'create(env) 必須回傳 GameInstance 物件。': 'create(env) must return a GameInstance object.',
    '遊戲內容不可使用 window。': 'Game code cannot use window.',
    '禁止動態 import。': 'Dynamic import is forbidden.',
    '禁止 while(true) 無限迴圈。': 'Infinite while(true) loops are forbidden.',
    '禁止沒有結束條件的 for 迴圈。': 'A for loop without an end condition is forbidden.',
    '沒有偵測到 env.over(score)。': 'env.over(score) was not detected.',
    '沒有偵測到 env.setScore(number)。': 'env.setScore(number) was not detected.',
    'input() 沒有安全處理 cancel。': 'input() does not safely handle cancel.',
    '這個 PlayFeed Script 沒有通過 v1 驗證。': 'This PlayFeed Script did not pass v1 validation.',
    '錯誤：': 'Errors:',
    '請依照 PlayFeed v1 規格修復以上問題，保留原本玩法，並重新輸出完整的單一 JavaScript 程式碼區塊。': 'Fix the issues above according to the PlayFeed v1 spec, preserve the original gameplay, and output one complete JavaScript code block again.'
  };

  const textOriginals = new WeakMap();
  const attributeOriginals = new WeakMap();

  function interpolate(value, vars = {}) {
    return String(value).replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
  }

  function patternEnglish(text) {
    let match;
    if ((match = text.match(/^第 (\d+) 行：(.+)$/))) return `Line ${match[1]}: ${t(match[2])}`;
    if ((match = text.match(/^(\d+) 分鐘前$/))) return `${match[1]}m ago`;
    if ((match = text.match(/^(\d+) 小時前$/))) return `${match[1]}h ago`;
    if ((match = text.match(/^(\d+) 天前$/))) return `${match[1]}d ago`;
    if ((match = text.match(/^遊戲結束 · (.+)$/))) return `Game over · ${match[1]}`;
    if ((match = text.match(/^執行錯誤：(.+) · 往上滑離開$/))) return `Runtime error: ${match[1]} · Swipe up to leave`;
    if ((match = text.match(/^發布失敗：(.+)$/))) return `Publish failed: ${match[1]}`;
    if ((match = text.match(/^發佈失敗：(.+)$/))) return `Publish failed: ${match[1]}`;
    if ((match = text.match(/^操作失敗：(.+)$/))) return `Action failed: ${match[1]}`;
    if ((match = text.match(/^儲存失敗：(.+)$/))) return `Save failed: ${match[1]}`;
    if ((match = text.match(/^送出失敗：(.+)$/))) return `Could not send: ${match[1]}`;
    if ((match = text.match(/^頭貼上傳失敗：(.+)$/))) return `Profile photo upload failed: ${t(match[1])}`;
    if ((match = text.match(/^(.+) 的留言$/))) return `Comments on ${match[1]}`;
    if ((match = text.match(/^二創《(.+)》$/))) return `Remix “${match[1]}”`;
    if ((match = text.match(/^這個遊戲的版本（(\d+)）：點縮圖直接玩$/))) return `${match[1]} versions · Tap one to play`;
    if ((match = text.match(/^Script 超過 (\d+) KB 上限。$/))) return `Script exceeds the ${match[1]} KB limit.`;
    if ((match = text.match(/^JavaScript 語法錯誤：(.+)$/))) return `JavaScript syntax error: ${match[1]}`;
    if ((match = text.match(/^缺少可直接讀取的 ([\w-]+) 字串。$/))) return `Missing a readable ${match[1]} string.`;
    if ((match = text.match(/^GameInstance 缺少 ([\w-]+)\(\)。$/))) return `GameInstance is missing ${match[1]}().`;
    if ((match = text.match(/^使用了禁止的 (.+)。$/))) return `Forbidden ${match[1]} is used.`;
    if ((match = text.match(/^remixSlots\.key 不可重複：(.+)$/))) return `Duplicate remixSlots.key: ${match[1]}`;
    if ((match = text.match(/^遊戲執行錯誤：(.+)$/))) return `Game runtime error: ${match[1]}`;
    return text;
  }

  function t(value, vars) {
    if (value === null || value === undefined) return '';
    const text = String(value);
    if (locale !== 'en') return interpolate(text, vars);
    return interpolate(en[text] || patternEnglish(text), vars);
  }

  function translateTextNode(node) {
    if (!textOriginals.has(node)) textOriginals.set(node, node.nodeValue);
    const original = textOriginals.get(node);
    const trimmed = original.trim();
    if (!trimmed) return;
    const translated = t(trimmed);
    const leading = original.match(/^\s*/)?.[0] || '';
    const trailing = original.match(/\s*$/)?.[0] || '';
    node.nodeValue = leading + translated + trailing;
  }

  function translateElement(element) {
    if (!(element instanceof Element)) return;
    if (element.matches('script,style,canvas')) return;
    let originals = attributeOriginals.get(element);
    if (!originals) {
      originals = {};
      attributeOriginals.set(element, originals);
    }
    for (const attr of ['placeholder', 'aria-label', 'title']) {
      if (!(attr in originals) && element.hasAttribute(attr)) originals[attr] = element.getAttribute(attr);
      if (attr in originals) element.setAttribute(attr, t(originals[attr]));
    }
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) translateTextNode(child);
      else if (child.nodeType === Node.ELEMENT_NODE) translateElement(child);
    }
  }

  function apply(root = document.body) {
    if (!root) return;
    document.documentElement.lang = locale === 'en' ? 'en' : 'zh-Hant';
    document.title = locale === 'en' ? 'PlayFeed — Play and swipe' : 'PlayFeed — 滑一下，玩一個';
    if (root.nodeType === Node.TEXT_NODE) translateTextNode(root);
    else translateElement(root);
    document.querySelectorAll('.language-toggle').forEach(button => {
      const label = locale === 'en' ? '中文' : 'EN';
      if (button.textContent !== label) button.textContent = label;
      button.setAttribute('aria-label', locale === 'en' ? '切換成中文' : 'Switch to English');
    });
  }

  function setLocale(next, reload = true) {
    if (next !== 'en' && next !== 'zh-Hant') return;
    localStorage.setItem(STORAGE_KEY, next);
    locale = next;
    if (reload) location.reload();
    else apply();
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('.language-toggle');
    if (!button) return;
    setLocale(locale === 'en' ? 'zh-Hant' : 'en');
  });

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) apply(node);
      }
    }
  });

  window.PlayFeedI18n = {
    get locale() { return locale; },
    t,
    apply,
    setLocale
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      apply();
      observer.observe(document.body, { childList: true, subtree: true });
    }, { once: true });
  } else {
    apply();
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
