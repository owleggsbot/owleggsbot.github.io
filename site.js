const OWNER = "owleggsbot";
const API = "https://api.github.com";

const $ = (sel) => document.querySelector(sel);
const grid = $("#projectsGrid");
const search = $("#search");
const year = $("#year");

const segBtns = Array.from(document.querySelectorAll(".segBtn"));
let allRepos = [];
let activeFilter = "all";

year.textContent = new Date().getFullYear();

// Simple reveal-on-scroll (no dependencies)
(() => {
  const items = Array.from(document.querySelectorAll("[data-reveal]"));
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) e.target.classList.add("isVisible");
      }
    },
    { threshold: 0.12 }
  );
  items.forEach((el) => io.observe(el));
})();

// Premium hover glow that tracks cursor position on cards.
(() => {
  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (prefersReduced) return;

  document.addEventListener(
    "pointermove",
    (e) => {
      const card = e.target?.closest?.(".card");
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      card.style.setProperty("--mx", `${x}%`);
      card.style.setProperty("--my", `${y}%`);
    },
    { passive: true }
  );
})();

function fmtNumber(n) {
  return Intl.NumberFormat(undefined, { notation: "compact" }).format(n ?? 0);
}

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function pickFeatured(repos) {
  // Lightweight heuristics: pinned not available unauthenticated; use stars + recency.
  return repos
    .filter((r) => !r.fork && !r.archived)
    .sort((a, b) => (b.stargazers_count - a.stargazers_count) || (new Date(b.pushed_at) - new Date(a.pushed_at)))
    .slice(0, 9)
    .map((r) => r.name);
}

function computePagesUrl(repo) {
  // Most repos follow this pattern when Pages is enabled.
  if (!repo?.has_pages) return null;
  if (repo.name.toLowerCase() === `${OWNER}.github.io`) return `https://${OWNER}.github.io/`;
  return `https://${OWNER}.github.io/${repo.name}/`;
}

function repoCard(repo, featuredSet) {
  const topics = (repo.topics || []).slice(0, 4);
  const pagesUrl = repo.pages_url || computePagesUrl(repo);

  // Hosted URL can be provided by cache (hosted_url / site_url) or computed from repo fields.
  const hostedUrl = repo.hosted_url || null;
  const siteUrlFromCache = repo.site_url || null;
  const isTemplate = !!repo.is_template;
  const isFeatured = featuredSet.has(repo.name);

  const badge = repo.archived
    ? "Archived"
    : isTemplate
    ? "Template"
    : isFeatured
    ? "Featured"
    : repo.language || "Repo";

  const safeDesc = (repo.description || "").trim();
  const hasDesc = safeDesc.length > 0;
  const needsDesc = !hasDesc;

  // Thumbnail “screenshot”:
  // Prefer a screenshot of the *product/site* when we have one (Pages or homepage).
  // Use WordPress mShots (no key) for live website thumbnails.
  // Fallback: GitHub’s OpenGraph preview (repo card).
  const siteUrlForShot = siteUrlFromCache || hostedUrl || pagesUrl || repo.homepage || null;
  const mshot = (u) => `https://s.wordpress.com/mshots/v1/${encodeURIComponent(u)}?w=1200&h=630`;
  const ogUrl = `https://opengraph.githubassets.com/${encodeURIComponent(repo.pushed_at || "v1")}/${OWNER}/${repo.name}`;
  const localShot = repo.screenshot_path ? `./${repo.screenshot_path}` : null;
  const thumbUrl = localShot || (siteUrlForShot ? mshot(siteUrlForShot) : ogUrl);

  const tags = [
    repo.language ? `<span class="tag">${repo.language}</span>` : "",
    repo.license?.spdx_id && repo.license.spdx_id !== "NOASSERTION" ? `<span class="tag">${repo.license.spdx_id}</span>` : "",
    repo.stargazers_count ? `<span class="tag">★ ${fmtNumber(repo.stargazers_count)}</span>` : "",
    ...topics.map((t) => `<span class="tag">${t}</span>`),
  ]
    .filter(Boolean)
    .slice(0, 5)
    .join(" ");

  // Make “Site/Homepage” the primary CTA when available.
  const primaryCtaUrl = siteUrlFromCache || hostedUrl || pagesUrl || repo.homepage || repo.html_url;
  const primaryCtaLabel = siteUrlFromCache || hostedUrl || pagesUrl ? "Visit site" : repo.homepage ? "Visit homepage" : "Open repo";

  const actions = [
    `<a class="action primary" href="${primaryCtaUrl}" target="_blank" rel="noreferrer">${primaryCtaLabel}</a>`,
    primaryCtaUrl !== repo.html_url
      ? `<a class="action" href="${repo.html_url}" target="_blank" rel="noreferrer">View Source</a>`
      : "",
    hostedUrl && primaryCtaUrl !== hostedUrl
      ? `<a class="action" href="${hostedUrl}" target="_blank" rel="noreferrer">Hosted</a>`
      : "",
  ].filter(Boolean).join("");

  return `
    <article class="glassCard card" data-name="${repo.name.toLowerCase()}" data-featured="${isFeatured}" data-template="${isTemplate}">
      <a class="thumb" href="${primaryCtaUrl}" target="_blank" rel="noreferrer" aria-label="Open ${repo.name}">
        <img src="${thumbUrl}" alt="${repo.name} preview" loading="lazy" decoding="async" referrerpolicy="no-referrer" />
      </a>
      <div class="cardHead">
        <div>
          <div class="repoName">${repo.name}</div>
          <div class="muted tiny">Updated ${fmtDate(repo.pushed_at)}</div>
        </div>
        <div class="badge">${badge}</div>
      </div>
      ${hasDesc ? `<p class="desc">${escapeHtml(safeDesc)}</p>` : `<p class="desc isMissing">Add a repo description for a better card.</p>`}
      <div class="tags">${tags}</div>
      <div class="actions">${actions}</div>
    </article>
  `;
}

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function applyFilters() {
  const q = (search.value || "").trim().toLowerCase();
  const cards = Array.from(document.querySelectorAll(".card"));

  let shown = 0;
  for (const c of cards) {
    const matchesQ = !q || c.dataset.name.includes(q);
    const matchesFilter =
      activeFilter === "all" ||
      (activeFilter === "featured" && c.dataset.featured === "true") ||
      (activeFilter === "templates" && c.dataset.template === "true");

    const show = matchesQ && matchesFilter;
    c.style.display = show ? "" : "none";
    if (show) shown++;
  }

  if (cards.length && shown === 0) {
    grid.insertAdjacentHTML(
      "beforeend",
      `<div class="glassCard panel" style="grid-column:1/-1; padding:16px">
        <strong>No matches.</strong> Try a different query.
      </div>`
    );
  }
}

