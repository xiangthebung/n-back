import { motion } from "motion/react";
import { Play, Trophy } from "lucide-react";
import { clockLabel, secondsLabel } from "../lib/format";
import {
  MAX_INTERVAL_MS,
  MAX_N,
  MIN_INTERVAL_MS,
  MIN_N,
  INTERVAL_STEP_MS,
  SCORED_TRIALS,
  totalTrialsFor,
} from "../lib/sequence";
import type { GameMode, SessionSettings } from "../lib/types";
import type { Preferences } from "../lib/storage";
import { Card, Field, LevelPicker, PaceSlider, PrimaryButton, Segmented, Toggle } from "./ui";

interface HomeScreenProps {
  settings: SessionSettings;
  onSettingsChange: (next: SessionSettings) => void;
  preferences: Preferences;
  onPreferencesChange: (next: Preferences) => void;
  speechSupported: boolean;
  best: number | null;
  onStart: () => void;
}

const MODE_OPTIONS = [
  { value: "dual" as GameMode, label: "Dual", caption: "Position + sound" },
  { value: "triple" as GameMode, label: "Triple", caption: "+ color" },
];

export function HomeScreen({
  settings,
  onSettingsChange,
  preferences,
  onPreferencesChange,
  speechSupported,
  best,
  onStart,
}: HomeScreenProps) {
  const totalTrials = totalTrialsFor(settings.n);
  const estimate = clockLabel(totalTrials * settings.intervalMs + 2500);

  return (
    <motion.div
      className="flex w-full max-w-[420px] flex-col gap-7"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      // Leaves quickly so the board is on screen before the count-in is audible.
      exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
      transition={{ duration: 0.26, ease: "easeOut" }}
    >
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-ink">
          Working memory practice
        </h1>
        <p className="text-[13px] leading-relaxed text-muted">
          Watch and listen. Answer when a cue repeats from a few steps back.
        </p>
      </div>

      <Card className="flex flex-col gap-7 p-5">
        <Field
          label="Mode"
          hint={
            settings.mode === "triple"
              ? "Follow the square, the letter, and the colour."
              : "Follow the square and the letter."
          }
        >
          <Segmented
            ariaLabel="Mode"
            options={MODE_OPTIONS}
            value={settings.mode}
            onChange={(mode) => onSettingsChange({ ...settings, mode })}
          />
        </Field>

        <Field
          label="Steps back"
          value={`${settings.n}-back`}
          hint={`Compare each cue with the one ${settings.n} ${settings.n === 1 ? "step" : "steps"} earlier.`}
        >
          <LevelPicker
            value={settings.n}
            min={MIN_N}
            max={MAX_N}
            onChange={(n) => onSettingsChange({ ...settings, n })}
          />
        </Field>

        <Field label="Pace" value={`${secondsLabel(settings.intervalMs)}s per trial`}>
          <div className="flex flex-col gap-1">
            <PaceSlider
              value={settings.intervalMs}
              min={MIN_INTERVAL_MS}
              max={MAX_INTERVAL_MS}
              step={INTERVAL_STEP_MS}
              onChange={(intervalMs) => onSettingsChange({ ...settings, intervalMs })}
            />
            <div className="flex justify-between text-[11px] text-faint">
              <span>Brisk</span>
              <span>Unhurried</span>
            </div>
          </div>
        </Field>

        <div className="flex flex-col gap-5">
          <div className="h-px bg-white/6" />
          <Toggle
            label="Feedback sounds"
            caption="A soft cue for each answer."
            checked={preferences.sound}
            onChange={(sound) => onPreferencesChange({ ...preferences, sound })}
          />
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        <PrimaryButton onClick={onStart}>
          <Play className="h-4 w-4 fill-current" />
          Start session
        </PrimaryButton>

        <div className="flex items-center justify-center gap-2 text-[11px] text-faint">
          <span className="tnum">
            {SCORED_TRIALS} scored trials · about {estimate}
          </span>
          {best !== null ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="tnum inline-flex items-center gap-1 text-muted">
                <Trophy className="h-3 w-3" aria-hidden="true" />
                Best {best}%
              </span>
            </>
          ) : null}
        </div>

        {!speechSupported ? (
          <p className="text-center text-[11px] leading-relaxed text-amber/90">
            This browser has no speech voice, so the letter is shown on the tile instead.
          </p>
        ) : null}
      </div>
    </motion.div>
  );
}
