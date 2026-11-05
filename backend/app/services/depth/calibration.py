"""Session-local T-pose reference and conservative bone-length rejection.

Lengths are MediaPipe estimates, not measured anatomy. Compare 3D lengths
with the reference; projected lengths have only a generous upper bound so
camera-facing limbs can still shorten in the image.
"""

from dataclasses import replace
import math
from statistics import median

from app.Webcam_utilities.rep_counter import Landmark, joint_angle
from .stability import StabilizedPose


BONES = (
    (11, 12), (11, 13), (13, 15), (12, 14), (14, 16),
    (11, 23), (12, 24), (23, 24),
    (23, 25), (25, 27), (24, 26), (26, 28),
)
JOINTS = tuple(sorted({index for bone in BONES for index in bone}))
HOLD_SECONDS = 2.0
MIN_SAMPLES = 15
MAX_SAMPLE_GAP = 0.4


class TPoseCalibration:
    def __init__(self):
        self.lengths = {}
        self.samples = []
        self.started_at = None
        self.last_at = None
        self.anchor = None
        self.progress = 0.0
        self.message = "Face the camera, show your full body, and extend both arms in a T-pose."

    @property
    def ready(self):
        return bool(self.lengths)

    def _restart(self, message):
        self.samples.clear()
        self.started_at = self.last_at = self.anchor = None
        self.progress = 0.0
        self.message = message

    def _t_pose(self, pose, width, height):
        if any(
            pose.image[i] is None or pose.world[i] is None
            or pose.image[i].visibility < 0.75
            or not (0.02 <= pose.image[i].x <= 0.98 and 0.02 <= pose.image[i].y <= 0.98)
            for i in JOINTS
        ):
            return None
        # Pixel coordinates account for the webcam's aspect ratio.
        points = {i: (pose.image[i].x * width, pose.image[i].y * height) for i in JOINTS}
        torso = sum(math.dist(points[a], points[b]) for a, b in ((11, 23), (12, 24))) / 2
        if torso < height * 0.08 or abs(points[11][0] - points[12][0]) < torso * 0.3:
            return None
        for shoulder, elbow, wrist, hip, knee, ankle, other in (
            (11, 13, 15, 23, 25, 27, 12), (12, 14, 16, 24, 26, 28, 11),
        ):
            arm_angle = joint_angle(*(Landmark(*points[i]) for i in (shoulder, elbow, wrist)), use_z=False)
            leg_angle = joint_angle(*(Landmark(*points[i]) for i in (hip, knee, ankle)), use_z=False)
            if (
                arm_angle is None or arm_angle < 160
                or leg_angle is None or leg_angle < 160
                or abs(points[wrist][1] - points[shoulder][1]) > torso * 0.22
                or points[hip][1] - points[shoulder][1] < torso * 0.7
                or points[ankle][1] - points[hip][1] < torso * 0.8
                or (points[wrist][0] - points[shoulder][0])
                * (points[shoulder][0] - points[other][0]) <= 0
            ):
                return None
        lengths = {bone: math.dist(pose.world[bone[0]][:3], pose.world[bone[1]][:3]) for bone in BONES}
        # Refuse degenerate or obviously implausible references before learning.
        if any(not 0.05 <= length <= 1.0 for length in lengths.values()):
            return None
        torso_length = (lengths[(11, 23)] + lengths[(12, 24)]) / 2
        if any(not 0.25 <= lengths[bone] / torso_length <= 1.8 for bone in BONES):
            return None
        for left, right in (((11, 13), (12, 14)), ((13, 15), (14, 16)),
                            ((23, 25), (24, 26)), ((25, 27), (26, 28))):
            if not 0.65 <= lengths[left] / lengths[right] <= 1.55:
                return None
        return points, torso, lengths

    def update(self, pose: StabilizedPose, width: int, height: int, timestamp: float, lighting: str):
        # Screen bounds belong to the live-camera quality policy, rather than
        # the generic stabilizer (which also supports non-image test inputs).
        visible = tuple(point if point is not None and 0 <= point.x <= 1 and 0 <= point.y <= 1
                        else None for point in pose.image)
        pose = replace(pose, image=visible,
                       world=tuple(point if visible[i] is not None else None for i, point in enumerate(pose.world)))
        if not self.ready:
            candidate = self._t_pose(pose, width, height) if lighting == "good" else None
            if candidate is None:
                self._restart(
                    "Add light in front of you to calibrate." if lighting != "good" else
                    "Show your full body; stand upright with straight arms out at shoulder height."
                )
            else:
                points, torso, lengths = candidate
                if self.last_at is not None and (
                    timestamp - self.last_at > MAX_SAMPLE_GAP
                    or max(math.dist(points[i], self.anchor[i]) for i in JOINTS) > torso * 0.12
                    or any(abs(lengths[bone] / self.samples[0][bone] - 1) > 0.2 for bone in BONES)
                ):
                    self._restart("Hold still in your T-pose.")
                if self.started_at is None:
                    self.started_at, self.anchor = timestamp, points
                self.last_at = timestamp
                self.samples.append(lengths)
                # Keep memory bounded even at unusually high frame rates.
                if len(self.samples) > 120:
                    self.samples.pop(0)
                self.progress = min(1.0, (timestamp - self.started_at) / HOLD_SECONDS,
                                    len(self.samples) / MIN_SAMPLES)
                self.message = "Hold your T-pose still for two seconds."
                if self.progress >= 1.0:
                    self.lengths = {bone: median(sample[bone] for sample in self.samples) for bone in BONES}
                    self.samples.clear()
                    self.anchor = None
                    self.message = "Calibrated. You can start your exercise."
        image, world = list(pose.image), list(pose.world)
        rejected = set()
        if self.ready:
            torso_pixels = [
                math.dist((image[a].x * width, image[a].y * height),
                          (image[b].x * width, image[b].y * height))
                for a, b in ((11, 23), (12, 24))
                if image[a] is not None and image[b] is not None
            ]
            reference_torso = (self.lengths[(11, 23)] + self.lengths[(12, 24)]) / 2
            for (a, b), length in self.lengths.items():
                if world[a] is not None and world[b] is not None:
                    ratio = math.dist(world[a][:3], world[b][:3]) / length
                    if not 0.6 <= ratio <= 1.5:
                        rejected.update((a, b))
                if torso_pixels and image[a] is not None and image[b] is not None:
                    projected = math.dist((image[a].x * width, image[a].y * height),
                                          (image[b].x * width, image[b].y * height))
                    # Only an upper bound: a limb pointing at the camera may
                    # legitimately project to almost zero image length.
                    if projected > 1.8 * max(torso_pixels) * length / reference_torso:
                        rejected.update((a, b))
            # Hide extremities attached to a rejected ankle too.
            for ankle, foot in ((27, 31), (28, 32)):
                if ankle in rejected:
                    rejected.add(foot)
            for index in rejected:
                image[index] = world[index] = None
        message = self.message
        if self.ready and lighting != "good":
            message = "Low light: add light in front of you." if lighting == "dim" else "Too dark to track. Add light in front of you."
        elif self.ready and (rejected or any(image[i] is None or world[i] is None for i in JOINTS)):
            message = "Tracking uncertain. Keep your body visible; unreliable joints are hidden."
        return replace(pose, image=tuple(image), world=tuple(world), calibrated=self.ready,
                       calibration_progress=self.progress, tracking_message=message, lighting=lighting)
