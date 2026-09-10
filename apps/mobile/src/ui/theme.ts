export const colors = {
  bg: "#0e0f12",
  surface: "#17191e",
  border: "#2a2d35",
  text: "#ecebe6",
  muted: "#9a9a94",
  accent: "#e8c36a",
  accentText: "#1a1200",
  danger: "#e07a6a",
  success: "#7ac48a",
} as const;

export const space = (n: number): number => n * 4;
