# Money Budget Web App

Private, local-first budget tracker inspired by the screenshots you shared.

## What it does
- Dashboard with monthly spending, remaining budget, progress ring and category breakdown
- Add expense screen
- Analytics screen
- Transaction history with search/filter
- Settings for budget and categories
- Export JSON backup
- Import JSON backup
- Export CSV
- Stores data locally in the browser using localStorage

## Important privacy note
The app has no account, no server, and no subscription. Spending data stays in the browser/device where you use it.

Export a JSON backup regularly, because deleting Safari website data or changing browsers can remove the local data.

## Quick test on Mac
Unzip this folder, then open Terminal in the folder and run:

python3 -m http.server 8080

Open:
http://localhost:8080

## iPhone use
Best free long-term option:
1. Put these files on any free static host you control.
2. Open the site in Safari on iPhone.
3. Share button > Add to Home Screen.

Data still stays on the iPhone browser storage, not on the host.

## Shortcut / Apple Pay idea
A Shortcut can open this app after an Apple Pay transaction, but the web app cannot automatically read Apple Pay details.
Use the Shortcut to open the app, then tap + and enter the expense.
