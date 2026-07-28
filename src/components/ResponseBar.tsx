import { Check, Minus, X } from "lucide-react";
import { cn } from "../lib/format";
import { MODALITY_LABEL } from "../lib/stimuli";
import type { ControlSlot } from "../lib/controls";
import type { Modality } from "../lib/types";
import type { Feedback } from "../game/useSession";
import { Kbd } from "./ui";

const OUTCOME: Record<Exclude<Feedback, "idle">, { label: string; className: string }> = {
  hit: { label: "Match", className: "border-sage/70 bg-sage/15 text-sage-soft" },
  slip: { label: "No match", className: "border-amber/60 bg-amber/12 text-amber" },
  miss: { label: "Missed", className: "border-rose/55 bg-rose/12 text-rose" },
};

function OutcomeIcon({ state }: { state: Exclude<Feedback, "idle"> }) {
  const shared = "h-3.5 w-3.5";
  if (state === "hit") return <Check className={shared} strokeWidth={2.6} />;
  if (state === "slip") return <X className={shared} strokeWidth={2.6} />;
  return <Minus className={shared} strokeWidth={2.6} />;
}

interface ResponseBarProps {
  /** Left-to-right, already matching the keyboard order. */
  slots: ControlSlot[];
  feedback: Record<Modality, Feedback>;
  pressed: Record<Modality, boolean>;
  /** Accepting input right now. */
  enabled: boolean;
  /** Nothing to answer at all (warm-up, count-in, paused) — kept visually quiet. */
  muted: boolean;
  onRespond: (modality: Modality) => void;
}

export function ResponseBar({ slots, feedback, pressed, enabled, muted, onRespond }: ResponseBarProps) {
  const announcement = slots
    .filter((slot) => feedback[slot.modality] !== "idle")
    .map(
      (slot) =>
        `${MODALITY_LABEL[slot.modality]}: ${
          OUTCOME[feedback[slot.modality] as Exclude<Feedback, "idle">].label
        }`,
    )
    .join(". ");

  return (
    <div className="w-full">
      <div className="flex gap-2 sm:gap-3">
        {slots.map(({ modality, key }) => {
          const state = feedback[modality];
          const outcome = state === "idle" ? null : OUTCOME[state];
          const answered = pressed[modality];
          const interactive = enabled && !answered;

          return (
            <button
              key={modality}
              type="button"
              aria-label={`${MODALITY_LABEL[modality]} match`}
              aria-pressed={answered}
              aria-disabled={!interactive}
              onPointerDown={() => {
                if (interactive) onRespond(modality);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  if (interactive) onRespond(modality);
                }
              }}
              className={cn(
                "relative flex min-h-[74px] flex-1 flex-col items-center justify-center gap-1.5 rounded-[22px] border",
                "transition-[background-color,border-color,color,opacity,transform] duration-200",
                outcome
                  ? outcome.className
                  : "border-white/10 bg-white/[0.045] text-ink/80 hover:border-sage/35 hover:bg-white/[0.075]",
                interactive ? "active:scale-[0.985]" : "cursor-default",
                // Only the genuinely inactive states dim, so the short gap between
                // trials does not read as a flicker.
                muted && !outcome && "opacity-55",
              )}
            >
              <span className="text-[13px] font-semibold tracking-tight sm:text-sm">
                {MODALITY_LABEL[modality]}
              </span>

              {outcome ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold">
                  <OutcomeIcon state={state as Exclude<Feedback, "idle">} />
                  {outcome.label}
                </span>
              ) : (
                <Kbd>{key}</Kbd>
              )}
            </button>
          );
        })}
      </div>

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
