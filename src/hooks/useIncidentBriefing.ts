import { useEffect, useRef, useState } from 'react'
import type {
  IncidentBriefingRequest,
  IncidentBriefingResponse,
} from '../types/gemini'

export interface IncidentBriefingContext {
  riskScore: number
  riskState: IncidentBriefingRequest['riskState']
  contributors: IncidentBriefingRequest['contributors']
  personId: number | null
  highRiskDurationMs: number
  timeline: IncidentBriefingRequest['timeline']
  incident: IncidentBriefingRequest['incident']
}

export interface IncidentBriefingRequestPayload {
  /** Stable id so we only fetch once per alert (e.g. incident uuid). */
  id: string
  context: IncidentBriefingContext
}

interface UseIncidentBriefingOptions {
  request: IncidentBriefingRequestPayload | null
  onReady?: (result: IncidentBriefingResponse) => void
}

interface UseIncidentBriefingResult {
  briefing: string | null
  incidentSummary: string | null
  loading: boolean
  error: string | null
  reset: () => void
}

export function useIncidentBriefing({
  request,
  onReady,
}: UseIncidentBriefingOptions): UseIncidentBriefingResult {
  const [briefing, setBriefing] = useState<string | null>(null)
  const [incidentSummary, setIncidentSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchedForIdRef = useRef<string | null>(null)
  const requestIdRef = useRef(0)
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  const reset = () => {
    requestIdRef.current += 1
    fetchedForIdRef.current = null
    setBriefing(null)
    setIncidentSummary(null)
    setLoading(false)
    setError(null)
  }

  useEffect(() => {
    if (!request) return
    if (fetchedForIdRef.current === request.id) return

    fetchedForIdRef.current = request.id
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(null)
    setBriefing(null)
    setIncidentSummary(null)

    const controller = new AbortController()

    ;(async () => {
      try {
        const res = await fetch('/api/incident-briefing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request.context),
          signal: controller.signal,
        })

        const data = (await res.json()) as
          | IncidentBriefingResponse
          | { error?: string }

        if (!res.ok) {
          throw new Error(
            'error' in data && data.error
              ? data.error
              : `Request failed (${res.status})`,
          )
        }

        if (requestId !== requestIdRef.current) return

        const result = data as IncidentBriefingResponse
        setBriefing(result.briefing)
        setIncidentSummary(result.incidentSummary)
        onReadyRef.current?.(result)
      } catch (err) {
        if (controller.signal.aborted) return
        if (requestId !== requestIdRef.current) return
        const message =
          err instanceof Error ? err.message : 'Failed to load AI briefing'
        setError(message)
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false)
        }
      }
    })()

    return () => controller.abort()
  }, [request])

  return { briefing, incidentSummary, loading, error, reset }
}
