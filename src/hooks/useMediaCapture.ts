/**
 * useMediaCapture.ts
 *
 * Captures camera frames for ARIA navigation mode and sends them to the backend
 * as binary WebSocket frames.
 *
 * Frame wire format:
 *   [10-byte "video" header (zero-padded)] [raw JPEG bytes]
 *
 * This matches what router.py's handle_binary_message() expects:
 *   header = data[:10].decode().strip("\x00")  → "video"
 *   payload = data[10:]                         → JPEG bytes
 *
 * Which then calls:
 *   video_handler.handle(connection_id, session_id, payload, session_mode)
 *
 * Key design decisions:
 *   - 1 FPS (Gemini Live hard cap — enforced server-side too)
 *   - Rear camera ('environment') for navigation
 *   - Max 768×768 (Gemini's optimal resolution from docs)
 *   - toBlob('image/jpeg', 0.7) for good quality/size balance
 *   - Accepts a wsRef so it shares the same WS as useGeminiLive
 *     (avoids a second WS connection for the same session_id)
 *
 * Usage:
 *   // Get wsRef from useNavigationSession which exposes it from useGeminiLive
 *   const { videoRef, startCapture, stopCapture, isCapturing } = useMediaCapture({
 *     wsRef,
 *     enabled: sessionActive,
 *   })
 *   <video ref={videoRef} autoPlay muted playsInline className="..." />
 */

import { useRef, useState, useCallback, useEffect } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface UseMediaCaptureOptions {
  /** WebSocket ref — must be the SAME ws as used by useGeminiLive */
  wsRef: React.MutableRefObject<WebSocket | null>
  /** Only capture when true */
  enabled?: boolean
  /** Frames per second (default: 1 — Gemini Live max) */
  fps?: number
  /** JPEG quality 0–1 (default: 0.7) */
  quality?: number
  /** Max canvas dimension — Gemini optimal is 768 (default: 768) */
  maxDimension?: number
}

export interface UseMediaCaptureReturn {
  /** Attach to <video> element to show camera preview */
  videoRef: React.RefObject<HTMLVideoElement | null>
  isCapturing: boolean
  startCapture: () => Promise<void>
  stopCapture: () => void
  error: string | null
}

// ── Binary frame builder ──────────────────────────────────────────────────────

function buildVideoFrame(jpegBuffer: ArrayBuffer): ArrayBuffer {
  const header = new Uint8Array(10)
  // Write "video" into first 5 bytes, rest stays 0x00
  new TextEncoder().encode('video').forEach((b, i) => { header[i] = b })

  const frame = new Uint8Array(10 + jpegBuffer.byteLength)
  frame.set(header, 0)
  frame.set(new Uint8Array(jpegBuffer), 10)
  return frame.buffer
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useMediaCapture({
  wsRef,
  enabled = true,
  fps = 1,
  quality = 0.7,
  maxDimension = 768,
}: UseMediaCaptureOptions): UseMediaCaptureReturn {

  const [isCapturing, setIsCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const videoRef   = useRef<HTMLVideoElement | null>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const canvasRef  = useRef<HTMLCanvasElement | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const frameCountRef = useRef(0)

  // ── Frame capture ─────────────────────────────────────────────────────────

  const captureFrame = useCallback(() => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return

    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return

    const vw = video.videoWidth
    const vh = video.videoHeight
    if (!vw || !vh) return

    // Scale to fit within maxDimension while maintaining aspect ratio
    const scale = Math.min(maxDimension / vw, maxDimension / vh, 1.0)
    canvas.width  = Math.round(vw * scale)
    canvas.height = Math.round(vh * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Encode as JPEG and send
    canvas.toBlob((blob) => {
      if (!blob) return
      blob.arrayBuffer().then((jpegBuffer) => {
        const ws = wsRef.current  // Re-check inside async callback
        if (!ws || ws.readyState !== WebSocket.OPEN) return

        const frame = buildVideoFrame(jpegBuffer)
        ws.send(frame)

        frameCountRef.current++
        const n = frameCountRef.current
        if (n <= 5 || n % 60 === 0) {
          console.log(
            `[VIDEO-CAPTURE] 📤 Frame #${n}: ` +
            `${canvas.width}×${canvas.height}, ${jpegBuffer.byteLength}B`
          )
        }
      }).catch((err) => {
        console.warn('[VIDEO-CAPTURE] ⚠️ toBlob→arrayBuffer failed:', err)
      })
    }, 'image/jpeg', quality)
  }, [wsRef, quality, maxDimension])

  // ── Start / stop ──────────────────────────────────────────────────────────

  const startCapture = useCallback(async () => {
    if (isCapturing) return
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setError('Camera not supported in this environment')
      return
    }

    setError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',    // Rear camera for navigation
          width:  { ideal: 1280, max: 1920 },
          height: { ideal: 720,  max: 1080 },
        },
        audio: false,                   // Audio handled by useGeminiLive
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {
          // play() rejection is non-fatal — autoPlay handles it
        })
      }

      // Create off-screen canvas for frame encoding
      canvasRef.current = document.createElement('canvas')
      frameCountRef.current = 0

      const intervalMs = Math.max(Math.round(1000 / fps), 1000)  // Min 1s (1 FPS)
      intervalRef.current = setInterval(captureFrame, intervalMs)

      setIsCapturing(true)
      console.log(
        `[VIDEO-CAPTURE] ✅ Started — ${fps} FPS, ` +
        `quality=${quality}, maxDim=${maxDimension}`
      )

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Camera access failed'
      console.error('[VIDEO-CAPTURE] ❌', msg)
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

    setIsCapturing(false)
    console.log(`[VIDEO-CAPTURE] ⏹️ Stopped — sent ${frameCountRef.current} frames total`)
  }, [])

  // ── Auto-stop when disabled ───────────────────────────────────────────────
  useEffect(() => {
    if (!enabled && isCapturing) {
      stopCapture()
    }
  }, [enabled, isCapturing, stopCapture])

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => { stopCapture() }
  }, [stopCapture])

  return { videoRef, isCapturing, startCapture, stopCapture, error }
}