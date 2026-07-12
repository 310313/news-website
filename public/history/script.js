let TIMELINE = [];
let QUESTIONS = [];
let mode = "timeline";
let selectedBranch = "world";
let expandedIds = new Set();

const BRANCHES = [
  { value: "world", label: "世界史" },
  { value: "china", label: "中國史" },
  { value: "taiwan", label: "台灣史" },
];

let quizStage = "setup"; // "setup" | "active" | "result"
let quizSetup = { branch: "all", difficulty: "all", count: 10 };
let quizSession = null;

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

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- 時間軸（台灣／中國／世界 三欄並排對照） ---------- */
function renderTimeline() {
  stage.innerHTML = `
    <p class="unit-select-label" style="margin-bottom:0.8rem;">左右滑動可以看三個分域的時間軸，同一橫向大致對應相近的年代。</p>
    <div class="timeline-columns" id="timelineColumns">
      ${BRANCHES.map((b) => renderTimelineColumn(b)).join("")}
    </div>
  `;

  stage.querySelectorAll(".timeline-card").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      if (expandedIds.has(id)) expandedIds.delete(id);
      else expandedIds.add(id);
      renderTimeline();
    });
  });
}

function renderTimelineColumn(branch) {
  const items = TIMELINE.filter((t) => t.branch === branch.value).sort((a, b) => a.yearValue - b.yearValue);
  return `
    <div class="timeline-column">
      <p class="timeline-column-title branch-${branch.value}">${branch.label}</p>
      ${
        items.length === 0
          ? `<div class="timeline-column-empty">還沒有收錄內容，持續擴充中。</div>`
          : `<div class="timeline-wrap">
        ${items
          .map(
            (t) => `
          <div class="timeline-item">
            <span class="timeline-dot"></span>
            <div class="timeline-card" data-id="${t.id}">
              <p class="timeline-year">${t.year}</p>
              <p class="timeline-title">${t.title}</p>
              <p class="timeline-summary">${t.summary}</p>
              <p class="timeline-expand-hint">${expandedIds.has(t.id) ? "▲ 收合" : "▼ 點擊看詳細內容"}</p>
              ${
                expandedIds.has(t.id)
                  ? `<div class="timeline-detail">
                      <div class="timeline-detail-image">${t.image ? `<img src="${t.image}" alt="${t.title}" style="width:100%;border-radius:4px;" />` : "（圖片待補充）"}</div>
                      ${t.detail}
                    </div>`
                  : ""
              }
            </div>
          </div>
        `
          )
          .join("")}
      </div>`
      }
    </div>
  `;
}

/* ---------- 測驗設定 ---------- */
function renderQuizSetup() {
  stage.innerHTML = `
    <div class="quiz-setup">
      <h2>設定題目測驗</h2>
      <div class="setup-field">
        <label>範圍</label>
        <div class="setup-options" id="branchChips">
          <button class="setup-chip ${quizSetup.branch === "all" ? "active" : ""}" data-branch="all">全部範圍</button>
          ${BRANCHES.map((b) => `<button class="setup-chip ${quizSetup.branch === b.value ? "active" : ""}" data-branch="${b.value}">${b.label}</button>`).join("")}
        </div>
      </div>
      <div class="setup-field">
        <label>難度</label>
        <div class="setup-options" id="difficultyChips">
          ${[
            ["all", "全部難度"],
            ["basic", "基礎"],
            ["medium", "中等"],
            ["hard", "進階"],
          ]
            .map(([v, l]) => `<button class="setup-chip ${quizSetup.difficulty === v ? "active" : ""}" data-diff="${v}">${l}</button>`)
            .join("")}
        </div>
      </div>
      <div class="setup-field">
        <label>題數</label>
        <div class="setup-options" id="countChips">
          ${[5, 10, 15, 20]
            .map((n) => `<button class="setup-chip ${quizSetup.count === n ? "active" : ""}" data-count="${n}">${n} 題</button>`)
            .join("")}
        </div>
      </div>
      <p class="unit-select-label" style="text-align:center;color:var(--ink-soft);">符合條件的題目共 ${countAvailable()} 題</p>
      <button class="start-quiz-btn" id="startQuizBtn" ${countAvailable() === 0 ? "disabled" : ""}>開始測驗 · 開始碼表計時</button>
    </div>
  `;

  document.getElementById("branchChips").querySelectorAll(".setup-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      quizSetup.branch = btn.dataset.branch;
      renderQuizSetup();
    });
  });
  document.getElementById("difficultyChips").querySelectorAll(".setup-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      quizSetup.difficulty = btn.dataset.diff;
      renderQuizSetup();
    });
  });
  document.getElementById("countChips").querySelectorAll(".setup-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      quizSetup.count = Number(btn.dataset.count);
      renderQuizSetup();
    });
  });
  document.getElementById("startQuizBtn").addEventListener("click", startQuiz);
}

function filterQuestions() {
  return QUESTIONS.filter(
    (q) =>
      (quizSetup.branch === "all" || q.branch === quizSetup.branch) &&
      (quizSetup.difficulty === "all" || q.difficulty === quizSetup.difficulty)
  );
}

function countAvailable() {
  return filterQuestions().length;
}

function shuffleQuestionOptions(q) {
  const order = shuffle(q.options.map((_, i) => i));
  return {
    ...q,
    options: order.map((i) => q.options[i]),
    answer: order.indexOf(q.answer),
  };
}

