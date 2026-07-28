import { useCallback, useEffect, useRef, useState } from "react";
import { audio } from "../lib/audio";
import { emptyResponseLog, scoreSession, type ResponseLog } from "../lib/scoring";
import { generateSequence, isTarget, modalitiesFor } from "../lib/sequence";
import type { Modality, Sequence, SessionResult, SessionSettings } from "../lib/types";

export type SessionPhase = "idle" | "countdown" | "running" | "paused" | "finished";

/**
 * `hit`  - pressed on a real match
 * `slip` - pressed when there was no match (false alarm)
 * `miss` - a match went by without a press
 */
export type Feedback = "idle" | "hit" | "slip" | "miss";

export const COUNTDOWN_TICKS = 3;
const COUNTDOWN_TICK_MS = 700;

/** Quiet gap at the end of each trial: shows the outcome before the next cue. */
export const GAP_MS = 320;

/** How long the cue stays on screen inside its trial. */
export function stimulusMs(intervalMs: number): number {
  return Math.min(700, Math.max(350, Math.round(intervalMs * 0.35)));
}

const noFlags = (): Record<Modality, boolean> => ({
  position: false,
  audio: false,
  color: false,
});

const noFeedback = (): Record<Modality, Feedback> => ({
  position: "idle",
  audio: "idle",
  color: "idle",
});

interface Engine {
  runCountdown(after: () => void): void;
  startTrial(index: number, replay?: boolean): void;
  closeResponses(index: number): void;
  finish(): void;
}

export interface Session {
  phase: SessionPhase;
  countdown: number;
  sequence: Sequence | null;
  settings: SessionSettings | null;
  trialIndex: number;
  totalTrials: number;
  /** True while the current trial is part of the unscored warm-up. */
  isWarmup: boolean;
  stimulusVisible: boolean;
  responseOpen: boolean;
  pressed: Record<Modality, boolean>;
  feedback: Record<Modality, Feedback>;
  result: SessionResult | null;
  start(settings: SessionSettings): void;
  pause(): void;
  resume(): void;
  restart(): void;
  exit(): void;
  respond(modality: Modality): void;
}

/**
 * Owns the trial loop.
 *
 * Every trial occupies exactly `intervalMs`: the cue shows for `stimulusMs`,
 * responses are accepted until `intervalMs - GAP_MS`, and the remaining gap
 * shows the outcome. Pausing clears the timeline; resuming counts down and
 * replays the interrupted trial from its start, so no trial is ever scored
 * against a partial response window.
 */
