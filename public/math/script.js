let FORMULA_UNITS = [];
let QUESTIONS = [];
let mode = "formulas";
let selectedFormulaUnit = null;

let quizStage = "setup"; // "setup" | "active" | "result"
let quizSetup = { unit: "all", difficulty: "all", count: 10 };
let quizSession = null; // { questions, index, correct, startTime, timerHandle, answered, selectedIndex, showExplain }

const stage = document.getElementById("stage");
const tabs = document.querySelectorAll(".tab");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    mode = tab.dataset.mode;
    if (mode === "quiz" && quizSession && quizSession.timerHandle) {
      // 離開測驗分頁時保留狀態，回來還能繼續看
    }
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

/* ---------- 公式卡 ---------- */
function renderFormulas() {
  if (!selectedFormulaUnit) selectedFormulaUnit = FORMULA_UNITS[0]?.unit;
  const unit = FORMULA_UNITS.find((u) => u.unit === selectedFormulaUnit);

  stage.innerHTML = `
    <div class="unit-select-row">
      <span class="unit-select-label">單元</span>
      <select class="unit-select" id="formulaUnitSelect">
        ${FORMULA_UNITS.map((u) => `<option value="${u.unit}" ${u.unit === selectedFormulaUnit ? "selected" : ""}>${u.title}（高${toGradeCn(u.grade)}）</option>`).join("")}
      </select>
    </div>
    <div class="formula-grid">
      ${(unit ? unit.formulas : [])
        .map(
          (f) => `
        <div class="formula-card">
          <p class="formula-name">${f.name}</p>
          <p class="formula-expr">${f.formula}</p>
          <p class="formula-note">${f.note}</p>
        </div>
      `
        )
        .join("")}
    </div>
  `;

  document.getElementById("formulaUnitSelect").addEventListener("change", (e) => {
    selectedFormulaUnit = e.target.value;
    renderFormulas();
  });
}

function toGradeCn(g) {
  return { "1": "一", "2": "二", "3": "三" }[g] || g;
}

/* ---------- 測驗設定 ---------- */
function renderQuizSetup() {
  stage.innerHTML = `
    <div class="quiz-setup">
      <h2>設定題目測驗</h2>
      <div class="setup-field">
        <label>單元</label>
        <div class="setup-options" id="unitChips">
          <button class="setup-chip ${quizSetup.unit === "all" ? "active" : ""}" data-unit="all">全部單元</button>
          ${FORMULA_UNITS.map((u) => `<button class="setup-chip ${quizSetup.unit === u.unit ? "active" : ""}" data-unit="${u.unit}">${u.title}</button>`).join("")}
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

  document.getElementById("unitChips").querySelectorAll(".setup-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      quizSetup.unit = btn.dataset.unit;
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
      (quizSetup.unit === "all" || q.unit === quizSetup.unit) &&
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
  if (mode === "formulas") {
    renderFormulas();
  } else if (mode === "quiz") {
    if (quizStage === "setup") renderQuizSetup();
    else if (quizStage === "active") renderQuizActive();
    else if (quizStage === "result") renderQuizResult();
  }
}

async function init() {
  try {
    const [formulasResp, questionsResp] = await Promise.all([fetch("math-formulas.json"), fetch("math-questions.json")]);
    FORMULA_UNITS = await formulasResp.json();
    QUESTIONS = await questionsResp.json();
    render();
  } catch {
    stage.innerHTML = `<div class="state-message">資料載入失敗，請重新整理。</div>`;
  }
}

init();
