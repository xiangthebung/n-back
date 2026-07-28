import type { CSSProperties, ReactNode } from "react";
import { cn } from "../lib/format";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-white/8 bg-white/[0.035] backdrop-blur-xl",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_48px_-32px_rgba(0,0,0,0.9)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold tracking-tight text-ink">{label}</span>
        {value ? <span className="tnum text-[13px] text-muted">{value}</span> : null}
      </div>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-faint">{hint}</p> : null}
    </div>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  caption?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="grid grid-cols-2 gap-1 rounded-2xl bg-black/25 p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center rounded-[14px] px-3 py-2 transition-colors duration-200",
              active
                ? "bg-sage text-canvas shadow-[0_1px_10px_rgba(143,181,163,0.25)]"
                : "text-muted hover:bg-white/5 hover:text-ink",
            )}
          >
            <span className="text-[13px] font-semibold tracking-tight">{option.label}</span>
            {option.caption ? (
              <span className={cn("text-[11px]", active ? "text-canvas/70" : "text-faint")}>
                {option.caption}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function LevelPicker({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const levels = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div role="group" aria-label="Steps back" className="flex gap-1.5">
      {levels.map((level) => {
        const active = level === value;
        return (
          <button
            key={level}
            type="button"
            aria-pressed={active}
            aria-label={`${level}-back`}
            onClick={() => onChange(level)}
            className={cn(
              "tnum flex h-11 flex-1 items-center justify-center rounded-2xl border text-[15px] font-semibold transition-colors duration-200",
              active
                ? "border-transparent bg-sage text-canvas"
                : "border-white/8 bg-white/[0.03] text-muted hover:bg-white/[0.07] hover:text-ink",
            )}
          >
            {level}
          </button>
        );
      })}
    </div>
  );
}

export function PaceSlider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      className="pace-slider"
      style={{ "--range-fill": `${fill}%` } as CSSProperties}
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label="Seconds per trial"
      aria-valuetext={`${(value / 1000).toFixed(1)} seconds per trial`}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

export function Toggle({
  label,
  caption,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  caption?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-center justify-between gap-4 rounded-2xl px-1 py-2 text-left transition-opacity",
        disabled && "opacity-50",
      )}
    >
      <span className="flex flex-col">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        {caption ? <span className="text-[11px] leading-snug text-faint">{caption}</span> : null}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-sage" : "bg-white/12",
        )}
      >
        <span
          className={cn(
            "absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-[23px]" : "translate-x-[3px]",
          )}
        />
      </span>
    </button>
  );
}

export function PrimaryButton({
  children,
  onClick,
  className,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={cn(
        "flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-sage px-6 text-[15px] font-semibold tracking-tight text-canvas",
        "transition-[background-color,transform] duration-200 hover:bg-sage-soft active:scale-[0.99]",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function QuietButton({
  children,
  onClick,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  tone?: "neutral" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border px-5 text-[13px] font-semibold tracking-tight",
        "transition-colors duration-200",
        tone === "danger"
          ? "border-rose/25 text-rose hover:bg-rose/10"
          : "border-white/10 text-ink/85 hover:bg-white/[0.06]",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "kbd-hint h-5 min-w-5 items-center justify-center rounded-[6px] border border-white/15 bg-white/8 px-1.5",
        "font-sans text-[10px] font-bold tracking-wide text-ink/70",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
