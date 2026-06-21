(function () {
  if (typeof document === "undefined") return;
  if (window.__merchantLogoSupportLoaded) return;
  window.__merchantLogoSupportLoaded = true;

  const MERCHANT_LOGO_VERSION = "1.2";

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

    if (!rule) {
      return {
        type: "initials",
        name: merchant || "Other",
        logo: "",
        initials: initialsForMerchant(merchant)
      };
    }

    return {
      type: "logo",
      name: rule.name,
      logo: rule.logo,
      initials: initialsForMerchant(rule.name)
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

  function logoInnerHtml(merchant) {
    const info = getMerchantLogoInfo(merchant);
    const initials = `<span class="merchant-logo-initials">${escapeValue(info.initials)}</span>`;

    if (info.type !== "logo") return initials;

    return `
      <img src="${escapeValue(info.logo)}" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';" />
      ${initials}
    `;
  }

  function enhanceTransactionRow(row) {
    if (!row || row.dataset.logoEnhanced === "true") return;

    const title = row.querySelector(".row-title, .transaction-title, .tx-title, .merchant-name, strong");
    if (!title) return;

    const merchant = title.textContent.trim();
    if (!merchant) return;

    let icon = row.querySelector(".category-icon");
    if (icon) {
      icon.classList.add("merchant-logo-icon");
      icon.innerHTML = logoInnerHtml(merchant);
      row.dataset.logoEnhanced = "true";
      return;
    }

    icon = document.createElement("div");
    icon.className = "category-icon merchant-logo-icon";
    icon.innerHTML = logoInnerHtml(merchant);
    row.insertBefore(icon, row.firstElementChild);
    row.classList.add("merchant-logo-added-column");
    row.dataset.logoEnhanced = "true";
  }

  function enhanceAllRows() {
    document
      .querySelectorAll(".transaction-row, .editable-transaction-row, .drill-transaction-row")
      .forEach(enhanceTransactionRow);
  }

  const style = document.createElement("style");
  style.textContent = `
    .category-icon.merchant-logo-icon {
      background: var(--surface, #fff) !important;
      color: var(--text, #111) !important;
      border: 1px solid var(--line, #e5e5e5) !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.04);
      overflow: hidden;
      padding: 4px;
      display: grid !important;
      place-items: center !important;
    }

    .category-icon.merchant-logo-icon img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }

    .merchant-logo-initials {
      display: none;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1;
    }

    .category-icon.merchant-logo-icon:not(:has(img)) .merchant-logo-initials {
      display: inline;
    }

    .drill-transaction-row.merchant-logo-added-column {
      grid-template-columns: 36px minmax(0, 1fr) auto !important;
    }

    @media (max-width: 380px) {
      .category-icon.merchant-logo-icon {
        padding: 3px;
      }
    }
  `;
  document.head.appendChild(style);

  const originalRenderAll = typeof renderAll === "function" ? renderAll : null;
  const originalRenderHome = typeof renderHome === "function" ? renderHome : null;
  const originalRenderHistory = typeof renderHistory === "function" ? renderHistory : null;
  const originalRenderAnalytics = typeof renderAnalytics === "function" ? renderAnalytics : null;

  if (originalRenderAll) {
    renderAll = function (...args) {
      const result = originalRenderAll.apply(this, args);
      setTimeout(enhanceAllRows, 0);
      return result;
    };
  }

  if (originalRenderHome) {
    renderHome = function (...args) {
      const result = originalRenderHome.apply(this, args);
      setTimeout(enhanceAllRows, 0);
      return result;
    };
  }

  if (originalRenderHistory) {
    renderHistory = function (...args) {
      const result = originalRenderHistory.apply(this, args);
      setTimeout(enhanceAllRows, 0);
      return result;
    };
  }

  if (originalRenderAnalytics) {
    renderAnalytics = function (...args) {
      const result = originalRenderAnalytics.apply(this, args);
      setTimeout(enhanceAllRows, 0);
      return result;
    };
  }

  window.getMerchantLogoInfo = getMerchantLogoInfo;
  window.enhanceMerchantLogos = enhanceAllRows;

  const observer = new MutationObserver(() => enhanceAllRows());
  observer.observe(document.body, { childList: true, subtree: true });

  setTimeout(enhanceAllRows, 0);
  console.info("Merchant logo support loaded", MERCHANT_LOGO_VERSION);
})();
