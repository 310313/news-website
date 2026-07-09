const OVERVIEW_KEY = "今日焦點";
const CATEGORIES = [
{ name: "政治/國際", color: "var(--cat-politics)" },
{ name: "財經/產業", color: "var(--cat-finance)" },
{ name: "科技", color: "var(--cat-tech)" },
{ name: "社會/犯罪", color: "var(--cat-crime)" },
{ name: "生活/健康/娛樂", color: "var(--cat-life)" },
{ name: "體育", color: "var(--cat-sports)" },
{ name: "AI", color: "var(--cat-ai-news)", icon: "🤖" },
];

function colorFor(name) {
const found = CATEGORIES.find((c) => c.name === name);
return found ? found.color : "var(--pin-gold)";
}

let currentCategory = null;
let lastUpdatedAt = null;

const overviewZone = document.getElementById("overviewZone");
const tagRail = document.getElementById("tagRail");
const contentEl = document.getElementById("content");
const updatedAgoEl = document.getElementById("updatedAgo");

function escapeHtml(str) {
const div = document.createElement("div");
div.textContent = str;
return div.innerHTML;
}

function markUpdated() {
lastUpdatedAt = new Date();
updateAgoText();
}

/* ---------- 分類標籤列 ---------- */
function renderTags() {
tagRail.innerHTML = "";
CATEGORIES.forEach((cat) => {
const btn = document.createElement("button");
btn.className = "tag-chip" + (cat.name === currentCategory ? " active" : "");
btn.innerHTML = `<span class="dot" style="background:${cat.color}"></span>${cat.icon ? cat.icon + " " : ""}${escapeHtml(cat.name)}`;
btn.addEventListener("click", () => {
if (cat.name === currentCategory) return;
currentCategory = cat.name;
renderTags();
loadCategory(cat.name);
});
tagRail.appendChild(btn);
});
}

function showMessage(text) {
contentEl.innerHTML = `<div class="state-message">${text}</div>`;
}

/* ---------- 一般分類：剪報卡片列表 ---------- */
function renderClippingCard(item, i) {
const tilt = (i % 2 === 0 ? 1 : -1) * (0.4 + (i % 3) * 0.35);
const keywords = (item.keywords || "")
.split(",")
.map((k) => k.trim())
.filter(Boolean)
.slice(0, 4);

const card = document.createElement("article");
card.className = "clip-card";
card.style.setProperty("--tilt", `${tilt}deg`);
card.innerHTML = `
<div class="clip-meta">
<span class="importance-badge importance-${escapeHtml(item.importance || "中")}">${escapeHtml(item.importance || "中")}</span>
<span>${escapeHtml(item.source || "未知來源")}</span>
</div>
<h2 class="clip-title">${escapeHtml(item.title || "")}</h2>
<p class="clip-summary">${escapeHtml(item.summary || "")}</p>
${keywords.length ? `<div class="clip-keywords">${keywords.map((k) => `<span class="keyword-tag">#${escapeHtml(k)}</span>`).join("")}</div>` : ""}
${item.link ? `<a class="clip-link" href="${item.link}" target="_blank" rel="noopener noreferrer">閱讀原文 →</a>` : ""}
`;
return card;
}

function renderList(items) {
if (!items || items.length === 0) {
showMessage("目前這個分類抓不到新聞，稍後重新整理再試一次。");
return;
}
const grid = document.createElement("div");
grid.className = "clippings";
items.forEach((item, i) => grid.appendChild(renderClippingCard(item, i)));
contentEl.innerHTML = "";
contentEl.appendChild(grid);
}

async function loadCategory(name) {
showMessage("正在即時抓取最新新聞…");
try {
const resp = await fetch(`/api/news?category=${encodeURIComponent(name)}`);
const data = await resp.json();
if (!resp.ok) {
showMessage(`抓取失敗：${data.error || "未知錯誤"}`);
return;
}
markUpdated();
renderList(data.items);
} catch (err) {
showMessage("網路異常，無法連線到新聞來源，請稍後再試。");
}
}

/* ---------- 今日焦點：固定在頂端，一進站就自動載入 ---------- */
function renderOverview(data) {
overviewZone.innerHTML = "";

const header = document.createElement("div");
header.className = "overview-header";
header.innerHTML = `<span class="overview-eyebrow">✦ ${escapeHtml(OVERVIEW_KEY)}</span>`;
overviewZone.appendChild(header);

const commentaryCard = document.createElement("div");
commentaryCard.className = "overview-note";
commentaryCard.innerHTML = `<p>${escapeHtml(data.overallCommentary || "目前還沒有足夠的新聞可以統整。")}</p>`;
overviewZone.appendChild(commentaryCard);

const sectionsWrap = document.createElement("div");
sectionsWrap.className = "overview-sections";

(data.categories || []).forEach((block) => {
const details = document.createElement("details");
details.className = "overview-section";
details.open = true;
details.style.setProperty("--accent", colorFor(block.category));

const summary = document.createElement("summary");
summary.innerHTML = `
<span class="dot" style="background:${colorFor(block.category)}"></span>
<span class="overview-section-title">${escapeHtml(block.category)}</span>
<span class="overview-section-count">${(block.highlights || []).length} 則重點</span>
`;
details.appendChild(summary);

const trendP = document.createElement("p");
trendP.className = "overview-trend";
trendP.textContent = block.trend || "";
details.appendChild(trendP);

const grid = document.createElement("div");
grid.className = "clippings clippings--compact";
(block.highlights || []).forEach((item, i) => grid.appendChild(renderClippingCard(item, i)));
details.appendChild(grid);

sectionsWrap.appendChild(details);
});

overviewZone.appendChild(sectionsWrap);
}

async function loadOverview() {
overviewZone.innerHTML = `<div class="state-message state-message--overview">AI 正在統整六大分類的今日趨勢，請稍候…</div>`;
try {
const resp = await fetch(`/api/news?category=${encodeURIComponent(OVERVIEW_KEY)}`);
const data = await resp.json();
if (!resp.ok) {
overviewZone.innerHTML = `<div class="state-message state-message--overview">統整失敗：${escapeHtml(data.error || "未知錯誤")}</div>`;
return;
}
markUpdated();
renderOverview(data);
} catch (err) {
overviewZone.innerHTML = `<div class="state-message state-message--overview">網路異常，無法連線，請稍後重新整理。</div>`;
}
}

function updateAgoText() {
if (!lastUpdatedAt) {
updatedAgoEl.textContent = "尚未更新";
return;
}
const seconds = Math.floor((Date.now() - lastUpdatedAt.getTime()) / 1000);
if (seconds < 5) {
updatedAgoEl.textContent = "剛剛更新";
} else if (seconds < 60) {
updatedAgoEl.textContent = `${seconds} 秒前更新`;
} else {
const mins = Math.floor(seconds / 60);
updatedAgoEl.textContent = `${mins} 分鐘前更新`;
}
}

setInterval(updateAgoText, 3000);
renderTags();
loadOverview();
