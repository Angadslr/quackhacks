import type { Zone, ZoneKind } from '../types/zone'

interface ZoneControlsProps {
  zones: Zone[]
  editing: boolean
  drawKind: ZoneKind
  onToggleEditing: () => void
  onDrawKindChange: (kind: ZoneKind) => void
  onClear: () => void
}

export function ZoneControls({
  zones,
  editing,
  drawKind,
  onToggleEditing,
  onDrawKindChange,
  onClear,
}: ZoneControlsProps) {
  const safeCount = zones.filter((z) => z.kind === 'safe').length
  const monitorCount = zones.filter((z) => z.kind === 'monitor').length

  return (
    <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-300">Detection zones</p>
          <p className="text-xs text-slate-500">
            {monitorCount} monitor · {safeCount} safe · calibrate where drowning
            detection runs
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleEditing}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            editing
              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
              : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
          }`}
        >
          {editing ? 'Done' : 'Edit zones'}
        </button>
      </div>

      {editing && (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-800 pt-3">
          <span className="text-xs text-slate-400">Draw:</span>
          <div className="flex overflow-hidden rounded-md border border-slate-700">
            <button
              type="button"
              onClick={() => onDrawKindChange('monitor')}
              className={`px-3 py-1 text-xs font-medium transition ${
                drawKind === 'monitor'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Monitor (detect)
            </button>
            <button
              type="button"
              onClick={() => onDrawKindChange('safe')}
              className={`px-3 py-1 text-xs font-medium transition ${
                drawKind === 'safe'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Safe (ignore)
            </button>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="ml-auto rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-red-600 hover:text-red-400"
          >
            Clear all
          </button>
          <p className="w-full text-xs text-slate-600">
            Drag on the video to draw a box. <strong className="text-emerald-400">Safe</strong>{' '}
            zones never alert. <strong className="text-red-400">Monitor</strong> zones flag
            movement as critical and score everyone inside as high risk.
          </p>
        </div>
      )}
    </div>
  )
}
