import { SkeletonCanvas } from './SkeletonCanvas'
import type { TrackedPerson } from '../types/person'
import type { VideoSourceMode } from '../types/videoSource'

interface VideoFeedProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  people: TrackedPerson[]
  isMonitoring: boolean
  mirrored: boolean
  sourceMode: VideoSourceMode
  isReady: boolean
  fileName: string | null
  videoDuration: number
  videoCurrentTime: number
}

export function VideoFeed({
  videoRef,
  people,
  isMonitoring,
  mirrored,
  sourceMode,
  isReady,
  fileName,
  videoDuration,
  videoCurrentTime,
}: VideoFeedProps) {
  return (
    <SkeletonCanvas
      videoRef={videoRef}
      people={people}
      isMonitoring={isMonitoring}
      mirrored={mirrored}
      sourceMode={sourceMode}
      isReady={isReady}
      fileName={fileName}
      videoDuration={videoDuration}
      videoCurrentTime={videoCurrentTime}
    />
  )
}
