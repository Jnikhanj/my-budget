(function () {
  const STORAGE_KEY = "moneyBudget.theme";
  const values = ["auto", "light", "dark"];
  const button = document.getElementById("themeToggle");
  const label = document.getElementById("themeToggleText");
  const metaTheme = document.querySelector("meta[name='theme-color']");

  function savedTheme() {
    const value = localStorage.getItem(STORAGE_KEY);
    return values.includes(value) ? value : "auto";
  }

  function systemTheme() {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(value) {
    const theme = values.includes(value) ? value : "auto";
    const resolved = theme === "auto" ? systemTheme() : theme;
    document.body.dataset.theme = resolved;
    if (button) button.setAttribute("aria-pressed", String(resolved === "dark"));
    if (label) label.textContent = theme === "auto" ? "Auto" : theme === "dark" ? "Dark" : "Light";
    if (metaTheme) metaTheme.setAttribute("content", resolved === "dark" ? "#07110c" : "#eef3ef");
  }

  function nextTheme() {
    const current = savedTheme();
    return values[(values.indexOf(current) + 1) % values.length];
  }

  applyTheme(savedTheme());

  button?.addEventListener("click", () => {
    const theme = nextTheme();
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme);
  });

  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (savedTheme() === "auto") applyTheme("auto");
  });
})();
