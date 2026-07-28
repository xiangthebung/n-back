import { clampInterval, clampN } from "./sequence";
import type { GameMode, SessionSettings } from "./types";

const STORAGE_KEY = "zen-nback/v1";
const LEGACY_TUTORIAL_KEY = "nback_hide_tutorial";

export interface Preferences {
  /** Feedback cues for answers and the count-in. Spoken letters are part of the
   *  game itself and are always on when the browser has a voice. */
  sound: boolean;
}

export interface PersistedState {
  settings: SessionSettings;
  preferences: Preferences;
  /** Best balanced accuracy per `mode:n`, stored as a percentage. */
  bests: Record<string, number>;
  hasSeenIntro: boolean;
}

export const DEFAULT_SETTINGS: SessionSettings = {
  mode: "dual",
  n: 2,
  intervalMs: 2500,
};

export const DEFAULT_PREFERENCES: Preferences = {
  sound: true,
};

export function bestKey(mode: GameMode, n: number): string {
  return `${mode}:${n}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readMode(value: unknown): GameMode {
  return value === "triple" ? "triple" : "dual";
}

function readBests(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      out[key] = Math.min(100, Math.max(0, Math.round(raw)));
    }
  }
  return out;
}

export function defaultState(): PersistedState {
  return {
    settings: { ...DEFAULT_SETTINGS },
    preferences: { ...DEFAULT_PREFERENCES },
    bests: {},
    hasSeenIntro: false,
  };
}

export function loadState(): PersistedState {
  const state = defaultState();
  if (typeof window === "undefined") return state;

  try {
    const legacyHideTutorial = window.localStorage.getItem(LEGACY_TUTORIAL_KEY) === "true";
    if (legacyHideTutorial) state.hasSeenIntro = true;

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return state;

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return state;

    if (isRecord(parsed.settings)) {
      state.settings = {
        mode: readMode(parsed.settings.mode),
        n: clampN(typeof parsed.settings.n === "number" ? parsed.settings.n : DEFAULT_SETTINGS.n),
        intervalMs: clampInterval(
          typeof parsed.settings.intervalMs === "number"
            ? parsed.settings.intervalMs
            : DEFAULT_SETTINGS.intervalMs,
        ),
      };
    }

    if (isRecord(parsed.preferences)) {
      state.preferences = {
        sound: readBool(parsed.preferences.sound, DEFAULT_PREFERENCES.sound),
      };
    }

    state.bests = readBests(parsed.bests);
    state.hasSeenIntro = readBool(parsed.hasSeenIntro, state.hasSeenIntro);
  } catch {
    // Corrupt or unavailable storage should never block the app.
  }

  return state;
}

export function saveState(state: PersistedState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private browsing or a full quota: preferences simply do not persist.
  }
}
