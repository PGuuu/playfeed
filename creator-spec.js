export const FULL_SPEC = `# PlayFeed 遊戲創作規格 v1

PlayFeed 接收一個自足的 JavaScript Script，負責驗證、預玩與發布。

這份規格只定義遊戲如何在 PlayFeed 執行，不限制題材、玩法、類型或創作方向。請忠實發展使用者的點子，選擇適合它的互動方式；經典玩法與新玩法都可以。不要把下方欄位、程式骨架或 API 名稱當成玩法範例，也不要自行加入使用者沒有要求的設計公式。

## 1. Script 格式

Script 必須且只能註冊一款遊戲：

\`\`\`js
window.GAMES = (window.GAMES || []).concat([
  {
    apiVersion: 1,
    gameVersion: '1.0.0',
    id: 'readable-id-suggestion',
    title: '遊戲名稱',
    description: '一句話介紹',
    author: '@draft-only',
    tip: '一句話操作說明',
    bg: '#18354a',
    tags: [],
    controls: ['tap'],
    score: { label: '分數', order: 'higher', decimals: 0 },

    create(env) {
      function start() {
        // 重設狀態並開始遊戲
      }

      function stop() {
        // 停止所有動畫與 timer
      }

      function input(type, x, y) {
        // 處理 down / move / up / cancel
      }

      return { start, stop, input };
    }
  }
]);
\`\`\`

上方只有資料結構與生命週期骨架，不代表任何特定玩法。正式作者、正式 ID、發布時間、審核狀態與統計由平台建立；author 與 id 只供草稿預覽。

metadata 規則：

- apiVersion 必須是 1。
- gameVersion 使用版本字串，例如 1.0.0。
- title、description、tip、bg、id 必須是可直接讀取的字串。
- bg 必須是十六進位色碼。
- tags 是字串陣列，可以為空。
- controls 至少一項，可使用 tap、hold、horizontal-drag、left-right 或它們的組合。
- duration 是選配的預估秒數，不是時間限制。可以省略，遊戲可依命數、目標、失敗條件或自己的規則結束。
- score.order 使用 higher 或 lower；decimals 建議為 0。

## 2. Runtime API

- 邏輯畫布固定為 400 × 700。
- env.W / env.H：畫布尺寸。
- env.ctx：Canvas 2D context，所有畫面都畫在這裡。
- env.setScore(number)：更新當局分數。
- env.over(finalScore)：結束當局；同一局只能呼叫一次。
- env.beep(fromHz, toHz, seconds, volume, waveType)：產生簡單音效。
- env.sprite(key, centerX, centerY, size, flip?)：請平台畫出 Remix 素材；有素材時回傳 true，否則回傳 false。
- 公開投稿不提供 env.getSprite。

GameInstance 必須包含：

- start()：每次開局重設全部狀態並開始。
- stop()：停止 requestAnimationFrame、setTimeout、setInterval 與其他循環。
- input(type, x, y)：處理 down / move / up / cancel。

create(env) 內可以自由建立輔助函式，也可以讓輔助函式回傳物件。平台只把 create(env) 自己直接回傳的物件視為 GameInstance。

cancel 代表平台接管手勢或遊戲被中止，只能解除按住或拖曳狀態，不可觸發原本屬於 up 的發射、計分或結算行為。

## 3. 輸入邊界

PlayFeed 將輸入轉成：

- down：手指或滑鼠按下。
- move：按住後移動。
- up：玩家真的放開。
- cancel：平台中止這次操作。

x、y 使用 400 × 700 邏輯座標。

垂直滑動保留給 Feed 切換遊戲，因此遊戲不可把上下拖曳、大幅斜向拖曳或畫圈設為必要操作。點按、按住、放開、左右選擇與水平拖曳都可以。遊戲不可自行 addEventListener，只能透過 input() 接收操作。

## 4. 自足與安全限制

- 單一 Script、自足，不可載入外部圖片、字型、音訊、影片或其他程式。
- 禁止 fetch、XMLHttpRequest、WebSocket、EventSource、Worker、動態 import。
- 禁止 document、navigator、location、parent、top、opener、globalThis。
- 禁止 localStorage、sessionStorage、indexedDB、cookie。
- 禁止 eval、Function、無限迴圈與修改平台 DOM。
- 只能使用 env、Math、Array、Date.now、requestAnimationFrame、timer 等標準純 JavaScript 能力。
- 分數必須是有限數字，絕對值不可超過 1,000,000,000。
- env.over() 後不可繼續更新分數或執行遊戲。

## 5. Remix（選配）

Remix 不是必要條件。只有在遊戲中確實有適合替換的視覺元素時，才加入 remixSlots：

\`{ key, label, hint, default, shape }\`

shape 可使用 free、circle、wide、tall。繪製該元素時可呼叫 env.sprite()；若回傳 false，再畫原本外觀。沒有合適元素時直接省略 remixSlots，不要為了符合格式硬加。

## 6. 執行檢查

- 恰好註冊一個遊戲物件。
- metadata 完整且可直接讀取。
- create(env) 直接回傳 start、stop、input。
- input 能安全處理 cancel。
- 遊戲會呼叫 env.setScore() 與 env.over()。
- stop() 能停止全部動畫與 timer。
- 沒有外部資源、網路、儲存或 DOM API。
- 沒有垂直必要操作。
- 隨機收到合法輸入時不會卡死或報錯。

請自由設計玩法。以上規格是執行契約，不是遊戲設計指南。

最後只輸出一個完整 JavaScript 程式碼區塊，不要在程式碼前後加入解釋、教學、摘要或其他文字。`;

export function buildMechanicPrompt(template) {
  const preserve = (template.preserve || []).map(item => `- ${item}`).join('\n');
  const reference = template.sourceScript ? `

以下來源 Script 只供理解核心機制。不要直接複製名稱、文字、角色或主題；請重新製作符合新主題的完整遊戲：

\`\`\`js
${template.sourceScript}
\`\`\`
` : '';
  return `# 使用 PlayFeed 玩法模板創作

請使用下面的玩法骨架製作一款新的 PlayFeed 遊戲。

來源遊戲：${template.sourceTitle}

玩法摘要：
${template.summary}

應保留的核心機制：
${preserve}

可以自由更換與發展：
- 題材、情境、角色與物件
- 名稱、文案、色彩、動畫、音效與視覺回饋
- 數值、速度、難度與細節規則

請保留玩法的核心互動，但不要複製來源遊戲的名稱、角色、情境或文案。使用者會在下一則訊息告訴你想製作的主題；請依照他的要求發展，不要自行限定題材。
${reference}

---

${FULL_SPEC}`;
}

export function buildRepairPrompt(report, source) {
  return `# PlayFeed v1 修復規格

請修復下面的 PlayFeed Script，保留原本玩法、美術方向與創作選擇，不要藉修復之名改成另一種遊戲。

核心要求：
- 只能註冊一個 window.GAMES 遊戲物件。
- apiVersion 必須是 1。
- create(env) 必須直接回傳 start()、stop()、input(type,x,y)。
- input 必須分開處理 up 與 cancel。
- 只能使用 env.W、env.H、env.ctx、env.setScore、env.over、env.beep、env.sprite。
- 禁止網路、DOM、瀏覽器儲存、外部資源、Worker、eval 與無限迴圈。
- 垂直手勢保留給 Feed。
- 技術修復不應限制或重新設計玩法。
- 最後只輸出一個完整 JavaScript 程式碼區塊，不要加入其他文字。

驗證報告：
${report}

原始 Script：
\`\`\`js
${source}
\`\`\``;
}
