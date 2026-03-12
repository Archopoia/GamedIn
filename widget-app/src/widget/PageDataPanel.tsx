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
  const isEmpty =
    !pageState ||
    (pageState.receivedAt === undefined && pageState.timestamp === undefined)

  return (
    <div className="text-gamedin-text">
      <h2 className="m-0 mb-1.5 text-[13px] text-gamedin-accent">Page Elements (Live)</h2>
      <button
        type="button"
        className="gd-button mb-2"
        onClick={onRefresh}
      >
        Refresh
      </button>

      {isEmpty ? (
        <p className="gd-card text-xs text-gamedin-muted m-0 p-2">
          No page data yet. Open a job site (LinkedIn, Indeed, Glassdoor, etc.) in another tab and browse to see live metrics.
        </p>
      ) : (
        <dl className="gd-card grid grid-cols-[minmax(140px,auto)_1fr] gap-x-2.5 gap-y-0.5 text-[11px] m-0 p-2">
          <dt className="text-gamedin-muted font-medium" title="Job site detected (LinkedIn, Indeed, Glassdoor, etc.)">Site</dt>
          <dd className="m-0 text-gamedin-text-bright">{pageState.site ?? '—'}</dd>

          <dt className="text-gamedin-muted font-medium" title="When the last page state update was received from the extension">Last updated</dt>
          <dd className="m-0 text-gamedin-text-bright">{formatAge(pageState.receivedAt ?? pageState.timestamp)}</dd>

          <dt className="text-gamedin-muted font-medium" title="Whether the job site tab is visible (not minimized or in background)">Tab visible</dt>
          <dd className="m-0 text-gamedin-text-bright">{pageState.tabVisible == null ? '—' : pageState.tabVisible ? 'Yes' : 'No'}</dd>

          <dt className="text-gamedin-muted font-medium" title="Seconds spent viewing this job after clicking it">Time on job detail (sec)</dt>
          <dd className="m-0 text-gamedin-text-bright">{pageState.timeOnDetailSec ?? '—'}</dd>

          <dt className="text-gamedin-muted font-medium" title="Job ID of the job you're currently viewing">Current job</dt>
          <dd className="m-0 text-gamedin-text-bright">{pageState.currentJobId ? <code className="text-[10px] bg-gamedin-bg/70 py-0.5 px-1 rounded break-words block max-w-full border border-gamedin-border">{pageState.currentJobId}</code> : '—'}</dd>

          <dt className="text-gamedin-muted font-medium" title="Total seconds on all job details this session (cumulative)">Total time on details (sec)</dt>
          <dd className="m-0 text-gamedin-text-bright">{pageState.totalTimeOnDetailSec ?? '—'}</dd>

          <dt className="text-gamedin-muted font-medium" title="How far down the page you've scrolled (0% = top, 100% = bottom)">Scroll depth (%)</dt>
          <dd className="m-0 text-gamedin-text-bright">{pageState.scrollDepthPercent ?? '—'}</dd>

          <dt className="text-gamedin-muted font-medium" title="Cumulative pixels scrolled this session (all scroll containers)">Total scroll (px)</dt>
          <dd className="m-0 text-gamedin-text-bright">{pageState.totalScrollPx ?? '—'}</dd>

          <dt className="text-gamedin-muted font-medium" title="Number of job cards currently visible in the viewport">Cards in viewport</dt>
          <dd className="m-0 text-gamedin-text-bright">{pageState.cardsInViewCount ?? '—'}</dd>

          <dt className="text-gamedin-muted font-medium" title="Number of unique job cards that have scrolled out of view (above the viewport). Cards you've passed by while scrolling down.">Cards scrolled past</dt>
          <dd className="m-0 text-gamedin-text-bright">{pageState.cardsScrolledPastCount ?? '—'}</dd>

          <dt className="text-gamedin-muted font-medium" title="Whether the apply button is visible on screen">Apply button in view</dt>
          <dd className="m-0 text-gamedin-text-bright">{pageState.applyBtnInView == null ? '—' : pageState.applyBtnInView ? 'Yes' : 'No'}</dd>

          <dt className="text-gamedin-muted font-medium" title="Most recent job card you hovered over in the list (without clicking)">Last card hovered</dt>
          <dd className="m-0 text-gamedin-text-bright">
            {pageState.lastCardHovered ? (
              <span title={pageState.lastCardHovered.company}>
                {pageState.lastCardHovered.title || pageState.lastCardHovered.jobId || '—'}
              </span>
            ) : (
              '—'
            )}
          </dd>

          <dt className="text-gamedin-muted font-medium" title="Seconds you hovered over a job card in the list (without clicking to open it)">Hover duration (sec)</dt>
          <dd className="m-0 text-gamedin-text-bright">{pageState.lastCardHoverDurationSec ?? '—'}</dd>

          {pageState.cardsInViewIds && pageState.cardsInViewIds.length > 0 && (
            <>
              <dt className="text-gamedin-muted font-medium" title="Job IDs of cards currently visible in the viewport">Card IDs in view</dt>
              <dd className="m-0 text-gamedin-text-bright">
                <code className="text-[10px] bg-gamedin-bg/70 py-0.5 px-1 rounded break-words block max-w-full border border-gamedin-border">{pageState.cardsInViewIds.slice(0, 10).join(', ')}</code>
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
