/** Feedback tátil no PWA / Android. iOS ignora silenciosamente. */
export function haptic(kind: "light" | "success" | "warn" = "light") {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }
  try {
    if (kind === "success") navigator.vibrate([12, 30, 18]);
    else if (kind === "warn") navigator.vibrate([30, 40, 30]);
    else navigator.vibrate(10);
  } catch {
    /* ignore */
  }
}
