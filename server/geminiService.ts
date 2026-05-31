import {
  GoogleGenerativeAI,
  type GenerateContentResult,
} from '@google/generative-ai'
import type {
  IncidentBriefingRequest,
  IncidentBriefingResponse,
} from './types.js'

/** Prefer stable non-thinking models first (2.5 can truncate JSON when thinking). */
const DEFAULT_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
] as const

function modelsToTry(): string[] {
  const fromEnv = process.env.GEMINI_MODEL?.trim()
  if (fromEnv) {
    return [fromEnv, ...DEFAULT_MODELS.filter((m) => m !== fromEnv)]
  }
  return [...DEFAULT_MODELS]
}

function formatContributors(c: IncidentBriefingRequest['contributors']): string {
  const parts: string[] = []
  if (c.disappearance > 0) parts.push(`lost track/submerged signal: ${c.disappearance}`)
  if (c.submersion > 0) parts.push(`partial submersion: ${c.submersion}`)
  if (c.stasis > 0) parts.push(`motion stasis: ${c.stasis}`)
  if (c.distress > 0) parts.push(`surface distress: ${c.distress}`)
  return parts.length > 0 ? parts.join('; ') : 'no dominant signal'
}

function buildPrompt(body: IncidentBriefingRequest): string {
  const timelineText =
    body.timeline.length > 0
      ? body.timeline
          .slice(0, 12)
          .map((e) => `- [${e.kind}] ${e.message}`)
          .join('\n')
      : '(no prior events)'

  const incidentBlock = body.incident
    ? `
Incident replay buffer (detection boxes only, no video):
- Peak risk: ${body.incident.peakRisk}%
- Captured duration: ${body.incident.durationSec}s (${body.incident.frameCount} frames)
- Subject: ${body.incident.personId != null ? `Person #${body.incident.personId}` : 'unknown'}
- Frames with missing/lost track: ${body.incident.missingFrameCount}
- Risk over time (ms offset → score): ${body.incident.riskTimeline.map((p) => `${p.offsetMs}ms→${p.risk}%`).join(', ')}
- Signal breakdown at peak: ${formatContributors(body.incident.contributors)}
`
    : '(no replay buffer captured)'

  return `You help a pool lifeguard app (MyGuard). Write two short sections from the data below.

Rules: say "possible" not certain drowning; no medical advice; 2-3 sentences each field.

Output ONLY this JSON object (no markdown):
{"briefing":"<what led to alert>","incidentSummary":"<how risk changed in replay>"}

Current alert:
- Risk score: ${Math.round(body.riskScore)}% (${body.riskState})
- High-risk duration before latch: ${body.highRiskDurationMs}ms
- Primary person: ${body.personId != null ? `#${body.personId}` : 'unknown'}
- Signals: ${formatContributors(body.contributors)}

Recent timeline:
${timelineText}
${incidentBlock}`
}

function normalizeBriefingPayload(
  parsed: Record<string, unknown>,
): IncidentBriefingResponse {
  const briefing = String(parsed.briefing ?? parsed.summary ?? '').trim()
  const incidentSummary = String(
    parsed.incidentSummary ?? parsed.replaySummary ?? parsed.incident_summary ?? '',
  ).trim()
  if (!briefing && !incidentSummary) {
    throw new Error('Gemini JSON missing briefing or incidentSummary')
  }
  return {
    briefing: briefing || incidentSummary,
    incidentSummary: incidentSummary || briefing,
  }
}

function extractResponseText(result: GenerateContentResult): string {
  try {
    const direct = result.response.text()?.trim()
    if (direct) return direct
  } catch {
    // Some models expose text only on parts (e.g. thinking variants).
  }

  const parts = result.response.candidates?.[0]?.content?.parts ?? []
  const fromParts = parts
    .map((part) => ('text' in part && part.text ? String(part.text) : ''))
    .join('')
    .trim()

  return fromParts
}

function unescapeJsonString(value: string): string {
  try {
    return JSON.parse(
      `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
    ) as string
  } catch {
    return value
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
  }
}

function parseLooseJsonFields(raw: string): IncidentBriefingResponse | null {
  const briefingMatch = raw.match(/"briefing"\s*:\s*"((?:[^"\\]|\\.)*)(?:"|$)/)
  const summaryMatch = raw.match(
    /"incidentSummary"\s*:\s*"((?:[^"\\]|\\.)*)(?:"|$)/,
  )
  if (!briefingMatch && !summaryMatch) return null

  const briefing = briefingMatch
    ? unescapeJsonString(briefingMatch[1])
    : ''
  const incidentSummary = summaryMatch
    ? unescapeJsonString(summaryMatch[1])
    : ''

  if (!briefing && !incidentSummary) return null
  return {
    briefing: briefing || incidentSummary,
    incidentSummary: incidentSummary || briefing,
  }
}

function parseGeminiJson(text: string): IncidentBriefingResponse {
  let raw = text.trim()
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  try {
    return normalizeBriefingPayload(
      JSON.parse(raw) as Record<string, unknown>,
    )
  } catch {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        return normalizeBriefingPayload(
          JSON.parse(jsonMatch[0]) as Record<string, unknown>,
        )
      } catch {
        const loose = parseLooseJsonFields(jsonMatch[0])
        if (loose) return loose
      }
    }

    const loose = parseLooseJsonFields(raw)
    if (loose) return loose
  }

  if (raw.length >= 20 && !raw.startsWith('{')) {
    return { briefing: raw, incidentSummary: raw }
  }

  throw new Error('Gemini response was not JSON')
}

function isRetryableGeminiError(err: Error): boolean {
  const status = (err as { status?: number }).status
  if (status === 429 || status === 404) return true
  const msg = err.message
  return (
    msg.includes('not JSON') ||
    msg.includes('missing briefing') ||
    msg.includes('Empty response') ||
    msg.includes('SAFETY') ||
    msg.includes('RECITATION')
  )
}

export async function generateIncidentBriefing(
  apiKey: string,
  body: IncidentBriefingRequest,
): Promise<IncidentBriefingResponse> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const prompt = buildPrompt(body)
  let lastError: Error | null = null

  for (const modelName of modelsToTry()) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      })

      const result = await model.generateContent(prompt)
      const text = extractResponseText(result)
      if (!text) {
        throw new Error('Empty response from Gemini')
      }
      console.log(`[gemini] ${modelName} ok (${text.length} chars)`)
      return parseGeminiJson(text)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`[gemini] ${modelName} failed:`, lastError.message.slice(0, 120))
      if (!isRetryableGeminiError(lastError)) {
        throw lastError
      }
    }
  }

  throw lastError ?? new Error('All Gemini models failed')
}

export function formatGeminiError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
    return 'Gemini rate limit reached — wait a minute and try again.'
  }
  if (msg.includes('404') && msg.includes('not found')) {
    return 'Gemini model not available. Set GEMINI_MODEL in .env.local (e.g. gemini-2.0-flash-lite).'
  }
  if (msg.includes('API key not valid') || msg.includes('API_KEY_INVALID')) {
    return 'Invalid Gemini API key — check GEMINI_API_KEY in .env.local.'
  }
  const cleaned = msg
    .replace(/\[GoogleGenerativeAI Error\]:\s*/g, '')
    .replace(/Error fetching from [^\s]+:\s*/g, '')
    .split('\n')[0]
    ?.trim()
  if (!cleaned) return 'Gemini request failed'
  return cleaned.length > 220 ? `${cleaned.slice(0, 220)}…` : cleaned
}
