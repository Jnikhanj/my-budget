const STORAGE_KEY = "moneyBudget.v1";

const categoryDefaults = [
  { id: "cat_food", name: "Food", icon: "🍴", color: "#f3e5d7" },
  { id: "cat_groceries", name: "Groceries", icon: "🛒", color: "#e0f0df" },
  { id: "cat_fuel", name: "Fuel", icon: "⛽", color: "#fff0bd" },
  { id: "cat_bills", name: "Bills", icon: "📄", color: "#e4e9fb" },
  { id: "cat_shopping", name: "Shopping", icon: "🛍️", color: "#eee2f8" },
  { id: "cat_health", name: "Health", icon: "💊", color: "#dff2f5" },
  { id: "cat_family", name: "Family / India", icon: "🏠", color: "#ffe6d5" },
  { id: "cat_other", name: "Other", icon: "•", color: "#eceef2" }
];

const keywordRules = [
  { words: ["dominos", "dominoes", "hungry", "jacks", "h js", "kfc", "mcdonald", "maccas", "subway", "pizza", "coffee", "cafe", "restaurant", "takeaway"], category: "Food" },
  { words: ["woolworths", "woolies", "coles", "aldi", "iga", "costco", "grocery"], category: "Groceries" },
  { words: ["bp", "shell", "ampol", "caltex", "united", "fuel", "petrol", "servo"], category: "Fuel" },
  { words: ["chemist", "pharmacy", "priceline", "terry white", "health"], category: "Health" },
  { words: ["kmart", "big w", "target", "amazon", "ebay", "shopping"], category: "Shopping" },
  { words: ["netflix", "spotify", "apple", "icloud", "telstra", "optus", "agl", "aurora", "bill"], category: "Bills" }
];

const $ = (id) => document.getElementById(id);
const money = (value) => new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: Number(value || 0) % 1 === 0 ? 0 : 2
}).format(Number(value || 0)).replace("A", "");

const todayISO = () => new Date().toISOString().slice(0, 10);
const parseDate = (value) => {
  const [y, m, d] = String(value || todayISO()).split("-").map(Number);
  return new Date(y, m - 1, d);
};

let state = loadState();
let detectedTransactions = [];

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { return normalizeLoadedState(JSON.parse(saved)); } catch {}
  }
  return normalizeLoadedState({ monthlyBudget: 2800, categories: categoryDefaults, expenses: [] });
}

function normalizeLoadedState(parsed) {
  const categories = ensureCategories(parsed.categories);
  const expenses = (parsed.expenses || []).map(expense => {
    const categoryId = expense.categoryId && categories.some(c => c.id === expense.categoryId)
      ? expense.categoryId
      : suggestCategoryForMerchantStatic(expense.merchant, categories);
    return {
      ...expense,
      categoryId,
      categoryName: categoryByIdStatic(categoryId, categories)?.name || "Other"
    };
  });

  return {
    monthlyBudget: Number(parsed.monthlyBudget ?? 2800),
    categories,
    expenses
  };
}

function ensureCategories(existing = []) {
  const byName = new Map();
  [...categoryDefaults, ...existing].forEach(cat => {
    if (!cat || !cat.name) return;
    byName.set(cat.name.toLowerCase(), {
      id: cat.id || crypto.randomUUID(),
      name: cat.name,
      icon: cat.icon || categoryDefaults.find(c => c.name.toLowerCase() === cat.name.toLowerCase())?.icon || "•",
      color: cat.color || categoryDefaults.find(c => c.name.toLowerCase() === cat.name.toLowerCase())?.color || "#eceef2"
    });
  });
  return Array.from(byName.values());
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getCurrentMonthPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

function daysLeftInMonth() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(0, lastDay - now.getDate());
}

function inCurrentPeriod(expense) {
  const { start, end } = getCurrentMonthPeriod();
  const d = parseDate(expense.date);
  return d >= start && d < end;
}

function currentExpenses() {
  return state.expenses.filter(inCurrentPeriod);
}

function total(expenses = currentExpenses()) {
  return expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
}

function categoryByIdStatic(id, categories) {
  return categories.find(c => c.id === id) || categories.find(c => c.name === "Other") || categories[0];
}

function categoryById(id) {
  return categoryByIdStatic(id, state.categories);
}

function categoryByName(name) {
  return state.categories.find(c => c.name.toLowerCase() === String(name).toLowerCase());
}

