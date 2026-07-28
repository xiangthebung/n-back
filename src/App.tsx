/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig } from "motion/react";
import { HelpCircle } from "lucide-react";
import { audio } from "./lib/audio";
import { controlLayout, slotForKey } from "./lib/controls";
import { toPercent } from "./lib/scoring";
import { MAX_N, MIN_N } from "./lib/sequence";
import {
  bestKey,
  loadState,
  saveState,
  type PersistedState,
  type Preferences,
} from "./lib/storage";
import type { SessionResult, SessionSettings } from "./lib/types";
import { useSession } from "./game/useSession";
import { AmbientBackground } from "./components/AmbientBackground";
import { HomeScreen } from "./components/HomeScreen";
import { HowToPlay } from "./components/HowToPlay";
import { PlayScreen } from "./components/PlayScreen";
import { ResultsScreen } from "./components/ResultsScreen";

interface BestInfo {
  previous: number | null;
  isRecord: boolean;
}

export default function App() {
  const [stored, setStored] = useState<PersistedState>(() => loadState());
  const [showHowTo, setShowHowTo] = useState(() => !stored.hasSeenIntro);
  const [bestInfo, setBestInfo] = useState<BestInfo>({ previous: null, isRecord: false });

  const { settings, preferences, bests } = stored;
  const speechSupported = useMemo(() => audio.speechSupported, []);
  // Spoken letters are the game, not a preference. Printing the letter on the
  // tile is only a fallback for browsers without a voice.
  const showTileHints = !speechSupported;

  const patchStored = useCallback((patch: Partial<PersistedState>) => {
    setStored((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    saveState(stored);
  }, [stored]);

  useEffect(() => {
    audio.setPreferences({ sound: preferences.sound, voice: speechSupported });
  }, [preferences.sound, speechSupported]);

  // Read bests without depending on render order when a session ends.
  const bestsRef = useRef(bests);
  bestsRef.current = bests;

  const handleComplete = useCallback((result: SessionResult) => {
    const key = bestKey(result.settings.mode, result.settings.n);
    const percent = toPercent(result.accuracy);
    const previous = bestsRef.current[key] ?? null;
    const isRecord = previous === null || percent > previous;

    setBestInfo({ previous, isRecord });
    if (isRecord) {
      setStored((prev) => ({ ...prev, bests: { ...prev.bests, [key]: percent } }));
    }
  }, []);

  const session = useSession(handleComplete);
  const { phase, respond, pause, resume, exit, start } = session;

  const startSession = useCallback(
    (next?: Partial<SessionSettings>) => {
      const config = { ...settings, ...next };
      if (next) patchStored({ settings: config });
      start(config);
    },
    [settings, patchStored, start],
  );

  const closeHowTo = useCallback(() => {
    setShowHowTo(false);
    patchStored({ hasSeenIntro: true });
  }, [patchStored]);

  // The buttons on screen and the keys share one layout, so they can never disagree.
  const activeMode = session.sequence ? session.sequence.mode : settings.mode;
  const slots = useMemo(() => controlLayout(activeMode), [activeMode]);

  // A single keyboard layer, so shortcuts can never fight each other.
  const modalOpen = showHowTo;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (modalOpen || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }

      const current = phaseRef.current;

      if (current === "running") {
        const slot = slotForKey(slotsRef.current, event.key);
        if (slot) {
          event.preventDefault();
          respond(slot.modality);
          return;
        }
      }

      // Escape is the only session shortcut: it pauses, and it resumes.
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (current === "running" || current === "countdown") pause();
      else if (current === "paused") resume();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, respond, pause, resume]);

  const inSession = phase === "countdown" || phase === "running" || phase === "paused";
  const currentBest = bests[bestKey(settings.mode, settings.n)] ?? null;

  return (
    <MotionConfig reducedMotion="user">
      <AmbientBackground dimmed={inSession} />

      <div className="relative flex min-h-dvh flex-col px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <header className="mx-auto flex w-full max-w-[420px] items-center justify-between">
          {/* The mark echoes the board rather than repeating the letter N. */}
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="grid grid-cols-3 gap-[3px]">
              {Array.from({ length: 9 }, (_, index) => (
                <span
                  key={index}
                  className={`h-1 w-1 rounded-[1px] ${index === 4 ? "bg-sage" : "bg-white/22"}`}
                />
              ))}
            </span>
            <span className="text-[13px] font-semibold tracking-tight text-ink/90">N-Back</span>
          </div>

          {/* Nothing competes with the board while a session is running. */}
          {!inSession ? (
            <button
              type="button"
              onClick={() => setShowHowTo(true)}
              className="flex min-h-9 items-center gap-1.5 rounded-full border border-white/10 px-3.5 text-[12px] font-medium text-muted transition-colors duration-200 hover:bg-white/[0.06] hover:text-ink"
            >
              <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
              How to play
            </button>
          ) : null}
        </header>

        <main className="flex flex-1 flex-col items-center justify-center py-8">
          <AnimatePresence mode="wait">
            {phase === "idle" ? (
              <HomeScreen
                key="home"
                settings={settings}
                onSettingsChange={(next) => patchStored({ settings: next })}
                preferences={preferences}
                onPreferencesChange={(next: Preferences) => patchStored({ preferences: next })}
                speechSupported={speechSupported}
                best={currentBest}
                onStart={() => startSession()}
              />
            ) : null}

            {inSession ? (
              <div key="play" className="flex w-full justify-center select-none">
                <PlayScreen session={session} showHints={showTileHints} slots={slots} />
              </div>
            ) : null}

            {phase === "finished" && session.result ? (
              <ResultsScreen
                key="results"
                result={session.result}
                previousBest={bestInfo.previous}
                isPersonalBest={bestInfo.isRecord}
                onAgain={() => startSession()}
                onChangeSettings={exit}
                onLevelChange={(n) => startSession({ n: Math.min(MAX_N, Math.max(MIN_N, n)) })}
              />
            ) : null}
          </AnimatePresence>
        </main>
      </div>

      <HowToPlay open={showHowTo} onClose={closeHowTo} />
    </MotionConfig>
  );
}
