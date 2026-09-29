import { useCallback, useEffect, useRef, useState } from 'react'
import WebcamOverlay from './WebcamOverlay'
import {
  CAMERA_ID,
  FRAME_INTERVAL_MS,
  captureVideoFrame,
  getCameraWebSocketUrl,
} from './WebcamUtils'

const SOCKET_OPEN = 1
const MAX_BUFFERED_BYTES = 1_000_000

function WebcamConnection() {
  const videoRef = useRef(null)
  const captureCanvasRef = useRef(null)
  const streamRef = useRef(null)
  const socketRef = useRef(null)
  const frameTimerRef = useRef(null)
  const frameInFlightRef = useRef(false)

  const [cameraState, setCameraState] = useState('off')
  const [streamState, setStreamState] = useState('offline')
  const [errorMessage, setErrorMessage] = useState('')

  const stopFrameUpload = useCallback(() => {
    if (frameTimerRef.current !== null) {
      window.clearInterval(frameTimerRef.current)
      frameTimerRef.current = null
    }
    frameInFlightRef.current = false

    if (socketRef.current) {
      socketRef.current.close(1000, 'Camera stopped')
      socketRef.current = null
    }
    setStreamState('offline')
  }, [])

  const stopWebcam = useCallback(() => {
    stopFrameUpload()

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) videoRef.current.srcObject = null
    setCameraState('off')
  }, [stopFrameUpload])

  const startFrameUpload = useCallback(() => {
    const socket = new WebSocket(getCameraWebSocketUrl(CAMERA_ID))
    socket.binaryType = 'arraybuffer'
    socketRef.current = socket
    setStreamState('connecting')

    socket.addEventListener('open', () => {
      if (socketRef.current !== socket) return
      setStreamState('streaming')

      frameTimerRef.current = window.setInterval(async () => {
        if (
          frameInFlightRef.current ||
          socket.readyState !== SOCKET_OPEN ||
          socket.bufferedAmount > MAX_BUFFERED_BYTES
        ) {
          return
        }

        const video = videoRef.current
        const canvas = captureCanvasRef.current
        if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          return
        }

        frameInFlightRef.current = true
        try {
          const frame = await captureVideoFrame(video, canvas)
          if (socket.readyState === SOCKET_OPEN) socket.send(frame)
        } catch (error) {
          console.error('Unable to capture a webcam frame', error)
        } finally {
          frameInFlightRef.current = false
        }
      }, FRAME_INTERVAL_MS)
    })

    socket.addEventListener('error', () => {
      if (socketRef.current === socket) {
        setStreamState('error')
        setErrorMessage('The camera is on, but the backend stream is unavailable.')
      }
    })

    socket.addEventListener('close', (event) => {
      if (socketRef.current !== socket) return
      if (frameTimerRef.current !== null) {
        window.clearInterval(frameTimerRef.current)
        frameTimerRef.current = null
      }
      socketRef.current = null
      if (event.code !== 1000) setStreamState('error')
    })
  }, [])

  const startWebcam = useCallback(async () => {
    setErrorMessage('')
    setCameraState('starting')

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('off')
      setErrorMessage('Camera access requires a supported browser on HTTPS or localhost.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraState('on')
      startFrameUpload()
    } catch (error) {
      console.error('Unable to start the webcam', error)
      stopWebcam()
      setErrorMessage('Camera permission was denied or no camera is available.')
    }
  }, [startFrameUpload, stopWebcam])

  useEffect(() => stopWebcam, [stopWebcam])

  const isCameraOn = cameraState === 'on'

  return (
    <section className="camera-card" aria-labelledby="camera-title">
      <div className="camera-copy">
        <p className="eyebrow">Live movement capture</p>
        <h1 id="camera-title">OpenCV camera bridge</h1>
        <p>
          Start your camera to send JPEG frames to the local Python backend. Audio is
          never requested.
        </p>
      </div>

      <div className="camera-stage">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          aria-label="Live webcam preview"
        />
        <WebcamOverlay cameraState={cameraState} streamState={streamState} />
      </div>

      <canvas ref={captureCanvasRef} className="capture-canvas" aria-hidden="true" />

      <button
        type="button"
        className="camera-button"
        disabled={cameraState === 'starting'}
        onClick={isCameraOn ? stopWebcam : startWebcam}
      >
        {cameraState === 'starting' ? 'Starting…' : isCameraOn ? 'Stop camera' : 'Start camera'}
      </button>

      {errorMessage && (
        <p className="camera-error" role="alert">
          {errorMessage}
        </p>
      )}
    </section>
  )
}

export default WebcamConnection
