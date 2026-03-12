# GamedIn Chrome Extension (Widget-Only)

Zero-effort job application tracking. When you apply on LinkedIn, Indeed, Glassdoor, Greenhouse, or Lever, the extension auto-detects success and grants rewards. The full gameplay loop runs inside the embedded extension widget on job pages.

## Install (Developer Mode)

1. Build the widget app bundle from repo root: `cd widget-app && npm run build`
2. Open Chrome and go to `chrome://extensions/`
3. Enable Developer mode (top right)
4. Click Load unpacked
5. Select the `extension` folder in this repo

## How It Works

1. Job-site content scripts run on supported sites and detect apply-success signals.
2. Detected applies (title/company/source) are sent to extension background.
3. Background stores pending logs + page activity in `chrome.storage.local`.
4. Embedded widget on job pages polls storage, processes rewards, and renders arena/run/stats.

## Activity Tracking

Tracks LinkedIn activity (aligned with Huntr, JobPilot). Stored in `gamedin.activity`:

| Event | When | Payload |
|-------|------|---------|
| `search` | URL has `keywords` param | keywords, location, geoId |
| `job_viewed` | URL has `currentJobId` | jobId |
| `job_clicked` | User clicks a job card | jobId, title, company |
| `job_list` | Job cards visible in list | count, jobs (title, company, jobId) |

The widget consumes this activity to drive gameplay pressure/reward mechanics.

## Requirements

- Chrome (Manifest V3)
- Embedded extension widget only (no separate standalone webgame runtime)