function startQuiz() {
  const pool = shuffle(filterQuestions())
    .slice(0, quizSetup.count)
    .map(shuffleQuestionOptions);
  quizSession = {
    questions: pool,
    index: 0,
    correct: 0,
    startTime: Date.now(),
    elapsed: 0,
    timerHandle: null,
    answered: false,
    selectedIndex: null,
    showExplain: false,
  };
  quizStage = "active";
  renderQuizActive();
  quizSession.timerHandle = setInterval(updateTimerDisplay, 1000);
}

function stopTimer() {
  if (quizSession && quizSession.timerHandle) {
    clearInterval(quizSession.timerHandle);
    quizSession.timerHandle = null;
  }
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function updateTimerDisplay() {
  const el = document.getElementById("quizTimer");
  if (!el || !quizSession) return;
  el.textContent = formatTime(Date.now() - quizSession.startTime);
}

/* ---------- 測驗進行中 ---------- */
function renderQuizActive() {
  const q = quizSession.questions[quizSession.index];
  const total = quizSession.questions.length;

  stage.innerHTML = `
    <div class="quiz-top-bar">
      <span>第 ${quizSession.index + 1} / ${total} 題 · 答對 ${quizSession.correct} 題</span>
      <span class="quiz-timer" id="quizTimer">${formatTime(Date.now() - quizSession.startTime)}</span>
    </div>
    <div class="quiz-card">
      <p class="quiz-question">${q.question}</p>
      <div class="quiz-options" id="quizOptions">
        ${q.options.map((opt, i) => `<button class="quiz-option" data-i="${i}">${opt}</button>`).join("")}
      </div>
      <div id="quizActionsArea"></div>
    </div>
  `;

  document.querySelectorAll("#quizOptions .quiz-option").forEach((btn) => {
    btn.addEventListener("click", () => handleAnswer(Number(btn.dataset.i)));
  });
}

function handleAnswer(chosenIndex) {
  if (quizSession.answered) return;
  const q = quizSession.questions[quizSession.index];
  const isCorrect = chosenIndex === q.answer;
  quizSession.answered = true;
  quizSession.selectedIndex = chosenIndex;
  if (isCorrect) quizSession.correct += 1;

  document.querySelectorAll("#quizOptions .quiz-option").forEach((b, i) => {
    b.disabled = true;
    if (i === q.answer) b.classList.add("correct");
    else if (i === chosenIndex) b.classList.add("wrong");
  });

  renderQuizActions();
}

function renderQuizActions() {
  const q = quizSession.questions[quizSession.index];
  const isLast = quizSession.index === quizSession.questions.length - 1;
  const area = document.getElementById("quizActionsArea");
  area.innerHTML = `
    <div class="quiz-actions">
      <button class="explain-btn" id="toggleExplainBtn">${quizSession.showExplain ? "隱藏詳解" : "查看詳解"}</button>
      <button class="next-btn" id="nextQuestionBtn">${isLast ? "看結果 →" : "下一題 →"}</button>
    </div>
    ${quizSession.showExplain ? `<div class="explain-box"><strong>詳解：</strong>${q.explanation}</div>` : ""}
  `;
  document.getElementById("toggleExplainBtn").addEventListener("click", () => {
    quizSession.showExplain = !quizSession.showExplain;
    renderQuizActions();
  });
  document.getElementById("nextQuestionBtn").addEventListener("click", goNextQuestion);
}

function goNextQuestion() {
  if (quizSession.index < quizSession.questions.length - 1) {
    quizSession.index += 1;
    quizSession.answered = false;
    quizSession.selectedIndex = null;
    quizSession.showExplain = false;
    renderQuizActive();
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  stopTimer();
  quizSession.elapsed = Date.now() - quizSession.startTime;
  quizStage = "result";
  renderQuizResult();
}

function renderQuizResult() {
  const total = quizSession.questions.length;
  stage.innerHTML = `
    <div class="result-card">
      <p class="unit-select-label">測驗結束</p>
      <p class="result-score">${quizSession.correct} / ${total}</p>
      <p class="result-time">花費時間：${formatTime(quizSession.elapsed)}</p>
      <div class="result-actions">
        <button class="result-btn primary" id="retakeBtn">用同樣設定再測一次</button>
        <button class="result-btn secondary" id="backSetupBtn">回設定畫面</button>
      </div>
    </div>
  `;
  document.getElementById("retakeBtn").addEventListener("click", startQuiz);
  document.getElementById("backSetupBtn").addEventListener("click", () => {
    quizStage = "setup";
    quizSession = null;
    render();
  });
}

/* ---------- 主渲染 ---------- */
function render() {
  if (mode === "timeline") {
    renderTimeline();
  } else if (mode === "quiz") {
    if (quizStage === "setup") renderQuizSetup();
    else if (quizStage === "active") renderQuizActive();
    else if (quizStage === "result") renderQuizResult();
  }
}

async function init() {
  try {
    const [timelineResp, questionsResp] = await Promise.all([fetch("history-timeline.json"), fetch("history-questions.json")]);
    TIMELINE = await timelineResp.json();
    QUESTIONS = await questionsResp.json();
    render();
  } catch {
    stage.innerHTML = `<div class="state-message">資料載入失敗，請重新整理。</div>`;
  }
}

init();
