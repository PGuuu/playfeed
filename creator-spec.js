export const FULL_SPEC = `# PlayFeed 遊戲創作規格 v1

PlayFeed 接收一個自足的 JavaScript Script。平台負責驗證、預玩與發布；你只需要完成遊戲。

## 1. 遊戲物件

Script 必須且只能註冊一款遊戲，格式如下：

\`\`\`js
window.GAMES = (window.GAMES || []).concat([
  {
    apiVersion: 1,
    gameVersion: '1.0.0',
    id: 'readable-id-suggestion',
    title: '遊戲名稱：短副標',
    description: '一句話介紹遊戲的情境與目標。',
    author: '@draft-only',
    tip: '一句話操作說明',
    bg: '#18354a',
    tags: ['timing', 'comedy'],
    controls: ['tap'],
    duration: 45,
    score: { label: '分數', order: 'higher', decimals: 0 },
    remixSlots: [
      { key: 'player', label: '主角', hint: '玩家控制的角色', default: '🧍', shape: 'free' }
    ],
    create(env) {
      // 回傳 GameInstance
      return {
        start() {},
        stop() {},
        input(type, x, y) {}
      };
    }
  }
]);
\`\`\`

正式作者、正式 ID、發布時間、審核狀態與統計由平台建立；author 與 id 只供草稿預覽。

## 2. Runtime API

- 邏輯畫布固定為 400 × 700。
- env.W / env.H：畫布尺寸。
- env.ctx：Canvas 2D context。
- env.setScore(number)：更新當局分數。
- env.over(finalScore)：結束當局；同一局只能呼叫一次。
- env.beep(fromHz, toHz, seconds, volume, waveType)：產生簡單音效。
- env.sprite(key, centerX, centerY, size, flip?)：請平台畫出 Remix 元素；有素材時回傳 true，否則回傳 false。
- 公開投稿不提供 env.getSprite。

GameInstance 必須包含：

- start()：每次開局重設全部狀態並開始。
- stop()：停止 requestAnimationFrame、timer 與其他循環。
- input(type, x, y)：處理 down / move / up / cancel。

可以先宣告三個函式，最後使用 \`return { start, stop, input }\`；create(env) 內的輔助函式也可以正常回傳座標、角色或其他資料物件。平台只把 create(env) 自己直接回傳的物件視為 GameInstance，不會把輔助函式的 \`return { ... }\` 誤認成遊戲實例。

cancel 代表平台接管手勢或遊戲被中止，只能解除按住狀態，不可觸發發射、結算等 up 行為。

## 3. 硬性限制

- 單一檔案、自足，不可載入圖片、字型、音訊或其他程式。
- 禁止 fetch、XHR、WebSocket、EventSource、Worker、動態 import。
- 禁止 document、navigator、location、parent、top、opener、globalThis。
- 禁止 localStorage、sessionStorage、indexedDB、cookie。
- 禁止 eval、Function、無限迴圈與修改平台 DOM。
- 不可使用垂直拖曳作為必要操作；垂直手勢保留給 Feed 換遊戲。
- duration 必須在 20～60 秒。
- 分數必須是有限數字；建議整數，絕對值不可超過 1,000,000,000。
- start() 必須可重複呼叫；over() 後不可再更新分數。

controls 可使用 tap、hold、horizontal-drag、left-right 或它們的組合。
score.order 使用 higher 或 lower；decimals 建議為 0。
remixSlots.shape 可使用 free、circle、wide、tall。

## 4. 極簡遊戲設計白皮書

一款適合 PlayFeed 的遊戲應該能被濃縮成：

「一個核心動作 + 一個持續壓力 + 一個 20～60 秒短循環。」

玩家每一秒都應該在做判斷，而不是只看動畫。核心動作必須有代價或取捨，例如：靠近障礙能得高分、關門太早會擋到好人、蓄力愈久愈強但更容易失敗。

建議節奏：

- 0～3 秒：安全展示因果。
- 3～12 秒：練習核心動作，容錯較高。
- 12～25 秒：用速度、數量、成功範圍或資源開始施壓。
- 25～40 秒：只加入一個新問題。
- 40～60 秒：組合玩家已經學會的問題，形成高潮。

難度旋鈕包含：速度、同時目標數、成功範圍、資源稀缺度、判斷模糊度、干擾程度、錯誤後果、舊機制組合數。

一次只介紹一個新問題，但可以組合多個玩家已學會的舊問題。不要只做「左右接住從上面掉下來的東西」；先說清楚玩家的獨特判斷與代價。

必須做到：

- 三秒內從畫面看懂目標與因果。
- 不看長教學也能開始。
- 每次操作立即有視覺或聲音回饋。
- 經常製造「差一點失敗」的時刻。
- 失敗原因清楚，能立刻重玩。
- 在隨機 down / move / up 輸入下仍看得出遊戲正在發生什麼，方便 Feed 自動預覽。
- Remix slot 要對應畫面中重要、常出現、值得替換的角色或物件。

只有互動動畫、沒有目標／風險／可比較結果的內容，不算完整遊戲。

## 5. 送出前檢查

- 恰好註冊一個遊戲物件。
- metadata 完整且全部可直接讀取，不靠函式計算。
- create(env) 回傳 start / stop / input。
- input 明確安全處理 cancel。
- 遊戲會呼叫 env.setScore() 與 env.over()。
- 所有循環能被 stop() 清掉。
- 沒有外部資源、網路、儲存或 DOM API。
- 沒有垂直必要操作。
- 20～60 秒內能形成完整節奏並結束。

最後只輸出一個完整 JavaScript 程式碼區塊，不要在程式碼前後加入解釋、教學、摘要或其他文字。`;

export function buildRepairPrompt(report, source) {
  return `# PlayFeed v1 修復規格

請修復下面的 PlayFeed Script，保留原本玩法與美術方向。

核心要求：
- 只能註冊一個 window.GAMES 遊戲物件。
- apiVersion 必須是 1。
- create(env) 必須回傳 start()、stop()、input(type,x,y)。
- input 必須分開處理 up 與 cancel。
- 只能使用 env.W、env.H、env.ctx、env.setScore、env.over、env.beep、env.sprite。
- 禁止網路、DOM、瀏覽器儲存、外部資源、Worker、eval 與無限迴圈。
- 垂直手勢保留給 Feed。
- 最後只輸出一個完整 JavaScript 程式碼區塊，不要加入其他文字。

驗證報告：
${report}

原始 Script：
\`\`\`js
${source}
\`\`\``;
}
