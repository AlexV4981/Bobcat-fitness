// Saved workouts (read from the database). The open one is highlighted.
export default function History({ items, activeId, onPick }) {
  if (!items.length) return null;
  return (
    <fieldset>
      <legend>Saved workouts</legend>
      <div className="hist">
        {items.map((w) => (
          <button
            type="button"
            key={w.id}
            className={w.id === activeId ? "on" : ""}
            aria-current={w.id === activeId ? "true" : undefined}
            onClick={() => onPick(w)}
          >
            {w.title}
            <span>
              {new Date(`${w.scheduledDate}T00:00:00`).toLocaleDateString([], { month: "short", day: "numeric" })}
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
