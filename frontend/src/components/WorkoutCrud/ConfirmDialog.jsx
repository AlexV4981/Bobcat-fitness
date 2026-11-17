import { useEffect, useRef } from "react";
import "./WorkoutCrud.css";

// Small modal used to confirm deleting a workout. Escape or a backdrop click cancels.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  busy = false,
  error = "",
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="wcd-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="wcd" role="alertdialog" aria-modal="true" aria-labelledby="wcd-title" aria-describedby="wcd-msg">
        <h2 id="wcd-title">{title}</h2>
        <p id="wcd-msg">{message}</p>
        {error && (
          <p className="wcd-error" role="alert">
            {error}
          </p>
        )}
        <div className="wcd-actions">
          <button ref={cancelRef} type="button" className="wcd-btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="wcd-btn wcd-btn--danger" onClick={onConfirm} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
