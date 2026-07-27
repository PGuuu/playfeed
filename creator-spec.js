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
    preview: 'cover',
    score: { label: '分數', order: 'higher', decimals: 0 },
    remixSlots: [
      {
        key: 'main-character',
        label: '主角',
        hint: '玩家控制或最常注視的角色',
        default: '原始外觀',
        shape: 'free'
      }
    ],

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
- preview 決定尚未正式開始時的預覽方式：cover 或 demo。未填時預設為 cover。
- duration 是選配的預估秒數，不是時間限制。可以省略，遊戲可依命數、目標、失敗條件或自己的規則結束。
- score.order 使用 higher 或 lower；decimals 建議為 0。
- remixSlots 至少要有一項，讓玩家可以替換遊戲中的角色或物件外觀。

## 2. Runtime API

- 使用 env.W / env.H 作為邏輯畫布尺寸（目前是 400 × 700 設計單位），不要自行讀取螢幕像素。
- 平台會依裝置像素密度清晰縮放：直式裝置填滿可用畫面；橫式螢幕則讓完整直式遊戲以畫面高度置中顯示。
- 所有位置與大小都應由 env.W / env.H 推算。不要使用固定 CSS 尺寸，也不要假設手機的實際長寬比。
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

每次 start() 開局時，遊戲必須直接在 canvas 畫面中短暫顯示操作方法。提示應簡短、清楚，可在第一次操作後或數秒後淡出；不可使用 DOM 製作提示。

玩家滑到這款遊戲時，PlayFeed 會顯示「點一下開始」，並先呼叫 start() 產生預覽。玩家輕點後，平台會重新呼叫 start()，清除預覽狀態並正式開局。Script 不要自行製作「開始」按鈕。

請依玩法選擇預覽方式：

- preview: 'cover'（預設）：只顯示不會劇透的首頁、封面或待機畫面，平台不送出自動輸入。適合塔羅／抽牌、問答、記憶、劇情選擇、驚喜揭露，以及任何自動操作會替玩家做決定的遊戲。start() 在沒有輸入時不得揭露答案、抽牌或推進關鍵結果。
- preview: 'demo'：平台會在短暫顯示操作方法後送出隨機合法輸入，讓背景自動示範玩法。適合動作、節奏、閃避、接物等不怕展示過程的遊戲。

不論使用哪一種，正式開局的 start() 都必須完整重設狀態。預覽中的分數、隨機結果、計時與進度不可帶入正式遊戲。

create(env) 內可以自由建立輔助函式，也可以讓輔助函式回傳物件。平台只把 create(env) 自己直接回傳的物件視為 GameInstance。

cancel 代表平台接管手勢或遊戲被中止，只能解除按住或拖曳狀態，不可觸發原本屬於 up 的發射、計分或結算行為。

## 3. 輸入邊界

PlayFeed 將輸入轉成：

- down：手指或滑鼠按下。
- move：按住後移動。
- up：玩家真的放開。
- cancel：平台中止這次操作。

x、y 使用 env.W × env.H 的邏輯座標；平台負責轉換實際螢幕尺寸。

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

## 5. 換皮／貼皮（必要）

每一款 PlayFeed 遊戲都必須支援換皮。請找出遊戲中可辨識的角色、物件、障礙物、目標、道具或裝飾，盡量把多個重要元素分別列入 remixSlots：

