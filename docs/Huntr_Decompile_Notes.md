# Huntr Decompile Notes

## Attempt (Phase 1)

- **Tool**: `npx webcrack jobParser.bundle.js` – failed (exit code 1, npm cache/permission issues)
- **Bundles**: Huntr uses minified Webpack bundles (jobParser, content, autofill, background). No source maps.
- **Finding**: jobParser.bundle.js exports `uniqueSort` (DOM utility); includes React, Lodash. Site-specific selectors not easily grep-able in minified output.

## Fallback Approach

Proceeding with parsers built from public knowledge:

- **Indeed**: `jobsearch-JobInfoHeader-title`, `companyName`, `jobsearch-ViewJob`
- **Glassdoor**: `jobLink`, `jobEmpolyerName`, `react-job-listing`
- **Greenhouse**: `app-title`, `company-name`, `content` (ATS patterns)
- **Lever**: `posting-headline`, `posting-categories`

Apply-success text patterns per site documented in `extension/parsers/siteRegistry.js`.
