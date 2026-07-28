export const PLAYFEED_LANGUAGE_SPEC = `# PlayFeed Language v1（實驗版）創作規格

請把使用者的點子做成一個適合 PlayFeed 的互動作品。經典或原創玩法都可以；不要自行限制題材、風格、遊戲時間或創意方向。

最後只輸出一個完整的 \`playfeed\` 程式碼區塊，不要在前後加入解釋。

## 共通格式

\`\`\`playfeed
playfeed 1
{
  "mode": "flow",
  "preview": "cover",
  "meta": {
    "id": "readable-id",
    "title": "名稱",
    "description": "一句話介紹",
    "tip": "操作說明",
    "bg": "#18354a",
    "tags": [],
    "controls": ["tap"],
    "duration": 45,
    "score": { "label": "結果", "order": "higher", "decimals": 0 }
  },
  "remix": [
    {
      "key": "main-object",
      "label": "主要物件",
      "hint": "玩家最常看到或操作的物件",
      "default": "原始外觀",
      "shape": "free"
    }
  ]
}
\`\`\`

- \`preview\`：會洩漏答案、卡牌、故事結果時用 \`cover\`；展示動作不會破壞體驗時用 \`demo\`。
- \`controls\`：可用 \`tap\`、\`hold\`、\`horizontal-drag\`。上下滑必須留給 Feed。
- \`duration\` 只是預估，可省略；作品也可以因生命用完、達成目標或故事結束而結束。
- 每款作品至少要有一個 \`remix\` 換皮元素；重要角色、物件、障礙與裝飾盡量分開。
- 色碼使用十六進位；key/id 使用小寫英文、數字與連字號。

## 選擇一種 mode

### flow：故事、問答、抽卡、解答之書、分支互動

在共通格式加入：

\`\`\`json
"flow": {
  "initial": "cover",
  "data": { "answers": ["可以。", "再等等。", "換個方向。"] },
  "scenes": [
    {
      "id": "cover",
      "title": "先想一個問題",
      "text": "準備好後按住，再放開。",
      "hint": "按住 · 放開",
      "visual": { "remix": "main-object", "shape": "book", "x": 200, "y": 390, "size": 200 },
      "on": {
        "release": [
          { "random": { "target": "answer", "from": "answers" } },
          { "go": "result" }
        ]
      }
    },
    {
      "id": "result",
      "title": "回答",
      "text": "{{answer}}",
      "choices": [
        { "label": "完成", "actions": [{ "end": "answerIndex" }] },
        { "label": "再一次", "actions": [{ "go": "cover" }] }
      ]
    }
  ]
}
\`\`\`

場景可用 \`on.down\`、\`on.tap\`、\`on.release\`。action 可用 \`set\`、\`random\`、\`go\`、\`score\`、\`end\`。文字可插入 \`{{變數}}\`。每個場景最多兩個 choices。

需要讓「按住」本身形成體驗時，可在 scene 加入：

\`\`\`json
"hold": {
  "effect": "page-flip",
  "minSeconds": 1.2,
  "phraseSeconds": 0.7,
  "label": "按住書本翻閱",
  "activeLabel": "正在尋找答案…",
  "shortLabel": "再按久一點",
  "phrases": ["先別急著決定", "答案正在靠近", "現在，準備放開"]
}
\`\`\`

\`minSeconds\` 未達時不會觸發 release；\`page-flip\` 會在按住期間持續翻頁，phrases 會逐句淡入淡出。

### catcher：接物、閃避、左右移動

把共通格式的 \`remix\` 換成與 player/items 對應的元素，並加入：

\`\`\`json
"remix": [
  { "key": "player", "label": "玩家", "hint": "底部左右移動的角色", "default": "接取器", "shape": "wide" },
  { "key": "good", "label": "得分物件", "hint": "接到會得分的物件", "default": "金幣", "shape": "circle" },
  { "key": "bad", "label": "危險物件", "hint": "碰到會失去生命的物件", "default": "炸彈", "shape": "circle" }
],
"catcher": {
  "duration": 45,
  "lives": 3,
  "player": { "remix": "player", "width": 90, "height": 45, "color": "#65e0d0" },
  "items": [
    { "label": "+", "remix": "good", "every": 0.6, "speed": 230, "size": 34, "points": 1, "color": "#ffd34d" },
    { "label": "!", "remix": "bad", "every": 1.7, "speed": 275, "size": 38, "danger": true, "color": "#202433" }
  ]
}
\`\`\`

\`danger: true\` 會扣一條命；\`missLife: true\` 代表漏接會扣命。

### region-grid：數字分區、矩形拼圖

在共通格式加入：

\`\`\`json
"grid": {
  "rows": 5,
  "cols": 5,
  "palette": ["#ffd166", "#80ed99", "#72ddf7"],
  "clues": [
    { "r": 0, "c": 0, "n": 4 },
    { "r": 0, "c": 3, "n": 3 }
  ]
}
\`\`\`

玩家依序點兩個角建立矩形；每個矩形必須只包含一個 clue，且面積等於 \`n\`。clue 座標從 0 開始。

若點子無法合理套用這三種 mode，不要硬套或削弱玩法；改用 PlayFeed 完整 JavaScript 規格製作。`;

