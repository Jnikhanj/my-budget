const STORAGE_KEY = "moneyBudget.v1";
const $ = (id) => document.getElementById(id);

const money = (value) => new Intl.NumberFormat("en-AU", {
  style: "currency", currency: "AUD", maximumFractionDigits: Number(value || 0) % 1 === 0 ? 0 : 2
}).format(Number(value || 0)).replace("A", "");

const todayISO = () => new Date().toISOString().slice(0, 10);
const parseDate = (value) => { const [y, m, d] = String(value).split("-").map(Number); return new Date(y, m - 1, d); };
let state = loadState();
let detectedTransactions = [];

function normalizeLoadedState(parsed) {
  return {
    monthlyBudget: Number(parsed.monthlyBudget ?? 2800),
    expenses: (parsed.expenses ?? []).map(expense => ({
      id: expense.id || crypto.randomUUID(),
      amount: Number(expense.amount || 0),
      merchant: expense.merchant || expense.description || "Transaction",
      date: expense.date || todayISO(),
      note: expense.note || "",
      createdAt: expense.createdAt || Date.now()
    }))
  };
}
function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) { try { return normalizeLoadedState(JSON.parse(saved)); } catch {} }
  return { monthlyBudget: 2800, expenses: [] };
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function getCurrentBudgetPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}
function daysLeft() {
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return Math.max(0, lastDay - today.getDate());
}
function inCurrentPeriod(expense) {
  const { start, end } = getCurrentBudgetPeriod();
  const d = parseDate(expense.date);
  return d >= start && d < end;
}
function currentExpenses() { return state.expenses.filter(inCurrentPeriod); }
function total(expenses = currentExpenses()) { return expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0); }
function budgetStatus() {
  const spent = total();
  const budget = Number(state.monthlyBudget || 0);
  const left = Math.max(0, budget - spent);
  const usedPercent = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  return { spent, budget, left, usedPercent };
}
function merchantInitials(name) {
  const cleaned = String(name || "?").replace(/[^a-z0-9\s]/gi, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map(p => p[0]).join("").toUpperCase();
}
function merchantGroups(expenses = currentExpenses()) {
  const map = new Map();
  for (const expense of expenses) {
    const key = String(expense.merchant || "Transaction").trim().toLowerCase();
    if (!map.has(key)) map.set(key, { merchant: expense.merchant, amount: 0, count: 0 });
    const item = map.get(key);
    item.amount += Number(expense.amount || 0);
    item.count += 1;
  }
  return Array.from(map.values()).sort((a,b) => b.amount - a.amount);
}
function merchantSuggestions(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  const seen = new Map();
  for (const expense of [...state.expenses].reverse()) {
    const merchant = String(expense.merchant || "").trim();
    if (merchant && merchant.toLowerCase().includes(q) && !seen.has(merchant.toLowerCase())) {
      seen.set(merchant.toLowerCase(), merchant);
    }
  }
  return Array.from(seen.values()).slice(0, 5);
}
function renderAll() { renderHome(); renderHistory(); renderAnalytics(); renderSettings(); }
function renderHome() {
  const status = budgetStatus();
  $("leftAmount").textContent = money(status.left);
  $("budgetProgress").style.width = `${status.usedPercent}%`;
  $("summaryLine").textContent = `${money(status.spent)} of ${money(status.budget)} spent · ${daysLeft()} days left`;
  const expenses = currentExpenses().sort(byNewest);
  $("homeListTotal").textContent = `${money(total(expenses))} · ${expenses.length}`;
  renderTransactions($("homeTransactions"), expenses.slice(0, 10));
}
function renderTransactions(container, rows) {
  if (!rows.length) { container.innerHTML = `<div class="empty-card">No transactions yet.</div>`; return; }
  container.innerHTML = rows.map(expense => `
    <div class="transaction-row">
      <div class="merchant-icon">${escapeHtml(merchantInitials(expense.merchant))}</div>
      <div><div class="row-title">${escapeHtml(expense.merchant)}</div><div class="row-subtitle">${parseDate(expense.date).toLocaleDateString("en-AU", {day:"numeric", month:"short", year:"numeric"})}</div></div>
      <div class="row-amount">${money(expense.amount)}</div>
    </div>`).join("");
}
function renderHistory() {
  const query = $("searchInput").value.trim().toLowerCase();
  const rows = state.expenses.filter(e => !query || [e.merchant, e.note].join(" ").toLowerCase().includes(query)).sort(byNewest);
  renderTransactions($("historyList"), rows);
}
function renderAnalytics() {
  const status = budgetStatus();
  $("analyticsSpent").textContent = money(status.spent);
  $("budgetMiniText").textContent = `${money(status.left)} left`;
  $("budgetMiniPercent").textContent = `${Math.round(status.usedPercent)}%`;
  renderWeeklyChart();
  const groups = merchantGroups();
  $("merchantSummary").textContent = `${groups.length}`;
  $("analyticsMerchants").innerHTML = groups.length ? groups.slice(0, 8).map(row => `
    <div class="transaction-row">
      <div class="merchant-icon">${escapeHtml(merchantInitials(row.merchant))}</div>
      <div><div class="row-title">${escapeHtml(row.merchant)}</div><div class="row-subtitle">${row.count} transaction${row.count === 1 ? "" : "s"}</div></div>
      <div class="row-amount">${money(row.amount)}</div>
    </div>`).join("") : `<div class="empty-card">No merchant spending yet.</div>`;
}
function renderWeeklyChart() {
  const expenses = currentExpenses();
  const { start } = getCurrentBudgetPeriod();
  const buckets = [0,0,0,0,0];
  for (const expense of expenses) {
    const idx = Math.min(4, Math.floor((parseDate(expense.date) - start) / (7 * 86400000)));
    if (idx >= 0) buckets[idx] += Number(expense.amount || 0);
  }
  const max = Math.max(1, ...buckets);
  const labels = ["1–7", "8–14", "15–21", "22–28", "29+"];
  $("weeklyChart").innerHTML = buckets.map((v, idx) => `<div class="bar-wrap"><div class="bar" style="height:${Math.max(v ? 8 : 4, (v/max)*110)}px"></div><div>${labels[idx]}</div></div>`).join("");
}
function renderSettings() { $("monthlyBudget").value = state.monthlyBudget; }
function prepareAddForm() {
  $("expenseForm").reset();
  $("dateInput").value = todayISO();
  $("merchantSuggestions").classList.remove("show");
  setTimeout(() => $("amountInput").focus(), 120);
}
function route(name) {
  const previous = document.body.dataset.route;
  document.body.dataset.route = name;
  document.querySelectorAll(".screen").forEach(screen => screen.classList.remove("is-active"));
  $(`screen-${name}`).classList.add("is-active");
  document.querySelectorAll(".nav-button").forEach(btn => btn.classList.toggle("is-active", btn.dataset.route === name));
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (name === "add" && previous !== "add") prepareAddForm();
}
function byNewest(a,b) { return new Date(`${b.date}T12:00`) - new Date(`${a.date}T12:00`) || (b.createdAt || 0) - (a.createdAt || 0); }
function showToast(message) { const toast = $("toast"); toast.textContent = message; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 1900); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch])); }
function isAmountLine(line) { return /^[-+]?\s*(?:A?\$)?\s*\d[\d,]*(?:\.\d{1,2})?\s*$/.test(line.trim()); }
function amountFromLine(line) { const value = Math.abs(Number(line.replace(/[^\d.-]/g, ""))); return Number.isFinite(value) ? value : 0; }
function shouldIgnoreLine(line) { const text = line.trim().toLowerCase(); return !text || text === "$" || text === "aud" || text === "pending" || text === "completed" || text.includes("available balance"); }
function parsePastedTransactions(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => !shouldIgnoreLine(l));
  const results = []; let pendingMerchant = "";
  for (const line of lines) {
    if (isAmountLine(line)) { const amount = amountFromLine(line); if (pendingMerchant && amount > 0) { results.push({ id: crypto.randomUUID(), merchant: pendingMerchant, amount, date: todayISO(), note: "" }); pendingMerchant = ""; } }
    else pendingMerchant = line;
  }
  return results;
}
function renderReview() {
  $("reviewSection").hidden = !detectedTransactions.length;
  $("reviewCount").textContent = `${detectedTransactions.length} detected`;
  $("reviewList").innerHTML = detectedTransactions.map((item, idx) => `
    <div class="review-item" data-review-index="${idx}">
      <div class="review-grid"><input data-review-field="merchant" value="${escapeHtml(item.merchant)}" /><input data-review-field="amount" type="number" step="0.01" min="0" value="${item.amount}" /></div>
      <input data-review-field="date" type="date" value="${item.date}" />
    </div>`).join("");
}
function download(filename, content, type) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 500); }
function toCsv() {
  const header = ["date","amount","merchant","note"];
  const lines = state.expenses.sort(byNewest).map(e => [e.date, e.amount, e.merchant, e.note].map(v => `"${String(v ?? "").replaceAll('"','""')}"`).join(","));
  return [header.join(","), ...lines].join("\n");
}
function saveExpense() {
  const expense = { id: crypto.randomUUID(), amount: Number($("amountInput").value), merchant: $("merchantInput").value.trim(), date: $("dateInput").value, note: $("noteInput").value.trim(), createdAt: Date.now() };
  if (!expense.amount || expense.amount <= 0 || !expense.merchant) { showToast("Add amount and merchant"); return; }
  state.expenses.push(expense); saveState(); renderAll(); route("home"); showToast("Transaction saved");
}
function wireEvents() {
  document.querySelectorAll("[data-route]").forEach(btn => btn.addEventListener("click", () => route(btn.dataset.route)));
  $("merchantInput").addEventListener("input", () => {
    const suggestions = merchantSuggestions($("merchantInput").value);
    if (!suggestions.length) { $("merchantSuggestions").classList.remove("show"); return; }
    $("merchantSuggestions").innerHTML = suggestions.map(merchant => `<button type="button" class="suggestion-item" data-merchant="${escapeHtml(merchant)}"><span>${escapeHtml(merchant)}</span><span class="suggestion-meta">Previous</span></button>`).join("");
    $("merchantSuggestions").classList.add("show");
  });
  $("merchantSuggestions").addEventListener("click", event => { const item = event.target.closest(".suggestion-item"); if (!item) return; $("merchantInput").value = item.dataset.merchant; $("merchantSuggestions").classList.remove("show"); });
  $("merchantInput").addEventListener("blur", () => setTimeout(() => $("merchantSuggestions").classList.remove("show"), 180));
  $("expenseForm").addEventListener("submit", event => { event.preventDefault(); saveExpense(); });
  $("saveExpense").addEventListener("click", saveExpense);
  $("expenseForm").addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    const controls = Array.from($("expenseForm").querySelectorAll("input,textarea")).filter(el => !el.disabled && el.type !== "hidden");
    const current = controls.indexOf(event.target); if (current === -1) return;
    event.preventDefault(); if (current < controls.length - 1) controls[current + 1].focus(); else saveExpense();
  });
  $("detectTransactions").addEventListener("click", () => { detectedTransactions = parsePastedTransactions($("pasteInput").value); renderReview(); showToast(detectedTransactions.length ? `${detectedTransactions.length} detected` : "No transactions detected"); });
  $("reviewList").addEventListener("input", event => { const item = event.target.closest(".review-item"); if (!item) return; const idx = Number(item.dataset.reviewIndex); const field = event.target.dataset.reviewField; if (!field || !detectedTransactions[idx]) return; detectedTransactions[idx][field] = field === "amount" ? Number(event.target.value) : event.target.value; });
  $("saveDetected").addEventListener("click", () => {
    const valid = detectedTransactions.filter(t => t.merchant && Number(t.amount) > 0);
    if (!valid.length) { showToast("Nothing to save"); return; }
    state.expenses.push(...valid.map(t => ({ id: crypto.randomUUID(), amount: Number(t.amount), merchant: String(t.merchant).trim(), date: t.date || todayISO(), note: "", createdAt: Date.now() })));
    detectedTransactions = []; $("pasteInput").value = ""; saveState(); renderAll(); route("home"); showToast(`${valid.length} transactions saved`);
  });
  $("searchInput").addEventListener("input", renderHistory);
  $("saveSettings").addEventListener("click", () => { state.monthlyBudget = Number($("monthlyBudget").value || 0); saveState(); renderAll(); showToast("Settings saved"); });
  $("exportJson").addEventListener("click", () => download(`money-budget-backup-${todayISO()}.json`, JSON.stringify(state, null, 2), "application/json"));
  $("exportCsv").addEventListener("click", () => download(`money-budget-transactions-${todayISO()}.csv`, toCsv(), "text/csv"));
  $("importJson").addEventListener("change", async event => { const file = event.target.files?.[0]; if (!file) return; try { state = normalizeLoadedState(JSON.parse(await file.text())); saveState(); renderAll(); route("home"); showToast("Backup imported"); } catch { showToast("Could not import file"); } finally { event.target.value = ""; } });
  $("resetData").addEventListener("click", () => { if (!confirm("Delete all budget data stored in this browser?")) return; localStorage.removeItem(STORAGE_KEY); state = loadState(); renderAll(); route("home"); showToast("Data reset"); });
}
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(() => {}));
wireEvents(); $("dateInput").value = todayISO(); renderAll();
