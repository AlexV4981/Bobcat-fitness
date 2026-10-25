// Pill-style radio or checkbox group
export default function Chips({ name, options, value, onChange, multiple = false }) {
  const isOn = (v) => (multiple ? value.includes(v) : value === v);
  const toggle = (v) => {
    if (!multiple) return onChange(v);
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  return (
    <div className="chips">
      {options.map((o) => (
        <label className="chip" key={o.value}>
          <input
            type={multiple ? "checkbox" : "radio"}
            name={name}
            value={o.value}
            checked={isOn(o.value)}
            onChange={() => toggle(o.value)}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}
