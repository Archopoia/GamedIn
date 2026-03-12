import type { SaveState } from '../domain/types'
import { ACHIEVEMENT_LABELS } from '../domain/achievements'

interface ActivityEvent {
  event: string
  site?: string
  timestamp?: number
  keywords?: string
  jobId?: string
  title?: string
  company?: string
  count?: number
}

function formatTime(ts?: number) {
  if (!ts) return '—'
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
  return d.toLocaleDateString()
}

interface StatsPanelProps {
  state: SaveState
  activity: ActivityEvent[]
  onRefresh: () => void
}

export function StatsPanel({ state, activity, onRefresh }: StatsPanelProps) {
  const counts = {
    search: activity.filter((a) => a.event === 'search').length,
    job_list: activity.filter((a) => a.event === 'job_list').length,
    job_clicked: activity.filter((a) => a.event === 'job_clicked').length,
    job_viewed: activity.filter((a) => a.event === 'job_viewed').length,
  }
  const recent = [...activity]
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 4)

  return (
    <div className="text-gamedin-text">
      <h3 className="m-0 mb-1.5 text-[13px] text-gamedin-accent">
        Rejection Ledger
      </h3>
      <p className="mb-1">Apps: {state.applications.length}</p>
      <p className="mb-1">Achievements: {state.meta.achievements.length}</p>
      {state.applications.length === 0 && (
        <p className="gd-card text-gamedin-muted text-xs my-2 py-2 px-2">
          Apply to jobs on LinkedIn, Indeed, or Glassdoor to see your first
          entry. The extension detects applies automatically.
        </p>
      )}
      {state.meta.collectibles.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 gap-x-2.5 mt-2">
          <span className="text-gamedin-muted text-xs">Unlocked:</span>
          {state.meta.collectibles.map((id) => (
            <span key={id} className="gd-badge" title={id}>
              {ACHIEVEMENT_LABELS[id] ?? id}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-2 mb-1.5 text-xs text-gamedin-text [&_span]:whitespace-nowrap">
        <span title="Search queries">Searches: {counts.search}</span>
        <span title="Job list views">Job lists: {counts.job_list}</span>
        <span title="Job cards clicked">
          Jobs clicked: {counts.job_clicked}
        </span>
        <span title="Job detail views">Jobs viewed: {counts.job_viewed}</span>
      </div>
      {state.applications.length > 0 && (
        <ul className="gd-card list-none p-0 my-1 text-xs text-gamedin-text [&_li]:py-1 [&_li]:px-2 [&_li]:border-b [&_li]:border-gamedin-border [&_li:last-child]:border-b-0">
          {[...state.applications]
            .reverse()
            .slice(0, 4)
            .map((app) => (
              <li key={app.id}>
                <span className="text-gamedin-accent mr-1">{app.source}</span>{' '}
                {app.title} @ {app.company}
                <span className="float-right text-gamedin-muted text-[11px]">
                  {formatTime(new Date(app.createdAt).getTime())}
                </span>
              </li>
            ))}
        </ul>
      )}
      {recent.length > 0 && (
        <ul className="gd-card list-none p-0 my-1 text-xs text-gamedin-text [&_li]:py-1 [&_li]:px-2 [&_li]:border-b [&_li]:border-gamedin-border [&_li:last-child]:border-b-0">
          {recent.map((ev, i) => (
            <li key={i}>
              <span className="text-gamedin-accent mr-1">{ev.event}</span>
              {ev.keywords && ` "${ev.keywords}"`}
              {ev.title &&
                ` ${ev.title}${ev.company ? ` @ ${ev.company}` : ''}`}
              <span className="float-right text-gamedin-muted text-[11px]">
                {formatTime(ev.timestamp)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={onRefresh}
        className="gd-button mt-1"
      >
        Refresh the Pain
      </button>
    </div>
  )
}
