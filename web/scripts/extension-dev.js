#!/usr/bin/env node
/**
 * Run GamedIn extension in Chromium with all logs piped to terminal.
 * Use: npm run extension:dev (from web/) or node web/scripts/extension-dev.js
 *
 * Logs from content scripts and background service worker are printed to stdout
 * so Cursor AI can read them when debugging.
 */

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const pathToExtension = path.join(projectRoot, 'extension');
const userDataDir = path.join(projectRoot, '.extension-dev-profile');

const IGNORE_PATTERNS = [
  /Failed to load resource: net::ERR_/,
  /net::ERR_FAILED/,
];

function shouldIgnore(text) {
  return IGNORE_PATTERNS.some((p) => p.test(text));
}

function clearTerminal() {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
  } else {
    console.clear();
  }
}

function formatLog(prefix, msg) {
  const type = msg.type();
  const text = msg.text();
  if (shouldIgnore(text)) return null;
  const tag = type === 'error' ? 'ERROR' : type === 'warning' ? 'WARN' : 'LOG';
  return `[${tag}] ${prefix}: ${text}`;
}

async function main() {
  console.log('[Extension Dev] Launching Chromium with GamedIn extension...');
  console.log('[Extension Dev] (First run? Use: npx playwright install chromium)');
  console.log('[Extension Dev] Extension path:', pathToExtension);
  console.log('[Extension Dev] User data:', userDataDir);
  console.log('---');

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
    sw.on('console', (msg) => {
      const line = formatLog('Background', msg);
      if (line) console.log(line);
    });
    console.log('[Extension Dev] Listening to background service worker logs');
  }

  // Capture page console (content scripts); clear terminal on each page load/refresh
  context.on('page', (page) => {
    page.on('load', () => clearTerminal());
    page.on('console', (msg) => {
      const url = page.url();
      const short = url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40);
      const line = formatLog(`Page:${short}`, msg);
      if (line) console.log(line);
    });
  });

  // Open LinkedIn so the extension runs on a job site
  const page = await context.newPage();
  page.on('load', () => clearTerminal());
  page.on('domcontentloaded', () => clearTerminal());
  await page.goto('https://www.linkedin.com/jobs/', { waitUntil: 'domcontentloaded', timeout: 15000 });

  console.log('---');
  console.log('[Extension Dev] Browser ready. Navigate to Indeed, Glassdoor, etc. as needed.');
  console.log('[Extension Dev] All extension logs will appear here. Ctrl+C to exit.');
  console.log('---');

  // Keep process alive
  await new Promise(() => {});
}

main().catch((err) => {
  console.error('[Extension Dev] Fatal:', err);
  process.exit(1);
});
