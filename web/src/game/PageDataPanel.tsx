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
  timeOnListSec?: number
  tabVisible?: boolean
  scrollDepthPercent?: number
  maxScrollReached?: number
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
      <p className="page-data-hint">
        Raw metrics from the current job site tab. Open LinkedIn, Indeed, or another supported site in another tab and browse; data updates every ~2s.
      </p>
      <button type="button" className="stats-refresh" onClick={onRefresh}>
        Refresh
      </button>

      {isEmpty ? (
        <p className="stats-empty">
          No page data yet. Open a job site (LinkedIn, Indeed, Glassdoor, etc.) in another tab and browse to see live metrics.
        </p>
      ) : (
        <dl className="page-data-grid">
          <dt>Site</dt>
          <dd>{pageState.site ?? '—'}</dd>

          <dt>Last updated</dt>
          <dd>{formatAge(pageState.receivedAt ?? pageState.timestamp)}</dd>

          <dt>Tab visible</dt>
          <dd>{pageState.tabVisible == null ? '—' : pageState.tabVisible ? 'Yes' : 'No'}</dd>

          <dt>Time on job detail (sec)</dt>
          <dd>{pageState.timeOnDetailSec ?? '—'}</dd>

          <dt>Time on list (sec)</dt>
          <dd>{pageState.timeOnListSec ?? '—'}</dd>

          <dt>Scroll depth (%)</dt>
          <dd>{pageState.scrollDepthPercent ?? '—'}</dd>

          <dt>Max scroll reached (%)</dt>
          <dd>{pageState.maxScrollReached ?? '—'}</dd>

          <dt>Cards in viewport</dt>
          <dd>{pageState.cardsInViewCount ?? '—'}</dd>

          <dt>Cards scrolled past</dt>
          <dd>{pageState.cardsScrolledPastCount ?? '—'}</dd>

          <dt>Apply button in view</dt>
          <dd>{pageState.applyBtnInView == null ? '—' : pageState.applyBtnInView ? 'Yes' : 'No'}</dd>

          <dt>Last card hovered</dt>
          <dd>
            {pageState.lastCardHovered ? (
              <span title={pageState.lastCardHovered.company}>
                {pageState.lastCardHovered.title || pageState.lastCardHovered.jobId || '—'}
              </span>
            ) : (
              '—'
            )}
          </dd>

          <dt>Hover duration (sec)</dt>
          <dd>{pageState.lastCardHoverDurationSec ?? '—'}</dd>

          {pageState.cardsInViewIds && pageState.cardsInViewIds.length > 0 && (
            <>
              <dt>Card IDs in view</dt>
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
