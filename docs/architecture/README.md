# Camera pipeline architecture

[camera-pipeline.graph.json](camera-pipeline.graph.json) is an exact copy of the
user-supplied `/workspace/graph.json`. The upload was preserved at its original
location. It describes the camera/depth feature, not the whole application.

The supplied snapshot has 39 nodes and 63 directed edges, grouped into four lanes:

| Lane | Current source area |
| --- | --- |
| Frontend | `frontend/src/Camera/` and `frontend/src/components/WebCam/` |
| Backend | `backend/app/routes/`, camera services and `Webcam_utilities/` |
| Depth | `backend/app/services/depth/` |
| Validation | `backend/tests/` and depth evaluation |

Begin with its `entrypoints` (`ui`, `mjpeg`, `calibration_api`). Follow edges by
matching `source` and `target` to node IDs. Each node's `source[].path` points to
a repository file. The [camera/depth guide](../camera-depth/README.md) makes those
paths clickable and includes the newer launcher, runtime and benchmark tooling.

The graph records commit `81e259ae5ffde69eba0a894d98911e9ef3f2219e` and is preserved
as a historical snapshot. It predates subsequent working-tree changes; its status
fields do not certify current behavior, tests, live latency or depth accuracy.
Its node/edge schema differs from the generated Graphify node-link schema.

`graphify-out/` remains the ignored location for generated Graphify graphs,
interactive HTML and reports. Do not substitute one JSON format for the other.
Future uploaded snapshots can use descriptive filenames here; generated graph
artifacts should continue to be regenerated in `graphify-out/`.
