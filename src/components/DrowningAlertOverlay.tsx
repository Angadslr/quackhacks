import { createPortal } from 'react-dom'

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

  return createPortal(
    <div
      className="drowning-alert-panel"
      role="alertdialog"
      aria-modal="false"
      aria-labelledby="drowning-alert-title"
      aria-describedby="drowning-alert-desc"
    >
      <div className="drowning-alert-panel-noise" aria-hidden />
      <div className="drowning-alert-card-body">
        <p
          id="drowning-alert-title"
          className="relative text-base font-bold uppercase leading-snug tracking-wide text-white"
        >
          Possible drowning detected
        </p>
        <p
          id="drowning-alert-desc"
          className="relative mt-3 text-sm leading-relaxed text-white/90"
        >
          Check the pool immediately
          {timeStr ? ` · ${timeStr}` : ''}
        </p>
        <p className="relative mt-4 text-xs leading-relaxed text-white/70">
          Gemini analysis appears in the incident replay below.
        </p>
      </div>
      <div className="drowning-alert-card-actions">
        <button
          type="button"
          onClick={onDismiss}
          className="relative w-full rounded-lg border-2 border-white/50 bg-black/25 px-3 py-2.5 text-sm font-medium text-white transition hover:border-white hover:bg-black/40"
        >
          Dismiss
        </button>
        <a
          href="tel:911"
          onClick={onDismiss}
          className="relative flex w-full items-center justify-center rounded-lg border-2 border-white bg-white px-3 py-2.5 text-center text-sm font-semibold leading-snug text-guard-red-dark transition hover:bg-guard-cream"
        >
          Contact emergency services
        </a>
      </div>
    </div>,
    document.body,
  )
}
