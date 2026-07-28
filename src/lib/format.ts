export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

/** 2500 -> "2.5" */
export function secondsLabel(ms: number): string {
  return (ms / 1000).toFixed(1);
}

/** 62000 -> "1:02" */
export function clockLabel(ms: number): string {
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function modeLabel(mode: "dual" | "triple"): string {
  return mode === "triple" ? "Triple" : "Dual";
}
