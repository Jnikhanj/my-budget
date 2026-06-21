# Hard Fix: Minimal Analytics Chart

This package replaces the previous layered chart fix with a direct inline fix.

## Replace these files in your repo root

1. `index.html`
2. `service-worker.js`

## Why this version should work

The minimalist chart code is inside `index.html` itself, after `app.js` and `theme.js`.
That means it does not rely on a separate `budget-pace.js` file or old cache references.

The new `service-worker.js` also clears old caches and uses network-first fetching while you are still developing.

## After uploading

1. Commit/push the two files.
2. Wait for GitHub Pages deployment.
3. Open Safari:
   https://jnikhanj.github.io/my-budget/?v=8
4. Pull down to refresh twice.
5. For the Home Screen app, delete the old Home Screen icon and add it again.

That last step is important if iOS keeps the old installed PWA shell.
