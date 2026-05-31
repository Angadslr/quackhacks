import type { TrackedPerson } from '../types/person'

const HIGH_RISK_THRESHOLD = 70

interface PeopleListProps {
  people: TrackedPerson[]
}

export function PeopleList({ people }: PeopleListProps) {
  if (people.length === 0) {
    return (
      <div className="guard-panel p-3">
        <p className="text-xs text-guard-cream/50">No people detected yet</p>
      </div>
    )
  }

  return (
    <div className="guard-panel border-l-4 border-l-guard-red p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-guard-yellow">
        Swimmers
      </p>
      <ul className="space-y-1.5">
        {people.map((p) => {
          const highRisk = p.riskScore > HIGH_RISK_THRESHOLD
          return (
            <li
              key={p.id}
              className="flex items-center justify-between text-sm"
            >
              <span
                className={
                  highRisk
                    ? 'font-bold text-guard-red'
                    : 'text-guard-cream/90'
                }
              >
                Person #{p.id}
                {!p.isTracked && (
                  <span className="ml-1 font-normal text-guard-cream/40">(lost)</span>
                )}
                {p.isTracked && p.isMissing && (
                  <span className="ml-1 font-normal text-guard-red/90">
                    (submerged)
                  </span>
                )}
              </span>
              <span
                className={`font-mono text-sm ${
                  highRisk ? 'font-bold text-guard-red' : 'text-guard-pool/80'
                }`}
              >
                {Math.round(p.riskScore)}%
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
