import { describe, expect, it } from "vitest";

import {
  MAX_INTERVAL_MS,
  MAX_N,
  MIN_INTERVAL_MS,
  MIN_N,
  SCORED_TRIALS,
  clampInterval,
  clampN,
  generateSequence,
  isTarget,
  modalitiesFor,
  targetCountFor,
  totalTrialsFor,
} from "../src/lib/sequence";
import { GRID_SIZE, LETTERS, STIMULUS_COLORS } from "../src/lib/stimuli";
import type { GameMode, Modality } from "../src/lib/types";

/**
 * A deterministic stand-in for Math.random.
 *
 * mulberry32, so a failure is reproducible from its seed. The generator takes
 * `rnd` as a parameter for exactly this reason, and the alternative -- stubbing
 * the global -- would not let one test walk many seeds.
 */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Counts the matches that are really in a sequence, by the same rule the game scores with. */
function actualTargets(
  sequence: ReturnType<typeof generateSequence>,
  modality: Modality,
): number {
  let found = 0;
  for (let index = sequence.n; index < sequence.trials.length; index += 1) {
    if (isTarget(sequence.trials, index, sequence.n, modality)) found += 1;
  }
  return found;
}

const MODES: GameMode[] = ["dual", "triple"];

describe("the planned number of matches is the real number of matches", () => {
  /**
   * The claim this file exists to defend: matches are planned up front, not
   * rolled. Planning them is the easy half. The half that breaks is the other
   * one -- every non-target trial has to be forced to *differ* from the cue n
   * steps back, or the dice hand you an extra match for free and a stream that
   * was supposed to hold six holds eight. So this checks the sequence that came
   * out, not the intent that went in.
   */
  it.each(MODES)("holds exactly the planned count in every stream (%s)", (mode) => {
    const planned = targetCountFor();
    expect(planned).toBe(6);

    for (let n = MIN_N; n <= MAX_N; n += 1) {
      for (let seed = 1; seed <= 60; seed += 1) {
        const sequence = generateSequence(n, mode, seeded(seed * 7919 + n));
        expect(sequence.targetsPerModality).toBe(planned);

        for (const modality of modalitiesFor(mode)) {
          expect(
            actualTargets(sequence, modality),
            `${mode} n=${n} seed=${seed} ${modality}`,
          ).toBe(planned);
        }
      }
    }
  });

  it("keeps the streams independent rather than moving them together", () => {
    /* If position and audio shared one target set, a player could learn one
       stream and get the other for nothing. Over many seeds the two sets must
       disagree somewhere. */
    let sawDifference = false;
    for (let seed = 1; seed <= 40 && !sawDifference; seed += 1) {
      const sequence = generateSequence(2, "dual", seeded(seed * 104729));
      for (let index = sequence.n; index < sequence.trials.length; index += 1) {
        const position = isTarget(sequence.trials, index, sequence.n, "position");
        const audio = isTarget(sequence.trials, index, sequence.n, "audio");
        if (position !== audio) {
          sawDifference = true;
          break;
        }
      }
    }
    expect(sawDifference).toBe(true);
  });

  it("scores 20 trials behind a warm-up exactly n long", () => {
    for (let n = MIN_N; n <= MAX_N; n += 1) {
      const sequence = generateSequence(n, "dual", seeded(n + 1));
      expect(sequence.scoredTrials).toBe(SCORED_TRIALS);
      expect(sequence.trials).toHaveLength(totalTrialsFor(n));
      expect(sequence.trials).toHaveLength(SCORED_TRIALS + n);
    }
  });

  it("never asks for a match before there is something to match against", () => {
    /* The first n trials have no cue n steps back, so no stream may report a
       target inside the warm-up. */
    for (let n = MIN_N; n <= MAX_N; n += 1) {
      const sequence = generateSequence(n, "triple", seeded(n * 31));
      for (let index = 0; index < n; index += 1) {
        for (const modality of modalitiesFor("triple")) {
          expect(isTarget(sequence.trials, index, n, modality)).toBe(false);
        }
      }
    }
  });
});

describe("every cue is a cue the game can render", () => {
  it("stays inside the grid, the letter set and the palette", () => {
    for (const mode of MODES) {
      for (let seed = 1; seed <= 25; seed += 1) {
        const sequence = generateSequence(3, mode, seeded(seed * 6151));
        for (const trial of sequence.trials) {
          expect(Number.isInteger(trial.position)).toBe(true);
          expect(trial.position).toBeGreaterThanOrEqual(0);
          expect(trial.position).toBeLessThan(GRID_SIZE);
          expect(LETTERS).toContain(trial.letter);
          expect(trial.color).toBeGreaterThanOrEqual(0);
          expect(trial.color).toBeLessThan(STIMULUS_COLORS.length);
        }
      }
    }
  });

  it("leaves colour out of dual mode entirely", () => {
    /* Colour is unscored in dual mode, so a colour that changed would be an
       unscored distraction competing with two streams that do count. */
    for (let seed = 1; seed <= 25; seed += 1) {
      const sequence = generateSequence(2, "dual", seeded(seed * 12289));
      expect(sequence.trials.every((trial) => trial.color === 0)).toBe(true);
      expect(modalitiesFor("dual")).toEqual(["position", "audio"]);
    }
  });

  it("tracks three streams in triple mode", () => {
    expect(modalitiesFor("triple")).toEqual(["position", "audio", "color"]);
    const sequence = generateSequence(2, "triple", seeded(99));
    expect(actualTargets(sequence, "color")).toBe(targetCountFor());
  });
});

describe("settings cannot be pushed outside the playable range", () => {
  it("clamps n and rounds to a whole level", () => {
    expect(clampN(0)).toBe(MIN_N);
    expect(clampN(-4)).toBe(MIN_N);
    expect(clampN(MAX_N + 3)).toBe(MAX_N);
    expect(clampN(2.4)).toBe(2);
    expect(clampN(2.6)).toBe(3);
  });

  it("snaps the interval to a step and holds the bounds", () => {
    expect(clampInterval(0)).toBe(MIN_INTERVAL_MS);
    expect(clampInterval(99_000)).toBe(MAX_INTERVAL_MS);
    expect(clampInterval(2049)).toBe(2000);
    expect(clampInterval(2051)).toBe(2100);
    /* Every clamped value must itself be a legal step, or the slider can land
       somewhere it can never return to. */
    for (let raw = MIN_INTERVAL_MS - 500; raw <= MAX_INTERVAL_MS + 500; raw += 37) {
      expect(clampInterval(raw) % 100).toBe(0);
    }
  });
});
