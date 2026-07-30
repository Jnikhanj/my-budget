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
  const themePicker = document.getElementById("themePicker");
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
    themePicker?.querySelectorAll("[data-theme-choice]").forEach(button => {
      const selected = button.dataset.themeChoice === theme;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    if (metaTheme) metaTheme.setAttribute("content", resolved === "dark" ? "#111111" : "#f7f7f5");
  }

  function applyAccent(value) {
    const accent = accents.find(item => item.id === value) || accents[0];
    document.body.dataset.accent = accent.id;
    accentPicker?.querySelectorAll("[data-accent]").forEach(button => {
      button.classList.toggle("is-selected", button.dataset.accent === accent.id);
    });
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

  themePicker?.addEventListener("click", event => {
    const option = event.target.closest("[data-theme-choice]");
    if (!option) return;
    localStorage.setItem(THEME_KEY, option.dataset.themeChoice);
    applyTheme(option.dataset.themeChoice);
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
      border-radius: 24px;
      border: 1px solid var(--line);
      padding: 16px;
      box-shadow: 0 24px 70px rgba(17, 18, 23, 0.28);
    }
    .tx-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 6px;
    }
    .tx-modal-title {
      font-size: 20px;
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
    .tx-button-row { display: grid; gap: 8px; margin-top: 12px; }
    .tx-delete-button {
      min-height: 42px;
      border-radius: 12px;
      border: 1px solid rgba(220, 82, 71, 0.20);
      color: var(--danger);
      background: rgba(220, 82, 71, 0.08);
      font-weight: 790;
    }
    .tx-save-button {
      min-height: 46px;
      border-radius: 12px;
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
        <div class="amount-currency-row">
          <div class="amount-field">
            <span id="txCurrencySymbol">$</span>
            <input id="txAmount" type="text" inputmode="decimal" autocomplete="off" />
          </div>
          <select id="txCurrency" aria-label="Currency">
            <option value="AUD">AUD</option>
            <option value="INR">INR</option>
          </select>
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
          <button class="tx-save-button" id="txSave" type="button">Save changes</button>
          <button class="tx-delete-button" id="txDelete" type="button">Delete transaction</button>
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
    backdrop.querySelector("#txCurrency").addEventListener("change", event => {
      backdrop.querySelector("#txCurrencySymbol").textContent = event.target.value === "INR" ? "₹" : "$";
    });
    return backdrop;
  }

  function openEditor(id) {
    const expense = findExpense(id);
    if (!expense) return;
    editingId = expense.id;
    const backdrop = ensureEditor();

    backdrop.querySelector("#txAmount").value = expense.amount ?? "";
    backdrop.querySelector("#txCurrency").value = typeof normalizeCurrency === "function" ? normalizeCurrency(expense.currency) : "AUD";
    backdrop.querySelector("#txCurrencySymbol").textContent = backdrop.querySelector("#txCurrency").value === "INR" ? "₹" : "$";
    backdrop.querySelector("#txMerchant").value = expense.merchant || "";
    backdrop.querySelector("#txCategory").innerHTML = categoryOptions(expense.categoryId);
    backdrop.querySelector("#txDate").value = expense.date || (typeof todayISO === "function" ? todayISO() : "");
    backdrop.querySelector("#txNote").value = expense.note || "";

    backdrop.hidden = false;
    document.body.classList.add("tx-modal-open");
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
    expense.currency = typeof normalizeCurrency === "function"
      ? normalizeCurrency(backdrop.querySelector("#txCurrency").value)
      : backdrop.querySelector("#txCurrency").value;
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
        <div class="row-amount">${typeof money === "function" ? money(expense.amount, expense.currency) : safe(expense.amount)}</div>
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

(function () {
  if (typeof document === "undefined") return;
  if (typeof state === "undefined" || typeof currentExpenses !== "function" || typeof categoryTotals !== "function") return;

  let analyticsOpenCategoryId = "";

  const style = document.createElement("style");
  style.textContent = `
    .app-shell { padding-top: calc(env(safe-area-inset-top, 0px) + 34px); }
    .bar-chart { display: block; height: 182px; padding-top: 0; border-bottom: 0; }
    .line-chart-card { width: 100%; height: 100%; display: grid; grid-template-rows: 1fr auto; gap: 4px; }
    .line-chart-svg { width: 100%; height: 148px; overflow: visible; }
    .chart-grid-line { stroke: var(--line); stroke-width: 1.25; vector-effect: non-scaling-stroke; }
    .chart-grid-line.faint { opacity: 0.55; stroke-dasharray: 4 5; }
    .chart-area { fill: var(--accent-soft); opacity: 0.9; }
    .chart-line { fill: none; stroke: var(--accent); stroke-width: 4.5; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
    .chart-point { fill: var(--surface); stroke: var(--accent); stroke-width: 3; vector-effect: non-scaling-stroke; }
    .chart-value { fill: var(--text); font-size: 10px; font-weight: 650; text-anchor: middle; dominant-baseline: auto; }
    .line-chart-labels { display: grid; grid-template-columns: repeat(5, 1fr); color: var(--muted); font-size: 12px; font-weight: 520; text-align: center; }
    .category-drill-hint { color: var(--muted); font-size: 13px; margin: 4px 0 8px; }
    .category-drill-block { border-bottom: 1px solid var(--line); }
    .category-drill-block:last-child { border-bottom: 0; }
    .category-budget-row.category-drill-row { width: 100%; min-height: 64px; border: 0; border-radius: 0; border-bottom: 0; background: transparent; color: var(--text); text-align: left; padding: 10px 0; }
    .category-budget-row.category-drill-row:active { transform: none; opacity: 0.72; }
    .category-budget-row.category-drill-row.is-open { padding-bottom: 8px; }
    .category-row-end { display: flex; align-items: center; gap: 7px; justify-content: end; }
    .drill-chevron { color: var(--muted); font-size: 14px; font-weight: 650; line-height: 1; min-width: 12px; text-align: right; }
    .category-drilldown { margin: 0 0 8px 46px; padding: 6px 0 8px; border-top: 1px solid var(--line); }
    .drill-transaction-row { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; min-height: 48px; padding: 8px 0; border-bottom: 1px solid var(--line); }
    .drill-transaction-row:last-child { border-bottom: 0; }
    .drill-transaction-row .row-title, .drill-transaction-row .row-amount { font-size: 15px; }
    @media (max-width: 380px) { .analytics-number { font-size: 40px; } .chart-value { font-size: 9px; } }
  `;
  document.head.appendChild(style);

  function safe(value) {
    if (typeof escapeHtml === "function") return escapeHtml(value);
    return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
  }

  renderWeeklyChart = function renderWeeklyLineChart() {
    const expenses = currentExpenses();
    const { start } = getCurrentMonthPeriod();
    const buckets = [0, 0, 0, 0, 0];
    const labels = ["1–7", "8–14", "15–21", "22–28", "29+"];

    for (const expense of expenses) {
      const idx = Math.min(4, Math.floor((parseDate(expense.date) - start) / (7 * 86400000)));
      if (idx >= 0) buckets[idx] += Number(expense.amount || 0);
    }

    const max = Math.max(1, ...buckets);
    const width = 320;
    const height = 150;
    const padX = 22;
    const padTop = 24;
    const padBottom = 28;
    const plotHeight = height - padTop - padBottom;
    const step = (width - padX * 2) / (labels.length - 1);
    const baseY = height - padBottom;

    const points = buckets.map((value, index) => {
      const x = padX + index * step;
      const y = baseY - (value / max) * plotHeight;
      return { x, y, value, label: labels[index] };
    });

    const linePoints = points.map(point => `${point.x},${point.y}`).join(" ");
    const areaPoints = `${padX},${baseY} ${linePoints} ${width - padX},${baseY}`;
    const chartLabel = buckets.map((value, index) => `${labels[index]} ${money(value)}`).join(", ");

    $("weeklyChart").innerHTML = `
      <div class="line-chart-card" role="img" aria-label="Weekly spending trend: ${safe(chartLabel)}">
        <svg class="line-chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
          <line class="chart-grid-line" x1="${padX}" y1="${baseY}" x2="${width - padX}" y2="${baseY}" />
          <line class="chart-grid-line faint" x1="${padX}" y1="${padTop + plotHeight / 2}" x2="${width - padX}" y2="${padTop + plotHeight / 2}" />
          <polygon class="chart-area" points="${areaPoints}" />
          <polyline class="chart-line" points="${linePoints}" />
          ${points.map(point => `
            <circle class="chart-point" cx="${point.x}" cy="${point.y}" r="4.5" />
            ${point.value > 0 ? `<text class="chart-value" x="${point.x}" y="${Math.max(12, point.y - 9)}">${money(point.value)}</text>` : ""}
          `).join("")}
        </svg>
        <div class="line-chart-labels">
          ${labels.map(label => `<span>${label}</span>`).join("")}
        </div>
      </div>
    `;
  };

  renderAnalytics = function renderEnhancedAnalytics() {
    const status = budgetStatus();
    $("analyticsSpent").textContent = money(status.spent);
    $("budgetMiniText").textContent = `${money(status.left)} available`;
    $("budgetMiniPercent").textContent = `${Math.round(status.usedPercent)}% used`;
    $("budgetMiniProgress").style.width = `${status.usedPercent}%`;
    renderWeeklyChart();
    renderInsights();

    const cats = categoryTotals();
    const sortBy = $("analyticsSort").value;
    if (sortBy === "category") cats.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "count") cats.sort((a, b) => b.count - a.count);

    if (analyticsOpenCategoryId && !cats.some(row => row.id === analyticsOpenCategoryId)) analyticsOpenCategoryId = "";

    $("analyticsCategories").innerHTML = cats.length ? `
      <div class="category-drill-hint">Tap a category to view individual transactions.</div>
      ${cats.map(renderAnalyticsCategory).join("")}
    ` : `<div class="empty-card">No category spending</div>`;

    $("analyticsCategories").querySelectorAll("[data-analytics-category]").forEach(row => {
      row.addEventListener("click", () => {
        const id = row.dataset.analyticsCategory;
        analyticsOpenCategoryId = analyticsOpenCategoryId === id ? "" : id;
        renderAnalytics();
      });
    });
  };

  function renderAnalyticsCategory(row) {
    const budget = Number(state.categoryBudgets?.[row.id] || 0);
    const percent = budget > 0 ? Math.min(100, (row.amount / budget) * 100) : 0;
    const subtitle = budget > 0 ? `${money(row.amount)} of ${money(budget)}` : `${row.count} transaction${row.count === 1 ? "" : "s"}`;
    const isOpen = analyticsOpenCategoryId === row.id;

    return `
      <div class="category-drill-block">
        <button class="category-budget-row category-drill-row ${isOpen ? "is-open" : ""}" type="button" data-analytics-category="${safe(row.id)}" aria-expanded="${isOpen}">
          <div class="category-icon">${categoryInitial(row.name)}</div>
          <div>
            <div class="row-title">${safe(row.name)}</div>
            <div class="row-subtitle">${subtitle}</div>
            ${budget > 0 ? `<div class="mini-progress"><span style="width:${percent}%"></span></div>` : ""}
          </div>
          <div class="category-row-end">
            <div class="row-amount">${money(row.amount)}</div>
            <div class="drill-chevron">${isOpen ? "⌃" : "⌄"}</div>
          </div>
        </button>
        ${isOpen ? renderCategoryTransactions(row.id) : ""}
      </div>
    `;
  }

  function renderCategoryTransactions(categoryId) {
    const rows = currentExpenses().filter(expense => expense.categoryId === categoryId).sort(byNewest);
    if (!rows.length) return `<div class="category-drilldown"><div class="empty-card">No transactions</div></div>`;

    return `
      <div class="category-drilldown">
        ${rows.map(expense => `
          <div class="drill-transaction-row">
            <div>
              <div class="row-title">${safe(expense.merchant)}</div>
              <div class="row-subtitle">
                ${parseDate(expense.date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}${expense.note ? ` · ${safe(expense.note)}` : ""}
              </div>
            </div>
            <div class="row-amount">${money(expense.amount, expense.currency)}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  $("analyticsSort")?.addEventListener("change", renderAnalytics);
  setTimeout(() => renderAnalytics(), 0);
})();
