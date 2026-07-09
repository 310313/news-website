let VOCAB = [];
let mode = "daily";
let cardIndex = 0;
let quizWord = null;
let quizScore = { correct: 0, total: 0 };

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

function dayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  return Math.floor(diff / 86400000);
}

function pickRandom(list, n, exclude) {
  const pool = list.filter((w) => w.id !== exclude);
  const picked = [];
  while (picked.length < n && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked;
}

/* ---------- 每日一字 ---------- */
async function renderDaily() {
  const word = VOCAB[dayOfYear() % VOCAB.length];
  stage.innerHTML = `
    <div class="daily-card">
      <p class="daily-pos">${word.pos}</p>
      <h2 class="daily-word">${word.word}</h2>
      <p class="daily-zh">${word.zh}</p>
      <div class="daily-extra" id="dailyExtra">AI 正在生成例句…</div>
      <button class="mark-btn" id="markBtn">我學會了 ✓</button>
    </div>
  `;
  document.getElementById("markBtn").addEventListener("click", (e) => {
    if (window.Progress) window.Progress.markVocabLearned(word.id);
    e.target.textContent = "已記錄 ✓";
    e.target.disabled = true;
  });

  try {
    const resp = await fetch(`/api/vocab?word=${encodeURIComponent(word.word)}`);
    const data = await resp.json();
    const extra = document.getElementById("dailyExtra");
    if (resp.ok) {
      extra.innerHTML = `
        <strong>例句：</strong>${data.example}<br>
        <strong>翻譯：</strong>${data.example_zh}<br>
        <strong>小提醒：</strong>${data.tip}
      `;
    } else {
      extra.textContent = "例句生成失敗，稍後再試。";
    }
  } catch {
    document.getElementById("dailyExtra").textContent = "網路異常，例句無法載入。";
  }
}

/* ---------- 單字卡 ---------- */
function renderCards() {
  const word = VOCAB[cardIndex % VOCAB.length];
  stage.innerHTML = `
    <div class="flashcard-wrap">
      <p class="flashcard-hint">點卡片翻面 · ${cardIndex % VOCAB.length + 1} / ${VOCAB.length}</p>
      <div class="flashcard" id="flip">
        <div class="flashcard-inner">
          <div class="flashcard-face front">
            <p class="word">${word.word}</p>
          </div>
          <div class="flashcard-face back">
            <p class="pos">${word.pos}</p>
            <p class="zh">${word.zh}</p>
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
  document.getElementById("flip").addEventListener("click", (e) => {
    e.currentTarget.classList.toggle("flipped");
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

/* ---------- 選擇題測驗 ---------- */
function newQuizQuestion() {
  quizWord = VOCAB[Math.floor(Math.random() * VOCAB.length)];
  const distractors = pickRandom(VOCAB, 3, quizWord.id);
  const options = [...distractors.map((w) => w.zh), quizWord.zh].sort(() => Math.random() - 0.5);
  renderQuiz(options);
}

function renderQuiz(options) {
  stage.innerHTML = `
    <div class="quiz-card">
      <p class="quiz-question">${quizWord.word}</p>
      <div class="quiz-options" id="quizOptions">
        ${options.map((opt) => `<button class="quiz-option" data-opt="${opt}">${opt}</button>`).join("")}
      </div>
      <p class="quiz-score">答對 ${quizScore.correct} / ${quizScore.total} 題</p>
    </div>
  `;
  document.querySelectorAll(".quiz-option").forEach((btn) => {
    btn.addEventListener("click", () => handleQuizAnswer(btn, options));
  });
}

function handleQuizAnswer(btn, options) {
  const chosen = btn.dataset.opt;
  const isCorrect = chosen === quizWord.zh;
  quizScore.total += 1;
  if (isCorrect) {
    quizScore.correct += 1;
    if (window.Progress) window.Progress.markVocabLearned(quizWord.id);
  }
  document.querySelectorAll(".quiz-option").forEach((b) => {
    b.disabled = true;
    if (b.dataset.opt === quizWord.zh) b.classList.add("correct");
    else if (b === btn) b.classList.add("wrong");
  });
  const nextBtn = document.createElement("button");
  nextBtn.className = "next-btn";
  nextBtn.textContent = "下一題 →";
  nextBtn.addEventListener("click", newQuizQuestion);
  document.querySelector(".quiz-card").appendChild(nextBtn);
  document.querySelector(".quiz-score").textContent = `答對 ${quizScore.correct} / ${quizScore.total} 題`;
}

/* ---------- 主渲染 ---------- */
function render() {
  if (mode === "daily") renderDaily();
  else if (mode === "cards") renderCards();
  else if (mode === "quiz") newQuizQuestion();
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
