import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Award,
  BarChart3,
  Check,
  Clock3,
  Eye,
  EyeOff,
  HelpCircle,
  History as HistoryIcon,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  Volume2,
  VolumeX,
  X
} from "lucide-react";

// @ts-ignore
import boopSoundUrl from "./boop.mp3";
import { TutorialModal } from "./components/TutorialModal";

type GameMode = "dual" | "triple";
type GameState = "menu" | "playing" | "paused" | "complete";
type GamePhase = "idle" | "countdown" | "stimulus" | "transition";
type Feedback = "idle" | "correct" | "wrong" | "missed";
type MatchType = "position" | "audio" | "color";

interface CategoryStats {
  right: number;
  wrong: number;
  missed: number;
  correctReject: number;
  reactionTimes: number[];
}

interface MatchStats {
  position: CategoryStats;
  audio: CategoryStats;
  color: CategoryStats;
}

interface SequenceStep {
  position: number;
  letter: string;
  colorIndex: number;
}

interface HistoryStats {
  right: number;
  wrong: number;
  missed: number;
  correctReject: number;
}

interface SessionRecord {
  id: number;
  completedAt: string;
  nLevel: number;
  speed: number;
  gameMode: GameMode;
  sessionLength: number;
  accuracy: number;
  performanceScore: number;
  hitRate: number;
  falseAlarmRate: number;
  averageReactionMs: number | null;
  reactionScore: number;
  stats: {
    position: HistoryStats;
    audio: HistoryStats;
    color: HistoryStats;
  };
}

interface SessionMetrics {
  totalOpportunities: number;
  totalCorrect: number;
  totalHits: number;
  totalFalseAlarms: number;
  totalMissed: number;
  totalCorrectRejects: number;
  accuracy: number;
  hitRate: number;
  falseAlarmRate: number;
  averageReactionMs: number | null;
  reactionScore: number;
  performanceScore: number;
}

const LETTERS_POOL = ["B", "C", "F", "H", "J", "M", "R", "T", "O", "W"];
const COLORS_POOL = [
  { name: "Green", hex: "#5da38a", border: "#7fbda5" },
  { name: "Amber", hex: "#dfa15f", border: "#f2bf8a" },
  { name: "Lavender", hex: "#7297cc", border: "#9fc0ee" },
  { name: "Rose", hex: "#cc7e8a", border: "#eba4ae" }
];
const HISTORY_KEY = "nback_session_history";
const MAX_HISTORY_ITEMS = 20;

const createCategoryStats = (): CategoryStats => ({
  right: 0,
  wrong: 0,
  missed: 0,
  correctReject: 0,
  reactionTimes: []
});

const createEmptyStats = (): MatchStats => ({
  position: createCategoryStats(),
  audio: createCategoryStats(),
  color: createCategoryStats()
});

const formatSpeed = (value: number) => value.toFixed(1);
const formatReaction = (value: number | null) => value === null ? "—" : `${value} ms`;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const readHistory = (): SessionRecord[] => {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY_ITEMS) : [];
  } catch {
    return [];
  }
};

const calculateMetrics = (
  stats: MatchStats,
  sessionLength: number,
  nLevel: number,
  mode: GameMode,
  speedSeconds: number
): SessionMetrics => {
  const channels: MatchType[] = mode === "triple" ? ["position", "audio", "color"] : ["position", "audio"];
  const scorableTrials = Math.max(0, sessionLength - nLevel);
  const totalOpportunities = scorableTrials * channels.length;
  const totalHits = channels.reduce((sum, type) => sum + stats[type].right, 0);
  const totalFalseAlarms = channels.reduce((sum, type) => sum + stats[type].wrong, 0);
  const totalMissed = channels.reduce((sum, type) => sum + stats[type].missed, 0);
  const totalCorrectRejects = channels.reduce((sum, type) => sum + stats[type].correctReject, 0);
  const totalCorrect = totalHits + totalCorrectRejects;
  const reactionTimes = channels.flatMap(type => stats[type].reactionTimes);
  const averageReactionMs = reactionTimes.length
    ? Math.round(reactionTimes.reduce((sum, value) => sum + value, 0) / reactionTimes.length)
    : null;
  const accuracy = totalOpportunities ? Math.round((totalCorrect / totalOpportunities) * 100) : 0;
  const hitRate = totalHits + totalMissed ? Math.round((totalHits / (totalHits + totalMissed)) * 100) : 0;
  const nonTargets = totalFalseAlarms + totalCorrectRejects;
  const falseAlarmRate = nonTargets ? Math.round((totalFalseAlarms / nonTargets) * 100) : 0;
  const reactionScore = averageReactionMs === null
    ? 0
    : Math.round(clamp(100 * (1 - averageReactionMs / (speedSeconds * 1000)), 0, 100));
  const performanceScore = Math.round(accuracy * 0.75 + reactionScore * 0.25);

  return {
    totalOpportunities,
    totalCorrect,
    totalHits,
    totalFalseAlarms,
    totalMissed,
    totalCorrectRejects,
    accuracy,
    hitRate,
    falseAlarmRate,
    averageReactionMs,
    reactionScore,
    performanceScore
  };
};

const toHistoryStats = (stats: CategoryStats): HistoryStats => ({
  right: stats.right,
  wrong: stats.wrong,
  missed: stats.missed,
  correctReject: stats.correctReject
});

const feedbackLabel = (feedback: Feedback) => {
  if (feedback === "correct") return "Correct";
  if (feedback === "wrong") return "False alarm";
  if (feedback === "missed") return "Missed";
  return "";
};

const feedbackStyles = (feedback: Feedback) => {
  if (feedback === "correct") return "bg-[#8ba99b]/15 border-[#8ba99b] text-[#8ba99b] shadow-lg shadow-[#8ba99b]/10";
  if (feedback === "wrong") return "bg-[#d4a373]/15 border-[#d4a373] text-[#d4a373] shadow-lg shadow-[#d4a373]/10";
  if (feedback === "missed") return "bg-rose-500/10 border-rose-400/80 text-rose-300 shadow-lg shadow-rose-500/10";
  return "bg-white/5 border-white/10 text-[#e0e5e1]/60 hover:border-[#8ba99b]/30 hover:bg-[#8ba99b]/5";
};

const randomDifferent = <T,>(pool: T[], excluded: T): T => {
  const choices = pool.filter(value => value !== excluded);
  return choices[Math.floor(Math.random() * choices.length)] ?? pool[0];
};

const shuffled = <T,>(items: T[]) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

