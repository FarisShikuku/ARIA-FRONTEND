/**
 * useMediaCapture.ts
 *
 * CAMERA DEFAULTS:
 *   - Coach:      facingMode='user'        → front camera (user faces it)
 *   - Navigation: facingMode='environment' → rear camera (points at world)
 *   - Assist:     facingMode='environment' → rear camera (points at task)
 *
 * SINGLE-CAMERA / NO REAR CAMERA FALLBACK:
 *   If getUserMedia fails with the requested facingMode (e.g. a laptop with
 *   only a front camera asked for 'environment'), we retry WITHOUT the
 *   facingMode constraint so the device's only available camera is used.
 *   This prevents a hard error on desktop browsers and single-camera phones.
 *
 *   We use { ideal: facingMode } (soft constraint) as the first attempt so
 *   browsers with both cameras pick the right one, but browsers with only one
 *   camera still succeed rather than throwing OverconstrainedError.
 *
 * CAMERA SWITCHING:
 *   Browser MediaStream constraints cannot be updated on a live stream.
 *   To switch cameras we must stop the current stream and call getUserMedia
 *   again with the new facingMode. The effect that watches facingMode uses
 *   refs so it always has fresh references to startCapture / stopCapture,
 *   avoiding the stale-closure bug present in the previous version.
 *
 * NEW EXPORT:
 *   hasMultipleCameras — true when the device reports > 1 video input.
 *   Components use this to conditionally show the flip-camera button.
 */

import { useRef, useState, useCallback, useEffect } from 'react'

interface UseMediaCaptureOptions {
  sendFrame:     (data: ArrayBuffer) => void
  enabled?:      boolean
  fps?:          number
  quality?:      number
  maxDimension?: number
  /** Which camera to open. Default: 'user' (front). Pass 'environment' for rear. */
  facingMode?:   'user' | 'environment'
}