function suggestCategoryForMerchantStatic(merchant, categories) {
  const text = String(merchant || "").toLowerCase();
  for (const rule of keywordRules) {
    if (rule.words.some(word => text.includes(word))) {
      return categories.find(c => c.name.toLowerCase() === rule.category.toLowerCase())?.id || categories[0]?.id;
    }
  }
  return categories.find(c => c.name === "Other")?.id || categories[0]?.id;
}

function suggestCategoryForMerchant(merchant) {
  const text = String(merchant || "").toLowerCase();

  const previous = [...state.expenses].reverse().find(expense => String(expense.merchant || "").toLowerCase() === text);
  if (previous?.categoryId) return previous.categoryId;

  return suggestCategoryForMerchantStatic(merchant, state.categories);
}

function merchantSuggestions(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  const seen = new Map();

  for (const expense of [...state.expenses].reverse()) {
    const merchant = String(expense.merchant || "").trim();
    if (!merchant) continue;
    if (merchant.toLowerCase().includes(q) && !seen.has(merchant.toLowerCase())) {
      seen.set(merchant.toLowerCase(), { merchant, categoryId: expense.categoryId });
    }
  }

  keywordRules.flatMap(rule => rule.words).forEach(word => {
    if (word.includes(q) && !seen.has(word)) {
      seen.set(word, { merchant: titleCase(word), categoryId: suggestCategoryForMerchant(word) });
    }
  });

  return Array.from(seen.values()).slice(0, 5);
}

function titleCase(value) {
  return String(value).replace(/\w\S*/g, text => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase());
}