\`{ key, label, hint, default, shape }\`

規則：

- remixSlots 至少一項；有多個清楚可替換的視覺元素時，應盡量全部開放。
- key 必須唯一，只能使用小寫英文字母、數字與連字號。
- label 是玩家看到的元素名稱；hint 簡短說明它在遊戲中的位置或功能。
- shape 可使用 free、circle、wide、tall。
- 每個 slot 對應的元素在所有繪製位置都要先呼叫 env.sprite(key, centerX, centerY, size, flip?)。
- env.sprite() 回傳 true 時，不要再畫原本外觀；回傳 false 時才畫預設外觀。
- 換皮只改變外觀，不可改變碰撞範圍、速度、分數或玩法。
- 不要只填 remixSlots 資料卻沒有在遊戲畫面中呼叫 env.sprite()。

## 6. 執行檢查

- 恰好註冊一個遊戲物件。
- metadata 完整且可直接讀取。
- create(env) 直接回傳 start、stop、input。
- input 能安全處理 cancel。
- 遊戲會呼叫 env.setScore() 與 env.over()。
- stop() 能停止全部動畫與 timer。
- 每次開局會先在遊戲畫面中顯示簡短操作提示。
- preview 使用 cover 或 demo，並選擇不會劇透或替玩家做決定的模式。
- 不會自行顯示開始按鈕或停在等待開始狀態。
- remixSlots 至少一項，而且每個可換元素都實際透過 env.sprite() 繪製。
- 沒有外部資源、網路、儲存或 DOM API。
- 沒有垂直必要操作。
- 隨機收到合法輸入時不會卡死或報錯。

請自由設計玩法。以上規格是執行契約，不是遊戲設計指南。

最後只輸出一個完整 JavaScript 程式碼區塊，不要在程式碼前後加入解釋、教學、摘要或其他文字。`;

