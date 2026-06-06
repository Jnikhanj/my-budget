const STORAGE_KEY = "moneyBudget.v1";

const categoryDefaults = [
  { id: crypto.randomUUID(), name: "Food delivery", icon: "🍕", color: "#ff6b57" },
  { id: crypto.randomUUID(), name: "Groceries", icon: "🛒", color: "#55e580" },
  { id: crypto.randomUUID(), name: "Fuel", icon: "⛽", color: "#ffd166" },
  { id: crypto.randomUUID(), name: "Bills", icon: "🧾", color: "#8ea2ff" },
  { id: crypto.randomUUID(), name: "Shopping", icon: "🛍️", color: "#c084fc" },
  { id: crypto.randomUUID(), name: "Health", icon: "💊", color: "#57d9ff" },
  { id: crypto.randomUUID(), name: "Family / India", icon: "🏠", color: "#ff9f43" },
  { id: crypto.randomUUID(), name: "Other", icon: "••", color: "#9aa3b2" }
];

const $ = (id) => document.getElementById(id);
const money = (value) => new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: value % 1 === 0 ? 0 : 2
}).format(Number(value || 0)).replace("A", "A");

const todayISO = () => new Date().toISOString().slice(0, 10);
const parseDate = (value) => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
};

let state = loadState();

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        monthlyBudget: Number(parsed.monthlyBudget ?? 2800),
        budgetStartDay: Number(parsed.budgetStartDay ?? 1),
        categories: parsed.categories?.length ? parsed.categories : categoryDefaults,
        expenses: parsed.expenses ?? []
      };
    } catch {}
  }

  return {
    monthlyBudget: 2800,
    budgetStartDay: 1,
    categories: categoryDefaults,
    expenses: []
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getCurrentBudgetPeriod() {
  const now = new Date();
  const startDay = Math.min(Math.max(Number(state.budgetStartDay || 1), 1), 28);
  let start = new Date(now.getFullYear(), now.getMonth(), startDay);
  if (now < start) start = new Date(now.getFullYear(), now.getMonth() - 1, startDay);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, startDay);
  return { start, end };
}

function inCurrentPeriod(expense) {
  const { start, end } = getCurrentBudgetPeriod();
  const d = parseDate(expense.date);
  return d >= start && d < end;
}

function currentExpenses() {
  return state.expenses.filter(inCurrentPeriod);
}

function total(expenses = currentExpenses()) {
  return expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
}

function categoryTotals(expenses = currentExpenses()) {
  const map = new Map();
  for (const category of state.categories) {
    map.set(category.id, { ...category, amount: 0, count: 0 });
  }
  for (const expense of expenses) {
    const item = map.get(expense.categoryId) || {
      id: expense.categoryId,
      name: expense.categoryName || "Other",
      icon: "••",
      color: "#9aa3b2",
      amount: 0,
      count: 0
    };
    item.amount += Number(expense.amount || 0);
    item.count += 1;
    map.set(expense.categoryId, item);
  }
  return Array.from(map.values()).filter(item => item.amount > 0).sort((a, b) => b.amount - a.amount);
}

function setDonut(element, percent, color = "#55e580") {
  const safe = Math.max(0, Math.min(100, Math.round(percent)));
  element.style.setProperty("--percent", safe);
  element.style.setProperty("--donut-color", color);
}

function budgetStatus() {
  const spent = total();
  const budget = Number(state.monthlyBudget || 0);
  const left = Math.max(0, budget - spent);
  const usedPercent = budget > 0 ? (spent / budget) * 100 : 0;
  const leftPercent = budget > 0 ? Math.max(0, 100 - usedPercent) : 0;
  let note = "Just getting started. Your budget is barely touched.";
  let color = "#55e580";
  if (usedPercent >= 85) { note = "Close to the limit. Slow down where you can."; color = "#ff735e"; }
  else if (usedPercent >= 60) { note = "On track, but keep watching larger expenses."; color = "#ffd166"; }
  else if (usedPercent >= 25) { note = "Good pace for this budget period."; color = "#55e580"; }
  return { spent, budget, left, usedPercent, leftPercent, note, color };
}

function renderAll() {
  renderDashboard();
  renderAnalytics();
  renderHistory();
  renderSettings();
  fillCategorySelects();
}

function renderDashboard() {
  const status = budgetStatus();
  $("spentAmount").textContent = money(status.spent);
  $("budgetLeft").textContent = `${money(status.left)} left in budget`;
  $("budgetNote").textContent = status.budget ? status.note : "Set a budget to get started.";
  $("budgetPercent").textContent = `${Math.round(status.usedPercent)}%`;
  setDonut($("budgetDonut"), status.usedPercent, status.color);

  renderSparkline();
  renderCategoryList($("categoryList"), categoryTotals().slice(0, 4), true);
  renderTransactions($("recentTransactions"), currentExpenses().sort(byNewest).slice(0, 5), true);
}

