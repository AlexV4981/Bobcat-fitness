import { useState } from "react";
import Chips from "./Chips.jsx";
import { ENV_API_KEY } from "../lib/api.js";

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

export default function WorkoutForm({ apiKey, onSaveKey, onSubmit, loading, error, children }) {
  const [keyDraft, setKeyDraft] = useState(apiKey);
  const [keySaved, setKeySaved] = useState(false);
  const [goal, setGoal] = useState("strength");
  const [focus, setFocus] = useState("full body");
  const [equipment, setEquipment] = useState(["bodyweight only"]);
  const [duration, setDuration] = useState(45);
  const [level, setLevel] = useState("intermediate");
  const [notes, setNotes] = useState("");
  const [isListening, setIsListening] = useState(false);
  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support Speech Recognition. Try Chrome or Edge.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setNotes((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.start();
  };

  const saveKey = () => {
    onSaveKey(keyDraft.trim());
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 1200);
  };

  const submit = (e) => {
    e.preventDefault();
    onSubmit({ apiKey: keyDraft.trim(), goal, focus, equipment, duration, level, notes });
  };

  return (
    <form className="rail" onSubmit={submit}>
      {!ENV_API_KEY && (
        <div className="keybox">
          <label className="lbl" htmlFor="apiKey">API key</label>
          <input
            type="password"
            id="apiKey"
            placeholder="Paste your key (starts with AIza…)"
            autoComplete="off"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
          />
          <button type="button" className="ghost" onClick={saveKey}>
            {keySaved ? "Saved" : "Save key"}
          </button>
          <small>
            Saved only in this browser. Get a free key at{" "}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
              aistudio.google.com/apikey
            </a>
            .
          </small>
        </div>
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
        <legend>Time</legend>
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
        <legend style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <span>Anything else?</span>
          <button
            type="button"
            onClick={handleVoiceInput}
            title="Voice input for workout notes"
            style={{
              padding: "0.25rem 0.65rem",
              backgroundColor: isListening ? "#e53e3e" : "#edf2f7",
              color: isListening ? "#fff" : "#1a202c",
              border: "1px solid rgba(0,0,0,0.12)",
              borderRadius: "6px",
              fontWeight: "600",
              cursor: "pointer",
              fontSize: "0.85rem"
            }}
          >
            {isListening ? "🛑 Listening" : "🎤 Voice"}
          </button>
        </legend>
        <textarea
          id="notes"
          placeholder="e.g. sore shoulders, working toward a muscle-up, no jumping (downstairs neighbors)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </fieldset>
      {error && <div className="err" role="alert">{error}</div>}
      <button className="go" type="submit" disabled={loading}>
        {loading ? "Building…" : "Build my workout"}
      </button>
      {children}
    </form>
  );
}
