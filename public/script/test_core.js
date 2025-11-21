// ======================================================
// test_core.js（5級〜1級 全対応・AI採点 + 模範解答 + 翻訳UI）
// ======================================================

// ============================
// safeValue（入力取得）
// ============================
function safeValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

// ============================
// ユーザー名取得
// ============================
function getUser() {
  return localStorage.getItem("userName") || "unknown";
}

// ============================
// 語数カウント
// ============================
function countWords(text) {
  return text.trim().split(/\s+/).filter(x => x).length;
}

// ============================
// 翻訳（EN⇔JP）
// ============================
function toggleTranslation(sectionId) {
  const en = document.getElementById(sectionId + "_en");
  const ja = document.getElementById(sectionId + "_ja");

  if (!en || !ja) return;

  if (en.style.display === "none") {
    en.style.display = "block";
    ja.style.display = "none";
  } else {
    en.style.display = "none";
    ja.style.display = "block";
  }
}

// ============================
// AI 書き評価（全級対応）
// ============================
async function gradeWritingAI(text, level) {
  try {
    const res = await fetch("/api/gradeWriting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, level })
    });

    return await res.json();
  } catch (err) {
    console.error("AI scoring failed:", err);
    return {
      content: 0,
      organization: 0,
      vocabulary: 0,
      grammar: 0,
      total: 0,
      comment_en: "AI scoring failed.",
      comment_ja: "AI採点に失敗しました。",
      modelAnswer: "N/A"
    };
  }
}

// ============================
// スコア結果UI（共通）
// ============================
function renderWritingResult(level, readingScore, readingTotal, ai) {

  const words = countWords(safeValue("writing"));

  document.getElementById("result").innerHTML = `

<div style="font-size:20px; font-weight:bold;">
【${level}】総合スコア：${readingScore + ai.total}
</div>

<div style="margin-top:12px;">
・読解/文法：${readingScore} / ${readingTotal}<br>
・作文：${ai.total} / 16<br>
・語数：${words} words
</div>

<hr>

<h3>✦ AI コメント</h3>

<button onclick="toggleTranslation('comment')" 
 style="padding:6px 12px; margin-bottom:8px;">
EN / JP 切り替え
</button>

<div id="comment_en">${ai.comment_en}</div>
<div id="comment_ja" style="display:none;">${ai.comment_ja}</div>

<hr>

<h3>✦ 模範解答（Model Answer）</h3>

<button onclick="
  const x = document.getElementById('modelAnswerBox');
  x.style.display = (x.style.display==='none'?'block':'none');
" style="padding:6px 12px;">
表示 / 非表示
</button>

<div id="modelAnswerBox" style="display:none; margin-top:10px;">
  ${ai.modelAnswer || "N/A"}
</div>

`;
}

// ======================================================
// ★ 各級の採点ロジック
// ======================================================

// ============================
// 5級
// ============================
async function gradeTest5() {
const answers = {
  // Part 1 – Vocabulary
  q1: "play",
  q2: "book",
  q3: "lives",
  q4: "are",
  q5: "listens",

  // Part 2 – Grammar
  q6: "to be",
  q7: "bigger",
  q8: "many",
  q9: "speaks",
  q10: "eat",

  // Part 3 – Conversation
  q11: "When",
  q12: "at",
  q13: "saw",
  q14: "my",
  q15: "play",

  // Part 4 – Reading
  q16: "In Osaka",
  q17: "two",
  q18: "every morning",
  q19: "dogs",
  q20: "Anna"
};


  let score = 0;
  const total = 25;

  for (let i = 1; i <= total; i++) {
    if (safeValue("q" + i) === answers["q" + i]) score++;
  }

  await fetch("/api/saveScore", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      user: getUser(),
      level: "5",
      score,
      details: { correct: score, total }
    })
  });

  document.getElementById("result").innerHTML =
    `【5級】総合スコア：${score} / ${total}`;
}

// ============================
// 4級
// ============================
async function gradeTest4() {
  const answers = {
  // Part 1
  q1: "eats",
  q2: "reading",
  q3: "more interesting",
  q4: "went",
  q5: "play",
  q6: "kind",
  q7: "finishes",
  q8: "books",
  q9: "have",
  q10: "goes",

  // Part 2
  q11: "What time",
  q12: "at",
  q13: "plays",
  q14: "two",
  q15: "is",
  q16: "Let's",
  q17: "is watching",
  q18: "to go",
  q19: "since",
  q20: "next to",

  // Part 3
  q21: "the guitar",
  q22: "two hours",
  q23: "join a band",

  q24: "cooking",
  q25: "every Sunday",
  q26: "a chef"
};


  let score = 0;
  for (let i = 1; i <= 30; i++) {
    if (safeValue("q" + i) === answers["q" + i]) score++;
  }

  await fetch("/api/saveScore", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      user: getUser(),
      level: "4",
      score,
      details: { correct: score, total: 30 }
    })
  });

  document.getElementById("result").innerHTML =
    `【4級】総合スコア：${score} / 30`;
}

