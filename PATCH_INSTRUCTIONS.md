# My Budget - Updated Minimal Analytics Chart

This package contains the updated chart files for your `Jnikhanj/my-budget` app.

## Files included

1. `budget-pace.js`
   - Replaces the busy budget pace graph with a very minimalist weekly line graph.
   - Shows:
     - one blue weekly spend line
     - small dots
     - week labels
     - a simple "Highest week" summary

2. `service-worker.js`
   - Updates the cache name to `money-budget-cache-v7-3`.
   - Includes `budget-pace.js?v=7.3` in the cached assets.

3. `index-script-snippet.html`
   - Use this to check the bottom of your `index.html`.

## Required index.html change

At the bottom of `index.html`, make sure the scripts look like this:

```html
<script src="app.js?v=7.2"></script>
<script src="theme.js?v=7.2"></script>
<script src="budget-pace.js?v=7.3"></script>
```

The important part is:

```html
<script src="budget-pace.js?v=7.3"></script>
```

## Publishing steps

1. Replace/add `budget-pace.js` in the repo root.
2. Replace `service-worker.js` in the repo root.
3. Update the bottom script line in `index.html` to use `budget-pace.js?v=7.3`.
4. Commit and push to `main`.
5. Wait for GitHub Pages to deploy.
6. Open Safari:
   `https://jnikhanj.github.io/my-budget/?v=73`
7. Pull down to refresh twice.

If the Home Screen app still shows old code, delete the Home Screen app icon and add it again from Safari.
