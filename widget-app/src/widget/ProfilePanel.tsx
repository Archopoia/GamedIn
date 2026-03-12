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
    <form
      onSubmit={handleProfileSave}
      className="[&_h3]:m-0 [&_h3]:mb-1.5 [&_h3]:text-[13px] [&_h3]:text-gamedin-accent [&_p]:m-0 [&_p]:mb-1 [&_label]:m-0 [&_label]:mb-1 [&_label]:text-xs [&_label]:text-gamedin-text [&_input]:ml-1 [&_input]:py-0.5 [&_input]:px-1.5 [&_input]:text-[11px] [&_input]:bg-gamedin-panel [&_input]:border [&_input]:border-gamedin-border [&_input]:rounded [&_input]:text-gamedin-text-bright [&_button]:m-1 [&_button]:mr-1 [&_button]:mt-1 [&_button]:mb-1 [&_button]:py-1 [&_button]:px-2 [&_button]:text-[11px] [&_button]:bg-gamedin-success [&_button]:border [&_button]:border-gamedin-border [&_button]:rounded [&_button]:text-gamedin-text-bright [&_button]:cursor-pointer"
    >
      <h3>Hopium Config</h3>
      {!onboardingSeen && (
        <div className="mb-3 p-2.5 px-3 bg-gamedin-panel border border-gamedin-border rounded">
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
            className="py-1 px-2.5 text-[11px] bg-gamedin-border border border-gamedin-accent rounded text-gamedin-accent cursor-pointer hover:bg-gamedin-hover"
            onClick={dismissOnboarding}
          >
            Got it
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <label>
          Name{' '}
          <input
            value={profileInput.displayName}
            onChange={(e) =>
              setProfileInput((c) => ({ ...c, displayName: e.target.value }))
            }
          />
        </label>
        <label>
          Daily Hopium Dose{' '}
          <input
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
        <label>
          Roles{' '}
          <input
            value={profileInput.preferredRoles}
            onChange={(e) =>
              setProfileInput((c) => ({ ...c, preferredRoles: e.target.value }))
            }
            placeholder="Preferred roles (comma-separated)"
          />
        </label>
        <button type="submit">Commit to Delusion</button>
      </div>
    </form>
  )
}
