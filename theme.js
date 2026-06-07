(function () {
  const THEME_KEY = "moneyBudget.theme";
  const ACCENT_KEY = "moneyBudget.accent";
  const values = ["auto", "light", "dark"];
  const accents = [
    { id: "mono", label: "Mono", color: "#111111" },
    { id: "blue", label: "Blue", color: "#2563eb" },
    { id: "slate", label: "Slate", color: "#475569" },
    { id: "plum", label: "Plum", color: "#7c3aed" },
    { id: "teal", label: "Teal", color: "#0f766e" },
    { id: "coral", label: "Coral", color: "#e0573f" }
  ];
  const button = document.getElementById("themeToggle");
  const label = document.getElementById("themeToggleText");
  const metaTheme = document.querySelector("meta[name='theme-color']");
  const accentPicker = document.getElementById("accentPicker");

  function savedTheme() {
    const value = localStorage.getItem(THEME_KEY);
    return values.includes(value) ? value : "auto";
  }

  function savedAccent() {
    const value = localStorage.getItem(ACCENT_KEY);
    return accents.some(accent => accent.id === value) ? value : "mono";
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
    if (metaTheme) metaTheme.setAttribute("content", resolved === "dark" ? "#111111" : "#f7f7f5");
  }

  function applyAccent(value) {
    const accent = accents.find(item => item.id === value) || accents[0];
    document.body.dataset.accent = accent.id;
    accentPicker?.querySelectorAll("[data-accent]").forEach(button => {
      button.classList.toggle("is-selected", button.dataset.accent === accent.id);
    });
  }

  function nextTheme() {
    const current = savedTheme();
    return values[(values.indexOf(current) + 1) % values.length];
  }

  applyTheme(savedTheme());
  applyAccent(savedAccent());

  if (accentPicker) {
    accentPicker.innerHTML = accents.map(accent => `
      <button class="accent-option" type="button" data-accent="${accent.id}" aria-label="${accent.label}">
        <span style="background:${accent.color}"></span>
        ${accent.label}
      </button>
    `).join("");
    applyAccent(savedAccent());
  }

  button?.addEventListener("click", () => {
    const theme = nextTheme();
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
  });

  accentPicker?.addEventListener("click", event => {
    const option = event.target.closest("[data-accent]");
    if (!option) return;
    localStorage.setItem(ACCENT_KEY, option.dataset.accent);
    applyAccent(option.dataset.accent);
  });

  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (savedTheme() === "auto") applyTheme("auto");
  });
})();
