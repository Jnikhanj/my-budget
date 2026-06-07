# Money Budget Web App v5.8

## Hotfix
- Rebuilt Add Transaction so it is no longer an HTML form.
- Save Transaction is now a direct manual save button.
- The Add screen no longer resets when moving between fields.
- Pressing Enter/Next is intercepted and moves focus instead of submitting/reloading.
- Amount is parsed safely from a text decimal field.
- Amount stays in editor state while moving from Amount to Merchant.
- Categories remain available in Add, Paste review, Analytics and Settings.
- Categories remain hidden from Home.
- Storage key unchanged: moneyBudget.v1.

## Replace on GitHub
Replace:
- index.html
- style.css
- app.js
- manifest.json
- service-worker.js
- README.md
- icon-192.png
- icon-512.png
