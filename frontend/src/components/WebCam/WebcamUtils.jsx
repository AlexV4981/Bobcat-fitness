export const CAMERA_ID = 'default'
export const FRAME_INTERVAL_MS = 100

const MAX_FRAME_WIDTH = 960
//compression quality is set to 0.8
const JPEG_QUALITY = 0.8

//builds the websocket URL thats used to upload the camera frames
export function getCameraWebSocketUrl(cameraId, exercise = 'Exercise') {
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  const url = new URL(apiBase)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = `/api/camera/ws/${encodeURIComponent(cameraId)}`
  //name the recorder at connection time before processed poses arrive.
  url.searchParams.set('exercise', exercise)
  url.hash = ''
  return url.toString()
}

//recording controls share the camera ID used by frame upload and preview.
function getCameraApiUrl(cameraId, path) {
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  const url = new URL(apiBase)
  url.pathname = `/api/camera/${encodeURIComponent(cameraId)}/recording/${path}`
  url.search = ''
  url.hash = ''
  return url.toString()
}

async function expectJson(response) {
  if (!response.ok) {
    //surface backend explanations in the UI.
    const body = await response.json().catch(() => ({}))
    throw new Error(body.detail || `Camera API request failed (${response.status})`)
  }
  return response.json()
}

//start a fresh partial rep for the selected exercise; this writes no JSON.
export async function startExerciseRecording(cameraId, exercise) {
  const response = await fetch(getCameraApiUrl(cameraId, 'start'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exercise }),
  })
  return expectJson(response)
}

//count Rep writes the already- iltered poses buffered by the backend.
export async function saveExerciseRep(cameraId) {
  const response = await fetch(getCameraApiUrl(cameraId, 'rep'), { method: 'POST' })
  return expectJson(response)
}

//future reps go into the next Date_Exercise_Set# folder after this succeeds.
export async function finishExerciseSet(cameraId) {
  const response = await fetch(getCameraApiUrl(cameraId, 'set'), { method: 'POST' })
  return expectJson(response)
}

//delete the latest rep saved by this camera session in its current set.
export async function undoExerciseRep(cameraId) {
  const response = await fetch(getCameraApiUrl(cameraId, 'rep'), { method: 'DELETE' })
  return expectJson(response)
}

//builds the HTTP MJPEG camera stream
export function getProcessedCameraUrl(cameraId) {
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  const url = new URL(apiBase)
  url.pathname = `/api/camera/${encodeURIComponent(cameraId)}/mjpeg`
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

  //mirror the uploaded frame before Python draws the skeleton and labels.
  //should keep the camera selfie-oriented without reversing the rendered text.
  context.setTransform(-1, 0, 0, 1, canvas.width, 0)
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  context.resetTransform()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('JPEG encoding failed.'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}
