# Use the camera settings and estimated depth to calculate 3D joint positions.
# Positions use meters: x goes right, y goes down and z goes away from the camera.
# Measure counter positions from the middle of both hips.
# Leave points missing when the camera settings, hips or depth are not usable.

from dataclasses import dataclass
import json
import math
import os
from pathlib import Path

import cv2
import numpy as np

from app.Webcam_utilities.rep_counter import Landmark


@dataclass(frozen=True)
class CameraIntrinsics:
    width: int
    height: int
    fx: float
    fy: float
    cx: float
    cy: float
    mirrored: bool = False
    distortion: tuple[float, ...] = ()  # OpenCV k1,k2,p1,p2[,k3[,k4,k5,k6]]

    def __post_init__(self):
        if any(type(v) is not int or v < 1 for v in (self.width, self.height)):
            raise ValueError("Calibration width and height must be positive integers.")
        if type(self.mirrored) is not bool:
            raise ValueError("Calibration mirrored must be a boolean.")
        if any(type(v) not in (int, float) or not math.isfinite(v)
               for v in (self.fx, self.fy, self.cx, self.cy)):
            raise ValueError("Camera intrinsics must be finite numbers.")
        if self.fx <= 0 or self.fy <= 0 or not (0 <= self.cx < self.width and 0 <= self.cy < self.height):
            raise ValueError("Positive focal lengths and an in-frame principal point are required.")
        if len(self.distortion) not in (0, 4, 5, 8) or any(
            type(v) not in (int, float) or not math.isfinite(v) for v in self.distortion
        ):
            raise ValueError("Distortion must contain 0, 4, 5, or 8 finite OpenCV coefficients.")
        object.__setattr__(self, 'distortion', tuple(self.distortion))

    def rays(self, pixels):
        # Undo mirroring, then correct the points using the camera settings.
        pixels = np.asarray(pixels, np.float64).reshape(-1, 1, 2).copy()
        if self.mirrored:
            pixels[:, 0, 0] = self.width - 1 - pixels[:, 0, 0]
        matrix = np.array([[self.fx, 0, self.cx], [0, self.fy, self.cy], [0, 0, 1]], np.float64)
        distortion = np.asarray(self.distortion, np.float64) if self.distortion else None
        xy = cv2.undistortPoints(pixels, matrix, distortion).reshape(-1, 2)
        return np.column_stack((xy, np.ones(len(xy))))


def load_camera_intrinsics(camera_id: str) -> CameraIntrinsics | None:
    # Load this camera's settings when its session starts.
    # Each camera needs its own settings for the uploaded image size.
    # The settings describe the image before mirroring.
    path = os.environ.get('BOBCAT_CAMERA_CALIBRATIONS')
    if not path:
        return None
    try:
        entries = json.loads(Path(path).read_text())
        if not isinstance(entries, dict):
            raise ValueError('Expected a JSON object keyed by camera ID.')
        entry = entries.get(camera_id)
        if entry is None:
            return None
        if not isinstance(entry, dict) or 'mirrored' not in entry:
            raise ValueError('Each camera entry must explicitly declare mirrored.')
        return CameraIntrinsics(**entry)
    except (OSError, TypeError, ValueError) as error:
        raise ValueError(f'Invalid camera calibration for {camera_id}: {error}') from error


@dataclass(frozen=True)
class DepthSamplingConfig:
    radius: int = 2  # Check a 5x5 area around the pixel by default.
    min_visibility: float = .5
    min_depth_m: float = .2
    max_depth_m: float = 10.0
    min_valid_fraction: float = .6
    max_spread_m: float = .08
    max_relative_spread: float = .04

    def __post_init__(self):
        if type(self.radius) is not int or not 0 <= self.radius <= 10:
            raise ValueError('Depth sampling radius must be an integer from 0 to 10.')
        values = (self.min_visibility, self.min_depth_m, self.max_depth_m,
                  self.min_valid_fraction, self.max_spread_m, self.max_relative_spread)
        if any(not math.isfinite(v) for v in values) or not (
            0 <= self.min_visibility <= 1 and 0 < self.min_depth_m < self.max_depth_m
            and 0 < self.min_valid_fraction <= 1
            and self.max_spread_m >= 0 and self.max_relative_spread >= 0
        ):
            raise ValueError('Invalid depth confidence, range, coverage or spread threshold.')


def sample_depth(depth, u: float, v: float, config: DepthSamplingConfig) -> float | None:
    # Use the middle depth value to reduce the effect of bad pixels.
    # Reject areas where the depth values differ too much.
    height, width = depth.shape
    x, y = min(width - 1, int(u + .5)), min(height - 1, int(v + .5))
    r = config.radius
    patch = depth[max(0, y-r):min(height, y+r+1), max(0, x-r):min(width, x+r+1)]
    valid = patch[np.isfinite(patch) & (patch >= config.min_depth_m) & (patch <= config.max_depth_m)]
    if valid.size < math.ceil(patch.size * config.min_valid_fraction):
        return None
    median = float(np.median(valid))
    spread = float(np.percentile(valid, 90) - np.percentile(valid, 10))
    if spread > max(config.max_spread_m, config.max_relative_spread * median):
        return None
    return median


@dataclass(frozen=True)
class ReconstructedPose:
    camera: tuple[Landmark | None, ...]
    world: tuple[Landmark | None, ...]
    status: str


def reconstruct_pose(points, depth, intrinsics: CameraIntrinsics | None,
                     config: DepthSamplingConfig | None = None) -> ReconstructedPose:
    # Turn the 33 image points into 3D points, then center them between the hips.
    # The visible surface depth is an estimate of the joint depth.
    # The stabilizer handles smoothing and missing points across frames.
    config = config or DepthSamplingConfig()
    missing = (None,) * 33
    if intrinsics is None:
        return ReconstructedPose(missing, missing, 'intrinsics_required')
    if depth.ndim != 2 or depth.shape != (intrinsics.height, intrinsics.width):
        return ReconstructedPose(missing, missing, 'resolution_mismatch')
    if points is None or len(points) != 33:
        return ReconstructedPose(missing, missing, 'pose_missing')
    accepted, pixels, depths = [], [], []
    for i, point in enumerate(points):
        if point is None or not all(math.isfinite(v) for v in point) or not (
            config.min_visibility <= point.visibility <= 1
            and 0 <= point.x < 1 and 0 <= point.y < 1
        ):
            continue
        # Convert image positions to pixels and keep them inside the image.
        u, v = min(point.x * intrinsics.width, intrinsics.width - 1), min(point.y * intrinsics.height, intrinsics.height - 1)
        z = sample_depth(depth, u, v, config)
        if z is not None:
            accepted.append(i)
            pixels.append((u, v))
            depths.append(z)
    camera = list(missing)
    if accepted:
        xyz = intrinsics.rays(pixels) * np.asarray(depths)[:, None]
        for index, position in zip(accepted, xyz):
            if np.isfinite(position).all():
                camera[index] = Landmark(*map(float, position), points[index].visibility)
    # Require both hips so the center does not jump when one is hidden.
    if camera[23] is None or camera[24] is None:
        return ReconstructedPose(tuple(camera), missing, 'hips_required')
    origin = (np.asarray(camera[23][:3]) + np.asarray(camera[24][:3])) / 2
    world = tuple(None if p is None else Landmark(*(np.asarray(p[:3]) - origin), p.visibility) for p in camera)
    return ReconstructedPose(tuple(camera), world, 'ready')
