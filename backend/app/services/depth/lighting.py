"""Conservative luminance enhancement for inference, without changing geometry."""

import cv2
import numpy as np


def prepare_pose_frame(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    height, width = gray.shape
    # Sample the central body area; a bright window at the edge should not
    # dominate the estimate. These thresholds need real-camera tuning.
    center = gray[height // 10:height * 9 // 10, width // 5:width * 4 // 5]
    sample = center[::4, ::4] if center.size else gray
    mean = float(np.mean(sample))
    lower, upper = np.percentile(sample, [35, 75])
    lighting = "too_dark" if mean < 28 and upper < 45 else "dim" if mean < 95 and lower < 65 else "good"
    if lighting != "dim":
        return cv2.cvtColor(frame, cv2.COLOR_BGR2RGB), lighting
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    luminance = lab[:, :, 0]
    enhanced = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(luminance)
    lab[:, :, 0] = cv2.addWeighted(luminance, 0.5, enhanced, 0.5, 0)
    return cv2.cvtColor(lab, cv2.COLOR_LAB2RGB), lighting