export interface UseMediaCaptureReturn {
  videoRef:           React.RefObject<HTMLVideoElement | null>
  isCapturing:        boolean
  startCapture:       () => Promise<void>
  stopCapture:        () => void
  error:              string | null
  /** true when the device exposes more than one camera input (show flip button) */
  hasMultipleCameras: boolean
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

// ── Detect number of video input devices ─────────────────────────────────────
// Note: labels/deviceIds are only populated AFTER the user grants camera
// permission, so we call this after the first successful getUserMedia.

async function detectCameraCount(): Promise<number> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter(d => d.kind === 'videoinput').length
  } catch {
    return 1 // safe assumption: single camera if enumeration fails
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useMediaCapture({
  sendFrame,
  enabled      = true,
  fps          = 1,
  quality      = 0.7,
  maxDimension = 768,
  facingMode   = 'user',
}: UseMediaCaptureOptions): UseMediaCaptureReturn {

  const [isCapturing,        setIsCapturing]        = useState(false)
  const [error,              setError]              = useState<string | null>(null)
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false)

  const videoRef     = useRef<HTMLVideoElement | null>(null)
  const streamRef    = useRef<MediaStream | null>(null)
  const canvasRef    = useRef<HTMLCanvasElement | null>(null)
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const frameCountRef = useRef(0)

  // Refs so effects and callbacks always read the latest values without
  // needing them in dependency arrays (avoids stale-closure bugs).
  const facingModeRef  = useRef(facingMode)
  const isCapturingRef = useRef(false)
  const sendFrameRef   = useRef(sendFrame)

  useEffect(() => { sendFrameRef.current = sendFrame }, [sendFrame])

  // Sync isCapturing state into a ref so startCapture can read it safely
  useEffect(() => { isCapturingRef.current = isCapturing }, [isCapturing])

  // ── Frame capture ─────────────────────────────────────────────────────────

  const captureFrame = useCallback(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return

    const vw = video.videoWidth
    const vh = video.videoHeight
    if (!vw || !vh) return

    const scale   = Math.min(maxDimension / vw, maxDimension / vh, 1.0)
    canvas.width  = Math.round(vw * scale)
    canvas.height = Math.round(vh * scale)

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

  // ── Stop ──────────────────────────────────────────────────────────────────

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

    isCapturingRef.current = false
    console.log(`[VIDEO-CAPTURE] ⏹️ Stopped — sent ${frameCountRef.current} frames total`)
    setIsCapturing(false)
  }, [])

  // ── Start ─────────────────────────────────────────────────────────────────

  const startCapture = useCallback(async () => {
    if (isCapturingRef.current) return
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Camera not supported in this environment')
      return
    }

    setError(null)
    const targetFacing = facingModeRef.current
    console.log(`[VIDEO-CAPTURE] 🎥 Requesting camera — facingMode="${targetFacing}"`)

    let stream: MediaStream | null = null

    // Strategy: use { ideal: targetFacing } as a SOFT constraint first.
    // Devices with the requested camera will use it; single-camera devices
    // (laptops, basic phones) fall through to whatever camera they have
    // without throwing OverconstrainedError.
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: targetFacing },
          width:      { ideal: 1280, max: 1920 },
          height:     { ideal: 720,  max: 1080 },
        },
        audio: false,
      })
    } catch (firstErr) {
      // Soft constraint still failed (rare — some browsers treat 'ideal' as
      // 'exact' in certain contexts). Final fallback: no camera constraints.
      console.warn(
        `[VIDEO-CAPTURE] ⚠️ Camera request with facingMode="${targetFacing}" failed, ` +
        'retrying with no facingMode constraint (single-camera fallback)…', firstErr
      )
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width:  { ideal: 1280, max: 1920 },
            height: { ideal: 720,  max: 1080 },
          },
          audio: false,
        })
        console.log('[VIDEO-CAPTURE] ✅ Fallback camera opened (no facingMode constraint)')
      } catch (fallbackErr) {
        const msg = fallbackErr instanceof Error ? fallbackErr.message : 'Camera access failed'
        console.error('[VIDEO-CAPTURE] ❌ All getUserMedia attempts failed:', msg)
        setError(msg)
        return
      }
    }

    streamRef.current = stream

    // After permission is granted we can enumerate actual device count
    detectCameraCount().then(n => setHasMultipleCameras(n > 1))

    if (videoRef.current) {
      videoRef.current.srcObject = stream
      try {
        await videoRef.current.play()
        console.log('[VIDEO-CAPTURE] ▶️ Video element playing')
      } catch {
        // play() rejection is non-fatal — autoPlay handles it on most browsers
      }
    } else {
      console.warn('[VIDEO-CAPTURE] ⚠️ videoRef.current is null — video element not yet mounted')
    }

    canvasRef.current     = document.createElement('canvas')
    frameCountRef.current = 0

    const intervalMs    = Math.max(Math.round(1000 / fps), 1000)
    intervalRef.current = setInterval(captureFrame, intervalMs)

    isCapturingRef.current = true
    setIsCapturing(true)
    console.log(
      `[VIDEO-CAPTURE] ✅ Started — facing="${targetFacing}", ` +
      `interval=${intervalMs}ms, quality=${quality}, maxDim=${maxDimension}`
    )
  }, [fps, quality, maxDimension, captureFrame])
  // NOTE: isCapturing intentionally not in deps — we read from isCapturingRef

  // ── React to facingMode prop changes (camera flip) ────────────────────────

  useEffect(() => {
    const prev = facingModeRef.current
    facingModeRef.current = facingMode

    if (prev !== facingMode && isCapturingRef.current) {
      console.log(`[VIDEO-CAPTURE] 🔄 facingMode changed ${prev} → ${facingMode}, restarting stream`)
      stopCapture()
      // Small delay so stopCapture's state update settles before startCapture
      // reads isCapturingRef.current (which stopCapture sets to false synchronously)
      setTimeout(() => { startCapture() }, 80)
    }
  }, [facingMode, stopCapture, startCapture])

  // ── Auto-stop when disabled ───────────────────────────────────────────────
  useEffect(() => {
    if (!enabled && isCapturing) stopCapture()
  }, [enabled, isCapturing, stopCapture])

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => { stopCapture() }
  }, [stopCapture])

  return { videoRef, isCapturing, startCapture, stopCapture, error, hasMultipleCameras }
}