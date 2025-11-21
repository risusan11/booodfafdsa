// =====================================================
// server.js（完全版・AI採点 + 掲示板 + サーバー機能
//            + 画像投稿 + メンション通知 + WebSocket
//            + フレンド）
// =====================================================

require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const crypto = require("crypto");
const multer = require("multer");

const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "30mb" }));
app.use(express.static("public"));

// =====================================================
// JSONユーティリティ
// =====================================================
function loadJSON(file, def) {
  try {
    if (!fs.existsSync(file)) return def;
    const txt = fs.readFileSync(file, "utf8").trim();
    if (!txt) return def;
    return JSON.parse(txt);
  } catch { return def; }
}
function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}


// =====================================================
// JSONファイル
// =====================================================
const usersFile = "./users.json";
const postsFile = "./posts.json";
const scoreFile = "./score.json";
const serversFile = "./servers.json";
const notifFile = "./notifications.json";
const friendsFile = "./friends.json";

[
  [usersFile, []],
  [postsFile, []],
  [scoreFile, []],
  [serversFile, [{ id: "general", name: "メインサーバー" }]],
  [notifFile, {}],
  [friendsFile, {}]
].forEach(([f, d]) => {
  if (!fs.existsSync(f)) saveJSON(f, d);
});


// =====================================================
// 画像アップロード
// =====================================================
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, "public/uploads"),
    filename: (req, file, cb) => {
      cb(null, crypto.randomUUID() + path.extname(file.originalname));
    }
  })
});


app.post("/api/upload", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false });
  res.json({ ok: true, url: "/uploads/" + req.file.filename });
});


// =====================================================
// ユーザーアイコン設定
// =====================================================
app.post("/api/user/icon", upload.single("icon"), (req, res) => {
  const user = req.body.user;
  if (!user || !req.file) {
    return res.json({ ok: false, error: "ユーザー名またはファイルがありません" });
  }

  const users = loadJSON(usersFile, {});
  if (!users[user]) users[user] = {};

  users[user].icon = "/uploads/" + req.file.filename;
  saveJSON(usersFile, users);

  res.json({ ok: true, url: users[user].icon });
});


// =====================================================
// WebSocket
// =====================================================
io.on("connection", socket => {
  console.log("🔌 WebSocket 接続:", socket.id);

  socket.on("joinRoom", room => {
    if (room) socket.join(room);
  });

  socket.on("joinUser", username => {
    if (username) socket.join(username);
  });
});


// =====================================================
// 通知
// =====================================================
function notify(user, msg) {
  const nt = loadJSON(notifFile, {});
  if (!nt[user]) nt[user] = [];

  const data = {
    id: crypto.randomUUID(),
    msg,
    time: new Date().toLocaleString()
  };

  nt[user].push(data);
  saveJSON(notifFile, nt);

  // WebSocket → リアルタイム通知
  io.to(user).emit("notification", data);
}

app.get("/api/notifications/:user", (req, res) => {
  const nt = loadJSON(notifFile, {});
  res.json(nt[req.params.user] || []);
});


// =====================================================
// 掲示板サーバー一覧
// =====================================================
app.get("/api/servers", (_, res) => {
  res.json(loadJSON(serversFile, []));
});

app.post("/api/servers", (req, res) => {
  const name = req.body.name.trim();
  const id = name.replace(/\s+/g, "_");

  let list = loadJSON(serversFile, []);

  if (list.find(s => s.id === id)) {
    return res.status(400).json({ ok: false });
  }

  list.push({ id, name });
  saveJSON(serversFile, list);

  saveJSON(`posts_${id}.json`, []);

  res.json({ ok: true });
});


// =====================================================
// 投稿読み込み
// =====================================================
app.get("/api/posts/:serverId", (req, res) => {
  const file = `posts_${req.params.serverId}.json`;
  if (!fs.existsSync(file)) saveJSON(file, []);
  res.json(loadJSON(file, []));
});


