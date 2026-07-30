const STORAGE_KEY = "moneyBudget.v1";
const SUPPORTED_CURRENCIES = ["AUD", "INR"];
const CURRENCY_META = {
  AUD: { locale: "en-AU", symbol: "$", label: "Australian dollar" },
  INR: { locale: "en-IN", symbol: "₹", label: "Indian rupee" }
};
const SUBSCRIPTION_FREQUENCIES = ["weekly", "fortnightly", "monthly", "yearly"];

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
const normalizeCurrency = value => SUPPORTED_CURRENCIES.includes(String(value || "").toUpperCase())
  ? String(value).toUpperCase()
  : "AUD";
const activeCurrency = () => normalizeCurrency(state?.activeCurrency);
const money = (value, currency = activeCurrency()) => new Intl.NumberFormat(CURRENCY_META[normalizeCurrency(currency)].locale, {
  style: "currency",
  currency: normalizeCurrency(currency),
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: Number(value || 0) % 1 === 0 ? 0 : 2
}).format(Number(value || 0));

const localISODate = (date = new Date()) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0")
].join("-");
const todayISO = () => localISODate();
const parseDate = (value) => {
  const [y, m, d] = String(value || todayISO()).split("-").map(Number);
  return new Date(y, m - 1, d);
};

let state = loadState();
let detectedTransactions = [];
let formData = {
  amount: "",
  merchant: "",
  categoryId: "",
  currency: "AUD",
  note: "",
  date: todayISO()
};
let editingSubscriptionId = "";
let subscriptionLogoData = "";
let subscriptionCalendarDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { return normalizeLoadedState(JSON.parse(saved)); } catch {}
  }
  return normalizeLoadedState({
    monthlyBudget: 2800,
    monthlyBudgets: { AUD: 2800, INR: 0 },
    activeCurrency: "AUD",
    categories: categoryDefaults,
    expenses: [],
    categoryBudgets: {},
    recurringBills: [],
    subscriptionReminders: true,
    customBrands: []
  });
}

function normalizeLoadedState(parsed) {
  const categories = ensureCategories(parsed.categories);
  const normalizedActiveCurrency = normalizeCurrency(parsed.activeCurrency);
  const legacyMonthlyBudget = Number(parsed.monthlyBudget ?? 2800);
  const monthlyBudgets = {
    AUD: Number(parsed.monthlyBudgets?.AUD ?? legacyMonthlyBudget),
    INR: Number(parsed.monthlyBudgets?.INR ?? 0)
  };
  const expenses = (parsed.expenses || []).map(expense => {
    const categoryId = expense.categoryId && categories.some(c => c.id === expense.categoryId)
      ? expense.categoryId
      : suggestCategoryForMerchantStatic(expense.merchant, categories);
    return {
      ...expense,
      currency: normalizeCurrency(expense.currency),
      categoryId,
      categoryName: categoryByIdStatic(categoryId, categories)?.name || "Other"
    };
  });

  return {
    monthlyBudget: monthlyBudgets.AUD,
    monthlyBudgets,
    activeCurrency: normalizedActiveCurrency,
    categories,
    expenses,
    categoryBudgets: normalizeCategoryBudgets(parsed.categoryBudgets, categories),
    recurringBills: normalizeRecurringBills(parsed.recurringBills, categories),
    subscriptionReminders: parsed.subscriptionReminders !== false,
    customBrands: Array.isArray(parsed.customBrands) ? parsed.customBrands : []
  };
}

function normalizeCategoryBudgets(existing = {}, categories = []) {
  return categories.reduce((budgets, category) => {
    const value = Number(existing?.[category.id] || 0);
    if (Number.isFinite(value) && value > 0) budgets[category.id] = value;
    return budgets;
  }, {});
}

function normalizeRecurringBills(existing = [], categories = []) {
  return (existing || []).map(bill => {
    const categoryId = bill.categoryId && categories.some(c => c.id === bill.categoryId)
      ? bill.categoryId
      : categories.find(c => c.name === "Bills")?.id || categories[0]?.id;
    const frequency = SUBSCRIPTION_FREQUENCIES.includes(bill.frequency) ? bill.frequency : "monthly";
    const legacyDay = Math.min(31, Math.max(1, Number(bill.day || 1)));
    const fallbackDate = nextCalendarDateForDay(legacyDay);
    return {
      id: bill.id || crypto.randomUUID(),
      name: String(bill.name || "").trim(),
      amount: Number(bill.amount || 0),
      day: legacyDay,
      categoryId,
      currency: normalizeCurrency(bill.currency),
      frequency,
      nextDate: validISODate(bill.nextDate) ? bill.nextDate : fallbackDate,
      active: bill.active !== false,
      note: String(bill.note || "").trim(),
      reminderEnabled: bill.reminderEnabled === true,
      logoData: String(bill.logoData || ""),
      logoSourceUrl: String(bill.logoSourceUrl || ""),
      domain: String(bill.domain || "")
    };
  }).filter(bill => bill.name && bill.amount > 0);
}

function validISODate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) && !Number.isNaN(parseDate(value).getTime());
}

