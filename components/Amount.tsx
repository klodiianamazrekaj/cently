"use client";

import { useEffect, useRef, useState } from "react";
import { splitCents } from "@/lib/money";

// Big euros, smaller cents: 1.284,50 €. With animate, the number counts up to its new value.
export function Amount({
  cents,
  size = 17,
  animate = false,
  sign,
  className,
}: {
  cents: number;
  size?: number;
  animate?: boolean;
  sign?: "+" | "-";
  className?: string;
}) {
  const shown = useCountUp(cents, animate);
  const { main, cents: c } = splitCents(shown);
  return (
    <span className={`num ${className ?? ""}`} style={{ fontSize: size, lineHeight: 1, fontWeight: 600, letterSpacing: size > 30 ? "-0.045em" : "-0.01em", whiteSpace: "nowrap" }}>
      {sign}
      {main}
      <span style={{ fontSize: "0.55em", letterSpacing: "-0.01em", opacity: 0.6, marginLeft: "0.02em" }}>{c} €</span>
    </span>
  );
}

function useCountUp(target: number, enabled: boolean) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (!enabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      from.current = target;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 650);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(a + (target - a) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled]);
  return value;
}