// =====================================================
// 投稿追加（画像・通知・メンション・WebSocket）
// =====================================================
app.post("/api/posts/:serverId", (req, res) => {
  const file = `posts_${req.params.serverId}.json`;
  if (!fs.existsSync(file)) saveJSON(file, []);

  const posts = loadJSON(file, []);

  const post = {
    id: crypto.randomUUID(),
    name: req.body.name,
    text: req.body.text,
    image: req.body.image || null,
    date: new Date().toLocaleString(),
    likes: 0,
    replies: []
  };

  posts.push(post);
  saveJSON(file, posts);

  // メンション通知
  const mentionList = (post.text.match(/@([\wぁ-んァ-ン一-龥]+)/g) || [])
    .map(t => t.slice(1));

  mentionList.forEach(u =>
    notify(u, `${post.name} があなたをメンションしました: 「${post.text}」`)
  );

  io.to(req.params.serverId).emit("newPost", post);

  res.json({ ok: true });
});


// =====================================================
// フレンド API
// =====================================================

// friends.json を使う
const friendDB = friendsFile;

// 取得
app.get("/api/friends/:user", (req, res) => {
  const db = loadJSON(friendDB, {});
  const user = req.params.user;

  res.json({
    friends: db[user]?.friends || [],
    requests: db[user]?.requests || [],
    online: db.onlineUsers || []
  });
});

// 申請
app.post("/api/friends/add", (req, res) => {
  const { from, to } = req.body;
  const db = loadJSON(friendDB, {});

  if (!db[to]) db[to] = { friends: [], requests: [] };
  if (!db[from]) db[from] = { friends: [], requests: [] };

  // 既にフレンド
  if (db[to].friends.includes(from)){
    return res.json({ ok:false, error:"すでにフレンドです。" });
  }

  // 既に申請済み
  if (db[to].requests.includes(from)){
    return res.json({ ok:false, error:"すでに申請済みです。" });
  }

  db[to].requests.push(from);
  saveJSON(friendDB, db);

  // 通知
  notifyUser(to, "friend", { from });

  res.json({ ok: true });
});

// 承認
app.post("/api/friends/accept", (req, res) => {
  const { from, to } = req.body;
  const db = loadJSON(friendDB, {});

  if (!db[to]) db[to] = { friends: [], requests: [] };
  if (!db[from]) db[from] = { friends: [], requests: [] };

  db[to].requests = db[to].requests.filter(x => x !== from);

  db[to].friends.push(from);
  db[from].friends.push(to);

  saveJSON(friendDB, db);
  res.json({ ok: true });
});

// 拒否
app.post("/api/friends/deny", (req, res) => {
  const { from, to } = req.body;
  const db = loadJSON(friendDB, {});

  db[to].requests = db[to].requests.filter(x => x !== from);
  saveJSON(friendDB, db);

  res.json({ ok: true });
});

// 削除
app.post("/api/friends/remove", (req, res) => {
  const { user, target } = req.body;
  const db = loadJSON(friendDB, {});

  if (!db[user]) db[user] = { friends: [], requests: [] };
  if (!db[target]) db[target] = { friends: [], requests: [] };

  db[user].friends  = db[user].friends.filter(x => x !== target);
  db[target].friends = db[target].friends.filter(x => x !== user);

  saveJSON(friendDB, db);
  res.json({ ok: true });
});


// =====================================================
// ユーザー宛の通知（メンションとは別）
// =====================================================
function notifyUser(user, type, payload = {}){
  const nt = loadJSON(notifFile, {});

  if (!nt[user]) nt[user] = [];

  const data = {
    id: crypto.randomUUID(),
    type,
    from: payload.from || null,
    text: payload.text || "",
    time: new Date().toLocaleString()
  };

  nt[user].push(data);
  saveJSON(notifFile, nt);

  // WebSocket リアルタイム通知
  io.to(user).emit("notification", data);
}


// =====================================================
// ユーザーアイコン取得
// =====================================================
app.get("/api/user/icons", (req, res) => {
  const users = loadJSON(usersFile, {});
  const icons = {};

  for (let u in users) {
    icons[u] = users[u].icon || "/icons/default.png";
  }

  res.json(icons);
});

