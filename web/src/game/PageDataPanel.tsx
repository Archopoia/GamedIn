/**
 * Page Data panel - displays raw page-element metrics captured from job sites.
 * Used to verify we can pull time-on-page, scroll depth, cards in view, etc.
 * No mechanics yet; display only.
 */

export interface PageState {
  site?: string
  timestamp?: number
  receivedAt?: number
  timeOnDetailSec?: number
  currentJobId?: string
  totalTimeOnDetailSec?: number
  timeOnListSec?: number
  tabVisible?: boolean
  scrollDepthPercent?: number
  totalScrollPx?: number
  cardsInViewCount?: number
  cardsInViewIds?: string[]
  lastCardHovered?: { jobId: string; title: string; company: string } | null
  lastCardHoverDurationSec?: number
  cardsScrolledPastCount?: number
  applyBtnInView?: boolean
}

interface PageDataPanelProps {
  pageState: PageState | null
  onRefresh: () => void
}

function formatAge(ts?: number): string {
  if (!ts) return '—'
  const diff = Date.now() - ts
  if (diff < 5000) return 'just now'
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3600_000)}h ago`
}

export function PageDataPanel({ pageState, onRefresh }: PageDataPanelProps) {
  const isEmpty = !pageState || (pageState.receivedAt === undefined && pageState.timestamp === undefined)

  return (
    <div className="panel page-data-panel">
      <h2>Page Elements (Live)</h2>
      <button type="button" className="stats-refresh" onClick={onRefresh}>
        Refresh
      </button>

      {isEmpty ? (
        <p className="stats-empty">
          No page data yet. Open a job site (LinkedIn, Indeed, Glassdoor, etc.) in another tab and browse to see live metrics.
        </p>
      ) : (
        <dl className="page-data-grid">
          <dt title="Job site detected (LinkedIn, Indeed, Glassdoor, etc.)">Site</dt>
          <dd>{pageState.site ?? '—'}</dd>

          <dt title="When the last page state update was received from the extension">Last updated</dt>
          <dd>{formatAge(pageState.receivedAt ?? pageState.timestamp)}</dd>

          <dt title="Whether the job site tab is visible (not minimized or in background)">Tab visible</dt>
          <dd>{pageState.tabVisible == null ? '—' : pageState.tabVisible ? 'Yes' : 'No'}</dd>

          <dt title="Seconds spent viewing this job after clicking it">Time on job detail (sec)</dt>
          <dd>{pageState.timeOnDetailSec ?? '—'}</dd>

          <dt title="Job ID of the job you're currently viewing">Current job</dt>
          <dd>{pageState.currentJobId ? <code className="page-data-ids">{pageState.currentJobId}</code> : '—'}</dd>

          <dt title="Total seconds on all job details this session (cumulative)">Total time on details (sec)</dt>
          <dd>{pageState.totalTimeOnDetailSec ?? '—'}</dd>

          <dt title="How far down the page you've scrolled (0% = top, 100% = bottom)">Scroll depth (%)</dt>
          <dd>{pageState.scrollDepthPercent ?? '—'}</dd>

          <dt title="Cumulative pixels scrolled this session (all scroll containers)">Total scroll (px)</dt>
          <dd>{pageState.totalScrollPx ?? '—'}</dd>

          <dt title="Number of job cards currently visible in the viewport">Cards in viewport</dt>
          <dd>{pageState.cardsInViewCount ?? '—'}</dd>

          <dt title="Number of unique job cards that have scrolled out of view (above the viewport). Cards you've passed by while scrolling down.">Cards scrolled past</dt>
          <dd>{pageState.cardsScrolledPastCount ?? '—'}</dd>

          <dt title="Whether the apply button is visible on screen">Apply button in view</dt>
          <dd>{pageState.applyBtnInView == null ? '—' : pageState.applyBtnInView ? 'Yes' : 'No'}</dd>

          <dt title="Most recent job card you hovered over in the list (without clicking)">Last card hovered</dt>
          <dd>
            {pageState.lastCardHovered ? (
              <span title={pageState.lastCardHovered.company}>
                {pageState.lastCardHovered.title || pageState.lastCardHovered.jobId || '—'}
              </span>
            ) : (
              '—'
            )}
          </dd>

          <dt title="Seconds you hovered over a job card in the list (without clicking to open it)">Hover duration (sec)</dt>
          <dd>{pageState.lastCardHoverDurationSec ?? '—'}</dd>

          {pageState.cardsInViewIds && pageState.cardsInViewIds.length > 0 && (
            <>
              <dt title="Job IDs of cards currently visible in the viewport">Card IDs in view</dt>
              <dd>
                <code className="page-data-ids">{pageState.cardsInViewIds.slice(0, 10).join(', ')}</code>
                {pageState.cardsInViewIds.length > 10 && (
                  <span> … +{pageState.cardsInViewIds.length - 10} more</span>
                )}
              </dd>
            </>
          )}
        </dl>
      )}
    </div>
  )
}
