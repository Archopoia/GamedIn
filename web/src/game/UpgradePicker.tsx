import type { UpgradeOption } from '../domain/types'

interface UpgradePickerProps {
  options: UpgradeOption[]
  onSelect: (id: string) => void
}

export function UpgradePicker({ options, onSelect }: UpgradePickerProps) {
  return (
    <div className="upgrade-picker-overlay">
      <div className="upgrade-picker-card">
        <h3>Pick 1 of 3</h3>
        <p className="upgrade-picker-hint">
          Weapons auto-fire in the arena. Passives boost defense. Stats increase Hopium.
        </p>
        <div className="upgrade-picker-options">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`upgrade-picker-opt upgrade-picker-opt-${opt.type}`}
              onClick={() => onSelect(opt.id)}
            >
              <span className="upgrade-picker-label">{opt.label}</span>
              <span className="upgrade-picker-type">{opt.type}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
