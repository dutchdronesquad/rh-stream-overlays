export type OverlayThemeConfig = {
  name: "apex" | "dds" | "lcdr";
  nodeAnimation: "slide" | "zoom" | "minimal";
  showFastestLapHighlight: boolean;
  leaderboardPageSize: number;
};

export const apexTheme: OverlayThemeConfig = {
  name: "apex",
  nodeAnimation: "zoom",
  showFastestLapHighlight: true,
  leaderboardPageSize: 8,
};
