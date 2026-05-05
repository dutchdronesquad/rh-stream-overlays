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

type ThemeLayout = {
  body: string;
  bodyLabel: string;
  container: string;
  eventBadge: string;
  foot: string;
  grid: string;
  header: string;
  headerMain: string;
  headerTop: string;
  lead: string;
  meta: string;
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
  const fdata = frequencyData?.frequenciesByNode ?? {};
  const raw = {
    ...asRecord(fdata[String(nodeIndex)]),
    ...asRecord(fdata[String(nodeIndex + 1)]),
  };
  const band = firstString(raw.band, raw.b, indexedValue(fdata.b, nodeIndex));
  const channel = firstNumber(raw.channel, raw.c, indexedValue(fdata.c, nodeIndex));
  const frequency = firstNumber(
    raw.frequency,
    raw.freq,
    raw.f,
    indexedValue(fdata.f, nodeIndex)
  );

  return (
    <div class="channel-block" data-node={nodeIndex}>
      <span class="ch">{band && channel !== null ? `${band}${channel}` : ""}</span>
      <span class="fr">{frequency !== null ? frequency : ""}</span>
    </div>
  );
}

function indexedValue(value: unknown, index: number): unknown {
  if (Array.isArray(value)) return value[index];
  return asRecord(value)[String(index)];
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const parsed = asString(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = asNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
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
  pilotById: Record<string, RawRecord>
): HeatSlot[] {
  if (heatRaw) {
    const rawSlots = objectValues(heatRaw.slots);
    if (rawSlots.length > 0) {
      return rawSlots.map((s) => {
        const slot = asRecord(s);
        const nodeIndex = asNumber(slot.node_index) ?? 0;
        const pilotId = asNumber(slot.pilot_id);
        const pilot = pilotId ? asRecord(pilotById[String(pilotId)]) : null;
        const hasPilot = Boolean(pilot && Object.keys(pilot).length > 0);
        const pilotRecord = hasPilot ? asRecord(pilot) : {};
        return {
          nodeIndex,
          seatLabel: `Seat ${nodeIndex + 1}`,
          callsign: asString(pilotRecord.callsign) ?? "Pilot",
          pilotName: asString(pilotRecord.name) ?? "",
          frequency: null,
          isEmpty: !hasPilot,
        };
      });
    }
  }

  return [];
}

function getThemeLayout(theme: string): ThemeLayout {
  if (theme === "apex") {
    return {
      body: "apex-body",
      bodyLabel: "apex-body__label",
      container: "apex-canvas",
      eventBadge: "meta-chip",
      foot: "apex-foot",
      grid: "heat-grid apex-grid",
      header: "apex-header",
      headerMain: "apex-header__primary",
      headerTop: "apex-header__primary",
      lead: "lead-label",
      meta: "apex-header__meta",
    };
  }
  if (theme === "lcdr") {
    return {
      body: "lcdr-body",
      bodyLabel: "body-label",
      container: "lcdr-shell",
      eventBadge: "event-chip",
      foot: "lcdr-foot",
      grid: "heat-grid lcdr-grid",
      header: "lcdr-header",
      headerMain: "lcdr-header__main",
      headerTop: "lcdr-header__top",
      lead: "lead",
      meta: "meta-line",
    };
  }
  return {
    body: "dds-body",
    bodyLabel: "body-label",
    container: "dds-shell",
    eventBadge: "event-badge",
    foot: "dds-foot",
    grid: "heat-grid dds-grid",
    header: "dds-header",
    headerMain: "dds-header__main",
    headerTop: "dds-header__top",
    lead: "lead",
    meta: "meta-line",
  };
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

  const theme = runtime.theme;
  const layout = getThemeLayout(theme);

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
  const slots = buildSlots(heatHasData ? heatRaw : null, pilotById);

  const notice = isPractice ? "Practice Mode" : "";

  return (
    <>
      <ConnectionWarning connection={connection} />
      <main class={`page-streamheat theme-${theme}`}>
        <div class={`heat-wrapper ${layout.container}`}>
          <div class={`heat-header ${layout.header}`}>
            <div class={layout.headerTop}>
              <p class={`label ${layout.lead}`} id="heat_lead">Up Next</p>
              {runtime.eventName ? <span class={layout.eventBadge}>{runtime.eventName}</span> : null}
            </div>
            <div class={layout.headerMain}>
              <h1 id="heat_name">{heatName}</h1>
              <div class={`heat-meta ${layout.meta}`}>
                <span id="class_name">{className}</span>
                <span id="round_info">{roundInfo}</span>
                <span id="format_name">{formatName}</span>
              </div>
            </div>
          </div>
          <div class={layout.body}>
            <div class={layout.bodyLabel}>
              <span class="accent-bar"></span>
              <span class="label-dot"></span>
              Pilots
            </div>
            <div id="heat_slots" class={layout.grid}>
              {slots.length > 0 ? (
                slots.map((slot) => (
                  <SlotCard
                    key={slot.nodeIndex}
                    slot={slot}
                    frequencyData={frequencyData}
                  />
                ))
              ) : (
                <div class="heat-empty">No assigned pilots</div>
              )}
            </div>
          </div>
          <div class={layout.foot}>
            <div class="heat-footnote" id="heat_notice">{notice}</div>
          </div>
        </div>
      </main>
    </>
  );
}
