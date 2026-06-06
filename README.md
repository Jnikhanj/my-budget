# Money Budget Web App v3

Local-first personal budget tracker.

## v3 changes
- Stronger blue/purple background gradient
- Home cumulative spending sparkline in the previously empty area
- Cleaner Home top line: "Total spent in this budget period"
- History and Analytics are now clean tab screens without back buttons or the top account/action bar
- More compact History search/filter row
- Slimmer category and transaction cards
- Analytics graph now uses coloured gradient bars
- Fixed "Spending by category" header alignment
- Add Expense is now a full page instead of a floating modal/bottom sheet
- Add Expense uses a single-column form with full-width Payment and Date fields
- Bottom navigation icons are now consistent line-style icons
- Service worker cache bumped to v3

## Data safety
The storage key is unchanged: moneyBudget.v1

Existing expenses should remain on the same device/browser.

## Update GitHub
Replace these files in your repository:
- index.html
- style.css
- app.js
- manifest.json
- service-worker.js
- icon-192.png
- icon-512.png

After deployment, refresh the iPhone Safari page once or twice. If the Home Screen app still shows the old version, close it from the app switcher and reopen it.
