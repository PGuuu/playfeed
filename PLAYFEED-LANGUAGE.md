# PlayFeed Language v1（實驗版）

PlayFeed Language 是較短的互動描述格式。創作者或任何 AI 只需輸出 `playfeed 1` 加上一個 JSON 物件；平台會在本機把它編譯成現有的 PlayFeed JavaScript Script，再沿用同一套 AST 驗證、沙盒、預玩與發布流程。

它不取代 JavaScript。第一版先證明常見互動能否共用一套較短、可驗證、可換皮的結構；無法合理描述的玩法繼續使用完整 JavaScript 規格。

## 第一版模式

- `flow`：互動故事、分支選擇、問答、抽卡、解答之書。
- `catcher`：左右移動、接物、閃避、生命與計時。
- `region-grid`：以兩個角建立矩形的數字分區益智。

共通資料包含 `meta`、`preview` 與 `remix`。平台仍負責正式作者、正式 ID、發布時間、版本狀態、社交資料與排行榜資料。

## 編譯邊界

```text
PlayFeed Language
        ↓ parser + schema validation
標準化互動描述
        ↓ compiler
既有 PlayFeed JavaScript Script
        ↓ AST validator
既有 sandbox runtime
```

因此第一版不需要建立第二套執行器，也不會讓投稿跳過現有安全檢查。發布時資料庫保存編譯後 Script，原始 PlayFeed Language 會保留在 Script 註解中，方便日後轉換。

## 格式

```playfeed
playfeed 1
{
  "mode": "flow",
  "preview": "cover",
  "meta": {
    "id": "sample",
    "title": "範例",
    "description": "一句話介紹",
    "tip": "點一下",
    "bg": "#18354a",
    "tags": [],
    "controls": ["tap"],
    "score": { "label": "結果", "order": "higher", "decimals": 0 }
  },
  "remix": [
    {
      "key": "main-object",
      "label": "主要物件",
      "hint": "最重要的可替換畫面元素",
      "default": "原始外觀",
      "shape": "free"
    }
  ],
  "flow": {
    "initial": "start",
    "scenes": [
      {
        "id": "start",
        "title": "範例",
        "text": "點一下結束",
        "on": { "tap": [{ "end": 1 }] }
      }
    ]
  }
}
```

完整可執行範例位於：

- `examples/answer-book.pfl`
- `examples/coin-rain.pfl`
- `examples/shikaku.pfl`

`flow` 場景也可以使用 `hold`，定義最短按壓時間、翻頁效果、明顯的按住提示，以及按住時逐句淡入淡出的短句。這讓「按住」可以成為作品節奏的一部分，而不只是另一種點擊。

## 已知邊界

第一版不是通用遊戲語言，目前不能完整描述物理、節奏判定、任意粒子系統、自由繪圖、複雜棋盤規則或每款作品獨有的演算法。這些能力若直接做成任意程式碼，就會重新引入 JavaScript 的長度與安全問題。

下一階段應從平台現有作品中萃取真正重複的元件與規則，例如 `spawner`、`collision`、`sequence`、`meter`、`deck`、`timer`、`lives`、`grid`，再決定是否加入受限的規則層。每次擴充都應先以多款不同作品驗證，而不是為單一作品增加特例。
