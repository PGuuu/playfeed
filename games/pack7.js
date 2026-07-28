import { compilePlayFeedLanguage } from '../playfeed-lang.js';

const answerBookSource = `playfeed 1
{
  "mode": "flow",
  "preview": "cover",
  "meta": {
    "id": "book-of-answers",
    "title": "解答之書",
    "description": "先在心裡想一個問題，按住書本，再放開得到一句回答。",
    "tip": "按住書本思考，放開揭曉答案",
    "bg": "#151936",
    "tags": ["oracle", "calm", "reflection"],
    "controls": ["hold"],
    "score": { "label": "答案", "order": "higher", "decimals": 0 }
  },
  "remix": [
    {
      "key": "book",
      "label": "解答之書",
      "hint": "畫面中央會發光的書本封面",
      "default": "深藍星空書本",
      "shape": "wide"
    }
  ],
  "flow": {
    "initial": "cover",
    "data": {
      "answers": [
        "再等一天。",
        "其實你已經知道答案。",
        "先做最簡單的那一步。",
        "現在不是最好的時機。",
        "別把害怕誤認成直覺。",
        "這次可以相信運氣。",
        "去問那個你一直不敢問的人。",
        "答案藏在你最先想到的地方。"
      ]
    },
    "scenes": [
      {
        "id": "cover",
        "background": "#24285a",
        "backgroundEnd": "#090b1d",
        "title": "先在心裡想一個問題",
        "text": "不用說出口。讓問題安靜地停在心裡，按住這本書，準備好時再放開。",
        "hint": "按住思考 · 放開揭曉",
        "visual": {
          "remix": "book",
          "shape": "book",
          "x": 200,
          "y": 410,
          "size": 210,
          "color": "#f0c66d",
          "glow": "#8ce8ff"
        },
        "on": {
          "release": [
            { "random": { "target": "answer", "from": "answers" } },
            { "go": "answer" }
          ]
        }
      },
      {
        "id": "answer",
        "background": "#543b78",
        "backgroundEnd": "#14162f",
        "title": "書給你的回答",
        "text": "「{{answer}}」",
        "hint": "答案不是命令，只是一面鏡子",
        "visual": {
          "remix": "book",
          "shape": "book",
          "x": 200,
          "y": 390,
          "size": 230,
          "color": "#fff0b2",
          "glow": "#fff5b8"
        },
        "choices": [
          {
            "label": "收起答案",
            "actions": [{ "end": "answerIndex" }]
          },
          {
            "label": "再問一次",
            "actions": [{ "go": "cover" }]
          }
        ]
      }
    ]
  }
}`;

const { source } = compilePlayFeedLanguage(answerBookSource);
Function(source)();
