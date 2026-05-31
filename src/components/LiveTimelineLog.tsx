import type { TimelineEvent } from '../types/timeline'
import { riskScoreColor } from '../utils/riskColor'

interface LiveTimelineLogProps {
  events: TimelineEvent[]
}

function formatClock(time: Date): string {
  return time.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function LiveTimelineLog({ events }: LiveTimelineLogProps) {
  return (
    <aside className="timeline-panel flex h-full min-h-0 flex-col">
      <h2 className="shrink-0 border-b border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-guard-cream/80">
        Live timeline log
      </h2>
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {events.length === 0 ? (
          <li className="px-1 py-4 text-center text-xs text-guard-cream/40">
            Events appear here while monitoring
          </li>
        ) : (
          events.map((event) => (
            <li
              key={event.id}
              className="border-b border-white/5 px-1 py-2 last:border-b-0"
            >
              <div className="flex items-start gap-2 text-xs">
                <span className="shrink-0 font-mono text-guard-cream/45">
                  {formatClock(event.time)}
                </span>
                <span className="leading-snug text-guard-cream/90">
                  {event.message}
                </span>
              </div>
              {event.riskScore != null && (
                <p
                  className="mt-1 pl-[3.25rem] font-mono text-sm font-semibold"
                  style={{ color: riskScoreColor(event.riskScore) }}
                >
                  Risk: {event.riskScore}%
                </p>
              )}
            </li>
          ))
        )}
      </ul>
    </aside>
  )
}
