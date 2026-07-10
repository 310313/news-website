let VOCAB = [];
let mode = "daily";
let cardIndex = 0;
let quizWord = null;
let quizMode = "meaning"; // "meaning" | "blank"
let quizScore = { correct: 0, total: 0 };
let blankWord = null;
const exampleCache = {};

const DAILY_COUNT = 10;

const stage = document.getElementById("stage");
const tabs = document.querySelectorAll(".tab");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    mode = tab.dataset.mode;
    render();
  });
});

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

function dayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now - start) / 86400000);
}

function pickRandom(list, n, excludeId) {
  const pool = list.filter((w) => w.id !== excludeId);
  const picked = [];
  while (picked.length < n && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked;
}

function renderExampleHtml(data) {
  return `<p class="ex-line"><strong>例句：</strong>${data.example}</p><p class="ex-line">${data.example_zh}</p><p class="ex-line ex-tip"><strong>提醒：</strong>${data.tip}</p>`;
}

async function fetchExample(word) {
  if (exampleCache[word]) return exampleCache[word];
  const resp = await fetch(`/api/vocab?word=${encodeURIComponent(word)}`);
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "載入失敗");
  exampleCache[word] = data;
  return data;
}

/* ---------- 每日十字 ---------- */
function getDailyWords() {
  const start = (dayOfYear() * DAILY_COUNT) % VOCAB.length;
  const result = [];
  for (let i = 0; i < DAILY_COUNT; i++) {
    result.push(VOCAB[(start + i) % VOCAB.length]);
  }
  return result;
}

