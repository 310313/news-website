# 剪報看板 Editor's Corkboard

一個即時新聞聚合網站。每次訪客開啟頁面時,後端會自動抓取 Google News RSS,交由 AI 進行翻譯、摘要、重要度評估與分類,最後整理成清爽的新聞卡片呈現。

🔗 **線上網址**：[news-website-liard-gamma.vercel.app](https://news-website-liard-gamma.vercel.app/)

---

## 功能特色

- **7 大分類**:政治/國際、財經/產業、科技、社會/犯罪、生活/健康/娛樂、體育、AI
- **今日總覽**:AI 自動彙整當日新聞趨勢,寫成一段總評
- **AI 加值處理**:非中文標題自動翻譯、生成摘要、標註重要度(高/中/低)與關鍵字
- **即時抓取**:不依賴資料庫,每次請求即時向新聞來源拉取最新內容

---

## 技術架構

| 項目 | 使用技術 |
|---|---|
| 前端 | 純 HTML / CSS / JavaScript(無框架) |
| 後端 | Vercel Serverless Function(Node.js) |
| 新聞來源 | Google News RSS,以 [`rss-parser`](https://www.npmjs.com/package/rss-parser) 解析 |
| AI 模型 | Groq API — `llama-3.3-70b-versatile` |
| 部署平台 | Vercel(GitHub 串接,push 到 `main` 即自動部署) |
| 快取策略 | HTTP `Cache-Control`(`s-maxage`)於 CDN 層快取回應,降低 AI API 呼叫次數 |

### 處理流程

```
使用者開啟網站 / 切換分類
        │
        ▼
前端呼叫 /api/news?category=xxx
        │
        ▼
Serverless Function 抓取對應分類的 RSS Feed
        │
        ▼
新聞內容交給 Groq AI 進行：
  - 翻譯標題（若非中文）
  - 生成摘要
  - 評估重要度
  - 產生關鍵字
        │
        ▼
回傳整理後的 JSON 給前端
        │
        ▼
前端渲染成新聞卡片畫面
```

---

## 專案結構

```
news-website/
├── api/
│   └── news.js        # 核心 Serverless Function：抓取 RSS + 呼叫 Groq AI
├── public/
│   ├── index.html      # 頁面結構
│   ├── style.css        # 樣式
│   └── script.js         # 前端邏輯（分類切換、渲染新聞卡片）
├── package.json
└── vercel.json          # 部署設定（如：執行區域）
```

---

## 環境變數設定

需要在 Vercel 專案的 **Settings → Environment Variables** 設定：

| 變數名稱 | 說明 |
|---|---|
| `GROQ_API_KEY` | Groq API 金鑰,用於呼叫 AI 模型進行新聞處理 |

---

## 授權 / 使用聲明

新聞內容來源為 Google News RSS,本專案僅作聚合與摘要呈現，不主張新聞內容之著作權。AI 生成之摘要與評論僅供參考,實際新聞內容請以原始來源為準。
