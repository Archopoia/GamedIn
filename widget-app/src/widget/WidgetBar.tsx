import type { SaveState } from '../domain/types'

type TabId = 'profile' | 'stats' | 'pagedata' | 'dev'

const TAB_LABELS: Record<TabId, string> = {
  profile: 'Hopium Config',
  stats: 'Rejection Ledger',
  pagedata: 'Page Data',
  dev: 'Dev',
}

interface WidgetBarProps {
  state: SaveState
  activeTab: TabId | null
  setActiveTab: (tab: TabId | null) => void
  message: string | null
  isWidgetDevMode: boolean
  onTabMouseDown: () => void
}

export function WidgetBar({
  state,
  activeTab,
  setActiveTab,
  message,
  isWidgetDevMode,
  onTabMouseDown,
}: WidgetBarProps) {
  const todayProgress = Math.min(
    100,
    Math.round(
      (state.run.appliesToday / state.profile.dailyApplyGoal) * 100,
    ),
  )

  const tabs = [
    'profile',
    'stats',
    'pagedata',
    ...(isWidgetDevMode ? ['dev'] : []),
  ] as TabId[]

  return (
    <div className="shrink-0 flex items-center gap-2.5 px-3 py-1.5 border-b border-gamedin-border bg-gamedin-bg/70 backdrop-blur-[1px]">
      <div className="flex flex-wrap items-center gap-2 text-gamedin-text">
        <span className="mr-1 rounded-md border border-gamedin-accent/40 bg-gamedin-panel px-1.5 py-0.5 font-bold text-gamedin-accent shadow-[0_0_10px_rgba(210,167,99,0.2)]">
          GamedIn
        </span>
        <span title="Currency earned by applying">
          Hopium: {state.economy.hopium}
        </span>
        <span title="Consecutive days hitting daily goal">
          Streak: {state.engagement.streakDays}d
        </span>
        <span title="Daily apply goal (X/Y)">
          Run: {state.run.appliesToday}/{state.profile.dailyApplyGoal}
        </span>
      </div>
      <div className="flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`gd-button ${activeTab === tab ? 'bg-gamedin-hover border-gamedin-accent text-gamedin-accent shadow-[0_0_14px_rgba(210,167,99,0.2)]' : 'text-gamedin-muted'}`}
            onMouseDown={onTabMouseDown}
            onClick={() => setActiveTab(activeTab === tab ? null : tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>
      <div className="flex-1 min-w-[80px] max-w-[120px]">
        <div
          className="gd-progress-track"
          role="progressbar"
          aria-valuenow={todayProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Daily run progress: ${todayProgress}%`}
        >
          <span
            className="gd-progress-fill transition-[width] duration-300 ease-out"
            style={{ width: `${todayProgress}%` }}
          />
        </div>
      </div>
      {message && (
        <span className="gd-feedback max-w-[180px]" role="status" aria-live="polite">
          {message}
        </span>
      )}
    </div>
  )
}