function renderSparkline() {
  const expenses = currentExpenses();
  const { start, end } = getCurrentBudgetPeriod();
  const days = Math.max(1, Math.ceil((end - start) / 86400000));
  const values = Array(days).fill(0);
  for (const expense of expenses) {
    const idx = Math.floor((parseDate(expense.date) - start) / 86400000);
    if (idx >= 0 && idx < values.length) values[idx] += Number(expense.amount || 0);
  }

  let cumulative = 0;
  const cumulativeValues = values.map(v => cumulative += v);
  const max = Math.max(1, ...cumulativeValues, Number(state.monthlyBudget || 0));
  const points = cumulativeValues.map((v, i) => {
    const x = (i / Math.max(1, days - 1)) * 100;
    const y = 96 - (v / max) * 70;
    return `${x},${y}`;
  }).join(" ");

  $("sparkline").innerHTML = `
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.22)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <polyline points="${points}" fill="none" stroke="rgba(255,255,255,0.95)" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      <polygon points="0,100 ${points} 100,100" fill="url(#lineFill)" />
    </svg>`;
}

function renderAnalytics() {
  const status = budgetStatus();
  $("analyticsSpent").textContent = money(status.spent);
  $("detailLeft").textContent = `${money(status.left)} left`;
  $("detailPercent").textContent = `${Math.round(status.usedPercent)}%`;
  setDonut($("detailDonut"), status.usedPercent, status.color);

  const { start, end } = getCurrentBudgetPeriod();
  $("detailPeriod").textContent = `${start.toLocaleDateString("en-AU", { day: "numeric", month: "short" })} – ${new Date(end.getTime() - 86400000).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`;

  renderWeeklyChart();
  const sortBy = $("analyticsSort").value;
  const cats = categoryTotals();
  if (sortBy === "amount") cats.sort((a, b) => b.amount - a.amount);
  if (sortBy === "count") cats.sort((a, b) => b.count - a.count);
  renderCategoryList($("analyticsCategories"), cats, false);
}

function renderWeeklyChart() {
  const expenses = currentExpenses();
  const { start } = getCurrentBudgetPeriod();
  const buckets = [0, 0, 0, 0, 0];
  for (const expense of expenses) {
    const idx = Math.min(4, Math.floor((parseDate(expense.date) - start) / (7 * 86400000)));
    if (idx >= 0) buckets[idx] += Number(expense.amount || 0);
  }
  const max = Math.max(1, ...buckets);
  const labels = ["1–7", "8–14", "15–21", "22–28", "29+"];
  $("weeklyChart").innerHTML = buckets.map((v, idx) => {
    const h = Math.max(4, (v / max) * 126);
    return `<div class="bar-wrap"><div class="bar" style="height:${h}px"></div><div>${labels[idx]}</div></div>`;
  }).join("");
}

function renderCategoryList(container, rows, compact) {
  if (!rows.length) {
    container.innerHTML = `<div class="empty-card">No spending yet. Tap + to add your first expense.</div>`;
    return;
  }

  container.innerHTML = rows.map(row => `
    <div class="category-row">
      <div class="category-icon" style="background:${row.color || "#9aa3b2"}">${row.icon || "••"}</div>
      <div class="category-main">
        <div class="row-title">${escapeHtml(row.name)}</div>
        <div class="row-subtitle">${row.count} expense${row.count === 1 ? "" : "s"}</div>
      </div>
      <div class="row-amount">${money(row.amount)}</div>
    </div>
  `).join("");
}

function byNewest(a, b) {
  return new Date(`${b.date}T12:00`) - new Date(`${a.date}T12:00`) || b.createdAt - a.createdAt;
}

function renderTransactions(container, rows, compact = false) {
  if (!rows.length) {
    container.innerHTML = `<div class="empty-card">No transactions yet.</div>`;
    return;
  }

  container.innerHTML = rows.map(expense => {
    const category = state.categories.find(c => c.id === expense.categoryId) || { icon: "••", color: "#9aa3b2", name: "Other" };
    return `
      <div class="transaction-row">
        <div class="category-icon" style="background:${category.color}">${category.icon}</div>
        <div class="transaction-main">
          <div class="row-title">${escapeHtml(expense.merchant)}</div>
          <div class="row-subtitle">${escapeHtml(category.name)} · ${escapeHtml(expense.payment || "Card")}</div>
          <div class="transaction-date">${parseDate(expense.date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: compact ? undefined : "numeric" })}${expense.note ? " · " + escapeHtml(expense.note) : ""}</div>
        </div>
        <div class="row-amount">${money(expense.amount)}</div>
      </div>
    `;
  }).join("");
}

function renderHistory() {
  const query = $("searchInput").value.trim().toLowerCase();
  const cat = $("historyCategoryFilter").value;
  const rows = state.expenses
    .filter(e => !cat || e.categoryId === cat)
    .filter(e => {
      if (!query) return true;
      const category = state.categories.find(c => c.id === e.categoryId)?.name || "";
      return [e.merchant, e.note, e.payment, category].join(" ").toLowerCase().includes(query);
    })
    .sort(byNewest);
  renderTransactions($("historyList"), rows, false);
}

