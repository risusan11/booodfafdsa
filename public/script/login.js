document.getElementById("loginBtn").onclick = async () => {
  const name = document.getElementById("username").value.trim();

  if (!name) {
    alert("名前を入力してください");
    return;
  }

  // localStorage に保存
  localStorage.setItem("username", name);

  // サーバーにも登録
  await fetch("/api/registerUser", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });

  // 掲示板へ
  location.href = "/";
};


// ===============================
// registerUser（login.js 用）
// ===============================
app.post("/api/registerUser", (req, res) => {
  const name = req.body.name;
  if (!name || !name.trim()) {
    return res.json({ ok:false, error:"名前が必要です" });
  }

  const users = loadJSON(usersFile, {});

  // 未登録なら作成
  if (!users[name]) {
    users[name] = {
      bio: "",
      icon: "/icons/default.png",
      banner: "/icons/default_banner.jpg",
      status: "online",
      xp: 0,
      posts: 0,
      likes: 0
    };
  }

  saveJSON(usersFile, users);
  res.json({ ok:true });
});

// すでにログイン済みなら自動でリダイレクト
if (localStorage.getItem("username")) {
  location.href = "/";
}
