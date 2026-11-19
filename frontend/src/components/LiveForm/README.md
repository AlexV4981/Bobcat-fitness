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

Captured diagnostic exports, test fixtures, recordings and experimental files
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

Rep counting learns its own standing hip height and projected limb lengths from
fresh upright frames, matching the established WebcamProcessing counter. T-pose
calibration is used for form colors, not to seed the counter's standing reference.
This prevents a shifted calibration reference from trapping an upright person in
`need_standing`. After tracking loss, unfinished cycles are discarded and the
counter learns a fresh standing reference while form calibration stays saved.
Lower-body tracking loss clears that reference. Shoulder/torso changes alone
do not reset a usable leg cycle.

The angular movement path remains available: confirmed standing at 160 degrees
or more, descent below 145 degrees with hip drop, a sustained bend at 125 degrees
or less with at least 15% relative hip drop, then a confirmed return.

The front-view counting path also accepts sustained, scale-corrected hip-to-ankle
shortening of at least 20% of standing projected leg length, with thigh length
at most 85% of standing and ankle displacement at most 10% of standing leg
length. Hip width compensates uniform image scaling; relative hip-to-ankle height
rejects whole-image translation. This path needs usable hips for scale and does
not require the projected knee to bend to 125 degrees. Both paths retain 120 ms
confirmation, a 700 ms minimum cycle and the independent-leg duplicate guard.
These are prototype movement heuristics, not metric depth or a full form grade.

Hands can be clasped in front after the calibration countdown. Shoulders, elbows
and wrists are not required for the lower-body counter; upper-body uncertainty
still pauses the relevant form feedback. Torso tilt alone cannot satisfy the hip
and leg movement requirements. Confidence, jumps and implausible lower-body
geometry still reject unreliable observations.

Live feedback uses short cues such as “Uneven shoulders”, “Leaning sideways”,
“Keep feet shoulder-width apart” and “Alignment on track”. The legend retains
the visible-alignment scope and neutral-color explanation.

## Independent leg cycles

Each leg owns its own live standing reference, confidence/geometry checks and
standing-to-bend-to-standing cycle. Losing one leg clears only its partial cycle;
a usable opposite leg can continue. Global stale frames and full lower-body tracking loss
still require fresh standing acquisition. Shoulder/torso changes no longer reset
a visible leg cycle.

One coordinator emits a single rep event. After a completion, returns from cycles
that started before that event are ignored, preventing delayed opposite-leg
returns from double counting. Partial cycles from different legs are never
combined. No fixed preferred side or mid-cycle transfer of standing references
is used. The existing angular path and cycle timing remain; the front-view alternative
uses the additional projection checks described above.

Both checkers use the same detected frame and validated image-plane points. A
jump on one leg no longer resets the healthy leg's counter. Unreliable leg
geometry/jumps still pause form coloring without consuming a valid completed
rep. Red alignment feedback can accompany a completed movement; colors are not
a condition for counting a rep. Viewpoint limits of single-camera 2D angles
remain; symmetric logic does not guarantee detection at every body rotation.

The public phase/rep/points/metrics result and camera callback remain unchanged.
Additional per-leg tracking metrics identify which chain completed a cycle.

## Brief projected-thigh pause

After a sustained bend is already confirmed, a continuous thigh contraction
between 20% and 25% of the standing projected length can retain that leg's cycle
for at most 150 ms. This requires a stable shin, small frame-to-frame length
changes and a stable ankle. These frames remain unassessed for form and cannot
start or complete a rep. Severe, persistent, missing or jumped geometry resets
the cycle. A rep still requires reliable recovery and the normal standing return.
Standing reference refresh can account for scale changes without requiring the
old ankle anchor, so a step before starting does not freeze an outdated reference.

## Recording diagnostics for a teammate

Open Tracking diagnostics below the squat preview. Start the camera, complete
T-pose calibration and wait for the chime. Press Record 60 seconds, wait for the
five-second recording countdown, then perform the test sequence. Press Stop
recording after the last movement, or let the recording finish automatically.
Download diagnostics saves a JSON file; send that file manually to the teammate
investigating the issue. Copy saved summary provides a shorter text overview.

The panel is available in development and production builds. It records numeric
image-plane landmarks, confidence, calibration/counter references, per-leg
phases and blocking reasons, timing and delivered rep events. No video or audio
is recorded or uploaded. The saved report freezes at completion, so approaching
the screen does not overwrite it. Live counting continues after recording stops.
Download before refreshing or leaving; starting another recording replaces it.
Camera stop, recalibration or exercise/set changes end an unfinished recording.

Memory is bounded to 60 seconds, 2400 frames and limited feedback/reference
snapshots. The report names the counting algorithm and revision for comparison.
Raw recordings, test fixtures and private findings remain excluded from Git.