export const FULL_SPEC_EN = `# PlayFeed Game Creation Spec v1

PlayFeed accepts one self-contained JavaScript Script and handles validation, previewing, and publishing.

This spec only defines how a game runs inside PlayFeed. It does not restrict subject matter, gameplay, genre, language, or creative direction. Develop the user’s idea faithfully and choose an interaction that suits it. Classic and original mechanics are both welcome. Do not treat the fields, lifecycle skeleton, or API names below as a gameplay example, and do not add a design formula the user did not request.

## 1. Script format

The Script must register exactly one game:

\`\`\`js
window.GAMES = (window.GAMES || []).concat([
  {
    apiVersion: 1,
    gameVersion: '1.0.0',
    id: 'readable-id-suggestion',
    title: 'Game title',
    description: 'One-line description',
    author: '@draft-only',
    tip: 'One-line control tip',
    bg: '#18354a',
    tags: [],
    controls: ['tap'],
    preview: 'cover',
    score: { label: 'Score', order: 'higher', decimals: 0 },
    remixSlots: [
      {
        key: 'main-character',
        label: 'Main character',
        hint: 'The character controlled or watched most often',
        default: 'Original appearance',
        shape: 'free'
      }
    ],

    create(env) {
      function start() {
        // Reset state and start the game
      }

      function stop() {
        // Stop every animation and timer
      }

      function input(type, x, y) {
        // Handle down / move / up / cancel
      }

      return { start, stop, input };
    }
  }
]);
\`\`\`

The code above is only a data and lifecycle skeleton. It does not imply any particular gameplay. The platform assigns the official creator, ID, publication time, review status, and statistics. author and id are draft suggestions only.

Metadata rules:

- apiVersion must be 1.
- gameVersion is a version string such as 1.0.0.
- title, description, tip, bg, and id must be directly readable strings. They may use any language.
- bg must be a hexadecimal color.
- tags is an array of strings and may be empty.
- controls must contain at least one value. Use tap, hold, horizontal-drag, left-right, or a combination.
- preview controls what appears before the player formally starts: cover or demo. It defaults to cover when omitted.
- duration is an optional estimate, not a time limit. It may be omitted. A game may end through lives, goals, failure conditions, or its own rules.
- score.order is higher or lower; decimals should normally be 0.
- remixSlots must contain at least one visual element that players can replace.

## 2. Runtime API

- Use env.W / env.H as the logical canvas size (currently 400 × 700 design units). Do not read physical screen pixels.
- PlayFeed scales clearly for device pixel density. Portrait devices fill the available area; on landscape displays the full portrait game is centered and fitted to the display height.
- Derive positions and sizes from env.W / env.H. Do not use fixed CSS sizes or assume a physical phone aspect ratio.
- env.ctx: Canvas 2D context. Draw the entire game here.
- env.setScore(number): update the current score.
- env.over(finalScore): end the run. Call it only once per run.
- env.beep(fromHz, toHz, seconds, volume, waveType): play a simple sound.
- env.sprite(key, centerX, centerY, size, flip?): ask PlayFeed to draw Remix media. Returns true when media was drawn, otherwise false.
- Public submissions do not receive env.getSprite.

GameInstance must contain:

- start(): reset all state and begin every run.
- stop(): stop requestAnimationFrame, setTimeout, setInterval, and every other loop.
- input(type, x, y): handle down / move / up / cancel.

At the beginning of every start(), briefly show the controls directly inside the canvas. Keep the instruction short and clear; it may fade after the first input or after a few seconds. Do not use DOM elements for instructions.

When a player scrolls to the game, PlayFeed shows “Tap to play” and calls start() to create the preview. When the player taps, PlayFeed calls start() again, discards the preview state, and begins the real run. Do not build a Start button inside the Script.

Choose the preview mode that fits the game:

- preview: 'cover' (default): show a non-spoiling title, cover, or idle scene. PlayFeed sends no automatic input. Use this for tarot/card draws, quizzes, memory games, story choices, surprise reveals, and any game where automation would make a decision for the player. With no input, start() must not reveal an answer, draw a card, or advance a key result.
- preview: 'demo': after the short in-canvas control instruction, PlayFeed sends random valid input to demonstrate the gameplay in the background. Use this for action, rhythm, dodging, catching, and other games where showing the action does not spoil the experience.

In both modes, start() must fully reset the game for the real run. Preview scores, random outcomes, timers, and progress must never carry over.

create(env) may contain helper functions, and helpers may return objects. PlayFeed treats only the object directly returned by create(env) as the GameInstance.

cancel means the platform took over the gesture or interrupted the game. It may only release held or dragged state. It must not trigger firing, scoring, or results that belong to up.

## 3. Input boundaries

PlayFeed sends:

- down: finger or mouse pressed.
- move: pointer moved while held.
- up: the player actually released.
- cancel: PlayFeed interrupted the interaction.

x and y use the env.W × env.H logical coordinate space. PlayFeed converts physical screen coordinates.

Vertical swipes belong to the Feed, so vertical dragging, large diagonal dragging, and drawing circles cannot be required controls. Taps, holds, releases, left/right choices, and horizontal dragging are allowed. Do not call addEventListener; receive input only through input().

## 4. Self-contained and safety rules

- One self-contained Script. Do not load external images, fonts, audio, video, or code.
- No fetch, XMLHttpRequest, WebSocket, EventSource, Worker, or dynamic import.
- No document, navigator, location, parent, top, opener, or globalThis.
- No localStorage, sessionStorage, indexedDB, or cookies.
- No eval, Function, infinite loops, or platform DOM changes.
- Use only env and standard pure JavaScript capabilities such as Math, Array, Date.now, requestAnimationFrame, and timers.
- Scores must be finite numbers with an absolute value no greater than 1,000,000,000.
- Do not update scores or continue the game after env.over().

## 5. Reskin support (required)

Every PlayFeed game must support reskinning. Identify visible characters, objects, obstacles, targets, items, or decorations. Put as many important replaceable elements as practical into separate remixSlots:

\`{ key, label, hint, default, shape }\`

Rules:

- Provide at least one remix slot. If several visual elements can clearly be replaced, expose as many as practical.
- key must be unique and contain only lowercase letters, digits, and dashes.
- label is the player-facing element name. hint briefly explains its position or role.
- shape is free, circle, wide, or tall.
- At every place a slotted element is drawn, call env.sprite(key, centerX, centerY, size, flip?) first.
- When env.sprite() returns true, do not draw the original appearance. Draw the fallback only when it returns false.
- Reskinning changes appearance only. It must not change collision, speed, score, or gameplay.
- Do not declare remixSlots without actually calling env.sprite() in the game.

## 6. Runtime checklist

- Exactly one game object is registered.
- Metadata is complete and directly readable.
- create(env) directly returns start, stop, and input.
- input safely handles cancel.
- The game calls env.setScore() and env.over().
- stop() stops all animations and timers.
- Every run begins with a short in-canvas control instruction.
- preview is cover or demo and is chosen so the preview cannot spoil content or decide for the player.
- The Script does not show its own Start button or wait in a pre-start state.
- At least one remix slot is present and every slotted element is drawn through env.sprite().
- No external resources, network, storage, or DOM APIs.
- No required vertical interaction.
- Random valid input cannot freeze or crash the game.

Design the gameplay freely. This is a runtime contract, not a game design guide.

Finally, output exactly one complete JavaScript code block. Do not add explanations, tutorials, summaries, or any other text before or after the code block.`;

