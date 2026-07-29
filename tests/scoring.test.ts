import { describe, expect, it } from "vitest";

import {
  emptyResponseLog,
  scoreSession,
  suggestNext,
  toPercent,
  type ResponseLog,
} from "../src/lib/scoring";
import {
  MAX_N,
  MIN_N,
  generateSequence,
  isTarget,
  modalitiesFor,
  targetCountFor,
} from "../src/lib/sequence";
import type { GameMode, Sequence } from "../src/lib/types";

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

/** Presses every trial in every tracked stream. */
function pressEverything(sequence: Sequence): ResponseLog {
  const log = emptyResponseLog(sequence.trials.length);
  for (const modality of modalitiesFor(sequence.mode)) {
    log[modality] = log[modality].map((_, index) => index >= sequence.n);
  }
  return log;
}

/** Presses on exactly the real matches, and nowhere else. */
function pressPerfectly(sequence: Sequence): ResponseLog {
  const log = emptyResponseLog(sequence.trials.length);
  for (const modality of modalitiesFor(sequence.mode)) {
    log[modality] = log[modality].map((_, index) =>
      isTarget(sequence.trials, index, sequence.n, modality),
    );
  }
  return log;
}

const MODES: GameMode[] = ["dual", "triple"];

describe("pressing everything does worse than pressing nothing", () => {
  /**
   * The page claims this, and it is the whole reason the score is balanced
   * accuracy rather than hit rate. Under a hit rate, hammering the keys scores
   * 100%. Under this one it scores worse than sitting still, because staying
   * quiet on a non-match is itself a correct decision and there are fourteen of
   * those for every six matches.
   */
  it.each(MODES)("ranks silence above hammering, and perfect play above both (%s)", (mode) => {
    for (let n = MIN_N; n <= MAX_N; n += 1) {
      const sequence = generateSequence(n, mode, seeded(n * 2654435761));

      const silent = scoreSession(sequence, emptyResponseLog(sequence.trials.length));
      const frantic = scoreSession(sequence, pressEverything(sequence));
      const perfect = scoreSession(sequence, pressPerfectly(sequence));

      expect(frantic.accuracy).toBeLessThan(silent.accuracy);
      expect(perfect.accuracy).toBeGreaterThan(silent.accuracy);
      expect(perfect.accuracy).toBe(1);
    }
  });

  it("puts exact numbers on both strategies", () => {
    /* 20 scored trials, 6 of them matches. Silence gets the 14 correct
       rejections; hammering gets the 6 hits. Those are the two figures, and
       writing them down means a change to the target rate cannot pass quietly. */
    const sequence = generateSequence(2, "dual", seeded(4242));
    const scored = sequence.scoredTrials;
    const targets = targetCountFor();

    const silent = scoreSession(sequence, emptyResponseLog(sequence.trials.length));
    expect(toPercent(silent.accuracy)).toBe(toPercent((scored - targets) / scored));
    expect(toPercent(silent.accuracy)).toBe(70);

    const frantic = scoreSession(sequence, pressEverything(sequence));
    expect(toPercent(frantic.accuracy)).toBe(toPercent(targets / scored));
    expect(toPercent(frantic.accuracy)).toBe(30);
  });
});

describe("the per-stream breakdown adds up", () => {
  it("accounts for every scored trial exactly once", () => {
    for (const mode of MODES) {
      for (let seed = 1; seed <= 20; seed += 1) {
        const sequence = generateSequence(3, mode, seeded(seed * 40503));
        /* A deliberately messy log: some hits, some false alarms, some misses. */
        const log = emptyResponseLog(sequence.trials.length);
        for (const modality of modalitiesFor(mode)) {
          log[modality] = log[modality].map((_, index) => index % 3 === 0 && index >= sequence.n);
        }

        const result = scoreSession(sequence, log);
        expect(result.modalities).toHaveLength(modalitiesFor(mode).length);

        for (const stream of result.modalities) {
          expect(stream.hits + stream.misses).toBe(stream.targets);
          expect(
            stream.hits + stream.misses + stream.falseAlarms + stream.correctRejections,
          ).toBe(sequence.scoredTrials);
          expect(stream.scored).toBe(sequence.scoredTrials);
          expect(stream.accuracy).toBeGreaterThanOrEqual(0);
          expect(stream.accuracy).toBeLessThanOrEqual(1);
        }

        /* The session figure is the mean of the streams, not a separate tally. */
        const mean =
          result.modalities.reduce((sum, stream) => sum + stream.accuracy, 0) /
          result.modalities.length;
        expect(result.accuracy).toBeCloseTo(mean, 12);
      }
    }
  });

  it("ignores presses made during the warm-up", () => {
    /* Nothing before trial n is scoreable, so a jumpy start must not become a
       false alarm. */
    const sequence = generateSequence(4, "dual", seeded(7));
    const log = emptyResponseLog(sequence.trials.length);
    for (const modality of modalitiesFor("dual")) {
      for (let index = 0; index < sequence.n; index += 1) log[modality][index] = true;
    }

    const result = scoreSession(sequence, log);
    for (const stream of result.modalities) {
      expect(stream.falseAlarms).toBe(0);
      expect(stream.hits).toBe(0);
    }
    expect(toPercent(result.accuracy)).toBe(70);
  });
});

describe("the suggestion after a round", () => {
  it("moves up only from a comfortable round, and never past the ceiling", () => {
    expect(suggestNext(90, 2, MIN_N, MAX_N).nextN).toBe(3);
    expect(suggestNext(85, 2, MIN_N, MAX_N).nextN).toBe(3);
    expect(suggestNext(84, 2, MIN_N, MAX_N).nextN).toBeNull();
    expect(suggestNext(99, MAX_N, MIN_N, MAX_N).nextN).toBeNull();
  });

  it("moves down only from a poor round, and never below the floor", () => {
    expect(suggestNext(40, 3, MIN_N, MAX_N).nextN).toBe(2);
    expect(suggestNext(54, 3, MIN_N, MAX_N).nextN).toBe(2);
    expect(suggestNext(55, 3, MIN_N, MAX_N).nextN).toBeNull();
    expect(suggestNext(10, MIN_N, MIN_N, MAX_N).nextN).toBeNull();
  });

  it("always says something, and never promises anything about intelligence", () => {
    for (let percent = 0; percent <= 100; percent += 1) {
      for (let n = MIN_N; n <= MAX_N; n += 1) {
        const suggestion = suggestNext(percent, n, MIN_N, MAX_N);
        expect(suggestion.text.length).toBeGreaterThan(0);
        expect(suggestion.text).not.toMatch(/\biq\b|smarter|intelligence/i);
      }
    }
  });
});