function nextCalendarDateForDay(day, from = new Date()) {
  const year = from.getFullYear();
  const month = from.getMonth();
  const thisMonthDay = Math.min(day, new Date(year, month + 1, 0).getDate());
  let result = new Date(year, month, thisMonthDay);
  if (result < new Date(year, month, from.getDate())) {
    const nextMonthDay = Math.min(day, new Date(year, month + 2, 0).getDate());
    result = new Date(year, month + 1, nextMonthDay);
  }
  return localISODate(result);
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
  window.MoneyPlatform?.syncWidgets?.(widgetSnapshot());
  window.MoneyPlatform?.syncSubscriptionReminders?.((state.recurringBills || []).map(subscription => ({
    ...subscription,
    reminderEnabled: state.subscriptionReminders !== false
  })));
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
  return state.expenses.filter(inCurrentPeriod).filter(expense => normalizeCurrency(expense.currency) === activeCurrency());
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

  const brand = window.MoneyBrands?.match?.(merchant);
  const brandCategory = brand?.category && categoryByName(brand.category);
  if (brandCategory) return brandCategory.id;

  return suggestCategoryForMerchantStatic(merchant, state.categories);
}

function merchantSuggestions(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  const seen = new Map();

  for (const brand of window.MoneyBrands?.search?.(q) || []) {
    seen.set(brand.name.toLowerCase(), {
      merchant: brand.name,
      categoryId: categoryByName(brand.category)?.id || suggestCategoryForMerchantStatic(brand.name, state.categories),
      domain: brand.domain || "",
      logo: brand.logo || ""
    });
  }

  for (const brand of state.customBrands || []) {
    if (String(brand.name || "").toLowerCase().includes(q) && !seen.has(String(brand.name).toLowerCase())) {
      seen.set(String(brand.name).toLowerCase(), brand);
    }
  }

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
  const budget = Number(state.monthlyBudgets?.[activeCurrency()] || 0);
  const left = Math.max(0, budget - spent);
  const usedPercent = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  return { spent, budget, left, usedPercent };
}

function recurringTotal() {
  return activeSubscriptions().reduce((sum, subscription) => sum + monthlyEquivalent(subscription), 0);
}

function activeSubscriptions(currency = activeCurrency()) {
  return (state.recurringBills || []).filter(subscription =>
    subscription.active !== false && normalizeCurrency(subscription.currency) === normalizeCurrency(currency)
  );
}

function monthlyEquivalent(subscription) {
  const amount = Number(subscription?.amount || 0);
  switch (subscription?.frequency) {
    case "weekly": return amount * 52 / 12;
    case "fortnightly": return amount * 26 / 12;
    case "yearly": return amount / 12;
    default: return amount;
  }
}

function addSubscriptionInterval(date, frequency, anchor = date) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (frequency === "weekly") next.setDate(next.getDate() + 7);
  else if (frequency === "fortnightly") next.setDate(next.getDate() + 14);
  else if (frequency === "yearly") {
    const year = next.getFullYear() + 1;
    const month = anchor.getMonth();
    const day = Math.min(anchor.getDate(), new Date(year, month + 1, 0).getDate());
    return new Date(year, month, day);
  } else {
    const target = new Date(next.getFullYear(), next.getMonth() + 1, 1);
    const day = Math.min(anchor.getDate(), new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate());
    return new Date(target.getFullYear(), target.getMonth(), day);
  }
  return next;
}

function nextSubscriptionDate(subscription, from = new Date()) {
  const anchor = parseDate(subscription.nextDate);
  let occurrence = new Date(anchor);
  const boundary = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let guard = 0;
  while (occurrence < boundary && guard < 600) {
    occurrence = addSubscriptionInterval(occurrence, subscription.frequency, anchor);
    guard += 1;
  }
  return occurrence;
}

function subscriptionOccurrencesInMonth(subscription, year, month) {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 1);
  const anchor = parseDate(subscription.nextDate);
  let occurrence = nextSubscriptionDate(subscription, monthStart);
  const rows = [];
  let guard = 0;
  while (occurrence < monthEnd && guard < 62) {
    if (occurrence >= monthStart) rows.push(new Date(occurrence));
    occurrence = addSubscriptionInterval(occurrence, subscription.frequency, anchor);
    guard += 1;
  }
  return rows;
}

function mondayCalendarOffset(date) {
  return (date.getDay() + 6) % 7;
}

