import { asNumber, asRecord, asString, objectValues } from "./primitives";
import type { LeaderboardEntry, NormalizedCurrentHeat, RawRecord } from "./rotorhazardTypes";

export type ClassLeaderboardDisplayType =
  | "by_consecutives"
  | "by_fastest_lap"
  | "by_race_time"
  | string;

export type OverallResults = {
  entries: LeaderboardEntry[];
  title: string;
};

export type ClassResults = {
  displayType: ClassLeaderboardDisplayType;
  entries: LeaderboardEntry[];
  title: string;
};

function normalizeSavedEntry(value: unknown): LeaderboardEntry | null {
  const raw = asRecord(value);
  if (Object.keys(raw).length === 0) return null;
  return {
    callsign: asString(raw.callsign),
    lastLap: asString(raw.last_lap),
    laps: asNumber(raw.laps),
    node: asNumber(raw.node),
    position: asNumber(raw.position),
    totalTime: asString(raw.total_time),
    raw,
  };
}

function resolveClassId(
  requestedClassId: number | null,
  currentHeat: NormalizedCurrentHeat | null
): number | null {
  if (requestedClassId && requestedClassId > 0) return requestedClassId;
  return currentHeat?.heatClassId ?? null;
}

function resolveClass(
  resultData: RawRecord,
  classId: number
): RawRecord | null {
  const classes = asRecord(resultData.classes);
  const entry = classes[String(classId)] ?? classes[classId as unknown as string];
  const record = asRecord(entry);
  return Object.keys(record).length > 0 ? record : null;
}

export function selectOverallResults(
  resultData: RawRecord | null,
  requestedClassId: number | null,
  currentHeat: NormalizedCurrentHeat | null
): OverallResults | null {
  if (!resultData || Object.keys(asRecord(resultData.heats)).length === 0) return null;

  const classId = resolveClassId(requestedClassId, currentHeat);
  if (classId === null) return null;

  const currentClass = resolveClass(resultData, classId);
  if (!currentClass) return null;

  const leaderboard = asRecord(currentClass.leaderboard);
  const meta = asRecord(leaderboard.meta);
  const primary = asString(meta.primary_leaderboard);
  const entries = objectValues(primary ? leaderboard[primary] : null)
    .map(normalizeSavedEntry)
    .filter((e): e is LeaderboardEntry => e !== null);

  const name = asString(currentClass.name);
  const fallbackId = asNumber(currentClass.id) ?? classId;
  const title = name ? `${name} - Overall Ranking` : `Class ${fallbackId} - Overall Ranking`;

  return { entries, title };
}

export function selectClassResults(
  resultData: RawRecord | null,
  requestedClassId: number | null,
  currentHeat: NormalizedCurrentHeat | null
): ClassResults | null {
  if (!resultData || Object.keys(asRecord(resultData.heats)).length === 0) return null;

  const classId = resolveClassId(requestedClassId, currentHeat);
  if (classId === null) return null;

  const currentClass = resolveClass(resultData, classId);
  if (!currentClass) return null;

  const leaderboard = asRecord(currentClass.leaderboard);
  const meta = asRecord(leaderboard.meta);
  const displayType = asString(meta.primary_leaderboard) ?? "by_race_time";
  const entries = objectValues(leaderboard[displayType])
    .map(normalizeSavedEntry)
    .filter((e): e is LeaderboardEntry => e !== null);

  const name = asString(currentClass.name);
  const fallbackId = asNumber(currentClass.id) ?? classId;
  const title = name ? `Leaderboard - ${name}` : `Leaderboard - Class ${fallbackId}`;

  return { displayType, entries, title };
}
