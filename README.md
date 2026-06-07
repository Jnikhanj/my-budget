# Money Budget Web App v6.0

## Hotfix
- Rebuilt Add Transaction so it is no longer an HTML form.
- Save Transaction is now a direct manual save button.
- The Add screen no longer resets when moving between fields.
- Pressing Enter/Next is intercepted and moves focus instead of submitting/reloading.
- Amount is parsed safely from a text decimal field.
- Amount stays in editor state while moving from Amount to Merchant.
- Categories remain available in Add, Import review, Analytics and Settings.
- Categories remain hidden from Home.
- Storage key unchanged: moneyBudget.v1.

## Design refresh
- Minimal Apple-like interface with system fonts and quieter copy.
- Mono is the default theme, with optional Blue, Slate, Plum, Teal and Coral accents.
- Add Transaction has selectable merchant suggestions and reliable Cancel.
- Category budgets and recurring bills are available in Settings.
- Analytics now includes top category, weekly average, recurring total and category progress.

## Replace on GitHub
Replace:
- index.html
- style.css
- app.js
- theme.js
- manifest.json
- service-worker.js
- README.md
- icon-192.png
- icon-512.png