function upcomingSubscriptions(limit = 3, currency = activeCurrency()) {
  return activeSubscriptions(currency)
    .map(subscription => ({ ...subscription, occurrence: nextSubscriptionDate(subscription) }))
    .sort((a, b) => a.occurrence - b.occurrence || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function widgetSnapshot() {
  const status = budgetStatus();
  const upcoming = upcomingSubscriptions(4);
  const monthly = activeSubscriptions().reduce((sum, item) => sum + monthlyEquivalent(item), 0);
  return {
    currency: activeCurrency(),
    available: status.left,
    spent: status.spent,
    budget: status.budget,
    usedPercent: Math.round(status.usedPercent),
    subscriptionMonthlyTotal: monthly,
    subscriptionYearlyTotal: monthly * 12,
    upcomingSubscriptions: upcoming.map(item => ({
      id: item.id,
      name: item.name,
      amount: Number(item.amount || 0),
      currency: normalizeCurrency(item.currency),
      date: localISODate(item.occurrence),
      logoData: item.logoData || window.getMerchantLogoInfo?.(item.name)?.logo || ""
    }))
  };
}

function renderAll() {
  renderHome();
  renderHistory();
  renderAnalytics();
  renderSettings();
  renderSubscriptions();
  fillCategorySelects();
  window.MoneyPlatform?.syncWidgets?.(widgetSnapshot());
  window.MoneyPlatform?.syncSubscriptionReminders?.((state.recurringBills || []).map(subscription => ({
    ...subscription,
    reminderEnabled: state.subscriptionReminders !== false
  })));
}

function renderHome() {
  const status = budgetStatus();
  document.querySelectorAll("[data-currency-toggle]").forEach(button => {
    button.textContent = activeCurrency();
    button.setAttribute("aria-label", `Currency: ${CURRENCY_META[activeCurrency()].label}. Tap to switch.`);
  });
  $("leftAmount").textContent = money(status.left);
  $("budgetProgress").style.width = `${status.usedPercent}%`;
  $("summaryLine").textContent = `${money(status.spent)} spent · ${daysLeftInMonth()} days left`;

  const expenses = currentExpenses().sort(byNewest);
  $("homeListTotal").textContent = `${expenses.length} transaction${expenses.length === 1 ? "" : "s"}`;
  renderTransactions($("homeTransactions"), expenses.slice(0, 8));
}

function renderTransactions(container, rows) {
  if (!rows.length) {
    container.innerHTML = `<div class="empty-card">No transactions</div>`;
    return;
  }

  container.innerHTML = rows.map(expense => `
    <div class="transaction-row">
      <div class="category-icon">${merchantInitials(expense.merchant)}</div>
      <div>
        <div class="row-title">${escapeHtml(expense.merchant)}</div>
        <div class="row-subtitle">${parseDate(expense.date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</div>
      </div>
      <div class="row-amount">${money(expense.amount, expense.currency)}</div>
    </div>
  `).join("");
}

function renderHistory() {
  const query = $("searchInput").value.trim().toLowerCase();
  const cat = $("historyCategoryFilter").value;
  const rows = state.expenses
    .filter(e => normalizeCurrency(e.currency) === activeCurrency())
    .filter(e => !cat || e.categoryId === cat)
    .filter(e => {
      if (!query) return true;
      const category = categoryById(e.categoryId)?.name || "";
      return [e.merchant, e.note, category].join(" ").toLowerCase().includes(query);
    })
    .sort(byNewest);
  if (!rows.length) {
    $("historyList").innerHTML = `<div class="empty-card">No transactions</div>`;
    return;
  }
  const groups = new Map();
  for (const expense of rows) {
    const date = parseDate(expense.date);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(expense);
  }
  $("historyList").innerHTML = Array.from(groups.values()).map(group => {
    const month = parseDate(group[0].date).toLocaleDateString("en-AU", { month: "long", year: "numeric" });
    const amount = group.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return `
      <section class="history-month">
        <div class="history-month-heading"><strong>${month}</strong><span>${money(amount)} · ${group.length} transaction${group.length === 1 ? "" : "s"}</span></div>
        ${group.map(expense => `
          <div class="transaction-row editable-transaction-row" data-expense-id="${escapeHtml(expense.id)}">
            <div class="category-icon">${merchantInitials(expense.merchant)}</div>
            <div><div class="row-title">${escapeHtml(expense.merchant)}</div><div class="row-subtitle">${parseDate(expense.date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })} · ${escapeHtml(categoryById(expense.categoryId)?.name || "Other")}</div></div>
            <div class="row-amount">${money(expense.amount, expense.currency)}</div>
          </div>
        `).join("")}
      </section>
    `;
  }).join("");
}

function renderAnalytics() {
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

  $("analyticsCategories").innerHTML = cats.length ? cats.map(row => {
    const budget = Number(state.categoryBudgets?.[row.id] || 0);
    const percent = budget > 0 ? Math.min(100, (row.amount / budget) * 100) : 0;
    const subtitle = budget > 0 ? `${money(row.amount)} of ${money(budget)}` : `${row.count} transaction${row.count === 1 ? "" : "s"}`;
    return `
    <div class="category-budget-row">
      <div class="category-icon">${categoryInitial(row.name)}</div>
      <div>
        <div class="row-title">${escapeHtml(row.name)}</div>
        <div class="row-subtitle">${subtitle}</div>
        ${budget > 0 ? `<div class="mini-progress"><span style="width:${percent}%"></span></div>` : ""}
      </div>
      <div class="row-amount">${money(row.amount)}</div>
    </div>
  `}).join("") : `<div class="empty-card">No category spending</div>`;
}

function categoryInitial(name) {
  return String(name || "?").trim().slice(0, 2).toUpperCase();
}

function renderInsights() {
  const cats = categoryTotals();
  const top = cats[0];
  const weeklyAverage = total() / Math.max(1, Math.ceil(new Date().getDate() / 7));
  const recurring = recurringTotal();
  $("analyticsInsights").innerHTML = [
    { label: "Top category", value: top ? top.name : "None" },
    { label: "Weekly average", value: money(weeklyAverage) },
    { label: "Recurring", value: money(recurring) }
  ].map(item => `
    <div class="insight-item">
      <div class="kicker">${item.label}</div>
      <div>${escapeHtml(item.value)}</div>
    </div>
  `).join("");
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
  $("defaultCurrency").value = activeCurrency();
  $("monthlyBudget").value = state.monthlyBudgets.AUD;
  $("monthlyBudgetInr").value = state.monthlyBudgets.INR;
  $("subscriptionReminders").checked = state.subscriptionReminders !== false;
  $("categoriesSummary").textContent = `${state.categories.length} categories`;
  const limitedCategories = Object.keys(state.categoryBudgets || {}).length;
  $("categoryBudgetsSummary").textContent = limitedCategories ? `${limitedCategories} limit${limitedCategories === 1 ? "" : "s"}` : "No limits";

  $("categoryEditList").innerHTML = state.categories.map(category => `
    <div class="category-edit-row">
      <div>${escapeHtml(category.name)}</div>
      <button class="text-button" type="button" data-delete-category="${category.id}">Remove</button>
    </div>
  `).join("");

  $("categoryBudgetList").innerHTML = state.categories.map(category => `
    <label class="budget-row">
      <span>${escapeHtml(category.name)}</span>
      <input data-category-budget="${category.id}" type="text" inputmode="decimal" placeholder="No limit" value="${state.categoryBudgets?.[category.id] || ""}" />
    </label>
  `).join("");

  const filter = $("historyCategoryFilter");
  const currentValue = filter.value;
  filter.innerHTML = `<option value="">All</option>` + state.categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  filter.value = currentValue;
}

function fillCategorySelects() {
  const options = state.categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  $("categoryInput").innerHTML = options;
  $("subscriptionCategory").innerHTML = options;
}

function frequencyLabel(frequency) {
  return ({
    weekly: "Weekly",
    fortnightly: "Fortnightly",
    monthly: "Monthly",
    yearly: "Yearly"
  })[frequency] || "Monthly";
}

function renderSubscriptions() {
  const subscriptions = activeSubscriptions().sort((a, b) =>
    nextSubscriptionDate(a) - nextSubscriptionDate(b) || a.name.localeCompare(b.name)
  );
  const monthly = subscriptions.reduce((sum, subscription) => sum + monthlyEquivalent(subscription), 0);
  $("subscriptionMonthlyTotal").textContent = money(monthly);
  $("subscriptionYearlyTotal").textContent = money(monthly * 12);
  $("subscriptionCurrencyLabel").textContent = activeCurrency();
  $("subscriptionYearlyCurrencyLabel").textContent = activeCurrency();
  $("subscriptionCount").textContent = `${subscriptions.length} active`;

  $("subscriptionList").innerHTML = subscriptions.length ? subscriptions.map(subscription => {
    const due = nextSubscriptionDate(subscription);
    const days = Math.max(0, Math.round((due - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) / 86400000));
    const logo = subscription.logoData || window.getMerchantLogoInfo?.(subscription.name)?.logo || "";
    return `
      <button class="subscription-row" type="button" data-edit-subscription="${subscription.id}">
        <div class="subscription-mark">${logo ? `<img src="${escapeHtml(logo)}" alt="" />` : escapeHtml(subscription.name.slice(0, 1).toUpperCase())}</div>
        <div>
          <div class="row-title">${escapeHtml(subscription.name)}</div>
          <div class="row-subtitle">${frequencyLabel(subscription.frequency)} · ${days === 0 ? "Today" : `in ${days}d`} · ${due.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</div>
        </div>
        <div class="row-amount">${money(subscription.amount, subscription.currency)}</div>
      </button>
    `;
  }).join("") : `<div class="empty-card">No ${activeCurrency()} subscriptions</div>`;

  renderSubscriptionCalendar();
}

function renderSubscriptionCalendar() {
  const year = subscriptionCalendarDate.getFullYear();
  const month = subscriptionCalendarDate.getMonth();
  const monthName = subscriptionCalendarDate.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
  $("subscriptionCalendarTitle").textContent = monthName;

  const events = new Map();
  for (const subscription of activeSubscriptions()) {
    for (const occurrence of subscriptionOccurrencesInMonth(subscription, year, month)) {
      const day = occurrence.getDate();
      if (!events.has(day)) events.set(day, []);
      events.get(day).push(subscription);
    }
  }

  const firstWeekday = mondayCalendarOffset(new Date(year, month, 1));
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const cells = [];
  for (let index = 0; index < firstWeekday; index += 1) cells.push(`<div class="calendar-day is-empty"></div>`);

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayEvents = events.get(day) || [];
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
    cells.push(`
      <div class="calendar-day ${dayEvents.length ? "has-events" : ""} ${isToday ? "is-today" : ""}">
        <div class="calendar-date">${day}</div>
        <div class="calendar-events">
          ${dayEvents.slice(0, 2).map(subscription => `
            <button type="button" data-edit-subscription="${subscription.id}" title="${escapeHtml(subscription.name)}">
              ${escapeHtml(subscription.name)}
            </button>
          `).join("")}
          ${dayEvents.length > 2 ? `<span>+${dayEvents.length - 2}</span>` : ""}
        </div>
      </div>
    `);
  }
  $("subscriptionCalendarGrid").innerHTML = cells.join("");
}

