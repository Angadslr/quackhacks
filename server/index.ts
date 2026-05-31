import { createServer } from 'node:http'
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { formatGeminiError, generateIncidentBriefing } from './geminiService.js'
import type { IncidentBriefingRequest } from './types.js'

config({ path: resolve(process.cwd(), '.env.local') })
config()

const PORT = Number(process.env.GEMINI_API_PORT ?? 3001)
const API_KEY = process.env.GEMINI_API_KEY

function readJsonBody(req: import('node:http').IncomingMessage): Promise<unknown> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolvePromise(raw ? JSON.parse(raw) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(
  res: import('node:http').ServerResponse,
  status: number,
  data: unknown,
): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(JSON.stringify(data))
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  if (req.url === '/api/health' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, hasKey: Boolean(API_KEY) })
    return
  }

  if (req.url !== '/api/incident-briefing' || req.method !== 'POST') {
    sendJson(res, 404, { error: 'Not found' })
    return
  }

  if (!API_KEY) {
    sendJson(res, 500, {
      error: 'GEMINI_API_KEY is not set. Add it to .env.local',
    })
    return
  }

  try {
    const body = (await readJsonBody(req)) as IncidentBriefingRequest
    const result = await generateIncidentBriefing(API_KEY, body)
    sendJson(res, 200, result)
  } catch (err) {
    console.error('[gemini]', err)
    sendJson(res, 500, { error: formatGeminiError(err) })
  }
})

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[myguard-api] Port ${PORT} is in use. Stop the other process (lsof -ti:${PORT} | xargs kill) or set GEMINI_API_PORT in .env.local`,
    )
    process.exit(1)
  }
  throw err
})

server.listen(PORT, () => {
  console.log(`[myguard-api] http://localhost:${PORT}`)
  if (!API_KEY) {
    console.warn('[myguard-api] Warning: GEMINI_API_KEY missing')
  }
})
