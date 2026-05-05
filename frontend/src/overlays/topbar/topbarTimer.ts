import type { SocketLike } from "../../core/rotorhazardTypes";

type RHTimer = {
  deferred: {
    start: (startMs: number, stagingMs: number | null) => void;
    stop: () => void;
    sync: () => void;
  };
  race: {
    count_up?: boolean;
    duration_tenths?: number;
    hidden_staging?: boolean;
    start: (startMs: number, stagingMs: number | null) => void;
    sync: () => void;
  };
  stopAll: () => void;
};

type RHGlobal = {
  pi_time_request?: number;
  server_time_differential?: number;
  server_time_differential_samples?: Array<{ differential: number; response: number }>;
  sync_within?: number;
  timer?: RHTimer;
};

type TimerGlobals = typeof globalThis & {
  rotorhazard?: RHGlobal;
  socket?: SocketLike;
};

function rh(): RHGlobal | undefined {
  return (globalThis as TimerGlobals).rotorhazard;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? (sorted[mid] ?? 0)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function kickoff(msg: Record<string, unknown>): void {
  const timer = rh()?.timer;
  if (!timer) return;

  const stagingMs = typeof msg.pi_staging_at_s === "number" ? msg.pi_staging_at_s * 1000 : null;
  const startMs = typeof msg.pi_starts_at_s === "number" ? msg.pi_starts_at_s * 1000 : 0;

  timer.stopAll();
  timer.race.hidden_staging = Boolean(msg.hide_stage_timer);
  timer.race.count_up = Boolean(msg.race_mode);
  timer.race.duration_tenths =
    typeof msg.race_time_sec === "number" ? msg.race_time_sec * 10 : undefined;
  timer.race.start(startMs, stagingMs);
}

function handlePiTime(msg: Record<string, unknown>): void {
  const global = rh();
  if (!global) return;

  const responseTime = window.performance.now();
  const requested = global.pi_time_request ?? responseTime;
  const serverDelay = responseTime - requested;
  const oneWay = serverDelay / 2;
  const piMs = typeof msg.pi_time_s === "number" ? msg.pi_time_s * 1000 : responseTime;

  const sample = { differential: piMs - responseTime - oneWay, response: serverDelay };

  const samples = global.server_time_differential_samples ?? [];
  samples.push(sample);
  samples.sort((a, b) => a.response - b.response);

  const best = samples[0];
  if (best) {
    const diffMin = best.differential - best.response;
    const diffMax = best.differential + best.response;
    global.server_time_differential_samples = samples.filter(
      (s) => s.differential >= diffMin && s.differential <= diffMax
    );
  }

  global.server_time_differential = median(
    (global.server_time_differential_samples ?? []).map((s) => s.differential)
  );

  global.timer?.race.sync();
  global.timer?.deferred.sync();

  if ((global.server_time_differential_samples ?? []).length < 10) {
    setTimeout(() => {
      global.pi_time_request = window.performance.now();
      (globalThis as TimerGlobals).socket?.emit?.("get_pi_time");
    }, Math.random() * 500 + 250);
  }
}

export function initTopbarTimer(): () => void {
  const socket = (globalThis as TimerGlobals).socket;
  if (!socket) return () => undefined;

  // Kick off pi_time sync
  if (rh()) {
    rh()!.pi_time_request = window.performance.now();
    socket.emit?.("get_pi_time");
  }

  let resumeCheck = true;

  const onPiTime = (msg: unknown) => handlePiTime(msg as Record<string, unknown>);

  const onRaceScheduled = (msg: unknown) => {
    const m = msg as Record<string, unknown>;
    if (m.scheduled) {
      const startMs = typeof m.scheduled_at === "number" ? m.scheduled_at * 1000 : 0;
      rh()?.timer?.deferred.start(startMs, null);
    } else {
      rh()?.timer?.deferred.stop();
    }
  };

  const onRaceStatus = (msg: unknown) => {
    const m = msg as Record<string, unknown>;
    if (resumeCheck) {
      const status = m.race_status;
      if (status === 1 || status === 3) kickoff(m);
      else socket.emit?.("get_race_scheduled");
    }
    resumeCheck = false;
  };

  const onStageReady = (msg: unknown) => kickoff(msg as Record<string, unknown>);
  const onStopTimer = () => rh()?.timer?.stopAll();

  socket.on("pi_time", onPiTime);
  socket.on("race_scheduled", onRaceScheduled);
  socket.on("race_status", onRaceStatus);
  socket.on("stage_ready", onStageReady);
  socket.on("stop_timer", onStopTimer);

  return () => {
    socket.off?.("pi_time", onPiTime);
    socket.off?.("race_scheduled", onRaceScheduled);
    socket.off?.("race_status", onRaceStatus);
    socket.off?.("stage_ready", onStageReady);
    socket.off?.("stop_timer", onStopTimer);
  };
}
