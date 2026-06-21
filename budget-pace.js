(function () {
  if (typeof document === "undefined") return;
  if (typeof state === "undefined" || typeof currentExpenses !== "function") return;

  const style = document.createElement("style");
  style.textContent = `
    .bar-chart {
      height: 178px !important;
      margin-top: 14px;
      padding: 0 !important;
      border-bottom: 0 !important;
      display: block !important;
    }
    .minimal-chart {
      height: 100%;
      display: grid;
      grid-template-rows: 1fr auto auto;
      gap: 8px;
    }
    .minimal-svg {
      width: 100%;
      height: 120px;
      overflow: visible;
    }
    .minimal-baseline {
      stroke: var(--line);
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
    }
    .minimal-line {
      fill: none;
      stroke: var(--accent);
      stroke-width: 3.25;
      stroke-linecap: round;
      stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
    }
    .minimal-dot {
      fill: var(--surface);
      stroke: var(--accent);
      stroke-width: 2.5;
      vector-effect: non-scaling-stroke;
    }
    .minimal-dot.peak {
      fill: var(--accent);
      stroke: var(--surface);
      stroke-width: 3;
    }
    .minimal-labels {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      color: var(--muted);
      font-size: 12px;
      font-weight: 520;
      text-align: center;
      margin-top: -4px;
    }
    .minimal-summary {
      color: var(--muted);
      font-size: 12px;
      font-weight: 540;
      line-height: 1.3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .minimal-summary strong {
      color: var(--text);
      font-weight: 650;
    }
    @media (max-width: 380px) {
      .bar-chart { height: 170px !important; }
      .minimal-summary { font-size: 11px; }
    }
  `;
  document.head.appendChild(style);

  window.renderMinimalWeeklyLineChart = function renderMinimalWeeklyLineChart() {
    const expenses = currentExpenses();
    const { start } = getCurrentMonthPeriod();
    const labels = ["1-7", "8-14", "15-21", "22-28", "29+"];
    const buckets = [0, 0, 0, 0, 0];

    for (const expense of expenses) {
      const index = Math.min(4, Math.floor((parseDate(expense.date) - start) / (7 * 86400000)));
      if (index >= 0) buckets[index] += Number(expense.amount || 0);
    }

    const maxValue = Math.max(1, ...buckets);
    const peakIndex = buckets.indexOf(maxValue);
    const width = 320;
    const height = 120;
    const padX = 22;
    const padTop = 12;
    const padBottom = 22;
    const plotHeight = height - padTop - padBottom;
    const step = (width - padX * 2) / (labels.length - 1);
    const baseY = height - padBottom;

    const points = buckets.map((value, index) => {
      const x = padX + index * step;
      const y = baseY - (value / maxValue) * plotHeight;
      return { x, y, value };
    });

    const linePoints = points.map(point => `${point.x},${point.y}`).join(" ");
    const chart = document.getElementById("weeklyChart");
    if (!chart) return;

    chart.innerHTML = `
      <div class="minimal-chart" role="img" aria-label="Weekly spending line chart.">
        <svg class="minimal-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
          <line class="minimal-baseline" x1="${padX}" y1="${baseY}" x2="${width - padX}" y2="${baseY}" />
          <polyline class="minimal-line" points="${linePoints}" />
          ${points.map((point, index) => `<circle class="minimal-dot ${index === peakIndex && point.value > 0 ? "peak" : ""}" cx="${point.x}" cy="${point.y}" r="${index === peakIndex && point.value > 0 ? 4 : 3.2}" />`).join("")}
        </svg>
        <div class="minimal-labels">${labels.map(label => `<span>${label}</span>`).join("")}</div>
        <div class="minimal-summary">Highest week <strong>${labels[peakIndex]}</strong> - <strong>${money(buckets[peakIndex])}</strong></div>
      </div>
    `;
  };

  renderWeeklyChart = window.renderMinimalWeeklyLineChart;

  const previousRenderAnalytics = renderAnalytics;
  renderAnalytics = function renderAnalyticsWithMinimalChart() {
    previousRenderAnalytics();
    window.renderMinimalWeeklyLineChart();
  };

  setTimeout(() => {
    if (typeof renderAnalytics === "function") renderAnalytics();
  }, 0);
})();
