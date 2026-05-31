export type ZoneKind = 'safe' | 'monitor'

/** A calibration rectangle in normalized (0–1) video coordinates. */
export interface Zone {
  id: string
  kind: ZoneKind
  x: number
  y: number
  width: number
  height: number
}

export function zoneContains(zone: Zone, p: { x: number; y: number }): boolean {
  return (
    p.x >= zone.x &&
    p.x <= zone.x + zone.width &&
    p.y >= zone.y &&
    p.y <= zone.y + zone.height
  )
}

export type ZoneVerdict = 'safe' | 'monitor' | 'auto'

/**
 * Decide how a point should be treated given the calibrated zones:
 *  - 'safe'    → never alert here (safe zones always win)
 *  - 'monitor' → run drowning detection here
 *  - 'auto'    → no zone applies; fall back to automatic heuristics
 *
 * If any monitor zones exist, detection is restricted to them (everything else
 * outside a safe/monitor zone becomes safe). If only safe zones exist, the rest
 * of the frame uses automatic detection.
 */
export function zoneVerdict(
  zones: Zone[],
  p: { x: number; y: number },
): ZoneVerdict {
  if (zones.length === 0) return 'auto'

  let hasMonitor = false
  let inSafe = false
  let inMonitor = false

  for (const z of zones) {
    if (z.kind === 'monitor') hasMonitor = true
    if (zoneContains(z, p)) {
      if (z.kind === 'safe') inSafe = true
      else inMonitor = true
    }
  }

  if (inSafe) return 'safe'
  if (hasMonitor) return inMonitor ? 'monitor' : 'safe'
  return 'auto'
}
