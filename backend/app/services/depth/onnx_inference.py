# Load the ONNX models only when this backend is selected.
# RTMPose uses 17 joints, a 192x256 image and SimCC split ratio 2.
# Depth Anything V2 uses a 518x518 RGB image and returns depth in meters.
# This handles one person with their full body in view.

import os
from pathlib import Path
from types import SimpleNamespace
import time

import cv2
import numpy as np

from app.Webcam_utilities.rep_counter import Landmark

# Match the 17 COCO joints to the 33 MediaPipe slots.
# Leave joints the model does not predict invalid.
COCO_TO_MEDIAPIPE = (0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28)


def _load_net(path):
    if not Path(path).is_file():
        raise ValueError(f"ONNX model file does not exist: {path}")
    net = cv2.dnn.readNetFromONNX(str(path))
    net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
    net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
    return net


def _tensor(rgb, size, mean, std):
    resized = cv2.resize(rgb, size, interpolation=cv2.INTER_LINEAR).astype(np.float32)
    normalized = (resized / 255.0 - np.asarray(mean, np.float32)) / np.asarray(std, np.float32)
    return np.ascontiguousarray(normalized.transpose(2, 0, 1)[None])


class OpenCVPoseDepth:
    # Each camera gets its own models, with process and close methods.

    def __init__(self, pose_path, depth_path):
        self.pose_net = _load_net(pose_path)
        self.depth_net = _load_net(depth_path)

    def process(self, rgb):
        if rgb.dtype != np.uint8 or rgb.ndim != 3 or rgb.shape[2] != 3 or min(rgb.shape[:2]) < 1:
            raise ValueError("Expected a nonempty uint8 RGB frame.")
        if self.pose_net is None:
            raise RuntimeError("Inference model has been closed.")
        started = time.perf_counter()
        height, width = rgb.shape[:2]
        # Resize and add padding so the person keeps the same proportions.
        scale = min(192 / width, 256 / height)
        rw, rh = max(1, round(width * scale)), max(1, round(height * scale))
        left, top = (192 - rw) // 2, (256 - rh) // 2
        canvas = np.zeros((256, 192, 3), np.uint8)
        canvas[top:top + rh, left:left + rw] = cv2.resize(rgb, (rw, rh))
        self.pose_net.setInput(_tensor(canvas, (192, 256),
                                      (.485, .456, .406), (.229, .224, .225)))
        outputs = self.pose_net.forward(self.pose_net.getUnconnectedOutLayersNames())
        if len(outputs) != 2:
            raise ValueError("Pose export must expose SimCC x and y outputs.")
        by_shape = {tuple(o.shape): o for o in outputs}
        if set(by_shape) != {(1, 17, 384), (1, 17, 512)}:
            raise ValueError("Expected COCO-17 SimCC outputs [1,17,384] and [1,17,512].")
        sx, sy = by_shape[(1, 17, 384)][0], by_shape[(1, 17, 512)][0]
        if not np.isfinite(sx).all() or not np.isfinite(sy).all():
            raise ValueError("Nonfinite pose model output.")
        points = [Landmark(0, 0, 0, 0) for _ in range(33)]
        for joint, slot in enumerate(COCO_TO_MEDIAPIPE):
            x = (float(sx[joint].argmax()) / 2 - left) / rw
            y = (float(sy[joint].argmax()) / 2 - top) / rh
            confidence = float(np.clip(min(sx[joint].max(), sy[joint].max()), 0, 1))
            if not (0 <= x <= 1 and 0 <= y <= 1):
                confidence = 0.0
            points[slot] = Landmark(x, y, 0, confidence)
        pose_ms = (time.perf_counter() - started) * 1000
        self.depth_net.setInput(_tensor(rgb, (518, 518),
                                       (.485, .456, .406), (.229, .224, .225)))
        raw = self.depth_net.forward()
        if raw.shape not in ((1, 518, 518), (1, 1, 518, 518)):
            raise ValueError("Metric depth export must return [1,518,518] or [1,1,518,518].")
        depth = raw.reshape(518, 518).astype(np.float32)
        # Mark bad depth values as missing and keep sharp depth changes.
        # Check each joint separately so one bad pixel does not lose the whole frame.
        depth[~np.isfinite(depth) | (depth <= 0)] = np.nan
        depth = cv2.resize(depth, (width, height), interpolation=cv2.INTER_NEAREST)
        return SimpleNamespace(
            pose_landmarks=SimpleNamespace(landmark=points),
            pose_world_landmarks=None,  # The camera store calculates the 3D points.
            depth_meters=depth,
            inference_ms={"pose": pose_ms, "depth": (time.perf_counter() - started) * 1000 - pose_ms},
        )

    def close(self):
        self.pose_net = None
        self.depth_net = None


def create_pose_model(mediapipe_factory):
    # Use the selected backend and raise an error if its setup is wrong.
    backend = os.environ.get("BOBCAT_POSE_BACKEND", "mediapipe").lower()
    if backend == "mediapipe":
        return mediapipe_factory()
    if backend != "opencv_onnx":
        raise ValueError("BOBCAT_POSE_BACKEND must be mediapipe or opencv_onnx.")
    pose = os.environ.get("BOBCAT_POSE_ONNX")
    depth = os.environ.get("BOBCAT_DEPTH_ONNX")
    if not pose or not depth:
        raise ValueError("OpenCV ONNX requires BOBCAT_POSE_ONNX and BOBCAT_DEPTH_ONNX.")
    return OpenCVPoseDepth(pose, depth)