function merchantInitials(merchant) {
  const words = String(merchant || "?").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function categoryTotals(expenses = currentExpenses()) {
  const map = new Map();
  for (const category of state.categories) {
    map.set(category.id, { ...category, amount: 0, count: 0 });
  }
  for (const expense of expenses) {
    const category = categoryById(expense.categoryId);
    const item = map.get(category.id);
    item.amount += Number(expense.amount || 0);
    item.count += 1;
  }
  return Array.from(map.values()).filter(item => item.amount > 0).sort((a, b) => b.amount - a.amount);
}

function budgetStatus() {
  const spent = total();
  const budget = Number(state.monthlyBudget || 0);
  const left = Math.max(0, budget - spent);
  const usedPercent = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  return { spent, budget, left, usedPercent };
}

function renderAll() {
  renderHome();
  renderHistory();
  renderAnalytics();
  renderSettings();
  fillCategorySelects();
}

function renderHome() {
  const status = budgetStatus();
  $("leftAmount").textContent = money(status.left);
  $("budgetProgress").style.width = `${status.usedPercent}%`;
  $("summaryLine").textContent = `${money(status.spent)} of ${money(status.budget)} spent · ${daysLeftInMonth()} days left`;

  const expenses = currentExpenses().sort(byNewest);
  $("homeListTotal").textContent = `${money(total(expenses))} · ${expenses.length} txns`;
  renderTransactions($("homeTransactions"), expenses.slice(0, 8));
}

function renderTransactions(container, rows) {
  if (!rows.length) {
    container.innerHTML = `<div class="empty-card">No transactions yet.</div>`;
    return;
  }

  container.innerHTML = rows.map(expense => `
    <div class="transaction-row">
      <div class="category-icon">${merchantInitials(expense.merchant)}</div>
      <div>
        <div class="row-title">${escapeHtml(expense.merchant)}</div>
        <div class="row-subtitle">${parseDate(expense.date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</div>
      </div>
      <div class="row-amount">${money(expense.amount)}</div>
    </div>
  `).join("");
}

function renderHistory() {
  const query = $("searchInput").value.trim().toLowerCase();
  const cat = $("historyCategoryFilter").value;
  const rows = state.expenses
    .filter(e => !cat || e.categoryId === cat)
    .filter(e => {
      if (!query) return true;
      const category = categoryById(e.categoryId)?.name || "";
      return [e.merchant, e.note, category].join(" ").toLowerCase().includes(query);
    })
    .sort(byNewest);
  renderTransactions($("historyList"), rows);
}

function renderAnalytics() {
  const status = budgetStatus();
  $("analyticsSpent").textContent = money(status.spent);
  $("budgetMiniText").textContent = `${money(status.left)} left`;
  $("budgetMiniPercent").textContent = `${Math.round(status.usedPercent)}%`;
  renderWeeklyChart();

  const cats = categoryTotals();
  const sortBy = $("analyticsSort").value;
  if (sortBy === "category") cats.sort((a, b) => a.name.localeCompare(b.name));
  if (sortBy === "count") cats.sort((a, b) => b.count - a.count);

  $("analyticsCategories").innerHTML = cats.length ? cats.map(row => `
    <div class="transaction-row">
      <div class="category-icon" style="background:${row.color || "#eceef2"}">${row.icon || "•"}</div>
      <div>
        <div class="row-title">${escapeHtml(row.name)}</div>
        <div class="row-subtitle">${row.count} txn${row.count === 1 ? "" : "s"}</div>
      </div>
      <div class="row-amount">${money(row.amount)}</div>
    </div>
  `).join("") : `<div class="empty-card">No category spending yet.</div>`;
}

function renderWeeklyChart() {
  const expenses = currentExpenses();
  const { start } = getCurrentMonthPeriod();
  const buckets = [0, 0, 0, 0, 0];
  for (const expense of expenses) {
    const idx = Math.min(4, Math.floor((parseDate(expense.date) - start) / (7 * 86400000)));
    if (idx >= 0) buckets[idx] += Number(expense.amount || 0);
  }
  const max = Math.max(1, ...buckets);
  const labels = ["1–7", "8–14", "15–21", "22–28", "29+"];
  $("weeklyChart").innerHTML = buckets.map((v, idx) => {
    const h = Math.max(v ? 8 : 4, (v / max) * 118);
    return `<div class="bar-wrap"><div class="bar" style="height:${h}px"></div><div>${labels[idx]}</div></div>`;
  }).join("");
}

function renderSettings() {
  $("monthlyBudget").value = state.monthlyBudget;

  $("categoryEditList").innerHTML = state.categories.map(category => `
    <div class="category-edit-row">
      <div>${category.icon} ${escapeHtml(category.name)}</div>
      <button class="text-button" type="button" data-delete-category="${category.id}">Remove</button>
    </div>
  `).join("");

  const filter = $("historyCategoryFilter");
  const currentValue = filter.value;
  filter.innerHTML = `<option value="">All</option>` + state.categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  filter.value = currentValue;
}

function fillCategorySelects() {
  const options = state.categories.map(c => `<option value="${c.id}">${c.icon} ${escapeHtml(c.name)}</option>`).join("");
  $("categoryInput").innerHTML = options;
}

function clearAddEditor() {
  $("amountInput").value = "";
  $("merchantInput").value = "";
  $("noteInput").value = "";
  $("dateInput").value = todayISO();
  fillCategorySelects();
  const other = categoryByName("Other") || state.categories[0];
  if (other) $("categoryInput").value = other.id;
  $("merchantSuggestions").classList.remove("show");
}

function openAddEditor() {
  clearAddEditor();
  route("add");
}

function route(name) {
  document.body.dataset.route = name;
  document.querySelectorAll(".screen").forEach(screen => screen.classList.remove("is-active"));
  $(`screen-${name}`).classList.add("is-active");
  document.querySelectorAll(".nav-button").forEach(btn => btn.classList.toggle("is-active", btn.dataset.route === name));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function byNewest(a, b) {
  return new Date(`${b.date}T12:00`) - new Date(`${a.date}T12:00`) || (b.createdAt || 0) - (a.createdAt || 0);
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1900);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
}


function amountInputValue() {
  const raw = String($("amountInput").value || "").replace(/,/g, ".").replace(/[^\d.]/g, "");
  const parts = raw.split(".");
  const normalised = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : raw;
  const value = Number(normalised);
  return Number.isFinite(value) ? value : 0;
}

let saveInProgress = false;

function saveManualTransaction() {
  if (saveInProgress) return;
  saveInProgress = true;

  try {
    const category = categoryById($("categoryInput").value) || categoryByName("Other") || state.categories[0];
    const expense = {
      id: crypto.randomUUID(),
      amount: amountInputValue(),
      merchant: $("merchantInput").value.trim(),
      categoryId: category.id,
      categoryName: category.name,
      date: $("dateInput").value || todayISO(),
      note: $("noteInput").value.trim(),
      createdAt: Date.now()
    };

    if (!expense.amount || expense.amount <= 0) {
      showToast("Add amount");
      return;
    }

    if (!expense.merchant) {
      showToast("Add merchant");
      return;
    }

    state.expenses.push(expense);
    saveState();
    renderAll();
    clearAddEditor();
    route("home");
    showToast("Transaction saved");
  } finally {
    setTimeout(() => { saveInProgress = false; }, 250);
  }
}

function isAmountLine(line) {
  return /^[-+]?\s*(?:A?\$)?\s*\d[\d,]*(?:\.\d{1,2})?\s*$/.test(line.trim());
}

function amountFromLine(line) {
  const cleaned = line.replace(/[^\d.-]/g, "");
  const value = Math.abs(Number(cleaned));
  return Number.isFinite(value) ? value : 0;
}

function parseDateLine(line) {
  const raw = line.trim();
  const now = new Date();
  const currentYear = now.getFullYear();

  let match = raw.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    let year = match[3] ? Number(match[3]) : currentYear;
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return new Date(year, month - 1, day).toISOString().slice(0, 10);
    }
  }

  match = raw.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*(\d{2,4})?\b/i);
  if (match) {
    const months = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, sept:8, oct:9, nov:10, dec:11 };
    const day = Number(match[1]);
    const month = months[match[2].toLowerCase().slice(0,3)];
    let year = match[3] ? Number(match[3]) : currentYear;
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 0) {
      return new Date(year, month, day).toISOString().slice(0, 10);
    }
  }

  return "";
}