// ============================
// 3級（AI）
// ============================
async function gradeTest3() {
  const answers = {
    q1:"goes", q2:"some", q3:"more interesting", q4:"watched", q5:"cooking",
    q6:"I'd like some water", q7:"a lot of", q8:"to eat", q9:"was late",
    q10:"has studied",

    q11:"English", q12:"By train", q13:"Sure", q14:"To the zoo", q15:"See you",

    q16:"three times a week", q17:"at the gym", q18:"join the school team",
    q19:"makes breakfast", q20:"new dishes", q21:"by watching videos",
    q22:"on weekends", q23:"talking to customers", q24:"work full-time"
  };

  let score = 0;
  for (let i = 1; i <= 24; i++) {
    if (safeValue("q" + i) === answers["q" + i]) score++;
  }

  const essay = safeValue("writing");
  const ai = await gradeWritingAI(essay, "3");

  await fetch("/api/saveScore", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      user: getUser(),
      level: "3",
      score: score + ai.total,
      details: { readingListening: score, writing: ai.total }
    })
  });

  renderWritingResult("3級", score, 24, ai);
}

// ============================
// 準2級（AI）
// ============================
async function gradePre2() {
  const answers = {
    q1:"release", q2:"interest", q3:"charge", q4:"encouraged", q5:"effective",
    q6:"a holiday", q7:"improve", q8:"allowed", q9:"managed", q10:"reading",
    q11:"rains", q12:"to help", q13:"more", q14:"been", q15:"takes",
    q16:"when", q17:"where", q18:"among", q19:"to use", q20:"must not",
    q21:"Yes, that would be great", q22:"In front of the station",
    q23:"It was amazing", q24:"Yes, I listen to her songs", q25:"See you",
    q26:"two years ago", q27:"by watching online lessons",
    q28:"He played at an event", q29:"cleans cages and feeds animals",
    q30:"adopt animals", q31:"on weekends",
    q32:"visiting museums", q33:"history and technology", q34:"five"
  };

  let score = 0;
  for (let i = 1; i <= 34; i++) {
    if (safeValue("q" + i) === answers["q" + i]) score++;
  }

  const essay = safeValue("writing");
  const ai = await gradeWritingAI(essay, "Pre2");

  await fetch("/api/saveScore", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      user: getUser(),
      level: "Pre2",
      score: score + ai.total,
      details: { readingListening: score, writing: ai.total }
    })
  });

  renderWritingResult("準2級", score, 34, ai);
}

// ============================
// 2級（AI）
// ============================
async function gradeTest2() {
  const answers = {
    q1:"identify", q2:"introduce", q3:"positive", q4:"spectacular", q5:"increased",
    q6:"improve", q7:"encourages", q8:"delayed", q9:"consider", q10:"find",
    q11:"rains", q12:"watching", q13:"take effect", q14:"reading", q15:"gets",
    q16:"impressive", q17:"how", q18:"for", q19:"ate", q20:"because of",
    q21:"Not at all", q22:"Sure, no problem", q23:"Three times a week",
    q24:"She’s in the library", q25:"You're welcome",
    q26:"when she was ten", q27:"teaches coding",
    q28:"to reduce traffic", q29:"bike lanes",
    q30:"a doctor", q31:"biology", q32:"to understand patients better"
  };

  let score = 0;
  for (let i = 1; i <= 32; i++) {
    if (safeValue("q" + i) === answers["q" + i]) score++;
  }

  const essay = safeValue("writing");
  const ai = await gradeWritingAI(essay, "2");

  await fetch("/api/saveScore", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      user: getUser(),
      level: "2",
      score: score + ai.total,
      details: { readingListening: score, writing: ai.total }
    })
  });

  renderWritingResult("2級", score, 32, ai);
}

