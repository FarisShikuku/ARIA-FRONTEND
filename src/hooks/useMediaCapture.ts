/**
 * useMediaCapture.ts
 *
 * CHANGES vs previous version:
 *
 * 1. facingMode PROP ADDED — defaults to 'user' (front camera)
 *    WHY: Previously hardcoded facingMode: 'environment' (rear camera) inside
 *    getUserMedia. Coach page needs the front camera (user faces it for coaching).
 *    Navigation needs the rear camera (points at the world for obstacle detection).
 *    Now the caller controls which camera is used via the facingMode prop.
 *    - Coach:      facingMode='user'        (default — front camera)
 *    - Navigation: facingMode='environment' (rear camera)
 *
 * 2. facingMode CHANGE TRIGGERS STREAM RESTART
 *    WHY: Browser MediaStream constraints cannot be changed on a live stream.
 *    The only way to switch cameras is to stop the current stream and call
 *    getUserMedia again with the new facingMode. When facingMode changes and
 *    the stream is active, stopCapture() + startCapture() is called automatically.
 *    This is what makes the flip button in VideoFeed work.
 *
 * Everything else is identical to the previous version.
 */

import { useRef, useState, useCallback, useEffect } from 'react'

interface UseMediaCaptureOptions {
  sendFrame: (data: ArrayBuffer) => void
  enabled?: boolean
  fps?: number
  quality?: number
  maxDimension?: number
  facingMode?: 'user' | 'environment'  // NEW — default 'user' (front camera)
}

export interface UseMediaCaptureReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>
  isCapturing: boolean
  startCapture: () => Promise<void>
  stopCapture: () => void
  error: string | null
}

// ── Binary frame builder ──────────────────────────────────────────────────────
// Wire format: [10-byte "video" header (zero-padded)] [raw JPEG bytes]
// Matches router.py: header = data[:10].decode().strip("\x00") → "video"

function buildVideoFrame(jpegBuffer: ArrayBuffer): ArrayBuffer {
  const frame = new Uint8Array(10 + jpegBuffer.byteLength)
  new TextEncoder().encode('video').forEach((b, i) => { frame[i] = b })
  frame.set(new Uint8Array(jpegBuffer), 10)
  return frame.buffer
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useMediaCapture({
  sendFrame,
  enabled = true,
  fps = 1,
  quality = 0.7,
  maxDimension = 768,
  facingMode = 'user',  // NEW — default front camera for coach; navigation passes 'environment'
}: UseMediaCaptureOptions): UseMediaCaptureReturn {

  const [isCapturing, setIsCapturing] = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const videoRef      = useRef<HTMLVideoElement | null>(null)
  const streamRef     = useRef<MediaStream | null>(null)
  const canvasRef     = useRef<HTMLCanvasElement | null>(null)
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const frameCountRef = useRef(0)
  const facingModeRef = useRef(facingMode)  // track current facing mode

  const sendFrameRef = useRef(sendFrame)
  useEffect(() => { sendFrameRef.current = sendFrame }, [sendFrame])

  // When facingMode prop changes while capturing → restart stream with new camera
  // WHY: getUserMedia constraints can't be updated on a live stream — must restart
  useEffect(() => {
    if (facingModeRef.current !== facingMode && isCapturing) {
      facingModeRef.current = facingMode
      // Stop current stream, restart with new facingMode
      stopCapture()
      startCapture()
    } else {
      facingModeRef.current = facingMode
    }
  }, [facingMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Frame capture ─────────────────────────────────────────────────────────

  const captureFrame = useCallback(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) {
      console.debug('[VIDEO-CAPTURE] captureFrame: video or canvas not ready')
      return
    }
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      console.debug(`[VIDEO-CAPTURE] captureFrame: video not ready (readyState=${video.readyState})`)
      return
    }

    const vw = video.videoWidth
    const vh = video.videoHeight
    if (!vw || !vh) {
      console.debug('[VIDEO-CAPTURE] captureFrame: video dimensions not available yet')
      return
    }

    const scale    = Math.min(maxDimension / vw, maxDimension / vh, 1.0)
    canvas.width   = Math.round(vw * scale)
    canvas.height  = Math.round(vh * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob((blob) => {
      if (!blob) return
      blob.arrayBuffer().then((jpegBuffer) => {
        const frame = buildVideoFrame(jpegBuffer)
        sendFrameRef.current(frame)

        frameCountRef.current++
        const n = frameCountRef.current
        if (n <= 5 || n % 30 === 0) {
          console.log(
            `[VIDEO-CAPTURE] 📤 Frame #${n}: ` +
            `${canvas.width}×${canvas.height}, ${jpegBuffer.byteLength}B JPEG`
          )
        }
      }).catch((err) => {
        console.warn('[VIDEO-CAPTURE] ⚠️ arrayBuffer() failed:', err)
      })
    }, 'image/jpeg', quality)
  }, [quality, maxDimension])

  // ── Start / stop ──────────────────────────────────────────────────────────

  const startCapture = useCallback(async () => {
    if (isCapturing) return
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Camera not supported in this environment')
      return
    }

    setError(null)
    console.log('[VIDEO-CAPTURE] 🎥 Requesting camera access…')

    try {
      // FIX: use facingModeRef.current not hardcoded 'environment'
      // Coach uses 'user' (front), Navigation uses 'environment' (rear)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingModeRef.current,
          width:  { ideal: 1280, max: 1920 },
          height: { ideal: 720,  max: 1080 },
        },
        audio: false,
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        try {
          await videoRef.current.play()
          console.log('[VIDEO-CAPTURE] ▶️ Video element playing')
        } catch {
          // play() rejection is non-fatal — autoPlay handles it on most browsers
        }
      } else {
        console.warn('[VIDEO-CAPTURE] ⚠️ videoRef.current is null — video element not mounted yet')
      }

      canvasRef.current   = document.createElement('canvas')
      frameCountRef.current = 0

      // Enforce minimum 1s interval (1 FPS — Gemini Live hard cap)
      const intervalMs = Math.max(Math.round(1000 / fps), 1000)
      intervalRef.current = setInterval(captureFrame, intervalMs)

      setIsCapturing(true)
      console.log(`[VIDEO-CAPTURE] ✅ Started — interval=${intervalMs}ms, quality=${quality}, maxDim=${maxDimension}`)

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Camera access failed'
      console.error('[VIDEO-CAPTURE] ❌ getUserMedia failed:', msg)
      setError(msg)
    }
  }, [isCapturing, fps, quality, maxDimension, captureFrame])

  const stopCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    console.log(`[VIDEO-CAPTURE] ⏹️ Stopped — sent ${frameCountRef.current} frames total`)
    setIsCapturing(false)
  }, [])

  // ── Auto-stop when disabled ───────────────────────────────────────────────
  useEffect(() => {
    if (!enabled && isCapturing) stopCapture()
  }, [enabled, isCapturing, stopCapture])

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => { stopCapture() }
  }, [stopCapture])

  return { videoRef, isCapturing, startCapture, stopCapture, error }
}