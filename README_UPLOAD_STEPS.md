# My Budget Merchant Logos - Ready Upload Package

This ZIP is ready to upload into the root of your GitHub repository.

## Upload these into the repo root

- `merchant-logos.js`
- `logos/` folder

The `logos/` folder already includes:

- `coles.png`
- `spotify.png`
- `netflix.png`
- `kmart.png`
- `kfc.png`
- `hungry-jacks.png`
- `mcdonalds.png`

## One required edit in `index.html`

At the bottom of `index.html`, after `theme.js`, add:

```html
<script src="merchant-logos.js?v=1.1"></script>
```

Example:

```html
<script src="app.js?v=8.0"></script>
<script src="theme.js?v=8.0"></script>
<script src="merchant-logos.js?v=1.1"></script>
</body>
</html>
```

## Merchant matching included

The script will show logos for merchant names containing:

- Coles
- Kmart
- Spotify
- Netflix
- KFC
- Kentucky Fried Chicken
- Hungry Jack's / Hungry Jacks
- McDonald's / Maccas

Unknown merchants will still show initials, so the app will not break.

## Important trademark note

These logos may still be protected by trademark. This package is intended for your personal offline/local budget app use.