export function buildMechanicPrompt(template, locale = 'zh-Hant') {
  const preserve = (template.preserve || []).map(item => `- ${item}`).join('\n');
  if (locale === 'en') {
    const reference = template.sourceScript ? `

The source Script below is only for understanding the core mechanic. Do not copy its title, writing, characters, or theme. Rebuild a complete game for the new theme:

\`\`\`js
${template.sourceScript}
\`\`\`
` : '';
    return `# Create with a PlayFeed gameplay template

Use the gameplay structure below to make a new PlayFeed game.

Source game: ${template.sourceTitle}

Gameplay summary:
${template.summary}

Core mechanics to preserve:
${preserve}

You may freely change and develop:
- Subject, setting, characters, and objects
- Title, writing, colors, animation, sound, and visual feedback
- Values, speed, difficulty, and detailed rules

Keep the core interaction, but do not copy the source game’s title, characters, setting, or writing. The user will describe the desired theme in the next message. Follow that request without restricting the subject yourself.
${reference}

---

${FULL_SPEC_EN}`;
  }
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

export function buildRepairPrompt(report, source, locale = 'zh-Hant') {
  if (locale === 'en') {
    return `# PlayFeed v1 repair spec

Repair the PlayFeed Script below. Preserve its gameplay, art direction, and creative choices. Do not turn it into a different game under the guise of a technical fix.

Core requirements:
- Register exactly one window.GAMES game object.
- apiVersion must be 1.
- create(env) must directly return start(), stop(), and input(type,x,y).
- input must handle up and cancel separately.
- Use only env.W, env.H, env.ctx, env.setScore, env.over, env.beep, and env.sprite.
- No network, DOM, browser storage, external resources, Worker, eval, or infinite loops.
- Vertical gestures remain available to the Feed.
- At the beginning of start(), briefly draw the controls inside the canvas.
- Use preview: 'cover' for hidden information or player decisions, and preview: 'demo' only when automatic input cannot spoil the game.
- Do not build a Start button; PlayFeed handles previewing and tap-to-start.
- Provide at least one remix slot. Every replaceable element must actually call env.sprite(), drawing its original appearance only when no replacement is available.
- Technical repairs must not restrict or redesign the gameplay.
- Output exactly one complete JavaScript code block with no other text.

Validation report:
${report}

Original Script:
\`\`\`js
${source}
\`\`\``;
  }
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
- start() 開局時要直接在 canvas 畫面中短暫顯示操作方法。
- 隱藏資訊或需要玩家決定的遊戲使用 preview: 'cover'；只有不怕自動輸入劇透時才使用 preview: 'demo'。
- 不可自行製作開始按鈕；平台會處理預覽與輕點開局。
- remixSlots 至少一項；每個可換元素都要實際呼叫 env.sprite()，沒有素材時才畫原本外觀。
- 技術修復不應限制或重新設計玩法。
- 最後只輸出一個完整 JavaScript 程式碼區塊，不要加入其他文字。

驗證報告：
${report}

原始 Script：
\`\`\`js
${source}
\`\`\``;
}
