import {
  normalizeClassData,
  normalizeCurrentHeat,
  normalizeCurrentLaps,
  normalizeFormatData,
  normalizeFrequencyData,
  normalizeHeatData,
  normalizeLeaderboard,
  normalizePilotData,
  normalizeRaceStatus
} from "./normalizers";
import { setRaceState } from "./raceStore";
import type { RawRecord, RotorHazardEvent, SocketLike } from "./rotorhazardTypes";

type SocketGlobals = typeof globalThis & {
  rotorhazard?: {
    show_messages?: boolean;
  };
  socket?: SocketLike;
};

type RotorHazardSocketOptions = {
  events?: RotorHazardEvent[];
  requestLoadData?: boolean;
  socket?: SocketLike;
};

const SOCKET_WAIT_TIMEOUT_MS = 5000;
const SOCKET_WAIT_INTERVAL_MS = 50;
const DEFAULT_EVENTS: RotorHazardEvent[] = [
  "language",
  "current_heat",
  "race_status",
  "current_laps",
  "leaderboard"
];

function now(): number {
  return Date.now();
}

function asRecord(payload: unknown): RawRecord {
  return Boolean(payload) && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as RawRecord)
    : {};
}

function readSocket(): SocketLike | undefined {
  return (globalThis as SocketGlobals).socket;
}

function requestData(socket: SocketLike, events: RotorHazardEvent[]): void {
  socket.emit?.("load_data", { load_types: events });
}

function setConnection(isConnected: boolean): void {
  setRaceState((state) => ({
    ...state,
    connection: {
      isConnected,
      lastConnectedAt: isConnected ? now() : state.connection.lastConnectedAt,
      lastDisconnectedAt: isConnected ? state.connection.lastDisconnectedAt : now()
    }
  }));
}

function handleEvent(eventName: RotorHazardEvent, payload: unknown): void {
  switch (eventName) {
    case "language": {
      const raw = asRecord(payload);
      const language = typeof raw.language === "string" ? raw.language : null;
      setRaceState((state) => ({ ...state, language }));
      break;
    }
    case "current_heat":
      setRaceState((state) => ({
        ...state,
        currentHeat: normalizeCurrentHeat(payload)
      }));
      break;
    case "race_status":
      setRaceState((state) => ({
        ...state,
        raceStatus: normalizeRaceStatus(payload)
      }));
      break;
    case "current_laps":
      setRaceState((state) => ({
        ...state,
        currentLaps: normalizeCurrentLaps(payload)
      }));
      break;
    case "class_data":
      setRaceState((state) => ({
        ...state,
        classData: normalizeClassData(payload)
      }));
      break;
    case "format_data":
      setRaceState((state) => ({
        ...state,
        formatData: normalizeFormatData(payload)
      }));
      break;
    case "frequency_data":
      setRaceState((state) => ({
        ...state,
        frequencyData: normalizeFrequencyData(payload)
      }));
      break;
    case "heat_data":
      setRaceState((state) => ({
        ...state,
        heatData: normalizeHeatData(payload)
      }));
      break;
    case "leaderboard":
      setRaceState((state) => ({
        ...state,
        leaderboard: normalizeLeaderboard(payload)
      }));
      break;
    case "pilot_data":
      setRaceState((state) => ({
        ...state,
        pilotData: normalizePilotData(payload)
      }));
      break;
    case "result_data":
      setRaceState((state) => ({ ...state, resultData: asRecord(payload) }));
      break;
  }
}

export function connectRotorHazardSocket(
  options: RotorHazardSocketOptions = {}
): () => void {
  const socket = options.socket ?? readSocket();
  const events = options.events ?? DEFAULT_EVENTS;
  const shouldRequestLoadData = options.requestLoadData ?? true;

  if (!socket) {
    setConnection(false);
    if (options.socket) {
      return () => undefined;
    }

    let isCancelled = false;
    let cleanup: (() => void) | null = null;
    const startedAt = Date.now();
    const waitForSocket = window.setInterval(() => {
      const pendingSocket = readSocket();
      const timedOut = Date.now() - startedAt > SOCKET_WAIT_TIMEOUT_MS;
      if (isCancelled || timedOut) {
        window.clearInterval(waitForSocket);
        return;
      }

      if (pendingSocket) {
        window.clearInterval(waitForSocket);
        cleanup = connectRotorHazardSocket({
          ...options,
          socket: pendingSocket
        });
      }
    }, SOCKET_WAIT_INTERVAL_MS);

    return () => {
      isCancelled = true;
      window.clearInterval(waitForSocket);
      cleanup?.();
    };
  }

  const handlers = new Map<string, (payload: unknown) => void>();

  const connectHandler = () => {
    setConnection(true);
  };
  const disconnectHandler = () => {
    setConnection(false);
  };

  socket.on("connect", connectHandler);
  socket.on("disconnect", disconnectHandler);
  handlers.set("connect", connectHandler);
  handlers.set("disconnect", disconnectHandler);

  events.forEach((eventName) => {
    const handler = (payload: unknown) => {
      handleEvent(eventName, payload);
    };
    socket.on(eventName, handler);
    handlers.set(eventName, handler);
  });

  if (shouldRequestLoadData) {
    requestData(socket, events);
  }

  setConnection(Boolean(socket.connected));

  return () => {
    if (!socket.off) {
      return;
    }

    handlers.forEach((handler, eventName) => {
      socket.off?.(eventName, handler);
    });
  };
}
