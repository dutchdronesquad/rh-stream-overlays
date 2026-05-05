export type OverlayThemeName = "apex" | "dds" | "lcdr" | string;

export type OverlayRuntimeConfig = {
  classId: number | null;
  eventName: string | null;
  root: HTMLElement;
  theme: OverlayThemeName;
  node: number | null;
  page: string | null;
};

const DEFAULT_ROOT_ID = "overlay-root";

function parseOptionalNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function readOverlayRuntime(
  rootId: string = DEFAULT_ROOT_ID
): OverlayRuntimeConfig {
  const root = document.getElementById(rootId);
  if (!root) throw new Error(`Overlay root element #${rootId} was not found.`);
  return {
    classId: parseOptionalNumber(root.dataset.classId),
    eventName: root.dataset.eventName ?? null,
    root,
    theme: root.dataset.theme ?? "dds",
    node: parseOptionalNumber(root.dataset.node),
    page: root.dataset.page ?? null,
  };
}
