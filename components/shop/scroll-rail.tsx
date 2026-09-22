"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** How far the pointer has to travel before a press counts as a drag
 * rather than a click. Below it, a shaky hand still opens the product. */
const DRAG_THRESHOLD = 6;

/** A nudge, not a page: leaving part of the previous card visible is what
 * tells the shopper the row kept going rather than jumped. */
const SCROLL_STEP = 0.8;

/**
 * A horizontal row that a mouse can drag, not only a finger.
 *
 * `overflow-x-auto` alone already works on touch and trackpads, but the
 * rows hide their scrollbar (see `.scrollbar-hide` in globals.css), which
 * leaves someone on a desktop with a mouse no way to reach the rest of the
 * row and no sign there is a rest. This adds the two things that fix that:
 * press-and-drag, and arrows that appear only while there is somewhere to
 * go.
 *
 * Touch is deliberately left alone — native scrolling is smoother than
 * anything reimplemented here, so the drag only engages for a mouse.
 */
export function ScrollRail({
  children,
  className = "",
  label,
}: {
  children: ReactNode;
  /** Extra classes for the scrolling row itself (gap, padding, widths). */
  className?: string;
  /** Names the row for screen readers on the arrow buttons, e.g. "Mais
   * vendidos" -> "Ver anteriores de Mais vendidos". */
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);
  const [dragging, setDragging] = useState(false);

  // Kept in a ref, not state: these change on every pointermove and must
  // not re-render the row while it is being dragged.
  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: false });

  const syncEdges = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // A pixel of slack: scrollLeft lands on fractions at some zoom levels
    // and would otherwise never test equal to either end.
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft >= max - 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    syncEdges();
    // Watches the row *and* its content: a card growing as its photo
    // decodes changes scrollWidth without the container ever resizing, and
    // the arrows would stay wrong until the next scroll.
    const observer = new ResizeObserver(syncEdges);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [syncEdges, children]);

  // Both ends reachable at once means everything already fits, so there is
  // nothing to drag and no arrow worth showing.
  const scrollable = !(atStart && atEnd);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // Touch and pen keep native scrolling, which has momentum and rubber
    // banding that this would only get in the way of.
    if (event.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el || !scrollable) return;
    drag.current = {
      active: true,
      startX: event.clientX,
      startScroll: el.scrollLeft,
      moved: false,
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || !drag.current.active) return;
    const dx = event.clientX - drag.current.startX;
    if (!drag.current.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      drag.current.moved = true;
      setDragging(true);
      // Captured only once the press is known to be a drag, so a plain
      // click on a card still reaches the card.
      el.setPointerCapture(event.pointerId);
    }
    el.scrollLeft = drag.current.startScroll - dx;
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (el?.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
    drag.current.active = false;
    setDragging(false);
  }

  /**
   * The click that follows a drag would otherwise open whichever product
   * happened to be under the cursor when the mouse came up. Swallowed in
   * the capture phase so the card's own Link never sees it.
   */
  function handleClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (!drag.current.moved) return;
    event.preventDefault();
    event.stopPropagation();
    drag.current.moved = false;
  }

  function step(direction: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * SCROLL_STEP, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={syncEdges}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onClickCapture={handleClickCapture}
        // Dragging across a photo would otherwise start a native image
        // drag and abandon the scroll halfway.
        onDragStart={(event) => event.preventDefault()}
        className={`scrollbar-hide flex overflow-x-auto ${className} ${
          scrollable ? (dragging ? "cursor-grabbing select-none" : "cursor-grab") : ""
        }`}
      >
        {children}
      </div>

      {scrollable && (
        <>
          <RailArrow
            side="left"
            hidden={atStart}
            onClick={() => step(-1)}
            label={label ? `Ver anteriores de ${label}` : "Ver anteriores"}
          />
          <RailArrow
            side="right"
            hidden={atEnd}
            onClick={() => step(1)}
            label={label ? `Ver mais de ${label}` : "Ver mais"}
          />
        </>
      )}
    </div>
  );
}

/** Pointer-only: a touch device scrolls by swiping and would just lose
 * screen width to a control it never needs. */
function RailArrow({
  side,
  hidden,
  onClick,
  label,
}: {
  side: "left" | "right";
  hidden: boolean;
  onClick: () => void;
  label: string;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      // Untabbable and inert once it runs out of row, rather than removed:
      // a button that vanishes shifts nothing, but one that unmounts and
      // remounts flickers on every scroll that touches an edge.
      tabIndex={hidden ? -1 : 0}
      aria-hidden={hidden}
      className={`absolute top-[38%] z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-bg text-fg shadow-md transition-opacity duration-200 ease-out hover:bg-surface-2 md:flex ${
        side === "left" ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2"
      } ${hidden ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <Icon className="size-5" aria-hidden="true" />
    </button>
  );
}