// =====================================================
// プロフィール取得
// =====================================================
app.get("/api/user/profile", (req, res) => {
  const user = req.query.user;
  const users = loadJSON(usersFile, {});

  if (!users[user]) {
    return res.json({
      bio: "",
      icon: "/icons/default.png"
    });
  }

  res.json({
    bio: users[user].bio || "",
    icon: users[user].icon || "/icons/default.png"
  });
});

// =====================================================
// プロフィール更新
// =====================================================
app.post("/api/user/profile/update", upload.single("icon"), (req, res) => {
  const user = req.body.user;
  const bio  = req.body.bio;

  if(!user) return res.json({ ok:false });

  const users = loadJSON(usersFile, {});
  if (!users[user]) users[user] = {};

  users[user].bio = bio;

  if (req.file){
    users[user].icon = "/uploads/" + req.file.filename;
  }

  saveJSON(usersFile, users);

  res.json({ ok:true });
});

function calcLevel(xp){
  return Math.floor(1 + Math.sqrt(xp / 15));
}

app.get("/api/user/profile", (req, res) => {
  const user = req.query.user;
  const users = loadJSON(usersFile, {});

  if (!users[user]) {
    users[user] = {
      bio: "",
      icon: "/icons/default.png",
      banner: "/icons/default_banner.jpg",
      status: "offline",
      xp: 0,
      posts: 0,
      likes: 0
    };
    saveJSON(usersFile, users);
  }

  const u = users[user];
  u.level = calcLevel(u.xp);

  res.json(u);
});

app.post("/api/user/profile/update", upload.single("icon"), (req, res) => {
  const user = req.body.user;
  const bio  = req.body.bio;
  const status = req.body.status || "online";

  const users = loadJSON(usersFile, {});
  if(!users[user]) users[user] = {};

  users[user].bio = bio;
  users[user].status = status;

  if (req.file){
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext === ".jpg" || ext === ".png" || ext === ".jpeg"){
      users[user].icon = "/uploads/" + req.file.filename;
    }
  }

  saveJSON(usersFile, users);
  res.json({ ok:true });
});

app.post("/api/user/banner/update", upload.single("banner"), (req, res) => {
  const user = req.body.user;
  const users = loadJSON(usersFile, {});

  if (!req.file) return res.json({ ok:false });

  if(!users[user]) users[user] = {};

  users[user].banner = "/uploads/" + req.file.filename;

  saveJSON(usersFile, users);
  res.json({ ok:true });
});

app.post("/api/posts/:serverId", (req, res) => {
  const file = `posts_${req.params.serverId}.json`;
  if (!fs.existsSync(file)) saveJSON(file, []);

  const posts = loadJSON(file, []);
  const user = req.body.name;

  const users = loadJSON(usersFile, {});
  if (!users[user]) users[user] = {};

  // 投稿数 + XP
  users[user].posts = (users[user].posts || 0) + 1;
  users[user].xp = (users[user].xp || 0) + 5;

  saveJSON(usersFile, users);

  const post = {
    id: crypto.randomUUID(),
    name: req.body.name,
    text: req.body.text,
    image: req.body.image || null,
    date: new Date().toLocaleString(),
    likes: 0,
    likedUsers: [],   // ← 追加
    replies: []
  };

  posts.push(post);
  saveJSON(file, posts);

  io.to(req.params.serverId).emit("newPost", post);
  res.json({ ok: true });
});

app.post("/api/posts/like/:serverId", (req, res) => {
  const file = `posts_${req.params.serverId}.json`;
  let posts = loadJSON(file, []);
  const { id, diff, user } = req.body;

  const p = posts.find(x => x.id === id);
  if (!p) return res.status(404).json({ ok: false });

  if (!p.likedUsers) p.likedUsers = [];

  const users = loadJSON(usersFile, {});

  if (diff === 1){
    if (!p.likedUsers.includes(user)){
      p.likedUsers.push(user);
      p.likes++;

      // 投稿者に XP +1, likes +1
      if (!users[p.name]) users[p.name] = {};
      users[p.name].xp = (users[p.name].xp || 0) + 1;
      users[p.name].likes = (users[p.name].likes || 0) + 1;

      saveJSON(usersFile, users);
    }
  } else {
    p.likes--;
    p.likedUsers = p.likedUsers.filter(x => x !== user);
  }

  saveJSON(file, posts);

  io.to(req.params.serverId).emit("likeUpdate", { id, likes: p.likes });

  res.json({ ok: true });
});
 
