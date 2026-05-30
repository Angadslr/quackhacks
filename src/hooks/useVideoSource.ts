import { useCallback, useEffect, useRef, useState } from 'react'
import type { VideoSourceMode } from '../types/videoSource'

interface UseVideoSourceOptions {
  mode: VideoSourceMode
  videoFile: File | null
  isMonitoring: boolean
  loop: boolean
}

interface UseVideoSourceResult {
  videoRef: React.RefObject<HTMLVideoElement | null>
  error: string | null
  isReady: boolean
  mirrored: boolean
  fileName: string | null
  videoDuration: number
  videoCurrentTime: number
}

export function useVideoSource({
  mode,
  videoFile,
  isMonitoring,
  loop,
}: UseVideoSourceOptions): UseVideoSourceResult {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [videoDuration, setVideoDuration] = useState(0)
  const [videoCurrentTime, setVideoCurrentTime] = useState(0)

  const stopWebcam = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const revokeBlob = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
  }, [])

  const resetVideoElement = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.pause()
    video.srcObject = null
    video.removeAttribute('src')
    video.load()
    setIsReady(false)
    setVideoDuration(0)
    setVideoCurrentTime(0)
  }, [])

  // Load video file when selected
  useEffect(() => {
    if (mode !== 'file') {
      revokeBlob()
      setFileName(null)
      return
    }

    if (!videoFile) {
      revokeBlob()
      resetVideoElement()
      setFileName(null)
      return
    }

    let cancelled = false
    let rafId = 0
    let videoEl: HTMLVideoElement | null = null
    let onLoaded: (() => void) | null = null
    let onError: (() => void) | null = null

    function cleanupListeners() {
      if (videoEl && onLoaded && onError) {
        videoEl.removeEventListener('loadedmetadata', onLoaded)
        videoEl.removeEventListener('error', onError)
      }
    }

    function attachFile() {
      if (cancelled) return

      const video = videoRef.current
      if (!video) {
        rafId = requestAnimationFrame(attachFile)
        return
      }

      cleanupListeners()
      revokeBlob()
      resetVideoElement()

      videoEl = video
      const url = URL.createObjectURL(videoFile!)
      blobUrlRef.current = url
      setFileName(videoFile!.name)
      setError(null)
      setIsReady(false)

      onLoaded = () => {
        if (cancelled) return
        setVideoDuration(video.duration || 0)
        setIsReady(true)
        video.currentTime = 0
      }

      onError = () => {
        if (cancelled) return
        setError('Could not load video file.')
        setIsReady(false)
      }

      video.addEventListener('loadedmetadata', onLoaded)
      video.addEventListener('error', onError)
      video.src = url
      video.loop = loop
      video.muted = true
      video.load()
    }

    attachFile()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      cleanupListeners()
    }
  }, [mode, videoFile, loop, revokeBlob, resetVideoElement])

  // Webcam stream
  useEffect(() => {
    if (mode !== 'webcam') {
      stopWebcam()
      return
    }

    if (!isMonitoring) {
      stopWebcam()
      resetVideoElement()
      return
    }

    let cancelled = false

    async function start() {
      try {
        setError(null)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
          audio: false,
        })

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          video.loop = false
          await video.play()
          setIsReady(true)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Camera access denied. Please allow webcam permission.',
          )
          setIsReady(false)
        }
      }
    }

    void start()

    return () => {
      cancelled = true
      stopWebcam()
    }
  }, [mode, isMonitoring, stopWebcam, resetVideoElement])

  // Play/pause file video during monitoring
  useEffect(() => {
    const video = videoRef.current
    if (!video || mode !== 'file' || !isReady) return

    video.loop = loop

    if (isMonitoring) {
      video.currentTime = 0
      void video.play().catch(() => {
        setError('Could not play video.')
      })
    } else {
      video.pause()
      video.currentTime = 0
      setVideoCurrentTime(0)
    }
  }, [mode, isMonitoring, isReady, loop, videoFile])

  // Track playback progress for file mode
  useEffect(() => {
    const video = videoRef.current
    if (!video || mode !== 'file') return

    const onTimeUpdate = () => setVideoCurrentTime(video.currentTime)
    video.addEventListener('timeupdate', onTimeUpdate)
    return () => video.removeEventListener('timeupdate', onTimeUpdate)
  }, [mode, isMonitoring, isReady])

  useEffect(() => {
    return () => {
      stopWebcam()
      revokeBlob()
    }
  }, [stopWebcam, revokeBlob])

  return {
    videoRef,
    error,
    isReady,
    mirrored: mode === 'webcam',
    fileName,
    videoDuration,
    videoCurrentTime,
  }
}
