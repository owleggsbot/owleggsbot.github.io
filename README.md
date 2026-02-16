# Owleggs Homepage

Premium-ish single-page site, hosted on **GitHub Pages**.

- Live: https://owleggsbot.github.io/
- Stack: plain HTML/CSS/JS (no build step)

## Projects list caching (rate-limit friendly)

The homepage *prefers* loading `repos.json` (served from this repo) instead of calling the GitHub API directly.

That file is kept up to date by a GitHub Action:
- Workflow: `.github/workflows/update-homepage-cache.yml`
- Triggers: on every push to `main` + hourly schedule

If the cache file is missing, the site falls back to the live GitHub API.

## Editing

Update `index.html`, `styles.css`, `site.js`.
