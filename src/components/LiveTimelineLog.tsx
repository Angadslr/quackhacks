import type { TimelineEvent } from '../types/timeline'

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

function kindLabel(kind: TimelineEvent['kind']): string | null {
  if (kind === 'ai') return 'AI'
  if (kind === 'alert') return '!'
  return null
}

export function LiveTimelineLog({ events }: LiveTimelineLogProps) {
  return (
    <aside className="timeline-panel mx-auto flex h-full max-h-[576px] min-h-0 w-full max-w-[240px] flex-col">
      <h2 className="shrink-0 border-b border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-guard-cream/80">
        Live timeline log
      </h2>
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {events.length === 0 ? (
          <li className="px-1 py-4 text-center text-xs text-guard-cream/40">
            Events appear here while monitoring
          </li>
        ) : (
          events.map((event) => {
            const badge = kindLabel(event.kind)
            return (
              <li
                key={event.id}
                className="border-b border-white/5 px-1 py-2 last:border-b-0"
              >
                <div className="flex items-start gap-2 text-xs">
                  <span className="shrink-0 font-mono text-guard-cream/45">
                    {formatClock(event.time)}
                  </span>
                  {badge && (
                    <span
                      className={
                        event.kind === 'ai'
                          ? 'shrink-0 rounded bg-guard-yellow/20 px-1 py-0.5 text-[10px] font-semibold uppercase text-guard-yellow'
                          : 'shrink-0 font-bold text-guard-red'
                      }
                    >
                      {badge}
                    </span>
                  )}
                  <span
                    className={
                      event.kind === 'ai'
                        ? 'leading-snug text-guard-cream'
                        : 'leading-snug text-guard-cream/90'
                    }
                  >
                    {event.message}
                  </span>
                </div>
              </li>
            )
          })
        )}
      </ul>
    </aside>
  )
}
