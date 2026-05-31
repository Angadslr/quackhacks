import { useCallback, useEffect, useState } from 'react'
import type { Zone } from '../types/zone'

const STORAGE_KEY = 'poolguard.zones.v1'

function loadZones(): Zone[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (z) =>
        z &&
        (z.kind === 'safe' || z.kind === 'monitor') &&
        typeof z.x === 'number' &&
        typeof z.y === 'number' &&
        typeof z.width === 'number' &&
        typeof z.height === 'number',
    )
  } catch {
    return []
  }
}

export interface UseZonesResult {
  zones: Zone[]
  addZone: (zone: Omit<Zone, 'id'>) => void
  removeZone: (id: string) => void
  clearZones: () => void
}

export function useZones(): UseZonesResult {
  const [zones, setZones] = useState<Zone[]>(() => loadZones())

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(zones))
    } catch {
      // ignore persistence failures (private mode, quota, etc.)
    }
  }, [zones])

  const addZone = useCallback((zone: Omit<Zone, 'id'>) => {
    setZones((prev) => [...prev, { ...zone, id: crypto.randomUUID() }])
  }, [])

  const removeZone = useCallback((id: string) => {
    setZones((prev) => prev.filter((z) => z.id !== id))
  }, [])

  const clearZones = useCallback(() => {
    setZones([])
  }, [])

  return { zones, addZone, removeZone, clearZones }
}
