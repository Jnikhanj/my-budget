let analyticsOpenCategoryId = "";

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
    <div class="line-chart-card" role="img" aria-label="Weekly spending trend: ${escapeHtml(chartLabel)}">
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
  $("budgetMiniPercent").textContent = `${Math.round(status.usedPercent)}%`;
  renderWeeklyChart();
  renderInsights();

  const cats = categoryTotals();
  const sortBy = $("analyticsSort").value;
  if (sortBy === "category") cats.sort((a, b) => a.name.localeCompare(b.name));
  if (sortBy === "count") cats.sort((a, b) => b.count - a.count);

  if (analyticsOpenCategoryId && !cats.some(row => row.id === analyticsOpenCategoryId)) {
    analyticsOpenCategoryId = "";
  }

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
      <button class="category-budget-row category-drill-row ${isOpen ? "is-open" : ""}" type="button" data-analytics-category="${escapeHtml(row.id)}" aria-expanded="${isOpen}">
        <div class="category-icon">${categoryInitial(row.name)}</div>
        <div>
          <div class="row-title">${escapeHtml(row.name)}</div>
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
  const rows = currentExpenses()
    .filter(expense => expense.categoryId === categoryId)
    .sort(byNewest);

  if (!rows.length) return `<div class="category-drilldown"><div class="empty-card">No transactions</div></div>`;

  return `
    <div class="category-drilldown">
      ${rows.map(expense => `
        <div class="drill-transaction-row">
          <div>
            <div class="row-title">${escapeHtml(expense.merchant)}</div>
            <div class="row-subtitle">
              ${parseDate(expense.date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}${expense.note ? ` · ${escapeHtml(expense.note)}` : ""}
            </div>
          </div>
          <div class="row-amount">${money(expense.amount)}</div>
        </div>
      `).join("")}
    </div>
  `;
}

$("analyticsSort")?.addEventListener("change", renderAnalytics);
renderAnalytics();
