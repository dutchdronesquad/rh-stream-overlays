import type { SocketLike } from "./rotorhazardTypes";

type RotorHazardTimer = {
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

type RotorHazardGlobal = {
  pi_time_request?: number;
  race_status_go_time?: number;
  server_time_differential?: number;
  server_time_differential_samples?: Array<{
    differential: number;
    response: number;
  }>;
  show_messages?: boolean;
  sync_within?: number;
  timer?: RotorHazardTimer;
};

type RotorHazardTimerGlobals = typeof globalThis & {
  rotorhazard?: RotorHazardGlobal;
  socket?: SocketLike;
};

type RaceStatusPayload = {
  hide_stage_timer?: unknown;
  pi_staging_at_s?: number;
  pi_starts_at_s?: number;
  race_mode?: unknown;
  race_status?: number;
  race_time_sec?: number;
};

type PiTimePayload = {
  pi_time_s?: number;
};

type RaceScheduledPayload = {
  scheduled?: boolean;
  scheduled_at?: number;
};

let resumeCheck = true;

function rotorhazard(): RotorHazardGlobal | undefined {
  return (globalThis as RotorHazardTimerGlobals).rotorhazard;
}

function socket(): SocketLike | undefined {
  return (globalThis as RotorHazardTimerGlobals).socket;
}

function median(values: number[]): number {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[midpoint]
    : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

function setRaceClasses(status: number | undefined): void {
  document.body.classList.toggle("race-running", status === 1 || status === 3);
  document.body.classList.toggle("race-stopped", status === 2);
  document.body.classList.toggle("race-new", status !== 1 && status !== 2 && status !== 3);
  document.querySelectorAll(".timing-clock, .timer-section").forEach((element) => {
    element.classList.toggle("staging", status === 3);
  });
}

function raceKickoff(payload: RaceStatusPayload): void {
  const rh = rotorhazard();
  if (!rh?.timer) {
    return;
  }

  rh.timer.stopAll();
  rh.timer.race.hidden_staging = Boolean(payload.hide_stage_timer);
  rh.timer.race.count_up = Boolean(payload.race_mode);
  rh.timer.race.duration_tenths = (payload.race_time_sec ?? 0) * 10;
  rh.timer.race.start(
    (payload.pi_starts_at_s ?? 0) * 1000,
    (payload.pi_staging_at_s ?? 0) * 1000
  );
}

function requestPiTime(): void {
  const rh = rotorhazard();
  const rhSocket = socket();
  if (!rh || !rhSocket?.emit) {
    return;
  }

  rh.pi_time_request = window.performance.now();
  rhSocket.emit("get_pi_time");
}

function handlePiTime(payload: PiTimePayload): void {
  const rh = rotorhazard();
  if (!rh?.timer || typeof payload.pi_time_s !== "number") {
    return;
  }

  const responseTime = window.performance.now();
  const serverDelay = responseTime - (rh.pi_time_request ?? responseTime);
  const serverOneway = serverDelay ? serverDelay / 2 : serverDelay;
  const sample = {
    differential: payload.pi_time_s * 1000 - responseTime - serverOneway,
    response: Number.parseFloat(String(serverDelay))
  };

  const samples = rh.server_time_differential_samples ?? [];
  samples.push(sample);
  samples.sort((a, b) => a.response - b.response);

  const best = samples[0];
  const diffMin = best.differential - best.response;
  const diffMax = best.differential + best.response;
  rh.server_time_differential_samples = samples.filter((value) => {
    return value.differential >= diffMin && value.differential <= diffMax;
  });
  rh.server_time_differential = median(
    rh.server_time_differential_samples.map((value) => value.differential)
  );
  rh.timer.race.sync();
  rh.timer.deferred.sync();

  if (rh.server_time_differential_samples.length < 10) {
    window.setTimeout(requestPiTime, Math.random() * 500 + 250);
  }

  rh.sync_within = Math.ceil(
    Math.min(...rh.server_time_differential_samples.map((value) => value.response))
  );
}

function handleRaceScheduled(payload: RaceScheduledPayload): void {
  const rh = rotorhazard();
  if (!rh?.timer) {
    return;
  }

  if (payload.scheduled && typeof payload.scheduled_at === "number") {
    rh.timer.deferred.start(payload.scheduled_at * 1000, null);
  } else {
    rh.timer.deferred.stop();
  }
}

function handleRaceStatus(payload: RaceStatusPayload): void {
  const rh = rotorhazard();
  const rhSocket = socket();
  const status = payload.race_status;

  if (status === 1) {
    if (rh) {
      rh.race_status_go_time = window.performance.now();
    }
    setRaceClasses(status);
    if (resumeCheck) {
      raceKickoff(payload);
    }
  } else if (status === 2) {
    setRaceClasses(status);
  } else if (status === 3) {
    setRaceClasses(status);
    if (resumeCheck) {
      raceKickoff(payload);
    }
  } else {
    setRaceClasses(status);
    if (resumeCheck) {
      rhSocket?.emit?.("get_race_scheduled");
    }
  }

  resumeCheck = false;
}

export function bindRotorHazardTimer(): void {
  const rh = rotorhazard();
  const rhSocket = socket();
  if (!rhSocket) {
    return;
  }

  document.querySelectorAll(".socket-warning").forEach((element) => {
    element.remove();
  });

  if (rh) {
    rh.show_messages = false;
    rh.server_time_differential_samples ??= [];
  }

  requestPiTime();
  rhSocket.on("pi_time", (payload) => {
    handlePiTime(payload as PiTimePayload);
  });
  rhSocket.on("race_scheduled", (payload) => {
    handleRaceScheduled(payload as RaceScheduledPayload);
  });
  rhSocket.on("race_status", (payload) => {
    handleRaceStatus(payload as RaceStatusPayload);
  });
  rhSocket.on("prestage_ready", () => undefined);
  rhSocket.on("stage_ready", (payload) => {
    raceKickoff(payload as RaceStatusPayload);
  });
  rhSocket.on("stop_timer", () => {
    rotorhazard()?.timer?.stopAll();
  });
}
