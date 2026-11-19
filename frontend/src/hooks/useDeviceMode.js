import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 768px)";
const COARSE_QUERY = "(pointer: coarse)";

function computeDeviceState() {
  if (typeof window === "undefined") {
    return { isMobile: false, isTouch: false, deviceType: "desktop" };
  }
  const narrowScreen = window.matchMedia(MOBILE_QUERY).matches;
  const coarsePointer = window.matchMedia(COARSE_QUERY).matches;
  const isMobile = narrowScreen || (coarsePointer && window.innerWidth <= 900);

  return {
    isMobile,
    isTouch: coarsePointer || "ontouchstart" in window,
    deviceType: isMobile ? "mobile" : "desktop",
  };
}

/**
 * Detects whether the user is on a mobile screen/device or laptop/desktop.
 * Also sets `data-device="mobile" | "desktop"` on <html> for CSS hooks.
 */
export function useDeviceMode() {
  const [state, setState] = useState(computeDeviceState);

  useEffect(() => {
    const mobileMq = window.matchMedia(MOBILE_QUERY);
    const coarseMq = window.matchMedia(COARSE_QUERY);

    const update = () => {
      const next = computeDeviceState();
      setState(next);
      document.documentElement.dataset.device = next.deviceType;
    };

    update();
    mobileMq.addEventListener("change", update);
    coarseMq.addEventListener("change", update);
    window.addEventListener("resize", update);

    return () => {
      mobileMq.removeEventListener("change", update);
      coarseMq.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return state;
}

export default useDeviceMode;