#!/usr/bin/env node
/**
 * Update repos.json (cached GitHub API response) and generate per-project screenshots.
 *
 * Requires env:
 * - GITHUB_TOKEN (or GH_TOKEN)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const OWNER = 'owleggsbot';
const API = 'https://api.github.com';
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

const REPO_ROOT = process.cwd();
const OUT_JSON = path.join(REPO_ROOT, 'repos.json');
const SHOT_DIR = path.join(REPO_ROOT, 'assets', 'shots');

const hostedOverride = {
  clawcities: 'https://clawcities.com/sites/owleggs',
};

function pagesUrlFor(repoName) {
  if (repoName.toLowerCase() === `${OWNER}.github.io`) return `https://${OWNER}.github.io/`;
  return `https://${OWNER}.github.io/${repoName}/`;
}

async function ghJson(url) {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'owleggsbot-homepage-cache',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status} for ${url}: ${text}`);
  }
  return res.json();
}

async function listRepos() {
  // 100 max; enough for now.
  const url = `${API}/users/${OWNER}/repos?per_page=100&sort=pushed`;
  const repos = await ghJson(url);

  return repos
    .filter((r) => !r.private)
    .filter((r) => !r.fork) // hide forks
    .map((r) => {
      const hostedUrl = hostedOverride[r.name] || null;
      const pagesUrl = r.has_pages ? pagesUrlFor(r.name) : null;
      const siteUrl = hostedUrl || pagesUrl || (r.homepage?.trim() ? r.homepage.trim() : null);

      return {
        id: r.id,
        name: r.name,
        full_name: r.full_name,
        html_url: r.html_url,
        description: r.description || '',
        homepage: r.homepage || '',
        has_pages: !!r.has_pages,
        is_template: !!r.is_template,
        archived: !!r.archived,
        disabled: !!r.disabled,
        pushed_at: r.pushed_at,
        updated_at: r.updated_at,
        created_at: r.created_at,
        language: r.language,
        topics: r.topics || [],
        stargazers_count: r.stargazers_count || 0,
        forks_count: r.forks_count || 0,
        open_issues_count: r.open_issues_count || 0,
        license: r.license,

        // computed
        hosted_url: hostedUrl,
        pages_url: pagesUrl,
        site_url: siteUrl,
        screenshot_path: siteUrl ? `assets/shots/${r.name}.jpg` : null,
      };
    });
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function writeJsonPretty(file, obj) {
  await fs.writeFile(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

async function bumpAssetCacheBuster() {
  const indexPath = path.join(REPO_ROOT, 'index.html');
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  let html = await fs.readFile(indexPath, 'utf8');
  html = html.replace(/(styles\.css\?v=)\d+/g, `$1${stamp}`);
  html = html.replace(/(site\.js\?v=)\d+/g, `$1${stamp}`);
  await fs.writeFile(indexPath, html, 'utf8');
}

async function main() {
  await ensureDir(path.join(REPO_ROOT, 'assets'));
  await ensureDir(SHOT_DIR);

  const repos = await listRepos();

  // Report missing descriptions (we still write repos.json; site will display a subtle “Needs description”).
  const missing = repos.filter((r) => !String(r.description || '').trim()).map((r) => r.name);
  if (missing.length) {
    console.warn(`Repos missing description (${missing.length}): ${missing.join(', ')}`);
  }

  await writeJsonPretty(OUT_JSON, {
    generated_at: new Date().toISOString(),
    owner: OWNER,
    repos,
    missing_descriptions: missing,
  });

  await bumpAssetCacheBuster();

  console.log(`Wrote repos.json with ${repos.length} repos.`);
  if (missing.length) console.log(`Missing descriptions: ${missing.join(', ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
