# GamedIn Chrome Extension

Zero-effort job application tracking. When you apply on LinkedIn, Indeed, Glassdoor, Greenhouse, or Lever, the extension auto-detects success and grants rewards. **Embedded widget** shows your stats directly on job pages—no separate tab needed.

## Install (Developer Mode)

1. **Build the widget** (from repo root): `cd web && npm run build:widget`
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the `extension` folder in this repo

## How It Works

1. **Job site content script** runs on LinkedIn, Indeed, Glassdoor, Greenhouse, Lever. A MutationObserver watches for apply-success text (e.g. "Application sent", "Thank you").
2. When detected, it extracts job title and company and sends to the extension background.
3. **Background** stores the log in `chrome.storage.local`.
4. **Embedded widget** (floating button on job pages) polls for pending logs, processes them, and shows points, streak, and stats. Click to expand.
5. **Standalone game** (gamedin.app) also receives logs via `content-gamedin.js` when that tab is open.

## Activity Tracking

Tracks LinkedIn activity (aligned with Huntr, JobPilot). Stored in `gamedin.activity`:

| Event | When | Payload |
|-------|------|---------|
| `search` | URL has `keywords` param | keywords, location, geoId |
| `job_viewed` | URL has `currentJobId` | jobId |
| `job_clicked` | User clicks a job card | jobId, title, company |
| `job_list` | Job cards visible in list | count, jobs (title, company, jobId) |

The game fetches activity by dispatching `gamedin-get-activity`; the extension responds with `gamedin-activity` containing `{ activity: [...] }`. Use for game mechanics (e.g. rewarding search, browsing, clicks).

## Supported Origins

The extension injects into the game on:

- `http://localhost/*`, `https://localhost/*`
- `http://127.0.0.1/*`, `https://127.0.0.1/*`
- `*.vercel.app`, `*.netlify.app`

For a custom domain, add it to `manifest.json` under `content_scripts[1].matches` and `host_permissions`.

## Requirements

- Chrome (Manifest V3)
- **Embedded widget**: Stats and rewards appear on job pages. No separate tab needed.
- **Full game**: Open gamedin.app for the full experience, shop, and profile. State is stored in the extension (widget) or localStorage (standalone).
