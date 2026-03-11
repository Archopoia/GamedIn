# GamedIn Chrome Extension

Zero-effort job application tracking. When you Easy Apply on LinkedIn, the extension auto-detects the success and sends the job to GamedIn—no extra clicks.

## Install (Developer Mode)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension` folder in this repo

## How It Works

1. **LinkedIn content script** runs on `*.linkedin.com`. A MutationObserver watches for the "Application sent" success modal after Easy Apply.
2. When detected, it extracts job title and company from the page and sends to the extension background.
3. **Background** stores the log in `chrome.storage.local`.
4. **Game content script** runs on the GamedIn page (localhost, Vercel, Netlify). When the game loads, it fetches pending logs and dispatches `gamedin-apply-logged` CustomEvents.
5. **Game** listens for the event and grants rewards via `applyLoggedCommand`.

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
- GamedIn game open in a tab (or open it after applying—pending logs are stored until the game loads)
