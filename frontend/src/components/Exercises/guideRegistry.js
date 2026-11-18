/**
 * guideRegistry
 * ---------------------------------------------------------------------------
 * Maps an exercise row's `guide_key` (public.exercises.guide_key) to the
 * frontend form-guide component and its form data. This is the only place the
 * database meets the hand-built animations.
 *
 * To add an animation: build the component + *Form.js as usual, export them
 * from ./index.js, add one entry here, then set guide_key on the exercise row.
 * Exercises without a guide_key fall back to photos + text instructions.
 */

import {
  PushUp, PullUp, Squat, SitUp,
  pushUpForm, pullUpForm, squatForm, sitUpForm,
} from "./index.js";

export const GUIDES = {
  "push-up": { Guide: PushUp, form: pushUpForm },
  "pull-up": { Guide: PullUp, form: pullUpForm },
  "squat": { Guide: Squat, form: squatForm },
  "sit-up": { Guide: SitUp, form: sitUpForm },
};
