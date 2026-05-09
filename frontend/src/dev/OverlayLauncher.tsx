import { Fragment, render } from "preact";
import { useMemo, useState } from "preact/hooks";
import "./overlayLauncher.css";

type ThemeName = "apex" | "dds" | "lcdr";

type OverlayLink = {
  group: string;
  label: string;
  path: string;
};

type ThemeConfig = {
  accent: string;
  description: string;
  label: string;
  leaderboard: boolean;
  name: ThemeName;
};

const THEMES: ThemeConfig[] = [
  {
    accent: "#00d9ff",
    description: "Clean racing overlay set",
    label: "APEX",
    leaderboard: false,
    name: "apex",
  },
  {
    accent: "#f97316",
    description: "Dutch Drone Squad overlays",
    label: "DDS",
    leaderboard: true,
    name: "dds",
  },
  {
    accent: "#22c55e",
    description: "Liga Colombiana Drone Racing",
    label: "LCDR",
    leaderboard: false,
    name: "lcdr",
  },
];

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return window.location.origin;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${window.location.protocol}//${trimmed}`;
}

function buildLinks(theme: ThemeName, nodes: number, classId: number, leaderboard: boolean): OverlayLink[] {
  const base = `/stream/overlay/${theme}`;
  const links: OverlayLink[] = [
    { group: "Race", label: "Topbar", path: `${base}/topbar` },
    { group: "Race", label: "Upcoming heat", path: `${base}/heat/upcoming` },
  ];

  for (let node = 1; node <= nodes; node += 1) {
    links.push({ group: "Nodes", label: `Node ${node}`, path: `${base}/node/${node}` });
  }

  if (leaderboard) {
    links.push({
      group: "Leaderboards",
      label: "Current overall",
      path: `${base}/leaderboard/0/overall`,
    });
    links.push({
      group: "Leaderboards",
      label: "Current class",
      path: `${base}/leaderboard/0/class`,
    });
    links.push({
      group: "Leaderboards",
      label: `Class ${classId}`,
      path: `${base}/leaderboard/${classId}/class`,
    });
  }

  links.push({ group: "TrackDraw", label: "Map", path: `${base}/trackdraw/map` });
  links.push({
    group: "TrackDraw",
    label: "Overview",
    path: `${base}/trackdraw/overview`,
  });

  return links;
}

function absoluteUrl(baseUrl: string, path: string): string {
  try {
    return new URL(path, `${baseUrl}/`).href;
  } catch {
    return new URL(path, `${window.location.origin}/`).href;
  }
}

function groupCounts(links: OverlayLink[]): string {
  const counts = links.reduce<Record<string, number>>((acc, link) => {
    acc[link.group] = (acc[link.group] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .map(([group, count]) => `${group} ${count}`)
    .join(" / ");
}

function OverlayLauncher() {
  const [baseUrl, setBaseUrl] = useState("http://localhost:5000");
  const [nodes, setNodes] = useState(8);
  const [classId, setClassId] = useState(1);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const normalizedBase = normalizeBaseUrl(baseUrl);

  const themes = useMemo(
    () =>
      THEMES.map((theme) => ({
        ...theme,
        links: buildLinks(theme.name, nodes, classId, theme.leaderboard),
      })),
    [nodes, classId]
  );

  const copyUrl = async (path: string) => {
    try {
      await navigator.clipboard.writeText(absoluteUrl(normalizedBase, path));
    } catch (error) {
      console.warn("Failed to copy overlay URL.", error);
      return;
    }
    setCopiedPath(path);
    window.setTimeout(() => {
      setCopiedPath((current) => (current === path ? null : current));
    }, 1200);
  };

  return (
    <main class="launcher">
      <header class="launcher__header">
        <div>
          <p class="launcher__eyebrow">Vite dev</p>
          <h1>Stream overlay launcher</h1>
          <p class="launcher__subtitle">
            Open live RotorHazard overlay URLs while iterating on the Preact
            frontend.
          </p>
        </div>
        <div class="launcher__header-actions">
          <a href="/src/overlays/topbar/topbar.entry.tsx" target="_blank" rel="noreferrer">
            Topbar entry
          </a>
          <a href="/src/overlays/heat/heat.entry.tsx" target="_blank" rel="noreferrer">
            Heat entry
          </a>
        </div>
      </header>

      <section class="launcher__controls" aria-label="Launcher settings">
        <label>
          RotorHazard URL
          <input
            value={baseUrl}
            onInput={(event) => setBaseUrl(event.currentTarget.value)}
            placeholder="http://localhost:5000"
          />
        </label>
        <label>
          Nodes
          <input
            min={1}
            max={16}
            type="number"
            value={nodes}
            onInput={(event) => setNodes(Number(event.currentTarget.value) || 1)}
          />
        </label>
        <label>
          Class ID
          <input
            min={1}
            type="number"
            value={classId}
            onInput={(event) => setClassId(Number(event.currentTarget.value) || 1)}
          />
        </label>
      </section>

      <div class="launcher__target">
        <span>Target</span>
        <code>{normalizedBase}</code>
      </div>

      <section class="launcher__themes" aria-label="Overlay links">
        {themes.map((theme) => {
          let currentGroup = "";
          return (
            <article
              class="launcher__theme"
              data-theme={theme.name}
              key={theme.name}
              style={{ "--theme-accent": theme.accent }}
            >
              <header>
                <div>
                  <h2>{theme.label}</h2>
                  <p>{theme.description}</p>
                </div>
                <span>{theme.links.length} links</span>
              </header>
              <div class="launcher__theme-meta">{groupCounts(theme.links)}</div>
              <div class="launcher__links">
                {theme.links.map((link) => {
                  const showGroup = link.group !== currentGroup;
                  currentGroup = link.group;
                  const href = absoluteUrl(normalizedBase, link.path);
                  const copyLabel = copiedPath === link.path ? "Copied" : "Copy";
                  return (
                    <Fragment key={`${theme.name}-${link.path}`}>
                      {showGroup && <h3>{link.group}</h3>}
                      <div class="launcher__row">
                        <div>
                          <strong>{link.label}</strong>
                          <code>{link.path}</code>
                        </div>
                        <div class="launcher__actions">
                          <button type="button" onClick={() => void copyUrl(link.path)}>
                            {copyLabel}
                          </button>
                          <a href={href} target="_blank" rel="noreferrer">
                            Open
                          </a>
                        </div>
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

render(<OverlayLauncher />, document.getElementById("app") as HTMLElement);
