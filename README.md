# Freaks & Geeks — Clark & Angie's Episode Rater

A tiny, dependency-free web app for two people to rate all 18 episodes of
*Freaks and Geeks* together — built to work **fully offline on an airplane**.

## What it does

- **Every episode** (canonical DVD/streaming order) with a synopsis, the
  subplots, and a few fan-favorite moments — plus a real screenshot for each
  (one still per episode, sourced from TMDB and bundled locally).
- **Two ratings per episode** — one for **Clark**, one for **Angie** — on a
  **1–10 scale with half-stars** (tap the left half of a star for `.5`).
- **Shared verdict**: once *both* of you have rated an episode, the app locks
  in a final verdict (the average of your two scores).
- **Two panels** on the Episodes tab: **Unranked** (still needs both ratings)
  and **Ranked** (both rated, sorted best-to-worst).
- **Ranking tab**: a clean leaderboard of every fully-rated episode in order,
  #1 on top.
- **Offline first**: the first time you open it online, a service worker
  downloads the whole app + all 18 screenshots to your device. After that it
  works with no connection. Your ratings are saved in `localStorage`.
- **Installable**: "Add to Home Screen" on your phone for a full-screen,
  app-like experience.

## How to use it

1. Open the page **once while you have internet** (it'll show
   "✓ offline ready" in the top corner when everything is cached).
2. Optionally tap your browser's **Add to Home Screen**.
3. On the plane, open it, browse episodes, and each tap a star rating.
4. When you've both rated one, it drops into the **Ranked** panel and the
   **Ranking** tab — in order.

## Running locally

No build step, no dependencies. Just serve the folder over HTTP (a service
worker requires `http://`/`https://`, not `file://`):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Files

| File | Purpose |
|------|---------|
| `index.html` | App shell |
| `styles.css` | All styling |
| `data.js` | The 18 episodes (synopsis, subplots, moments, still path) |
| `app.js` | Rendering, rating logic, localStorage |
| `sw.js` | Service worker — caches everything for offline use |
| `manifest.webmanifest` | PWA / install metadata |
| `assets/stills/` | One screenshot per episode (bundled for offline) |
| `assets/icon*` | App icons |

Episode screenshots courtesy of [The Movie Database (TMDB)](https://www.themoviedb.org/).
This is a personal, non-commercial fan project.
