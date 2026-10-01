/**
 * PullUp
 * ---------------------------------------------------------------------------
 * Animated form guide for the Pull-up, with side and front views, guide
 * overlays, live metrics and common-mistake variants.
 *
 * Data source: static (see pullUpForm.js). No API calls.
 *
 * Props (all optional): defaultView ("side" | "front"), autoPlay, duration,
 * showTitle, showViewToggle, showMistakes, showIndicators, showMetrics,
 * className. See ExerciseFormPlayer for details.
 */

import ExerciseFormPlayer from "../ExerciseFormPlayer.jsx";
import { phases, views } from "./pullUpForm.js";

export default function PullUp(props) {
  return <ExerciseFormPlayer title="Pull-up" phases={phases} views={views} {...props} />;
}
