import type { SignalBreakdown } from '../types/risk'

interface ContributorsPanelProps {
  contributors: SignalBreakdown
  score: number
  personId?: number | null
  peopleCount?: number
}

const LABELS: { key: keyof SignalBreakdown; label: string }[] = [
  { key: 'disappearance', label: 'Submerged / lost track' },
  { key: 'submersion', label: 'Partial submersion' },
  { key: 'stasis', label: 'Motion stasis' },
  { key: 'distress', label: 'Surface distress posture' },
]

export function ContributorsPanel({
  contributors,
  score,
  personId,
  peopleCount = 1,
}: ContributorsPanelProps) {
  const sorted = [...LABELS].sort(
    (a, b) => contributors[b.key] - contributors[a.key],
  )

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <h3 className="mb-1 text-sm font-medium text-slate-300">
        Why this score?{' '}
        <span className="text-slate-500">Risk: {Math.round(score)}</span>
      </h3>
      {peopleCount > 1 && personId != null && (
        <p className="mb-2 text-xs text-slate-500">
          Showing highest-risk person (#{personId}) of {peopleCount} tracked
        </p>
      )}
      <ul className="space-y-2">
        {sorted.map(({ key, label }) => {
          const value = contributors[key]
          if (value <= 0) return null
          return (
            <li
              key={key}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-slate-400">{label}</span>
              <span className="font-mono text-emerald-400">+{value}</span>
            </li>
          )
        })}
        {sorted.every(({ key }) => contributors[key] <= 0) && (
          <li className="text-sm text-slate-500">No risk signals detected</li>
        )}
      </ul>
    </div>
  )
}
