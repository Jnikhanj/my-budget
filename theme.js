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

(function () {
  if (typeof document === "undefined") return;
  if (typeof state === "undefined" || typeof saveState !== "function" || typeof renderAll !== "function") return;

  const pasteInput = document.getElementById("pasteInput");
  if (pasteInput) pasteInput.removeAttribute("placeholder");

  const style = document.createElement("style");
  style.textContent = `
    .editable-transaction-row { cursor: pointer; }
    .tx-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 80;
      background: rgba(17, 18, 23, 0.32);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      display: grid;
      align-items: end;
      padding: 14px;
    }
    .tx-modal-backdrop[hidden] { display: none; }
    .tx-modal {
      width: min(100%, 430px);
      margin: 0 auto calc(env(safe-area-inset-bottom) + 4px);
      background: var(--card);
      color: var(--text);
      border-radius: 28px;
      border: 1px solid rgba(255,255,255,0.7);
      padding: 18px;
      box-shadow: 0 24px 70px rgba(17, 18, 23, 0.28);
    }
    .tx-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 10px;
    }
    .tx-modal-title {
      font-size: 22px;
      font-weight: 820;
      letter-spacing: -0.04em;
    }
    .tx-close-button {
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.72);
      color: var(--text);
      width: 38px;
      height: 38px;
      border-radius: 50%;
      font-size: 23px;
      line-height: 1;
    }
    .tx-grid-two { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
    .tx-button-row { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-top: 16px; }
    .tx-delete-button {
      min-height: 50px;
      border-radius: 23px;
      border: 1px solid rgba(220, 82, 71, 0.20);
      color: var(--danger);
      background: rgba(220, 82, 71, 0.08);
      font-weight: 790;
    }
    .tx-save-button {
      min-height: 50px;
      border-radius: 23px;
      border: 0;
      color: white;
      background: #111217;
      font-weight: 790;
    }
    body.tx-modal-open { overflow: hidden; }
  `;
  document.head.appendChild(style);

  let editingId = null;

  function safe(value) {
    if (typeof escapeHtml === "function") return escapeHtml(value);
    return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
  }

  function parseEditAmount(value) {
    const cleaned = String(value || "").replace(/,/g, ".").replace(/[^\d.]/g, "");
    const firstDot = cleaned.indexOf(".");
    const normalised = firstDot === -1 ? cleaned : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
    const amount = Number(normalised || 0);
    return Number.isFinite(amount) ? amount : 0;
  }

  function expenseCategory(expense) {
    try {
      return categoryById(expense.categoryId)?.name || expense.categoryName || "Other";
    } catch {
      return expense.categoryName || "Other";
    }
  }

  function formattedDate(date) {
    try {
      return parseDate(date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return date || "";
    }
  }

  function findExpense(id) {
    return state.expenses.find(expense => String(expense.id) === String(id));
  }

  function categoryOptions(selectedId) {
    return state.categories.map(category => `
      <option value="${safe(category.id)}" ${category.id === selectedId ? "selected" : ""}>${safe((category.icon || "") + " " + category.name)}</option>
    `).join("");
  }

  function ensureEditor() {
    let backdrop = document.getElementById("transactionEditorBackdrop");
    if (backdrop) return backdrop;

    backdrop = document.createElement("div");
    backdrop.id = "transactionEditorBackdrop";
    backdrop.className = "tx-modal-backdrop";
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <section class="tx-modal" role="dialog" aria-modal="true" aria-label="Edit transaction">
        <div class="tx-modal-header">
          <div class="tx-modal-title">Edit transaction</div>
          <button class="tx-close-button" id="txClose" type="button" aria-label="Close">×</button>
        </div>

        <label class="field-label" for="txAmount">Amount</label>
        <div class="amount-field">
          <span>$</span>
          <input id="txAmount" type="text" inputmode="decimal" autocomplete="off" />
        </div>

        <label class="field-label" for="txMerchant">Merchant</label>
        <input id="txMerchant" type="text" autocomplete="off" />

        <div class="tx-grid-two">
          <div>
            <label class="field-label" for="txCategory">Category</label>
            <select id="txCategory"></select>
          </div>
          <div>
            <label class="field-label" for="txDate">Date</label>
            <input id="txDate" type="date" />
          </div>
        </div>

        <label class="field-label" for="txNote">Note</label>
        <input id="txNote" type="text" placeholder="Optional" autocomplete="off" />

        <div class="tx-button-row">
          <button class="tx-delete-button" id="txDelete" type="button">Delete</button>
          <button class="tx-save-button" id="txSave" type="button">Save changes</button>
        </div>
      </section>
    `;
    document.body.appendChild(backdrop);

    backdrop.addEventListener("click", event => {
      if (event.target === backdrop) closeEditor();
    });
    backdrop.querySelector("#txClose").addEventListener("click", closeEditor);
    backdrop.querySelector("#txSave").addEventListener("click", saveEditedTransaction);
    backdrop.querySelector("#txDelete").addEventListener("click", deleteEditedTransaction);
    return backdrop;
  }

  function openEditor(id) {
    const expense = findExpense(id);
    if (!expense) return;
    editingId = expense.id;
    const backdrop = ensureEditor();

    backdrop.querySelector("#txAmount").value = expense.amount ?? "";
    backdrop.querySelector("#txMerchant").value = expense.merchant || "";
    backdrop.querySelector("#txCategory").innerHTML = categoryOptions(expense.categoryId);
    backdrop.querySelector("#txDate").value = expense.date || (typeof todayISO === "function" ? todayISO() : "");
    backdrop.querySelector("#txNote").value = expense.note || "";

    backdrop.hidden = false;
    document.body.classList.add("tx-modal-open");
    setTimeout(() => backdrop.querySelector("#txAmount")?.focus(), 120);
  }

  function closeEditor() {
    editingId = null;
    const backdrop = document.getElementById("transactionEditorBackdrop");
    if (backdrop) backdrop.hidden = true;
    document.body.classList.remove("tx-modal-open");
  }

  function saveEditedTransaction() {
    const expense = findExpense(editingId);
    const backdrop = ensureEditor();
    if (!expense) return closeEditor();

    const amount = parseEditAmount(backdrop.querySelector("#txAmount").value);
    const merchant = backdrop.querySelector("#txMerchant").value.trim();
    const category = categoryById(backdrop.querySelector("#txCategory").value) || categoryByName("Other") || state.categories[0];

    if (!amount || amount <= 0) {
      showToast?.("Enter an amount");
      return;
    }
    if (!merchant) {
      showToast?.("Enter a merchant");
      return;
    }

    expense.amount = amount;
    expense.merchant = merchant;
    expense.categoryId = category.id;
    expense.categoryName = category.name;
    expense.date = backdrop.querySelector("#txDate").value || expense.date;
    expense.note = backdrop.querySelector("#txNote").value.trim();

    saveState();
    renderAll();
    closeEditor();
    showToast?.("Transaction updated");
  }

  function deleteEditedTransaction() {
    const expense = findExpense(editingId);
    if (!expense) return closeEditor();
    if (!confirm(`Delete ${expense.merchant || "this transaction"}?`)) return;

    state.expenses = state.expenses.filter(item => String(item.id) !== String(editingId));
    saveState();
    renderAll();
    closeEditor();
    showToast?.("Transaction deleted");
  }

  renderTransactions = function (container, rows) {
    if (!container) return;
    if (!rows || !rows.length) {
      container.innerHTML = `<div class="empty-card">No transactions</div>`;
      return;
    }

    container.innerHTML = rows.map(expense => `
      <div class="transaction-row editable-transaction-row" data-expense-id="${safe(expense.id)}">
        <div class="category-icon">${safe(typeof merchantInitials === "function" ? merchantInitials(expense.merchant) : "?")}</div>
        <div>
          <div class="row-title">${safe(expense.merchant)}</div>
          <div class="row-subtitle">${safe(formattedDate(expense.date))} · ${safe(expenseCategory(expense))}</div>
        </div>
        <div class="row-amount">${typeof money === "function" ? money(expense.amount) : safe(expense.amount)}</div>
      </div>
    `).join("");
  };

  document.addEventListener("click", event => {
    const row = event.target.closest(".editable-transaction-row");
    if (row) {
      event.preventDefault();
      openEditor(row.dataset.expenseId);
    }
  });

  setTimeout(() => renderAll(), 0);
})();
