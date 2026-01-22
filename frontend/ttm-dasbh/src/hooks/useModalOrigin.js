import { useLayoutEffect, useRef } from "react";
import { getLastModalClick } from "../utils/modalOrigin";

export function useModalOrigin(active) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    if (!active || !ref.current) return;
    const origin = getLastModalClick();
    const el = ref.current;
    if (origin && Number.isFinite(origin.x) && Number.isFinite(origin.y)) {
      const rect = el.getBoundingClientRect();
      const ox = Math.max(0, Math.min(rect.width, origin.x - rect.left));
      const oy = Math.max(0, Math.min(rect.height, origin.y - rect.top));
      el.style.transformOrigin = `${ox}px ${oy}px`;
    } else {
      el.style.transformOrigin = "50% 50%";
    }
  }, [active]);

  return ref;
}
