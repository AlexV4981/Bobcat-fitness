# Camera and depth tracking — start here

[Setup and switching backends](setup.md) · [Architecture graph](../architecture/README.md)

This guide follows the four lanes in the supplied camera-pipeline graph. It groups
navigation and new documentation while keeping existing Python imports, frontend
components, tests and launch commands at their established paths.

## Quick commands

Run from the repository root:

```bash
npm run backend:setup
npm run backend:models
npm run backend:onnx
# Stop with Ctrl+C before switching:
npm run backend:mediapipe
```

Use `npm run backend:check:onnx` for a real inference check. Windows users without
`python3` can use `python backend/run.py onnx` and the commands in the setup guide.

## Where to work

| Graph lane / concern | Existing location | What belongs there |
| --- | --- | --- |
| Browser camera | [WebCam components](../../frontend/src/components/WebCam/) | Capture, upload, processed preview, calibration/debug UI |
| Workout screen | [CameraPage.jsx](../../frontend/src/Camera/CameraPage.jsx) | Exercise selection, rep status and manual controls |
| Backend workflow | [camera.py](../../backend/app/routes/camera.py) | WebSocket, MJPEG, calibration, recording and rep APIs |
| Latest uploaded frame | [camera_stream.py](../../backend/app/services/camera_stream.py) | Per-camera frame storage |
| Overlay integration | [SkeletonOverlay.py](../../backend/app/Webcam_utilities/SkeletonOverlay.py) | Connect tracking to drawing, recording and counting |
| Pose and optical depth | [depth module](../../backend/app/services/depth/) | ONNX inference, reconstruction, filtering, lighting and calibration |
| Vector labels | [WebcamCalibrator.py](../../backend/app/Webcam_utilities/WebcamCalibrator.py) | Display coordinates and legacy vector origins |
| Rep counting | [rep_counter.py](../../backend/app/Webcam_utilities/rep_counter.py), [rep_session.py](../../backend/app/services/rep_session.py) | Exercise gates and per-camera rep state |
| Movement recordings | [movement_recorder.py](../../backend/app/services/movement_recorder.py) | Recording buffers and persisted rep data |
| Validation | [backend/tests](../../backend/tests/) | ONNX, reconstruction, calibration, stability and integration regression tests |

Within `backend/app/services/depth/`, start with `tracking.py` for orchestration,
`onnx_inference.py` for runtime execution, `reconstruction.py` for camera geometry
and depth sampling, and `stability.py` / `filters.py` for temporal filtering.
`calibration.py` owns T-pose references; `evaluation.py` summarizes angle stability.

## New tooling and local assets

| Purpose | Location |
| --- | --- |
| Environment setup and backend switching | [backend/run.py](../../backend/run.py) |
| Repeatable inference benchmark | [backend/benchmark_onnx.py](../../backend/benchmark_onnx.py) |
| Pinned model downloads and checksums | [backend/onnx-models.json](../../backend/onnx-models.json) |
| Environment template | [backend/.env.onnx.example](../../backend/.env.onnx.example) |
| Local configuration, ignored by Git | `backend/.env.onnx` |
| Downloaded weights, ignored by Git | `backend/models/` |
| Measured local camera intrinsics, ignored by Git | `backend/camera-calibrations.json` if configured |
| Movement output, ignored by Git | `backend/movement_data/` |
| Recorded benchmark snapshot | [benchmarks/onnx-cpu.json](benchmarks/onnx-cpu.json) |

Run the benchmark from the repository root:

```bash
backend/.venv/bin/python backend/benchmark_onnx.py --iterations 5
```

Its default output updates the documented benchmark snapshot. Use `--output` for
an additional experiment so the baseline remains available. See [setup.md](setup.md)
for measured-distance checks, coordinate units and performance limitations.

## Validation status

The current baseline is synthetic inference timing, not real-camera accuracy.
Measured-distance accuracy, live stationary Z/angle stability, low-latency exercise
tracking on laptop and phone, the guided silhouette, and metric recording remain
incomplete or unverified. Follow the acceptance-status section in [setup.md](setup.md).

## Folder convention

Keep executable code beside the application layer it serves; do not create a second
copy of the pipeline in this docs folder. Put camera/depth guides here, benchmark
snapshots in `benchmarks/`, and architecture snapshots in `../architecture/`.
Keep model weights and private calibration outside versioned documentation.
