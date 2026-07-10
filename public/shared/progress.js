/*
 * 共用學習進度儲存邏輯
 * 目前用 localStorage 實作；之後若要換成雲端資料庫，
 * 只需要改這支檔案內部的實作，其他模塊呼叫的函式介面不用變。
 *
 * 各模塊使用方式（於各自的 script.js 內）：
 *   Progress.markVocabLearned("sanction");
 *   Progress.markNewsRead("article_id_123");
 *   Progress.markZiLearned("ji-yi-si-己");
 *   const data = Progress.getSummary();
 */

const STORAGE_KEY = "sunmoon_progress_v1";

function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

function saveRaw(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage 不可用時（例如無痕模式部分情境），靜默失敗，不影響網站主要功能
  }
}

function defaultState() {
  return {
    vocab_learned: [],   // 已學過的單字（字串陣列）
    news_read: [],         // 已讀新聞 id（字串陣列）
    zi_learned: [],         // 已答對的字音字形題（字串陣列）
    last_active: null,      // 最後活躍日期 "YYYY-MM-DD"
    streak_days: 0,          // 連續學習天數
  };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function bumpStreak(state) {
  const today = todayStr();
  if (state.last_active === today) return; // 今天已經記錄過
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  state.streak_days = state.last_active === yesterday ? state.streak_days + 1 : 1;
  state.last_active = today;
}

const Progress = {
  markVocabLearned(word) {
    const state = loadRaw();
    if (!state.vocab_learned.includes(word)) state.vocab_learned.push(word);
    bumpStreak(state);
    saveRaw(state);
  },

  markNewsRead(articleId) {
    const state = loadRaw();
    if (!state.news_read.includes(articleId)) state.news_read.push(articleId);
    bumpStreak(state);
    saveRaw(state);
  },

  markZiLearned(charKey) {
    const state = loadRaw();
    if (!state.zi_learned.includes(charKey)) state.zi_learned.push(charKey);
    bumpStreak(state);
    saveRaw(state);
  },

  getSummary() {
    const state = loadRaw();
    return {
      vocabCount: state.vocab_learned.length,
      newsCount: state.news_read.length,
      ziCount: state.zi_learned.length,
      streakDays: state.streak_days,
    };
  },

  reset() {
    saveRaw(defaultState());
  },
};

if (typeof window !== "undefined") {
  window.Progress = Progress;
}
