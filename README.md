# 日月教育學習網 — 專案交接文件 v2

最後更新：2026-07-11

## 專案定位

原本是單一功能的新聞聚合網站「剪報看板」，現在升級成面向**高中生**的多科學習平台，用模塊化架構擴充。新聞是其中一個模塊（時事），之後可以持續加英文、國文以外的其他科目。

## 技術棧

- 純 HTML/CSS/JS（無框架），多頁面（多路由）架構
- Vercel Serverless Functions（Node.js）
- Vercel 免費方案部署，region: `hkg1`（香港機房）
- GitHub repo：`310313/news-website`（public）
- AI：Groq API（`llama-3.3-70b-versatile`），環境變數 `GROQ_API_KEY`
- 進度儲存：瀏覽器 `localStorage`（未接資料庫，未做登入系統）

## 整體架構

```
news-website/
├── package.json              # 相依套件：rss-parser
├── vercel.json                 # { "regions": ["hkg1"] }
├── api/
│   ├── news.js                  # RSS 抓取 + Groq AI 摘要/翻譯/重要度
│   └── vocab.js                  # Groq AI 生成單字例句/翻譯/記憶技巧
└── public/
    ├── index.html               # 首頁：模塊導覽 + 學習借閱卡
    ├── news/                      # 模塊一：時事
    │   ├── index.html / style.css / script.js
    ├── vocab/                     # 模塊二：英文單字
    │   ├── index.html / style.css / script.js
    │   └── vocab-data.json          # 5653 字單字庫
    ├── zi/                          # 模塊三：國文字音字形
    │   ├── index.html / style.css / script.js
    │   └── zi-data.json               # 57 組易混淆字（130字）
    └── shared/
        └── progress.js                # 共用 localStorage 進度邏輯
```

設計原則：每個模塊獨立資料夾、獨立頁面邏輯，互不干擾；共用資料透過 `shared/progress.js` 串接；之後加新科目只要照樣板複製一份資料夾。

## 視覺風格

品牌名稱：**日月教育學習網**（時事模塊沿用子品牌「剪報看板」）

整體走復古咖啡棕公佈欄／軟木塞釘板風格：
- 首頁：咖啡棕撕紙標題條、「學習借閱卡」（圖書館借閱卡蓋章視覺）、模塊卡片像釘在板上的紙卡（微傾斜+堆疊陰影）
- 時事模塊：咖啡棕主色
- 英文單字模塊：鼠尾草綠主色
- 國文字音字形模塊：靛藍色主色
- 字體：Noto Serif TC（標題）+ Noto Sans TC（內文）+ Courier Prime（標籤/數字，打字機感）

## 各模塊功能細節

### 模塊一｜時事（`public/news/`）
- 六大分類：政治/國際、財經/產業、科技、社會/犯罪、生活/健康/娛樂、體育、AI
- 資料來源：Google News RSS
- `api/news.js` 兩種模式：
  - `overview`（今日焦點）：統整六大分類趨勢 + 精選重點
  - `list`（單分類）：該分類完整列表，含重要度排序
- 前端有 15 分鐘快取（`Cache-Control: s-maxage=900`）

### 模塊二｜英文單字（`public/vocab/`）
- 單字庫：`vocab-data.json`，欄位 `{id, word, pos, zh, level}`，`level` 為 `"4000"`（基礎）或 `"7000"`（進階）
- 三個分頁：
  - **每日十字**：依日期算出當天 10 個字，個別點「看例句」才觸發 AI（省 API 用量）
  - **單字卡**：翻卡背記，含🔊發音按鈕（瀏覽器內建 Web Speech API，免費）、翻面才載入例句
  - **測驗**：字義選擇題 + 句子填空題（AI 生成例句後挖空）
- `api/vocab.js`：輸入單字，回傳 `{example, example_zh, tip}`，有 24 小時快取

### 模塊三｜國文字音字形（`public/zi/`）
- 題庫：`zi-data.json`，57 組易混淆字組，每組含 `mnemonic`（記憶口訣）+ `chars`（每字含 `char/zhuyin/meaning/example/radicalHint`）
- 三個分頁：
  - **混淆字比一比**：並排對照同組所有字的讀音、意思、例詞、部首線索
  - **字音字形選擇題（別選題）**：例詞挖空，四選一
  - **部首猜字**：給部首線索+語意提示，猜正確字
- 純靜態資料，不呼叫 AI，無額外費用

### 共用進度系統（`public/shared/progress.js`）
儲存於 `localStorage`，key 為 `sunmoon_progress_v1`：
```json
{
  "vocab_learned": ["word1", "word2"],
  "news_read": ["article_id"],
  "zi_learned": ["group_id-char"],
  "last_active": "2026-07-11",
  "streak_days": 5
}
```
提供函式：`markVocabLearned()`、`markNewsRead()`、`markZiLearned()`、`getSummary()`、`reset()`。首頁讀取 `getSummary()` 顯示在「學習借閱卡」。

## 已知限制 / 待確認事項

1. **Vercel Deployment Protection**：曾經開著 `Vercel Authentication`，導致訪客要登入才能看網站。使用者已在後台把 `Require Log In` 切成關閉並跑確認流程，**最終是否成功關閉、同學能否正常訪問尚未回報確認**，新對話開始建議先確認這件事。
2. **英文單字庫非完整 7000 字**：目前 5653 字，是使用者提供的 txt 清單（GBK 編碼）清理轉換而來，非官方完整版本，可能有極少數解析誤差（原始檔案有 25 行格式跑掉的資料已人工修正）。
3. **國文字音字形題庫**：57 組是憑既有知識庫打底、非官方教材來源，使用者提到可能有學校教材可以提供更完整/更符合考試方向的內容。
4. **無登入系統**：進度資料只存在單一裝置的單一瀏覽器裡，換裝置/清瀏覽器資料會遺失，目前為刻意的設計選擇（先求功能完整，之後有需求再升級資料庫）。
5. **`public` 資料夾結構**：使用者是透過 GitHub 網頁版手動上傳/搬移檔案完成的，過程中出現過路徑放錯的情況（例如 `shared/progress.js` 一度被放在 repo 根目錄），實際 repo 現況建議在新對話開始時重新核對一次。

