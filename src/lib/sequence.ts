import { GRID_SIZE, LETTERS, STIMULUS_COLORS } from "./stimuli";
import type { GameMode, Modality, Sequence, Trial } from "./types";

/** Trials that count towards the score. The warm-up (n trials) sits in front of these. */
export const SCORED_TRIALS = 20;

/** Share of scored trials that are a match in each tracked stream. */
export const TARGET_RATE = 0.3;

export const MIN_N = 1;
export const MAX_N = 6;

export const MIN_INTERVAL_MS = 1500;
export const MAX_INTERVAL_MS = 4000;
export const INTERVAL_STEP_MS = 100;

const FIELD: Record<Modality, keyof Trial> = {
  position: "position",
  audio: "letter",
  color: "color",
};

export function modalitiesFor(mode: GameMode): Modality[] {
  return mode === "triple" ? ["position", "audio", "color"] : ["position", "audio"];
}

export function totalTrialsFor(n: number): number {
  return SCORED_TRIALS + n;
}

export function targetCountFor(): number {
  return Math.round(SCORED_TRIALS * TARGET_RATE);
}

/** True when the cue at `index` repeats the cue from n steps earlier. */
export function isTarget(trials: Trial[], index: number, n: number, modality: Modality): boolean {
  if (index < n || index >= trials.length) return false;
  const field = FIELD[modality];
  return trials[index][field] === trials[index - n][field];
}

function shuffled<T>(items: readonly T[], rnd: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickTargets(scoredIndices: number[], count: number, rnd: () => number): Set<number> {
  return new Set(shuffled(scoredIndices, rnd).slice(0, count));
}

/** Uniform pick from [0, size) that is guaranteed to differ from `exclude`. */
function pickOther(size: number, exclude: number, rnd: () => number): number {
  if (size <= 1) return 0;
  const value = Math.floor(rnd() * (size - 1));
  return value >= exclude ? value + 1 : value;
}

/**
 * Builds a sequence with an exact, predictable number of matches per stream.
 * Non-target trials are forced to differ from the cue n steps back, so the
 * planned target count is also the real target count.
 */
export function generateSequence(n: number, mode: GameMode, rnd: () => number = Math.random): Sequence {
  const total = totalTrialsFor(n);
  const scoredIndices = Array.from({ length: SCORED_TRIALS }, (_, k) => k + n);
  const targetCount = targetCountFor();
  const withColor = mode === "triple";

  const targets: Record<Modality, Set<number>> = {
    position: pickTargets(scoredIndices, targetCount, rnd),
    audio: pickTargets(scoredIndices, targetCount, rnd),
    color: withColor ? pickTargets(scoredIndices, targetCount, rnd) : new Set<number>(),
  };

  const trials: Trial[] = [];

  for (let i = 0; i < total; i++) {
    const back = i >= n ? trials[i - n] : null;

    let position: number;
    let letterIndex: number;
    let color: number;

    if (!back) {
      position = Math.floor(rnd() * GRID_SIZE);
      letterIndex = Math.floor(rnd() * LETTERS.length);
      color = withColor ? Math.floor(rnd() * STIMULUS_COLORS.length) : 0;
    } else {
      const backLetterIndex = LETTERS.indexOf(back.letter);
      position = targets.position.has(i) ? back.position : pickOther(GRID_SIZE, back.position, rnd);
      letterIndex = targets.audio.has(i)
        ? backLetterIndex
        : pickOther(LETTERS.length, backLetterIndex, rnd);
      color = !withColor
        ? 0
        : targets.color.has(i)
          ? back.color
          : pickOther(STIMULUS_COLORS.length, back.color, rnd);
    }

    trials.push({ position, letter: LETTERS[letterIndex], color });
  }

  return {
    n,
    mode,
    trials,
    scoredTrials: SCORED_TRIALS,
    targetsPerModality: targetCount,
  };
}

export function clampN(value: number): number {
  return Math.min(MAX_N, Math.max(MIN_N, Math.round(value)));
}

export function clampInterval(value: number): number {
  const stepped = Math.round(value / INTERVAL_STEP_MS) * INTERVAL_STEP_MS;
  return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, stepped));
}
