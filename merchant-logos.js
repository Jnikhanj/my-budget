(function () {
  if (typeof document === "undefined") return;

  const MERCHANT_LOGO_VERSION = "1.1";

  const merchantLogoRules = [
    { name: "Coles", matches: ["coles", "coles express"], logo: "logos/coles.png" },
    { name: "Kmart", matches: ["kmart"], logo: "logos/kmart.png" },
    { name: "Spotify", matches: ["spotify"], logo: "logos/spotify.png" },
    { name: "Netflix", matches: ["netflix"], logo: "logos/netflix.png" },
    { name: "KFC", matches: ["kfc", "kentucky fried chicken"], logo: "logos/kfc.png" },
    { name: "Hungry Jack's", matches: ["hungry jack", "hungry jacks"], logo: "logos/hungry-jacks.png" },
    { name: "McDonald's", matches: ["mcdonald", "maccas"], logo: "logos/mcdonalds.png" }
  ];

  function normalizeMerchant(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s.'&-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function initialsForMerchant(value) {
    const cleaned = String(value || "Other")
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const words = cleaned.split(" ").filter(Boolean);
    if (!words.length) return "•";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  function getMerchantLogoInfo(merchant) {
    const normalized = normalizeMerchant(merchant);

    const rule = merchantLogoRules.find(item =>
      item.matches.some(match => normalized.includes(normalizeMerchant(match)))
    );

    if (rule) {
      return {
        type: "logo",
        name: rule.name,
        logo: rule.logo,
        initials: initialsForMerchant(rule.name)
      };
    }

    return {
      type: "initials",
      name: merchant || "Other",
      logo: "",
      initials: initialsForMerchant(merchant)
    };
  }

  function escapeValue(value) {
    if (typeof escapeHtml === "function") return escapeHtml(value);
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[ch]));
  }

  function logoMarkup(merchant) {
    const info = getMerchantLogoInfo(merchant);
    const classes = "merchant-logo";

    if (info.type === "logo") {
      return `
        <span class="${classes}" data-logo-for="${escapeValue(info.name)}">
          <img src="${escapeValue(info.logo)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('logo-missing'); this.remove();" />
          <span class="merchant-initials">${escapeValue(info.initials)}</span>
        </span>
      `;
    }

    return `
      <span class="${classes} logo-missing">
        <span class="merchant-initials">${escapeValue(info.initials)}</span>
      </span>
    `;
  }

  function enhanceTransactionRows() {
    const rows = document.querySelectorAll(".transaction-row, .editable-transaction-row, .drill-transaction-row");
    rows.forEach(row => {
      if (row.dataset.logoEnhanced === "true") return;

      const title =
        row.querySelector(".transaction-title") ||
        row.querySelector(".tx-title") ||
        row.querySelector(".drill-merchant") ||
        row.querySelector("strong") ||
        row.querySelector(".merchant-name");

      if (!title) return;

      const merchant = title.textContent.trim();
      row.classList.add("has-merchant-logo");
      row.insertAdjacentHTML("afterbegin", logoMarkup(merchant));
      row.dataset.logoEnhanced = "true";
    });
  }

  const style = document.createElement("style");
  style.textContent = `
    .has-merchant-logo {
      display: grid !important;
      grid-template-columns: 40px minmax(0, 1fr) auto;
      align-items: center;
      column-gap: 10px;
    }

    .merchant-logo {
      width: 36px;
      height: 36px;
      border-radius: 13px;
      display: inline-grid;
      place-items: center;
      background: var(--surface, #fff);
      border: 1px solid var(--line, #e5e5e5);
      box-shadow: 0 4px 12px rgba(0,0,0,0.04);
      overflow: hidden;
      flex: 0 0 auto;
    }

    .merchant-logo img {
      width: 78%;
      height: 78%;
      object-fit: contain;
      display: block;
    }

    .merchant-logo .merchant-initials {
      display: none;
      color: var(--text, #111);
      font-size: 12px;
      font-weight: 750;
      letter-spacing: -0.02em;
    }

    .merchant-logo.logo-missing .merchant-initials {
      display: inline;
    }

    .merchant-logo.logo-missing {
      background: var(--accent-soft, #eef3ff);
      color: var(--accent, #2563eb);
      border-color: transparent;
    }

    @media (max-width: 380px) {
      .has-merchant-logo {
        grid-template-columns: 36px minmax(0, 1fr) auto;
        column-gap: 8px;
      }

      .merchant-logo {
        width: 32px;
        height: 32px;
        border-radius: 11px;
      }
    }
  `;
  document.head.appendChild(style);

  window.getMerchantLogoInfo = getMerchantLogoInfo;
  window.merchantLogoMarkup = logoMarkup;
  window.enhanceMerchantLogos = enhanceTransactionRows;

  function installRenderHooks() {
    const hooks = ["renderAll", "renderHome", "renderTransactions", "renderHistory", "renderAnalytics"];
    hooks.forEach(name => {
      if (typeof window[name] !== "function") return;
      if (window[name].__merchantLogoHooked) return;

      const original = window[name];
      const wrapped = function (...args) {
        const result = original.apply(this, args);
        setTimeout(window.enhanceMerchantLogos, 0);
        return result;
      };
      wrapped.__merchantLogoHooked = true;
      window[name] = wrapped;
    });
  }

  function boot() {
    installRenderHooks();
    window.enhanceMerchantLogos();

    const observer = new MutationObserver(() => window.enhanceMerchantLogos());
    observer.observe(document.body, { childList: true, subtree: true });

    console.info("Merchant logo support loaded", MERCHANT_LOGO_VERSION);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
