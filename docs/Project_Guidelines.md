# GamedIn Project Guidelines

## Mindset: Maximum Opportunity

GamedIn aims to hook directly into job-application activity (searching, parsing, applying) and turn it into in-game resources—**with zero or minimal extra effort from the player**. We align with what the market already proves works: apps like Huntr (250K+ users), LinkedIn Job Application Tracker, JobPilot, and Teal (2M+ members) successfully auto-capture job details from LinkedIn, add overlays/badges, and operate without apparent enforcement. We build toward that same capability.

---

## 1. Core Concept and Inspiration

**Purpose:** Reward real job applications with in-game progress. The more you apply (volume and quality), the more your virtual onsen grows—turning stress into relaxation.

**Genre:** Cozy idle/clicker sim. Runs in a tiny, always-visible window for multitasking with LinkedIn. Passive growth from real effort.

**Inspirations:**
- Maltese's Fluffy Onsen / Rusty's Retirement: Simple management, guests generate resources idly.
- Papers, Please: Quick review mini-games for job "fits."
- Tamagotchi: Minimal fallback (e.g., Career Pet that evolves from applies).

**Key Translation:** Job elements become entertaining—e.g., "3+ years experience" as "purring expertise," salary as "unlimited fish snacks."

**Rewards:** Applies = new guests + Career Zen currency. Quality fits = multipliers. Idle production continues offline.

---

## 2. Gameplay Mechanics and Loop

**Core Loop:**
- Passive onsen management: Place baths, upgrade with Zen.
- Apply on LinkedIn (or Indeed, etc.) → game auto-captures or one-click logs → instant rewards (animal checks in, animations).

**3-Filter Process (Mirroring LinkedIn, Gamified):**
- Search: "Scout Expedition" — quest cards based on profile prefs.
- List Skim: "Guest Teaser Parade" — conveyor of cards with animal types, fit ratings.
- Deep Dive: "Spa Interview" mini-game — review requirements as fun traits; link to real job → apply → confirm for reward.

**Progression:** Volume = growth. Quality = bonuses. Streaks/caps to prevent burnout. Personalization via profile import.

---

## 3. Integration Strategy: What We Can Do

**Market Reality:** Extensions like Huntr, LinkedIn Job Application Tracker, and JobPilot auto-capture job details from LinkedIn, add badges, and track applications. They are in the Chrome Web Store, widely used, and operate without public enforcement. We adopt the same proven patterns.

**Tracking Options (in order of opportunity):**

| Approach | Effort | Status |
|----------|--------|--------|
| **Browser extension** | Zero (auto-detect apply confirmation) | Target. MutationObserver or URL/state detection. |
| **One-click bookmarklet** | One click per apply | Viable. Reads job title/company from page, sends to game. |
| **Manual form** | Full form fill | MVP fallback. |
| **User-pasted data** | Copy + paste | Fallback. |

**Extension Capabilities (aligned with existing apps):**
- Detect apply confirmation (success state, URL change, or DOM signal).
- Read job title and company from the current page for reward context.
- **Activity tracking:** Search keywords, job list, job clicks, job views—same as Huntr/JobPilot.
- Optional: Add subtle badges (e.g., "Logged") on job cards—Huntr and LinkedIn Job Tracker do this.
- Separate game window; no injection of game UI into LinkedIn beyond optional lightweight badges.

**Platform Comparison:**

| Platform | APIs | Integration Depth | Virality |
|----------|------|-------------------|----------|
| **LinkedIn** | Gated (no public job API) | Extension auto-capture works (proven by market). OAuth for profile. | Best: 1.3B members, high sharing. |
| **Indeed** | Open (Job Sync, callbacks) | Full auto-tracking via partnerships. | High job volume, less viral. |
| **Glassdoor** | Limited | Data fetch; read-only. | Smaller. |

**Strategy:** LinkedIn-first for virality and user base; extension for zero/low effort. Indeed later for API-backed automation if desired.

---

## 4. Technical Implementation

**Tools:**
- Engine: Godot or HTML/JS + Phaser (browser).
- Backend: Supabase/Firebase.
- Accounts: Email + LinkedIn OAuth (profile import).

**Extension Architecture:**
- Content script: Observes apply flow, reads job context when user applies.
- Background: Forwards events to game (same-origin or messaging).
- No page modifications beyond optional badges; separate game window for main UI.

**Avoid:** Automated application submission (we never click Apply for the user). Invasive automation. Bulk scraping for resale.

---

## 5. Phased Roadmap

- Manual form for applies (fastest to ship).
- OAuth for profile import.
- Share progress via LinkedIn API for virality.
- Chrome extension: one-click capture of job title/company from current page.
- Or bookmarklet: same capture, one click.
- Game receives data, grants rewards without form fill.
- Extension auto-detects apply confirmation.
- Zero extra effort: apply on LinkedIn → reward granted automatically.

**Phase 4 — Optional Enhancements:**
- Indeed API integration for API-backed tracking.
- Lightweight badges on job cards ("Logged", "Applied").
- Kanban-style pipeline in game.

---

## 6. Guardrails (What We Don't Do)

- **No automated application submission.** We never submit applications on behalf of the user.
- **No bulk scraping for resale.** We capture only what the user is actively viewing/applying to.
- **Transparent data handling.** User knows what we collect; optional analytics.
- **User consent.** Extensions require explicit install; integrations are opt-in.
