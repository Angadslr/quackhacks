import type { Zone, ZoneKind } from '../types/zone'

interface DevToolsProps {
  zones: Zone[]
  editing: boolean
  drawKind: ZoneKind
  onToggleEditing: () => void
  onDrawKindChange: (kind: ZoneKind) => void
  onClear: () => void
}

export function DevTools({
  zones,
  editing,
  drawKind,
  onToggleEditing,
  onDrawKindChange,
  onClear,
}: DevToolsProps) {
  const safeCount = zones.filter((z) => z.kind === 'safe').length
  const monitorCount = zones.filter((z) => z.kind === 'monitor').length

  return (
    <details className="mt-8 border-t border-guard-maroon-light/50 pt-3">
      <summary className="cursor-pointer list-none text-[11px] text-guard-maroon-light hover:text-guard-cream/40 [&::-webkit-details-marker]:hidden">
        <span className="font-mono uppercase tracking-wider">devtools</span>
        {zones.length > 0 && (
          <span className="ml-2 text-guard-maroon-light">
            · {monitorCount}m {safeCount}s
          </span>
        )}
      </summary>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
        <button
          type="button"
          onClick={onToggleEditing}
          className={`rounded px-2 py-0.5 transition ${
            editing
              ? 'bg-guard-maroon-light text-guard-cream'
              : 'text-guard-maroon-light hover:text-guard-cream/50'
          }`}
        >
          {editing ? 'done' : 'zones'}
        </button>

        {editing && (
          <>
            <button
              type="button"
              onClick={() => onDrawKindChange('monitor')}
              className={`rounded px-2 py-0.5 ${
                drawKind === 'monitor'
                  ? 'bg-guard-red/30 text-guard-red'
                  : 'text-guard-maroon-light hover:text-guard-cream/50'
              }`}
            >
              monitor
            </button>
            <button
              type="button"
              onClick={() => onDrawKindChange('safe')}
              className={`rounded px-2 py-0.5 ${
                drawKind === 'safe'
                  ? 'bg-guard-pool/20 text-guard-pool'
                  : 'text-guard-maroon-light hover:text-guard-cream/50'
              }`}
            >
              safe
            </button>
            <button
              type="button"
              onClick={onClear}
              className="text-guard-maroon-light hover:text-guard-cream/50"
            >
              clear
            </button>
            <span className="w-full text-guard-maroon-light">drag on video to draw</span>
          </>
        )}
      </div>
    </details>
  )
}
