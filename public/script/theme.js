function setTheme(mode) {
  const link = document.getElementById("theme");

  const themeMap = {
    light: "/css/light.css",
    dark: "/css/dark.css",
    neon: "/css/neon.css",
    glass: "/css/glass.css"
  };

  link.href = themeMap[mode] || "/css/light.css";
  localStorage.setItem("theme", mode);
}

function toggleTheme() {
  const list = ["light", "dark", "neon", "glass"];
  let now = localStorage.getItem("theme") || "light";
  let next = list[(list.indexOf(now) + 1) % list.length];
  setTheme(next);
}

window.addEventListener("load", () => {
  const saved = localStorage.getItem("theme") || "light";
  setTheme(saved);
});
