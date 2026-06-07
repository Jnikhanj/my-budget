(function () {
  const amountInput = document.getElementById("amountInput");
  const merchantInput = document.getElementById("merchantInput");
  if (!amountInput || !merchantInput) return;

  let lastAmount = "";

  function cleanAmount(value) {
    const cleaned = String(value || "").replace(/,/g, ".").replace(/[^\d.]/g, "");
    const firstDot = cleaned.indexOf(".");
    return firstDot === -1
      ? cleaned
      : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
  }

  function rememberAmount() {
    const cleaned = cleanAmount(amountInput.value);
    if (cleaned) lastAmount = cleaned;
    if (amountInput.value !== cleaned) amountInput.value = cleaned;
  }

  function restoreAmount() {
    if (!amountInput.value && lastAmount) amountInput.value = lastAmount;
  }

  amountInput.addEventListener("input", rememberAmount, true);
  amountInput.addEventListener("change", rememberAmount, true);
  amountInput.addEventListener("blur", () => {
    rememberAmount();
    restoreAmount();
  }, true);

  amountInput.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    restoreAmount();
    merchantInput.focus();
  }, true);

  merchantInput.addEventListener("focus", restoreAmount, true);
  merchantInput.addEventListener("pointerdown", restoreAmount, true);
  merchantInput.addEventListener("touchstart", restoreAmount, true);

  document.addEventListener("click", event => {
    const routeButton = event.target.closest("[data-route='add']");
    if (!routeButton || document.body.dataset.route !== "add") return;
    rememberAmount();
    restoreAmount();
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.getElementById("saveTransaction")?.addEventListener("click", restoreAmount, true);
  document.getElementById("saveTransaction")?.addEventListener("touchend", restoreAmount, true);
})();
