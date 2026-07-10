let ZI = [];
let mode = "compare";
let groupIndex = 0;
let quizScore = { correct: 0, total: 0 };
let currentTarget = null;

const stage = document.getElementById("stage");
const tabs = document.querySelectorAll(".tab");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    mode = tab.dataset.mode;
    quizScore = { correct: 0, total: 0 };
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

function buildOptions(group, targetChar) {
  let pool = group.chars.map((c) => c.char).filter((c) => c !== targetChar);
  let options = [targetChar, ...shuffle(pool).slice(0, 3)];
  if (options.length < 4) {
    const others = ZI.filter((g) => g.id !== group.id).flatMap((g) => g.chars.map((c) => c.char));
    const extras = shuffle(others).filter((c) => !options.includes(c));
    while (options.length < 4 && extras.length) {
      options.push(extras.pop());
    }
  }
  return shuffle(options);
}

/* ---------- 混淆字比一比 ---------- */
function renderCompare() {
  const group = ZI[groupIndex % ZI.length];
  stage.innerHTML = `
    <div class="compare-wrap">
      <div class="compare-nav">
        <button class="nav-btn" id="prevGroup">← 上一組</button>
        <span class="flashcard-hint" style="align-self:center;color:var(--ink-soft);font-family:var(--font-mono);font-size:0.8rem;">${(groupIndex % ZI.length) + 1} / ${ZI.length}</span>
        <button class="nav-btn" id="nextGroup">下一組 →</button>
      </div>
      <div class="mnemonic-box"><strong>記憶技巧：</strong>${group.mnemonic}</div>
      <div class="char-grid">
        ${group.chars
          .map(
            (c) => `
          <div class="char-card">
            <div class="char-big">${c.char}</div>
            <div class="char-zhuyin">${c.zhuyin}</div>
            <div class="char-meaning">${c.meaning}</div>
            <div class="char-example">${c.example}</div>
            <div class="char-hint">${c.radicalHint}</div>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;
  document.getElementById("prevGroup").addEventListener("click", () => {
    groupIndex = (groupIndex - 1 + ZI.length) % ZI.length;
    renderCompare();
  });
  document.getElementById("nextGroup").addEventListener("click", () => {
    groupIndex = (groupIndex + 1) % ZI.length;
    renderCompare();
  });
}

/* ---------- 字音字形選擇題（別選題） ---------- */
function newChoiceQuestion() {
  const group = ZI[Math.floor(Math.random() * ZI.length)];
  const charObj = group.chars[Math.floor(Math.random() * group.chars.length)];
  currentTarget = { group, charObj };

  const blanked = charObj.example.includes(charObj.char)
    ? charObj.example.split(charObj.char).join("＿")
    : charObj.example;

  const options = buildOptions(group, charObj.char);
  renderChoiceQuiz(blanked, charObj.meaning, options);
}

function renderChoiceQuiz(blanked, meaning, options) {
  stage.innerHTML = `
    <div class="quiz-card">
      <p class="quiz-question">${blanked}</p>
      <p class="quiz-hint-box">語意提示：${meaning}</p>
      <div class="quiz-options" id="choiceOptions">
        ${options.map((opt) => `<button class="quiz-option" data-opt="${opt}">${opt}</button>`).join("")}
      </div>
      <p class="quiz-score">答對 ${quizScore.correct} / ${quizScore.total} 題</p>
    </div>
  `;
  document.querySelectorAll("#choiceOptions .quiz-option").forEach((btn) => {
    btn.addEventListener("click", () => handleChoiceAnswer(btn));
  });
}

function handleChoiceAnswer(btn) {
  const isCorrect = btn.dataset.opt === currentTarget.charObj.char;
  quizScore.total += 1;
  if (isCorrect) {
    quizScore.correct += 1;
    if (window.Progress && window.Progress.markZiLearned) {
      window.Progress.markZiLearned(currentTarget.group.id + "-" + currentTarget.charObj.char);
    }
  }
  const card = document.querySelector(".quiz-card");
  card.querySelectorAll(".quiz-option").forEach((b) => {
    b.disabled = true;
    if (b.dataset.opt === currentTarget.charObj.char) b.classList.add("correct");
    else if (b === btn) b.classList.add("wrong");
  });
  card.querySelector(".quiz-score").textContent = `答對 ${quizScore.correct} / ${quizScore.total} 題`;
  const nextBtn = document.createElement("button");
  nextBtn.className = "next-btn";
  nextBtn.textContent = "下一題 →";
  nextBtn.addEventListener("click", newChoiceQuestion);
  card.appendChild(nextBtn);
}

/* ---------- 部首猜字 ---------- */
function newRadicalQuestion() {
  const group = ZI[Math.floor(Math.random() * ZI.length)];
  const charObj = group.chars[Math.floor(Math.random() * group.chars.length)];
  currentTarget = { group, charObj };
  const options = buildOptions(group, charObj.char);
  renderRadicalQuiz(charObj, options);
}

function renderRadicalQuiz(charObj, options) {
  stage.innerHTML = `
    <div class="quiz-card">
      <p class="quiz-hint-box" style="font-size:1.05rem;margin-bottom:0.4rem;"><strong>部首線索：</strong>${charObj.radicalHint}</p>
      <p class="quiz-hint-box">語意提示：${charObj.meaning}（${charObj.zhuyin}）</p>
      <div class="quiz-options" id="radicalOptions">
        ${options.map((opt) => `<button class="quiz-option" data-opt="${opt}">${opt}</button>`).join("")}
      </div>
      <p class="quiz-score">答對 ${quizScore.correct} / ${quizScore.total} 題</p>
    </div>
  `;
  document.querySelectorAll("#radicalOptions .quiz-option").forEach((btn) => {
    btn.addEventListener("click", () => handleRadicalAnswer(btn));
  });
}

function handleRadicalAnswer(btn) {
  const isCorrect = btn.dataset.opt === currentTarget.charObj.char;
  quizScore.total += 1;
  if (isCorrect) {
    quizScore.correct += 1;
    if (window.Progress && window.Progress.markZiLearned) {
      window.Progress.markZiLearned(currentTarget.group.id + "-" + currentTarget.charObj.char);
    }
  }
  const card = document.querySelector(".quiz-card");
  card.querySelectorAll(".quiz-option").forEach((b) => {
    b.disabled = true;
    if (b.dataset.opt === currentTarget.charObj.char) b.classList.add("correct");
    else if (b === btn) b.classList.add("wrong");
  });
  card.querySelector(".quiz-score").textContent = `答對 ${quizScore.correct} / ${quizScore.total} 題`;
  const nextBtn = document.createElement("button");
  nextBtn.className = "next-btn";
  nextBtn.textContent = "下一題 →";
  nextBtn.addEventListener("click", newRadicalQuestion);
  card.appendChild(nextBtn);
}

/* ---------- 主渲染 ---------- */
function render() {
  if (mode === "compare") renderCompare();
  else if (mode === "choice") newChoiceQuestion();
  else if (mode === "radical") newRadicalQuestion();
}

async function init() {
  try {
    const resp = await fetch("zi-data.json");
    ZI = await resp.json();
    render();
  } catch {
    stage.innerHTML = `<div class="state-message">題庫載入失敗，請重新整理。</div>`;
  }
}

init();
