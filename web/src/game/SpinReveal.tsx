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
    <div className="spin-reveal-overlay">
      <div className="spin-reveal-card">
        {title && <p className="spin-reveal-bonus-title">{title}</p>}
        <h3 className="spin-reveal-outcome">{result.outcome}</h3>
        <p className="spin-reveal-copy">{OUTCOME_COPY[result.outcome]}</p>
        <p className="spin-reveal-hopium">+{result.hopiumAwarded} Hopium</p>
        <button type="button" className="spin-reveal-btn" onClick={onConfirm}>
          Cope
        </button>
      </div>
    </div>
  )
}
