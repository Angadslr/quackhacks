import { useRef, useState } from 'react'
import type { Zone, ZoneKind } from '../types/zone'

interface ZoneOverlayProps {
  zones: Zone[]
  editing: boolean
  drawKind: ZoneKind
  onCreate: (zone: Omit<Zone, 'id'>) => void
  onRemove: (id: string) => void
}

interface DraftRect {
  x: number
  y: number
  width: number
  height: number
}

const MIN_SIZE = 0.03

function kindStyles(kind: ZoneKind): { border: string; bg: string; text: string } {
  if (kind === 'safe') {
    return {
      border: 'border-guard-pool',
      bg: 'bg-guard-pool/15',
      text: 'text-guard-pool',
    }
  }
  return {
    border: 'border-guard-red',
    bg: 'bg-guard-red/15',
    text: 'text-guard-red',
  }
}

export function ZoneOverlay({
  zones,
  editing,
  drawKind,
  onCreate,
  onRemove,
}: ZoneOverlayProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<DraftRect | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)

  const toNorm = (clientX: number, clientY: number) => {
    const el = ref.current
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    }
  }

  const handleDown = (e: React.MouseEvent) => {
    if (!editing) return
    e.preventDefault()
    const p = toNorm(e.clientX, e.clientY)
    startRef.current = p
    setDraft({ x: p.x, y: p.y, width: 0, height: 0 })
  }

  const handleMove = (e: React.MouseEvent) => {
    if (!editing || !startRef.current) return
    const p = toNorm(e.clientX, e.clientY)
    const s = startRef.current
    setDraft({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      width: Math.abs(p.x - s.x),
      height: Math.abs(p.y - s.y),
    })
  }

  const handleUp = () => {
    if (!editing) return
    const d = draft
    startRef.current = null
    setDraft(null)
    if (d && d.width >= MIN_SIZE && d.height >= MIN_SIZE) {
      onCreate({ kind: drawKind, x: d.x, y: d.y, width: d.width, height: d.height })
    }
  }

  if (!editing) return null

  return (
    <div
      ref={ref}
      className="absolute inset-0 cursor-crosshair"
      onMouseDown={handleDown}
      onMouseMove={handleMove}
      onMouseUp={handleUp}
      onMouseLeave={handleUp}
    >
      {zones.map((zone) => {
        const s = kindStyles(zone.kind)
        return (
          <div
            key={zone.id}
            className={`absolute border-2 ${s.border} ${s.bg}`}
            style={{
              left: `${zone.x * 100}%`,
              top: `${zone.y * 100}%`,
              width: `${zone.width * 100}%`,
              height: `${zone.height * 100}%`,
            }}
          >
            <span
              className={`absolute left-0 top-0 px-1 text-[10px] font-semibold uppercase tracking-wide ${s.text} bg-black/50`}
            >
              {zone.kind === 'safe' ? 'Safe' : 'Monitor'}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRemove(zone.id)
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="pointer-events-auto absolute right-0 top-0 flex h-5 w-5 items-center justify-center bg-black/60 text-xs text-white hover:bg-guard-red"
              aria-label="Delete zone"
            >
              ×
            </button>
          </div>
        )
      })}

      {draft && (
        <div
          className={`absolute border-2 border-dashed ${
            drawKind === 'safe'
              ? 'border-guard-pool bg-guard-pool/10'
              : 'border-guard-red bg-guard-red/10'
          }`}
          style={{
            left: `${draft.x * 100}%`,
            top: `${draft.y * 100}%`,
            width: `${draft.width * 100}%`,
            height: `${draft.height * 100}%`,
          }}
        />
      )}
    </div>
  )
}
