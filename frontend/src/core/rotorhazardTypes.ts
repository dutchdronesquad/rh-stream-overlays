export type RotorHazardEvent =
  | "all_languages"
  | "language"
  | "frequency_data"
  | "heat_data"
  | "pilot_data"
  | "class_data"
  | "format_data"
  | "current_heat"
  | "race_status"
  | "current_laps"
  | "leaderboard"
  | "result_data"
  | "pi_time"
  | "race_scheduled"
  | "prestage_ready"
  | "stage_ready"
  | "stop_timer";

export type SocketLike = {
  connected?: boolean;
  emit?: (eventName: string, payload?: unknown) => void;
  off?: (eventName: string, handler: (payload: unknown) => void) => void;
  on: (eventName: string, handler: (payload: unknown) => void) => void;
};

export type RawRecord = Record<string, unknown>;

export type LeaderboardEntry = {
  callsign: string | null;
  lastLap: string | null;
  laps: number | null;
  node: number | null;
  position: number | null;
  totalTime: string | null;
  raw: RawRecord;
};

export type NormalizedLeaderboard = {
  displayName: string | null;
  entries: LeaderboardEntry[];
  heatId: number | null;
  primary: string | null;
  raw: RawRecord;
};

export type NormalizedCurrentHeat = {
  currentHeatId: number | null;
  heatClassId: number | null;
  heatFormatId: number | null;
  heatNodes: unknown;
  nextRound: number | null;
  raw: RawRecord;
};

export type NormalizedCurrentLaps = {
  nodeIndex: RawRecord | null;
  raw: RawRecord;
};

export type NormalizedCollection = {
  byId: Record<string, RawRecord>;
  items: RawRecord[];
  raw: RawRecord;
};

export type NormalizedFrequencyData = {
  frequenciesByNode: Record<string, unknown>;
  raw: RawRecord;
};

export type NormalizedRaceStatus = {
  label: "idle" | "running" | "staging" | "stopped";
  raw: RawRecord;
  status: number | null;
};
