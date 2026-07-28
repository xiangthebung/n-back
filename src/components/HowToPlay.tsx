import type { ReactNode } from "react";
import { controlLayout } from "../lib/controls";
import { cn } from "../lib/format";
import { MODALITY_LABEL, STIMULUS_COLORS } from "../lib/stimuli";
import type { Modality } from "../lib/types";
import { Dialog } from "./Dialog";
import { PrimaryButton } from "./ui";

function MiniGrid({ active, dim }: { active: number; dim?: boolean }) {
  return (
    <div
      className={cn(
        "grid h-[38px] w-[38px] grid-cols-3 gap-[3px] rounded-lg border border-white/8 bg-white/[0.03] p-[3px]",
        dim && "opacity-45",
      )}
    >
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} className={cn("rounded-[2px]", index === active ? "bg-sage" : "bg-white/8")} />
      ))}
    </div>
  );
}

function Step({ index, title, children }: { index: number; title: string; children: ReactNode }) {
  return (
    <section className="flex gap-3.5">
      <span className="tnum mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/8 text-[11px] font-semibold text-ink/80">
        {index}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <h3 className="text-[14px] font-semibold tracking-tight text-ink">{title}</h3>
        {children}
      </div>
    </section>
  );
}

function KeyRow({ label, keyCap, description }: { label: string; keyCap: string; description: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        <span className="text-[11px] leading-snug text-faint">{description}</span>
      </div>
      <kbd className="flex h-7 min-w-7 items-center justify-center rounded-lg border border-white/12 bg-white/8 px-2 font-sans text-[11px] font-bold text-ink/80">
        {keyCap}
      </kbd>
    </div>
  );
}

const DESCRIPTION: Record<Modality, string> = {
  position: "The square that lights up.",
  audio: "The letter you hear.",
  color: "Tile colour, in triple mode.",
};

export function HowToPlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Same order as the buttons and the keys.
  const slots = controlLayout("triple");

  return (
    <Dialog
      open={open}
      title="How to play"
      onClose={onClose}
      footer={<PrimaryButton onClick={onClose}>Got it</PrimaryButton>}
    >
      <div className="flex flex-col gap-7 pb-2">
        <Step index={1} title="Spot the repeat">
          <p className="text-[13px] leading-relaxed text-muted">
            One cue at a time. At <strong className="font-semibold text-ink">2-back</strong>, answer when
            the cue matches the one from two steps earlier.
          </p>

          <div className="flex items-end gap-3 rounded-2xl border border-white/8 bg-black/20 p-3.5">
            {[
              { label: "2 back", active: 0, dim: false, match: false },
              { label: "1 back", active: 4, dim: true, match: false },
              { label: "Now", active: 0, dim: false, match: true },
            ].map((cue) => (
              <div key={cue.label} className="flex flex-1 flex-col items-center gap-1.5">
                <MiniGrid active={cue.active} dim={cue.dim} />
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    cue.match ? "text-sage" : cue.dim ? "text-faint" : "text-muted",
                  )}
                >
                  {cue.label}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[12px] leading-relaxed text-sage">
            Same square as two back, so that is a position match.
          </p>
        </Step>

        <Step index={2} title="Answer each stream">
          <div className="divide-y divide-white/6">
            {slots.map((slot) => (
              <KeyRow
                key={slot.modality}
                label={MODALITY_LABEL[slot.modality]}
                keyCap={slot.key}
                description={DESCRIPTION[slot.modality]}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            {STIMULUS_COLORS.map((color) => (
              <span
                key={color.name}
                title={color.name}
                className="h-5 w-5 rounded-md"
                style={{ backgroundColor: color.fill }}
              />
            ))}
            <span className="text-[11px] text-faint">Triple mode colours</span>
          </div>
          <p className="text-[12px] leading-relaxed text-muted">
            Each stream is judged on its own, so one cue can match in one stream and not another. Tap the
            buttons or use the keys.
          </p>
        </Step>

        <Step index={3} title="Good to know">
          <ul className="flex flex-col gap-2 text-[13px] leading-relaxed text-muted">
            <li>The first cues are a warm-up. There is nothing to answer yet.</li>
            <li>Staying quiet on a non-repeat counts as correct, so guessing does not pay off.</li>
            <li>
              Press <span className="font-semibold text-ink">Escape</span> to pause.
            </li>
            <li>2-back at an easy pace is a good place to start.</li>
          </ul>
        </Step>
      </div>
    </Dialog>
  );
}
