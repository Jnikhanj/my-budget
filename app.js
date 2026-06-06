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
const money = (value) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: Number(value || 0) % 1 === 0 ? 0 : 2 }).format(Number(value || 0)).replace("A", "A");
const todayISO = () => new Date().toISOString().slice(0, 10);
const parseDate = (value) => { const [y, m, d] = value.split("-").map(Number); return new Date(y, m - 1, d); };
let state = loadState();

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return { monthlyBudget: Number(parsed.monthlyBudget ?? 2800), budgetStartDay: Number(parsed.budgetStartDay ?? 1), categories: parsed.categories?.length ? parsed.categories : categoryDefaults, expenses: parsed.expenses ?? [] };
    } catch {}
  }
  return { monthlyBudget: 2800, budgetStartDay: 1, categories: categoryDefaults, expenses: [] };
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function getCurrentBudgetPeriod() {
  const now = new Date();
  const startDay = Math.min(Math.max(Number(state.budgetStartDay || 1), 1), 28);
  let start = new Date(now.getFullYear(), now.getMonth(), startDay);
  if (now < start) start = new Date(now.getFullYear(), now.getMonth() - 1, startDay);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, startDay);
  return { start, end };
}
function inCurrentPeriod(expense) { const { start, end } = getCurrentBudgetPeriod(); const d = parseDate(expense.date); return d >= start && d < end; }
function currentExpenses() { return state.expenses.filter(inCurrentPeriod); }
function total(expenses = currentExpenses()) { return expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0); }
function categoryTotals(expenses = currentExpenses()) {
  const map = new Map();
  for (const category of state.categories) map.set(category.id, { ...category, amount: 0, count: 0 });
  for (const expense of expenses) {
    const item = map.get(expense.categoryId) || { id: expense.categoryId, name: expense.categoryName || "Other", icon: "••", color: "#9aa3b2", amount: 0, count: 0 };
    item.amount += Number(expense.amount || 0); item.count += 1; map.set(expense.categoryId, item);
  }
  return Array.from(map.values()).filter(item => item.amount > 0).sort((a, b) => b.amount - a.amount);
}
function setDonut(element, percent, color = "#55e580") { const safe = Math.max(0, Math.min(100, Math.round(percent))); element.style.setProperty("--percent", safe); element.style.setProperty("--donut-color", color); }
function budgetStatus() {
  const spent = total(); const budget = Number(state.monthlyBudget || 0); const left = Math.max(0, budget - spent); const usedPercent = budget > 0 ? (spent / budget) * 100 : 0;
  let note = "Just getting started. Your budget is barely touched."; let color = "#55e580";
  if (usedPercent >= 85) { note = "Close to the limit. Slow down where you can."; color = "#ff735e"; }
  else if (usedPercent >= 60) { note = "On track, but keep watching larger expenses."; color = "#ffd166"; }
  else if (usedPercent >= 25) { note = "Good pace for this budget period."; color = "#55e580"; }
  return { spent, budget, left, usedPercent, note, color };
}
function renderAll() { renderDashboard(); renderAnalytics(); renderHistory(); renderSettings(); fillCategorySelects(); }
function renderDashboard() {
  const status = budgetStatus();
  $("spentAmount").textContent = money(status.spent); $("budgetLeft").textContent = `${money(status.left)} left in budget`; $("budgetNote").textContent = status.budget ? status.note : "Set a budget to get started."; $("budgetPercent").textContent = `${Math.round(status.usedPercent)}%`; setDonut($("budgetDonut"), status.usedPercent, status.color);
  renderSparkline(); renderCategoryList($("categoryList"), categoryTotals().slice(0, 4)); renderTransactions($("recentTransactions"), currentExpenses().sort(byNewest).slice(0, 5), true);
}
function buildSmoothPath(points) { if (points.length < 2) return ""; let d = `M ${points[0].x} ${points[0].y}`; for (let i = 1; i < points.length; i++) { const prev = points[i - 1]; const current = points[i]; const midX = (prev.x + current.x) / 2; d += ` C ${midX} ${prev.y}, ${midX} ${current.y}, ${current.x} ${current.y}`; } return d; }
function renderSparkline() {
  const expenses = currentExpenses(); const { start, end } = getCurrentBudgetPeriod(); const days = Math.max(1, Math.ceil((end - start) / 86400000)); const daily = Array(days).fill(0);
  for (const expense of expenses) { const idx = Math.floor((parseDate(expense.date) - start) / 86400000); if (idx >= 0 && idx < daily.length) daily[idx] += Number(expense.amount || 0); }
  let cumulative = 0; let cumulativeValues = daily.map(v => cumulative += v);
  if (!expenses.length) cumulativeValues = Array.from({ length: days }, () => 0);
  const max = Math.max(1, ...cumulativeValues) * 1.18;
  const points = cumulativeValues.map((v, i) => ({ x: (i / Math.max(1, days - 1)) * 100, y: 82 - (v / max) * 62 }));
  if (!expenses.length) points.forEach((p, i) => { p.y = 68 + Math.sin(i / 4) * 1.6; });
  const path = buildSmoothPath(points); const area = `${path} L 100 98 L 0 98 Z`; const latest = points[points.length - 1] || { x: 0, y: 68 };
  $("sparkline").innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="trendStroke" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stop-color="#67d7ff"/><stop offset="52%" stop-color="#7a85ff"/><stop offset="100%" stop-color="#a76bff"/></linearGradient><linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="rgba(104, 138, 255, 0.36)"/><stop offset="100%" stop-color="rgba(104, 138, 255, 0)"/></linearGradient><filter id="trendGlow"><feGaussianBlur stdDeviation="2.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><line x1="0" y1="70" x2="100" y2="70" stroke="rgba(255,255,255,0.12)" stroke-width="0.8" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/><path d="${area}" fill="url(#trendFill)"/><path d="${path}" fill="none" stroke="url(#trendStroke)" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" filter="url(#trendGlow)"/><circle cx="${latest.x}" cy="${latest.y}" r="1.8" fill="#ffffff" opacity="${expenses.length ? 0.95 : 0}" vector-effect="non-scaling-stroke"/></svg>`;
}
function renderAnalytics() {
  const status = budgetStatus(); $("analyticsSpent").textContent = money(status.spent); $("detailLeft").textContent = `${money(status.left)} left`; $("detailPercent").textContent = `${Math.round(status.usedPercent)}%`; setDonut($("detailDonut"), status.usedPercent, status.color);
  const { start, end } = getCurrentBudgetPeriod(); $("detailPeriod").textContent = `${start.toLocaleDateString("en-AU", { day: "numeric", month: "short" })} – ${new Date(end.getTime() - 86400000).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`;
  renderWeeklyChart(); const sortBy = $("analyticsSort").value; const cats = categoryTotals(); if (sortBy === "amount") cats.sort((a, b) => b.amount - a.amount); if (sortBy === "count") cats.sort((a, b) => b.count - a.count); renderCategoryList($("analyticsCategories"), cats);
}
function renderWeeklyChart() {
  const expenses = currentExpenses(); const { start } = getCurrentBudgetPeriod(); const buckets = [0, 0, 0, 0, 0];
  for (const expense of expenses) { const idx = Math.min(4, Math.floor((parseDate(expense.date) - start) / (7 * 86400000))); if (idx >= 0) buckets[idx] += Number(expense.amount || 0); }
  const max = Math.max(1, ...buckets); const labels = ["1–7", "8–14", "15–21", "22–28", "29+"]; const maxValue = Math.max(...buckets);
  $("weeklyChart").innerHTML = buckets.map((v, idx) => { const h = Math.max(v ? 7 : 4, (v / max) * 118); const isMax = v > 0 && v === maxValue; return `<div class="bar-wrap"><div class="bar ${isMax ? "is-max" : ""}" style="height:${h}px"></div><div>${labels[idx]}</div></div>`; }).join("");
}
function renderCategoryList(container, rows) {
  if (!rows.length) { container.innerHTML = `<div class="empty-card">No spending yet. Tap + to add your first expense.</div>`; return; }
  container.innerHTML = rows.map(row => `<div class="category-row"><div class="category-icon" style="background:${row.color || "#9aa3b2"}">${row.icon || "••"}</div><div class="category-main"><div class="row-title">${escapeHtml(row.name)}</div><div class="row-subtitle">${row.count} expense${row.count === 1 ? "" : "s"}</div></div><div class="row-amount">${money(row.amount)}</div></div>`).join("");
}
function byNewest(a, b) { return new Date(`${b.date}T12:00`) - new Date(`${a.date}T12:00`) || b.createdAt - a.createdAt; }
function renderTransactions(container, rows, compact = false) {
  if (!rows.length) { container.innerHTML = `<div class="empty-card">No transactions yet.</div>`; return; }
  container.innerHTML = rows.map(expense => { const category = state.categories.find(c => c.id === expense.categoryId) || { icon: "••", color: "#9aa3b2", name: "Other" }; return `<div class="transaction-row"><div class="category-icon" style="background:${category.color}">${category.icon}</div><div class="transaction-main"><div class="row-title">${escapeHtml(expense.merchant)}</div><div class="row-subtitle">${escapeHtml(category.name)} · ${escapeHtml(expense.payment || "Card")}</div><div class="transaction-date">${parseDate(expense.date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: compact ? undefined : "numeric" })}${expense.note ? " · " + escapeHtml(expense.note) : ""}</div></div><div class="row-amount">${money(expense.amount)}</div></div>`; }).join("");
}
function renderHistory() {
  const query = $("searchInput").value.trim().toLowerCase(); const cat = $("historyCategoryFilter").value;
  const rows = state.expenses.filter(e => !cat || e.categoryId === cat).filter(e => { if (!query) return true; const category = state.categories.find(c => c.id === e.categoryId)?.name || ""; return [e.merchant, e.note, e.payment, category].join(" ").toLowerCase().includes(query); }).sort(byNewest);
  renderTransactions($("historyList"), rows, false);
}
function renderSettings() {
  $("monthlyBudget").value = state.monthlyBudget; $("budgetStartDay").value = state.budgetStartDay;
  $("categoryEditList").innerHTML = state.categories.map(category => `<div class="category-edit-row"><div>${category.icon} ${escapeHtml(category.name)}</div><button class="ghost-button" type="button" data-delete-category="${category.id}">Remove</button></div>`).join("");
  const filter = $("historyCategoryFilter"); const currentValue = filter.value; filter.innerHTML = `<option value="">All</option>` + state.categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join(""); filter.value = currentValue;
}
function fillCategorySelects() { $("categoryInput").innerHTML = state.categories.map(c => `<option value="${c.id}">${c.icon} ${escapeHtml(c.name)}</option>`).join(""); }
function prepareAddForm() { $("expenseForm").reset(); $("dateInput").value = todayISO(); $("paymentInput").value = "Apple Pay"; fillCategorySelects(); setTimeout(() => $("amountInput").focus(), 120); }

function cleanAmount(value) {
  if (!value) return 0;
  const cleaned = String(value).replace(/[^0-9.\-]/g, "");
  return Number(cleaned || 0);
}
function categoryIdFromParam(value) {
  if (!value) return state.categories[0]?.id;
  const normalised = String(value).trim().toLowerCase();
  const matched = state.categories.find(c => c.name.toLowerCase() === normalised);
  return matched?.id || state.categories[0]?.id;
}
function prefillAddFromParams(params) {
  prepareAddForm();
  const amount = params.get("amount") || params.get("total") || "";
  const merchant = params.get("merchant") || params.get("description") || params.get("name") || "";
  const category = params.get("category") || "";
  const payment = params.get("payment") || "Apple Pay";
  const date = params.get("date") || todayISO();
  const note = params.get("note") || "";

  if (amount) $("amountInput").value = cleanAmount(amount) || "";
  if (merchant) $("merchantInput").value = merchant;
  if (category) $("categoryInput").value = categoryIdFromParam(category);
  if (payment) $("paymentInput").value = payment;
  if (date) $("dateInput").value = date;
  if (note) $("noteInput").value = note;
}
function addExpenseFromParams(params) {
  const amount = cleanAmount(params.get("amount") || params.get("total"));
  const merchant = (params.get("merchant") || params.get("description") || params.get("name") || "Apple Pay transaction").trim();
  if (!amount || amount <= 0) return false;
  const categoryId = categoryIdFromParam(params.get("category"));
  const category = state.categories.find(c => c.id === categoryId) || state.categories[0];
  const expense = {
    id: crypto.randomUUID(),
    amount,
    merchant,
    categoryId: category.id,
    categoryName: category.name,
    payment: params.get("payment") || "Apple Pay",
    date: params.get("date") || todayISO(),
    note: params.get("note") || "Logged from Apple Pay shortcut",
    createdAt: Date.now()
  };
  state.expenses.push(expense);
  saveState();
  renderAll();
  return true;
}
function handleShortcutLink() {
  const params = new URLSearchParams(window.location.search);
  const wantsAdd = params.has("add") || params.has("quickadd") || params.has("save") || params.has("autosave");
  if (!wantsAdd) return;

  const shouldSave = params.has("save") || params.get("autosave") === "1";
  if (shouldSave) {
    const saved = addExpenseFromParams(params);
    route("dashboard");
    showToast(saved ? "Expense saved" : "Enter amount to save");
  } else {
    prefillAddFromParams(params);
    route("add");
  }

  window.history.replaceState({}, document.title, window.location.pathname);
}

function route(name) { document.body.dataset.route = name; document.querySelectorAll(".screen").forEach(screen => screen.classList.remove("is-active")); $(`screen-${name}`).classList.add("is-active"); document.querySelectorAll(".nav-button").forEach(btn => btn.classList.toggle("is-active", btn.dataset.route === name)); window.scrollTo({ top: 0, behavior: "smooth" }); }
function showToast(message) { const toast = $("toast"); toast.textContent = message; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 1900); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch])); }
function download(filename, content, type) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 500); }
function toCsv() { const header = ["date", "amount", "merchant", "category", "payment", "note"]; const lines = state.expenses.sort(byNewest).map(e => { const category = state.categories.find(c => c.id === e.categoryId)?.name || e.categoryName || "Other"; return [e.date, e.amount, e.merchant, category, e.payment, e.note].map(v => `"${String(v ?? "").replaceAll('"', '""')}"`).join(","); }); return [header.join(","), ...lines].join("\n"); }
function wireEvents() {
  document.querySelectorAll("[data-route]").forEach(btn => { btn.addEventListener("click", () => route(btn.dataset.route)); });
  $("openAdd").addEventListener("click", () => { prepareAddForm(); route("add"); });
  $("cancelAdd").addEventListener("click", () => route("dashboard"));
  $("expenseForm").addEventListener("submit", (event) => {
    event.preventDefault(); const category = state.categories.find(c => c.id === $("categoryInput").value) || state.categories[0];
    const expense = { id: crypto.randomUUID(), amount: Number($("amountInput").value), merchant: $("merchantInput").value.trim(), categoryId: category.id, categoryName: category.name, payment: $("paymentInput").value, date: $("dateInput").value, note: $("noteInput").value.trim(), createdAt: Date.now() };
    if (!expense.amount || expense.amount <= 0 || !expense.merchant) { showToast("Add amount and description"); return; }
    state.expenses.push(expense); saveState(); renderAll(); route("dashboard"); showToast("Expense saved");
  });
  $("analyticsSort").addEventListener("change", renderAnalytics); $("searchInput").addEventListener("input", renderHistory); $("historyCategoryFilter").addEventListener("change", renderHistory);
  $("saveSettings").addEventListener("click", () => { state.monthlyBudget = Number($("monthlyBudget").value || 0); state.budgetStartDay = Math.min(Math.max(Number($("budgetStartDay").value || 1), 1), 28); saveState(); renderAll(); showToast("Settings saved"); });
  $("addCategory").addEventListener("click", () => { const name = $("newCategoryName").value.trim(); if (!name) return; const palette = ["#ff6b57", "#55e580", "#ffd166", "#8ea2ff", "#c084fc", "#57d9ff", "#ff9f43", "#9aa3b2"]; state.categories.push({ id: crypto.randomUUID(), name, icon: "●", color: palette[state.categories.length % palette.length] }); $("newCategoryName").value = ""; saveState(); renderAll(); showToast("Category added"); });
  $("categoryEditList").addEventListener("click", (event) => { const id = event.target.dataset.deleteCategory; if (!id) return; const used = state.expenses.some(e => e.categoryId === id); if (used) { showToast("Category has expenses"); return; } state.categories = state.categories.filter(c => c.id !== id); saveState(); renderAll(); });
  $("exportJson").addEventListener("click", () => download(`money-budget-backup-${todayISO()}.json`, JSON.stringify(state, null, 2), "application/json"));
  $("exportCsv").addEventListener("click", () => download(`money-budget-transactions-${todayISO()}.csv`, toCsv(), "text/csv"));
  $("importJson").addEventListener("change", async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const text = await file.text(); const parsed = JSON.parse(text); if (!Array.isArray(parsed.expenses) || !Array.isArray(parsed.categories)) throw new Error("Invalid backup"); state = parsed; saveState(); renderAll(); showToast("Backup imported"); } catch { showToast("Could not import file"); } finally { event.target.value = ""; } });
  $("resetData").addEventListener("click", () => { if (!confirm("Delete all budget data stored in this browser?")) return; localStorage.removeItem(STORAGE_KEY); state = loadState(); renderAll(); route("dashboard"); showToast("Data reset"); });
}
if ("serviceWorker" in navigator) { window.addEventListener("load", () => { navigator.serviceWorker.register("service-worker.js").catch(() => {}); }); }
wireEvents(); fillCategorySelects(); $("dateInput").value = todayISO(); renderAll(); handleShortcutLink();
