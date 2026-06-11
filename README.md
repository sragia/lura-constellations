# L'ura Constellation Practice

A browser minigame to practice dodging the **Dark Constellation** mechanic from L'ura Phase 3 (Midnight Falls).

## Play locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages

1. Push this repo to GitHub (repo name should be `lura-constellations`, or update `base` in `vite.config.js`).
2. Go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main` — the workflow deploys automatically.

Live URL: `https://<username>.github.io/lura-constellations/`

## Controls

- **WASD** or arrow keys — move
- **R** — restart after death

## Mechanic timing

- New constellation every **8 seconds**
- **3s** telegraph (blue floor circles + sparkles)
- **2.5s** active (stars + connecting beams — avoid these!)
- Brief gap before the next set
