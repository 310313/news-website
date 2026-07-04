"""
每日新聞日報自動產生器
流程: RSS 抓新聞 -> Groq AI 分類/摘要/評重要度/取關鍵字 -> 逐則寫入 News 資料庫 -> 當日彙整寫入 Daily Reports

需要的環境變數:
- GROQ_API_KEY            Groq Console 取得 (免費額度, console.groq.com/keys)
- NOTION_TOKEN             Notion Integration Token
- NEWS_DATABASE_ID         「News 資料庫」的 ID
- DAILY_REPORT_DATABASE_ID 「Daily Reports」資料庫的 ID
"""

import os
import re
import json
import datetime
from urllib.parse import urlparse

import feedparser
import requests

# ========== 新聞來源設定 ==========
RSS_FEEDS = {
    "台灣要聞": "https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant",
    "國際新聞": "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en",
    "科技": "https://news.google.com/rss/search?q=%E7%A7%91%E6%8A%80&hl=zh-TW&gl=TW&ceid=TW:zh-Hant",
    "財經": "https://news.google.com/rss/search?q=%E8%B2%A1%E7%B6%93&hl=zh-TW&gl=TW&ceid=TW:zh-Hant",
}
MAX_ITEMS_PER_FEED = 6

GROQ_API_KEY = os.environ["GROQ_API_KEY"]
NOTION_TOKEN = os.environ["NOTION_TOKEN"]
NEWS_DATABASE_ID = os.environ["NEWS_DATABASE_ID"]
DAILY_REPORT_DATABASE_ID = os.environ["DAILY_REPORT_DATABASE_ID"]

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
NOTION_HEADERS = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
}


def fetch_news():
    """抓取各分類的新聞，回傳攤平後的清單，每則帶著 category"""
    all_items = []
    for category, url in RSS_FEEDS.items():
        feed = feedparser.parse(url)
        for entry in feed.entries[:MAX_ITEMS_PER_FEED]:
            source_title = ""
            if hasattr(entry, "source") and hasattr(entry.source, "title"):
                source_title = entry.source.title
            if not source_title:
                source_title = urlparse(entry.get("link", "")).netloc
            all_items.append({
                "category": category,
                "title": entry.get("title", ""),
                "link": entry.get("link", ""),
                "raw_summary": re.sub("<[^<]+?>", "", entry.get("summary", ""))[:300],
                "source": source_title,
            })
    return all_items


def analyze_with_groq(items):
    """一次請 Groq 針對所有新聞產出：摘要、重要度、關鍵字（回傳 JSON）"""
    listing = "\n".join(
        f"{i}. 標題: {it['title']}\n   分類: {it['category']}\n   原文摘要: {it['raw_summary']}"
        for i, it in enumerate(items)
    )
    prompt = f"""你是新聞編輯，請針對以下每則新聞產出結構化資料。務必只回傳 JSON，不要有任何其他文字或說明，不要用 markdown code block 包住。

格式為：
{{"items": [{{"index": 0, "summary": "一句話中文摘要(20-40字)", "importance": "高/中/低", "keywords": "關鍵字1, 關鍵字2, 關鍵字3"}}, ...]}}

新聞清單：
{listing}
"""
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
    body = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    resp = requests.post(GROQ_URL, headers=headers, json=body, timeout=90)
    resp.raise_for_status()
    content = resp.json()["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    return {entry["index"]: entry for entry in parsed.get("items", [])}


def chunk_richtext(text, size=1900):
    """把長文字切成多個 rich_text 物件（Notion 單一物件上限約 2000 字）"""
    chunks = [text[i:i + size] for i in range(0, len(text), size)] or [""]
    return [{"type": "text", "text": {"content": c}} for c in chunks]


def write_news_item(item, analysis, today_iso):
    """寫入單則新聞到 News 資料庫"""
    payload = {
        "parent": {"database_id": NEWS_DATABASE_ID},
        "properties": {
            "標題": {"title": [{"text": {"content": item["title"][:200]}}]},
            "日期": {"date": {"start": today_iso}},
            "來源": {"select": {"name": item["source"][:100] or "未知來源"}},
            "分類": {"select": {"name": item["category"]}},
            "摘要": {"rich_text": chunk_richtext(analysis.get("summary", ""))},
            "關鍵字": {"rich_text": chunk_richtext(analysis.get("keywords", ""))},
            "重要度": {"select": {"name": analysis.get("importance", "中")}},
            "連結": {"url": item["link"] or None},
        },
    }
    resp = requests.post("https://api.notion.com/v1/pages", headers=NOTION_HEADERS, json=payload, timeout=30)
    if resp.status_code >= 400:
        print("Notion API 錯誤回應:", resp.text)
    resp.raise_for_status()


def write_daily_report(items_with_analysis, today_str):
    """寫入當日彙整報告到 Daily Reports 資料庫"""
    by_category = {}
    for item, analysis in items_with_analysis:
        by_category.setdefault(item["category"], []).append((item, analysis))

    lines = []
    for category, entries in by_category.items():
        lines.append(f"## {category}")
        for item, analysis in entries:
            importance = analysis.get("importance", "中")
            summary = analysis.get("summary", "")
            lines.append(f"- 【{importance}】{item['title']} — {summary}（{item['link']}）")
        lines.append("")
    content_text = "\n".join(lines)

    payload = {
        "parent": {"database_id": DAILY_REPORT_DATABASE_ID},
        "properties": {
            "標題": {"title": [{"text": {"content": f"每日新聞日報 {today_str}"}}]},
            "日期": {"date": {"start": today_str}},
            "內容": {"rich_text": chunk_richtext(content_text)},
        },
    }
    resp = requests.post("https://api.notion.com/v1/pages", headers=NOTION_HEADERS, json=payload, timeout=30)
    if resp.status_code >= 400:
        print("Notion API 錯誤回應:", resp.text)
    resp.raise_for_status()
    print("Daily Report 已寫入:", resp.json().get("url"))


def main():
    today = datetime.date.today()
    today_iso = today.isoformat()

    print("抓取新聞中...")
    items = fetch_news()
    print(f"共取得 {len(items)} 則新聞，開始請 AI 分析...")

    analyses = analyze_with_groq(items)

    items_with_analysis = []
    for i, item in enumerate(items):
        analysis = analyses.get(i, {"summary": "", "importance": "中", "keywords": ""})
        write_news_item(item, analysis, today_iso)
        items_with_analysis.append((item, analysis))
        print(f"已寫入: {item['title'][:30]}")

    write_daily_report(items_with_analysis, today_iso)
    print("全部完成！")


if __name__ == "__main__":
    main()
