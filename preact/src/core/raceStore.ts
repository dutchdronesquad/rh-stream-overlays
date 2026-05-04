import { useEffect, useState } from "preact/hooks";

import type {
  NormalizedCurrentHeat,
  NormalizedCurrentLaps,
  NormalizedCollection,
  NormalizedFrequencyData,
  NormalizedLeaderboard,
  NormalizedRaceStatus,
  RawRecord
} from "./rotorhazardTypes";

export type ConnectionState = {
  isConnected: boolean;
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
};

export type RaceStoreState = {
  connection: ConnectionState;
  currentHeat: NormalizedCurrentHeat | null;
  currentLaps: NormalizedCurrentLaps | null;
  classData: NormalizedCollection | null;
  formatData: NormalizedCollection | null;
  frequencyData: NormalizedFrequencyData | null;
  heatData: NormalizedCollection | null;
  language: string | null;
  leaderboard: NormalizedLeaderboard | null;
  pilotData: NormalizedCollection | null;
  raceStatus: NormalizedRaceStatus | null;
  resultData: RawRecord | null;
};

type RaceStoreListener = () => void;
type RaceStoreUpdater = (state: RaceStoreState) => RaceStoreState;

const initialState: RaceStoreState = {
  connection: {
    isConnected: false,
    lastConnectedAt: null,
    lastDisconnectedAt: null
  },
  currentHeat: null,
  currentLaps: null,
  classData: null,
  formatData: null,
  frequencyData: null,
  heatData: null,
  language: null,
  leaderboard: null,
  pilotData: null,
  raceStatus: null,
  resultData: null
};

let state = initialState;
const listeners = new Set<RaceStoreListener>();

export function getRaceState(): RaceStoreState {
  return state;
}

export function resetRaceState(): void {
  state = initialState;
  listeners.forEach((listener) => listener());
}

export function setRaceState(updater: RaceStoreUpdater): void {
  state = updater(state);
  listeners.forEach((listener) => listener());
}

export function subscribeRaceState(listener: RaceStoreListener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function useRaceState(): RaceStoreState {
  const [snapshot, setSnapshot] = useState(getRaceState);

  useEffect(
    () =>
      subscribeRaceState(() => {
        setSnapshot(getRaceState());
      }),
    []
  );

  return snapshot;
}
