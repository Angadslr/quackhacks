import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { getTorsoMidpoints } from './poseMath'

interface TrackedSlot {
  id: number
  lastHip: { x: number; y: number }
  lastSeen: number
}

const MATCH_THRESHOLD_SQ = 0.04
const STALE_MS = 2000

export class PersonTracker {
  private slots: TrackedSlot[] = []
  private nextId = 1

  assignIds(poses: NormalizedLandmark[][], timestamp: number): number[] {
    const usedSlots = new Set<number>()
    const ids: number[] = []

    for (const landmarks of poses) {
      const mid = getTorsoMidpoints(landmarks)
      const hip = mid?.hipMid ?? { x: 0.5, y: 0.5 }

      let bestIdx = -1
      let bestDist = Infinity

      for (let i = 0; i < this.slots.length; i++) {
        if (usedSlots.has(i)) continue
        const slot = this.slots[i]
        if (timestamp - slot.lastSeen > STALE_MS) continue

        const dx = hip.x - slot.lastHip.x
        const dy = hip.y - slot.lastHip.y
        const dist = dx * dx + dy * dy
        if (dist < bestDist) {
          bestDist = dist
          bestIdx = i
        }
      }

      if (bestIdx >= 0 && bestDist < MATCH_THRESHOLD_SQ) {
        usedSlots.add(bestIdx)
        this.slots[bestIdx].lastHip = hip
        this.slots[bestIdx].lastSeen = timestamp
        ids.push(this.slots[bestIdx].id)
      } else {
        const id = this.nextId++
        this.slots.push({ id, lastHip: hip, lastSeen: timestamp })
        ids.push(id)
      }
    }

    this.slots = this.slots.filter((s) => timestamp - s.lastSeen <= STALE_MS)

    return ids
  }

  reset(): void {
    this.slots = []
    this.nextId = 1
  }
}
