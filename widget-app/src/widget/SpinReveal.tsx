import type { SpinResult } from '../domain/types'

const OUTCOME_COPY: Record<SpinResult['outcome'], string> = {
  ghosted: 'Ghosted. They probably never read it.',
  rejected: 'Rejected. ATS said no.',
  interview: 'Interview! Rare. Enjoy it while it lasts.',
  offer: 'Offer?! Based. Touch grass.',
}

interface SpinRevealProps {
  result: SpinResult
  onConfirm: () => void
  title?: string
}

export function SpinReveal({ result, onConfirm, title }: SpinRevealProps) {
  return (
    <div className="gd-modal-overlay">
      <div className="gd-modal-card min-w-[220px] px-5 py-5 text-center">
        {title && <p className="m-0 mb-1.5 text-xs text-gamedin-accent">{title}</p>}
        <h3 className="m-0 mb-2 text-lg text-gamedin-accent capitalize">{result.outcome}</h3>
        <p className="m-0 mb-2 text-xs text-gamedin-muted">{OUTCOME_COPY[result.outcome]}</p>
        <p className="m-0 mb-3 text-sm text-gamedin-text">+{result.hopiumAwarded} Hopium</p>
        <button
          type="button"
          className="gd-button gd-button-primary px-4 py-2 text-xs"
          onClick={onConfirm}
        >
          Cope
        </button>
      </div>
    </div>
  )
}
