/**
 * PushUp
 * ---------------------------------------------------------------------------
 * Animated form guide for the Push-up, with side and front views, guide
 * overlays, live metrics and common-mistake variants.
 *
 * Data source: static (see pushUpForm.js). No API calls.
 *
 * Props (all optional): defaultView ("side" | "front"), autoPlay, duration,
 * showTitle, showViewToggle, showMistakes, showIndicators, showMetrics,
 * className. See ExerciseFormPlayer for details.
 */

import ExerciseFormPlayer from "../ExerciseFormPlayer.jsx";
import { phases, views } from "./pushUpForm.js";

export default function PushUp(props) {
  return <ExerciseFormPlayer title="Push-up" phases={phases} views={views} {...props} />;
}
