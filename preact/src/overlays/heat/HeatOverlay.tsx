import { useEffect } from "preact/hooks";
import { ConnectionWarning } from "../../components/ConnectionWarning";
import type { OverlayRuntimeConfig } from "../../core/overlayRuntime";
import { asNumber, asRecord, asString, objectValues } from "../../core/primitives";
import { useRaceState } from "../../core/raceStore";
import type { NormalizedFrequencyData, RawRecord } from "../../core/rotorhazardTypes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FrequencyInfo = {
  band: string | null;
  channel: number | null;
  frequency: number | null;
};

type HeatSlot = {
  nodeIndex: number;
  seatLabel: string;
  callsign: string;
  pilotName: string;
  frequency: FrequencyInfo | null;
  isEmpty: boolean;
};

// ---------------------------------------------------------------------------
// FrequencyBadge
// ---------------------------------------------------------------------------

function FrequencyBadge({
  nodeIndex,
  frequencyData,
}: {
  nodeIndex: number;
  frequencyData: NormalizedFrequencyData | null;
}) {
  const raw = asRecord(frequencyData?.frequenciesByNode[String(nodeIndex)]);
  const band = asString(raw.band);
  const channel = asNumber(raw.channel);
  const frequency = asNumber(raw.frequency);

  return (
    <div class="channel-block" data-node={nodeIndex}>
      <span class="ch">{band && channel !== null ? `${band}${channel}` : ""}</span>
      <span class="fr">{frequency !== null ? frequency : ""}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SlotCard
// ---------------------------------------------------------------------------

function SlotCard({
  slot,
  frequencyData,
}: {
  slot: HeatSlot;
  frequencyData: NormalizedFrequencyData | null;
}) {
  return (
    <article class={`slot-card${slot.isEmpty ? " placeholder" : ""}`}>
      <span class="seat-chip">{slot.seatLabel}</span>
      <div class="card-body">
        <p class="callsign">{slot.callsign}</p>
        {slot.pilotName ? <p class="pilot-name">{slot.pilotName}</p> : null}
      </div>
      <FrequencyBadge nodeIndex={slot.nodeIndex} frequencyData={frequencyData} />
    </article>
  );
}

// ---------------------------------------------------------------------------
// Slot building
// ---------------------------------------------------------------------------

function buildSlots(
  heatRaw: RawRecord | null,
  pilotById: Record<string, RawRecord>,
  numNodes: number
): HeatSlot[] {
  if (heatRaw) {
    const rawSlots = objectValues(heatRaw.slots);
    if (rawSlots.length > 0) {
      return rawSlots.map((s) => {
        const slot = asRecord(s);
        const nodeIndex = asNumber(slot.node_index) ?? 0;
        const pilotId = asNumber(slot.pilot_id);
        const pilot = pilotId ? asRecord(pilotById[String(pilotId)]) : null;
        const hasPilot = pilot && Object.keys(pilot).length > 0;
        return {
          nodeIndex,
          seatLabel: `Seat ${nodeIndex + 1}`,
          callsign: hasPilot ? (asString(pilot.callsign) ?? "Awaiting Assignment") : "Awaiting Assignment",
          pilotName: hasPilot ? (asString(pilot.name) ?? "") : "",
          frequency: null,
          isEmpty: !hasPilot,
        };
      });
    }
  }

  // Practice mode / no slots — build numNodes empty slots
  return Array.from({ length: numNodes }, (_, i) => ({
    nodeIndex: i,
    seatLabel: `Seat ${i + 1}`,
    callsign: "",
    pilotName: "",
    frequency: null,
    isEmpty: true,
  }));
}

// ---------------------------------------------------------------------------
// HeatOverlay
// ---------------------------------------------------------------------------

export function HeatOverlay({ runtime }: { runtime: OverlayRuntimeConfig }) {
  const state = useRaceState();
  const {
    connection,
    currentHeat,
    heatData,
    pilotData,
    classData,
    formatData,
    frequencyData,
  } = state;

  const numNodes = runtime.numNodes ?? 8;
  const theme = runtime.theme;

  // Theme class on <html>
  useEffect(() => {
    const cls = `${theme}-theme-page`;
    document.documentElement.classList.add(cls);
    return () => document.documentElement.classList.remove(cls);
  }, [theme]);

  const currentHeatId = currentHeat?.currentHeatId ?? null;
  const isPractice = !currentHeatId;

  const heatRaw = currentHeatId
    ? asRecord(heatData?.byId[String(currentHeatId)])
    : null;
  const heatHasData = heatRaw && Object.keys(heatRaw).length > 0;

  const heatClassId = currentHeat?.heatClassId ?? asNumber(heatRaw?.class_id);
  const heatFormatId = currentHeat?.heatFormatId ?? asNumber(heatRaw?.format_id);

  const heatName = heatHasData
    ? (asString(heatRaw.displayname) ?? "Waiting for heat...")
    : "Waiting for heat...";

  const className = heatClassId
    ? asString(asRecord(classData?.byId[String(heatClassId)]).displayname) ?? ""
    : "";

  const roundInfo = currentHeat?.nextRound
    ? `Round ${currentHeat.nextRound}`
    : "";

  const formatName = heatFormatId
    ? asString(asRecord(formatData?.byId[String(heatFormatId)]).name) ?? ""
    : "";

  const pilotById = pilotData?.byId ?? {};
  const slots = buildSlots(heatHasData ? heatRaw : null, pilotById, numNodes);

  const notice = isPractice ? "Practice Mode" : "";

  return (
    <>
      <ConnectionWarning connection={connection} />
      <main class={`page-streamheat theme-${theme}`}>
        <div class="heat-wrapper">
          <div class="heat-header">
            <p class="label" id="heat_lead">Up Next</p>
            <h1 id="heat_name">{heatName}</h1>
            <div class="heat-meta">
              <span id="class_name">{className}</span>
              <span id="round_info">{roundInfo}</span>
              <span id="format_name">{formatName}</span>
            </div>
          </div>
          <div id="heat_slots" class="heat-grid">
            {slots.map((slot) => (
              <SlotCard
                key={slot.nodeIndex}
                slot={slot}
                frequencyData={frequencyData}
              />
            ))}
          </div>
          <div class="heat-footnote" id="heat_notice">{notice}</div>
        </div>
      </main>
    </>
  );
}
