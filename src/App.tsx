/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Info,
  Check,
  Award,
  Sliders,
  Sparkles,
  RefreshCw,
  HelpCircle,
  TrendingUp,
  X,
  Lock,
  Unlock,
  CornerDownRight
} from "lucide-react";

// @ts-ignore
import boopSoundUrl from "./boop.mp3";
import { TutorialModal } from "./components/TutorialModal";

// Types
interface CategoryStats {
  right: number;
  wrong: number;
  missed: number;
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

const LETTERS_POOL = ["B", "C", "F", "H", "J", "M", "R", "T", "O", "W"];

const COLORS_POOL = [
  { name: "Green", hex: "#5da38a", border: "#7fbda5" },
  { name: "Amber", hex: "#dfa15f", border: "#f2bf8a" },
  { name: "Lavender", hex: "#7297cc", border: "#9fc0ee" },
  { name: "Rose", hex: "#cc7e8a", border: "#eba4ae" }
];

const getGridPositionCoords = (index: number) => {
  const row = Math.floor(index / 3);
  const col = index % 3;
  // Map center of each cell roughly to screen percentages (since container is max-w-lg and centered)
  const x = 50 + (col - 1) * 22; // 28%, 50%, 72%
  const y = 46 + (row - 1) * 22; // 24%, 46%, 68%
  return { x: `${x}%`, y: `${y}%` };
};

export default function App() {
  // Helper to format speed seconds cleanly (always showing 1 decimal place, e.g. 2.0s)
  const formatSpeed = (val: number) => {
    return val.toFixed(1);
  };

  // Game parameters
  const [nLevel, setNLevel] = useState<number>(2);
  const [speedSeconds, setSpeedSeconds] = useState<number>(2.5);
  const [gameMode, setGameMode] = useState<"dual" | "triple">("dual");
  const totalSteps = 24;

  // Session tracking parameters (locked during gameplay)
  const [sessionNLevel, setSessionNLevel] = useState<number>(2);
  const [sessionSpeed, setSessionSpeed] = useState<number>(2.5);
  const [sessionGameMode, setSessionGameMode] = useState<"dual" | "triple">("dual");

  // States
  const [gameState, setGameState] = useState<"menu" | "readying" | "playing" | "paused" | "complete">("menu");
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [sequence, setSequence] = useState<SequenceStep[]>([]);
  
  const [activePosition, setActivePosition] = useState<number | null>(null);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [isStimulusVisible, setIsStimulusVisible] = useState<boolean>(false);

  // User input states per step
  const [userPressedPos, setUserPressedPos] = useState<boolean>(false);
  const [userPressedAudio, setUserPressedAudio] = useState<boolean>(false);
  const [userPressedColor, setUserPressedColor] = useState<boolean>(false);

  const userPressedPosRef = useRef<boolean>(false);
  const userPressedAudioRef = useRef<boolean>(false);
  const userPressedColorRef = useRef<boolean>(false);
  
  const [posBtnFeedback, setPosBtnFeedback] = useState<"idle" | "correct" | "wrong">("idle");
  const [audioBtnFeedback, setAudioBtnFeedback] = useState<"idle" | "correct" | "wrong">("idle");
  const [colorBtnFeedback, setColorBtnFeedback] = useState<"idle" | "correct" | "wrong">("idle");

  // Cumulative statistics
  const [stats, setStats] = useState<MatchStats>({
    position: { right: 0, wrong: 0, missed: 0 },
    audio: { right: 0, wrong: 0, missed: 0 },
    color: { right: 0, wrong: 0, missed: 0 }
  });


  // App preferences
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSpeechMuted, setIsSpeechMuted] = useState<boolean>(false);
  const [showVisualAssist, setShowVisualAssist] = useState<boolean>(false);
  const [showScienceModal, setShowScienceModal] = useState<boolean>(false);

