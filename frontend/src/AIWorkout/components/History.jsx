export default function History({ items, onPick }) {
  if (!items.length) return null;
  return (
    <fieldset>
      <legend>Recent</legend>
      <div className="hist">
        {items.map((w) => (
          <button type="button" key={w.createdAt} onClick={() => onPick(w)}>
            <span className="hist-title">
              {w.title}
              {w.type === "program" && <em>{w.weeks} wk</em>}
            </span>
            <span>{new Date(w.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
