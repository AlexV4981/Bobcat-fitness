import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { searchText } from "../components/Exercises/ExerciseCatalog.js";
import "./ExercisePicker.css";

const BROWSE_LIMIT = 12; // exercises shown per category while browsing (the rest sit behind "Show more")
const SEARCH_LIMIT = 40; // results shown while typing

const EMPTY_CATALOG = { exercises: [], categories: [], loading: false, error: null, reload: () => {} };

function scrollParent(el) {
  for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY;
    if (o === "auto" || o === "scroll") return n;
  }
  return null;
}

/**
 * ExercisePicker
 * ---------------------------------------------------------------------------
 * A combo box for an exercise name: type anything you like, or open the list and pick
 * one from the exercise catalog, grouped by the same categories as the Exercises page
 * (Push, Pull, Legs, Core, Other). Typing filters the list by name, category, muscles
 * and equipment. Text that isn't in the catalog is simply kept as a custom exercise.
 *
 * The catalog comes from the parent (one useExerciseList() call shared by every picker):
 *   catalog = { exercises, categories, loading, error, reload }
 *
 * Props: value, onChange({ name, exerciseId }), catalog, ariaLabel, placeholder
 *   exerciseId is the catalog row's uuid (dbId), or undefined for a custom exercise.
 *
 * The list is rendered in a portal with fixed positioning, so it is never clipped by the
 * editor's scroll area.
 */
