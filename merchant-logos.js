(function () {
  if (typeof document === "undefined") return;
  if (window.__merchantLogoSupportLoaded) return;
  window.__merchantLogoSupportLoaded = true;

  const MERCHANT_LOGO_VERSION = "2.0";

  const merchantLogoRules = [
    { name: "Coles", matches: ["coles", "coles express"], logo: "logos/coles.png", domain: "coles.com.au", category: "Groceries" },
    { name: "Woolworths", matches: ["woolworths", "woolies", "woolworth", "ww metro", "woolworths metro"], logo: "logos/woolworths.png", domain: "woolworths.com.au", category: "Groceries" },
    { name: "Kmart", matches: ["kmart"], logo: "logos/kmart.png", domain: "kmart.com.au", category: "Shopping" },
    { name: "Toyota", matches: ["toyota", "toyota finance", "toyota connect"], logo: "logos/toyota.png", domain: "toyota.com.au", category: "Bills" },
    { name: "Spotify", matches: ["spotify"], logo: "logos/spotify.png", domain: "spotify.com", category: "Bills" },
    { name: "Netflix", matches: ["netflix"], logo: "logos/netflix.png", domain: "netflix.com", category: "Bills" },
    { name: "KFC", matches: ["kfc", "kentucky fried chicken"], logo: "logos/kfc.png", domain: "kfc.com.au", category: "Food" },
    { name: "Hungry Jack's", matches: ["hungry jack", "hungry jacks", "hjs", "h js"], logo: "logos/hungry-jacks.png", domain: "hungryjacks.com.au", category: "Food" },
    { name: "McDonald's", matches: ["mcdonald", "maccas"], logo: "logos/mcdonalds.png", domain: "mcdonalds.com.au", category: "Food" },
    { name: "Domino's", matches: ["domino", "dominos", "domino's"], logo: "logos/dominos.svg", domain: "dominos.com.au", category: "Food" },
    ...[
      ["Amazon", "amazon.com.au", "Shopping"], ["Apple", "apple.com", "Bills"],
      ["Disney+", "disneyplus.com", "Bills"], ["YouTube Premium", "youtube.com", "Bills"],
      ["Prime Video", "primevideo.com", "Bills"], ["Microsoft 365", "microsoft.com", "Bills"],
      ["Google One", "one.google.com", "Bills"], ["Adobe", "adobe.com", "Bills"],
      ["Uber", "uber.com", "Other"], ["Uber Eats", "ubereats.com", "Food"],
      ["DoorDash", "doordash.com", "Food"], ["Aldi", "aldi.com.au", "Groceries"],
      ["Costco", "costco.com.au", "Groceries"], ["Big W", "bigw.com.au", "Shopping"],
      ["JB Hi-Fi", "jbhifi.com.au", "Shopping"], ["Telstra", "telstra.com.au", "Bills"],
      ["Optus", "optus.com.au", "Bills"], ["Vodafone", "vodafone.com.au", "Bills"],
      ["Jio", "jio.com", "Bills"], ["Airtel", "airtel.in", "Bills"],
      ["Swiggy", "swiggy.com", "Food"], ["Zomato", "zomato.com", "Food"],
      ["Flipkart", "flipkart.com", "Shopping"], ["Reliance Fresh", "relianceretail.com", "Groceries"],
      ["Hotstar", "hotstar.com", "Bills"], ["Sony LIV", "sonyliv.com", "Bills"]
    ].map(([name, domain, category]) => ({ name, matches: [name.toLowerCase()], logo: "", domain, category }))
  ];

  function normalizeMerchant(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s.'&-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function initialsForMerchant(value) {
    const words = String(value || "Other")
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean);

    if (!words.length) return "•";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
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

  function getMerchantLogoInfo(merchant) {
    const normalized = normalizeMerchant(merchant);
    const rule = merchantLogoRules.find(item =>
      item.matches.some(match => normalized.includes(normalizeMerchant(match)))
    );

    if (!rule) {
      return { type: "initials", name: merchant || "Other", logo: "", initials: initialsForMerchant(merchant) };
    }

    return { type: rule.logo ? "logo" : "initials", name: rule.name, logo: rule.logo, initials: initialsForMerchant(rule.name) };
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

  ["renderAll", "renderHome", "renderHistory", "renderAnalytics"].forEach(name => {
    const original = window[name];
    if (typeof original !== "function") return;

    window[name] = function (...args) {
      const result = original.apply(this, args);
      setTimeout(enhanceAllRows, 0);
      return result;
    };
  });

  window.getMerchantLogoInfo = getMerchantLogoInfo;
  window.enhanceMerchantLogos = enhanceAllRows;
  window.MoneyBrands = Object.freeze({
    all: merchantLogoRules,
    match: value => {
      const normalized = normalizeMerchant(value);
      return merchantLogoRules.find(item => item.matches.some(match => normalized.includes(normalizeMerchant(match))));
    },
    search: value => {
      const normalized = normalizeMerchant(value);
      if (!normalized) return [];
      return merchantLogoRules.filter(item =>
        normalizeMerchant(item.name).includes(normalized) ||
        item.matches.some(match => normalizeMerchant(match).includes(normalized))
      ).slice(0, 6);
    }
  });

  const observer = new MutationObserver(() => enhanceAllRows());
  observer.observe(document.body, { childList: true, subtree: true });

  setTimeout(enhanceAllRows, 0);
  console.info("Merchant logo support loaded", MERCHANT_LOGO_VERSION);
})();