function shouldIgnoreLine(line) {
  const text = line.trim().toLowerCase();
  return !text || text === "$" || text === "aud" || text === "pending" || text === "completed" || text.includes("available balance") || text.includes("balance");
}

function parsePastedTransactions(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => !shouldIgnoreLine(l));
  const results = [];
  let currentDate = todayISO();
  let pendingMerchant = "";

  for (const line of lines) {
    const detectedDate = parseDateLine(line);
    if (detectedDate) {
      currentDate = detectedDate;
      continue;
    }

    if (isAmountLine(line)) {
      const amount = amountFromLine(line);
      if (pendingMerchant && amount > 0) {
        const categoryId = suggestCategoryForMerchant(pendingMerchant);
        results.push({
          id: crypto.randomUUID(),
          merchant: pendingMerchant,
          amount,
          categoryId,
          categoryName: categoryById(categoryId)?.name || "Other",
          date: currentDate,
          note: ""
        });
        pendingMerchant = "";
      }
    } else {
      pendingMerchant = line;
    }
  }

  return results;
}

function renderReview() {
  $("reviewSection").hidden = !detectedTransactions.length;
  $("reviewCount").textContent = `${detectedTransactions.length} detected`;
  $("reviewList").innerHTML = detectedTransactions.map((item, idx) => `
    <div class="review-item" data-review-index="${idx}">
      <div class="review-grid">
        <input data-review-field="merchant" value="${escapeHtml(item.merchant)}" />
        <input data-review-field="amount" type="number" step="0.01" min="0" value="${item.amount}" />
      </div>
      <div class="review-grid">
        <select data-review-field="categoryId">
          ${state.categories.map(c => `<option value="${c.id}" ${c.id === item.categoryId ? "selected" : ""}>${c.icon} ${escapeHtml(c.name)}</option>`).join("")}
        </select>
        <input data-review-field="date" type="date" value="${item.date}" />
      </div>
    </div>
  `).join("");
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
  const header = ["date", "amount", "merchant", "category", "note"];
  const lines = state.expenses.sort(byNewest).map(e => {
    const category = categoryById(e.categoryId)?.name || "Other";
    return [e.date, e.amount, e.merchant, category, e.note].map(v => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",");
  });
  return [header.join(","), ...lines].join("\n");
}

