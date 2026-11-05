# Depth and stability

The live camera path now runs through `PoseTrackingStore` and `PoseStabilizer`
before drawing, recording, or automatic rep counting. No new dependencies are
required. The implementation follows the confidence gating and temporal filtering
approaches described by [Sports2D](https://github.com/davidpagnon/Sports2D) and
[MediaPipe](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/python);
it does not copy their project code.

## Scope

These improvements apply only to the live camera pose pipeline, whether the
browser supplies laptop-camera or phone-camera frames. `SkeletonOverlay.py`
explicitly requests stabilized landmarks for drawing, pose recording, and live
rep counting. Camera routes reset only the relevant camera's tracker and origin.
Models are created lazily on the first processed frame, not when the API starts.

The standalone rep counter and recording/vector utilities do not automatically
filter their inputs. Other application routes, exercise illustrations, and
dashboard data do not use the depth layer. Each camera has independent histories;
resetting or disconnecting one camera does not clear another camera's filters.

## Modules

- `stability.py`: explicit per-joint validity, three-frame warmup, speed-based
  outlier rejection, loss recovery, and separate image/world coordinate histories.
- `filters.py`: causal One Euro coordinate filtering using actual timestamps.
- `tracking.py`: independent MediaPipe models and filters per camera, serialized
  access, explicit reset, and a four-camera LRU limit with model cleanup.
- `evaluation.py`: valid-frame coverage, stationary angle jitter, and optional
  error against frame-aligned reference angles.

## Coordinates and missing data

Image x/y are normalized by width/height; image z uses roughly the x scale.
World coordinates are estimated meters relative to the hips. World coordinates
drive live 3D angles; image coordinates place the overlay. Live counting pauses
for joints without valid world depth instead of substituting front-view 2D angles.

Filtering uses `None` for missing joints, never `-1`. Negative depth is legitimate.
The counter adapter uses visibility zero for invalid slots. The existing recorder
schema still writes `-1` placeholders at serialization, and its movement threshold
still uses image coordinates. Exported unit direction vectors may legitimately
switch between -1 and 1; they are not depth measurements. On-screen displacement
labels remain image-width-scaled values, not centimeters or measured distances.

Joints rejected in image space stay hidden; raw predictions are never used as
fallbacks. Visible bones with usable image positions but rejected depth are gray. The
existing mint color means tracking is usable; it does **not** certify good form.
Phase-aware red/yellow/green form grading and its reference configuration are
separate from this numerical stability layer.

## T-pose and lighting

Each new camera session requires a full-body T-pose: face the camera, stand
upright, and hold straight arms at shoulder height for at least two seconds
and 15 accepted frames. Visible shoulders, elbows, wrists, hips, knees and ankles
must stay within the frame with visibility >=0.75. Motion, missing joints, gaps
over 0.4 seconds, and poor illumination restart the hold. Median 3D bone lengths
form a reference for this session; this does not retrain MediaPipe or measure
real limb lengths. Use **Recalibrate T-pose** after changing people or camera setup.
Recalibration clears partial motion and vector origins while preserving completed
rep counts and files. It does not reset another camera's calibration.

After calibration, world bone lengths outside 60–150% of their reference are
rejected. A generous upper bound on projected lengths also hides image sprawl;
there is no lower bound on projected length, allowing foreshortened limbs.
These are provisional outlier thresholds, not biomechanical form rules.

The inference image receives mild, luminance-only CLAHE in dim conditions;
the displayed video retains its original colors. Near-black frames skip model
inference. Calibration and excessive darkness pause automatic counting and
discard unfinished recording samples. Dim frames after calibration remain usable
only where landmark confidence and geometry pass validation. Status and progress
are available at `GET /api/camera/{camera_id}/calibration`; `POST` to the same
URL restarts calibration. The preview and camera controls explain what is needed.

Lighting thresholds use sampled central-frame grayscale intensity (0–255):
near-black is mean <28 and 75th percentile <45; dim is mean <95 and 35th
percentile <65. They are heuristics, not camera exposure measurements. Lighting
and bone thresholds need testing on actual webcam footage, dark clothing,
backlighting and different camera angles. Enhancement cannot recover detail
that the camera never captured.

Research references: [MediaPipe Pose visibility, tracking and world coordinates](https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/pose.md)
and [OpenCV CLAHE and noise amplification](https://docs.opencv.org/4.x/d5/daf/tutorial_py_histogram_equalization.html).
The T-pose hold and outlier tolerances are application-specific engineering
choices, not performance claims from these sources.

## Tuning and evaluation

`StabilityConfig` centralizes provisional visibility, warmup, timeout, cutoff, and
speed parameters. Rates and slack differ for image units and meters. Longer gaps
or continuously rejected observations trigger fresh acquisition after 0.5 seconds.
Very fast real motion may be rejected; thresholds need refinement with real clips.

Run `python -m unittest discover -s tests -v` from `backend` using its virtualenv.
Tests include stationary synthetic angle jitter, legitimate zero crossings,
alternating extreme depth, missing/invalid samples, recovery, camera isolation,
resource cleanup, and the live overlay adapter. Synthetic fixtures verify program
behavior; they do not demonstrate webcam depth accuracy.

For stationary recordings, pass measured angles (or `None` for missing frames) to
`evaluate_angles`. Its 95th-percentile jitter is distance from the clip median.
For accuracy, also supply independently measured, frame-aligned reference angles.
A suggested initial target is <=3 degrees stationary jitter with >=95% coverage.
Color-response latency should later be measured separately end to end, including
capture, inference, filtering, transport, and rendering. No latency or real-camera
accuracy guarantee is established by these unit tests.