function renderDaily() {
  const words = getDailyWords();
  stage.innerHTML = `
    <p class="flashcard-hint" style="text-align:center;margin-bottom:1rem;">今天的 ${words.length} 個單字</p>
    <div class="daily-grid">
      ${words
        .map(
          (w) => `
        <div class="daily-mini">
          <div class="mini-top">
            <span class="mini-word">${w.word}</span>
            <button class="speak-btn" data-word="${w.word}" title="發音">🔊</button>
          </div>
          <p class="mini-pos">${w.pos}</p>
          <p class="mini-zh">${w.zh}</p>
          <div class="mini-example" id="ex-${w.id}"></div>
          <div class="mini-actions">
            <button class="mini-btn example-btn" data-word="${w.word}" data-id="${w.id}">看例句</button>
            <button class="mini-btn learn-btn" data-id="${w.id}">學會了 ✓</button>
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  `;

  stage.querySelectorAll(".speak-btn").forEach((btn) => {
    btn.addEventListener("click", () => speak(btn.dataset.word));
  });

  stage.querySelectorAll(".example-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const exEl = document.getElementById(`ex-${btn.dataset.id}`);
      exEl.innerHTML = `<span class="loading-hint">AI 生成中…</span>`;
      btn.disabled = true;
      try {
        const data = await fetchExample(btn.dataset.word);
        exEl.innerHTML = renderExampleHtml(data);
      } catch {
        exEl.innerHTML = `<span class="loading-hint">載入失敗，稍後再試</span>`;
        btn.disabled = false;
      }
    });
  });

  stage.querySelectorAll(".learn-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (window.Progress) window.Progress.markVocabLearned(btn.dataset.id);
      btn.textContent = "已記錄 ✓";
      btn.disabled = true;
    });
  });
}

/* ---------- 單字卡 ---------- */
function renderCards() {
  const word = VOCAB[cardIndex % VOCAB.length];
  const cached = exampleCache[word.word];

  stage.innerHTML = `
    <div class="flashcard-wrap">
      <p class="flashcard-hint">點卡片翻面 · ${(cardIndex % VOCAB.length) + 1} / ${VOCAB.length}</p>
      <div class="flashcard" id="flip">
        <div class="flashcard-inner">
          <div class="flashcard-face front">
            <p class="word">${word.word}</p>
            <button class="speak-btn" id="speakFront" title="發音">🔊</button>
          </div>
          <div class="flashcard-face back">
            <p class="pos">${word.pos}</p>
            <p class="zh">${word.zh}</p>
            <div class="card-example" id="cardExample">${
              cached ? renderExampleHtml(cached) : '<span class="loading-hint">翻面查看例句…</span>'
            }</div>
          </div>
        </div>
      </div>
      <div class="card-nav">
        <button class="nav-btn" id="prevBtn">← 上一個</button>
        <button class="nav-btn" id="learnedBtn">記住了 ✓</button>
        <button class="nav-btn" id="nextBtn">下一個 →</button>
      </div>
    </div>
  `;

  document.getElementById("speakFront").addEventListener("click", (e) => {
    e.stopPropagation();
    speak(word.word);
  });

  const flipEl = document.getElementById("flip");
  flipEl.addEventListener("click", async () => {
    flipEl.classList.toggle("flipped");
    if (flipEl.classList.contains("flipped") && !exampleCache[word.word]) {
      const exEl = document.getElementById("cardExample");
      exEl.innerHTML = `<span class="loading-hint">載入例句中…</span>`;
      try {
        const data = await fetchExample(word.word);
        exEl.innerHTML = renderExampleHtml(data);
      } catch {
        exEl.innerHTML = `<span class="loading-hint">載入失敗</span>`;
      }
    }
  });

  document.getElementById("prevBtn").addEventListener("click", () => {
    cardIndex = (cardIndex - 1 + VOCAB.length) % VOCAB.length;
    renderCards();
  });
  document.getElementById("nextBtn").addEventListener("click", () => {
    cardIndex = (cardIndex + 1) % VOCAB.length;
    renderCards();
  });
  document.getElementById("learnedBtn").addEventListener("click", () => {
    if (window.Progress) window.Progress.markVocabLearned(word.id);
    cardIndex = (cardIndex + 1) % VOCAB.length;
    renderCards();
  });
}

/* ---------- 測驗（字義 + 句子填空） ---------- */
function renderQuizShell() {
  stage.innerHTML = `
    <div class="quiz-subtabs">
      <button class="subtab ${quizMode === "meaning" ? "active" : ""}" data-qm="meaning">字義測驗</button>
      <button class="subtab ${quizMode === "blank" ? "active" : ""}" data-qm="blank">句子填空</button>
    </div>
    <div id="quizArea"></div>
  `;
  stage.querySelectorAll(".subtab").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.qm === quizMode) return;
      quizMode = btn.dataset.qm;
      quizScore = { correct: 0, total: 0 };
      renderQuizShell();
      if (quizMode === "meaning") newQuizQuestion();
      else newBlankQuestion();
    });
  });
}

function newQuizQuestion() {
  quizWord = VOCAB[Math.floor(Math.random() * VOCAB.length)];
  const distractors = pickRandom(VOCAB, 3, quizWord.id);
  const options = [...distractors.map((w) => w.zh), quizWord.zh].sort(() => Math.random() - 0.5);
  renderMeaningQuiz(options);
}

function renderMeaningQuiz(options) {
  const quizArea = document.getElementById("quizArea");
  quizArea.innerHTML = `
    <div class="quiz-card">
      <p class="quiz-question">${quizWord.word}</p>
      <div class="quiz-options" id="quizOptions">
        ${options.map((opt) => `<button class="quiz-option" data-opt="${opt}">${opt}</button>`).join("")}
      </div>
      <p class="quiz-score">答對 ${quizScore.correct} / ${quizScore.total} 題</p>
    </div>
  `;
  quizArea.querySelectorAll(".quiz-option").forEach((btn) => {
    btn.addEventListener("click", () => handleMeaningAnswer(btn));
  });
}

function handleMeaningAnswer(btn) {
  const isCorrect = btn.dataset.opt === quizWord.zh;
  quizScore.total += 1;
  if (isCorrect) {
    quizScore.correct += 1;
    if (window.Progress) window.Progress.markVocabLearned(quizWord.id);
  }
  const card = document.querySelector(".quiz-card");
  card.querySelectorAll(".quiz-option").forEach((b) => {
    b.disabled = true;
    if (b.dataset.opt === quizWord.zh) b.classList.add("correct");
    else if (b === btn) b.classList.add("wrong");
  });
  card.querySelector(".quiz-score").textContent = `答對 ${quizScore.correct} / ${quizScore.total} 題`;
  const nextBtn = document.createElement("button");
  nextBtn.className = "next-btn";
  nextBtn.textContent = "下一題 →";
  nextBtn.addEventListener("click", newQuizQuestion);
  card.appendChild(nextBtn);
}

async function newBlankQuestion() {
  const quizArea = document.getElementById("quizArea");
  quizArea.innerHTML = `<div class="quiz-card"><p class="state-message" style="padding:2rem 0;">AI 出題中…</p></div>`;
  const word = VOCAB[Math.floor(Math.random() * VOCAB.length)];
  try {
    const data = await fetchExample(word.word);
    const regex = new RegExp(`\\b${word.word}\\b`, "i");
    if (!regex.test(data.example)) {
      newBlankQuestion();
      return;
    }
    blankWord = word;
    const blanked = data.example.replace(regex, "______");
    const distractors = pickRandom(VOCAB, 3, word.id).map((w) => w.word);
    const options = [...distractors, word.word].sort(() => Math.random() - 0.5);
    renderBlankQuiz(blanked, data.example_zh, options);
  } catch {
    quizArea.innerHTML = `
      <div class="quiz-card">
        <p class="state-message" style="padding:1rem 0;">出題失敗，請重試。</p>
        <button class="next-btn" id="retryBlank">重新出題</button>
      </div>`;
    document.getElementById("retryBlank").addEventListener("click", newBlankQuestion);
  }
}

function renderBlankQuiz(blankedSentence, zh, options) {
  const quizArea = document.getElementById("quizArea");
  quizArea.innerHTML = `
    <div class="quiz-card">
      <p class="blank-sentence">${blankedSentence}</p>
      <p class="blank-zh">${zh}</p>
      <div class="quiz-options" id="blankOptions">
        ${options.map((opt) => `<button class="quiz-option" data-opt="${opt}">${opt}</button>`).join("")}
      </div>
      <p class="quiz-score">答對 ${quizScore.correct} / ${quizScore.total} 題</p>
    </div>
  `;
  quizArea.querySelectorAll(".quiz-option").forEach((btn) => {
    btn.addEventListener("click", () => handleBlankAnswer(btn));
  });
}

function handleBlankAnswer(btn) {
  const chosen = btn.dataset.opt.toLowerCase();
  const isCorrect = chosen === blankWord.word.toLowerCase();
  quizScore.total += 1;
  if (isCorrect) {
    quizScore.correct += 1;
    if (window.Progress) window.Progress.markVocabLearned(blankWord.id);
  }
  const card = document.querySelector(".quiz-card");
  card.querySelectorAll(".quiz-option").forEach((b) => {
    b.disabled = true;
    if (b.dataset.opt.toLowerCase() === blankWord.word.toLowerCase()) b.classList.add("correct");
    else if (b === btn) b.classList.add("wrong");
  });
  card.querySelector(".quiz-score").textContent = `答對 ${quizScore.correct} / ${quizScore.total} 題`;
  const nextBtn = document.createElement("button");
  nextBtn.className = "next-btn";
  nextBtn.textContent = "下一題 →";
  nextBtn.addEventListener("click", newBlankQuestion);
  card.appendChild(nextBtn);
}

/* ---------- 主渲染 ---------- */
function render() {
  if (mode === "daily") renderDaily();
  else if (mode === "cards") renderCards();
  else if (mode === "quiz") {
    renderQuizShell();
    if (quizMode === "meaning") newQuizQuestion();
    else newBlankQuestion();
  }
}

async function init() {
  try {
    const resp = await fetch("vocab-data.json");
    VOCAB = await resp.json();
    render();
  } catch {
    stage.innerHTML = `<div class="state-message">單字庫載入失敗，請重新整理。</div>`;
  }
}

init();
