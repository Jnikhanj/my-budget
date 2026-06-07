# Money Budget Web App v5.1

Local-first personal budget tracker.

## v5 changes
- Switched to a clean light finance-app design.
- Removed Apple Pay shortcut/deep-link behaviour.
- Removed payment method from Add Transaction and new transaction records.
- Added merchant suggestions while typing.
- Added automatic category suggestion from previous entries and keyword rules.
- Added Paste Transactions screen with review-before-save.
- Kept local storage key unchanged: moneyBudget.v1

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


## v5.1 fixes
- Fixed Add Transaction form resetting while moving between fields on iPhone.
- Removed the top-left settings gear on Home. Settings remains in the bottom navigation.
- Updated days-left calculation to use calendar days from today to the final day of the budget period. If the budget starts on day 1, day 1 shows 29 days left for a 30-day month.
- Made the interface more compact so more fits on screen.
- Hid bottom navigation on Add/Paste screens to prevent accidental resets and reduce clutter.
