# Switching between MediaPipe and ONNX

From the repository root (Python 3.11 recommended):

```bash
python3 backend/run.py --setup --download-models
python3 backend/run.py mediapipe
# Stop with Ctrl+C, then switch:
python3 backend/run.py onnx
```

On Windows use `python` instead of `python3` if needed. The launcher automatically
uses `backend/.venv`; both backends share compatible dependencies. OpenCV handles preprocessing and drawing. The ONNX environment selects ONNX
Runtime CPU execution by default; `BOBCAT_ONNX_RUNTIME=opencv` selects the original
OpenCV DNN execution path. Setup installs both runtimes. PyTorch is not needed. Start the frontend
separately as usual. Switching restarts the backend and its camera sessions.

Root npm shortcuts: `npm run backend:setup`, `npm run backend:models`,
`npm run backend:mediapipe`, and `npm run backend:onnx` (require `python3`).
The launcher accepts `--host`, `--port`, `--no-reload`, and `--check`.

## Environment and models

Setup creates ignored `backend/.env.onnx` from the tracked
[template](../../backend/.env.onnx.example), preserving existing settings. Relative
model/calibration paths resolve from `backend/`. Process environment variables
have precedence over the file; the launch command always selects the backend.
The ONNX environment file is only loaded for the ONNX command.

`--download-models` downloads about 121 MB into ignored `backend/models/`.
[onnx-models.json](../../backend/onnx-models.json) pins revisions and SHA-256 checksums.
Matching files are reused; differing existing files are preserved and reported.
The files are community conversions; see the publishers' source/license details:

- [RTMPose-S export](https://huggingface.co/pzoltowski/rtmpose-s-onnx):
  COCO-17 input `[1,3,256,192]`, outputs `[1,17,384]` and `[1,17,512]`.
- [Depth Anything V2 Metric Hypersim Small export](https://huggingface.co/77ukhtar/depth-anything-v2-metric-onnx):
  indoor metric depth, input `[1,3,518,518]`, RGB/ImageNet normalization,
  output `[1,518,518]` in meters. Relative-depth exports are incompatible.

Both publishers identify their exports as Apache-2.0. Consult their model cards
for upstream sources and attribution. Weights stay local.

## Verification and calibration

```bash
python3 backend/run.py mediapipe --check
python3 backend/run.py onnx --check
```

Checks run real inference on a synthetic image and validate output compatibility;
they do not demonstrate real-camera accuracy. ONNX also checks before startup.

ONNX needs measured camera intrinsics for metric 3D tracking and rep counting.
Set `BOBCAT_CAMERA_CALIBRATIONS` in `.env.onnx` to a JSON file keyed by actual
camera IDs. Each entry requires measured `width`, `height`, `fx`, `fy`, `cx`, `cy`,
and an explicit boolean `mirrored`. Optional `distortion` takes OpenCV's 4, 5, or
8 coefficients. Values describe the uploaded image resolution before mirroring.
Configured entries are validated before startup. Cameras without matching
intrinsics can show image landmarks but pause 3D tracking and counting.
Use measured values; no fabricated calibration is supplied. The normal T-pose
calibration is also required per session.

The adapter handles one person with their whole body visible. CPU speed and
camera accuracy depend on the hardware, lighting and scene.

## Latency investigation and acceptance status

The 33-slot MediaPipe-compatible layout is a data mapping; the ONNX factory never
calls MediaPipe inference. MediaPipe is now imported only when its factory is used.
The per-camera calibration endpoint reports the instantiated backend, runtime,
per-stage inference time, processing time and inter-frame interval. Expand the
camera debug view to see runtime and timing. Processing time excludes transport
and browser rendering; it is not end-to-end latency.

A reproducible CPU-only test with the pinned models and six threads produced:

| Runtime | Median warmed inference | p95 inference |
| --- | ---: | ---: |
| OpenCV DNN | 1,741 ms | 1,791 ms |
| ONNX Runtime 1.23.2 | 663 ms | 686 ms |

See [raw benchmark](benchmarks/onnx-cpu.json). Each result uses three
measured iterations after one warmup on a synthetic blank 640x480 RGB frame.
This is a small local sample, not a hardware-independent performance guarantee,
and is not a depth-accuracy measurement. Thread count is configurable through
`BOBCAT_ONNX_THREADS`; the benchmark found fewer threads slower on this machine.
See [ONNX Runtime thread management](https://onnxruntime.ai/docs/performance/tune-performance/threading.html).

From the repository root, reproduce the benchmark:

```bash
backend/.venv/bin/python backend/benchmark_onnx.py --iterations 5
```

On Windows use `backend\.venv\Scripts\python.exe`. For a centered planar target
with an independently measured optical-axis distance, add `--image target.jpg
--distance-m 2.0 --output /tmp/target-check.json` (use the actual measured distance).
This checks the final frame's center 5x5 patch, reports coverage and absolute
surface-depth error, and does not validate anatomical joint depth. A single
still image cannot measure temporal jitter; repeated identical-image predictions
must not be presented as stationary-person stability results.

The depth model estimates visible surface depth, which can differ from anatomical
joint centers. Camera intrinsics correct projection geometry; a T-pose does not
make monocular depth metrically accurate. See the upstream
[metric-depth model documentation](https://github.com/DepthAnything/Depth-Anything-V2/tree/main/metric_depth).

ONNX image-space Z is unavailable and remains zero in the legacy recording schema.
ONNX preview labels now use filtered hip-relative world coordinates in meters,
rather than image-width-scaled displacement. Toe joints absent from COCO-17 stay
missing; metric label initialization no longer requires them. The existing
MediaPipe preview labels retain their legacy image-coordinate interpretation.

**Acceptance is incomplete.** Even the faster runtime here exceeds the 0.4-second
T-pose sample-gap limit and the 0.5-second filter reset interval. Those gaps can
prevent calibration and warmup; the UI now reports insufficient processing cadence.
Quality gates have not been relaxed to manufacture apparent tracking success.
A faster model/export or accelerator is still needed on this hardware before
claiming live exercise performance. Depth reuse across moving frames is not used.

The following remain unverified or incomplete:

- Independently measured camera intrinsics and depth accuracy across distances,
  viewpoints, clothing, and foreground/background boundaries.
- Stationary-person Z and joint-angle jitter with valid-frame coverage, plus
  measured movement-to-display latency and resource consumption.
- Live supported-exercise checks on both phone and laptop input paths.
- The guided T-pose silhouette; the current guide is textual with a progress bar.
- Metric movement recording: the existing image-coordinate file schema is preserved.

The regression suite covers numerical stability, missing depth, camera isolation,
rep counting, recordings, and ONNX adapter output formats. A regression pass does
not fulfill these remaining camera validation requirements.
