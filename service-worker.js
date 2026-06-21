const CACHE_NAME = "money-budget-cache-v7-1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css?v=6.0",
  "./app.js?v=6.0",
  "./theme.js?v=6.0",
  "./manifest.json",
  "./service-worker.js",
  "./icon-192.png",
  "./icon-512.png"
];

const BUDGET_PACE_APPEND = String.raw`

(function () {
  if (typeof document === "undefined") return;
  if (typeof state === "undefined" || typeof currentExpenses !== "function" || typeof budgetStatus !== "function") return;

  const style = document.createElement("style");
  style.textContent = `
    .bar-chart {
      height: 216px;
      margin-top: 6px;
      padding: 0;
      border-bottom: 0;
    }
    .pace-chart {
      height: 100%;
      display: grid;
      grid-template-rows: 1fr auto auto;
      gap: 8px;
    }
    .pace-svg {
      width: 100%;
      height: 154px;
      overflow: visible;
    }
    .pace-grid {
      stroke: var(--line);
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
    }
    .pace-budget-line {
      stroke: var(--muted);
      stroke-width: 2;
      stroke-dasharray: 5 7;
      stroke-linecap: round;
      opacity: 0.62;
      vector-effect: non-scaling-stroke;
    }
    .pace-actual-line {
      fill: none;
      stroke: var(--accent);
      stroke-width: 3.5;
      stroke-linecap: round;
      stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
    }
    .pace-area {
      fill: var(--accent-soft);
      opacity: 0.45;
    }
    .pace-dot {
      fill: var(--surface);
      stroke: var(--accent);
      stroke-width: 2.4;
      vector-effect: non-scaling-stroke;
    }
    .pace-dot.current {
      fill: var(--accent);
      stroke: var(--surface);
      stroke-width: 3;
    }
    .pace-end-label {
      fill: var(--text);
      font-size: 11px;
      font-weight: 650;
      text-anchor: end;
    }
    .pace-labels {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      color: var(--muted);
      font-size: 12px;
      font-weight: 520;
      text-align: center;
      margin-top: -3px;
    }
    .pace-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 540;
    }
    .pace-status {
      color: var(--text);
      font-weight: 650;
      white-space: nowrap;
    }
    .pace-legend {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      min-width: 0;
    }
    .pace-legend-item {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
    }
    .pace-swatch {
      width: 16px;
      height: 3px;
      border-radius: 999px;
      background: var(--accent);
    }
    .pace-swatch.expected {
      background: transparent;
      border-top: 2px dashed var(--muted);
      opacity: 0.7;
    }
    @media (max-width: 380px) {
      .bar-chart { height: 208px; }
      .pace-end-label { font-size: 10px; }
      .pace-footer { font-size: 11px; }
    }
  `;
  document.head.appendChild(style);

  function safe(value) {
    if (typeof escapeHtml === "function") return escapeHtml(value);
    return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
  }

  renderWeeklyChart = function renderBudgetPaceChart() {
    const expenses = currentExpenses();
    const status = budgetStatus();
    const { start } = getCurrentMonthPeriod();
    const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === start.getFullYear() && today.getMonth() === start.getMonth();
    const todayDay = isCurrentMonth ? today.getDate() : lastDay;
    const labels = ["1–7", "8–14", "15–21", "22–28", "29+"];
    const dayMarks = [7, 14, 21, 28, lastDay].map(day => Math.min(day, lastDay));
    const currentIndex = Math.min(4, Math.max(0, Math.ceil(Math.min(todayDay, lastDay) / 7) - 1));

    const actual = dayMarks.map(day => {
      const dayEnd = new Date(start.getFullYear(), start.getMonth(), day + 1);
      return expenses
        .filter(expense => parseDate(expense.date) < dayEnd)
        .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    });

    const pace = dayMarks.map(day => Number(state.monthlyBudget || 0) * (day / lastDay));
    const maxValue = Math.max(1, Number(state.monthlyBudget || 0), ...actual, ...pace) * 1.08;
    const width = 320;
    const height = 154;
    const padX = 20;
    const padTop = 14;
    const padBottom = 28;
    const plotHeight = height - padTop - padBottom;
    const step = (width - padX * 2) / (labels.length - 1);
    const baseY = height - padBottom;

    const toPoint = (value, index) => {
      const x = padX + index * step;
      const y = baseY - (value / maxValue) * plotHeight;
      return { x, y, value };
    };

    const actualPoints = actual.map(toPoint);
    const pacePoints = pace.map(toPoint);
    const actualLine = actualPoints.map(point => `${point.x},${point.y}`).join(" ");
    const paceLine = pacePoints.map(point => `${point.x},${point.y}`).join(" ");
    const area = `${padX},${baseY} ${actualLine} ${width - padX},${baseY}`;
    const expectedNow = Number(state.monthlyBudget || 0) * (Math.min(todayDay, lastDay) / lastDay);
    const difference = status.spent - expectedNow;
    const under = difference <= 0;
    const statusText = `${under ? "Under pace" : "Over pace"} by ${money(Math.abs(difference))}`;

    $("weeklyChart").innerHTML = `
      <div class="pace-chart" role="img" aria-label="Budget pace chart. Actual spend ${money(status.spent)} compared with expected pace ${money(expectedNow)}.">
        <svg class="pace-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
          <line class="pace-grid" x1="${padX}" y1="${baseY}" x2="${width - padX}" y2="${baseY}" />
          <line class="pace-grid" x1="${padX}" y1="${padTop + plotHeight / 2}" x2="${width - padX}" y2="${padTop + plotHeight / 2}" opacity="0.45" />
          <polygon class="pace-area" points="${area}" />
          <polyline class="pace-budget-line" points="${paceLine}" />
          <polyline class="pace-actual-line" points="${actualLine}" />
          ${actualPoints.map((point, index) => `<circle class="pace-dot ${index === currentIndex ? "current" : ""}" cx="${point.x}" cy="${point.y}" r="${index === currentIndex ? 4.7 : 3.4}" />`).join("")}
          <text class="pace-end-label" x="${width - padX}" y="${Math.max(12, actualPoints[currentIndex].y - 10)}">${money(actualPoints[currentIndex].value)}</text>
        </svg>
        <div class="pace-labels">${labels.map(label => `<span>${label}</span>`).join("")}</div>
        <div class="pace-footer">
          <div class="pace-legend">
            <span class="pace-legend-item"><span class="pace-swatch"></span>Actual</span>
            <span class="pace-legend-item"><span class="pace-swatch expected"></span>Budget pace</span>
          </div>
          <div class="pace-status">${safe(statusText)}</div>
        </div>
      </div>
    `;
  };

  setTimeout(() => {
    if (typeof renderAnalytics === "function") renderAnalytics();
  }, 0);
})();
`;

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method === "GET" && url.pathname.endsWith("/theme.js")) {
    event.respondWith(
      fetch(event.request)
        .then(response => response.text())
        .then(text => new Response(text + BUDGET_PACE_APPEND, { headers: { "Content-Type": "application/javascript; charset=utf-8" } }))
        .catch(() => caches.match(event.request).then(cached => cached ? cached.text() : "").then(text => new Response(text + BUDGET_PACE_APPEND, { headers: { "Content-Type": "application/javascript; charset=utf-8" } })))
    );
    return;
  }

  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
