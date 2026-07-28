export const GRID_SIZE = 9;

/**
 * Letters chosen to stay distinguishable when spoken by a synthetic voice
 * (no rhyming clusters like B/C/D/E or F/S/X).
 */
export const LETTERS: readonly string[] = ["C", "H", "K", "L", "Q", "R", "S", "T"];

export interface StimulusColor {
  name: string;
  fill: string;
  edge: string;
  glow: string;
}

/**
 * Four hues that stay separable for the most common colour-vision deficiencies
 * by differing in both hue and lightness. Names are shown when tile hints are on.
 */
export const STIMULUS_COLORS: readonly StimulusColor[] = [
  { name: "Teal", fill: "#3fae9f", edge: "#8adacf", glow: "rgba(63, 174, 159, 0.45)" },
  { name: "Amber", fill: "#e0a75d", edge: "#f4cd99", glow: "rgba(224, 167, 93, 0.45)" },
  { name: "Indigo", fill: "#7d8fe0", edge: "#b3bdf3", glow: "rgba(125, 143, 224, 0.45)" },
  { name: "Pink", fill: "#dc80ae", edge: "#f3b0d0", glow: "rgba(220, 128, 174, 0.45)" },
];

/** Dual mode uses one calm colour so colour never becomes an unscored distraction. */
export const NEUTRAL_COLOR: StimulusColor = {
  name: "Sage",
  fill: "#8fb5a3",
  edge: "#c6ded1",
  glow: "rgba(143, 181, 163, 0.4)",
};

/** Spoken-language names for the nine cells, used by assistive technology. */
export const POSITION_NAMES: readonly string[] = [
  "top left",
  "top center",
  "top right",
  "middle left",
  "center",
  "middle right",
  "bottom left",
  "bottom center",
  "bottom right",
];

export const MODALITY_LABEL: Record<"position" | "audio" | "color", string> = {
  position: "Position",
  audio: "Sound",
  color: "Color",
};

