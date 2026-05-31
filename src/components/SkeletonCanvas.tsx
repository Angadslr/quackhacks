import { useEffect, useRef } from 'react'
import type { TrackedPerson } from '../types/person'
import type { VideoSourceMode } from '../types/videoSource'
import type { Zone, ZoneKind } from '../types/zone'
import { drawSceneWithVideo, drawVideoFrame } from '../utils/skeletonRenderer'
import { ZoneOverlay } from './ZoneOverlay'

const CANVAS_WIDTH = 640
const CANVAS_HEIGHT = 480

interface SkeletonCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  people: TrackedPerson[]
  isMonitoring: boolean
  mirrored: boolean
  sourceMode: VideoSourceMode
  isReady: boolean
  fileName: string | null
  videoDuration: number
  videoCurrentTime: number
  zones: Zone[]
  zoneEditing: boolean
  zoneDrawKind: ZoneKind
  onZoneCreate: (zone: Omit<Zone, 'id'>) => void
  onZoneRemove: (id: string) => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function SkeletonCanvas({
  videoRef,
  people,
  isMonitoring,
  mirrored,
  sourceMode,
  isReady,
  fileName,
  videoDuration,
  videoCurrentTime,
  zones,
  zoneEditing,
  zoneDrawKind,
  onZoneCreate,
  onZoneRemove,
}: SkeletonCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const peopleRef = useRef(people)

  peopleRef.current = people

  useEffect(() => {
    const render = () => {
      const canvas = canvasRef.current
      const video = videoRef.current
      const ctx = canvas?.getContext('2d')

      if (!canvas || !ctx) return

      if (isMonitoring) {
        drawSceneWithVideo(
          ctx,
          video,
          peopleRef.current,
          CANVAS_WIDTH,
          CANVAS_HEIGHT,
          mirrored,
        )
      } else if (
        sourceMode === 'file' &&
        isReady &&
        video &&
        video.readyState >= 2
      ) {
        drawVideoFrame(ctx, video, CANVAS_WIDTH, CANVAS_HEIGHT, mirrored)
      } else {
        ctx.fillStyle = '#0f172a'
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      }

      rafRef.current = requestAnimationFrame(render)
    }

    rafRef.current = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [videoRef, isMonitoring, mirrored, sourceMode, isReady])

  const placeholder =
    sourceMode === 'file'
      ? 'Choose a video file, then click Run Video Analysis'
      : 'Click Start Monitoring to begin'

  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
      />
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="block w-full max-w-full"
      />
      {zoneEditing && (
        <ZoneOverlay
          zones={zones}
          editing={zoneEditing}
          drawKind={zoneDrawKind}
          onCreate={onZoneCreate}
          onRemove={onZoneRemove}
        />
      )}
      {!isMonitoring && !isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
          <p className="px-4 text-center text-slate-400">{placeholder}</p>
        </div>
      )}
      {isMonitoring && people.length > 0 && (
        <div className="absolute left-2 top-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
          {people.length} {people.length === 1 ? 'person' : 'people'} tracked
        </div>
      )}
      {sourceMode === 'file' && fileName && (
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between rounded bg-black/60 px-2 py-1 text-xs text-white">
          <span className="truncate">{fileName}</span>
          {isMonitoring && videoDuration > 0 && (
            <span className="ml-2 shrink-0 font-mono">
              {formatTime(videoCurrentTime)} / {formatTime(videoDuration)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export { CANVAS_WIDTH, CANVAS_HEIGHT }
