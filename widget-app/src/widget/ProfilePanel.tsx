import type { FormEvent } from 'react'
import { profileSchema } from '../domain/validation'
import type { SaveState } from '../domain/types'

interface ProfilePanelProps {
  profileInput: {
    displayName: string
    preferredRoles: string
    dailyApplyGoal: string
  }
  setProfileInput: React.Dispatch<
    React.SetStateAction<{
      displayName: string
      preferredRoles: string
      dailyApplyGoal: string
    }>
  >
  setState: React.Dispatch<React.SetStateAction<SaveState | null>>
  setMessage: (msg: string | null) => void
  onboardingSeen: boolean
  dismissOnboarding: () => void
  upsertProfile: (
    state: SaveState,
    profile: SaveState['profile'],
  ) => SaveState
}

export function ProfilePanel({
  profileInput,
  setProfileInput,
  setState,
  setMessage,
  onboardingSeen,
  dismissOnboarding,
  upsertProfile,
}: ProfilePanelProps) {
  const handleProfileSave = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const parsed = profileSchema.safeParse({
      displayName: profileInput.displayName,
      preferredRoles: profileInput.preferredRoles
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
      dailyApplyGoal: Number(profileInput.dailyApplyGoal),
    })
    if (!parsed.success) {
      setMessage('Profile validation failed.')
      return
    }
    setState((c) => (c ? upsertProfile(c, parsed.data) : c))
    setMessage('Delusion saved.')
    setTimeout(() => setMessage(null), 2000)
  }

  return (
    <form onSubmit={handleProfileSave} className="text-gamedin-text">
      <h3 className="m-0 mb-2 text-[13px] text-gamedin-accent">
        Hopium Config
      </h3>
      {!onboardingSeen && (
        <div className="gd-card mb-3 p-2.5 px-3">
          <p className="m-0 mb-1.5 text-xs font-bold text-gamedin-accent">
            How it works
          </p>
          <ul className="m-0 mb-2 pl-[18px] text-[11px] text-gamedin-text leading-relaxed [&_li]:mb-1">
            <li>
              <strong>Hopium</strong> — Currency earned when you apply. Decays
              when idle.
            </li>
            <li>
              <strong>Run</strong> — Daily goal (X/Y). Hit it to complete your
              run.
            </li>
            <li>
              <strong>Cope Pet</strong> — Mood reflects apply activity. Apply to
              feed it.
            </li>
            <li>
              <strong>Apply</strong> on LinkedIn, Indeed, Glassdoor — extension
              detects it and grants rewards.
            </li>
          </ul>
          <button
            type="button"
            className="gd-button"
            onClick={dismissOnboarding}
          >
            Got it
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
        <label className="text-xs text-gamedin-text">
          Name{' '}
          <input
            className="gd-input ml-1"
            value={profileInput.displayName}
            onChange={(e) =>
              setProfileInput((c) => ({ ...c, displayName: e.target.value }))
            }
          />
        </label>
        <label className="text-xs text-gamedin-text">
          Daily Hopium Dose{' '}
          <input
            className="gd-input ml-1 w-15"
            type="number"
            min={1}
            max={20}
            value={profileInput.dailyApplyGoal}
            onChange={(e) =>
              setProfileInput((c) => ({
                ...c,
                dailyApplyGoal: e.target.value,
              }))
            }
          />
        </label>
        <label className="text-xs text-gamedin-text">
          Roles{' '}
          <input
            className="gd-input ml-1 min-w-[190px]"
            value={profileInput.preferredRoles}
            onChange={(e) =>
              setProfileInput((c) => ({ ...c, preferredRoles: e.target.value }))
            }
            placeholder="Preferred roles (comma-separated)"
          />
        </label>
        <button type="submit" className="gd-button gd-button-primary">
          Commit to Delusion
        </button>
      </div>
    </form>
  )
}
