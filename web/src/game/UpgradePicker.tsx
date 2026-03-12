import type { UpgradeOption } from '../domain/types'

interface UpgradePickerProps {
  options: UpgradeOption[]
  onSelect: (id: string) => void
}

export function UpgradePicker({ options, onSelect }: UpgradePickerProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[2000]">
      <div className="bg-gamedin-bg border border-gamedin-border rounded-lg p-5 min-w-[260px]">
        <h3 className="m-0 mb-3 text-sm text-gamedin-accent">Pick 1 of 3</h3>
        <p className="m-0 mb-3 text-[11px] text-gamedin-muted">
          Weapons auto-fire in the arena. Passives boost defense. Stats increase Hopium.
        </p>
        <div className="flex flex-col gap-2">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="py-2.5 px-3 text-xs bg-gamedin-panel border border-gamedin-border rounded text-gamedin-text-bright cursor-pointer text-left flex flex-col gap-0.5 hover:bg-gamedin-success hover:border-gamedin-accent"
              onClick={() => onSelect(opt.id)}
            >
              <span className="font-bold">{opt.label}</span>
              <span className="text-[10px] text-gamedin-muted">{opt.type}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
