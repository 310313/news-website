// Vercel Serverless Function
// 輸入：?word=xxx  輸出：該單字的 AI 生成例句 + 中文解釋 + 記憶技巧

module.exports = async (req, res) => {
  const word = (req.query.word || "").trim();
  if (!word) {
    res.status(400).json({ error: "缺少 word 參數" });
    return;
  }

  const prompt = `你是英文老師，請針對英文單字 "${word}" 提供學習資料，給台灣高中生使用。只回傳 JSON，不要有其他文字或 markdown code block。

格式：
{"example":"一句包含這個字的英文例句","example_zh":"例句的中文翻譯","tip":"一句話的記憶技巧或用法提醒（繁體中文）"}`;

  try {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Groq API 錯誤: ${resp.status} ${text}`);
    }

    const data = await resp.json();
    const parsed = JSON.parse(data.choices[0].message.content);

    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=3600");
    res.status(200).json({ word, ...parsed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
