import { useCallback, useRef, useState } from 'react'
import type { TimelineEvent, TimelineEventKind } from '../types/timeline'

const MAX_EVENTS = 80

let eventCounter = 0

function nextId(): string {
  eventCounter += 1
  return `tl-${eventCounter}-${Date.now()}`
}

export function useTimelineLog() {
  const [events, setEvents] = useState<TimelineEvent[]>([])

  const append = useCallback(
    (
      message: string,
      kind: TimelineEventKind = 'info',
      riskScore?: number,
    ) => {
      const entry: TimelineEvent = {
        id: nextId(),
        time: new Date(),
        message,
        kind,
        riskScore,
      }
      setEvents((prev) => [entry, ...prev].slice(0, MAX_EVENTS))
    },
    [],
  )

  const clear = useCallback(() => {
    setEvents([])
  }, [])

  const lastRiskLogRef = useRef<{ score: number; at: number } | null>(null)

  const maybeLogRiskSpike = useCallback(
    (score: number, personLabel: string) => {
      const now = Date.now()
      const last = lastRiskLogRef.current
      const rounded = Math.round(score)

      if (
        last &&
        now - last.at < 2500 &&
        Math.abs(rounded - last.score) < 8
      ) {
        return
      }

      if (rounded < 25) return

      lastRiskLogRef.current = { score: rounded, at: now }
      append(
        `${personLabel}: Risk score ${rounded}%`,
        rounded >= 65 ? 'alert' : 'risk',
        rounded,
      )
    },
    [append],
  )

  return { events, append, clear, maybeLogRiskSpike }
}
