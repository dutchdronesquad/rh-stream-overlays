type RotorHazardGlobal = {
  server_time_differential?: number;
};

type TimingGlobals = typeof globalThis & {
  rotorhazard?: RotorHazardGlobal;
};

export function serverNow(): number {
  const rh = (globalThis as TimingGlobals).rotorhazard;
  const serverTimeDifferential = rh?.server_time_differential;
  const diff =
    typeof serverTimeDifferential === "number" && Number.isFinite(serverTimeDifferential)
      ? serverTimeDifferential
      : 0;
  return Date.now() + diff;
}

export function msToSeconds(ms: number): number {
  return ms / 1000;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}