function setActiveFilter(f) {
  activeFilter = f;
  for (const b of segBtns) {
    const on = b.dataset.filter === f;
    b.classList.toggle("isActive", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  }
  // Remove any previous no-match panel
  Array.from(grid.querySelectorAll(".panel")).forEach((n) => n.remove());
  applyFilters();
}

segBtns.forEach((b) => b.addEventListener("click", () => setActiveFilter(b.dataset.filter)));
search.addEventListener("input", () => {
  Array.from(grid.querySelectorAll(".panel")).forEach((n) => n.remove());
  applyFilters();
});

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
    },
  });
  // capture rate limit headers (useful if unauth)
  const remaining = res.headers.get("x-ratelimit-remaining");
  const reset = res.headers.get("x-ratelimit-reset");
  if (remaining !== null) {
    const note = $("#rateLimitNote");
    const resetTime = reset ? new Date(Number(reset) * 1000) : null;
    note.textContent = `GitHub API rate-limit remaining: ${remaining}${resetTime ? ` (resets ${resetTime.toLocaleTimeString()})` : ""}`;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function loadProfile() {
  const user = await fetchJson(`${API}/users/${OWNER}`);
  const meta = $("#profileMeta");
  meta.innerHTML = [
    user.location ? `<span class="pill">📍 ${escapeHtml(user.location)}</span>` : "",
    `<span class="pill">@${escapeHtml(user.login)}</span>`,
    user.followers != null ? `<span class="pill">${fmtNumber(user.followers)} followers</span>` : "",
  ].filter(Boolean).join(" ");
}

async function loadRepos() {
  // Prefer cached repos.json to avoid exhausting GitHub API rate limits.
  // Fallback to live GitHub API if the cache is missing.
  let payload;
  try {
    payload = await fetchJson(`./repos.json?v=${Date.now()}`);
    allRepos = payload.repos || [];
  } catch {
    const repos = await fetchJson(`${API}/users/${OWNER}/repos?per_page=100&sort=pushed`);
    allRepos = repos;
  }

  const featuredNames = pickFeatured(allRepos);
  const featuredSet = new Set(featuredNames);

  const totalStars = allRepos.reduce((acc, r) => acc + (r.stargazers_count || 0), 0);
  const latestPush = allRepos.map((r) => r.pushed_at).sort().at(-1);

  $("#statRepos").textContent = String(allRepos.length);
  $("#statStars").textContent = fmtNumber(totalStars);
  $("#statLast").textContent = fmtDate(latestPush);

  grid.innerHTML = allRepos
    .filter((r) => !r.private)
    .filter((r) => !r.fork) // hide forks (e.g., upstream OpenClaw forks)
    .map((r) => repoCard(r, featuredSet))
    .join("");

  applyFilters();
}

(async () => {
  try {
    await Promise.all([loadProfile(), loadRepos()]);
  } catch (e) {
    console.error(e);
    grid.innerHTML = `
      <div class="glassCard panel" style="grid-column:1/-1; padding:16px">
        <strong>Couldn’t load repos right now.</strong>
        <div class="muted tiny" style="margin-top:6px">${escapeHtml(String(e.message || e))}</div>
        <div style="margin-top:10px"><a class="action primary" href="https://github.com/${OWNER}" target="_blank" rel="noreferrer">Open GitHub</a></div>
      </div>`;
  }
})();
