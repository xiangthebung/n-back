import type { GameMode, Modality } from "./types";

export type AnswerKey = "A" | "D" | "L";
export type ArrowKey = "ArrowLeft" | "ArrowDown" | "ArrowRight";

export interface ControlSlot {
  modality: Modality;
  key: AnswerKey;
  /** Alternate key for the same slot, matching its position on screen. */
  arrow: ArrowKey;
}

/**
 * Fixed mapping: sound is answered with the left hand (A), position with the
 * right (L), colour in the middle (D). Buttons render in this same order, so
 * the screen always mirrors the keyboard.
 */
export function controlLayout(mode: GameMode): ControlSlot[] {
  const slots: ControlSlot[] = [{ modality: "audio", key: "A", arrow: "ArrowLeft" }];
  if (mode === "triple") {
    slots.push({ modality: "color", key: "D", arrow: "ArrowDown" });
  }
  slots.push({ modality: "position", key: "L", arrow: "ArrowRight" });
  return slots;
}

/** Resolves a pressed key to the slot it answers, or null. */
export function slotForKey(slots: ControlSlot[], key: string): ControlSlot | null {
  const pressed = key.toLowerCase();
  return (
    slots.find((slot) => slot.key.toLowerCase() === pressed || slot.arrow.toLowerCase() === pressed) ??
    null
  );
}