export default function App() {
  const [nLevel, setNLevel] = useState(2);
  const [speedSeconds, setSpeedSeconds] = useState(2.5);
  const [gameMode, setGameMode] = useState<GameMode>("dual");
  const [sessionLength, setSessionLength] = useState(24);

  const [sessionNLevel, setSessionNLevel] = useState(2);
  const [sessionSpeed, setSessionSpeed] = useState(2.5);
  const [sessionGameMode, setSessionGameMode] = useState<GameMode>("dual");
  const [sessionTrialCount, setSessionTrialCount] = useState(24);

  const [gameState, setGameState] = useState<GameState>("menu");
  const [gamePhase, setGamePhase] = useState<GamePhase>("idle");
  const [currentStep, setCurrentStep] = useState(0);
  const [sequence, setSequence] = useState<SequenceStep[]>([]);
  const [activePosition, setActivePosition] = useState<number | null>(null);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [isStimulusVisible, setIsStimulusVisible] = useState(false);

  const [userPressedPos, setUserPressedPos] = useState(false);
  const [userPressedAudio, setUserPressedAudio] = useState(false);
  const [userPressedColor, setUserPressedColor] = useState(false);
  const userPressedPosRef = useRef(false);
  const userPressedAudioRef = useRef(false);
  const userPressedColorRef = useRef(false);

  const [posBtnFeedback, setPosBtnFeedback] = useState<Feedback>("idle");
  const [audioBtnFeedback, setAudioBtnFeedback] = useState<Feedback>("idle");
  const [colorBtnFeedback, setColorBtnFeedback] = useState<Feedback>("idle");

  const [stats, setStats] = useState<MatchStats>(createEmptyStats);
  const statsRef = useRef<MatchStats>(createEmptyStats());
  const [history, setHistory] = useState<SessionRecord[]>(readHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [lastMetrics, setLastMetrics] = useState<SessionMetrics | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isSpeechMuted, setIsSpeechMuted] = useState(false);
  const [showVisualAssist, setShowVisualAssist] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState("");
  const [audioLoadFailed, setAudioLoadFailed] = useState(false);

  const [dontShowAgain, setDontShowAgain] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("nback_hide_tutorial") === "true";
  });
  const [showTutorial, setShowTutorial] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("nback_hide_tutorial") !== "true";
  });
  const [tutorialCanStart, setTutorialCanStart] = useState(true);
  const tutorialShouldResumeRef = useRef(false);

  const gameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stimulusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<GamePhase>("idle");
  const phaseStartedAtRef = useRef(0);
  const phaseDurationRef = useRef(0);
  const remainingTimeRef = useRef(0);
  const stimulusEndAtRef = useRef(0);
  const stimulusRemainingRef = useRef(0);
  const currentStepRef = useRef(0);
  const sequenceRef = useRef<SequenceStep[]>([]);
  const sessionNLevelRef = useRef(2);
  const sessionSpeedRef = useRef(2.5);
  const sessionGameModeRef = useRef<GameMode>("dual");
  const sessionTrialCountRef = useRef(24);
  const sessionSavedRef = useRef(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const boopBufferRef = useRef<AudioBuffer | null>(null);
  const calmVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  const setPhase = useCallback((phase: GamePhase) => {
    phaseRef.current = phase;
    setGamePhase(phase);
  }, []);

  const clearTimers = useCallback(() => {
    if (gameTimerRef.current) {
      clearTimeout(gameTimerRef.current);
      gameTimerRef.current = null;
    }
    if (stimulusTimerRef.current) {
      clearTimeout(stimulusTimerRef.current);
      stimulusTimerRef.current = null;
    }
  }, []);

  const updateStats = useCallback((updater: (previous: MatchStats) => MatchStats) => {
    const next = updater(statsRef.current);
    statsRef.current = next;
    setStats(next);
  }, []);

  useEffect(() => {
    const loadVoices = () => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      setSpeechAvailable(true);
      const voices = window.speechSynthesis.getVoices();
      setSpeechVoices(voices);
      const preferred = voices.find(voice =>
        voice.name.includes("Google US English") ||
        voice.name.includes("Samantha") ||
        voice.name.includes("Natural") ||
        voice.name.includes("Hazel") ||
        voice.name.includes("Zira")
      ) || voices.find(voice => voice.lang.startsWith("en")) || voices[0] || null;
      setSelectedVoiceName(current => current && voices.some(voice => voice.name === current) ? current : preferred?.name || "");
    };

    loadVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  useEffect(() => {
    calmVoiceRef.current = speechVoices.find(voice => voice.name === selectedVoiceName) || speechVoices[0] || null;
  }, [selectedVoiceName, speechVoices]);

  useEffect(() => {
    let active = true;
    const loadBoop = async () => {
      try {
        const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) {
          setAudioLoadFailed(true);
          return;
        }
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContextClass();
        const response = await fetch(boopSoundUrl);
        if (!response.ok) throw new Error(`Audio request failed: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        audioCtxRef.current.decodeAudioData(
          arrayBuffer,
          buffer => {
            if (active) boopBufferRef.current = buffer;
          },
          () => {
            if (active) setAudioLoadFailed(true);
          }
        );
      } catch {
        if (active) setAudioLoadFailed(true);
      }
    };
    loadBoop();
    return () => {
      active = false;
    };
  }, []);

  const playSynthSound = useCallback((type: "correct" | "wrong" | "start", pitchLevel = 0) => {
    if (isMuted) return;
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContextClass();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      const now = ctx.currentTime;

      if (type === "correct" && boopBufferRef.current) {
        const source = ctx.createBufferSource();
        source.buffer = boopBufferRef.current;
        source.playbackRate.value = pitchLevel >= 2 ? 1.4983 : pitchLevel === 1 ? 1.2599 : 1;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.7, now);
        source.connect(gain).connect(ctx.destination);
        source.start(now);
        return;
      }

      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      const oscillator = ctx.createOscillator();
      oscillator.type = type === "wrong" ? "triangle" : "sine";
      const frequency = type === "wrong" ? 160 : type === "start" ? 293.66 : 120 + pitchLevel * 30;
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(type === "start" ? 587.33 : frequency * 0.7, now + (type === "start" ? 0.15 : 0.12));
      oscillator.connect(gain);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(type === "wrong" ? 0.18 : 0.25, now + (type === "start" ? 0.06 : 0.002));
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (type === "start" ? 0.85 : 0.18));
      oscillator.start(now);
      oscillator.stop(now + (type === "start" ? 0.9 : 0.22));
    } catch {
      // Audio is optional; the visual game loop remains usable if it cannot start.
    }
  }, [isMuted]);

  const speakStimulusLetter = useCallback((letter: string) => {
    if (isSpeechMuted || !speechAvailable || typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(letter.toLowerCase());
      if (calmVoiceRef.current) utterance.voice = calmVoiceRef.current;
      utterance.rate = 0.9;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    } catch {
      // The visual letter fallback is available when speech cannot be used.
    }
  }, [isSpeechMuted, speechAvailable]);

  const previewSelectedVoice = () => {
    if (!speechAvailable || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("B, C, F");
    utterance.voice = calmVoiceRef.current;
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  };

  const generateTrialSequence = useCallback((length: number, level: number, mode: GameMode): SequenceStep[] => {
    const scorableTrials = Math.max(0, length - level);
    const targetCount = scorableTrials > 0 ? Math.max(1, Math.round(scorableTrials * 0.35)) : 0;
    const createSchedule = () => {
      const candidates = shuffled(Array.from({ length: scorableTrials }, (_, index) => index + level));
      const selected: number[] = [];
      for (const candidate of candidates) {
        if (selected.every(index => Math.abs(index - candidate) > 1)) selected.push(candidate);
        if (selected.length === targetCount) break;
      }
      if (selected.length < targetCount) {
        for (const candidate of candidates) {
          if (!selected.includes(candidate)) selected.push(candidate);
          if (selected.length === targetCount) break;
        }
      }
      return new Set(selected);
    };

    const positionTargets = createSchedule();
    const audioTargets = createSchedule();
    const colorTargets = createSchedule();
    const result: SequenceStep[] = [];

    for (let index = 0; index < length; index += 1) {
      const previous = index >= level ? result[index - level] : null;
      const positionPool = Array.from({ length: 9 }, (_, value) => value);
      const position = previous && positionTargets.has(index)
        ? previous.position
        : previous ? randomDifferent(positionPool, previous.position) : Math.floor(Math.random() * 9);
      const letter = previous && audioTargets.has(index)
        ? previous.letter
        : previous ? randomDifferent(LETTERS_POOL, previous.letter) : LETTERS_POOL[Math.floor(Math.random() * LETTERS_POOL.length)];
      let colorIndex = 0;
      if (mode === "triple") {
        if (previous && colorTargets.has(index)) {
          colorIndex = previous.colorIndex;
        } else if (previous) {
          const colorName = randomDifferent(COLORS_POOL.map(item => item.name), COLORS_POOL[previous.colorIndex].name);
          colorIndex = COLORS_POOL.findIndex(color => color.name === colorName);
        } else {
          colorIndex = Math.floor(Math.random() * COLORS_POOL.length);
        }
      }
      result.push({ position, letter, colorIndex: colorIndex < 0 ? 0 : colorIndex });
    }
    return result;
  }, []);

  const scheduleTimer = useCallback((duration: number, callback: () => void) => {
    gameTimerRef.current = setTimeout(() => {
      gameTimerRef.current = null;
      callback();
    }, duration);
  }, []);

  const resetTurnInputs = useCallback(() => {
    userPressedPosRef.current = false;
    userPressedAudioRef.current = false;
    userPressedColorRef.current = false;
    setUserPressedPos(false);
    setUserPressedAudio(false);
    setUserPressedColor(false);
    setPosBtnFeedback("idle");
    setAudioBtnFeedback("idle");
    setColorBtnFeedback("idle");
  }, []);

  const setFeedback = useCallback((type: MatchType, feedback: Feedback) => {
    if (type === "position") setPosBtnFeedback(feedback);
    if (type === "audio") setAudioBtnFeedback(feedback);
    if (type === "color") setColorBtnFeedback(feedback);
  }, []);

  const finalizeStepScore = useCallback((step: number, seq: SequenceStep[]) => {
    if (phaseRef.current !== "stimulus" || step < sessionNLevelRef.current) return;
    const level = sessionNLevelRef.current;
    const mode = sessionGameModeRef.current;
    const checks: Array<{ type: MatchType; matches: boolean; pressed: boolean }> = [
      {
        type: "position",
        matches: seq[step].position === seq[step - level].position,
        pressed: userPressedPosRef.current
      },
      {
        type: "audio",
        matches: seq[step].letter === seq[step - level].letter,
        pressed: userPressedAudioRef.current
      }
    ];
    if (mode === "triple") {
      checks.push({
        type: "color",
        matches: seq[step].colorIndex === seq[step - level].colorIndex,
        pressed: userPressedColorRef.current
      });
    }

    updateStats(previous => {
      const next: MatchStats = {
        position: { ...previous.position, reactionTimes: [...previous.position.reactionTimes] },
        audio: { ...previous.audio, reactionTimes: [...previous.audio.reactionTimes] },
        color: { ...previous.color, reactionTimes: [...previous.color.reactionTimes] }
      };
      checks.forEach(({ type, matches, pressed }) => {
        if (matches && !pressed) {
          next[type].missed += 1;
          setFeedback(type, "missed");
        } else if (!matches && !pressed) {
          next[type].correctReject += 1;
        }
      });
      return next;
    });
  }, [setFeedback, updateStats]);

  const triggerTurnCycle = useCallback((step: number, seq: SequenceStep[], speed: number) => {
    if (step >= sessionTrialCountRef.current) {
      endGameRef.current();
      return;
    }

    currentStepRef.current = step;
    setCurrentStep(step);
    resetTurnInputs();
    setActivePosition(seq[step].position);
    setActiveLetter(seq[step].letter);
    setIsStimulusVisible(true);
    setPhase("stimulus");
    phaseStartedAtRef.current = Date.now();
    phaseDurationRef.current = speed * 1000;
    remainingTimeRef.current = phaseDurationRef.current;
    const visibilityMs = Math.min(900, phaseDurationRef.current * 0.4);
    stimulusRemainingRef.current = visibilityMs;
    stimulusEndAtRef.current = Date.now() + visibilityMs;
    speakStimulusLetter(seq[step].letter);

    stimulusTimerRef.current = setTimeout(() => {
      stimulusTimerRef.current = null;
      setIsStimulusVisible(false);
      stimulusRemainingRef.current = 0;
    }, visibilityMs);

    scheduleTimer(phaseDurationRef.current, () => {
      finalizeStepScore(step, seq);
      setPhase("transition");
      phaseStartedAtRef.current = Date.now();
      phaseDurationRef.current = 500;
      remainingTimeRef.current = 500;
      scheduleTimer(500, () => triggerTurnCycle(step + 1, seq, speed));
    });
  }, [finalizeStepScore, resetTurnInputs, scheduleTimer, setPhase, speakStimulusLetter]);

  const endGameRef = useRef<() => void>(() => undefined);

  const startNewSession = useCallback(() => {
    clearTimers();
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    const newSequence = generateTrialSequence(sessionLength, nLevel, gameMode);
    sequenceRef.current = newSequence;
    setSequence(newSequence);
    sessionNLevelRef.current = nLevel;
    sessionSpeedRef.current = speedSeconds;
    sessionGameModeRef.current = gameMode;
    sessionTrialCountRef.current = sessionLength;
    setSessionNLevel(nLevel);
    setSessionSpeed(speedSeconds);
    setSessionGameMode(gameMode);
    setSessionTrialCount(sessionLength);
    currentStepRef.current = 0;
    setCurrentStep(0);
    statsRef.current = createEmptyStats();
    setStats(statsRef.current);
    setLastMetrics(null);
    sessionSavedRef.current = false;
    resetTurnInputs();
    setActivePosition(null);
    setActiveLetter(null);
    setIsStimulusVisible(false);
    setGameState("playing");
    setPhase("countdown");
    phaseStartedAtRef.current = Date.now();
    phaseDurationRef.current = 500;
    remainingTimeRef.current = 500;
    playSynthSound("start");
    scheduleTimer(500, () => triggerTurnCycle(0, newSequence, speedSeconds));
  }, [clearTimers, gameMode, generateTrialSequence, nLevel, playSynthSound, resetTurnInputs, scheduleTimer, sessionLength, setPhase, speedSeconds, triggerTurnCycle]);

  const pauseGame = useCallback(() => {
    if (gameState !== "playing" || phaseRef.current === "idle") return;
    const now = Date.now();
    remainingTimeRef.current = Math.max(50, phaseDurationRef.current - (now - phaseStartedAtRef.current));
    if (phaseRef.current === "stimulus") {
      stimulusRemainingRef.current = Math.max(0, stimulusEndAtRef.current - now);
    }
    clearTimers();
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    setGameState("paused");
  }, [clearTimers, gameState]);

  const resumeGame = useCallback(() => {
    if (gameState !== "paused") return;
    const phase = phaseRef.current;
    const remaining = remainingTimeRef.current;
    const seq = sequenceRef.current;
    const speed = sessionSpeedRef.current;
    setGameState("playing");

    if (phase === "countdown") {
      phaseStartedAtRef.current = Date.now();
      phaseDurationRef.current = remaining;
      scheduleTimer(remaining, () => triggerTurnCycle(0, seq, speed));
      return;
    }
    if (phase === "transition") {
      phaseStartedAtRef.current = Date.now();
      phaseDurationRef.current = remaining;
      scheduleTimer(remaining, () => triggerTurnCycle(currentStepRef.current + 1, seq, speed));
      return;
    }
    if (phase === "stimulus") {
      phaseStartedAtRef.current = Date.now();
      phaseDurationRef.current = remaining;
      remainingTimeRef.current = remaining;
      if (stimulusRemainingRef.current > 0) {
        setIsStimulusVisible(true);
        stimulusEndAtRef.current = Date.now() + stimulusRemainingRef.current;
        stimulusTimerRef.current = setTimeout(() => {
          stimulusTimerRef.current = null;
          setIsStimulusVisible(false);
          stimulusRemainingRef.current = 0;
        }, stimulusRemainingRef.current);
      } else {
        setIsStimulusVisible(false);
      }
      if (remaining > sessionSpeedRef.current * 1000 - 800 && activeLetter) speakStimulusLetter(activeLetter);
      scheduleTimer(remaining, () => {
        finalizeStepScore(currentStepRef.current, seq);
        setPhase("transition");
        phaseStartedAtRef.current = Date.now();
        phaseDurationRef.current = 500;
        remainingTimeRef.current = 500;
        scheduleTimer(500, () => triggerTurnCycle(currentStepRef.current + 1, seq, speed));
      });
    }
  }, [activeLetter, finalizeStepScore, gameState, scheduleTimer, setPhase, speakStimulusLetter, triggerTurnCycle]);

  const saveSessionToHistory = useCallback((finalStats: MatchStats) => {
    const metrics = calculateMetrics(finalStats, sessionTrialCountRef.current, sessionNLevelRef.current, sessionGameModeRef.current, sessionSpeedRef.current);
    const record: SessionRecord = {
      id: Date.now(),
      completedAt: new Date().toISOString(),
      nLevel: sessionNLevelRef.current,
      speed: sessionSpeedRef.current,
      gameMode: sessionGameModeRef.current,
      sessionLength: sessionTrialCountRef.current,
      accuracy: metrics.accuracy,
      performanceScore: metrics.performanceScore,
      hitRate: metrics.hitRate,
      falseAlarmRate: metrics.falseAlarmRate,
      averageReactionMs: metrics.averageReactionMs,
      reactionScore: metrics.reactionScore,
      stats: {
        position: toHistoryStats(finalStats.position),
        audio: toHistoryStats(finalStats.audio),
        color: toHistoryStats(finalStats.color)
      }
    };
    setHistory(previous => {
      const next = [record, ...previous].slice(0, MAX_HISTORY_ITEMS);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        // History is a convenience; a storage quota error should not stop results.
      }
      return next;
    });
    return metrics;
  }, []);

  const endGame = useCallback(() => {
    if (gameState === "complete" || sessionSavedRef.current) return;
    sessionSavedRef.current = true;
    clearTimers();
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    const metrics = saveSessionToHistory(statsRef.current);
    setLastMetrics(metrics);
    setPhase("idle");
    setGameState("complete");
    setIsStimulusVisible(false);
    setActivePosition(null);
    setActiveLetter(null);
  }, [clearTimers, gameState, saveSessionToHistory, setPhase]);

  endGameRef.current = endGame;

  const resetToMenu = useCallback(() => {
    clearTimers();
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    setPhase("idle");
    setGameState("menu");
    setActivePosition(null);
    setActiveLetter(null);
    setIsStimulusVisible(false);
  }, [clearTimers, setPhase]);

  const submitMatch = useCallback((type: MatchType) => {
    if (gameState !== "playing" || phaseRef.current !== "stimulus") return;
    const step = currentStepRef.current;
    const level = sessionNLevelRef.current;
    if (step < level) return;
    const alreadyPressed = type === "position" ? userPressedPosRef.current : type === "audio" ? userPressedAudioRef.current : userPressedColorRef.current;
    if (alreadyPressed) return;

    if (type === "position") {
      userPressedPosRef.current = true;
      setUserPressedPos(true);
    } else if (type === "audio") {
      userPressedAudioRef.current = true;
      setUserPressedAudio(true);
    } else {
      userPressedColorRef.current = true;
      setUserPressedColor(true);
    }

    const current = sequenceRef.current[step];
    const previous = sequenceRef.current[step - level];
    const matches = type === "position"
      ? current.position === previous.position
      : type === "audio"
        ? current.letter === previous.letter
        : current.colorIndex === previous.colorIndex;
    const reactionTime = Math.max(0, Date.now() - phaseStartedAtRef.current);
    setFeedback(type, matches ? "correct" : "wrong");
    updateStats(previousStats => {
      const next: MatchStats = {
        position: { ...previousStats.position, reactionTimes: [...previousStats.position.reactionTimes] },
        audio: { ...previousStats.audio, reactionTimes: [...previousStats.audio.reactionTimes] },
        color: { ...previousStats.color, reactionTimes: [...previousStats.color.reactionTimes] }
      };
      if (matches) {
        next[type].right += 1;
        next[type].reactionTimes.push(reactionTime);
      } else {
        next[type].wrong += 1;
      }
      return next;
    });

    const correctResponses = [
      type === "position" ? matches : userPressedPosRef.current && current.position === previous.position,
      type === "audio" ? matches : userPressedAudioRef.current && current.letter === previous.letter,
      sessionGameModeRef.current === "triple" && (type === "color" ? matches : userPressedColorRef.current && current.colorIndex === previous.colorIndex)
    ].filter(Boolean).length;
    playSynthSound(matches ? "correct" : "wrong", correctResponses - 1);
  }, [gameState, playSynthSound, setFeedback, updateStats]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "p" || key === "escape") {
        if (showTutorial) return;
        if (gameState === "playing") pauseGame();
        else if (gameState === "paused") resumeGame();
        return;
      }
      if (gameState !== "playing" || phaseRef.current !== "stimulus") return;
      if (key === "a") submitMatch("audio");
      if (key === "l") submitMatch("position");
      if (sessionGameModeRef.current === "triple" && ["d", "s", "c"].includes(key)) submitMatch("color");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState, pauseGame, resumeGame, showTutorial, submitMatch]);

  const handleToggleDontShowAgain = (checked: boolean) => {
    setDontShowAgain(checked);
    if (typeof window !== "undefined") {
      if (checked) localStorage.setItem("nback_hide_tutorial", "true");
      else localStorage.removeItem("nback_hide_tutorial");
    }
  };

  const closeTutorial = () => {
    setShowTutorial(false);
    if (tutorialShouldResumeRef.current) {
      tutorialShouldResumeRef.current = false;
      resumeGame();
    }
  };

  const openTutorial = () => {
    const wasPlaying = gameState === "playing";
    if (wasPlaying) {
      pauseGame();
      tutorialShouldResumeRef.current = true;
    }
    setTutorialCanStart(gameState === "menu");
    setShowTutorial(true);
  };

  const clearHistory = () => {
    setHistory([]);
    if (typeof window !== "undefined") localStorage.removeItem(HISTORY_KEY);
  };

  const metrics = lastMetrics ?? calculateMetrics(stats, sessionTrialCount, sessionNLevel, sessionGameMode, sessionSpeed);
  const tierScore = metrics.performanceScore;
  const getZenTier = (score: number) => {
    if (score >= 90) return { title: "Satori Level (Pure Enlightenment)", desc: "Flawless coordination with quick, precise responses.", color: "text-[#8ba99b]", bg: "bg-[#8ba99b]/10 border-[#8ba99b]/25", badge: "Enlivened" };
    if (score >= 75) return { title: "Deep Presence (Lotus Mind)", desc: "Calm and steady focus with strong response control.", color: "text-[#8ba99b]/90", bg: "bg-[#8ba99b]/5 border-[#8ba99b]/20", badge: "Serene" };
    if (score >= 50) return { title: "Zazen State (Steady Zen)", desc: "A solid foundation. More consistent timing will strengthen the practice.", color: "text-[#d4a373]", bg: "bg-[#d4a373]/10 border-[#d4a373]/25", badge: "Grounded" };
    return { title: "Floating Leaf (Gentle Practice)", desc: "Keep the pace comfortable and focus on clean responses before speeding up.", color: "text-rose-400/90", bg: "bg-rose-500/5 border-rose-500/20", badge: "Flowing" };
  };
  const tier = getZenTier(tierScore);
  const isWarmup = currentStep < sessionNLevel;
  const isStimulusPhase = gameState === "playing" && gamePhase === "stimulus";
  const speechReady = speechAvailable && speechVoices.length > 0;
  const showLetters = showVisualAssist || !speechReady;

  const renderMatchButton = (type: MatchType, label: string, key: string, pressed: boolean, feedback: Feedback) => (
    <button
      onClick={() => submitMatch(type)}
      disabled={!isStimulusPhase || isWarmup || pressed}
      className={`flex-1 py-4 md:py-5 lg:py-6 rounded-2xl border flex flex-col items-center justify-center backdrop-blur-md transition-all duration-300 relative overflow-hidden ${( !isStimulusPhase || isWarmup || pressed) ? "opacity-30 cursor-not-allowed" : "cursor-pointer"} ${feedbackStyles(feedback)}`}
    >
      <span className="text-[10px] sm:text-xs md:text-sm lg:text-base font-semibold uppercase tracking-wider">{label}</span>
      <kbd className={`mt-1 px-2.5 py-0.5 rounded-lg text-[10px] sm:text-xs md:text-sm lg:text-base font-bold font-mono transition-all uppercase tracking-widest ${feedback === "correct" ? "bg-[#8ba99b] text-[#1a1f1d]" : feedback === "wrong" ? "bg-[#d4a373] text-[#1a1f1d]" : feedback === "missed" ? "bg-rose-400 text-[#1a1f1d]" : "bg-white/10 text-white/80"}`}>{key}</kbd>
      {feedback !== "idle" && <span className="mt-1 text-[9px] uppercase tracking-wide font-bold">{feedbackLabel(feedback)}</span>}
    </button>
  );

  return (
    <div id="zen-nback-root" className="relative min-h-screen w-full flex flex-col justify-between items-center text-[#e0e5e1] overflow-x-hidden py-6 px-4 md:px-8 selection:bg-[#8ba99b]/30 select-none">
      <div className="absolute inset-0 bg-[#0c0f0e] -z-20 overflow-hidden">
        <div className="absolute inset-0 opacity-40 pointer-events-none mix-blend-screen filter blur-[120px]">
          <motion.div className="absolute top-[20%] left-[20%] w-[350px] h-[350px] rounded-full" animate={{ x: [0, 80, -40, 0], y: [0, -60, 50, 0], backgroundColor: ["rgba(139, 169, 155, 0.15)", "rgba(212, 163, 115, 0.12)", "rgba(191, 165, 154, 0.15)", "rgba(139, 169, 155, 0.15)"] }} transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }} />
          <motion.div className="absolute bottom-[25%] right-[15%] w-[400px] h-[400px] rounded-full" animate={{ x: [0, -90, 60, 0], y: [0, 80, -70, 0], backgroundColor: ["rgba(155, 168, 189, 0.15)", "rgba(201, 155, 155, 0.12)", "rgba(189, 170, 138, 0.15)", "rgba(155, 168, 189, 0.15)"] }} transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }} />
          <motion.div className="absolute top-[60%] left-[10%] w-[300px] h-[300px] rounded-full" animate={{ x: [0, 100, -50, 0], y: [0, -80, 60, 0], backgroundColor: ["rgba(212, 163, 115, 0.12)", "rgba(139, 169, 155, 0.15)", "rgba(155, 168, 189, 0.12)", "rgba(212, 163, 115, 0.12)"] }} transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }} />
          <motion.div className="absolute top-[10%] right-[25%] w-[320px] h-[320px] rounded-full" animate={{ x: [0, -70, 80, 0], y: [0, 90, -40, 0], backgroundColor: ["rgba(201, 155, 155, 0.12)", "rgba(189, 170, 138, 0.15)", "rgba(139, 169, 155, 0.12)", "rgba(201, 155, 155, 0.12)"] }} transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }} />
        </div>
      </div>

      <header className="w-full max-w-lg md:max-w-xl lg:max-w-3xl xl:max-w-4xl flex items-center justify-between z-10 mb-4 px-2 md:px-4">
        <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-[#8ba99b] to-[#a8c1b5] bg-clip-text text-transparent">N-Back</h1>
        <div className="flex items-center gap-2">
          <button onClick={openTutorial} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 text-xs font-medium text-[#e0e5e1]/80 hover:text-[#8ba99b] hover:border-[#8ba99b]/30 hover:bg-[#8ba99b]/5 transition-all duration-300 cursor-pointer" title="How to Play Tutorial">
            <HelpCircle className="w-3.5 h-3.5 text-[#8ba99b]" />
            <span className="hidden sm:inline">How to Play</span>
          </button>
          <button onClick={() => setIsSpeechMuted(value => !value)} className={`p-2 rounded-xl transition-all duration-300 border ${isSpeechMuted ? "border-rose-500/30 text-rose-400 bg-rose-500/5" : "border-white/5 text-[#e0e5e1]/60 hover:text-[#e0e5e1] hover:bg-white/5"}`} title={isSpeechMuted ? "Unmute spoken letters" : "Mute spoken letters"}>
            {isSpeechMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => setIsMuted(value => !value)} className={`p-2 rounded-xl transition-all duration-300 border ${isMuted ? "border-rose-500/30 text-rose-400 bg-rose-500/5" : "border-white/5 text-[#e0e5e1]/60 hover:text-[#e0e5e1] hover:bg-white/5"}`} title={isMuted ? "Unmute feedback chimes" : "Mute feedback chimes"}>
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      <main className="w-full max-w-lg md:max-w-xl lg:max-w-3xl xl:max-w-4xl flex flex-col items-center justify-center my-auto py-2 z-10">
        <div className="w-full relative px-2 py-4 md:py-6">
          {gameState === "playing" && <div className="absolute top-4 right-4 z-20"><button onClick={pauseGame} className="p-2.5 rounded-xl bg-[#1a1f1d]/50 border border-white/5 hover:border-[#8ba99b]/30 text-[#e0e5e1]/60 hover:text-[#8ba99b] hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center" title="Pause (P or Esc)"><Pause className="w-4 h-4" /></button></div>}

          <AnimatePresence mode="wait">
            {gameState === "menu" && (
              <motion.div key="menu" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col items-center text-center py-4">
                <div className="w-full space-y-4 md:space-y-6 max-w-sm md:max-w-md lg:max-w-xl mb-6 bg-[#2e3733]/40 rounded-3xl p-4 md:p-6 lg:p-8 border border-white/5">
                  <div className="flex flex-col gap-1.5 pb-2 border-b border-white/5 text-left">
                    <span className="text-[#6e847c] font-mono text-xs uppercase tracking-wider">Training Mode:</span>
                    <div className="flex gap-2 mt-1">
                      {(["dual", "triple"] as GameMode[]).map(mode => <button key={mode} onClick={() => setGameMode(mode)} className={`flex-1 py-1.5 px-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer whitespace-nowrap ${gameMode === mode ? "bg-[#8ba99b] text-[#1a1f1d] shadow-md shadow-[#8ba99b]/20 font-bold" : "bg-[#2e3733] border border-white/5 text-[#6e847c] hover:text-[#e0e5e1] hover:bg-white/5"}`}>{mode === "dual" ? "Dual (Pos + Aud)" : "Triple (+ Color)"}</button>)}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 text-left">
                    <div className="flex justify-between text-xs"><span className="text-[#6e847c] font-mono uppercase tracking-wider">Memory Depth:</span><span className="font-mono font-bold text-[#8ba99b] bg-[#8ba99b]/10 px-2 py-0.5 rounded-md">{nLevel}-Back</span></div>
                    <div className="grid grid-cols-4 gap-1 md:gap-2 mt-1">{Array.from({ length: 8 }, (_, index) => index + 1).map(value => <button key={value} onClick={() => setNLevel(value)} className={`py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${nLevel === value ? "bg-[#8ba99b] text-[#1a1f1d] shadow-md shadow-[#8ba99b]/20 font-bold" : "bg-[#2e3733] border border-white/5 text-[#6e847c] hover:text-[#e0e5e1] hover:bg-white/5"}`}>{value}</button>)}</div>
                  </div>

                  <div className="flex flex-col gap-1.5 text-left">
                    <div className="flex justify-between text-xs"><span className="text-[#6e847c] font-mono uppercase tracking-wider">Session Length:</span><span className="font-mono font-bold text-[#8ba99b] bg-[#8ba99b]/10 px-2 py-0.5 rounded-md">{sessionLength} trials</span></div>
                    <div className="grid grid-cols-4 gap-1 md:gap-2 mt-1">{[12, 24, 36, 48].map(value => <button key={value} onClick={() => setSessionLength(value)} className={`py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${sessionLength === value ? "bg-[#8ba99b] text-[#1a1f1d] shadow-md shadow-[#8ba99b]/20 font-bold" : "bg-[#2e3733] border border-white/5 text-[#6e847c] hover:text-[#e0e5e1] hover:bg-white/5"}`}>{value}</button>)}</div>
                    <p className="text-[10px] text-[#6e847c] font-mono">Longer sessions provide a more stable score.</p>
                  </div>

                  <div className="flex flex-col gap-1.5 pt-2">
                    <div className="flex justify-between items-center text-xs"><span className="text-[#6e847c] font-mono uppercase tracking-wider">Interval Speed:</span><span className="font-mono font-bold text-[#d4a373] bg-[#d4a373]/10 px-2 py-0.5 rounded-md">{formatSpeed(speedSeconds)}s</span></div>
                    <input aria-label="Interval speed" type="range" min="1.5" max="4.0" step="0.1" value={speedSeconds} onChange={event => setSpeedSeconds(parseFloat(event.target.value))} className="w-full accent-[#8ba99b] cursor-pointer h-1.5 bg-[#1a1f1d] rounded-lg appearance-none" />
                    <div className="flex justify-between text-[10px] md:text-xs text-[#6e847c] font-mono"><span>1.5s (Fast)</span><span>4.0s (Relaxed)</span></div>
                  </div>

                  {speechAvailable && speechVoices.length > 0 && <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                    <label className="text-[#6e847c] font-mono text-[10px] uppercase tracking-wider shrink-0" htmlFor="voice-select">Voice:</label>
                    <select id="voice-select" value={selectedVoiceName} onChange={event => setSelectedVoiceName(event.target.value)} className="min-w-0 flex-1 bg-[#1a1f1d] border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-[#e0e5e1]">
                      {speechVoices.map(voice => <option key={`${voice.name}-${voice.lang}`} value={voice.name}>{voice.name} ({voice.lang})</option>)}
                    </select>
                    <button onClick={previewSelectedVoice} className="shrink-0 px-2.5 py-1.5 rounded-lg bg-[#2e3733] border border-white/10 text-[#8ba99b] text-[10px] font-semibold hover:bg-white/5 flex items-center gap-1"><Play className="w-3 h-3 fill-current" />Test</button>
                  </div>}

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                    <button onClick={() => setShowVisualAssist(value => !value)} className={`flex-1 min-w-[140px] py-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${showVisualAssist ? "border-[#8ba99b]/40 bg-[#8ba99b]/10 text-[#8ba99b]" : "border-white/10 text-[#6e847c] hover:bg-white/5"}`}>{showVisualAssist ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}Letters: {showVisualAssist ? "On" : "Off"}</button>
                    <button onClick={() => setShowHistory(value => !value)} className={`flex-1 min-w-[140px] py-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${showHistory ? "border-[#8ba99b]/40 bg-[#8ba99b]/10 text-[#8ba99b]" : "border-white/10 text-[#6e847c] hover:bg-white/5"}`}><HistoryIcon className="w-3.5 h-3.5" />History ({history.length})</button>
                  </div>
                  {!speechReady && <p className="text-left text-[10px] text-[#d4a373] font-mono">No speech voice is available. Letters will be shown visually during play.</p>}
                  {audioLoadFailed && <p className="text-left text-[10px] text-[#d4a373] font-mono">Feedback chime unavailable. The game will continue silently.</p>}
                </div>

                <div className="w-full max-w-xs md:max-w-sm lg:max-w-md flex flex-col sm:flex-row gap-2.5">
                  <button onClick={openTutorial} className="flex-1 py-3.5 md:py-4 px-4 rounded-2xl bg-[#2e3733] hover:bg-white/5 border border-white/10 text-[#e0e5e1] font-semibold text-xs md:text-sm transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"><HelpCircle className="w-4 h-4 text-[#8ba99b]" />How to Play</button>
                  <button onClick={startNewSession} className="flex-[2] py-3.5 md:py-4 lg:py-5 px-6 rounded-2xl bg-[#8ba99b] text-[#1a1f1d] font-bold tracking-widest uppercase text-sm md:text-base shadow-lg shadow-[#8ba99b]/20 hover:shadow-[#8ba99b]/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"><Play className="w-4 h-4 fill-[#1a1f1d]" />Start</button>
                </div>

                {showHistory && <div className="w-full max-w-sm md:max-w-md lg:max-w-xl mt-5 bg-[#2e3733]/30 rounded-2xl border border-white/5 p-4 text-left">
                  <div className="flex items-center justify-between mb-3"><div><h3 className="text-xs font-bold uppercase tracking-wider text-[#e0e5e1]">Recent Sessions</h3><p className="text-[10px] text-[#6e847c] font-mono">Stored on this device</p></div>{history.length > 0 && <button onClick={clearHistory} className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1"><Trash2 className="w-3 h-3" />Clear</button>}</div>
                  {history.length === 0 ? <p className="text-xs text-[#6e847c] py-2">Complete a session to start building your history.</p> : <div className="space-y-2">{history.slice(0, 5).map(record => <div key={record.id} className="flex items-center justify-between gap-2 rounded-xl bg-[#1a1f1d]/60 px-3 py-2"><div><div className="text-xs font-semibold text-[#e0e5e1]">{record.performanceScore} score <span className="text-[#6e847c] font-normal">· {record.nLevel}-Back {record.gameMode}</span></div><div className="text-[10px] text-[#6e847c] font-mono">{new Date(record.completedAt).toLocaleDateString()} · {record.sessionLength} trials · {formatReaction(record.averageReactionMs)}</div></div><div className="text-right text-[10px] font-mono"><div className="text-[#8ba99b]">{record.accuracy}% accuracy</div><div className="text-[#d4a373]">{record.falseAlarmRate}% false alarms</div></div></div>)}</div>}
                </div>}
              </motion.div>
            )}

            {gameState === "paused" && <motion.div key="paused" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="flex flex-col items-center text-center py-6"><div className="w-12 h-12 rounded-2xl bg-[#2e3733] border border-white/5 flex items-center justify-center mb-3"><Pause className="w-5 h-5 text-[#8ba99b]" /></div><h2 className="text-xl font-bold text-[#8ba99b] mb-1">Paused</h2><p className="text-xs text-[#6e847c] max-w-xs mb-8 font-mono uppercase tracking-wider">Trial {Math.min(currentStep + 1, sessionTrialCount)} of {sessionTrialCount} · {sessionNLevel}-Back {sessionGameMode.toUpperCase()}</p><div className="w-full max-w-xs md:max-w-sm flex flex-col gap-2.5"><button onClick={resumeGame} className="w-full py-3 px-5 rounded-xl bg-[#8ba99b] hover:bg-[#a8c1b5] text-[#1a1f1d] font-bold tracking-widest uppercase shadow-md shadow-[#8ba99b]/15 transition-colors flex items-center justify-center gap-1.5 text-xs cursor-pointer"><Play className="w-3.5 h-3.5 fill-[#1a1f1d]" />Resume</button><button onClick={startNewSession} className="w-full py-3 px-5 rounded-xl font-bold uppercase tracking-widest bg-[#2e3733] hover:bg-white/5 text-[#e0e5e1] border border-white/5 transition-colors flex items-center justify-center gap-1.5 text-xs cursor-pointer"><RotateCcw className="w-3.5 h-3.5" />Restart Session</button><button onClick={resetToMenu} className="w-full py-3 px-5 rounded-xl bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 border border-rose-500/25 font-semibold transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer"><X className="w-3.5 h-3.5" />Exit to Menu</button></div></motion.div>}

            {gameState === "complete" && <motion.div key="complete" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-[#8ba99b]/10 border border-[#8ba99b]/20 flex items-center justify-center mb-3"><Award className="w-7 h-7 text-[#8ba99b]" /></div>
              <span className="text-[10px] font-mono tracking-widest text-[#8ba99b] uppercase font-semibold">Session Completed</span>
              <h2 className="text-2xl font-serif italic text-[#8ba99b] mt-0.5 mb-5">Training Summary</h2>
              <div className="relative w-36 h-36 md:w-44 md:h-44 flex items-center justify-center mb-6"><svg className="w-full h-full -rotate-90" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" className="stroke-[#2e3733] fill-none" strokeWidth="6" /><motion.circle cx="50" cy="50" r="40" className="stroke-[#8ba99b] fill-none" strokeWidth="6" strokeLinecap="round" initial={{ strokeDasharray: "251.2", strokeDashoffset: "251.2" }} animate={{ strokeDashoffset: String(251.2 - (251.2 * tierScore) / 100) }} transition={{ duration: 1.2, ease: "easeOut" }} /></svg><div className="absolute text-center"><span className="text-3xl md:text-4xl font-mono font-bold text-[#e0e5e1]">{tierScore}</span><p className="text-[9px] md:text-[10px] uppercase tracking-wider text-[#6e847c] font-mono mt-0.5">Training Score</p></div></div>
              <div className={`w-full ${tier.bg} border rounded-2xl p-4 md:p-5 text-center mb-5 max-w-sm md:max-w-md lg:max-w-lg`}><span className="text-xs font-bold text-[#e0e5e1] uppercase tracking-wide">{tier.badge}</span><h4 className={`text-sm font-bold font-serif italic ${tier.color} mt-1`}>{tier.title}</h4><p className="text-[11px] text-[#e0e5e1]/80 mt-1.5 leading-relaxed">{tier.desc}</p></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full max-w-sm md:max-w-lg mb-5"><div className="rounded-xl bg-[#2e3733]/40 border border-white/5 p-3 text-center"><BarChart3 className="w-4 h-4 mx-auto mb-1 text-[#8ba99b]" /><div className="text-lg font-mono font-bold">{metrics.accuracy}%</div><div className="text-[9px] uppercase text-[#6e847c]">Accuracy</div></div><div className="rounded-xl bg-[#2e3733]/40 border border-white/5 p-3 text-center"><Check className="w-4 h-4 mx-auto mb-1 text-[#8ba99b]" /><div className="text-lg font-mono font-bold">{metrics.hitRate}%</div><div className="text-[9px] uppercase text-[#6e847c]">Hit Rate</div></div><div className="rounded-xl bg-[#2e3733]/40 border border-white/5 p-3 text-center"><Clock3 className="w-4 h-4 mx-auto mb-1 text-[#d4a373]" /><div className="text-lg font-mono font-bold">{formatReaction(metrics.averageReactionMs)}</div><div className="text-[9px] uppercase text-[#6e847c]">Avg Reaction</div></div><div className="rounded-xl bg-[#2e3733]/40 border border-white/5 p-3 text-center"><Clock3 className="w-4 h-4 mx-auto mb-1 text-[#d4a373]" /><div className="text-lg font-mono font-bold">{metrics.reactionScore}</div><div className="text-[9px] uppercase text-[#6e847c]">Reaction Score</div></div></div>
              <div className="w-full max-w-sm md:max-w-md lg:max-w-lg bg-[#2e3733]/30 rounded-2xl border border-white/5 overflow-hidden mb-6 text-xs"><div className="grid grid-cols-5 bg-[#2e3733]/80 text-[9px] text-[#6e847c] font-mono uppercase tracking-wider font-semibold py-2 px-3 border-b border-white/5 text-center"><div className="text-left">Type</div><div className="text-[#8ba99b]">Right</div><div className="text-[#d4a373]">False</div><div className="text-rose-400">Missed</div><div className="text-[#6e847c]">Reject</div></div><div className="divide-y divide-white/5 px-3 py-1">{(["position", "audio", ...(sessionGameMode === "triple" ? ["color"] : [])] as MatchType[]).map(type => <div key={type} className="grid grid-cols-5 py-2.5 text-center items-center"><div className="text-left font-semibold text-[#e0e5e1]/90">{type === "position" ? "Spatial" : type === "audio" ? "Audio" : "Color"}</div><div className="font-mono text-[#8ba99b]">{stats[type].right}</div><div className="font-mono text-[#d4a373]">{stats[type].wrong}</div><div className="font-mono text-rose-400/90">{stats[type].missed}</div><div className="font-mono text-[#6e847c]">{stats[type].correctReject}</div></div>)}</div><div className="bg-[#1a1f1d]/50 py-2.5 px-3 border-t border-white/5 flex flex-wrap justify-between gap-2 text-[10px] text-[#6e847c]"><span>Mode: <strong className="text-[#e0e5e1] uppercase">{sessionGameMode}</strong></span><span>Level: <strong className="text-[#e0e5e1]">{sessionNLevel}-Back</strong></span><span>Trials: <strong className="text-[#e0e5e1]">{sessionTrialCount}</strong></span><span>False alarms: <strong className="text-[#d4a373]">{metrics.falseAlarmRate}%</strong></span></div></div>
              <div className="w-full max-w-sm md:max-w-md lg:max-w-lg flex gap-3"><button onClick={resetToMenu} className="flex-1 py-3 px-5 rounded-xl border border-white/5 hover:border-white/10 text-[#e0e5e1]/80 font-medium hover:bg-white/5 transition-all text-xs cursor-pointer">Adjust Settings</button><button onClick={startNewSession} className="flex-1 py-3 px-5 rounded-xl bg-[#8ba99b] hover:bg-[#a8c1b5] text-[#1a1f1d] font-bold shadow-md shadow-[#8ba99b]/25 transition-all text-xs cursor-pointer uppercase tracking-wider">Practice Again</button></div>
            </motion.div>}

            {gameState === "playing" && <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
              <div className="w-full max-w-lg mb-5 text-center text-[#6e847c]/80 text-[10px] md:text-xs font-mono uppercase tracking-widest select-none"><div className="flex items-center justify-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${gamePhase === "stimulus" ? "bg-[#8ba99b] animate-pulse" : "bg-[#d4a373]"}`} /><span>Trial {Math.min(currentStep + 1, sessionTrialCount)} / {sessionTrialCount} · {sessionNLevel}-Back {sessionGameMode.toUpperCase()}</span></div><div className="h-1.5 bg-[#2e3733] rounded-full mt-3 overflow-hidden"><motion.div className="h-full bg-[#8ba99b]" animate={{ width: `${((currentStep + (gamePhase === "transition" ? 1 : 0)) / sessionTrialCount) * 100}%` }} /></div><p className="mt-2 text-[#8ba99b]">{gamePhase === "countdown" ? "Get ready…" : gamePhase === "transition" ? "Next trial…" : isWarmup ? `Warm-up: responses begin on trial ${sessionNLevel + 1}` : "Respond only when the current stimulus matches N steps ago"}</p></div>
              <div className="grid grid-cols-3 gap-3 md:gap-5 lg:gap-6 w-full aspect-square max-w-[280px] sm:max-w-[320px] md:max-w-[400px] lg:max-w-[480px] xl:max-w-[560px] mb-6 md:mb-8 lg:mb-10 relative">{Array.from({ length: 9 }).map((_, index) => { const isActive = activePosition === index && isStimulusVisible; const currentItem = sequence[currentStep]; const activeColor = COLORS_POOL[currentItem?.colorIndex ?? 0] ?? COLORS_POOL[0]; return <div key={index} className="relative aspect-square w-full rounded-2xl border border-white/5 bg-[#2e3733]/50 backdrop-blur-sm flex items-center justify-center overflow-hidden transition-all duration-300">{isActive && <motion.div layoutId="activeGlow" className="absolute inset-0 rounded-2xl flex items-center justify-center z-10 border" style={{ backgroundColor: activeColor.hex, borderColor: activeColor.border, boxShadow: `0 0 40px ${activeColor.hex}66` }} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1, ease: "easeOut" }}><div className="w-3 h-3 md:w-4 lg:w-5 lg:h-5 rounded-full bg-[#1a1f1d]/20 blur-[0.5px] border border-white/20" />{showLetters && activeLetter && <span className="absolute text-[#1a1f1d] font-mono text-sm md:text-base lg:text-xl xl:text-2xl font-bold z-20">{activeLetter}</span>}</motion.div>}<div className="w-1.5 h-1.5 md:w-2 lg:w-2.5 lg:h-2.5 rounded-full bg-[#1a1f1d]/30" /></div>; })}</div>
              <div className="w-full flex justify-between gap-2.5 md:gap-4 lg:gap-6 select-none mt-4 max-w-sm md:max-w-md lg:max-w-xl xl:max-w-2xl mx-auto"><>{renderMatchButton("audio", "Audio", "A", userPressedAudio, audioBtnFeedback)}</>{sessionGameMode === "triple" && renderMatchButton("color", "Color", "D", userPressedColor, colorBtnFeedback)}{renderMatchButton("position", "Position", "L", userPressedPos, posBtnFeedback)}</div>
            </motion.div>}
          </AnimatePresence>
        </div>
      </main>

      <TutorialModal isOpen={showTutorial} onClose={closeTutorial} dontShowAgain={dontShowAgain} onToggleDontShowAgain={handleToggleDontShowAgain} onStartGame={startNewSession} canStartGame={tutorialCanStart} gameMode={gameState === "menu" ? gameMode : sessionGameMode} />
    </div>
  );
}
