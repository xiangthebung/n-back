import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { GRID_SIZE, NEUTRAL_COLOR, STIMULUS_COLORS, type StimulusColor } from "../lib/stimuli";
import type { Trial } from "../lib/types";

export function colorFor(trial: Trial | null, triple: boolean): StimulusColor {
  if (!trial || !triple) return NEUTRAL_COLOR;
  return STIMULUS_COLORS[trial.color] ?? NEUTRAL_COLOR;
}

interface BoardProps {
  trial: Trial | null;
  visible: boolean;
  triple: boolean;
  /** Print the letter (and colour name) on the active tile. */
  showHints: boolean;
  overlay?: ReactNode;
}

export function Board({ trial, visible, triple, showHints, overlay }: BoardProps) {
  const color = colorFor(trial, triple);
  const activeIndex = visible && trial ? trial.position : -1;

  return (
    <div className="relative w-full">
      <div aria-hidden="true" className="grid aspect-square w-full grid-cols-3 gap-2.5 sm:gap-3">
        {Array.from({ length: GRID_SIZE }, (_, index) => (
          <div
            key={index}
            className="relative aspect-square rounded-[20px] border border-white/8 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          >
            <span className="absolute top-1/2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/12" />

            <AnimatePresence>
              {activeIndex === index ? (
                <motion.div
                  className="absolute inset-0 flex flex-col items-center justify-center rounded-[20px]"
                  style={{
                    backgroundColor: color.fill,
                    boxShadow: `0 0 34px ${color.glow}, inset 0 0 0 1px ${color.edge}`,
                  }}
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.13, ease: "easeOut" }}
                >
                  {showHints && trial ? (
                    <>
                      <span className="text-[clamp(1.1rem,5.5vmin,2rem)] leading-none font-bold text-canvas/85">
                        {trial.letter}
                      </span>
                      {triple ? (
                        <span className="mt-1 text-[9px] font-semibold tracking-[0.08em] text-canvas/55 uppercase">
                          {color.name}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="h-3 w-3 rounded-full bg-canvas/15 ring-1 ring-white/25" />
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {overlay}
    </div>
  );
}
