# Browser camera tracking

The Camera page keeps the shared workout layout and runs pose inference on the
user's device. There is no laptop/server processing selector or separate Python
camera service to start. The existing application backend remains available for
other workflows; this page does not upload camera frames to its camera APIs.

## Start the app

1. Keep the project's normal frontend environment configuration for account features.
2. In `frontend/`, run `npm ci`, then `npm run dev`.
3. Open the printed local URL, choose Camera, select Squat and press Start camera.
4. Allow camera access. Face the screen with your full body and both feet visible.
   Stand normally briefly, then perform a comfortable squat and return to standing.

A deployed site must use HTTPS; localhost also permits camera access. The browser
needs camera, worker, ImageBitmap and MediaPipe runtime support. Laptop and phone
browsers use the same page, but device/browser performance still needs validation.

`predev` and `prebuild` run `scripts/prepare-pose-assets.mjs`. It copies the pinned
`@mediapipe/tasks-vision` runtime into `public/pose/` and downloads the Full pose
model when absent or when its SHA-256 checksum differs. Initial preparation needs
network access. The generated runtime and model are served with the frontend and
are excluded from Git. Users receive these assets from the app when tracking
starts; there is no manual model installation, ONNX setup, marker or T-pose step.

## How a frame reaches the screen

1. `CameraPage.jsx` owns exercise selection, visible rep count, manual corrections,
   session history and account set saving. `BrowserCamera.jsx` owns camera access
   and releases the stream and worker when stopped or when the page unmounts.
2. The browser shows a mirrored live video. At most one frame is in flight to
   `public/pose-worker.js`; the camera loop sends no faster than about 30 fps and
   skips unchanged video frames. Inference can run slower than that limit.
3. The worker uses MediaPipe Pose Landmarker in video mode for one person. It
   attempts GPU inference, falls back to CPU if GPU initialization fails, and the
   camera controller requests CPU after three consecutive inference times over
   180 ms on the GPU. This does not guarantee a particular frame rate.
4. The worker returns image landmarks and the exact captured bitmap. The UI uses
   the bitmap for the skeleton overlay so joints align with their source frame.
   When a result becomes stale, the overlay clears and the live preview continues.
5. `formAnalysis.js` validates image-plane points and checks frame freshness before
   the squat counter and knee-path checks run. Model z and world coordinates are
   not used. Displayed joint coordinates are image pixels before mirroring.

## Stability and uncertainty

A usable point needs finite image coordinates inside the frame margins and at
least 0.75 visibility and, when provided, presence. Large jumps are hidden rather
than replaced with old or guessed positions. The next raw detection remains the
comparison reference so tracking can recover after a jump.

Results older than 180 ms, non-increasing frame timestamps, long frame gaps,
missing joints and implausible geometry pause or reset the relevant analysis.
Partial rep cycles are discarded when tracking resets; completed visible reps
remain. The pipeline does not smooth uncertain joints into apparently valid ones.
Model confidence is not proof of joint-position accuracy.

## Squat counting and colors

`SquatAnalysis` learns a standing reference and follows standing, descending,
bending and returning to standing. A rep requires a sustained bend and hip drop,
a minimum cycle duration and a sustained return near standing height. Manual
Count Rep and Undo remain available. A counted rep is an observed movement cycle,
not a certification of squat depth or technique.

`FrontalSquatFeedback` checks both visible legs and front-view geometry separately
from counting. It learns ordinary standing knee paths, compares subsequent inward
movement relative to foot spacing, and requires a stable candidate for 250 ms
before coloring each assessed leg segment. A changed stance requires a fresh
standing reference. Prototype margins remain subject to real-camera validation.

- Green: no inward knee drift observed within this limited check.
- Red: possible inward knee drift; a prompt asks the user to track with their foot.
- Gray: unassessed, borderline or uncertain; it does not mean bad form.

Standing reference frames can be gray while tracking works normally. Missing
bilateral joints can pause colors while the counter still has a usable leg.
Push-up, pull-up and sit-up selections currently provide skeleton preview and
manual counting only in this workflow. The older push-up analysis helper is not
invoked by the browser camera.

## Save sets and collect diagnostics

Save Completed Set adds the visible count to session history, resets the analysis
for the next set and attempts the existing account log request. An account error
leaves the session entry visible. This browser flow does not create the legacy
backend's per-rep movement JSON files.

Show debug expands the camera and exposes numeric joint/phase/timing details.
Record 30 seconds starts a five-second countdown followed by a bounded numeric
recording. It stores image landmarks, usability, timing, movement phases and
feedback states in page memory; it records no video or metric depth. The summary
freezes at completion so walking up to the screen does not change the saved
report. Download the JSON before refreshing or leaving the page. Downloaded
recordings, labs, markers and findings must stay out of Git.

## Scope for Demo Day

The deliverable prioritizes responsive joint tracking and explicit uncertainty.
It does not estimate calibrated distance in meters, validate anatomical 3D joint
angles, measure squat depth or assess complete form. Broader exercise feedback,
metric-depth validation and cross-device/real-camera form validation remain
outstanding. ONNX inference and mandatory T-pose calibration are outside the
amended scope.