function openSubscriptionEditor(id = "") {
  editingSubscriptionId = id;
  const subscription = (state.recurringBills || []).find(item => item.id === id);
  $("subscriptionEditorTitle").textContent = subscription ? "Edit subscription" : "New subscription";
  $("subscriptionName").value = subscription?.name || "";
  $("subscriptionAmount").value = subscription?.amount || "";
  $("subscriptionCurrency").value = normalizeCurrency(subscription?.currency || activeCurrency());
  $("subscriptionFrequency").value = subscription?.frequency || "monthly";
  $("subscriptionNextDate").value = subscription?.nextDate || todayISO();
  $("subscriptionCategory").value = subscription?.categoryId || categoryByName("Bills")?.id || state.categories[0]?.id;
  $("subscriptionNote").value = subscription?.note || "";
  $("subscriptionActive").checked = subscription?.active !== false;
  $("subscriptionWebsite").value = subscription?.logoSourceUrl || subscription?.domain || "";
  subscriptionLogoData = subscription?.logoData || window.getMerchantLogoInfo?.(subscription?.name)?.logo || "";
  renderSubscriptionLogoPreview();
  updateSubscriptionMonthlyPreview();
  $("deleteSubscription").hidden = !subscription;
  route("subscription-edit");
}

function saveSubscription() {
  const name = $("subscriptionName").value.trim();
  const amount = parseAmount($("subscriptionAmount").value);
  const nextDate = $("subscriptionNextDate").value;
  if (!name) return showToast("Enter a subscription name");
  if (!amount) return showToast("Enter an amount");
  if (!validISODate(nextDate)) return showToast("Choose the next payment date");

  const categoryId = $("subscriptionCategory").value || categoryByName("Bills")?.id || state.categories[0]?.id;
  const existing = (state.recurringBills || []).find(item => item.id === editingSubscriptionId);
  const record = {
    id: existing?.id || crypto.randomUUID(),
    name,
    amount,
    currency: normalizeCurrency($("subscriptionCurrency").value),
    frequency: SUBSCRIPTION_FREQUENCIES.includes($("subscriptionFrequency").value)
      ? $("subscriptionFrequency").value
      : "monthly",
    nextDate,
    day: parseDate(nextDate).getDate(),
    categoryId,
    active: $("subscriptionActive").checked,
    note: $("subscriptionNote").value.trim(),
    reminderEnabled: state.subscriptionReminders !== false,
    logoData: subscriptionLogoData,
    logoSourceUrl: $("subscriptionWebsite").value.trim(),
    domain: domainFromUrl($("subscriptionWebsite").value)
  };

  if (existing) Object.assign(existing, record);
  else state.recurringBills.push(record);
  const previousBrand = (state.customBrands || []).find(item => item.name.toLowerCase() === name.toLowerCase());
  const customBrand = { name, merchant: name, categoryId, domain: record.domain, logo: record.logoData };
  if (previousBrand) Object.assign(previousBrand, customBrand);
  else state.customBrands.push(customBrand);
  if (state.subscriptionReminders !== false) window.MoneyPlatform?.requestNotificationPermission?.();
  saveState();
  renderAll();
  route("subscriptions");
  showToast(existing ? "Subscription updated" : "Subscription added");
}

