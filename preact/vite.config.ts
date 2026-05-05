import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

function fromConfig(relativePath: string): string {
  return new URL(relativePath, import.meta.url).pathname;
}

export default defineConfig({
  plugins: [preact()],
  build: {
    outDir: fromConfig("../custom_plugins/stream_overlays/static/dist"),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        heat: fromConfig("src/overlays/heat/heat.entry.tsx"),
        "leaderboard-class": fromConfig("src/overlays/leaderboard/class.entry.tsx"),
        "leaderboard-overall": fromConfig("src/overlays/leaderboard/overall.entry.tsx"),
        node: fromConfig("src/overlays/node/node.entry.tsx"),
        "trackdraw-map": fromConfig("src/overlays/trackdraw/map.entry.tsx"),
        "trackdraw-overview": fromConfig("src/overlays/trackdraw/overview.entry.tsx"),
        topbar: fromConfig("src/overlays/topbar/topbar.entry.tsx"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  server: {
    strictPort: false,
  },
});
