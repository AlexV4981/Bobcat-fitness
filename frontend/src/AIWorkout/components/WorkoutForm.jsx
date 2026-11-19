import { useState } from "react";
import Chips from "./Chips.jsx";

const GOALS = [
  { value: "strength", label: "Strength" },
  { value: "muscle growth (hypertrophy)", label: "Muscle" },
  { value: "conditioning / endurance", label: "Conditioning" },
  { value: "calisthenics skill work", label: "Skills" },
  { value: "mobility and recovery", label: "Mobility" },
];

const FOCUS = [
  { value: "full body", label: "Full body" },
  { value: "upper body", label: "Upper" },
  { value: "lower body", label: "Lower" },
  { value: "push", label: "Push" },
  { value: "pull", label: "Pull" },
  { value: "core", label: "Core" },
];

const EQUIPMENT = [
  { value: "bodyweight only", label: "Bodyweight" },
  { value: "dumbbells", label: "Dumbbells" },
  { value: "barbell and rack", label: "Barbell" },
  { value: "kettlebell", label: "Kettlebell" },
  { value: "pull-up bar", label: "Pull-up bar" },
  { value: "gymnastics rings", label: "Rings" },
  { value: "resistance bands", label: "Bands" },
  { value: "full commercial gym", label: "Full gym" },
];

const MODES = [
  { value: "program", label: "Program" },
  { value: "single", label: "Single workout" },
];

const DAYS = [2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }));

export default function WorkoutForm({ onSubmit, loading, error, children }) {
  const [goal, setGoal] = useState("strength");
  const [focus, setFocus] = useState("full body");
  const [equipment, setEquipment] = useState(["bodyweight only"]);
  const [duration, setDuration] = useState(45);
  const [level, setLevel] = useState("intermediate");
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState("program");
  const [weeks, setWeeks] = useState(6);
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const isProgram = mode === "program";

  const submit = (e) => {
    e.preventDefault();
    onSubmit({
      mode,
      goal,
      focus,
      equipment,
      duration,
      level,
      notes,
      weeks,
      daysPerWeek,
    });
  };

  return (
    <form className="rail" onSubmit={submit}>
      <fieldset>
        <legend>What to build</legend>
        <Chips name="mode" options={MODES} value={mode} onChange={setMode} />
      </fieldset>

      {isProgram && (
        <>
          <fieldset>
            <legend>Program length</legend>
            <div className="range-row">
              <input
                type="range"
                id="weeks"
                min="2"
                max="12"
                step="1"
                value={weeks}
                onChange={(e) => setWeeks(+e.target.value)}
              />
              <output htmlFor="weeks">{weeks} wk</output>
            </div>
          </fieldset>

          <fieldset>
            <legend>Days per week</legend>
            <Chips name="days" options={DAYS} value={daysPerWeek} onChange={setDaysPerWeek} />
          </fieldset>
        </>
      )}

      <fieldset>
        <legend>Goal</legend>
        <Chips name="goal" options={GOALS} value={goal} onChange={setGoal} />
      </fieldset>

      <fieldset>
        <legend>Focus</legend>
        <Chips name="focus" options={FOCUS} value={focus} onChange={setFocus} />
      </fieldset>

      <fieldset>
        <legend>Equipment</legend>
        <Chips name="eq" options={EQUIPMENT} value={equipment} onChange={setEquipment} multiple />
      </fieldset>

      <fieldset>
        <legend>{isProgram ? "Time per session" : "Time"}</legend>
        <div className="range-row">
          <input
            type="range"
            id="duration"
            min="10"
            max="90"
            step="5"
            value={duration}
            onChange={(e) => setDuration(+e.target.value)}
          />
          <output htmlFor="duration">{duration} min</output>
        </div>
      </fieldset>

      <fieldset>
        <legend>Level</legend>
        <select id="level" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </fieldset>

      <fieldset>
        <legend>Anything else?</legend>
        <textarea
          id="notes"
          placeholder="e.g. sore shoulders, working toward a muscle-up, no jumping (downstairs neighbors)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </fieldset>

      {error && <div className="err" role="alert">{error}</div>}

      <button className="go" type="submit" disabled={loading}>
        {loading ? "Building…" : isProgram ? "Build my program" : "Build my workout"}
      </button>

      {children}
    </form>
  );
}
