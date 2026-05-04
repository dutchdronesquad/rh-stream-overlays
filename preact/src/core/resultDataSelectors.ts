import type {
  LeaderboardEntry,
  NormalizedCurrentHeat,
  RawRecord
} from "./rotorhazardTypes";

type OverallResults = {
  entries: LeaderboardEntry[];
  title: string;
};

export type ClassLeaderboardDisplayType =
  | "by_consecutives"
  | "by_fastest_lap"
  | "by_race_time"
  | string;

type ClassResults = {
  displayType: ClassLeaderboardDisplayType;
  entries: LeaderboardEntry[];
  title: string;
};

function isRecord(value: unknown): value is RawRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): RawRecord {
  return isRecord(value) ? value : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function objectValues(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (isRecord(value)) {
    return Object.values(value);
  }

  return [];
}

function normalizeSavedResultEntry(value: unknown): LeaderboardEntry | null {
  const raw = asRecord(value);

  if (Object.keys(raw).length === 0) {
    return null;
  }

  return {
    callsign: asString(raw.callsign),
    lastLap: asString(raw.last_lap),
    laps: asNumber(raw.laps),
    node: asNumber(raw.node),
    position: asNumber(raw.position),
    totalTime: asString(raw.total_time),
    raw
  };
}

function resolveClassId(
  requestedClassId: number | null,
  currentHeat: NormalizedCurrentHeat | null
): number | null {
  if (requestedClassId && requestedClassId > 0) {
    return requestedClassId;
  }

  return currentHeat?.heatClassId ?? null;
}

export function selectOverallResults(
  resultData: RawRecord | null,
  requestedClassId: number | null,
  currentHeat: NormalizedCurrentHeat | null
): OverallResults | null {
  if (!resultData || Object.keys(asRecord(resultData.heats)).length === 0) {
    return null;
  }

  const classId = resolveClassId(requestedClassId, currentHeat);
  if (classId === null) {
    return null;
  }

  const classes = asRecord(resultData.classes);
  const currentClass = asRecord(classes[String(classId)] ?? classes[classId]);
  if (Object.keys(currentClass).length === 0) {
    return null;
  }

  const leaderboard = asRecord(currentClass.leaderboard);
  const meta = asRecord(leaderboard.meta);
  const primary = asString(meta.primary_leaderboard);
  const entries = objectValues(primary ? leaderboard[primary] : null)
    .map(normalizeSavedResultEntry)
    .filter((entry): entry is LeaderboardEntry => entry !== null);

  const className = asString(currentClass.name);
  const fallbackId = asNumber(currentClass.id) ?? classId;

  return {
    entries,
    title: className
      ? `${className} - Overall Ranking`
      : `Class ${fallbackId} - Overall Ranking`
  };
}

export function selectClassResults(
  resultData: RawRecord | null,
  requestedClassId: number | null,
  currentHeat: NormalizedCurrentHeat | null
): ClassResults | null {
  if (!resultData || Object.keys(asRecord(resultData.heats)).length === 0) {
    return null;
  }

  const classId = resolveClassId(requestedClassId, currentHeat);
  if (classId === null) {
    return null;
  }

  const classes = asRecord(resultData.classes);
  const currentClass = asRecord(classes[String(classId)] ?? classes[classId]);
  if (Object.keys(currentClass).length === 0) {
    return null;
  }

  const leaderboard = asRecord(currentClass.leaderboard);
  const meta = asRecord(leaderboard.meta);
  const primary = asString(meta.primary_leaderboard) ?? "by_race_time";
  const entries = objectValues(leaderboard[primary])
    .map(normalizeSavedResultEntry)
    .filter((entry): entry is LeaderboardEntry => entry !== null);

  const className = asString(currentClass.name);
  const fallbackId = asNumber(currentClass.id) ?? classId;

  return {
    displayType: primary,
    entries,
    title: className ? `Leaderboard - ${className}` : `Leaderboard - Class ${fallbackId}`
  };
}
