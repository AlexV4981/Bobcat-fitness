/**
 * Squat
 * ---------------------------------------------------------------------------
 * Animated form guide for the barbell back squat, with side and front views, guide
 * overlays, live metrics and common-mistake variants.
 *
 * Data source: static (see squatForm.js). No API calls.
 *
 * Props (all optional): defaultView ("side" | "front"), autoPlay, duration,
 * showTitle, showViewToggle, showMistakes, showIndicators, showMetrics,
 * className. See ExerciseFormPlayer for details.
 */

import ExerciseFormPlayer from "../ExerciseFormPlayer.jsx";
import { phases, views } from "./squatForm.js";

export default function Squat(props) {
  return <ExerciseFormPlayer title="Barbell back squat" phases={phases} views={views} {...props} />;
}