// ============================
// 準1級（AI）
// ============================
async function gradePre1() {
  const answers = {
    q1:"groundbreaking", q2:"sway", q3:"violations", q4:"jeopardize", q5:"insulate",
    q6:"eliminate", q7:"credibility", q8:"utilize", q9:"vulnerable", q10:"implement",
    q11:"notable", q12:"revise", q13:"disrupt", q14:"misleading", q15:"endangered",
    q16:"evaluate", q17:"resolve", q18:"cause", q19:"shortage", q20:"concerned",
    q21:"promote", q22:"foster", q23:"transformed", q24:"significant", q25:"expanded",
    q26:"weaken", q27:"interaction", q28:"maintain",
    q29:"It absorbs water from the air",
    q30:"in deserts", q31:"to cool the environment",
    q32:"lower energy use",
    q33:"they make risky decisions",
    q34:"to solve complex problems"
  };

  let score = 0;
  for (let i = 1; i <= 34; i++) {
    if (safeValue("q" + i) === answers["q" + i]) score++;
  }

  const essay = safeValue("writing");
  const ai = await gradeWritingAI(essay, "Pre1");

  await fetch("/api/saveScore", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      user: getUser(),
      level: "Pre1",
      score: score + ai.total,
      details: { readingListening: score, writing: ai.total }
    })
  });

  renderWritingResult("準1級", score, 34, ai);
}
// ============================
// 1級（AI）
// ============================
async function gradeTest1() {

  const answers = {
    q1:"inexorable", q2:"juxtapose", q3:"convoluted", q4:"exacerbate", q5:"conundrum",
    q6:"specious", q7:"paradigmatic", q8:"scathing", q9:"withstand", q10:"prescient",
    q11:"deplorable", q12:"enigmatic", q13:"decimate", q14:"fluid", q15:"unanimous",
    q16:"tact", q17:"opaque", q18:"combat", q19:"lyrical", q20:"untenable",
    q21:"quell", q22:"meticulous", q23:"profound", q24:"imprudent", q25:"intertwined",
    q26:"erode", q27:"cultivate", q28:"reconcile",
    q29:"early societies were egalitarian",
    q30:"that early societies were hierarchical",
    q31:"machines making moral decisions",
    q32:"it complicates regulation",
    q33:"large-scale weather shifts",
    q34:"interactions are unpredictable"
  };

  // --- 読解/文法 ---
  let score = 0;
  for (let i = 1; i <= 34; i++) {
    if (safeValue("q" + i) === answers["q" + i]) score++;
  }

  // --- 英作文 ---
  const essay = safeValue("writing");

  const ai = await gradeWritingAI(essay, "1");

  // --- DB保存 ---
  await fetch("/api/saveScore", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      user: getUser(),
      level: "1",
      score: score + ai.total,
      details: { readingListening: score, writing: ai.total }
    })
  });

  // --- 結果UI（共通） ---
  renderWritingResult("1級", score, 34, ai);
}
// ============================
// 那落迦級（Naraku）
// ============================
async function gradeTestNaraku() {

  // --- 語彙30問 ＋ Cloze3問 ＋ Reading6問 = 合計39問 ---
  const answers = {
    // Vocabulary 1〜30
    q1:"intricate", q2:"pervasive", q3:"impoverished", q4:"obfuscatory",
    q5:"emergent", q6:"contingent", q7:"intractable", q8:"bankrupt",
    q9:"tenuous", q10:"trenchant", q11:"precipitous", q12:"illusory",
    q13:"spontaneous", q14:"speculative", q15:"salient", q16:"untenable",
    q17:"paradigmatic", q18:"opaque", q19:"stochastic", q20:"radical",
    q21:"erode", q22:"exceptional", q23:"enigmatic", q24:"profound",
    q25:"volatile", q26vocab:"fallacious", q27vocab:"serendipitous",
    q28vocab:"prescient", q29vocab:"tenuous", q30vocab:"superficial",

    // Cloze 31〜33（q26, q27, q28 の IDと被るため Clozeは別ID）
    q26:"induce",
    q27:"foster",
    q28:"reconcile",

    // Reading 34〜39
    q29:"ancient political flexibility",
    q30:"the inevitability of hierarchy",
    q31:"AI moral agency",
    q32:"it may involve networks of actors",
    q33:"nonlinear interactions",
    q34:"uneven data collection"
  };

  // --- 読解 / 文法スコア計算 ---
  let readingScore = 0;
  const totalReading = 39;

  const allIds = Object.keys(answers);
  allIds.forEach(id => {
    if (safeValue(id) === answers[id]) readingScore++;
  });

  // --- 英作文 ---
  const essay = safeValue("writing");
  const ai = await gradeWritingAI(essay, "Naraku");

  const totalScore = readingScore + ai.total;

  // --- DB保存 ---
  await fetch("/api/saveScore", {
    method:"POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({
      user: getUser(),
      level: "Naraku",
      score: totalScore,
      details: {
        readingListening: readingScore,
        writing: ai.total
      }
    })
  });

  // --- 表示 ---
  renderWritingResult("那落迦級", readingScore, totalReading, ai);
}