import { useCallback, useEffect, useRef, useState } from 'react'
import type { Incident } from '../types/pose'
import type { SignalBreakdown } from '../types/risk'
import { CANVAS_HEIGHT, CANVAS_WIDTH } from './SkeletonCanvas'
import { drawReplayFrame } from '../utils/skeletonRenderer'

interface ReplayViewerProps {
  incidents: Incident[]
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function ContributorSummary({ contributors }: { contributors: SignalBreakdown }) {
  const items = [
    { label: 'Submerged / lost track', value: contributors.disappearance },
    { label: 'Partial submersion', value: contributors.submersion },
    { label: 'Motion stasis', value: contributors.stasis },
    { label: 'Surface distress', value: contributors.distress },
  ].filter((i) => i.value > 0)

  return (
    <ul className="mt-2 space-y-1 text-xs text-guard-cream/60">
      {items.map((item) => (
        <li key={item.label}>
          {item.label}: +{item.value}
        </li>
      ))}
    </ul>
  )
}

function ReplayCanvas({ incident }: { incident: Incident }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const [frameIndex, setFrameIndex] = useState(0)

  const play = useCallback(() => {
    const frames = incident.frames
    if (frames.length === 0) return

    let idx = 0
    const startTime = performance.now()

    const step = (now: number) => {
      const elapsed = now - startTime
      const targetIdx = Math.min(
        Math.floor((elapsed / incident.durationMs) * frames.length),
        frames.length - 1,
      )
      idx = targetIdx
      setFrameIndex(idx)

      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      const frame = frames[idx]

      if (canvas && ctx && frame) {
        drawReplayFrame(ctx, frame.people, CANVAS_WIDTH, CANVAS_HEIGHT)
      }

      if (idx < frames.length - 1) {
        rafRef.current = requestAnimationFrame(step)
      }
    }

    rafRef.current = requestAnimationFrame(step)
  }, [incident])

  useEffect(() => {
    play()
    return () => cancelAnimationFrame(rafRef.current)
  }, [play])

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full max-w-md rounded-lg border border-guard-maroon-light"
      />
      <p className="mt-2 text-xs text-guard-cream/50">
        Frame {frameIndex + 1} / {incident.frames.length} — detection boxes only, no
        video stored
      </p>
    </div>
  )
}

export function ReplayViewer({ incidents }: ReplayViewerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = incidents.find((i) => i.id === selectedId) ?? null

  return (
    <section className="guard-panel p-4">
      <h2 className="mb-1 text-lg font-semibold text-guard-white">
        Incident Replays
      </h2>
      <p className="mb-4 text-sm text-guard-cream/50">
        Privacy-preserving — detection boxes only, no video
      </p>

      {incidents.length === 0 ? (
        <p className="text-sm text-guard-cream/50">No incidents yet</p>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex flex-wrap gap-3">
            {incidents.map((incident) => (
              <button
                key={incident.id}
                type="button"
                onClick={() => setSelectedId(incident.id)}
                className={`rounded-lg border p-3 text-left transition ${
                  selectedId === incident.id
                    ? 'border-guard-red bg-guard-red/15'
                    : 'border-guard-maroon-light bg-guard-maroon-mid hover:border-guard-yellow/40'
                }`}
              >
                <p className="font-mono text-sm text-guard-white">
                  {formatTime(incident.startTime)}
                </p>
                <p className="text-sm font-medium text-guard-red">
                  Peak {Math.round(incident.peakRisk)}%
                </p>
                {incident.personId != null && (
                  <p className="text-xs text-guard-cream/50">
                    Person #{incident.personId}
                  </p>
                )}
                <p className="text-xs text-guard-cream/50">
                  {(incident.durationMs / 1000).toFixed(1)}s captured
                </p>
              </button>
            ))}
          </div>

          {selected && (
            <div className="flex-1">
              <ReplayCanvas key={selected.id} incident={selected} />
              <div className="mt-3 rounded-lg border border-guard-maroon-light bg-guard-maroon-mid p-3">
                <p className="text-sm font-medium text-guard-yellow">Incident details</p>
                <p className="text-sm text-guard-cream/70">
                  Timestamp: {formatTime(selected.startTime)}
                </p>
                <p className="text-sm text-guard-cream/70">
                  Peak risk: {Math.round(selected.peakRisk)}%
                </p>
                {selected.personId != null && (
                  <p className="text-sm text-guard-cream/70">
                    Person: #{selected.personId}
                  </p>
                )}
                <p className="text-sm text-guard-cream/70">
                  Duration: {(selected.durationMs / 1000).toFixed(1)}s
                </p>
                <ContributorSummary contributors={selected.contributors} />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
