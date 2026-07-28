import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import { cn, modeLabel, secondsLabel } from "../lib/format";
import type { ControlSlot } from "../lib/controls";
import { POSITION_NAMES } from "../lib/stimuli";
import type { Session } from "../game/useSession";
import { Board, colorFor } from "./Board";
import { ResponseBar } from "./ResponseBar";
import { Kbd, QuietButton } from "./ui";

interface PlayScreenProps {
  session: Session;
  showHints: boolean;
  slots: ControlSlot[];
}

export function PlayScreen({ session, showHints, slots }: PlayScreenProps) {
  const { sequence, settings, phase, trialIndex, totalTrials } = session;
  if (!sequence || !settings) return null;

  const triple = sequence.mode === "triple";
  const trial = trialIndex >= 0 ? sequence.trials[trialIndex] : null;
  const paused = phase === "paused";
  const counting = phase === "countdown";
  const progress = totalTrials === 0 ? 0 : Math.max(0, trialIndex + 1) / totalTrials;
  const scoredIndex = trialIndex - sequence.n + 1;
  const positionLabel =
    session.isWarmup || scoredIndex < 1
      ? "Warm-up"
      : `Trial ${Math.min(scoredIndex, sequence.scoredTrials)} of ${sequence.scoredTrials}`;

  return (
    <div className="flex w-full flex-col items-center gap-5">
      {/* HUD */}
      <div className="flex w-full max-w-[420px] items-center gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div
            role="progressbar"
            aria-label="Session progress"
            aria-valuemin={0}
            aria-valuemax={totalTrials}
            aria-valuenow={Math.max(0, trialIndex + 1)}
            aria-valuetext={positionLabel}
            className="h-[3px] w-full overflow-hidden rounded-full bg-white/8"
          >
            <motion.div
              className="h-full rounded-full bg-sage/80"
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>
          <div className="flex items-center gap-2 text-[11px] tracking-tight text-faint">
            <span className="tnum">
              {sequence.n}-back · {modeLabel(sequence.mode)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tnum">{positionLabel}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={session.pause}
          disabled={paused}
          aria-label="Pause session"
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-muted",
            "transition-colors duration-200 hover:bg-white/[0.07] hover:text-ink disabled:opacity-30",
          )}
        >
          <Pause className="h-4 w-4" />
        </button>
      </div>

      {/* Board + overlays */}
      <div className="relative w-[min(88vw,52svh,420px)]">
        <Board
          trial={trial}
          visible={session.stimulusVisible}
          triple={triple}
          showHints={showHints}
        />

        {/* Count-in sits on the empty grid with no scrim, so nothing looks greyed out. */}
        <AnimatePresence>
          {counting ? (
            <motion.div
              key="countdown"
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <motion.span
                key={session.countdown}
                className="tnum text-[72px] leading-none font-light text-ink/90"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {session.countdown}
              </motion.span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>{paused ? <PausePanel session={session} /> : null}</AnimatePresence>
      </div>

      {/* With tile hints on, the cue is described for assistive technology too. */}
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {showHints && session.stimulusVisible && trial
          ? `${POSITION_NAMES[trial.position]}, ${trial.letter}${
              triple ? `, ${colorFor(trial, triple).name}` : ""
            }`
          : ""}
      </p>

      {/* Response controls */}
      <div className="flex w-full max-w-[420px] flex-col gap-2.5">
        <ResponseBar
          slots={slots}
          feedback={session.feedback}
          pressed={session.pressed}
          enabled={phase === "running" && session.responseOpen}
          muted={phase !== "running" || session.isWarmup}
          onRespond={session.respond}
        />
        <p className="min-h-4 text-center text-[11px] tracking-tight text-faint">
          {session.isWarmup
            ? "Warm-up. Nothing to answer yet."
            : `Answer when a cue repeats from ${sequence.n} back.`}
        </p>
      </div>
    </div>
  );
}

function PausePanel({ session }: { session: Session }) {
  const resumeRef = useRef<HTMLButtonElement>(null);
  const settings = session.settings;

  useEffect(() => {
    resumeRef.current?.focus();
  }, []);

  return (
    <motion.div
      className="absolute inset-0 z-20 flex flex-col justify-center overflow-y-auto rounded-[24px] border border-white/8 bg-canvas/80 p-5 backdrop-blur-xl"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      role="group"
      aria-label="Session paused"
    >
      <h2 className="text-center text-base font-semibold tracking-tight text-ink">Paused</h2>
      {settings ? (
        <p className="tnum mt-1 text-center text-[11px] text-faint">
          {settings.n}-back · {modeLabel(settings.mode)} · {secondsLabel(settings.intervalMs)}s per trial
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-2">
        <button
          ref={resumeRef}
          type="button"
          onClick={session.resume}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-sage text-[13px] font-semibold tracking-tight text-canvas transition-colors duration-200 hover:bg-sage-soft"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          Resume
          <Kbd className="ml-1 border-canvas/25 bg-canvas/15 text-canvas/70">esc</Kbd>
        </button>
        <QuietButton onClick={session.restart}>
          <RotateCcw className="h-3.5 w-3.5" />
          Start over
        </QuietButton>
        <QuietButton tone="danger" onClick={session.exit}>
          <X className="h-3.5 w-3.5" />
          End session
        </QuietButton>
      </div>

      <p className="mt-5 text-center text-[10px] leading-relaxed text-faint">
        Resuming replays the current cue.
      </p>
    </motion.div>
  );
}
