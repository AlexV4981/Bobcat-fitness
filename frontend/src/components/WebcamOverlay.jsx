const STREAM_LABELS = {
  connecting: 'Connecting to Python…',
  error: 'Backend offline',
  offline: 'Not streaming',
  streaming: 'Streaming to Python',
}

function WebcamOverlay({ cameraState, streamState }) {
  const isLive = cameraState === 'on' && streamState === 'streaming'

  return (
    <div className="camera-overlay" aria-live="polite">
      <span className={isLive ? 'status-dot is-live' : 'status-dot'} aria-hidden="true" />
      {cameraState === 'off' ? 'Camera off' : STREAM_LABELS[streamState]}
    </div>
  )
}

export default WebcamOverlay
