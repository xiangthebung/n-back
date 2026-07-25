import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Brain,
  Grid,
  Volume2,
  Sparkles,
  Keyboard,
  Check,
  Play,
  RotateCcw,
  HelpCircle
} from "lucide-react";

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  dontShowAgain: boolean;
  onToggleDontShowAgain: (checked: boolean) => void;
  onStartGame?: () => void;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({
  isOpen,
  onClose,
  dontShowAgain,
  onToggleDontShowAgain,
  onStartGame
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalSteps = 5;

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onClose();
      if (onStartGame) onStartGame();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <AnimatePresence>
      <div 
        id="tutorial-modal-overlay" 
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md cursor-pointer"
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.92, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-lg md:max-w-xl bg-[#181d1a] border border-[#8ba99b]/30 rounded-3xl p-5 md:p-7 text-[#e0e5e1] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] cursor-default"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#8ba99b]/15 text-[#8ba99b] border border-[#8ba99b]/25">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg md:text-xl font-bold text-[#e0e5e1]">How to Play Dual N-Back</h3>
                <p className="text-xs text-[#6e847c]">Step {currentStep + 1} of {totalSteps}</p>
              </div>
            </div>
            
            <button
              id="tutorial-close-btn"
              onClick={onClose}
              className="p-2 rounded-xl text-[#6e847c] hover:text-[#e0e5e1] hover:bg-white/5 transition-colors cursor-pointer"
              title="Close Tutorial (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#2e3733] h-1.5 rounded-full my-4 overflow-hidden">
            <motion.div
              className="bg-[#8ba99b] h-full"
              initial={{ width: "0%" }}
              animate={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Body Content Slider */}
          <div className="my-auto py-2 overflow-y-auto space-y-4">
            {currentStep === 0 && (
              <motion.div
                key="step-0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 text-left"
              >
                <div className="bg-[#8ba99b]/10 border border-[#8ba99b]/20 rounded-2xl p-4 text-xs md:text-sm leading-relaxed text-[#e0e5e1]/90 flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-[#8ba99b] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#8ba99b] block mb-1">What is Dual N-Back?</strong>
                    Dual N-Back is a cognitive exercise designed to expand your working memory and fluid intelligence. You track two streams of information simultaneously: <span className="text-[#8ba99b] font-semibold">Grid Position</span> and <span className="text-[#d4a373] font-semibold">Spoken Letter</span>.
                  </div>
                </div>

                <div className="bg-[#2e3733]/40 border border-white/5 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6e847c]">The Core Rule (N-Back):</h4>
                  <p className="text-xs md:text-sm text-[#e0e5e1]/80 leading-relaxed">
                    In <strong className="text-[#8ba99b]">2-Back</strong> mode, you compare the CURRENT grid position and letter to what appeared <strong className="text-[#8ba99b]">EXACTLY 2 STEPS AGO</strong>.
                  </p>

                  <div className="grid grid-cols-3 gap-2 pt-2 text-center text-[11px]">
                    <div className="bg-[#1a1f1d] p-2.5 rounded-xl border border-white/5">
                      <span className="text-[#6e847c] block text-[9px] uppercase">Step 1</span>
                      <span className="text-[#e0e5e1] font-bold">Top-Left</span>
                      <span className="text-[#d4a373] block text-[10px]">"B"</span>
                    </div>
                    <div className="bg-[#1a1f1d] p-2.5 rounded-xl border border-white/5 opacity-60">
                      <span className="text-[#6e847c] block text-[9px] uppercase">Step 2</span>
                      <span className="text-[#e0e5e1] font-bold">Center</span>
                      <span className="text-[#d4a373] block text-[10px]">"K"</span>
                    </div>
                    <div className="bg-[#8ba99b]/15 p-2.5 rounded-xl border border-[#8ba99b]/30">
                      <span className="text-[#8ba99b] block text-[9px] uppercase font-bold">Step 3 (Current)</span>
                      <span className="text-[#8ba99b] font-bold">Top-Left</span>
                      <span className="text-[#d4a373] block text-[10px]">"B"</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#8ba99b] text-center font-medium">
                    ✨ Step 3 matches Step 1 in BOTH Position & Audio!
                  </p>
                </div>
              </motion.div>
            )}

            {currentStep === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 text-left"
              >
                <div className="flex items-center gap-2">
                  <Grid className="w-5 h-5 text-[#8ba99b]" />
                  <h4 className="text-sm font-bold text-[#8ba99b]">1. Spatial Position Match</h4>
                </div>

                <p className="text-xs md:text-sm text-[#e0e5e1]/80 leading-relaxed">
                  Watch the 3x3 grid carefully as tiles light up. If the current tile lights up in the <strong className="text-[#8ba99b]">SAME cell as N steps ago</strong>, trigger a Position Match!
                </p>

                {/* Grid Visual Illustration */}
                <div className="bg-[#1a1f1d] border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-3">
                  <div className="grid grid-cols-3 gap-2 w-36 h-36">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div
                        key={i}
                        className={`rounded-lg border transition-colors flex items-center justify-center ${
                          i === 0
                            ? "bg-[#8ba99b] border-[#a8c1b5] shadow-md shadow-[#8ba99b]/40"
                            : "bg-[#2e3733]/60 border-white/5"
                        }`}
                      >
                        {i === 0 && <div className="w-2 h-2 rounded-full bg-[#1a1f1d]" />}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#e0e5e1]/70">Press Key:</span>
                    <kbd className="px-3 py-1 rounded-lg bg-[#8ba99b] text-[#1a1f1d] font-bold text-xs font-mono shadow-sm">
                      L
                    </kbd>
                    <span className="text-xs text-[#e0e5e1]/70">or tap <strong className="text-[#8ba99b]">POSITION</strong> button</span>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 text-left"
              >
                <div className="flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-[#d4a373]" />
                  <h4 className="text-sm font-bold text-[#d4a373]">2. Audio Letter Match</h4>
                </div>

                <p className="text-xs md:text-sm text-[#e0e5e1]/80 leading-relaxed">
                  Listen to the voice prompt spoken during each step (e.g. "B", "H", "T"). If the current letter <strong className="text-[#d4a373]">matches the letter spoken N steps ago</strong>, trigger an Audio Match!
                </p>

                {/* Audio Visual Illustration */}
                <div className="bg-[#1a1f1d] border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-3">
                  <div className="flex items-center justify-center gap-4 py-2">
                    <div className="text-center">
                      <span className="text-[10px] text-[#6e847c] block font-mono">N-Steps Ago</span>
                      <span className="text-2xl font-bold font-mono text-[#e0e5e1]">"C"</span>
                    </div>
                    <span className="text-xs text-[#6e847c]">➔</span>
                    <div className="text-center">
                      <span className="text-[10px] text-[#6e847c] block font-mono">1-Step Ago</span>
                      <span className="text-2xl font-bold font-mono text-[#e0e5e1]/40">"M"</span>
                    </div>
                    <span className="text-xs text-[#6e847c]">➔</span>
                    <div className="text-center p-2 bg-[#d4a373]/15 border border-[#d4a373]/30 rounded-xl">
                      <span className="text-[10px] text-[#d4a373] block font-mono font-bold">CURRENT</span>
                      <span className="text-2xl font-bold font-mono text-[#d4a373]">"C"</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#e0e5e1]/70">Press Key:</span>
                    <kbd className="px-3 py-1 rounded-lg bg-[#d4a373] text-[#1a1f1d] font-bold text-xs font-mono shadow-sm">
                      A
                    </kbd>
                    <span className="text-xs text-[#e0e5e1]/70">or tap <strong className="text-[#d4a373]">AUDIO</strong> button</span>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 text-left"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#9ba8bd]" />
                  <h4 className="text-sm font-bold text-[#9ba8bd]">3. Triple N-Back & Color Match</h4>
                </div>

                <p className="text-xs md:text-sm text-[#e0e5e1]/80 leading-relaxed">
                  When playing in <strong className="text-[#9ba8bd]">Triple Mode</strong>, active tiles also display distinct colors (Green, Amber, Lavender, Rose).
                </p>

                <div className="bg-[#1a1f1d] border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#5da38a] border border-[#7fbda5]" title="Green" />
                    <div className="w-8 h-8 rounded-lg bg-[#dfa15f] border border-[#f2bf8a]" title="Amber" />
                    <div className="w-8 h-8 rounded-lg bg-[#7297cc] border border-[#9fc0ee]" title="Lavender" />
                    <div className="w-8 h-8 rounded-lg bg-[#cc7e8a] border border-[#eba4ae]" title="Rose" />
                  </div>

                  <p className="text-xs text-[#e0e5e1]/80 text-center">
                    If current tile background color matches N steps ago:
                  </p>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#e0e5e1]/70">Press Key:</span>
                    <kbd className="px-3 py-1 rounded-lg bg-[#7297cc] text-[#1a1f1d] font-bold text-xs font-mono shadow-sm">
                      D
                    </kbd>
                    <span className="text-xs text-[#e0e5e1]/70">or tap <strong className="text-[#9ba8bd]">COLOR</strong> button</span>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 4 && (
              <motion.div
                key="step-4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 text-left"
              >
                <div className="flex items-center gap-2">
                  <Keyboard className="w-5 h-5 text-[#8ba99b]" />
                  <h4 className="text-sm font-bold text-[#8ba99b]">Controls Quick Reference & Tips</h4>
                </div>

                <div className="bg-[#2e3733]/40 border border-white/5 rounded-2xl p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-[#e0e5e1]/80">Audio Match</span>
                    <kbd className="px-2 py-0.5 rounded bg-white/10 font-mono font-bold text-[#d4a373]">A</kbd>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-[#e0e5e1]/80">Position Match</span>
                    <kbd className="px-2 py-0.5 rounded bg-white/10 font-mono font-bold text-[#8ba99b]">L</kbd>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-[#e0e5e1]/80">Color Match (Triple)</span>
                    <kbd className="px-2 py-0.5 rounded bg-white/10 font-mono font-bold text-[#7297cc]">D</kbd>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-[#e0e5e1]/80">Pause / Resume</span>
                    <kbd className="px-2 py-0.5 rounded bg-white/10 font-mono font-bold text-[#e0e5e1]">P or Esc</kbd>
                  </div>
                </div>

                <div className="bg-[#8ba99b]/10 border border-[#8ba99b]/20 rounded-2xl p-3.5 text-xs text-[#8ba99b] leading-relaxed">
                  💡 <strong>Pro Tip:</strong> Beginners should start with <strong>2-Back</strong> at <strong>2.5s interval speed</strong>. Once you reach &gt;80% accuracy consistently, level up to 3-Back!
                </div>
              </motion.div>
            )}
          </div>

          {/* Footer Navigation & "Don't show again" */}
          <div className="pt-4 mt-2 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              id="dont-show-again-btn"
              type="button"
              onClick={() => {
                onToggleDontShowAgain(true);
                onClose();
              }}
              className="px-3.5 py-1.5 rounded-xl border border-white/10 bg-[#2e3733]/60 hover:bg-white/10 text-[#6e847c] hover:text-[#e0e5e1] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer select-none self-start sm:self-center"
              title="Don't show automatically on start and exit tutorial"
            >
              <X className="w-3.5 h-3.5" />
              <span>Don't show automatically on start</span>
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {currentStep > 0 && (
                <button
                  id="tutorial-prev-btn"
                  onClick={handlePrev}
                  className="px-3.5 py-2 rounded-xl bg-[#2e3733] hover:bg-white/5 border border-white/5 text-[#e0e5e1] text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
              )}

              <button
                id="tutorial-next-btn"
                onClick={handleNext}
                className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-[#8ba99b] hover:bg-[#a8c1b5] text-[#1a1f1d] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-[#8ba99b]/20 transition-all cursor-pointer"
              >
                {currentStep === totalSteps - 1 ? (
                  <>
                    <span>Got It & Play</span>
                    <Play className="w-3.5 h-3.5 fill-[#1a1f1d]" />
                  </>
                ) : (
                  <>
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
