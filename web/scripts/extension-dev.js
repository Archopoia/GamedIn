#!/usr/bin/env node
/**
 * Run GamedIn extension in Chromium.
 * Use: npm run extension:dev (from web/) or node web/scripts/extension-dev.js
 */

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const pathToExtension = path.join(projectRoot, 'extension');
const userDataDir = path.join(projectRoot, '.extension-dev-profile');

function clearTerminal() {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
  }
}

async function main() {
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
    ],
  });

  // Capture service worker (background) console
  let sw = context.serviceWorkers()[0];
  if (!sw) sw = await context.waitForEvent('serviceworker');
  if (sw) {
    sw.on('console', (_msg) => {});
  }

  // Capture page console (content scripts); clear terminal on each page load/refresh
  context.on('page', (page) => {
    page.on('load', () => clearTerminal());
    page.on('console', () => {});
  });

  // Open LinkedIn so the extension runs on a job site
  const page = await context.newPage();
  page.on('load', () => clearTerminal());
  page.on('domcontentloaded', () => clearTerminal());
  await page.goto('https://www.linkedin.com/jobs/', { waitUntil: 'domcontentloaded', timeout: 15000 });

  // Keep process alive
  await new Promise(() => {});
}

main().catch(() => {
  process.exit(1);
});
