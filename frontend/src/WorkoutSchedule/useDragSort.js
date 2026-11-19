import { useCallback, useEffect, useRef, useState } from "react";

const THRESHOLD = 4; // px of movement before a press becomes a drag
const EDGE = 48; // px from the scroll area's top/bottom where auto-scroll kicks in
const MAX_SPEED = 14; // px per frame

/**
 * useDragSort
 * ---------------------------------------------------------------------------
 * Press anywhere on a row (except inputs and buttons) and slide it up or down to
 * reorder it inside its list. Other rows slide out of the way while you drag, and the
 * scroll area scrolls by itself when you hold the row near its top or bottom edge.
 *
 *   listRef    the element whose direct children are the rows
 *   scrollRef  the scrollable ancestor (optional, enables edge auto-scroll)
 *   onMove     (fromIndex, toIndex) => void, called once when you drop
 *
 * Rows need a `data-sort-row` attribute; spread rowProps(index) on each one.
 * Touch devices drag by the grip only (an element with `data-grip`) so scrolling still works.
 * Escape cancels a drag. Dragging by keyboard is handled by the caller (arrow keys on the grip).
 */
export default function useDragSort({ listRef, scrollRef, onMove }) {
  const [dragIndex, setDragIndex] = useState(null);
  const onMoveRef = useRef(onMove);
  const drag = useRef(null);
  const cleanup = useRef(null);

  useEffect(() => {
    onMoveRef.current = onMove;
  });
  useEffect(() => () => cleanup.current?.(), []); // unmounting mid-drag

  const start = useCallback(
    (e, index) => {
      if (e.button !== 0 || drag.current) return;
      if (e.target.closest("input, textarea, select, a, [role='combobox'], button:not([data-grip])")) return;
      if (e.pointerType === "touch" && !e.target.closest("[data-grip]")) return;

      const list = listRef.current;
      if (!list) return;
      const rows = [...list.querySelectorAll(":scope > [data-sort-row]")];
      if (rows.length < 2) return;

      const scroller = scrollRef?.current ?? null;
      const tops = rows.map((r) => r.offsetTop);
      const heights = rows.map((r) => r.offsetHeight);
      const gap = tops[1] - tops[0] - heights[0];
      const s = {
        index,
        rows,
        tops,
        heights,
        step: heights[index] + gap,
        startY: e.clientY,
        startScroll: scroller?.scrollTop ?? 0,
        clientY: e.clientY,
        target: index,
        moved: false,
        raf: 0,
        prevSelect: "",
      };
      drag.current = s;

      const apply = () => {
        const dy = s.clientY - s.startY + ((scroller?.scrollTop ?? 0) - s.startScroll);
        const center = s.tops[s.index] + s.heights[s.index] / 2 + dy;
        let target = 0;
        s.rows.forEach((_, j) => {
          if (j !== s.index && s.tops[j] + s.heights[j] / 2 < center) target++;
        });
        s.target = target;
        s.rows.forEach((row, j) => {
          if (j === s.index) {
            row.style.transform = `translateY(${dy}px)`;
            return;
          }
          let shift = 0;
          if (s.index < target && j > s.index && j <= target) shift = -s.step;
          else if (s.index > target && j >= target && j < s.index) shift = s.step;
          row.style.transform = shift ? `translateY(${shift}px)` : "";
        });
      };

      const tick = () => {
        if (drag.current !== s) return;
        if (scroller) {
          const r = scroller.getBoundingClientRect();
          let v = 0;
          if (s.clientY < r.top + EDGE) v = -Math.ceil(MAX_SPEED * Math.min(1, (r.top + EDGE - s.clientY) / EDGE));
          else if (s.clientY > r.bottom - EDGE) v = Math.ceil(MAX_SPEED * Math.min(1, (s.clientY - (r.bottom - EDGE)) / EDGE));
          if (v) {
            scroller.scrollTop += v;
            apply();
          }
        }
        s.raf = requestAnimationFrame(tick);
      };

      const onPointerMove = (ev) => {
        s.clientY = ev.clientY;
        if (!s.moved) {
          if (Math.abs(ev.clientY - s.startY) < THRESHOLD) return;
          s.moved = true;
          s.prevSelect = document.body.style.userSelect;
          document.body.style.userSelect = "none";
          s.rows.forEach((row, j) => {
            if (j === s.index) {
              row.style.transition = "none";
              row.style.zIndex = "5";
            } else {
              row.style.transition = "transform 150ms ease";
            }
          });
          setDragIndex(s.index);
          s.raf = requestAnimationFrame(tick);
        }
        apply();
      };

      const finish = (commit) => {
        if (drag.current !== s) return;
        cancelAnimationFrame(s.raf);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("keydown", onKey);
        if (s.moved) document.body.style.userSelect = s.prevSelect;
        s.rows.forEach((row) => {
          row.style.transform = "";
          row.style.transition = "";
          row.style.zIndex = "";
        });
        drag.current = null;
        cleanup.current = null;
        setDragIndex(null);
        if (commit && s.moved && s.target !== s.index) onMoveRef.current(s.index, s.target);
      };
      const onUp = () => finish(true);
      const onCancel = () => finish(false);
      const onKey = (ev) => {
        if (ev.key === "Escape") finish(false);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("keydown", onKey);
      cleanup.current = () => finish(false);
    },
    [listRef, scrollRef]
  );

  const rowProps = (index) => ({
    "data-sort-row": "",
    onPointerDown: (e) => start(e, index),
  });

  return { dragIndex, rowProps };
}
