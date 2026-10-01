/**
 * SitUp
 * ---------------------------------------------------------------------------
 * Animated form guide for the Sit-up, with side and front views, guide
 * overlays, live metrics and common-mistake variants.
 *
 * Data source: static (see sitUpForm.js). No API calls.
 *
 * Props (all optional): defaultView ("side" | "front"), autoPlay, duration,
 * showTitle, showViewToggle, showMistakes, showIndicators, showMetrics,
 * className. See ExerciseFormPlayer for details.
 */

import ExerciseFormPlayer from "../ExerciseFormPlayer.jsx";
import { phases, views } from "./sitUpForm.js";

export default function SitUp(props) {
  return <ExerciseFormPlayer title="Sit-up" phases={phases} views={views} {...props} />;
}
