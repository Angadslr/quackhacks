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
    { label: 'Vertical posture', value: contributors.vertical },
    { label: 'Arms pressing', value: contributors.arms },
    { label: 'Partial submersion', value: contributors.submersion },
    { label: 'Motion stasis', value: contributors.stasis },
  ].filter((i) => i.value > 0)

  return (
    <ul className="mt-2 space-y-1 text-xs text-slate-400">
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

    const startTime = performance.now()

    const step = (now: number) => {
      const elapsed = now - startTime
      const idx = Math.min(
        Math.floor((elapsed / incident.durationMs) * frames.length),
        frames.length - 1,
      )
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
        className="w-full max-w-md rounded-lg border border-slate-700"
      />
      <p className="mt-2 text-xs text-slate-500">
        Frame {frameIndex + 1} / {incident.frames.length} — skeleton only, no video stored
      </p>
    </div>
  )
}

function buildIncidentPrompt(incident: Incident): string {
  const time = formatTime(incident.startTime)
  const { vertical, arms, submersion, stasis } = incident.contributors
  const duration = (incident.durationMs / 1000).toFixed(1)
  const person = incident.personId != null ? `Person #${incident.personId}` : 'Unknown subject'

  return `You are generating a brief automated incident report for a pool safety system.

Incident data:
- Time: ${time}
- Subject: ${person}
- Peak risk score: ${Math.round(incident.peakRisk)}%
- Captured duration: ${duration}s
- Signal breakdown:
  - Vertical posture score: ${vertical}
  - Arms pressing down score: ${arms}
  - Partial submersion score: ${submersion}
  - Motion stasis score: ${stasis}

Write a concise 3–4 sentence incident report in professional safety language. Include: what was detected, which signals were dominant, and a recommended follow-up action. Do not speculate beyond the data. Do not include disclaimers.`
}

function ClaudeReportSection({ incident }: { incident: Incident }) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('claude_api_key') ?? '')
  const [report, setReport] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    if (!apiKey.trim()) {
      setError('Enter an Anthropic API key to generate reports.')
      return
    }
    setLoading(true)
    setError(null)
    setReport(null)
    localStorage.setItem('claude_api_key', apiKey)

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-allow-browser': 'true',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 256,
          messages: [{ role: 'user', content: buildIncidentPrompt(incident) }],
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`)
      }

      const data = await res.json() as { content: { type: string; text: string }[] }
      const text = data.content.find((c) => c.type === 'text')?.text ?? ''
      setReport(text)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
      <p className="mb-2 text-sm font-medium text-white">AI Incident Report</p>

      {!report && (
        <div className="flex flex-col gap-2">
          <input
            type="password"
            placeholder="Anthropic API key (sk-ant-…)"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:border-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="rounded bg-slate-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-600 disabled:opacity-50"
          >
            {loading ? 'Generating…' : 'Generate Report'}
          </button>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}

      {report && (
        <div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{report}</p>
          <button
            type="button"
            onClick={() => setReport(null)}
            className="mt-2 text-xs text-slate-500 underline hover:text-slate-400"
          >
            Regenerate
          </button>
        </div>
      )}
    </div>
  )
}

export function ReplayViewer({ incidents }: ReplayViewerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = incidents.find((i) => i.id === selectedId) ?? null

  // Auto-select latest incident
  useEffect(() => {
    if (incidents.length > 0 && !selectedId) {
      setSelectedId(incidents[0].id)
    }
  }, [incidents, selectedId])

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <h2 className="mb-1 text-lg font-semibold text-white">Incident Replays</h2>
      <p className="mb-4 text-sm text-slate-500">
        Privacy-preserving — skeleton landmarks only, no video
      </p>

      {incidents.length === 0 ? (
        <p className="text-sm text-slate-500">No incidents yet</p>
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
                    ? 'border-red-500 bg-red-500/10'
                    : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                }`}
              >
                <p className="font-mono text-sm text-white">{formatTime(incident.startTime)}</p>
                <p className="text-sm text-red-400">Peak {Math.round(incident.peakRisk)}%</p>
                {incident.personId != null && (
                  <p className="text-xs text-slate-500">Person #{incident.personId}</p>
                )}
                <p className="text-xs text-slate-500">{(incident.durationMs / 1000).toFixed(1)}s captured</p>
              </button>
            ))}
          </div>

          {selected && (
            <div className="flex-1">
              <ReplayCanvas key={selected.id} incident={selected} />
              <div className="mt-3 rounded-lg border border-slate-700 bg-slate-800 p-3">
                <p className="text-sm font-medium text-white">Incident details</p>
                <p className="text-sm text-slate-400">Timestamp: {formatTime(selected.startTime)}</p>
                <p className="text-sm text-slate-400">Peak risk: {Math.round(selected.peakRisk)}%</p>
                {selected.personId != null && (
                  <p className="text-sm text-slate-400">Person: #{selected.personId}</p>
                )}
                <p className="text-sm text-slate-400">Duration: {(selected.durationMs / 1000).toFixed(1)}s</p>
                <ContributorSummary contributors={selected.contributors} />
              </div>
              <ClaudeReportSection key={selected.id} incident={selected} />
            </div>
          )}
        </div>
      )}
    </section>
  )
}
