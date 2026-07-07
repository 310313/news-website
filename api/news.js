// Vercel Serverless Function
// 訪客請求時：即時抓取 RSS -> 請 Groq AI 翻譯/摘要/分類/評重要度 -> 回傳 JSON
const Parser = require("rss-parser");
const parser = new Parser({ timeout: 8000 });

const RSS_FEEDS = {
  "政治/國際": [
    "https://news.google.com/rss/search?q=%E6%94%BF%E6%B2%BB&hl=zh-TW&gl=TW&ceid=TW:zh-Hant",
    "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en",
  ],
  "財經/產業": [
    "https://news.google.com/rss/search?q=%E8%B2%A1%E7%B6%93&hl=zh-TW&gl=TW&ceid=TW:zh-Hant",
    "https://news.google.com/rss/search?q=%E7%94%A2%E6%A5%AD&hl=zh-TW&gl=TW&ceid=TW:zh-Hant",
  ],
  "科技": [
    "https://news.google.com/rss/search?q=%E7%A7%91%E6%8A%80&hl=zh-TW&gl=TW&ceid=TW:zh-Hant",
  ],
  "社會/犯罪": [
    "https://news.google.com/rss/search?q=%E7%A4%BE%E6%9C%83%E6%A1%88&hl=zh-TW&gl=TW&ceid=TW:zh-Hant",
    "https://news.google.com/rss/search?q=%E7%8A%AF%E7%BD%AA&hl=zh-TW&gl=TW&ceid=TW:zh-Hant",
  ],
  "生活/健康/娛樂": [
    "https://news.google.com/rss/search?q=%E5%81%A5%E5%BA%B7&hl=zh-TW&gl=TW&ceid=TW:zh-Hant",
    "https://news.google.com/rss/search?q=%E5%A8%9B%E6%A8%82&hl=zh-TW&gl=TW&ceid=TW:zh-Hant",
  ],
  "體育": [
    "https://news.google.com/rss/search?q=%E9%AB%94%E8%82%B2&hl=zh-TW&gl=TW&ceid=TW:zh-Hant",
  ],
  "AI": [
    "https://news.google.com/rss/search?q=%E4%BA%BA%E5%B7%A5%E6%99%BA%E6%85%A7&hl=zh-TW&gl=TW&ceid=TW:zh-Hant",
    "https://news.google.com/rss/search?q=AI&hl=zh-TW&gl=TW&ceid=TW:zh-Hant",
  ],
};

const ITEMS_PER_FEED = 5;

function stripHtml(html) {
  return (html || "").replace(/<[^>]+>/g, "").trim();
}

function safeHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

async function fetchCategoryItems(category) {
  const urls = RSS_FEEDS[category] || [];
  const results = [];
  await Promise.all(
    urls.map(async (url) => {
      try {
        const feed = await parser.parseURL(url);
        for (const entry of (feed.items || []).slice(0, ITEMS_PER_FEED)) {
          results.push({
            title: entry.title || "",
            link: entry.link || "",
            rawSummary: stripHtml(entry.contentSnippet || entry.content || "").slice(0, 300),
            source: (entry.creator || "").trim() || safeHostname(entry.link) || "未知來源",
          });
        }
      } catch (err) {
        console.error("RSS fetch failed:", url, err.message);
      }
    })
  );
  return results;
}

const OVERVIEW_KEY = "今日焦點";
const OVERVIEW_ITEMS_PER_CATEGORY = 5;

async function fetchAllCategoriesRaw() {
  const categories = Object.keys(RSS_FEEDS);
  const byCategory = {};
  await Promise.all(
    categories.map(async (cat) => {
      const items = await fetchCategoryItems(cat);
      // 去重 + 限制則數
      const seen = new Set();
      const deduped = [];
      for (const it of items) {
        if (seen.has(it.title)) continue;
        seen.add(it.title);
        deduped.push(it);
        if (deduped.length >= OVERVIEW_ITEMS_PER_CATEGORY) break;
      }
      byCategory[cat] = deduped;
    })
  );
  return byCategory;
}

