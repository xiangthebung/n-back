export type GameMode = "dual" | "triple";

/** The three independent streams a trial can carry. */
export type Modality = "position" | "audio" | "color";

export interface Trial {
  /** 0-8, reading order in the 3x3 grid. */
  position: number;
  /** Spoken (and optionally displayed) letter. */
  letter: string;
  /** Index into STIMULUS_COLORS. Always 0 in dual mode. */
  color: number;
}

export interface Sequence {
  n: number;
  mode: GameMode;
  trials: Trial[];
  /** Trials that count towards the score (everything after the warm-up). */
  scoredTrials: number;
  /** Planned number of matches per tracked stream. */
  targetsPerModality: number;
}

export interface SessionSettings {
  mode: GameMode;
  n: number;
  /** Milliseconds per trial, including the short gap before the next cue. */
  intervalMs: number;
}

export interface ModalityScore {
  modality: Modality;
  /** Trials where this stream repeated n steps back. */
  targets: number;
  hits: number;
  misses: number;
  /** Responses on trials that were not a match. */
  falseAlarms: number;
  correctRejections: number;
  scored: number;
  /** (hits + correct rejections) / scored trials — 0..1 */
  accuracy: number;
}

export interface SessionResult {
  settings: SessionSettings;
  totalTrials: number;
  scoredTrials: number;
  /** Balanced accuracy across every tracked stream — 0..1 */
  accuracy: number;
  modalities: ModalityScore[];
  completedAt: number;
}
