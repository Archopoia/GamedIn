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
    <div className="shrink-0 flex items-center gap-3 py-1.5 px-3 bg-gamedin-bg border-b border-gamedin-border">
      <div className="flex flex-wrap items-center gap-2.5 text-gamedin-text">
        <span className="font-bold text-gamedin-accent mr-1">GamedIn</span>
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
            className={`py-1 px-2 text-[11px] bg-transparent border border-gamedin-border rounded text-gamedin-muted cursor-pointer hover:bg-gamedin-panel hover:text-gamedin-accent ${activeTab === tab ? 'bg-gamedin-panel text-gamedin-accent' : ''}`}
            onMouseDown={onTabMouseDown}
            onClick={() => setActiveTab(activeTab === tab ? null : tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>
      <div className="flex-1 min-w-[80px] max-w-[120px]">
        <div
          className="h-1 bg-gamedin-panel rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={todayProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Daily run progress: ${todayProgress}%`}
        >
          <span
            className="block h-full bg-gamedin-accent transition-[width] duration-200"
            style={{ width: `${todayProgress}%` }}
          />
        </div>
      </div>
      {message && (
        <span className="text-[11px] text-gamedin-text">{message}</span>
      )}
    </div>
  )
}
