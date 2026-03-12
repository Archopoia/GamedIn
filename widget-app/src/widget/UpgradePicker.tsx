import type { UpgradeOption } from '../domain/types'

interface UpgradePickerProps {
  options: UpgradeOption[]
  onSelect: (id: string) => void
}

export function UpgradePicker({ options, onSelect }: UpgradePickerProps) {
  return (
    <div className="gd-modal-overlay">
      <div className="gd-modal-card min-w-[280px] p-5">
        <h3 className="m-0 mb-3 text-sm text-gamedin-accent">Pick 1 of 3</h3>
        <p className="m-0 mb-3 text-[11px] text-gamedin-muted">
          Weapons auto-fire in the arena. Passives boost defense. Stats increase Hopium.
        </p>
        <div className="flex flex-col gap-2">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="gd-card px-3 py-2.5 text-left flex flex-col gap-0.5 hover:border-gamedin-accent hover:shadow-[0_0_20px_rgba(210,167,99,0.25)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.995]"
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
