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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[2000]">
      <div className="bg-gamedin-bg border border-gamedin-border rounded-lg p-5 min-w-[200px] text-center">
        {title && <p className="m-0 mb-1.5 text-xs text-gamedin-accent">{title}</p>}
        <h3 className="m-0 mb-2 text-lg text-gamedin-accent capitalize">{result.outcome}</h3>
        <p className="m-0 mb-2 text-xs text-gamedin-muted">{OUTCOME_COPY[result.outcome]}</p>
        <p className="m-0 mb-3 text-sm text-gamedin-text">+{result.hopiumAwarded} Hopium</p>
        <button
          type="button"
          className="py-2 px-4 text-xs bg-gamedin-success border border-gamedin-border rounded text-gamedin-text-bright cursor-pointer"
          onClick={onConfirm}
        >
          Cope
        </button>
      </div>
    </div>
  )
}
