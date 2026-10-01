# Exercise form guides

Animated stick-figure form guides for the Bobcat Fitness frontend. Each exercise is its own component.

```jsx
import { Squat, PushUp, PullUp, SitUp } from "./components/exercises";
// or: import Squat from "./components/exercises/Squat/Squat.jsx";

<PushUp />                                   // full guide
<Squat defaultView="front" autoPlay={false} />
<PullUp showMistakes={false} showIndicators={false} showMetrics={false} />   // compact demo
```

## Props (all optional, same for every exercise)

| Prop | Default | Purpose |
| --- | --- | --- |
| `defaultView` | `"side"` | `"side"` or `"front"` |
| `autoPlay` | `true` | Start playing (always starts paused if the user prefers reduced motion) |
| `duration` | `6500` | ms per rep loop |
| `showTitle` | `false` | Visible heading (screen readers always get it) |
| `showViewToggle` | `true` | Side / front buttons |
| `showMistakes` | `true` | "Correct form vs. mistake" dropdown |
| `showIndicators` | `true` | Overlay checkboxes |
| `showMetrics` | `true` | Live metric cards |
| `className` | `""` | Extra class on the root |

## Layout

- `Squat/`, `PushUp/`, `PullUp/`, `SitUp/` each hold the component (`X.jsx`) and its data + drawing code (`xForm.js`, plain JS, no React).
- `ExerciseFormPlayer.jsx` is the shared UI shell; `useExerciseAnimation.js` runs the loop; `svgKit.js` has the SVG/IK helpers.
- `ExerciseFormGuide.css` is scoped to `.fg`. It reads `--ink`, `--ink-soft`, `--bg`, `--surface`, `--border`, `--hero-bg`, `--accent` and the `--tint-*` tokens from HomePage.css (with fallbacks). Override any `--fg-*` variable on a parent to restyle.

## Adding another exercise

Copy a `*Form.js`, write a `draw(t, { mode, on, p })` per view that returns `{ svg, cards, ok }`, list its `modes`, `inds` and coaching text, then wrap it in a 6-line component like `Squat.jsx`.
