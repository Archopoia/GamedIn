import type { SaveStateV1 } from '../domain/types'

interface ActivityEvent {
  event: string
  site?: string
  timestamp?: number
  keywords?: string
  jobId?: string
  title?: string
  company?: string
  count?: number
  jobs?: Array<{ jobId: string; title: string; company: string }>
}

interface StatsPanelProps {
  state: SaveStateV1
  activity: ActivityEvent[]
  onRefresh: () => void
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

export function StatsPanel({ state, activity, onRefresh }: StatsPanelProps) {
  const counts = {
    search: activity.filter((a) => a.event === 'search').length,
    job_list: activity.filter((a) => a.event === 'job_list').length,
    job_clicked: activity.filter((a) => a.event === 'job_clicked').length,
    job_viewed: activity.filter((a) => a.event === 'job_viewed').length,
  }

  const recent = [...activity]
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 15)

  return (
    <div className="panel">
      <h2>Gamer Stats</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{state.economy.zen}</span>
          <span className="stat-label">Zen</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{state.progression.totalApplications}</span>
          <span className="stat-label">Total applies</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{state.engagement.appliesToday}</span>
          <span className="stat-label">Today</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{state.progression.level}</span>
          <span className="stat-label">Level</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{state.engagement.streakDays}d</span>
          <span className="stat-label">Streak</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{state.guests.active}</span>
          <span className="stat-label">Guests</span>
        </div>
      </div>

      <h3>Recent applications</h3>
      {state.applications.length === 0 ? (
        <p className="stats-empty">No applications yet. Apply on LinkedIn, Indeed, Glassdoor, Greenhouse, or Lever.</p>
      ) : (
        <ul className="activity-feed">
          {[...state.applications]
            .reverse()
            .slice(0, 10)
            .map((app) => (
              <li key={app.id} className="activity-item">
                <span className="activity-type">{app.source}</span>
                <span className="activity-detail">
                  {app.title} @ {app.company}
                </span>
                <span className="activity-time">
                  {formatTime(new Date(app.createdAt).getTime())}
                </span>
              </li>
            ))}
        </ul>
      )}

      <h3>Job site activity</h3>
      <p className="stats-hint">
        Tracked by the extension when you browse LinkedIn, Indeed, Glassdoor, Greenhouse, or Lever.
      </p>
      <div className="activity-counts">
        <span title="Search queries run">Searches: {counts.search}</span>
        <span title="Job list views">Job lists: {counts.job_list}</span>
        <span title="Job cards clicked">Jobs clicked: {counts.job_clicked}</span>
        <span title="Job detail views">Jobs viewed: {counts.job_viewed}</span>
      </div>
      <button type="button" className="stats-refresh" onClick={onRefresh}>
        Refresh
      </button>

      <h3>Recent activity</h3>
      {recent.length === 0 ? (
        <p className="stats-empty">
          No browse activity yet. Install the extension and browse job sites to see stats.
        </p>
      ) : (
        <ul className="activity-feed">
          {recent.map((ev, i) => (
            <li key={i} className={`activity-item activity-${ev.event}`}>
              <span className="activity-type">
                {ev.event.replace('_', ' ')}
                {ev.site && <span className="activity-site"> ({ev.site})</span>}
              </span>
              {ev.keywords && (
                <span className="activity-detail">“{ev.keywords}”</span>
              )}
              {ev.title && (
                <span className="activity-detail">
                  {ev.title}
                  {ev.company ? ` @ ${ev.company}` : ''}
                </span>
              )}
              {ev.count != null && ev.event === 'job_list' && (
                <span className="activity-detail">{ev.count} jobs</span>
              )}
              <span className="activity-time">{formatTime(ev.timestamp)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
