# Browser squat alignment feedback

Press Start camera, face the screen and hold both arms out for two seconds.
T-pose instructions and hold progress are below the video; the top-left preview
label is removed. There is no cutout or body-size matching. Lower your arms during the five-second countdown and start at the chime. Upright samples
confirm a comfortable leg stance; body-balance targets remain fixed to T-pose.
Recalibrate is available manually. Ordinary stance changes do not erase the lock.

The camera uses the existing browser pose worker. No ONNX depth model, Python
camera service or frame upload is required. Camera startup prepares audio from
the button gesture, with a visual start cue when audio is unavailable. Stopping
or leaving the page releases the stream, worker and audio context.

## Color rules

These are prototype comparisons with projected alignment, not a perfect-squat,
medical, calibrated-depth or independent arm-technique verdict.

- Standard squat stance compares ankle-center spacing with calibrated shoulder
  width, adjusted for image scale. A 5% tolerance absorbs tracking jitter. Wider
  stance moves both legs away from green and becomes red when substantially
  wider; recalibration cannot redefine that width target.
- Knee checks compare inward changes and large outward deviations with the
  personal hip-to-ankle reference. A provisional 30-degree outward allowance
  avoids immediately flagging normal outward projection during descent.
- Sideways torso lean, shoulder tilt and hip tilt are compared with T-pose.
  Body-posture deviations tint the entire visible skeleton consistently.
- Knee deviations add severity to that leg. They do not randomly tint unrelated
  arms or the opposite leg. Shared joint dots use the strongest adjacent score.
- Near standing, a large change in torso length relative to hip width can produce
  an upright-projection cue. This cannot distinguish forward from backward lean.
  It is not applied to normal bent-knee descent or the bottom position.

Green/yellow/red reference stops are 3/9/15 color-score units. Stronger errors
continue changing through deeper reds at 30 and 60 rather than saturating at 15.
Angular channels use degrees; the standing projection cue uses a separate
normalized deviation mapped to the color scale, not an anatomical angle.

A 250 ms confirmation period and 180 ms score smoothing reduce flicker. Color
filtering does not delay joint positions. Missing, stale or implausible joints
remain unassessed. Rep counting has its own framing/geometry rules; counter-only
framing failures do not disable confident posture feedback. Unreliable joint
geometry still suppresses grading and partial reps are discarded on tracking loss.

## Scope and setup

The overlay uses each result's matching source bitmap. The browser validates
confidence, finite coordinates, frame margins, freshness and jumps before use.
No model z/world-coordinate values are used. The current automatic counter is
for squats; other exercises remain preview/manual counting.

Run `npm ci`, then `npm run dev` in `frontend/`. Initial model preparation needs
network access; runtime/model assets are checksum-verified/prepared by the
existing dev/build hooks and stay out of Git. Camera access requires localhost
or HTTPS. Account set saving uses the existing connected application services.

Diagnostic controls, exports, test fixtures, recordings and experimental files
are excluded from this feature branch's published change. Real-camera accuracy,
physical motion-to-display latency and cross-device behavior remain to be
validated. Direction-specific backward lean, depth, full 3D angles and complete
exercise-form correctness are not established by these front-view checks.

## Demo behavior when assessment pauses

Gray/white means unassessed, not correct or incorrect form. Very deep projected
positions can make hip-to-knee geometry unsuitable even while the model reports
high confidence. Foreshortened or implausible limb geometry, unavailable joints,
a changed viewpoint, stale results and brief re-confirmation can also pause
colors. The feedback text distinguishes unavailable joints from unassessable
projection/geometry. Calibration stays saved; return upright with the full body
visible to recover. Do not force uncertain frames red or reuse old scores.

## Front-view movement counting

A frontal squat can keep a nearly straight projected knee angle even when the
hips clearly lower. The counter accepts either its existing knee-angle bend or
sustained hip drop with projected thigh shortening. The frontal alternative
requires hip drop of at least 20% of standing projected leg length, thigh length
at most 85% of standing, and ankle displacement at most 10% of standing leg
length. Hip drop subtracts vertical ankle movement so moving the whole image
does not become a squat. The same standing start, confirmed return, dwell time,
minimum cycle duration and confidence/geometry checks still apply. These are
movement-cycle heuristics, not squat-depth or form-quality measurements.

Live feedback uses short cues such as “Uneven shoulders”, “Leaning sideways”,
“Keep feet shoulder-width apart” and “Alignment on track”. The legend retains
the visible-alignment scope and neutral-color explanation.