export default function ExercisePicker({
  value,
  onChange,
  catalog = EMPTY_CATALOG,
  ariaLabel = "Exercise name",
  placeholder = "Type or choose an exercise",
}) {
  const { exercises, categories, loading, error, reload } = catalog;
  const uid = useId();
  const listId = `${uid}-list`;
  const [open, setOpen] = useState(false);
  const [filtering, setFiltering] = useState(false); // the user has typed since opening
  const [active, setActive] = useState(-1);
  const [expanded, setExpanded] = useState(() => new Set()); // categories opened with "Show more"
  const [pos, setPos] = useState(null);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  const query = filtering ? value.trim().toLowerCase() : "";

  // rows = what is drawn (headings, options, "show more"); flat = what the keyboard can reach
  const { rows, flat, capped, showCustom } = useMemo(() => {
    const matches = exercises
      .filter((ex) => !query || searchText(ex).includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));

    const rows = [];
    const flat = [];
    let remaining = SEARCH_LIMIT;
    let capped = false;

    for (const category of categories) {
      const all = matches.filter((ex) => ex.category === category);
      if (all.length === 0) continue;

      let visible;
      let hidden = 0;
      if (query) {
        visible = all.slice(0, Math.max(0, remaining));
        remaining -= visible.length;
        if (visible.length < all.length) capped = true;
      } else if (expanded.has(category)) {
        visible = all;
      } else {
        visible = all.slice(0, BROWSE_LIMIT);
        hidden = all.length - visible.length;
      }
      if (visible.length === 0) continue;

      rows.push({ type: "group", category });
      for (const ex of visible) {
        const item = { kind: "exercise", ex };
        rows.push({ type: "option", index: flat.length, item });
        flat.push(item);
      }
      if (hidden > 0) {
        const item = { kind: "more", category, count: hidden };
        rows.push({ type: "option", index: flat.length, item });
        flat.push(item);
      }
    }

    const exact = exercises.some((ex) => ex.name.toLowerCase() === value.trim().toLowerCase());
    const showCustom = value.trim() !== "" && !exact;
    if (showCustom) flat.push({ kind: "custom" });
    return { rows, flat, capped, showCustom };
  }, [exercises, categories, query, expanded, value]);

  const place = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 200 && above > below;
    setPos({
      left: r.left,
      width: r.width,
      top: up ? undefined : r.bottom + 4,
      bottom: up ? window.innerHeight - r.top + 4 : undefined,
      maxHeight: Math.max(140, Math.min(340, up ? above : below)),
    });
  };

  const show = (withFilter) => {
    place();
    setFiltering(withFilter);
    setActive(-1);
    setOpen(true);
  };
  const hide = () => {
    setOpen(false);
    setFiltering(false);
    setActive(-1);
    setExpanded(new Set());
  };

  // The list is fixed-position, so follow the input when something scrolls, and close
  // if the input scrolls out of view (or on resize).
  useEffect(() => {
    if (!open) return;
    const onScroll = (e) => {
      if (listRef.current?.contains(e.target)) return;
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const sp = scrollParent(el);
      if (sp) {
        const c = sp.getBoundingClientRect();
        if (r.bottom < c.top + 4 || r.top > c.bottom - 4) return hide();
      }
      place();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", hide);
    };
  }, [open]);

  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${uid}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, uid]);

  const choose = (item) => {
    if (item.kind === "more") {
      setExpanded((prev) => new Set(prev).add(item.category)); // keep the list open
      return;
    }
    if (item.kind === "exercise") onChange({ name: item.ex.name, exerciseId: item.ex.dbId });
    hide();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) return show(false);
      setActive((a) => (flat.length ? (a + 1) % flat.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return show(false);
      setActive((a) => (flat.length ? (a <= 0 ? flat.length - 1 : a - 1) : -1));
    } else if (e.key === "Enter") {
      if (open && active >= 0 && flat[active]) {
        e.preventDefault();
        choose(flat[active]);
      }
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation(); // don't also cancel a drag / close a dialog
      hide();
    }
  };

  const meta = (ex) => `${ex.difficulty} · ${ex.equipment.length ? ex.equipment.join(", ") : "Bodyweight"}`;
  const customIndex = flat.length - 1;

  return (
    <div className="exp" ref={wrapRef}>
      <input
        className="exp-input"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${uid}-opt-${active}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onFocus={() => show(false)}
        onClick={() => !open && show(false)}
        onChange={(e) => {
          // typing makes it a custom name; picking from the list sets exerciseId again
          onChange({ name: e.target.value, exerciseId: undefined });
          if (!open) place();
          setFiltering(true);
          setActive(-1);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onBlur={hide}
      />
      <button
        type="button"
        className="exp-toggle"
        tabIndex={-1}
        aria-label="Show exercise list"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (open) hide();
          else {
            wrapRef.current?.querySelector("input")?.focus();
            show(false);
          }
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Exercises"
            className="exp-list"
            style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
            onMouseDown={(e) => e.preventDefault()} // keep focus in the input while clicking
          >
            {loading && exercises.length === 0 && <div className="exp-empty">Loading exercises…</div>}

            {error && exercises.length === 0 && (
              <div className="exp-empty exp-empty--error">
                Couldn’t load the exercise list. You can still type your own.
                <button type="button" className="exp-retry" onClick={reload}>
                  Try again
                </button>
              </div>
            )}

            {!loading && !error && rows.length === 0 && !showCustom && (
              <div className="exp-empty">No matching exercises</div>
            )}

            {rows.map((row) => {
              if (row.type === "group") {
                return (
                  <div className="exp-group" role="presentation" key={`g-${row.category}`}>
                    {row.category}
                  </div>
                );
              }
              const { item, index } = row;
              const isActive = index === active;
              if (item.kind === "more") {
                return (
                  <div
                    key={`m-${item.category}`}
                    id={`${uid}-opt-${index}`}
                    role="option"
                    aria-selected={isActive}
                    className={`exp-opt exp-opt--more${isActive ? " is-active" : ""}`}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(item)}
                  >
                    Show {item.count} more {item.category.toLowerCase()} exercises
                  </div>
                );
              }
              return (
                <div
                  key={item.ex.dbId ?? item.ex.id}
                  id={`${uid}-opt-${index}`}
                  role="option"
                  aria-selected={isActive}
                  className={`exp-opt${isActive ? " is-active" : ""}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(item)}
                >
                  <span className="exp-opt-name">{item.ex.name}</span>
                  <span className="exp-opt-meta">{meta(item.ex)}</span>
                </div>
              );
            })}

            {capped && <div className="exp-note">Showing the first {SEARCH_LIMIT} matches. Keep typing to narrow it down.</div>}

            {showCustom && (
              <div
                id={`${uid}-opt-${customIndex}`}
                role="option"
                aria-selected={active === customIndex}
                className={`exp-opt exp-opt--custom${active === customIndex ? " is-active" : ""}`}
                onMouseEnter={() => setActive(customIndex)}
                onClick={() => choose({ kind: "custom" })}
              >
                <span className="exp-opt-name">Use “{value.trim()}”</span>
                <span className="exp-opt-meta">Custom exercise</span>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
