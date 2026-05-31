interface DrowningAlertOverlayProps {
  alertTime: Date | null
  onDismiss: () => void
}

export function DrowningAlertOverlay({
  alertTime,
  onDismiss,
}: DrowningAlertOverlayProps) {
  const timeStr = alertTime
    ? alertTime.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : ''

  return (
    <>
      <div
        className="drowning-flash pointer-events-none fixed inset-0 z-40"
        aria-hidden
      />
      <div className="fixed inset-x-0 top-0 z-50 px-3 pt-3">
        <div
          role="alert"
          className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-guard-red bg-guard-maroon-deep/95 px-4 py-3 shadow-lg shadow-guard-red/30 backdrop-blur-sm"
        >
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold uppercase tracking-wide text-guard-red">
              Possible drowning detected
            </p>
            <p className="text-sm text-guard-cream">
              Check the pool immediately
              {timeStr ? ` · ${timeStr}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg border border-guard-maroon-light px-4 py-2 text-sm font-medium text-guard-cream transition hover:border-guard-cream/40 hover:bg-guard-maroon-mid"
            >
              Dismiss
            </button>
            <a
              href="tel:911"
              className="guard-btn-primary inline-flex items-center px-4 py-2 text-sm"
            >
              Contact emergency services
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
