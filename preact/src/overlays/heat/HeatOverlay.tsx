import { useEffect } from "preact/hooks";

import type { OverlayRuntimeConfig } from "../../core/overlayRuntime";
import { useRaceState } from "../../core/raceStore";
import type { RawRecord } from "../../core/rotorhazardTypes";

type HeatOverlayProps = {
  runtime: OverlayRuntimeConfig;
};

type HeatLabels = Record<string, string>;

type HeatOverlayConfig = {
  eventName?: string;
  labels?: HeatLabels;
  num_nodes?: number;
  theme?: string;
};

type HeatSlot = {
  callsign: string;
  nodeIndex: number;
  note: string;
  pilot: string;
  placeholder: boolean;
  seatLabel: string;
};

type HeatGlobals = typeof globalThis & {
  freq?: {
    updateBlocks?: () => void;
  };
  heatOverlayConfig?: HeatOverlayConfig;
};

function config(): HeatOverlayConfig {
  return (globalThis as HeatGlobals).heatOverlayConfig ?? {};
}

function asRecord(value: unknown): RawRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    ? (value as RawRecord)
    : {};
}

function asArray(value: unknown): RawRecord[] {
  if (Array.isArray(value)) {
    return value.map(asRecord).filter((item) => Object.keys(item).length > 0);
  }

  const record = asRecord(value);
  return Object.values(record)
    .map(asRecord)
    .filter((item) => Object.keys(item).length > 0);
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

function asText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function label(labels: HeatLabels, key: string, fallback: string): string {
  return labels[key] || fallback;
}

function formatSeatLabel(labels: HeatLabels, index: number): string {
  return `${label(labels, "seatLabel", "Seat")} ${index + 1}`;
}

function compareSlots(a: HeatSlot, b: HeatSlot): number {
  return a.nodeIndex - b.nodeIndex;
}

function describeSlotMethod(
  slot: RawRecord,
  labels: HeatLabels,
  heatsById: Record<string, RawRecord>,
  classesById: Record<string, RawRecord>,
  pilotsById: Record<string, RawRecord>
): string | null {
  const method = asNumber(slot.method);
  const seedId = asNumber(slot.seed_id);
  const seedRank = asText(slot.seed_rank);

  if (method === 1 && seedId !== null) {
    const sourceHeat = heatsById[String(seedId)];
    if (sourceHeat) {
      return `${asText(sourceHeat.displayname)} ${label(labels, "rankLabel", "Rank")} ${seedRank}`;
    }
  }

  if (method === 2 && seedId !== null) {
    const raceClass = classesById[String(seedId)];
    if (raceClass) {
      return `${asText(raceClass.displayname)} ${label(labels, "rankLabel", "Rank")} ${seedRank}`;
    }
  }

  const pilotId = asNumber(slot.pilot_id);
  if (method === 0 && pilotId !== null) {
    const pilot = pilotsById[String(pilotId)];
    if (pilot) {
      return asText(pilot.callsign);
    }
  }

  return null;
}

function buildHeatSlots(
  heat: RawRecord,
  labels: HeatLabels,
  heatsById: Record<string, RawRecord>,
  classesById: Record<string, RawRecord>,
  pilotsById: Record<string, RawRecord>
): HeatSlot[] {
  const slots = asArray(heat.slots).sort((a, b) => {
    return (asNumber(a.node_index) ?? 0) - (asNumber(b.node_index) ?? 0);
  });
  const isLocked = Boolean(heat.locked) || heat.status === 2 || heat.auto_frequency === false;

  return slots
    .map((slot): HeatSlot | null => {
      const nodeIndex = asNumber(slot.node_index);
      if (nodeIndex === null) {
        return null;
      }

      const pilotId = asNumber(slot.pilot_id);
      const pilot = pilotId !== null ? pilotsById[String(pilotId)] : null;
      const method = asNumber(slot.method);
      const descriptor = describeSlotMethod(
        slot,
        labels,
        heatsById,
        classesById,
        pilotsById
      );

      if ((isLocked || method === 0) && pilotId !== null && pilot) {
        return {
          callsign: asText(pilot.callsign) || label(labels, "pilotTBD", "TBD"),
          nodeIndex,
          note: "",
          pilot: asText(pilot.name),
          placeholder: false,
          seatLabel: formatSeatLabel(labels, nodeIndex)
        };
      }

      if (pilotId !== null && !pilot) {
        return {
          callsign: label(labels, "pilotTBD", "TBD"),
          nodeIndex,
          note: "",
          pilot: "",
          placeholder: true,
          seatLabel: formatSeatLabel(labels, nodeIndex)
        };
      }

      return {
        callsign: descriptor || label(labels, "emptySlot", "Awaiting Assignment"),
        nodeIndex,
        note: descriptor && method && method > 0 ? descriptor : "",
        pilot: pilot ? asText(pilot.name) : "",
        placeholder: true,
        seatLabel: formatSeatLabel(labels, nodeIndex)
      };
    })
    .filter((slot): slot is HeatSlot => slot !== null)
    .sort(compareSlots);
}

function buildNodeSnapshotSlots(
  heatNodes: unknown,
  labels: HeatLabels,
  pilotsById: Record<string, RawRecord>,
  isPractice: boolean
): HeatSlot[] {
  return Object.entries(asRecord(heatNodes))
    .map(([nodeIndexText, nodeInfo]): HeatSlot => {
      const nodeIndex = asNumber(nodeIndexText) ?? 0;
      const info = asRecord(nodeInfo);
      const pilotId = asNumber(info.pilot_id);
      const pilot = pilotId !== null ? pilotsById[String(pilotId)] : null;
      const callsign =
        asText(info.callsign) ||
        (pilot ? asText(pilot.callsign) : "") ||
        label(labels, "pilotTBD", "TBD");

      return {
        callsign,
        nodeIndex,
        note: "",
        pilot: pilot
          ? asText(pilot.name)
          : isPractice
            ? label(labels, "practiceMode", "Practice Mode")
            : "",
        placeholder: !asText(info.callsign),
        seatLabel: formatSeatLabel(labels, nodeIndex)
      };
    })
    .sort(compareSlots);
}

function useFrequencyRefresh(): void {
  useEffect(() => {
    (globalThis as HeatGlobals).freq?.updateBlocks?.();
  });
}

function HeatHeader({
  className,
  formatName,
  heatName,
  labels,
  roundInfo,
  theme
}: {
  className: string;
  formatName: string;
  heatName: string;
  labels: HeatLabels;
  roundInfo: string;
  theme: string;
}) {
  const eventName = config().eventName ?? "";

  if (theme === "apex") {
    return (
      <header class="apex-header">
        <div class="apex-header__primary">
          <p class="lead-label">{label(labels, "upNext", "Up Next")}</p>
          <h1>{heatName}</h1>
        </div>
        <div class="apex-header__meta">
          <span class="meta-chip event-name">{eventName}</span>
          <span class="meta-chip">{className}</span>
          <span class="meta-chip">{roundInfo}</span>
          <span class="meta-chip">{formatName}</span>
        </div>
      </header>
    );
  }

  const headerClass = theme === "lcdr" ? "lcdr-header" : "dds-header";
  const topClass = theme === "lcdr" ? "lcdr-header__top" : "dds-header__top";
  const mainClass = theme === "lcdr" ? "lcdr-header__main" : "dds-header__main";
  const chipClass = theme === "lcdr" ? "event-chip" : "event-badge";

  return (
    <header class={headerClass}>
      <div class={topClass}>
        <p class="lead">{label(labels, "upNext", "Up Next")}</p>
        <span class={chipClass}>{eventName}</span>
      </div>
      <div class={mainClass}>
        <h1>{heatName}</h1>
        <div class="meta-line">
          <span>{className}</span>
          <span>{roundInfo}</span>
          <span>{formatName}</span>
        </div>
      </div>
    </header>
  );
}

function HeatCards({ slots }: { slots: HeatSlot[] }) {
  return (
    <>
      {slots.map((slot) => (
        <article
          class={`slot-card${slot.placeholder ? " placeholder" : ""}`}
          key={slot.nodeIndex}
        >
          <span class="seat-chip">{slot.seatLabel}</span>
          <div class="card-body">
            <p class="callsign">{slot.callsign}</p>
            {slot.pilot ? <p class="pilot-name">{slot.pilot}</p> : null}
            {slot.note ? <p class="slot-note">{slot.note}</p> : null}
          </div>
          <div class="channel-block" data-node={slot.nodeIndex}>
            <span class="ch" />
            <span class="fr" />
          </div>
        </article>
      ))}
    </>
  );
}

export function HeatOverlay({ runtime }: HeatOverlayProps) {
  const raceState = useRaceState();
  const overlayConfig = config();
  const labels = overlayConfig.labels ?? {};
  const theme = runtime.theme || overlayConfig.theme || "dds";
  const currentHeatId = raceState.currentHeat?.currentHeatId ?? null;
  const isPractice = !currentHeatId;
  const heat =
    currentHeatId !== null ? raceState.heatData?.byId[String(currentHeatId)] : null;
  const classesById = raceState.classData?.byId ?? {};
  const formatsById = raceState.formatData?.byId ?? {};
  const heatsById = raceState.heatData?.byId ?? {};
  const pilotsById = raceState.pilotData?.byId ?? {};

  useFrequencyRefresh();

  const heatName = isPractice
    ? label(labels, "practiceMode", "Practice Mode")
    : heat
      ? asText(heat.displayname) || label(labels, "noHeat", "Waiting for heat...")
      : label(labels, "noHeat", "Waiting for heat...");
  const classId = heat ? asNumber(heat.class_id) : null;
  const className =
    !isPractice && classId !== null && classesById[String(classId)]
      ? asText(classesById[String(classId)].displayname)
      : isPractice
        ? ""
        : label(labels, "classFallback", "Unclassified");
  const roundInfo =
    !isPractice && raceState.currentHeat?.nextRound
      ? `${label(labels, "roundLabel", "Round")} ${raceState.currentHeat.nextRound}`
      : "";
  const formatId =
    raceState.currentHeat?.heatFormatId ??
    (heat ? asNumber(heat.format_id) ?? asNumber(heat.format_id_rel) : null);
  const formatName =
    !isPractice && formatId !== null && formatsById[String(formatId)]
      ? asText(formatsById[String(formatId)].name)
      : isPractice
        ? ""
        : label(labels, "formatFallback", "Format TBD");
  const notice = isPractice ? label(labels, "practiceNotice", "") : "";
  const slots = isPractice
    ? buildNodeSnapshotSlots(raceState.currentHeat?.heatNodes, labels, pilotsById, true)
    : heat
      ? buildHeatSlots(heat, labels, heatsById, classesById, pilotsById)
      : buildNodeSnapshotSlots(raceState.currentHeat?.heatNodes, labels, pilotsById, false);

  const gridClass =
    theme === "apex" ? "apex-grid" : theme === "lcdr" ? "lcdr-grid" : "dds-grid";
  const shellClass =
    theme === "apex" ? "apex-canvas" : theme === "lcdr" ? "lcdr-shell" : "dds-shell";
  const bodyClass =
    theme === "apex" ? "apex-body" : theme === "lcdr" ? "lcdr-body" : "dds-body";
  const labelClass = theme === "apex" ? "apex-body__label" : "body-label";
  const footClass = theme === "apex" ? "apex-foot" : theme === "lcdr" ? "lcdr-foot" : "dds-foot";

  return (
    <main class={`page-streamheat theme-${theme}`}>
      <div class={shellClass}>
        <HeatHeader
          className={className}
          formatName={formatName}
          heatName={heatName}
          labels={labels}
          roundInfo={roundInfo}
          theme={theme}
        />

        <section class={bodyClass}>
          <div class={labelClass}>
            <span class={theme === "apex" ? "label-dot" : "accent-bar"} />
            <span>Seat lineup</span>
          </div>
          <div class={`heat-grid ${gridClass}`}>
            {slots.length ? (
              <HeatCards slots={slots} />
            ) : (
              <div class="heat-empty">
                {isPractice
                  ? label(labels, "practiceNotice", "")
                  : label(labels, "noSeats", "Waiting for pilots")}
              </div>
            )}
          </div>
        </section>

        <footer class={footClass}>
          <span>{notice}</span>
        </footer>
      </div>
    </main>
  );
}