function domainFromUrl(value) {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function renderSubscriptionLogoPreview() {
  const preview = $("subscriptionLogoPreview");
  if (!preview) return;
  preview.innerHTML = subscriptionLogoData
    ? `<img src="${escapeHtml(subscriptionLogoData)}" alt="" />`
    : escapeHtml(($("subscriptionName").value || "S").slice(0, 1).toUpperCase());
}

function updateSubscriptionMonthlyPreview() {
  const amount = parseAmount($("subscriptionAmount").value);
  const frequency = $("subscriptionFrequency").value;
  const currency = normalizeCurrency($("subscriptionCurrency").value);
  $("subscriptionMonthlyPreview").textContent = `Monthly equivalent ${money(monthlyEquivalent({ amount, frequency }), currency)}`;
}

async function findSubscriptionLogo() {
  const input = $("subscriptionWebsite").value.trim();
  const domain = domainFromUrl(input);
  if (!domain) return showToast("Enter a company website");
  $("findSubscriptionLogo").disabled = true;
  try {
    const result = await window.MoneyPlatform?.findLogo?.(input);
    subscriptionLogoData = result?.dataUrl || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
    renderSubscriptionLogoPreview();
    showToast("Logo added");
  } catch {
    showToast("Logo could not be found");
  } finally {
    $("findSubscriptionLogo").disabled = false;
  }
}

function readLogoFile(file) {
  if (!file || file.size > 2_000_000) return Promise.reject(new Error("Logo is too large"));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function deleteSubscription() {
  const subscription = (state.recurringBills || []).find(item => item.id === editingSubscriptionId);
  if (!subscription || !confirm(`Delete ${subscription.name}?`)) return;
  state.recurringBills = state.recurringBills.filter(item => item.id !== editingSubscriptionId);
  saveState();
  renderAll();
  route("subscriptions");
  showToast("Subscription deleted");
}

function syncFormToUI() {
  $("amountInput").value = formData.amount;
  $("merchantInput").value = formData.merchant;
  $("noteInput").value = formData.note;
  $("dateInput").value = formData.date;
  $("transactionCurrency").value = normalizeCurrency(formData.currency);
  $("transactionCurrencySymbol").textContent = CURRENCY_META[normalizeCurrency(formData.currency)].symbol;
  if (formData.categoryId) $("categoryInput").value = formData.categoryId;
}

function resetForm() {
  formData = {
    amount: "",
    merchant: "",
    categoryId: "",
    currency: activeCurrency(),
    note: "",
    date: todayISO()
  };
  const other = categoryByName("Other") || state.categories[0];
  if (other) formData.categoryId = other.id;
  syncFormToUI();
  $("merchantSuggestions").classList.remove("show");
}

function openAddEditor() {
  if (document.body.dataset.route === "add") {
    syncAmountFromInput();
    route("add");
    return;
  }

  resetForm();
  route("add");
}

function route(name) {
  document.body.dataset.route = name;
  document.querySelectorAll(".screen").forEach(screen => screen.classList.remove("is-active"));
  $(`screen-${name}`).classList.add("is-active");
  const navRoute = name === "subscription-edit" ? "subscriptions" : ["add", "paste"].includes(name) ? "home" : name;
  document.querySelectorAll(".nav-button").forEach(btn => btn.classList.toggle("is-active", btn.dataset.route === navRoute));
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

function parseAmount(value) {
  const raw = String(value || "").trim();
  const commaAsDecimal = !raw.includes(".") && /,\d{1,2}$/.test(raw);
  const valueText = (commaAsDecimal ? raw.replace(",", ".") : raw.replace(/,/g, "")).replace(/[^\d.]/g, "");
  const firstDot = valueText.indexOf(".");
  const normalized = firstDot === -1
    ? valueText
    : valueText.slice(0, firstDot + 1) + valueText.slice(firstDot + 1).replace(/\./g, "");
  const valueNumber = Number(normalized || 0);
  return Number.isFinite(valueNumber) && valueNumber > 0 ? valueNumber : 0;
}

function cleanAmountInput(value) {
  const raw = String(value || "");
  const commaAsDecimal = !raw.includes(".") && /,\d{1,2}$/.test(raw);
  const cleaned = (commaAsDecimal ? raw.replace(",", ".") : raw.replace(/,/g, "")).replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  return firstDot === -1
    ? cleaned
    : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
}

function syncAmountFromInput() {
  const currentAmount = cleanAmountInput($("amountInput").value);
  if (currentAmount || !formData.amount) formData.amount = currentAmount;
  $("amountInput").value = formData.amount;
}

function amountInputValue() {
  const value = parseAmount(formData.amount);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

let saveInProgress = false;

function saveManualTransaction() {
  if (saveInProgress) return;
  saveInProgress = true;

  try {
    const amount = amountInputValue();
    const merchant = formData.merchant.trim();
    const category = categoryById(formData.categoryId) || categoryByName("Other") || state.categories[0];
    const expense = {
      id: crypto.randomUUID(),
      amount,
      merchant,
      currency: normalizeCurrency(formData.currency),
      categoryId: category.id,
      categoryName: category.name,
      date: formData.date || todayISO(),
      note: formData.note.trim(),
      createdAt: Date.now()
    };

    if (!expense.amount || expense.amount <= 0) {
      showToast("Enter an amount");
      saveInProgress = false;
      return;
    }

    if (!expense.merchant) {
      showToast("Enter a merchant");
      saveInProgress = false;
      return;
    }

    state.expenses.push(expense);
    saveState();
    renderAll();
    resetForm();
    route("home");
    showToast("Saved");
  } finally {
    setTimeout(() => { saveInProgress = false; }, 250);
  }
}

function isAmountLine(line) {
  return /^[-+]?\s*(?:(?:A?\$|₹|Rs\.?|INR)\s*)?\d[\d,]*(?:\.\d{1,2})?\s*$/i.test(line.trim());
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
      return localISODate(new Date(year, month - 1, day));
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
      return localISODate(new Date(year, month, day));
    }
  }

  return "";
}

function shouldIgnoreLine(line) {
  const text = line.trim().toLowerCase();
  return !text || text === "$" || text === "₹" || text === "aud" || text === "inr" || text === "pending" || text === "completed" || text.includes("available balance") || text.includes("balance");
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
          currency: activeCurrency(),
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
          ${state.categories.map(c => `<option value="${c.id}" ${c.id === item.categoryId ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}
        </select>
        <input data-review-field="date" type="date" value="${item.date}" />
      </div>
      <select data-review-field="currency" aria-label="Currency">
        ${SUPPORTED_CURRENCIES.map(currency => `<option value="${currency}" ${currency === normalizeCurrency(item.currency) ? "selected" : ""}>${currency}</option>`).join("")}
      </select>
    </div>
  `).join("");
}

async function download(filename, content, type) {
  if (window.MoneyPlatform?.isNative && window.MoneyPlatform?.exportFile) {
    try {
      const handled = await window.MoneyPlatform.exportFile({ filename, content, type });
      if (handled) return;
    } catch (error) {
      console.error("Native export failed; falling back to browser download.", error);
      showToast("Could not open share sheet");
    }
  }

  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function toCsv() {
  const header = ["date", "amount", "currency", "merchant", "category", "note"];
  const lines = state.expenses.sort(byNewest).map(e => {
    const category = categoryById(e.categoryId)?.name || "Other";
    return [e.date, e.amount, normalizeCurrency(e.currency), e.merchant, category, e.note].map(v => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",");
  });
  return [header.join(","), ...lines].join("\n");
}

async function readFileText(file) {
  if (typeof file?.text === "function") return file.text();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read the selected file."));
    reader.readAsText(file);
  });
}

function wireEvents() {
  const wireNativeDatePicker = input => {
    if (!isNativeRuntime || typeof input?.showPicker !== "function") return;
    input.addEventListener("click", () => {
      try {
        input.showPicker();
      } catch {
        // Android may reject showPicker while the WebView is losing focus.
      }
    });
  };
  wireNativeDatePicker($("dateInput"));
  wireNativeDatePicker($("subscriptionNextDate"));

  document.querySelectorAll(".settings-details > summary").forEach(summary => {
    summary.addEventListener("click", event => {
      event.preventDefault();
      const details = summary.parentElement;
      details.open = !details.open;
    });
  });

  document.querySelectorAll("[data-currency-toggle]").forEach(button => button.addEventListener("click", () => {
    state.activeCurrency = activeCurrency() === "AUD" ? "INR" : "AUD";
    saveState();
    renderAll();
    showToast(`${state.activeCurrency} selected`);
  }));

  document.querySelectorAll("[data-route]").forEach(btn => btn.addEventListener("click", event => {
    event.preventDefault();
    const targetRoute = btn.dataset.route;
    if (targetRoute === "add") {
      if (document.body.dataset.route === "subscriptions") {
        openSubscriptionEditor();
        return;
      }
      openAddEditor();
      return;
    }
    route(targetRoute);
  }));

  $("cancelAdd").addEventListener("click", event => {
    event.preventDefault();
    $("merchantSuggestions").classList.remove("show");
    route("home");
  });

  $("amountInput").addEventListener("input", event => {
    formData.amount = cleanAmountInput(event.target.value);
    if (event.target.value !== formData.amount) event.target.value = formData.amount;
  });
  $("amountInput").addEventListener("change", syncAmountFromInput);
  $("amountInput").addEventListener("blur", syncAmountFromInput);

  $("amountInput").addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    $("merchantInput").focus();
  });

  $("merchantInput").addEventListener("input", event => {
    formData.merchant = event.target.value;
    const suggestions = merchantSuggestions(formData.merchant);
    const cat = suggestCategoryForMerchant(formData.merchant);
    if (cat) {
      $("categoryInput").value = cat;
      formData.categoryId = cat;
    }

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

  function selectMerchantSuggestion(item) {
    if (!item) return;
    formData.merchant = item.dataset.merchant;
    formData.categoryId = item.dataset.category;
    syncFormToUI();
    $("merchantSuggestions").classList.remove("show");
    $("merchantInput").focus();
  }

  $("merchantSuggestions").addEventListener("pointerdown", event => {
    const item = event.target.closest(".suggestion-item");
    if (!item) return;
    event.preventDefault();
    selectMerchantSuggestion(item);
  });

  $("merchantSuggestions").addEventListener("click", event => {
    const item = event.target.closest(".suggestion-item");
    if (!item) return;
    event.preventDefault();
    selectMerchantSuggestion(item);
  });

  $("merchantInput").addEventListener("blur", () => setTimeout(() => $("merchantSuggestions").classList.remove("show"), 180));

  $("categoryInput").addEventListener("change", event => {
    formData.categoryId = event.target.value;
  });

  $("transactionCurrency").addEventListener("change", event => {
    formData.currency = normalizeCurrency(event.target.value);
    $("transactionCurrencySymbol").textContent = CURRENCY_META[formData.currency].symbol;
  });

  $("noteInput").addEventListener("input", event => {
    formData.note = event.target.value;
  });

  $("dateInput").addEventListener("change", event => {
    formData.date = event.target.value;
  });

  $("saveTransaction").addEventListener("click", event => {
    event.preventDefault();
    saveManualTransaction();
  });

  $("pasteInput").addEventListener("input", event => {
    $("detectTransactions").disabled = !event.target.value.trim();
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
      showToast("No valid transactions found");
      return;
    }

    state.expenses.push(...valid.map(t => ({
      id: crypto.randomUUID(),
      amount: Number(t.amount),
      currency: normalizeCurrency(t.currency),
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
    showToast(`${valid.length} saved`);
  });

  $("analyticsSort").addEventListener("change", renderAnalytics);
  $("searchInput").addEventListener("input", renderHistory);
  $("historyCategoryFilter").addEventListener("change", renderHistory);

  const saveMainSettings = () => {
    state.activeCurrency = normalizeCurrency($("defaultCurrency").value);
    state.monthlyBudgets = {
      AUD: Number($("monthlyBudget").value || 0),
      INR: Number($("monthlyBudgetInr").value || 0)
    };
    state.monthlyBudget = state.monthlyBudgets.AUD;
    saveState();
    renderAll();
  };
  $("defaultCurrency").addEventListener("change", saveMainSettings);
  ["monthlyBudget", "monthlyBudgetInr"].forEach(id => $(id).addEventListener("change", saveMainSettings));

  $("saveCategoryBudgets").addEventListener("click", () => {
    state.categoryBudgets = {};
    document.querySelectorAll("[data-category-budget]").forEach(input => {
      const value = parseAmount(input.value);
      if (value > 0) state.categoryBudgets[input.dataset.categoryBudget] = value;
    });
    saveState();
    renderAll();
    showToast("Category budgets saved");
  });

  $("cancelSubscriptionEdit").addEventListener("click", () => route("subscriptions"));
  $("saveSubscription").addEventListener("click", saveSubscription);
  $("deleteSubscription").addEventListener("click", deleteSubscription);
  ["subscriptionAmount", "subscriptionFrequency", "subscriptionCurrency"].forEach(id => {
    $(id).addEventListener("input", updateSubscriptionMonthlyPreview);
    $(id).addEventListener("change", updateSubscriptionMonthlyPreview);
  });
  $("subscriptionName").addEventListener("input", event => {
    const suggestions = merchantSuggestions(event.target.value);
    $("subscriptionSuggestions").innerHTML = suggestions.map(item => `
      <button type="button" class="suggestion-item" data-subscription-brand="${escapeHtml(item.merchant)}" data-category="${item.categoryId || ""}" data-domain="${escapeHtml(item.domain || "")}" data-logo="${escapeHtml(item.logo || "")}">
        <span>${escapeHtml(item.merchant)}</span><span class="suggestion-meta">${escapeHtml(categoryById(item.categoryId)?.name || "")}</span>
      </button>
    `).join("");
    $("subscriptionSuggestions").classList.toggle("show", suggestions.length > 0);
    if (!subscriptionLogoData) renderSubscriptionLogoPreview();
  });
  $("subscriptionSuggestions").addEventListener("pointerdown", event => {
    const item = event.target.closest("[data-subscription-brand]");
    if (!item) return;
    event.preventDefault();
    $("subscriptionName").value = item.dataset.subscriptionBrand;
    if (item.dataset.category) $("subscriptionCategory").value = item.dataset.category;
    if (item.dataset.domain) $("subscriptionWebsite").value = item.dataset.domain;
    subscriptionLogoData = item.dataset.logo || subscriptionLogoData;
    renderSubscriptionLogoPreview();
    $("subscriptionSuggestions").classList.remove("show");
  });
  $("findSubscriptionLogo").addEventListener("click", findSubscriptionLogo);
  $("subscriptionWebsite").addEventListener("paste", () => setTimeout(findSubscriptionLogo, 0));
  $("subscriptionLogoFile").addEventListener("change", async event => {
    try {
      subscriptionLogoData = await readLogoFile(event.target.files?.[0]);
      renderSubscriptionLogoPreview();
    } catch {
      showToast("Choose an image under 2 MB");
    } finally {
      event.target.value = "";
    }
  });
  $("subscriptionReminders").addEventListener("change", event => {
    state.subscriptionReminders = event.target.checked;
    state.recurringBills = (state.recurringBills || []).map(subscription => ({
      ...subscription,
      reminderEnabled: event.target.checked
    }));
    if (event.target.checked) window.MoneyPlatform?.requestNotificationPermission?.();
    saveState();
    showToast(event.target.checked ? "Reminders on" : "Reminders off");
  });
  $("subscriptionList").addEventListener("click", event => {
    const target = event.target.closest("[data-edit-subscription]");
    if (target) openSubscriptionEditor(target.dataset.editSubscription);
  });
  $("subscriptionCalendarGrid").addEventListener("click", event => {
    const target = event.target.closest("[data-edit-subscription]");
    if (target) openSubscriptionEditor(target.dataset.editSubscription);
  });
  $("subscriptionViewToggle").addEventListener("click", event => {
    const button = event.target.closest("[data-subscription-view]");
    if (!button) return;
    document.body.dataset.subscriptionView = button.dataset.subscriptionView;
    document.querySelectorAll("[data-subscription-view]").forEach(item => {
      item.classList.toggle("is-active", item === button);
    });
  });
  $("subscriptionCalendarPrevious").addEventListener("click", () => {
    subscriptionCalendarDate = new Date(subscriptionCalendarDate.getFullYear(), subscriptionCalendarDate.getMonth() - 1, 1);
    renderSubscriptionCalendar();
  });
  $("subscriptionCalendarNext").addEventListener("click", () => {
    subscriptionCalendarDate = new Date(subscriptionCalendarDate.getFullYear(), subscriptionCalendarDate.getMonth() + 1, 1);
    renderSubscriptionCalendar();
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
      showToast("This category is in use");
      return;
    }
    state.categories = state.categories.filter(c => c.id !== id);
    delete state.categoryBudgets[id];
    saveState();
    renderAll();
  });

  $("exportJson").addEventListener("click", () => download(`money-budget-backup-${todayISO()}.json`, JSON.stringify(state, null, 2), "application/json"));

  $("importJson").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      state = normalizeLoadedState(JSON.parse(await readFileText(file)));
      saveState();
      renderAll();
      route("home");
      showToast("Backup imported");
    } catch {
      showToast("Import failed");
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

const isNativeRuntime = Boolean(window.Capacitor?.isNativePlatform?.());

if (!isNativeRuntime && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(() => {}));
}

wireEvents();
fillCategorySelects();
$("dateInput").value = todayISO();
renderAll();

window.MoneyBudget = Object.freeze({
  storageKey: STORAGE_KEY,
  getState: () => JSON.parse(JSON.stringify(state)),
  replaceState: (nextState, { persist = true, render = true } = {}) => {
    state = normalizeLoadedState(nextState || {});
    if (persist) saveState();
    if (render) renderAll();
    return JSON.parse(JSON.stringify(state));
  },
  normalizeLoadedState,
  getCurrentMonthPeriod,
  daysLeftInMonth,
  currentExpenses,
  total,
  categoryTotals,
  budgetStatus,
  activeSubscriptions,
  monthlyEquivalent,
  addSubscriptionInterval,
  nextSubscriptionDate,
  subscriptionOccurrencesInMonth,
  mondayCalendarOffset,
  upcomingSubscriptions,
  widgetSnapshot,
  parseAmount,
  parseDateLine,
  parsePastedTransactions,
  toCsv
});
