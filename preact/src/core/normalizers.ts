import { asNumber, asRecord, asString, isRecord, objectValues } from "./primitives";
import type {
  LeaderboardEntry,
  NormalizedCollection,
  NormalizedCurrentHeat,
  NormalizedCurrentLaps,
  NormalizedFrequencyData,
  NormalizedLeaderboard,
  NormalizedRaceStatus,
  RawRecord,
} from "./rotorhazardTypes";

function getRecordId(value: RawRecord, idKeys: string[]): string | null {
  for (const key of idKeys) {
    const rawId = value[key];
    if (typeof rawId === "number" && Number.isFinite(rawId)) return String(rawId);
    if (typeof rawId === "string" && rawId !== "") return rawId;
  }
  return null;
}

function normalizeCollection(
  payload: unknown,
  collectionKey: string,
  idKeys: string[]
): NormalizedCollection {
  const raw = asRecord(payload);
  const items = objectValues(raw[collectionKey])
    .map(asRecord)
    .filter((item) => Object.keys(item).length > 0);
  const byId: Record<string, RawRecord> = {};
  items.forEach((item) => {
    const id = getRecordId(item, idKeys);
    if (id !== null) byId[id] = item;
  });
  return { byId, items, raw };
}

function normalizeLeaderboardEntry(value: unknown): LeaderboardEntry | null {
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

export function normalizeCurrentHeat(payload: unknown): NormalizedCurrentHeat {
  const raw = asRecord(payload);
  return {
    currentHeatId: asNumber(raw.current_heat),
    heatClassId: asNumber(raw.heat_class),
    heatFormatId: asNumber(raw.heat_format),
    heatNodes: raw.heatNodes ?? null,
    nextRound: asNumber(raw.next_round),
    raw,
  };
}

export function normalizeCurrentLaps(payload: unknown): NormalizedCurrentLaps {
  const raw = asRecord(payload);
  const current = asRecord(raw.current);
  const nodeIndex = isRecord(current.node_index) ? current.node_index : null;
  return { nodeIndex, raw };
}

export function normalizeClassData(payload: unknown): NormalizedCollection {
  return normalizeCollection(payload, "classes", ["id"]);
}

export function normalizeFormatData(payload: unknown): NormalizedCollection {
  return normalizeCollection(payload, "formats", ["id"]);
}

export function normalizeHeatData(payload: unknown): NormalizedCollection {
  return normalizeCollection(payload, "heats", ["id"]);
}

export function normalizePilotData(payload: unknown): NormalizedCollection {
  return normalizeCollection(payload, "pilots", ["pilot_id", "id"]);
}

export function normalizeFrequencyData(payload: unknown): NormalizedFrequencyData {
  const raw = asRecord(payload);
  return { frequenciesByNode: asRecord(raw.fdata), raw };
}

export function normalizeLeaderboard(payload: unknown): NormalizedLeaderboard {
  const raw = asRecord(payload);
  const current = asRecord(raw.current);
  const race = asRecord(current.leaderboard);
  const meta = asRecord(race.meta);
  const primary = asString(meta.primary_leaderboard);
  const entries = objectValues(primary ? race[primary] : null)
    .map(normalizeLeaderboardEntry)
    .filter((entry): entry is LeaderboardEntry => entry !== null);
  return {
    displayName: asString(current.displayname),
    entries,
    heatId: asNumber(current.heat),
    primary,
    raw,
  };
}

export function normalizeRaceStatus(payload: unknown): NormalizedRaceStatus {
  const raw = asRecord(payload);
  const status = asNumber(raw.race_status);
  let label: NormalizedRaceStatus["label"] = "idle";
  if (status === 1) label = "running";
  else if (status === 2) label = "stopped";
  else if (status === 3) label = "staging";
  return { label, raw, status };
}
