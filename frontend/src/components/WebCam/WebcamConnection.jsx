import { useCallback, useEffect, useRef, useState } from 'react'
import WebcamOverlay from './WebcamOverlay'
import {
  CAMERA_ID,
  FRAME_INTERVAL_MS,
  captureVideoFrame,
  getProcessedCameraUrl,
  getCameraWebSocketUrl,
  startExerciseRecording,
  getCameraCalibration,
  recalibrateCamera,
} from './WebcamUtils'

//socket_open is the value for the browser to open the websocket.
const SOCKET_OPEN = 1
const MAX_BUFFERED_BYTES = 1_000_000

function WebcamConnection({ exercise = 'Exercise', debugExpanded = false, onToggleDebug }) {
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
  const [calibration, setCalibration] = useState(null)
  const [recalibrating, setRecalibrating] = useState(false)

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
    setCalibration(null)
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
    //pass the selected exercise so the backend names its set and rep outputs.
    const socket = new WebSocket(getCameraWebSocketUrl(CAMERA_ID, exercise))
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
  }, [exercise])

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

  useEffect(() => {
    if (streamState !== 'streaming') return
    const controller = new AbortController()
    let timer
    const poll = async () => {
      try {
        const status = await getCameraCalibration(CAMERA_ID, controller.signal)
        if (!controller.signal.aborted) setCalibration(status)
      } catch (error) {
        if (!controller.signal.aborted) {
          setCalibration({ message: `Tracking status unavailable: ${error.message}` })
        }
      } finally {
        if (!controller.signal.aborted) timer = window.setTimeout(poll, 500)
      }
    }
    poll()
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [streamState])

  const handleRecalibrate = async () => {
    setRecalibrating(true)
    setErrorMessage('')
    try {
      setCalibration(await recalibrateCamera(CAMERA_ID))
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setRecalibrating(false)
    }
  }

  useEffect(() => {
    if (cameraState !== 'on') return
    //chnging the excersise while camera stays on resets partial recordings backend
    //backend preserves the set number for repeated starts of the same name excersises
    startExerciseRecording(CAMERA_ID, exercise).catch((error) => {
      console.error('Unable to start exercise vector recording', error)
      setErrorMessage(error.message)
    })
  }, [cameraState, exercise])

  const isCameraOn = cameraState === 'on'

  return (
    <section className="camera-card" aria-labelledby="camera-title">
      <div className="camera-copy">
        <h2 id="camera-title">Live form check</h2>
        <p>
          Start your camera, step back until your full body is visible, and hold
          both arms straight out at shoulder height for two seconds. Face a light
          source while calibrating.
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

      <div className="camera-controls">
        <button
          type="button"
          className="cam-btn cam-btn--primary"
          disabled={cameraState === 'starting'}
          onClick={isCameraOn ? stopWebcam : startWebcam}
        >
          {cameraState === 'starting' ? 'Starting…' : isCameraOn ? 'Stop camera' : 'Start camera'}
        </button>
        <button
          type="button"
          className="cam-btn cam-btn--ghost"
          disabled={!isCameraOn || streamState !== 'streaming' || recalibrating}
          onClick={handleRecalibrate}
        >
          {recalibrating ? 'Resetting…' : 'Recalibrate T-pose'}
        </button>
        <button
          type="button"
          className="cam-btn cam-btn--ghost"
          aria-pressed={debugExpanded}
          onClick={onToggleDebug}
        >
          {debugExpanded ? 'Exit debug view' : 'Expand debug view'}
        </button>
      </div>

      {isCameraOn && streamState === 'streaming' && calibration && (
        <div className="camera-calibration" role="status">
          <p>{calibration.message}</p>
          {calibration.performance?.calibration_rate_ok === false && (
            <p>Processing is too slow for reliable calibration. Tracking and rep counting may remain paused.</p>
          )}
          {debugExpanded && calibration.backend && (
            <p>
              Backend: {calibration.backend}{calibration.runtime ? ` / ${calibration.runtime}` : ''}
              {' · '}Processing: {calibration.performance?.processing_ms ?? '—'} ms
              {' · '}Pose: {Math.round(calibration.performance?.inference_ms?.pose ?? 0)} ms
              {' · '}Depth: {Math.round(calibration.performance?.inference_ms?.depth ?? 0)} ms
            </p>
          )}
          {calibration.calibrated === false && (
            <progress max="1" value={calibration.progress || 0} aria-label="T-pose calibration progress" />
          )}
        </div>
      )}

      {errorMessage && (
        <p className="camera-error" role="alert">
          {errorMessage}
        </p>
      )}
    </section>
  )
}

export default WebcamConnection