async function synthesizeOverview(byCategory) {
  // 建立帶全域 index 的清單，並記錄 index -> {category, item} 的對照表
  let globalIndex = 0;
  const indexMap = {};
  const sections = [];
  for (const [category, items] of Object.entries(byCategory)) {
    const lines = items.map((it) => {
      const line = `${globalIndex}. 標題: ${it.title}\n   原文摘要: ${it.rawSummary}`;
      indexMap[globalIndex] = { category, item: it };
      globalIndex += 1;
      return line;
    });
    sections.push(`【分類：${category}】\n${lines.join("\n")}`);
  }
  const listing = sections.join("\n\n");

  const prompt = `你是資深新聞編輯，以下是六大分類、每個分類數則的今日新聞清單（已附全域編號）。請完成兩件事，只回傳 JSON，不要有其他文字或 markdown code block：

1. 針對「每一個分類」，寫一段 2-3 句的繁體中文趨勢短評（今天這個分類大致在討論什麼、有沒有值得注意的走向），並從該分類挑出最多 3 則最重要的新聞（用全域編號標示，附上翻譯成繁體中文的標題與一句話中文摘要、重要度）。
2. 寫一段 3-4 句的「整體趨勢短評」，綜合六大分類今天的重點，讓讀者一次掌握全貌。

如果原文標題是英文，translated_title 請翻譯成繁體中文。

格式：
{
  "overall_commentary": "整體趨勢短評...",
  "categories": [
    {
      "category": "分類名稱",
      "trend": "這個分類的趨勢短評...",
      "highlights": [{"index": 0, "translated_title": "...", "summary": "...", "importance": "高/中/低"}]
    }
  ]
}

新聞清單：
${listing}`;

  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Groq API 錯誤: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  const parsed = JSON.parse(data.choices[0].message.content);

  const categories = (parsed.categories || []).map((catBlock) => ({
    category: catBlock.category,
    trend: catBlock.trend || "",
    highlights: (catBlock.highlights || []).map((h) => {
      const mapped = indexMap[h.index] || {};
      const item = mapped.item || {};
      return {
        title: h.translated_title || item.title || "",
        summary: h.summary || "",
        importance: h.importance || "中",
        link: item.link || "",
        source: item.source || "",
      };
    }),
  }));

  return { overallCommentary: parsed.overall_commentary || "", categories };
}

async function analyzeWithGroq(items) {
  if (items.length === 0) return {};
  const listing = items
    .map((it, i) => `${i}. 標題: ${it.title}\n   原文摘要: ${it.rawSummary}`)
    .join("\n");

  const prompt = `你是新聞編輯，請針對以下每則新聞產出結構化資料。務必只回傳 JSON，不要有任何其他文字或說明，不要用 markdown code block 包住。

重要規則：
- 如果原文標題是英文或其他非中文語言，translated_title 請翻譯成繁體中文；如果原文已是中文，可直接使用或稍微精簡。
- summary 一律使用繁體中文，不論原文語言為何，長度約 20-40 字。

格式：
{"items":[{"index":0,"translated_title":"繁體中文標題","summary":"一句話中文摘要","importance":"高/中/低","keywords":"關鍵字1, 關鍵字2"}, ...]}

新聞清單：
${listing}`;

  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Groq API 錯誤: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  const content = data.choices[0].message.content;
  const parsed = JSON.parse(content);
  const map = {};
  for (const entry of parsed.items || []) {
    map[entry.index] = entry;
  }
  return map;
}

const IMPORTANCE_ORDER = { 高: 0, 中: 1, 低: 2 };

module.exports = async (req, res) => {
  const category = req.query.category || OVERVIEW_KEY;

  if (category === OVERVIEW_KEY) {
    try {
      const byCategory = await fetchAllCategoriesRaw();
      const overview = await synthesizeOverview(byCategory);
      res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=300');
      res.status(200).json({
        mode: "overview",
        updatedAt: new Date().toISOString(),
        overallCommentary: overview.overallCommentary,
        categories: overview.categories,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (!RSS_FEEDS[category]) {
    res.status(400).json({ error: "不支援的分類", validCategories: Object.keys(RSS_FEEDS) });
    return;
  }

  try {
    const rawItems = await fetchCategoryItems(category);
    const analyses = await analyzeWithGroq(rawItems);

    const merged = rawItems.map((item, i) => {
      const a = analyses[i] || {};
      return {
        title: a.translated_title || item.title,
        summary: a.summary || item.rawSummary,
        importance: a.importance || "中",
        keywords: a.keywords || "",
        link: item.link,
        source: item.source,
      };
    });

    // 去重（同標題可能重複出現在多組 RSS 來源）
    const seen = new Set();
    const deduped = merged.filter((it) => {
      if (seen.has(it.title)) return false;
      seen.add(it.title);
      return true;
    });

    deduped.sort((a, b) => (IMPORTANCE_ORDER[a.importance] ?? 1) - (IMPORTANCE_ORDER[b.importance] ?? 1));

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=300');
    res.status(200).json({
      mode: "list",
      category,
      updatedAt: new Date().toISOString(),
      items: deduped,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
