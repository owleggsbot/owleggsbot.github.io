#!/usr/bin/env node
/**
 * Capture website screenshots for repos that have a site_url.
 *
 * Usage: node scripts/capture-shots.mjs
 * Expects repos.json to exist.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { chromium } from 'playwright';

const ROOT = process.cwd();
const REPOS_JSON = path.join(ROOT, 'repos.json');
const SHOT_DIR = path.join(ROOT, 'assets', 'shots');

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function safeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function main() {
  await ensureDir(SHOT_DIR);

  const payload = JSON.parse(await fs.readFile(REPOS_JSON, 'utf8'));
  const repos = payload.repos || [];

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });

  let captured = 0;
  for (const r of repos) {
    if (!r.site_url || !r.screenshot_path) continue;

    const outPath = path.join(ROOT, r.screenshot_path);
    const outDir = path.dirname(outPath);
    await ensureDir(outDir);

    // Skip if already present.
    if (await exists(outPath)) continue;

    try {
      await page.goto(r.site_url, { waitUntil: 'networkidle', timeout: 45_000 });
      await page.waitForTimeout(750);
      await page.screenshot({ path: outPath, type: 'jpeg', quality: 80, fullPage: false });
      captured++;
      console.log(`Captured ${r.name} -> ${r.screenshot_path}`);
    } catch (e) {
      console.warn(`Failed ${r.name} (${r.site_url}): ${e?.message || e}`);
    }
  }

  await page.close();
  await browser.close();

  console.log(`Done. New screenshots: ${captured}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
