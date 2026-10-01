import { useCallback, useEffect, useRef, useState } from 'react'
import WebcamOverlay from './WebcamOverlay'
import {
  CAMERA_ID,
  FRAME_INTERVAL_MS,
  captureVideoFrame,
  getProcessedCameraUrl,
  getCameraWebSocketUrl,
} from './WebcamUtils'

//socket_open is the value for the browser to open the websocket.
const SOCKET_OPEN = 1
const MAX_BUFFERED_BYTES = 1_000_000

function WebcamConnection() {
  //refs for video, canvas, media stream, socket, timer, and upload status
  const videoRef = useRef(null)
  const captureCanvasRef = useRef(null)
  const streamRef = useRef(null)
  const socketRef = useRef(null)
  const frameTimerRef = useRef(null)
  const frameInFlightRef = useRef(false)

  //creates a state variable with the function to change its state
  const [cameraState, setCameraState] = useState('off')
  const [streamState, setStreamState] = useState('offline')
  const [errorMessage, setErrorMessage] = useState('')

  //stops uploading frames but camera is not stopped yet
  const stopFrameUpload = useCallback(() => {
    if (frameTimerRef.current !== null) {
      window.clearInterval(frameTimerRef.current)
      frameTimerRef.current = null
    }
    frameInFlightRef.current = false

    //ensures it sets the socket to null when stopped
    if (socketRef.current) {
      socketRef.current.close(1000, 'Camera stopped')
      socketRef.current = null
    }
    setStreamState('offline')
  }, [])

  //stops the camera tracks then clears the video then becomes off
  const stopWebcam = useCallback(() => {
    stopFrameUpload()

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) videoRef.current.srcObject = null
    setCameraState('off')
  }, [stopFrameUpload])

  //when cmarea starts sets the socketRef to socket and begins to pushframes
  const startFrameUpload = useCallback(() => {
    const socket = new WebSocket(getCameraWebSocketUrl(CAMERA_ID))
    socket.binaryType = 'arraybuffer'
    socketRef.current = socket
    setStreamState('connecting')

    //socket is opened
    socket.addEventListener('open', () => {
      if (socketRef.current !== socket) return
      setStreamState('streaming')

      //schedules the frame capture and uploads
      frameTimerRef.current = window.setInterval(async () => {
        if (
          frameInFlightRef.current ||
          socket.readyState !== SOCKET_OPEN ||
          socket.bufferedAmount > MAX_BUFFERED_BYTES
        ) {
          return
        }

        //grabs the video and canvas references
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

    //listens for error
    socket.addEventListener('error', () => {
      if (socketRef.current === socket) {
        setStreamState('error')
        setErrorMessage('The camera is on, but the backend stream is unavailable.')
      }
    })

    //listens for close
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

  //starts camera and sets the stream to a specific size the browser prefers
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
      //sets camera state to on and starts uploading frames
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
        {isCameraOn && streamState === 'streaming' && (
          <img
            className="processed-camera"
            src={getProcessedCameraUrl(CAMERA_ID)}
            alt="Live webcam with body skeleton overlay"
          />
        )}
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