app.post("/api/posts/reply/:serverId", (req, res) => {
  const file = `posts_${req.params.serverId}.json`;
  const posts = loadJSON(file, []);

  const p = posts.find(x => x.id === req.body.postId);
  if (!p) return res.json({ ok: false });

  const rep = {
    id: crypto.randomUUID(),
    name: req.body.name,
    text: req.body.text,
    date: new Date().toLocaleString()
  };

  p.replies.push(rep);
  saveJSON(file, posts);

  const users = loadJSON(usersFile, {});
  if (!users[req.body.name]) users[req.body.name] = {};

  users[req.body.name].xp = (users[req.body.name].xp || 0) + 2;
  saveJSON(usersFile, users);

  io.to(req.params.serverId).emit("newReply", {
    postId: req.body.postId,
    reply: rep
  });

  res.json({ ok: true });
});

app.get("/api/user/icons", (req, res) => {
  const users = loadJSON(usersFile, {});
  const out = {};

  for (const u in users){
    out[u] = users[u].icon || "/icons/default.png";
  }

  res.json(out);
});

app.get("/u/:user", (req, res) => {
  res.sendFile(path.join(__dirname, "public/userpage.html"));
});


// =====================================================
// いいね（トグル）
// =====================================================
app.post("/api/posts/like/:serverId", (req, res) => {
  const file = `posts_${req.params.serverId}.json`;
  let posts = loadJSON(file, []);
  const { id, diff } = req.body;

  const p = posts.find(x => x.id === id);
  if (!p) return res.status(404).json({ ok: false });

  p.likes = (p.likes || 0) + diff;
  if (p.likes < 0) p.likes = 0;

  saveJSON(file, posts);

  io.to(req.params.serverId).emit("likeUpdate", { id, likes: p.likes });

  res.json({ ok: true });
});


// =====================================================
// 返信
// =====================================================
app.post("/api/posts/reply/:serverId", (req, res) => {
  const file = `posts_${req.params.serverId}.json`;
  const posts = loadJSON(file, []);

  const p = posts.find(x => x.id === req.body.postId);
  if (!p) return res.json({ ok: false });

  const rep = {
    id: crypto.randomUUID(),
    name: req.body.name,
    text: req.body.text,
    date: new Date().toLocaleString()
  };

  p.replies.push(rep);
  saveJSON(file, posts);

  io.to(req.params.serverId).emit("newReply", {
    postId: req.body.postId,
    reply: rep
  });

  res.json({ ok: true });
});


// =====================================================
// 投稿削除
// =====================================================
app.post("/api/posts/delete/:serverId", (req, res) => {
  const file = `posts_${req.params.serverId}.json`;
  let posts = loadJSON(file, []);

  const { id, replyId } = req.body;

  if (replyId) {
    const p = posts.find(x => x.id === id);
    if (!p) return res.json({ ok: false });

    p.replies = p.replies.filter(r => r.id !== replyId);
    saveJSON(file, posts);

    io.to(req.params.serverId).emit("deleteReply", { id, replyId });
    return res.json({ ok: true });
  }

  posts = posts.filter(x => x.id !== id);
  saveJSON(file, posts);

  io.to(req.params.serverId).emit("deletePost", { id });
  res.json({ ok: true });
});

