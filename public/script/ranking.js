// ===============================
//  ranking.js（那落迦級対応 完成版）
// ===============================

// レベル表示名マップ
function convertLevel(level) {
  const map = {
    "5": "5級",
    "4": "4級",
    "3": "3級",
    "Pre2": "準2級",
    "2": "2級",
    "Pre1": "準1級",
    "1": "1級",
    "Risu": "Risu",
    "Naraku": "那落迦級"
  };
  return map[level] || level;
}

async function loadRanking() {
  const res = await fetch("/api/scores");
  let scores = await res.json();

  const search = document.getElementById("search").value.toLowerCase();
  const level = document.getElementById("levelFilter").value;

  // =========================
  // 🔍 検索 & レベルフィルタ
  // =========================
  scores = scores.filter(s => {
    const matchName = s.name.toLowerCase().includes(search);
    const matchLevel = level === "all" || s.level === level;
    return matchName && matchLevel;
  });

  // スコア高い順にソート
  scores.sort((a, b) => b.score - a.score);

  const tbody = document.querySelector("#scoreTable tbody");
  tbody.innerHTML = "";

  scores.forEach(r => {
    const details = r.details || {
      vocabulary: "-",
      reading: "-",
      writing: "-"
    };

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${r.name}</td>
      <td>${convertLevel(r.level)}</td>
      <td><b>${r.score}</b></td>
      <td>
        単語:${details.vocabulary} /
        読解:${details.reading} /
        作文:${details.writing}
      </td>
      <td>${r.date}</td>
    `;

    tbody.appendChild(tr);
  });
}

// フィルタイベント
document.getElementById("search").oninput = loadRanking;
document.getElementById("levelFilter").onchange = loadRanking;

// 初期ロード
loadRanking();