  // Tutorial state
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nback_hide_tutorial") === "true";
    }
    return false;
  });

  const [showTutorial, setShowTutorial] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nback_hide_tutorial") !== "true";
    }
    return false;
  });

  const handleToggleDontShowAgain = (checked: boolean) => {
    setDontShowAgain(checked);
    if (typeof window !== "undefined") {
      if (checked) {
        localStorage.setItem("nback_hide_tutorial", "true");
      } else {
        localStorage.removeItem("nback_hide_tutorial");
      }
    }
  };

  // Timers and audio references
  const mainTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTurnActiveRef = useRef<boolean>(false);
  const sessionNLevelRef = useRef<number>(2);
  const sessionGameModeRef = useRef<"dual" | "triple">("dual");
  const sessionSpeedRef = useRef<number>(2.5);
  
  const turnStartTimeRef = useRef<number>(0);
  const timeLeftRef = useRef<number>(0);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const boopBufferRef = useRef<AudioBuffer | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const calmVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Load voices for Speech Synthesis
  useEffect(() => {
    const loadVoices = () => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      const voices = window.speechSynthesis.getVoices();
      voicesRef.current = voices;
      const calm = voices.find(v => 
        v.name.includes("Google US English") || 
        v.name.includes("Samantha") || 
        v.name.includes("Natural") || 
        v.name.includes("Hazel") || 
        v.name.includes("Zira")
      ) || voices.find(v => v.lang.startsWith("en")) || voices[0];
      calmVoiceRef.current = calm || null;
    };

    loadVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Load boop.mp3 into an AudioBuffer on mount
  useEffect(() => {
    let active = true;
    const loadBoop = async () => {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContextClass();
        }
        const ctx = audioCtxRef.current;
        const response = await fetch(boopSoundUrl);
        const arrayBuffer = await response.arrayBuffer();
        ctx.decodeAudioData(
          arrayBuffer,
          (buffer) => {
            if (active) {
              boopBufferRef.current = buffer;
            }
          },
          (err) => {
            console.error("Error decoding boop.mp3:", err);
          }
        );
      } catch (err) {
        console.error("Failed to load boop.mp3:", err);
      }
    };
    loadBoop();
    return () => {
      active = false;
    };
  }, []);

  // Web Audio Synthesizer (Zen Bell and Earthy Wood Blocks)
  const playSynthSound = useCallback((type: "correct" | "wrong" | "start", pitchLevel = 0) => {
    if (isMuted) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      
      const now = ctx.currentTime;
      
      if (type === "correct") {
        if (boopBufferRef.current) {
          const bufferSource = ctx.createBufferSource();
          bufferSource.buffer = boopBufferRef.current;
          
          let playbackRate = 1.0;
          if (pitchLevel === 1) {
            playbackRate = 1.2599; // Major third higher
          } else if (pitchLevel >= 2) {
            playbackRate = 1.4983; // Perfect fifth higher
          }
          bufferSource.playbackRate.value = playbackRate;
          
          const gainNode = ctx.createGain();
          gainNode.gain.setValueAtTime(0.7, now);
          bufferSource.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          bufferSource.start(now);
        } else {
          // High-fidelity tactile MacBook haptic trackpad "boop" synthesis fallback
          let fundamental = 120; // warm bassy G3/A2 region (120Hz)

          if (pitchLevel === 1) {
            fundamental = 150; // major 3rd higher (150Hz)
          } else if (pitchLevel >= 2) {
            fundamental = 180; // perfect fifth above root (180Hz) to complete the major triad (G-B-D style)
          }

          // Main sine oscillator
          const osc1 = ctx.createOscillator();
          osc1.type = "sine";
          // Pitch sweep for physical thud/punch
          osc1.frequency.setValueAtTime(fundamental * 1.5, now);
          osc1.frequency.exponentialRampToValueAtTime(fundamental, now + 0.015);

          // Secondary triangle oscillator for physical wood/haptic resonance body
          const osc2 = ctx.createOscillator();
          osc2.type = "triangle";
          osc2.frequency.setValueAtTime(fundamental * 1.5, now);
          osc2.frequency.exponentialRampToValueAtTime(fundamental, now + 0.015);

          // Lowpass filter to keep it extremely warm and remove harsh triangle high-frequencies
          const filter = ctx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(320, now);
          filter.Q.setValueAtTime(1.2, now);

          // Fast-attack, rapid-decay haptic envelope
          const gainNode = ctx.createGain();
          gainNode.gain.setValueAtTime(0, now);
          gainNode.gain.linearRampToValueAtTime(0.55, now + 0.002); // 2ms ultra-fast attack
          gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.16); // snappier, warm dampening decay

          // Subtle high-frequency "tick" at exactly the start for mechanical trackpad feedback
          const clickOsc = ctx.createOscillator();
          clickOsc.type = "sine";
          clickOsc.frequency.setValueAtTime(1400, now);

          const clickGain = ctx.createGain();
          clickGain.gain.setValueAtTime(0, now);
          clickGain.gain.linearRampToValueAtTime(0.05, now + 0.001);
          clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.006); // ultra-short 6ms click transient

          // Connect nodes
          osc1.connect(filter);
          osc2.connect(filter);
          filter.connect(gainNode);
          gainNode.connect(ctx.destination);

          clickOsc.connect(clickGain);
          clickGain.connect(ctx.destination);

          // Start & stop
          osc1.start(now);
          osc2.start(now);
          clickOsc.start(now);

          osc1.stop(now + 0.22);
          osc2.stop(now + 0.22);
          clickOsc.stop(now + 0.22);
        }
      } else if (type === "wrong") {
        // Soft Earthy Wood Block strike (instead of stressful buzzer)
        const gainNode = ctx.createGain();
        gainNode.connect(ctx.destination);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.18, now + 0.002);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(380, now);
        filter.Q.setValueAtTime(3, now);
        filter.connect(gainNode);
        
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(105, now + 0.12);
        osc.connect(filter);
        
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === "start") {
        // Meditative morning dew water droplet swell
        const gainNode = ctx.createGain();
        gainNode.connect(ctx.destination);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.2, now + 0.06);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
        
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(293.66, now); // D4 note
        osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.15); // D5 note
        osc.connect(gainNode);
        
        osc.start(now);
        osc.stop(now + 0.9);
      }
    } catch (err) {
      console.warn("Audio Context synth error: ", err);
    }
  }, [isMuted]);

  // Voice synthesis letter speaker
  const speakStimulusLetter = useCallback((letter: string) => {
    if (isSpeechMuted || typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(letter.toLowerCase());
      if (calmVoiceRef.current) {
        utterance.voice = calmVoiceRef.current;
      }
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("Speech Synthesis error:", err);
    }
  }, [isSpeechMuted]);

  // Keyboard controls listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      
      // Pause shortcut (P or Escape)
      if (key === "p" || key === "escape") {
        if (gameState === "playing") {
          pauseGame();
        } else if (gameState === "paused") {
          resumeGame();
        }
        return;
      }

      // Actions in other states
      if (gameState === "paused") {
        if (key === "r") {
          startNewSession();
        } else if (key === "e") {
          endGame();
        }
        return;
      }

      if (gameState !== "playing") return;

      // Match keys
      if (key === "a") {
        if (currentStep >= sessionNLevel) {
          handleAudioMatch();
        }
      } else if (key === "l") {
        if (currentStep >= sessionNLevel) {
          handlePositionMatch();
        }
      } else if (key === "d" || key === "s" || key === "c") {
        if (sessionGameMode === "triple" && currentStep >= sessionNLevel) {
          handleColorMatch();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState, sessionNLevel, sequence, currentStep, userPressedAudio, userPressedPos, userPressedColor, sessionGameMode]);

  // Helper sequence generator with balanced ~33% match targets
  const generateTrialSequence = (level: number, mode: "dual" | "triple"): SequenceStep[] => {
    const seq: SequenceStep[] = [];
    for (let i = 0; i < totalSteps; i++) {
      let pos = Math.floor(Math.random() * 9);
      let letter = LETTERS_POOL[Math.floor(Math.random() * LETTERS_POOL.length)];
      let colorIndex = 0;
      if (mode === "triple") {
        colorIndex = Math.floor(Math.random() * COLORS_POOL.length);
      }
      
      // Introduce matching triggers
      if (i >= level) {
        const randPos = Math.random();
        const randAud = Math.random();
        const randCol = Math.random();
        
        if (randPos < 0.35) {
          pos = seq[i - level].position;
        }
        if (randAud < 0.35) {
          letter = seq[i - level].letter;
        }
        if (mode === "triple" && randCol < 0.35) {
          colorIndex = seq[i - level].colorIndex;
        }
      }
      seq.push({ position: pos, letter: letter, colorIndex });
    }
    return seq;
  };

  // Start Game flow with 0.5s transition delay
  const startNewSession = () => {
    // Clear all existing timeouts
    if (mainTimerRef.current) clearTimeout(mainTimerRef.current);
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    // Set locks & initialize parameters
    setSessionNLevel(nLevel);
    setSessionSpeed(speedSeconds);
    setSessionGameMode(gameMode);
    sessionNLevelRef.current = nLevel;
    sessionSpeedRef.current = speedSeconds;
    sessionGameModeRef.current = gameMode;
    setCurrentStep(0);
    isTurnActiveRef.current = false;
    
    // Clear active feedback indicators
    setPosBtnFeedback("idle");
    setAudioBtnFeedback("idle");
    setColorBtnFeedback("idle");
    setUserPressedPos(false);
    setUserPressedAudio(false);
    setUserPressedColor(false);
    userPressedPosRef.current = false;
    userPressedAudioRef.current = false;
    userPressedColorRef.current = false;

    // Reset stats
    setStats({
      position: { right: 0, wrong: 0, missed: 0 },
      audio: { right: 0, wrong: 0, missed: 0 },
      color: { right: 0, wrong: 0, missed: 0 }
    });

    const newSeq = generateTrialSequence(nLevel, gameMode);
    setSequence(newSeq);

    // Enter playing state immediately so the grid and panels are shown right away
    setGameState("playing");
    setIsStimulusVisible(false);
    setActivePosition(null);
    setActiveLetter(null);
    turnStartTimeRef.current = Date.now(); // Record start time of initial 500ms wait

    playSynthSound("start");

    // Wait 0.5s before presenting the first position/sound
    countdownTimerRef.current = setTimeout(() => {
      triggerTurnCycle(0, newSeq, speedSeconds);
    }, 500);
  };

  // Handles consecutive step triggers
  const triggerTurnCycle = (step: number, seq: SequenceStep[], speedSec: number) => {
    if (step >= totalSteps) {
      endGame();
      return;
    }

    // Reset user choices & feedback indicators
    setCurrentStep(step);
    setUserPressedPos(false);
    setUserPressedAudio(false);
    setUserPressedColor(false);
    userPressedPosRef.current = false;
    userPressedAudioRef.current = false;
    userPressedColorRef.current = false;
    setPosBtnFeedback("idle");
    setAudioBtnFeedback("idle");
    setColorBtnFeedback("idle");
    isTurnActiveRef.current = true;

    const stimulus = seq[step];
    setActivePosition(stimulus.position);
    setActiveLetter(stimulus.letter);
    setIsStimulusVisible(true);

    // Speak letter stimulus
    speakStimulusLetter(stimulus.letter);

    // Turn timing tracker
    const intervalMs = speedSec * 1000;
    turnStartTimeRef.current = Date.now();
    timeLeftRef.current = intervalMs;

    // Stimulus turns off after 900ms (or 40% of interval)
    const visibilityMs = Math.min(900, intervalMs * 0.4);
    setTimeout(() => {
      setIsStimulusVisible(false);
    }, visibilityMs);

    // Turn complete timer
    mainTimerRef.current = setTimeout(() => {
      finalizeStepScore(step, seq, level => {
        // Pause check
        transitionTimerRef.current = setTimeout(() => {
          triggerTurnCycle(step + 1, seq, speedSec);
        }, 500);
      });
    }, intervalMs);
  };

  // Pauses the active game loop
  const pauseGame = () => {
    if (gameState !== "playing") return;
    
    if (mainTimerRef.current) clearTimeout(mainTimerRef.current);
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    // If we are in the initial start delay (0.5s) of step 0
    if (currentStep === 0 && !mainTimerRef.current) {
      const elapsed = Date.now() - turnStartTimeRef.current;
      timeLeftRef.current = Math.max(50, 500 - elapsed);
    } else {
      // Compute remaining time in the current turn
      const timeSpent = Date.now() - turnStartTimeRef.current;
      const intervalMs = sessionSpeed * 1000;
      timeLeftRef.current = Math.max(100, intervalMs - timeSpent);
    }

    setGameState("paused");
  };

  // Resumes from active pause
  const resumeGame = () => {
    if (gameState !== "paused") return;

    setGameState("playing");
    
    // If we were in the initial 500ms startup delay
    if (currentStep === 0 && !mainTimerRef.current) {
      turnStartTimeRef.current = Date.now() - (500 - timeLeftRef.current);
      countdownTimerRef.current = setTimeout(() => {
        triggerTurnCycle(0, sequence, sessionSpeed);
      }, timeLeftRef.current);
      return;
    }

    // Resume current stimulus speech if early in the turn
    const intervalMs = sessionSpeed * 1000;
    if (timeLeftRef.current > intervalMs - 800 && activeLetter) {
      speakStimulusLetter(activeLetter);
    }

    turnStartTimeRef.current = Date.now() - (intervalMs - timeLeftRef.current);

    mainTimerRef.current = setTimeout(() => {
      finalizeStepScore(currentStep, sequence, () => {
        transitionTimerRef.current = setTimeout(() => {
          triggerTurnCycle(currentStep + 1, sequence, sessionSpeed);
        }, 500);
      });
    }, timeLeftRef.current);
  };

  // Evaluate step targets and log missed responses
  const finalizeStepScore = (step: number, seq: SequenceStep[], callback: (level: number) => void) => {
    isTurnActiveRef.current = false;
    const currentNLevel = sessionNLevelRef.current;
    const currentGameMode = sessionGameModeRef.current;

    if (step < currentNLevel) {
      // For first trials less than N, any user press is a wrong selection
      if (userPressedPosRef.current) setStats(prev => ({ ...prev, position: { ...prev.position, wrong: prev.position.wrong + 1 } }));
      if (userPressedAudioRef.current) setStats(prev => ({ ...prev, audio: { ...prev.audio, wrong: prev.audio.wrong + 1 } }));
      if (currentGameMode === "triple" && userPressedColorRef.current) setStats(prev => ({ ...prev, color: { ...prev.color, wrong: prev.color.wrong + 1 } }));
      callback(currentNLevel);
      return;
    }

    setStats(prev => {
      const correctPos = seq[step].position === seq[step - currentNLevel].position;
      const correctAud = seq[step].letter === seq[step - currentNLevel].letter;
      const correctCol = currentGameMode === "triple" && seq[step].colorIndex === seq[step - currentNLevel].colorIndex;

      let missedPos = prev.position.missed;
      let missedAud = prev.audio.missed;
      let missedCol = prev.color.missed;

      // Missed targets check
      if (correctPos && !userPressedPosRef.current) {
        missedPos += 1;
        setPosBtnFeedback("wrong"); // Flash missed
      }
      if (correctAud && !userPressedAudioRef.current) {
        missedAud += 1;
        setAudioBtnFeedback("wrong");
      }
      if (currentGameMode === "triple" && correctCol && !userPressedColorRef.current) {
        missedCol += 1;
        setColorBtnFeedback("wrong");
      }

      return {
        ...prev,
        position: { ...prev.position, missed: missedPos },
        audio: { ...prev.audio, missed: missedAud },
        color: currentGameMode === "triple" ? { ...prev.color, missed: missedCol } : prev.color
      };
    });

    callback(currentNLevel);
  };

  // Manual actions
  const handlePositionMatch = () => {
    if (gameState !== "playing" || !isTurnActiveRef.current) return;
    if (userPressedPosRef.current) return; // Prevent double pressing
    setUserPressedPos(true);
    userPressedPosRef.current = true;

    const currentNLevel = sessionNLevelRef.current;
    const currentGameMode = sessionGameModeRef.current;

    if (currentStep < currentNLevel) {
      // Early trial
      setStats(prev => ({ ...prev, position: { ...prev.position, wrong: prev.position.wrong + 1 } }));
      setPosBtnFeedback("wrong");
      playSynthSound("wrong");
      return;
    }

    const isMatch = sequence[currentStep].position === sequence[currentStep - currentNLevel].position;
    if (isMatch) {
      setStats(prev => ({ ...prev, position: { ...prev.position, right: prev.position.right + 1 } }));
      setPosBtnFeedback("correct");

      let pitchLevel = 0;
      const isAudioCorrect = userPressedAudioRef.current && 
        (sequence[currentStep].letter === sequence[currentStep - currentNLevel].letter);
      if (isAudioCorrect) pitchLevel++;

      const isColorCorrect = currentGameMode === "triple" && userPressedColorRef.current && 
        (sequence[currentStep].colorIndex === sequence[currentStep - currentNLevel].colorIndex);
      if (isColorCorrect) pitchLevel++;

      playSynthSound("correct", pitchLevel);
    } else {
      setStats(prev => ({ ...prev, position: { ...prev.position, wrong: prev.position.wrong + 1 } }));
      setPosBtnFeedback("wrong");
      playSynthSound("wrong");
    }
  };

  const handleAudioMatch = () => {
    if (gameState !== "playing" || !isTurnActiveRef.current) return;
    if (userPressedAudioRef.current) return; // Prevent double pressing
    setUserPressedAudio(true);
    userPressedAudioRef.current = true;

    const currentNLevel = sessionNLevelRef.current;
    const currentGameMode = sessionGameModeRef.current;

    if (currentStep < currentNLevel) {
      // Early trial
      setStats(prev => ({ ...prev, audio: { ...prev.audio, wrong: prev.audio.wrong + 1 } }));
      setAudioBtnFeedback("wrong");
      playSynthSound("wrong");
      return;
    }

    const isMatch = sequence[currentStep].letter === sequence[currentStep - currentNLevel].letter;
    if (isMatch) {
      setStats(prev => ({ ...prev, audio: { ...prev.audio, right: prev.audio.right + 1 } }));
      setAudioBtnFeedback("correct");

      let pitchLevel = 0;
      const isPositionCorrect = userPressedPosRef.current && 
        (sequence[currentStep].position === sequence[currentStep - currentNLevel].position);
      if (isPositionCorrect) pitchLevel++;

      const isColorCorrect = currentGameMode === "triple" && userPressedColorRef.current && 
        (sequence[currentStep].colorIndex === sequence[currentStep - currentNLevel].colorIndex);
      if (isColorCorrect) pitchLevel++;

      playSynthSound("correct", pitchLevel);
    } else {
      setStats(prev => ({ ...prev, audio: { ...prev.audio, wrong: prev.audio.wrong + 1 } }));
      setAudioBtnFeedback("wrong");
      playSynthSound("wrong");
    }
  };

  const handleColorMatch = () => {
    if (gameState !== "playing" || !isTurnActiveRef.current) return;
    if (userPressedColorRef.current) return; // Prevent double pressing
    setUserPressedColor(true);
    userPressedColorRef.current = true;

    const currentNLevel = sessionNLevelRef.current;
    const currentGameMode = sessionGameModeRef.current;

    if (currentStep < currentNLevel) {
      // Early trial
      setStats(prev => ({ ...prev, color: { ...prev.color, wrong: prev.color.wrong + 1 } }));
      setColorBtnFeedback("wrong");
      playSynthSound("wrong");
      return;
    }

    const isMatch = sequence[currentStep].colorIndex === sequence[currentStep - currentNLevel].colorIndex;
    if (isMatch) {
      setStats(prev => ({ ...prev, color: { ...prev.color, right: prev.color.right + 1 } }));
      setColorBtnFeedback("correct");

      let pitchLevel = 0;
      const isPositionCorrect = userPressedPosRef.current && 
        (sequence[currentStep].position === sequence[currentStep - currentNLevel].position);
      if (isPositionCorrect) pitchLevel++;

      const isAudioCorrect = userPressedAudioRef.current && 
        (sequence[currentStep].letter === sequence[currentStep - currentNLevel].letter);
      if (isAudioCorrect) pitchLevel++;

      playSynthSound("correct", pitchLevel);
    } else {
      setStats(prev => ({ ...prev, color: { ...prev.color, wrong: prev.color.wrong + 1 } }));
      setColorBtnFeedback("wrong");
      playSynthSound("wrong");
    }
  };

  // Terminate active game loop
  const endGame = () => {
    isTurnActiveRef.current = false;
    if (mainTimerRef.current) clearTimeout(mainTimerRef.current);
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    setGameState("complete");
    setActivePosition(null);
    setActiveLetter(null);
  };

  // Reset entirely to core menu
  const resetToMenu = () => {
    isTurnActiveRef.current = false;
    if (mainTimerRef.current) clearTimeout(mainTimerRef.current);
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    setGameState("menu");
    setActivePosition(null);
    setActiveLetter(null);
  };

  // Score metrics
  const getMatchesCount = (type: "position" | "audio" | "color") => {
    if (!sequence || sequence.length === 0) return 0;
    let count = 0;
    for (let i = sessionNLevel; i < sequence.length; i++) {
      if (type === "position" && sequence[i].position === sequence[i - sessionNLevel].position) {
        count++;
      }
      if (type === "audio" && sequence[i].letter === sequence[i - sessionNLevel].letter) {
        count++;
      }
      if (type === "color" && sequence[i].colorIndex === sequence[i - sessionNLevel].colorIndex) {
        count++;
      }
    }
    return count;
  };

  const posTargets = getMatchesCount("position");
  const audTargets = getMatchesCount("audio");
  const colTargets = sessionGameMode === "triple" ? getMatchesCount("color") : 0;
  
  const totalTargets = posTargets + audTargets + colTargets;
  const totalHits = stats.position.right + stats.audio.right + (sessionGameMode === "triple" ? stats.color.right : 0);

  // Percentage formulas
  const calculateAccuracy = () => {
    if (totalTargets === 0) return 100;
    return Math.round((totalHits / totalTargets) * 100);
  };

  const accuracy = calculateAccuracy();

  // Mindfulness and attention tier categorization
  const getZenTier = (score: number) => {
    if (score >= 90) {
      return {
        title: "Satori Level (Pure Enlightenment)",
        desc: "Your awareness is pristine, like a mirror reflecting moonlight. Flawless coordination and presence.",
        color: "text-[#8ba99b] shadow-[#8ba99b]/10",
        bg: "bg-[#8ba99b]/10 border-[#8ba99b]/25",
        badge: "🌌 Enlivened"
      };
    } else if (score >= 75) {
      return {
        title: "Deep Presence (Lotus Mind)",
        desc: "Calm and steady focus. You are deeply anchored in the present moment, mastering dual streams.",
        color: "text-[#8ba99b]/90 shadow-[#8ba99b]/5",
        bg: "bg-[#8ba99b]/5 border-[#8ba99b]/20",
        badge: "🏔️ Serene"
      };
    } else if (score >= 50) {
      return {
        title: "Zazen State (Steady Zen)",
        desc: "Your focus is solid, though passing thoughts occasionally drift in. Steady training will quiet the wind.",
        color: "text-[#d4a373] shadow-[#d4a373]/10",
        bg: "bg-[#d4a373]/10 border-[#d4a373]/25",
        badge: "🪵 Grounded"
      };
    } else {
      return {
        title: "Floating Leaf (Gentle Practice)",
        desc: "Your mind is wandering naturally. Take a deep breath, let go of expectations, and begin gently.",
        color: "text-rose-400/90 shadow-rose-500/10",
        bg: "bg-rose-500/5 border-rose-500/20",
        badge: "🍃 Flowing"
      };
    }
  };

  const tier = getZenTier(accuracy);

  return (
    <div id="zen-nback-root" className="relative min-height-screen min-h-screen w-full flex flex-col justify-between items-center text-[#e0e5e1] overflow-x-hidden py-6 px-4 md:px-8 selection:bg-[#8ba99b]/30 select-none">
      
      {/* Meditative Flowing Ambient Background */}
      <div className="absolute inset-0 bg-[#0c0f0e] -z-20 overflow-hidden">
        {/* Animated Flowing Color Gels */}
        <div className="absolute inset-0 opacity-40 pointer-events-none mix-blend-screen filter blur-[120px]">
          {/* Sage Green Gel */}
          <motion.div
            className="absolute top-[20%] left-[20%] w-[350px] h-[350px] rounded-full"
            animate={{
              x: [0, 80, -40, 0],
              y: [0, -60, 50, 0],
              backgroundColor: [
                "rgba(139, 169, 155, 0.15)", // #8ba99b Sage Green
                "rgba(212, 163, 115, 0.12)", // #d4a373 Sunset Amber
                "rgba(191, 165, 154, 0.15)", // #bfa59a Soft Clay
                "rgba(139, 169, 155, 0.15)"
              ]
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          {/* Ocean Blue/Lavender Gel */}
          <motion.div
            className="absolute bottom-[25%] right-[15%] w-[400px] h-[400px] rounded-full"
            animate={{
              x: [0, -90, 60, 0],
              y: [0, 80, -70, 0],
              backgroundColor: [
                "rgba(155, 168, 189, 0.15)", // #9ba8bd Ocean Blue
                "rgba(201, 155, 155, 0.12)", // #c99b9b Rose
                "rgba(189, 170, 138, 0.15)", // #bdaa8a Deep Sand
                "rgba(155, 168, 189, 0.15)"
              ]
            }}
            transition={{
              duration: 30,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          {/* Sunset Amber Gel */}
          <motion.div
            className="absolute top-[60%] left-[10%] w-[300px] h-[300px] rounded-full"
            animate={{
              x: [0, 100, -50, 0],
              y: [0, -80, 60, 0],
              backgroundColor: [
                "rgba(212, 163, 115, 0.12)", // #d4a373 Sunset Amber
                "rgba(139, 169, 155, 0.15)", // #8ba99b Sage Green
                "rgba(155, 168, 189, 0.12)", // #9ba8bd Ocean Blue
                "rgba(212, 163, 115, 0.12)"
              ]
            }}
            transition={{
              duration: 22,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          {/* Rose Gel */}
          <motion.div
            className="absolute top-[10%] right-[25%] w-[320px] h-[320px] rounded-full"
            animate={{
              x: [0, -70, 80, 0],
              y: [0, 90, -40, 0],
              backgroundColor: [
                "rgba(201, 155, 155, 0.12)", // #c99b9b Rose
                "rgba(189, 170, 138, 0.15)", // #bdaa8a Deep Sand
                "rgba(139, 169, 155, 0.12)", // #8ba99b Sage Green
                "rgba(201, 155, 155, 0.12)"
              ]
            }}
            transition={{
              duration: 28,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>
      </div>

      {/* Top Header Row */}
      <header className="w-full max-w-lg md:max-w-xl lg:max-w-3xl xl:max-w-4xl flex items-center justify-between z-10 mb-4 px-2 md:px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#8ba99b]/25 to-[#8ba99b]/10 border border-[#8ba99b]/30 flex items-center justify-center text-[#8ba99b] font-extrabold text-sm shadow-sm">
            N
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-[#8ba99b] to-[#a8c1b5] bg-clip-text text-transparent">
              N-Back
            </h1>
          </div>
        </div>

        {/* Header Controls */}
        <div className="flex items-center gap-2">
          <button
            id="header-tutorial-btn"
            onClick={() => setShowTutorial(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-white/10 text-xs font-medium text-[#e0e5e1]/90 hover:text-[#8ba99b] hover:border-[#8ba99b]/30 hover:bg-[#8ba99b]/5 transition-all duration-300 cursor-pointer"
            title="How to Play Tutorial"
          >
            <HelpCircle className="w-4 h-4 text-[#8ba99b]" />
            <span>How to Play</span>
          </button>
        </div>
      </header>

      {/* Main Console Area */}
      <main className="w-full max-w-lg md:max-w-xl lg:max-w-3xl xl:max-w-4xl flex flex-col items-center justify-center my-auto py-2 z-10">
        
        {/* Completely flat, seamless game container integrated into the main background */}
        <div className="w-full relative px-2 py-4 md:py-6">
          
          {/* Pause Button in top right corner of glass card */}
          {gameState === "playing" && (
            <div className="absolute top-4 right-4 z-20">
              <button
                onClick={pauseGame}
                className="p-2.5 rounded-xl bg-[#1a1f1d]/50 border border-white/5 hover:border-[#8ba99b]/30 text-[#e0e5e1]/60 hover:text-[#8ba99b] hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center"
                title="Pause (P or Esc)"
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            

              {/* Menu State Panel */}
            {gameState === "menu" && (
              <motion.div
                key="menu"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center text-center py-2 md:py-4"
              >
                {/* Home Page Main Title Header */}
                <div className="flex flex-col items-center mb-6 max-w-lg text-center px-2">
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#e0e5e1]">
                    Working Memory Training
                  </h2>
                  <p className="mt-2 text-xs sm:text-sm text-[#a8b3ad] max-w-sm font-sans leading-relaxed">
                    Train focus and recall through multi-sensory position, audio, and color signals.
                  </p>
                </div>

                {/* Settings Section */}
                <div className="w-full space-y-4 md:space-y-6 lg:space-y-8 max-w-sm md:max-w-md lg:max-w-xl xl:max-w-2xl mb-6 bg-[#2e3733]/40 rounded-3xl p-4.5 md:p-6 lg:p-8 border border-white/5">
                  {/* Game Mode Selection */}
                  <div className="flex flex-col gap-1.5 pb-2 border-b border-white/5 text-left">
                    <span className="text-[#6e847c] font-mono text-xs uppercase tracking-wider">Training Mode:</span>
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => setGameMode("dual")}
                        className={`flex-1 py-1.5 px-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer whitespace-nowrap ${
                          gameMode === "dual"
                            ? "bg-[#8ba99b] text-[#1a1f1d] shadow-md shadow-[#8ba99b]/20 font-bold border border-transparent"
                            : "bg-[#2e3733] border border-white/5 text-[#6e847c] hover:text-[#e0e5e1] hover:bg-white/5"
                        }`}
                      >
                        Dual (Pos + Aud)
                      </button>
                      <button
                        onClick={() => setGameMode("triple")}
                        className={`flex-1 py-1.5 px-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer whitespace-nowrap ${
                          gameMode === "triple"
                            ? "bg-[#8ba99b] text-[#1a1f1d] shadow-md shadow-[#8ba99b]/20 font-bold border border-transparent"
                            : "bg-[#2e3733] border border-white/5 text-[#6e847c] hover:text-[#e0e5e1] hover:bg-white/5"
                        }`}
                      >
                        Triple (+ Color)
                      </button>
                    </div>
                  </div>

                  {/* Level Slider Selection */}
                  <div className="flex flex-col gap-1.5 text-left">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#6e847c] font-mono uppercase tracking-wider">Memory Depth (N-Level):</span>
                      <span className="font-mono font-bold text-[#8ba99b] bg-[#8ba99b]/10 px-2 py-0.5 rounded-md">
                        {nLevel}-Back
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 md:gap-2 mt-1">
                      {Array.from({ length: 8 }).map((_, i) => {
                        const val = i + 1;
                        return (
                          <button
                            key={val}
                            onClick={() => setNLevel(val)}
                            className={`py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                              nLevel === val
                                ? "bg-[#8ba99b] text-[#1a1f1d] shadow-md shadow-[#8ba99b]/20 font-bold border border-transparent"
                                : "bg-[#2e3733] border border-white/5 text-[#6e847c] hover:text-[#e0e5e1] hover:bg-white/5"
                            }`}
                          >
                            {val}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Interval Speed Input */}
                  <div className="flex flex-col gap-1.5 pt-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#6e847c] font-mono uppercase tracking-wider">Interval Speed:</span>
                      <span className="font-mono font-bold text-[#d4a373] bg-[#d4a373]/10 px-2 py-0.5 rounded-md">
                        {formatSpeed(speedSeconds)}s
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1.5"
                      max="4.0"
                      step="0.1"
                      value={speedSeconds}
                      onChange={(e) => setSpeedSeconds(parseFloat(e.target.value))}
                      className="w-full accent-[#8ba99b] cursor-pointer h-1.5 bg-[#1a1f1d] rounded-lg appearance-none"
                    />
                    <div className="flex justify-between text-[10px] md:text-xs text-[#6e847c] font-mono px-0.5 mt-0.5">
                      <span>1.5s (Faster)</span>
                      <span>4.0s (Relaxed)</span>
                    </div>
                  </div>
                </div>

                <div className="w-full max-w-sm md:max-w-md lg:max-w-xl">
                  <button
                    id="menu-start-btn"
                    onClick={startNewSession}
                    className="w-full py-4 px-6 rounded-2xl bg-[#8ba99b] text-[#1a1f1d] font-bold tracking-wider uppercase text-base shadow-lg shadow-[#8ba99b]/20 hover:shadow-[#8ba99b]/35 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-[#1a1f1d]" />
                    Start Game
                  </button>
                </div>
              </motion.div>
            )}

            {/* Paused State Panel */}
            {gameState === "paused" && (
              <motion.div
                key="paused"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="flex flex-col items-center text-center py-6 z-20 animate-fade-in"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#2e3733] border border-white/5 flex items-center justify-center mb-3">
                  <Pause className="w-5 h-5 text-[#8ba99b]" />
                </div>
                <h2 className="text-xl font-bold text-[#8ba99b] mb-1">
                  Paused
                </h2>
                <p className="text-xs text-[#6e847c] max-w-xs mb-8 font-mono uppercase tracking-wider">
                  {sessionNLevel}-Back {sessionGameMode.toUpperCase()} Session
                </p>

                {/* Actions buttons */}
                <div className="w-full max-w-xs md:max-w-sm flex flex-col gap-2.5">
                  <button
                    onClick={resumeGame}
                    className="w-full py-3 px-5 rounded-xl bg-[#8ba99b] hover:bg-[#a8c1b5] text-[#1a1f1d] font-bold tracking-widest uppercase shadow-md shadow-[#8ba99b]/15 transition-colors duration-75 flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-[#1a1f1d]" />
                    Resume
                  </button>

                  <button
                    onClick={startNewSession}
                    className="w-full py-3 px-5 rounded-xl font-bold uppercase tracking-widest bg-[#2e3733] hover:bg-white/5 text-[#e0e5e1] border border-white/5 transition-colors duration-75 flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restart Session
                  </button>

                  <button
                    onClick={resetToMenu}
                    className="w-full py-3 px-5 rounded-xl bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 border border-rose-500/25 font-semibold transition-all duration-300 flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    Exit to Menu
                  </button>
                </div>
              </motion.div>
            )}

            {/* Complete Results State Panel */}
            {gameState === "complete" && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="flex flex-col items-center"
              >
                <div className="w-14 h-14 rounded-full bg-[#8ba99b]/10 border border-[#8ba99b]/20 flex items-center justify-center mb-3">
                  <Award className="w-7 h-7 text-[#8ba99b]" />
                </div>
                
                <span className="text-[10px] font-mono tracking-widest text-[#8ba99b] uppercase font-semibold">
                  Session Completed
                </span>
                <h2 className="text-2xl font-serif italic text-[#8ba99b] mt-0.5 mb-5">
                  Mindfulness Summary
                </h2>

                {/* Score Circle Progress */}
                <div className="relative w-36 h-36 md:w-44 md:h-44 flex items-center justify-center mb-6">
                  {/* Subtle circular SVG */}
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="stroke-[#2e3733] fill-none"
                      strokeWidth="6"
                    />
                    <motion.circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="stroke-[#8ba99b] fill-none"
                      strokeWidth="6"
                      strokeLinecap="round"
                      initial={{ strokeDasharray: "251.2", strokeDashoffset: "251.2" }}
                      animate={{ strokeDashoffset: String(251.2 - (251.2 * accuracy) / 100) }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                    />
                  </svg>
                  <div className="absolute text-center">
                    <span className="text-3xl md:text-4xl font-mono font-bold text-[#e0e5e1]">{accuracy}%</span>
                    <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-[#6e847c] font-mono mt-0.5">
                      Accuracy
                    </p>
                  </div>
                </div>

                {/* Assessment Tier box */}
                <div className={`w-full ${tier.bg} border rounded-2xl p-4 md:p-5 text-center mb-6 max-w-sm md:max-w-md lg:max-w-lg`}>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className="text-xs font-bold text-[#e0e5e1] uppercase tracking-wide">
                      {tier.badge}
                    </span>
                  </div>
                  <h4 className={`text-sm font-bold font-serif italic ${tier.color}`}>{tier.title}</h4>
                  <p className="text-[11px] text-[#e0e5e1]/80 mt-1.5 leading-relaxed">
                    {tier.desc}
                  </p>
                </div>

                {/* Score Breakdown Table */}
                <div className="w-full max-w-sm md:max-w-md lg:max-w-lg bg-[#2e3733]/30 rounded-2xl border border-white/5 overflow-hidden mb-6 text-xs md:text-sm">
                  <div className="grid grid-cols-4 bg-[#2e3733]/80 text-[10px] text-[#6e847c] font-mono uppercase tracking-wider font-semibold py-2 px-4 border-b border-white/5 text-center">
                    <div className="text-left">Type</div>
                    <div className="text-[#8ba99b]">Right</div>
                    <div className="text-[#d4a373]">Wrong</div>
                    <div className="text-rose-400">Missed</div>
                  </div>
                  
                  <div className="divide-y divide-white/5 px-4 py-1">
                    <div className="grid grid-cols-4 py-2.5 text-center items-center">
                      <div className="text-left font-semibold text-[#e0e5e1]/90 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#8ba99b]" />
                        Spatial
                      </div>
                      <div className="font-mono text-[#8ba99b] font-medium">{stats.position.right}</div>
                      <div className="font-mono text-[#d4a373]">{stats.position.wrong}</div>
                      <div className="font-mono text-rose-400/90">{stats.position.missed}</div>
                    </div>

                    <div className="grid grid-cols-4 py-2.5 text-center items-center">
                      <div className="text-left font-semibold text-[#e0e5e1]/90 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#d4a373]" />
                        Audio
                      </div>
                      <div className="font-mono text-[#8ba99b] font-medium">{stats.audio.right}</div>
                      <div className="font-mono text-[#d4a373]">{stats.audio.wrong}</div>
                      <div className="font-mono text-rose-400/90">{stats.audio.missed}</div>
                    </div>

                    {sessionGameMode === "triple" && (
                      <div className="grid grid-cols-4 py-2.5 text-center items-center">
                        <div className="text-left font-semibold text-[#e0e5e1]/90 flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#9ba8bd]" />
                          Color
                        </div>
                        <div className="font-mono text-[#8ba99b] font-medium">{stats.color.right}</div>
                        <div className="font-mono text-[#d4a373]">{stats.color.wrong}</div>
                        <div className="font-mono text-rose-400/90">{stats.color.missed}</div>
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-[#1a1f1d]/50 py-2.5 px-4 border-t border-white/5 flex justify-between text-[10px] text-[#6e847c]">
                    <span>Mode: <strong className="text-[#e0e5e1] uppercase">{sessionGameMode}</strong></span>
                    <span>Active Level: <strong className="text-[#e0e5e1]">{sessionNLevel}-Back</strong></span>
                    <span>Interval Speed: <strong className="text-[#e0e5e1]">{formatSpeed(sessionSpeed)}s</strong></span>
                  </div>
                </div>

                {/* Primary Complete actions */}
                <div className="w-full max-w-sm md:max-w-md lg:max-w-lg flex gap-3">
                  <button
                    onClick={resetToMenu}
                    className="flex-1 py-3 px-5 rounded-xl border border-white/5 hover:border-white/10 text-[#e0e5e1]/80 font-medium hover:bg-white/5 transition-all text-xs cursor-pointer text-center"
                  >
                    Adjust Settings
                  </button>
                  <button
                    onClick={startNewSession}
                    className="flex-1 py-3 px-5 rounded-xl bg-[#8ba99b] hover:bg-[#a8c1b5] text-[#1a1f1d] font-bold shadow-md shadow-[#8ba99b]/25 transition-all text-xs cursor-pointer text-center uppercase tracking-wider"
                  >
                    Practice Again
                  </button>
                </div>
              </motion.div>
            )}

            {/* Playing State Canvas */}
            {gameState === "playing" && (
              <motion.div
                key="playing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center"
              >
                {/* Minimal HUD */}
                <div className="w-full flex items-center justify-center text-[#6e847c]/70 text-[10px] md:text-xs font-mono uppercase tracking-widest mb-6 select-none">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8ba99b]/80 animate-pulse" />
                    <span>{sessionNLevel}-Back {sessionGameMode.toUpperCase()} Training</span>
                  </div>
                </div>

                {/* 3x3 Grid of absolute beauties */}
                <div className="grid grid-cols-3 gap-3 md:gap-5 lg:gap-6 w-full aspect-square max-w-[280px] sm:max-w-[320px] md:max-w-[400px] lg:max-w-[480px] xl:max-w-[560px] mb-6 md:mb-8 lg:mb-10 relative">
                  {Array.from({ length: 9 }).map((_, i) => {
                    const row = Math.floor(i / 3);
                    const col = i % 3;
                    
                    const activeRow = activePosition !== null ? Math.floor(activePosition / 3) : 0;
                    const activeCol = activePosition !== null ? activePosition % 3 : 0;
                    
                    // Chebyshev distance for perfectly symmetrical square light wave ripple
                    const dist = activePosition !== null 
                      ? Math.max(Math.abs(row - activeRow), Math.abs(col - activeCol)) 
                      : 0;

                    const isActive = activePosition === i && isStimulusVisible;

                    const currentStepItem = sequence[currentStep];
                    const activeColorIndex = currentStepItem ? currentStepItem.colorIndex : 0;
                    const activeColor = COLORS_POOL[activeColorIndex] || COLORS_POOL[0];

                    return (
                      <div
                        key={i}
                        className="relative aspect-square w-full rounded-2xl border border-white/5 bg-[#2e3733]/50 backdrop-blur-sm flex items-center justify-center overflow-hidden transition-all duration-300"
                      >
                        {/* Interactive Active Stimulus Glow in Dynamic Color */}
                        {isActive && (
                          <motion.div
                            layoutId="activeGlow"
                            className="absolute inset-0 rounded-2xl flex items-center justify-center z-10 border"
                            style={{
                              backgroundColor: activeColor.hex,
                              borderColor: activeColor.border,
                              boxShadow: `0 0 40px ${activeColor.hex}66`
                            }}
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.1, ease: "easeOut" }}
                          >
                            {/* Inner core element of active node */}
                            <div className="w-3 h-3 md:w-4 lg:w-5 lg:h-5 rounded-full bg-[#1a1f1d]/20 blur-[0.5px] border border-white/20" />
                          </motion.div>
                        )}

                        {/* Beginner Assistance visual helper */}
                        {showVisualAssist && isActive && activeLetter && (
                          <span className="absolute text-[#1a1f1d] font-mono text-sm md:text-base lg:text-xl xl:text-2xl font-bold z-20 select-none">
                            {activeLetter}
                          </span>
                        )}

                        {/* Minimalistic calm node core */}
                        <div className="w-1.5 h-1.5 md:w-2 lg:w-2.5 lg:h-2.5 rounded-full bg-[#1a1f1d]/30" />
                      </div>
                    );
                  })}
                </div>

                {/* Responsive Key Buttons */}
                <div className="w-full flex justify-between gap-2.5 md:gap-4 lg:gap-6 select-none mt-4 max-w-sm md:max-w-md lg:max-w-xl xl:max-w-2xl mx-auto">
                  
                  {/* Audio match button */}
                  <button
                    onClick={handleAudioMatch}
                    disabled={currentStep < sessionNLevel || userPressedAudio}
                    className={`flex-1 py-4 md:py-5 lg:py-6 rounded-2xl border flex flex-col items-center justify-center backdrop-blur-md transition-all duration-300 relative overflow-hidden ${
                      (currentStep < sessionNLevel || userPressedAudio) ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
                    } ${
                      audioBtnFeedback === "correct"
                        ? "bg-[#8ba99b]/15 border-[#8ba99b] text-[#8ba99b] shadow-lg shadow-[#8ba99b]/10"
                        : audioBtnFeedback === "wrong"
                        ? "bg-[#d4a373]/15 border-[#d4a373] text-[#d4a373] shadow-lg shadow-[#d4a373]/10"
                        : "bg-white/5 border border-white/10 text-[#e0e5e1]/60 hover:border-[#8ba99b]/30 hover:bg-[#8ba99b]/5"
                    }`}
                  >
                    <span className="text-[10px] sm:text-xs md:text-sm lg:text-base font-semibold uppercase tracking-wider">
                      Audio
                    </span>
                    <kbd className={`mt-1 px-2.5 py-0.5 rounded-lg text-[10px] sm:text-xs md:text-sm lg:text-base font-bold font-mono transition-all uppercase tracking-widest ${
                      audioBtnFeedback === "correct"
                        ? "bg-[#8ba99b] text-[#1a1f1d]"
                        : audioBtnFeedback === "wrong"
                        ? "bg-[#d4a373] text-[#1a1f1d]"
                        : "bg-white/10 text-white/80"
                    }`}>
                      A
                    </kbd>
                    {userPressedAudio && (
                      <div className="absolute top-1.5 right-1.5 flex items-center justify-center">
                        <div className={`w-1.5 h-1.5 rounded-full ${audioBtnFeedback === "correct" ? "bg-[#8ba99b]" : "bg-[#d4a373]"}`} />
                      </div>
                    )}
                  </button>

                  {/* Color match button */}
                  {sessionGameMode === "triple" && (
                    <button
                      onClick={handleColorMatch}
                      disabled={currentStep < sessionNLevel || userPressedColor}
                      className={`flex-1 py-4 md:py-5 lg:py-6 rounded-2xl border flex flex-col items-center justify-center backdrop-blur-md transition-all duration-300 relative overflow-hidden ${
                        (currentStep < sessionNLevel || userPressedColor) ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
                      } ${
                        colorBtnFeedback === "correct"
                          ? "bg-[#8ba99b]/15 border-[#8ba99b] text-[#8ba99b] shadow-lg shadow-[#8ba99b]/10"
                          : colorBtnFeedback === "wrong"
                          ? "bg-[#d4a373]/15 border-[#d4a373] text-[#d4a373] shadow-lg shadow-[#d4a373]/10"
                          : "bg-white/5 border border-white/10 text-[#e0e5e1]/60 hover:border-[#8ba99b]/30 hover:bg-[#8ba99b]/5"
                      }`}
                    >
                      <span className="text-[10px] sm:text-xs md:text-sm lg:text-base font-semibold uppercase tracking-wider">
                        Color
                      </span>
                      <kbd className={`mt-1 px-2.5 py-0.5 rounded-lg text-[10px] sm:text-xs md:text-sm lg:text-base font-bold font-mono transition-all uppercase tracking-widest ${
                        colorBtnFeedback === "correct"
                          ? "bg-[#8ba99b] text-[#1a1f1d]"
                          : colorBtnFeedback === "wrong"
                          ? "bg-[#d4a373] text-[#1a1f1d]"
                          : "bg-white/10 text-white/80"
                      }`}>
                        D
                      </kbd>
                      {userPressedColor && (
                        <div className="absolute top-1.5 right-1.5 flex items-center justify-center">
                          <div className={`w-1.5 h-1.5 rounded-full ${colorBtnFeedback === "correct" ? "bg-[#8ba99b]" : "bg-[#d4a373]"}`} />
                        </div>
                      )}
                    </button>
                  )}

                  {/* Position match button */}
                  <button
                    onClick={handlePositionMatch}
                    disabled={currentStep < sessionNLevel || userPressedPos}
                    className={`flex-1 py-4 md:py-5 lg:py-6 rounded-2xl border flex flex-col items-center justify-center backdrop-blur-md transition-all duration-300 relative overflow-hidden ${
                      (currentStep < sessionNLevel || userPressedPos) ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
                    } ${
                      posBtnFeedback === "correct"
                        ? "bg-[#8ba99b]/15 border-[#8ba99b] text-[#8ba99b] shadow-lg shadow-[#8ba99b]/10"
                        : posBtnFeedback === "wrong"
                        ? "bg-[#d4a373]/15 border-[#d4a373] text-[#d4a373] shadow-lg shadow-[#d4a373]/10"
                        : "bg-white/5 border border-white/10 text-[#e0e5e1]/60 hover:border-[#8ba99b]/30 hover:bg-[#8ba99b]/5"
                    }`}
                  >
                    <span className="text-[10px] sm:text-xs md:text-sm lg:text-base font-semibold uppercase tracking-wider">
                      Position
                    </span>
                    <kbd className={`mt-1 px-2.5 py-0.5 rounded-lg text-[10px] sm:text-xs md:text-sm lg:text-base font-bold font-mono transition-all uppercase tracking-widest ${
                      posBtnFeedback === "correct"
                        ? "bg-[#8ba99b] text-[#1a1f1d]"
                        : posBtnFeedback === "wrong"
                        ? "bg-[#d4a373] text-[#1a1f1d]"
                        : "bg-white/10 text-white/80"
                    }`}>
                      L
                    </kbd>
                    {userPressedPos && (
                      <div className="absolute top-1.5 right-1.5 flex items-center justify-center">
                        <div className={`w-1.5 h-1.5 rounded-full ${posBtnFeedback === "correct" ? "bg-[#8ba99b]" : "bg-[#d4a373]"}`} />
                      </div>
                    )}
                  </button>

                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>

      {/* Interactive Tutorial Modal */}
      <TutorialModal
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        dontShowAgain={dontShowAgain}
        onToggleDontShowAgain={handleToggleDontShowAgain}
        onStartGame={startNewSession}
      />

    </div>
  );
}