function renderSettings() {
  $("monthlyBudget").value = state.monthlyBudget;
  $("budgetStartDay").value = state.budgetStartDay;

  $("categoryEditList").innerHTML = state.categories.map(category => `
    <div class="category-edit-row">
      <div>${category.icon} ${escapeHtml(category.name)}</div>
      <button class="ghost-button" type="button" data-delete-category="${category.id}">Remove</button>
    </div>
  `).join("");

  const filter = $("historyCategoryFilter");
  const currentValue = filter.value;
  filter.innerHTML = `<option value="">All</option>` + state.categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  filter.value = currentValue;
}

function fillCategorySelects() {
  $("categoryInput").innerHTML = state.categories.map(c => `<option value="${c.id}">${c.icon} ${escapeHtml(c.name)}</option>`).join("");
}

function route(name) {
  document.querySelectorAll(".screen").forEach(screen => screen.classList.remove("is-active"));
  $(`screen-${name}`).classList.add("is-active");
  document.querySelectorAll(".nav-button").forEach(btn => btn.classList.toggle("is-active", btn.dataset.route === name));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1900);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[ch]));
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function toCsv() {
  const header = ["date", "amount", "merchant", "category", "payment", "note"];
  const lines = state.expenses.sort(byNewest).map(e => {
    const category = state.categories.find(c => c.id === e.categoryId)?.name || e.categoryName || "Other";
    return [e.date, e.amount, e.merchant, category, e.payment, e.note].map(v => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",");
  });
  return [header.join(","), ...lines].join("\n");
}

function wireEvents() {
  document.querySelectorAll("[data-route]").forEach(btn => {
    btn.addEventListener("click", () => route(btn.dataset.route));
  });

  $("openAdd").addEventListener("click", () => {
    $("dateInput").value = todayISO();
    $("expenseForm").reset();
    $("dateInput").value = todayISO();
    $("paymentInput").value = "Apple Pay";
    $("addDialog").showModal();
    setTimeout(() => $("amountInput").focus(), 120);
  });

  $("closeAdd").addEventListener("click", () => $("addDialog").close());

  $("expenseForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const category = state.categories.find(c => c.id === $("categoryInput").value) || state.categories[0];
    const expense = {
      id: crypto.randomUUID(),
      amount: Number($("amountInput").value),
      merchant: $("merchantInput").value.trim(),
      categoryId: category.id,
      categoryName: category.name,
      payment: $("paymentInput").value,
      date: $("dateInput").value,
      note: $("noteInput").value.trim(),
      createdAt: Date.now()
    };

    if (!expense.amount || expense.amount <= 0 || !expense.merchant) {
      showToast("Add amount and description");
      return;
    }

    state.expenses.push(expense);
    saveState();
    $("addDialog").close();
    renderAll();
    showToast("Expense saved");
  });

  $("analyticsSort").addEventListener("change", renderAnalytics);
  $("searchInput").addEventListener("input", renderHistory);
  $("historyCategoryFilter").addEventListener("change", renderHistory);

  $("saveSettings").addEventListener("click", () => {
    state.monthlyBudget = Number($("monthlyBudget").value || 0);
    state.budgetStartDay = Math.min(Math.max(Number($("budgetStartDay").value || 1), 1), 28);
    saveState();
    renderAll();
    showToast("Settings saved");
  });

  $("addCategory").addEventListener("click", () => {
    const name = $("newCategoryName").value.trim();
    if (!name) return;
    const palette = ["#ff6b57", "#55e580", "#ffd166", "#8ea2ff", "#c084fc", "#57d9ff", "#ff9f43", "#9aa3b2"];
    state.categories.push({
      id: crypto.randomUUID(),
      name,
      icon: "●",
      color: palette[state.categories.length % palette.length]
    });
    $("newCategoryName").value = "";
    saveState();
    renderAll();
    showToast("Category added");
  });

  $("categoryEditList").addEventListener("click", (event) => {
    const id = event.target.dataset.deleteCategory;
    if (!id) return;
    const used = state.expenses.some(e => e.categoryId === id);
    if (used) {
      showToast("Category has expenses");
      return;
    }
    state.categories = state.categories.filter(c => c.id !== id);
    saveState();
    renderAll();
  });

  $("exportJson").addEventListener("click", () => {
    download(`money-budget-backup-${todayISO()}.json`, JSON.stringify(state, null, 2), "application/json");
  });

  $("exportCsv").addEventListener("click", () => {
    download(`money-budget-transactions-${todayISO()}.csv`, toCsv(), "text/csv");
  });

  $("importJson").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed.expenses) || !Array.isArray(parsed.categories)) throw new Error("Invalid backup");
      state = parsed;
      saveState();
      renderAll();
      showToast("Backup imported");
    } catch {
      showToast("Could not import file");
    } finally {
      event.target.value = "";
    }
  });

  $("resetData").addEventListener("click", () => {
    if (!confirm("Delete all budget data stored in this browser?")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = loadState();
    renderAll();
    showToast("Data reset");
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}

wireEvents();
fillCategorySelects();
$("dateInput").value = todayISO();
renderAll();
