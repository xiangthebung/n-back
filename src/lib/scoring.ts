import { isTarget, modalitiesFor } from "./sequence";
import type { Modality, ModalityScore, Sequence } from "./types";

export type ResponseLog = Record<Modality, boolean[]>;

export function emptyResponseLog(length: number): ResponseLog {
  return {
    position: new Array<boolean>(length).fill(false),
    audio: new Array<boolean>(length).fill(false),
    color: new Array<boolean>(length).fill(false),
  };
}

export interface SessionScore {
  scored: number;
  /** Balanced accuracy: correct responses *and* correct silences, averaged across streams. */
  accuracy: number;
  modalities: ModalityScore[];
}

/**
 * Scores a finished session from the raw response log.
 *
 * Accuracy counts both kinds of correct decisions (pressing on a match and
 * staying quiet on a non-match), so pressing every trial cannot inflate it.
 */
export function scoreSession(sequence: Sequence, responses: ResponseLog): SessionScore {
  const streams = modalitiesFor(sequence.mode);
  const scored = Math.max(0, sequence.trials.length - sequence.n);

  const modalities: ModalityScore[] = streams.map((modality) => {
    let targets = 0;
    let hits = 0;
    let falseAlarms = 0;

    for (let i = sequence.n; i < sequence.trials.length; i++) {
      const pressed = responses[modality][i] === true;
      if (isTarget(sequence.trials, i, sequence.n, modality)) {
        targets += 1;
        if (pressed) hits += 1;
      } else if (pressed) {
        falseAlarms += 1;
      }
    }

    const misses = targets - hits;
    const correctRejections = scored - targets - falseAlarms;

    return {
      modality,
      targets,
      hits,
      misses,
      falseAlarms,
      correctRejections,
      scored,
      accuracy: scored === 0 ? 1 : (hits + correctRejections) / scored,
    };
  });

  const correct = modalities.reduce((sum, m) => sum + m.hits + m.correctRejections, 0);
  const denominator = scored * modalities.length;

  return {
    scored,
    accuracy: denominator === 0 ? 1 : correct / denominator,
    modalities,
  };
}

export function toPercent(ratio: number): number {
  return Math.round(ratio * 100);
}

/** Short, factual read-out of how the session went. No grand claims. */
export function accuracyNote(percent: number): string {
  if (percent >= 92) return "Almost every cue caught, with very few false presses.";
  if (percent >= 80) return "Steady tracking. A few slips, nothing more.";
  if (percent >= 65) return "Holding the sequence, losing it now and then.";
  if (percent >= 50) return "The stream is slipping. A slower pace helps.";
  return "A lot got away. Try one level lower, or a slower pace.";
}

export interface Suggestion {
  text: string;
  nextN: number | null;
}

export function suggestNext(percent: number, n: number, minN: number, maxN: number): Suggestion {
  if (percent >= 85 && n < maxN) {
    return { text: `Comfortable at ${n}-back. Ready for ${n + 1}?`, nextN: n + 1 };
  }
  if (percent < 55 && n > minN) {
    return { text: `${n}-back is a stretch right now. ${n - 1}-back will feel better.`, nextN: n - 1 };
  }
  return { text: `Another round at ${n}-back will settle it in.`, nextN: null };
}
