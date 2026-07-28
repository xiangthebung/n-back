import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, RotateCcw, Sliders, Trophy } from "lucide-react";
import { modeLabel, secondsLabel } from "../lib/format";
import { MAX_N, MIN_N } from "../lib/sequence";
import { accuracyNote, suggestNext, toPercent } from "../lib/scoring";
import { MODALITY_LABEL } from "../lib/stimuli";
import type { SessionResult } from "../lib/types";
import { Card, PrimaryButton, QuietButton } from "./ui";

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function AccuracyRing({ percent }: { percent: number }) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(reduceMotion ? percent : 0);

  useEffect(() => {
    if (reduceMotion) {
      setShown(percent);
      return;
    }
    const duration = 900;
    const start = performance.now();
    let frame = 0;

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(percent * eased));
      if (t < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [percent, reduceMotion]);

  return (
    <div className="relative flex h-[164px] w-[164px] items-center justify-center">
      <svg viewBox="0 0 108 108" className="h-full w-full -rotate-90">
        <circle cx="54" cy="54" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
        <motion.circle
          cx="54"
          cy="54"
          r={RADIUS}
          fill="none"
          stroke="var(--color-sage)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - percent / 100) }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="tnum text-[40px] leading-none font-light text-ink">{shown}%</span>
        <span className="mt-1.5 text-[10px] tracking-[0.1em] text-faint uppercase">Accuracy</span>
      </div>
    </div>
  );
}

interface ResultsScreenProps {
  result: SessionResult;
  previousBest: number | null;
  isPersonalBest: boolean;
  onAgain: () => void;
  onChangeSettings: () => void;
  onLevelChange: (n: number) => void;
}

export function ResultsScreen({
  result,
  previousBest,
  isPersonalBest,
  onAgain,
  onChangeSettings,
  onLevelChange,
}: ResultsScreenProps) {
  const percent = toPercent(result.accuracy);
  const suggestion = suggestNext(percent, result.settings.n, MIN_N, MAX_N);

  return (
    <motion.div
      className="flex w-full max-w-[420px] flex-col items-center gap-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
      transition={{ duration: 0.26, ease: "easeOut" }}
    >
      <div className="flex flex-col items-center gap-1">
        <span className="text-[11px] tracking-[0.12em] text-faint uppercase">Session complete</span>
        <p className="tnum text-[13px] text-muted">
          {result.settings.n}-back · {modeLabel(result.settings.mode)} ·{" "}
          {secondsLabel(result.settings.intervalMs)}s
        </p>
      </div>

      <AccuracyRing percent={percent} />

      <p className="max-w-[300px] text-center text-[13px] leading-relaxed text-muted">
        {accuracyNote(percent)}
      </p>

      {isPersonalBest ? (
        <div className="flex items-center gap-2 rounded-full border border-sage/30 bg-sage/10 px-3.5 py-1.5 text-[11px] font-semibold text-sage-soft">
          <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
          {previousBest === null ? "First run at this level" : `New best — was ${previousBest}%`}
        </div>
      ) : previousBest !== null ? (
        <p className="tnum text-[11px] text-faint">Best at this level: {previousBest}%</p>
      ) : null}

      <Card className="w-full overflow-hidden">
        <div className="grid grid-cols-[1fr_repeat(3,44px)] gap-2 border-b border-white/6 px-4 py-2.5 text-[10px] tracking-[0.06em] text-faint uppercase">
          <span>Stream</span>
          <span className="text-center">Caught</span>
          <span className="text-center">Missed</span>
          <span className="text-center">False</span>
        </div>

        {result.modalities.map((score) => (
          <div
            key={score.modality}
            className="grid grid-cols-[1fr_repeat(3,44px)] items-center gap-2 border-b border-white/5 px-4 py-3 last:border-b-0"
          >
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] font-medium text-ink">
                {MODALITY_LABEL[score.modality]}
              </span>
              <span className="tnum text-[11px] text-faint">{toPercent(score.accuracy)}% accurate</span>
            </div>
            <span className="tnum text-center text-[13px] text-sage">
              {score.hits}
              <span className="text-faint">/{score.targets}</span>
            </span>
            <span className="tnum text-center text-[13px] text-rose/90">{score.misses}</span>
            <span className="tnum text-center text-[13px] text-amber">{score.falseAlarms}</span>
          </div>
        ))}
      </Card>

      <p className="max-w-[300px] text-center text-[11px] leading-relaxed text-faint">
        Accuracy counts correct presses and correct silences.
      </p>

      <div className="flex w-full flex-col gap-3">
        {suggestion.nextN !== null ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-sage/20 bg-sage/[0.07] p-4">
            <p className="text-[13px] leading-relaxed text-ink/90">{suggestion.text}</p>
            <QuietButton
              className="border-sage/35 text-sage-soft hover:bg-sage/12"
              onClick={() => onLevelChange(suggestion.nextN as number)}
            >
              Switch to {suggestion.nextN}-back
              <ArrowRight className="h-3.5 w-3.5" />
            </QuietButton>
          </div>
        ) : (
          <p className="text-center text-[13px] text-muted">{suggestion.text}</p>
        )}

        <PrimaryButton onClick={onAgain}>
          <RotateCcw className="h-4 w-4" />
          Again
        </PrimaryButton>
        <QuietButton onClick={onChangeSettings}>
          <Sliders className="h-3.5 w-3.5" />
          Change setup
        </QuietButton>
      </div>
    </motion.div>
  );
}