export const PLAYFEED_LANGUAGE_SPEC_EN = `# PlayFeed Language v1 (experimental) creation spec

Turn the user's idea into an interaction for PlayFeed. Classic and original mechanics are both welcome. Do not invent restrictions on subject, style, duration, or creative direction.

Output exactly one complete \`playfeed\` code block and no explanation before or after it.

Start with:

\`\`\`playfeed
playfeed 1
{
  "mode": "flow",
  "preview": "cover",
  "meta": {
    "id": "readable-id",
    "title": "Title",
    "description": "One-line description",
    "tip": "One-line control tip",
    "bg": "#18354a",
    "tags": [],
    "controls": ["tap"],
    "duration": 45,
    "score": { "label": "Result", "order": "higher", "decimals": 0 }
  },
  "remix": [
    { "key": "main-object", "label": "Main object", "hint": "The main visible or controlled object", "default": "Original look", "shape": "free" }
  ]
}
\`\`\`

Use \`preview: "cover"\` for cards, answers, stories, surprises, and anything automation could spoil. Use \`demo\` when showing gameplay is safe. Controls may use \`tap\`, \`hold\`, or \`horizontal-drag\`; vertical gestures belong to the Feed. Duration is only an estimate and may be omitted. Include at least one reskin element; separate important characters, objects, obstacles, and decorations where practical.

Choose one mode:

1. \`flow\` for stories, quizzes, cards, answers, and branching interactions. Define \`flow.initial\`, \`flow.data\`, and \`flow.scenes\`. Scenes may use \`on.down\`, \`on.tap\`, or \`on.release\`; actions may use \`set\`, \`random\`, \`go\`, \`score\`, and \`end\`. Insert state with \`{{variable}}\`. A scene may have up to two choices with action arrays. For a meaningful hold interaction, add \`scene.hold\` with \`effect: "page-flip"\`, \`minSeconds\`, \`phraseSeconds\`, labels, and a \`phrases\` array. A release shorter than \`minSeconds\` will not advance.
2. \`catcher\` for catching, dodging, and horizontal movement. Define \`catcher.duration\`, \`lives\`, \`player\`, and \`items\`. Items support \`every\`, \`speed\`, \`size\`, \`points\`, \`danger\`, and \`missLife\`. Every \`player.remix\` and \`item.remix\` key must have a matching entry in the root \`remix\` array.
3. \`region-grid\` for rectangular number-partition puzzles. Define \`grid.rows\`, \`cols\`, \`palette\`, and \`clues\` as \`{r,c,n}\`. Coordinates start at zero.

If the idea cannot reasonably fit these modes, do not weaken or force it. Use PlayFeed's full JavaScript specification instead.`;