// =====================================================
app.post("/api/gradeWriting", async (req, res) => {
  const { text, level } = req.body;

  if (!text || !text.trim()) {
    return res.json({
      content: 0, organization: 0, vocabulary: 0, grammar: 0, total: 0,
      comment_en: "No essay submitted.",
      comment_ja: "エッセイが入力されていません。",
      modelAnswer: "N/A"
    });
  }

  const lvl = { "5":20,"4":25,"3":30,"Pre2":40,"2":50,"Pre1":60,"1":70 };
  const targetWords = lvl[level] || 30;

  const prompt = `
You are an official EIKEN writing examiner.
Return JSON ONLY.

modelAnswer must be about ${targetWords} words.

{
  "content": number,
  "organization": number,
  "vocabulary": number,
  "grammar": number,
  "comment_en": "string",
  "comment_ja": "string",
  "modelAnswer": "string"
}

Essay:
${text}
`.trim();

  try {

    const apiURL =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const response = await fetch(apiURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      })
    });

    const data = await response.json();

    // -----------------------------
    // ★★★ JSON 抽出（最重要）★★★
    // -----------------------------
    // -----------------------------
// ★★★ JSON 抽出（完全版）★★★
// -----------------------------
let json = null;
    // ★★★ 正しい位置 → data が存在する ★★★
console.log("===== ERROR JSON STRINGIFY =====");
try {
  console.log(JSON.stringify(data, null, 2));
} catch(e) {
  console.log("stringify failed:", e);
}
console.log("================================");

try {
  const part = data.candidates?.[0]?.content?.parts?.[0];

  // ① functionCall
  if (part?.functionCall?.args) {
    json = part.functionCall.args;
  }

  // ② structuredOutput
  else if (part?.structuredOutput) {
    json = part.structuredOutput;
  }

  // ③ text に JSON が入っているパターン
  else if (part?.text) {
    const raw = part.text.trim();

    // JSON が余計なテキストに囲まれてる可能性あり
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) json = JSON.parse(match[0]);
  }

} catch (e) {
  console.error("JSON parse error:", e);
  json = null;
}


    if (!json) {
      return res.json({
        content: 0, organization: 0, vocabulary: 0, grammar: 0, total: 0,
        comment_en: "AI output incomplete.",
        comment_ja: "AIの出力が不完全でした。",
        modelAnswer: "N/A"
      });
    }

    const total =
      (json.content ?? 0) +
      (json.organization ?? 0) +
      (json.vocabulary ?? 0) +
      (json.grammar ?? 0);

    res.json({ ...json, total });

  } catch (e) {
    console.error("AI error:", e);
    res.json({
      content: 0, organization: 0, vocabulary: 0, grammar: 0, total: 0,
      comment_en: "AI scoring failed.",
      comment_ja: "AI採点に失敗しました。",
      modelAnswer: "N/A"
    });
  }
});

// =====================================================
// 英検テスト結果保存 API（saveScore）
// =====================================================
app.post("/api/saveScore", (req, res) => {
  const { user, level, score, words, details } = req.body;

  if (!user) {
    return res.status(400).json({ ok: false, error: "no user" });
  }

  const db = loadJSON(scoreFile, {});

  if (!db[user]) db[user] = {};
  db[user][level] = {
    score: Number(score) || 0,
    words: Number(words) || 0,
    details: details || {},
    time: new Date().toLocaleString()
  };

  saveJSON(scoreFile, db);

  res.json({ ok: true });
});



// =====================================================
// ★ Routing（最後に置く）
// =====================================================
app.get("/", (_, res) => res.sendFile(path.join(__dirname, "public/index.html")));
app.get("/tests", (_, res) => res.sendFile(path.join(__dirname, "public/tests.html")));
app.get("/ranking", (_, res) => res.sendFile(path.join(__dirname, "public/ranking.html")));
app.get("/servers.html", (_, res) => res.sendFile(path.join(__dirname, "public/servers.html")));
app.get("/board.html", (_, res) => res.sendFile(path.join(__dirname, "public/board.html")));

["5","4","3","pre2","2","pre1","1","naraku"].forEach(level => {
  app.get(`/test_${level}`, (_, res) =>
    res.sendFile(path.join(__dirname, `public/tests/test_${level}.html`))
  );
});

// =====================================================
// Start
// =====================================================
server.listen(PORT, () =>
  console.log("🚀 完全版サーバー稼働中 → http://localhost:" + PORT)
);
