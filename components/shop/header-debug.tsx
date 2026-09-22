"use client";

import { useEffect, useState } from "react";

/**
 * Live read-out of the things that would explain a header whose buttons
 * stop responding, shown only when the URL carries `?debug=1`.
 *
 * It exists because the failure has never reproduced outside an actual
 * iPhone: in Chrome, at every viewport and through a long soak of
 * opening, closing and navigating, the controls stay reachable and the
 * body stays clean. That leaves the WebKit-only suspects — a sticky
 * layer whose hit-test region stops matching where it is painted once
 * Safari resizes the visual viewport (its address bar collapsing, or the
 * keyboard opening under the search field) — and this panel is what
 * tells them apart instead of guessing again.
 *
 * `hit` is the one that matters. It hit-tests the centre of each control
 * and reports what the browser says is actually there. If the buttons
 * are dead and `hit` still reads "ok", the taps are arriving and
 * something in React is at fault; if `hit` reports another element, or
 * an offset far from 0, the viewport has moved out from under the header
 * and the fix belongs in CSS.
 */
export function HeaderDebug() {
  const [on, setOn] = useState(false);
  const [info, setInfo] = useState<Record<string, string>>({});
  const [taps, setTaps] = useState(0);

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug")) return;
    setOn(true);

    const read = () => {
      const header = document.querySelector("header");
      const rect = header?.getBoundingClientRect();
      const vv = window.visualViewport;
      const probe = (selector: string, label: string) => {
        const el = document.querySelector(selector);
        if (!el) return `${label}: ausente`;
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        if (!hit) return `${label}: NADA`;
        return `${label}: ${el.contains(hit) ? "ok" : "BLOQUEADO(" + hit.tagName + ")"}`;
      };
      setInfo({
        scroll: String(Math.round(window.scrollY)),
        header: rect ? `top ${Math.round(rect.top)} alt ${Math.round(rect.height)}` : "-",
        vv: vv
          ? `off ${Math.round(vv.offsetTop)} alt ${Math.round(vv.height)} esc ${vv.scale.toFixed(2)}`
          : "-",
        body: `pe ${getComputedStyle(document.body).pointerEvents} ov ${getComputedStyle(document.body).overflow}`,
        hit: [
          probe('[aria-label="Abrir menu"]', "menu"),
          probe('[aria-label="Entrar"]', "conta"),
          probe('[aria-label^="Abrir sacola"]', "sacola"),
        ].join(" | "),
      });
    };

    read();
    const count = () => setTaps((n) => n + 1);
    // Capture phase on the document: counts every touch that reached the
    // page at all, whatever the header does with it afterwards.
    document.addEventListener("touchend", count, true);
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    window.visualViewport?.addEventListener("resize", read);
    window.visualViewport?.addEventListener("scroll", read);
    const timer = window.setInterval(read, 500);
    return () => {
      document.removeEventListener("touchend", count, true);
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
      window.visualViewport?.removeEventListener("resize", read);
      window.visualViewport?.removeEventListener("scroll", read);
      window.clearInterval(timer);
    };
  }, []);

  if (!on) return null;

  return (
    <div
      // Above the drawers (z-50) so it stays readable even with one open,
      // and click-through so it can never be the thing blocking a tap.
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] bg-black/85 px-2 py-1.5 font-mono text-[10px] leading-tight text-lime-300"
    >
      <div>toques: {taps} · scroll: {info.scroll}</div>
      <div>header: {info.header}</div>
      <div>viewport: {info.vv}</div>
      <div>body: {info.body}</div>
      <div className="text-amber-300">{info.hit}</div>
    </div>
  );
}
