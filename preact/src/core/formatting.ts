export function formatLapTime(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  if (mins > 0) {
    return `${mins}:${String(secs).padStart(2, "0")}.${tenths}`;
  }
  return `${secs}.${tenths}`;
}

export function formatPosition(pos: number | null): string {
  if (pos === null) return "—";
  const suffixes = ["th", "st", "nd", "rd"];
  const mod = pos % 100;
  const suffix = mod >= 11 && mod <= 13 ? "th" : (suffixes[pos % 10] ?? "th");
  return `${pos}${suffix}`;
}

export function formatCallsign(callsign: string | null, fallback = "—"): string {
  return callsign?.trim() || fallback;
}

/**
 * Given a hex color string (e.g. "#ff0000" or "ff0000"), returns "#000000" or
 * "#ffffff" depending on which offers better contrast (luminance-based).
 */
export function contrastHex(hex: string): string {
  const clean = hex.replace(/^#/, "");
  if (clean.length < 6) return "#000000";
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const luminance =
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance > 0.179 ? "#000000" : "#ffffff";
}