export function useSession(onComplete: (result: SessionResult) => void): Session {
  const [phase, setPhase] = useState<SessionPhase>("idle");
  const [countdown, setCountdown] = useState(COUNTDOWN_TICKS);
  const [sequence, setSequence] = useState<Sequence | null>(null);
  const [settings, setSettings] = useState<SessionSettings | null>(null);
  const [trialIndex, setTrialIndex] = useState(-1);
  const [stimulusVisible, setStimulusVisible] = useState(false);
  const [responseOpen, setResponseOpen] = useState(false);
  const [pressed, setPressed] = useState<Record<Modality, boolean>>(noFlags);
  const [feedback, setFeedback] = useState<Record<Modality, Feedback>>(noFeedback);
  const [result, setResult] = useState<SessionResult | null>(null);

  const timers = useRef<number[]>([]);
  const phaseRef = useRef<SessionPhase>("idle");
  const sequenceRef = useRef<Sequence | null>(null);
  const settingsRef = useRef<SessionSettings | null>(null);
  const trialRef = useRef(-1);
  const openRef = useRef(false);
  const responsesRef = useRef<ResponseLog>(emptyResponseLog(0));
  /** Trial to (re)start on the next resume. */
  const resumeAtRef = useRef(0);
  const engineRef = useRef<Engine | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const clearTimers = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const enterPhase = useCallback((next: SessionPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const closeResponseWindow = useCallback(() => {
    openRef.current = false;
    setResponseOpen(false);
  }, []);

  const engine: Engine = {
    runCountdown(after) {
      clearTimers();
      enterPhase("countdown");
      setCountdown(COUNTDOWN_TICKS);
      setStimulusVisible(false);
      closeResponseWindow();
      audio.cue("tick");

      for (let tick = 1; tick <= COUNTDOWN_TICKS; tick++) {
        schedule(() => {
          if (tick < COUNTDOWN_TICKS) {
            setCountdown(COUNTDOWN_TICKS - tick);
            audio.cue("tick");
          } else {
            audio.cue("start");
            after();
          }
        }, tick * COUNTDOWN_TICK_MS);
      }
    },

    startTrial(index, replay = false) {
      const seq = sequenceRef.current;
      const config = settingsRef.current;
      if (!seq || !config) return;
      if (index >= seq.trials.length) {
        engine.finish();
        return;
      }

      trialRef.current = index;
      resumeAtRef.current = index;
      setTrialIndex(index);

      const warmup = index < seq.n;
      openRef.current = !warmup;
      setResponseOpen(!warmup);
      setPressed({
        position: responsesRef.current.position[index] === true,
        audio: responsesRef.current.audio[index] === true,
        color: responsesRef.current.color[index] === true,
      });
      if (!replay) setFeedback(noFeedback());
      enterPhase("running");

      setStimulusVisible(true);
      audio.speakLetter(seq.trials[index].letter);

      const interval = config.intervalMs;
      const visibleFor = stimulusMs(interval);

      schedule(() => setStimulusVisible(false), visibleFor);
      schedule(() => engine.closeResponses(index), Math.max(visibleFor + 100, interval - GAP_MS));
      schedule(() => engine.startTrial(index + 1), interval);
    },

    closeResponses(index) {
      const seq = sequenceRef.current;
      closeResponseWindow();
      if (!seq || index < seq.n) return;

      const missed: Partial<Record<Modality, Feedback>> = {};
      for (const modality of modalitiesFor(seq.mode)) {
        if (
          isTarget(seq.trials, index, seq.n, modality) &&
          responsesRef.current[modality][index] !== true
        ) {
          missed[modality] = "miss";
        }
      }
      if (Object.keys(missed).length > 0) {
        setFeedback((prev) => ({ ...prev, ...missed }));
      }
    },

    finish() {
      clearTimers();
      audio.stopSpeech();
      setStimulusVisible(false);
      closeResponseWindow();
      trialRef.current = -1;
      setTrialIndex(-1);
      enterPhase("finished");

      const seq = sequenceRef.current;
      const config = settingsRef.current;
      if (!seq || !config) return;

      const score = scoreSession(seq, responsesRef.current);
      const finished: SessionResult = {
        settings: config,
        totalTrials: seq.trials.length,
        scoredTrials: score.scored,
        accuracy: score.accuracy,
        modalities: score.modalities,
        completedAt: Date.now(),
      };
      setResult(finished);
      audio.cue("complete");
      onCompleteRef.current(finished);
    },
  };
  engineRef.current = engine;

  const start = useCallback(
    (config: SessionSettings) => {
      clearTimers();
      audio.stopSpeech();
      audio.prepare();

      const seq = generateSequence(config.n, config.mode);
      sequenceRef.current = seq;
      settingsRef.current = config;
      responsesRef.current = emptyResponseLog(seq.trials.length);
      trialRef.current = -1;
      resumeAtRef.current = 0;

      setSequence(seq);
      setSettings(config);
      setResult(null);
      setPressed(noFlags());
      setFeedback(noFeedback());
      setTrialIndex(-1);

      engineRef.current?.runCountdown(() => engineRef.current?.startTrial(0));
    },
    [clearTimers],
  );

  const pause = useCallback(() => {
    const current = phaseRef.current;
    if (current !== "running" && current !== "countdown") return;

    if (current === "running") {
      const seq = sequenceRef.current;
      const index = trialRef.current;
      const warmup = seq ? index < seq.n : false;
      // A trial whose response window already closed should not be replayed.
      resumeAtRef.current = openRef.current || warmup ? index : index + 1;
    }

    clearTimers();
    audio.stopSpeech();
    setStimulusVisible(false);
    closeResponseWindow();
    enterPhase("paused");
  }, [clearTimers, closeResponseWindow, enterPhase]);

  const resume = useCallback(() => {
    if (phaseRef.current !== "paused") return;
    audio.prepare();
    const target = resumeAtRef.current;
    const replay = target === trialRef.current;
    engineRef.current?.runCountdown(() => engineRef.current?.startTrial(target, replay));
  }, []);

  const restart = useCallback(() => {
    const config = settingsRef.current;
    if (config) start(config);
  }, [start]);

  const exit = useCallback(() => {
    clearTimers();
    audio.stopSpeech();
    sequenceRef.current = null;
    trialRef.current = -1;
    resumeAtRef.current = 0;
    setSequence(null);
    setResult(null);
    setTrialIndex(-1);
    setStimulusVisible(false);
    setPressed(noFlags());
    setFeedback(noFeedback());
    closeResponseWindow();
    enterPhase("idle");
  }, [clearTimers, closeResponseWindow, enterPhase]);

  const respond = useCallback((modality: Modality) => {
    const seq = sequenceRef.current;
    if (!seq || phaseRef.current !== "running" || !openRef.current) return;
    if (modality === "color" && seq.mode !== "triple") return;

    const index = trialRef.current;
    if (index < seq.n || index >= seq.trials.length) return;
    if (responsesRef.current[modality][index] === true) return;

    responsesRef.current[modality][index] = true;
    setPressed((prev) => ({ ...prev, [modality]: true }));

    if (isTarget(seq.trials, index, seq.n, modality)) {
      // Raise the pitch when more than one stream is answered in the same trial.
      let stacked = 0;
      for (const other of modalitiesFor(seq.mode)) {
        if (
          other !== modality &&
          responsesRef.current[other][index] === true &&
          isTarget(seq.trials, index, seq.n, other)
        ) {
          stacked += 1;
        }
      }
      setFeedback((prev) => ({ ...prev, [modality]: "hit" }));
      audio.cue("hit", stacked);
    } else {
      setFeedback((prev) => ({ ...prev, [modality]: "slip" }));
      audio.cue("slip");
    }
  }, []);

  // Background tabs throttle timers, so step out cleanly instead of drifting.
  useEffect(() => {
    const handleHidden = () => {
      if (document.visibilityState === "hidden") pause();
    };
    document.addEventListener("visibilitychange", handleHidden);
    return () => document.removeEventListener("visibilitychange", handleHidden);
  }, [pause]);

  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id);
      timers.current = [];
      audio.stopSpeech();
    },
    [],
  );

  const totalTrials = sequence?.trials.length ?? 0;
  const isWarmup = sequence !== null && trialIndex >= 0 && trialIndex < sequence.n;

  return {
    phase,
    countdown,
    sequence,
    settings,
    trialIndex,
    totalTrials,
    isWarmup,
    stimulusVisible,
    responseOpen,
    pressed,
    feedback,
    result,
    start,
    pause,
    resume,
    restart,
    exit,
    respond,
  };
}
