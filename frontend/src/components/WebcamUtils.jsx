export const CAMERA_ID = 'default'
export const FRAME_INTERVAL_MS = 100

const MAX_FRAME_WIDTH = 960
const JPEG_QUALITY = 0.8

export function getCameraWebSocketUrl(cameraId) {
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  const url = new URL(apiBase)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = `/api/camera/ws/${encodeURIComponent(cameraId)}`
  url.search = ''
  url.hash = ''
  return url.toString()
}

export function captureVideoFrame(video, canvas) {
  const sourceWidth = video.videoWidth
  const sourceHeight = video.videoHeight

  if (!sourceWidth || !sourceHeight) {
    return Promise.reject(new Error('The camera has not produced a frame yet.'))
  }

  const scale = Math.min(1, MAX_FRAME_WIDTH / sourceWidth)
  canvas.width = Math.round(sourceWidth * scale)
  canvas.height = Math.round(sourceHeight * scale)

  const context = canvas.getContext('2d', { alpha: false })
  if (!context) return Promise.reject(new Error('Canvas is unavailable.'))

  context.drawImage(video, 0, 0, canvas.width, canvas.height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('JPEG encoding failed.'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}