function wireEvents() {
  document.querySelectorAll("[data-route]").forEach(btn => btn.addEventListener("click", event => {
    event.preventDefault();
    const targetRoute = btn.dataset.route;
    if (targetRoute === "add") {
      openAddEditor();
      return;
    }
    route(targetRoute);
  }));

  $("merchantInput").addEventListener("input", () => {
    const suggestions = merchantSuggestions($("merchantInput").value);
    const cat = suggestCategoryForMerchant($("merchantInput").value);
    if (cat) $("categoryInput").value = cat;

    if (!suggestions.length) {
      $("merchantSuggestions").classList.remove("show");
      return;
    }

    $("merchantSuggestions").innerHTML = suggestions.map(item => {
      const category = categoryById(item.categoryId);
      return `<button type="button" class="suggestion-item" data-merchant="${escapeHtml(item.merchant)}" data-category="${item.categoryId}">
        <span>${escapeHtml(item.merchant)}</span>
        <span class="suggestion-meta">${escapeHtml(category?.name || "")}</span>
      </button>`;
    }).join("");
    $("merchantSuggestions").classList.add("show");
  });

  $("merchantSuggestions").addEventListener("click", event => {
    const item = event.target.closest(".suggestion-item");
    if (!item) return;
    $("merchantInput").value = item.dataset.merchant;
    $("categoryInput").value = item.dataset.category;
    $("merchantSuggestions").classList.remove("show");
  });

  $("merchantInput").addEventListener("blur", () => setTimeout(() => $("merchantSuggestions").classList.remove("show"), 180));
  $("saveTransaction").addEventListener("click", event => {
    event.preventDefault();
    saveManualTransaction();
  });

  $("saveTransaction").addEventListener("touchend", event => {
    event.preventDefault();
    saveManualTransaction();
  });

  ["amountInput", "merchantInput", "noteInput"].forEach((id, idx, ids) => {
    $(id).addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (id === "noteInput") {
        $("noteInput").blur();
        return;
      }
      const nextId = ids[idx + 1] || "noteInput";
      $(nextId).focus();
    });
  });

  $("detectTransactions").addEventListener("click", () => {
    detectedTransactions = parsePastedTransactions($("pasteInput").value);
    renderReview();
    showToast(detectedTransactions.length ? `${detectedTransactions.length} detected` : "No transactions detected");
  });

  $("reviewList").addEventListener("input", event => {
    const item = event.target.closest(".review-item");
    if (!item) return;
    const idx = Number(item.dataset.reviewIndex);
    const field = event.target.dataset.reviewField;
    if (!field || !detectedTransactions[idx]) return;
    detectedTransactions[idx][field] = field === "amount" ? Number(event.target.value) : event.target.value;
  });

  $("saveDetected").addEventListener("click", () => {
    const valid = detectedTransactions.filter(t => t.merchant && Number(t.amount) > 0);
    if (!valid.length) {
      showToast("Nothing to save");
      return;
    }

    state.expenses.push(...valid.map(t => ({
      id: crypto.randomUUID(),
      amount: Number(t.amount),
      merchant: String(t.merchant).trim(),
      categoryId: t.categoryId,
      categoryName: categoryById(t.categoryId)?.name || "Other",
      date: t.date || todayISO(),
      note: "",
      createdAt: Date.now()
    })));

    detectedTransactions = [];
    $("pasteInput").value = "";
    saveState();
    renderAll();
    route("home");
    showToast(`${valid.length} transactions saved`);
  });

  $("analyticsSort").addEventListener("change", renderAnalytics);
  $("searchInput").addEventListener("input", renderHistory);
  $("historyCategoryFilter").addEventListener("change", renderHistory);

  $("saveSettings").addEventListener("click", () => {
    state.monthlyBudget = Number($("monthlyBudget").value || 0);
    saveState();
    renderAll();
    showToast("Settings saved");
  });

  $("addCategory").addEventListener("click", () => {
    const name = $("newCategoryName").value.trim();
    if (!name) return;
    const palette = ["#f3e5d7", "#e0f0df", "#fff0bd", "#e4e9fb", "#eee2f8", "#dff2f5", "#ffe6d5", "#eceef2"];
    state.categories.push({ id: crypto.randomUUID(), name, icon: "•", color: palette[state.categories.length % palette.length] });
    $("newCategoryName").value = "";
    saveState();
    renderAll();
    showToast("Category added");
  });

  $("categoryEditList").addEventListener("click", event => {
    const id = event.target.dataset.deleteCategory;
    if (!id) return;
    const used = state.expenses.some(e => e.categoryId === id);
    if (used) {
      showToast("Category has transactions");
      return;
    }
    state.categories = state.categories.filter(c => c.id !== id);
    saveState();
    renderAll();
  });

  $("exportJson").addEventListener("click", () => download(`money-budget-backup-${todayISO()}.json`, JSON.stringify(state, null, 2), "application/json"));
  $("exportCsv").addEventListener("click", () => download(`money-budget-transactions-${todayISO()}.csv`, toCsv(), "text/csv"));

  $("importJson").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      state = normalizeLoadedState(JSON.parse(await file.text()));
      saveState();
      renderAll();
      route("home");
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
    route("home");
    showToast("Data reset");
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(() => {}));
}

wireEvents();
fillCategorySelects();
$("dateInput").value = todayISO();
renderAll();
