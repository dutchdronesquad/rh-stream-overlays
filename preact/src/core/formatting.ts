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
