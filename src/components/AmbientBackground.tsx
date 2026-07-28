import { motion, useReducedMotion } from "motion/react";

interface Blob {
  className: string;
  color: string;
  x: number[];
  y: number[];
  duration: number;
}

const BLOBS: Blob[] = [
  {
    className: "left-[8%] top-[12%] h-[42vmax] w-[42vmax]",
    color: "rgba(143, 181, 163, 0.16)",
    x: [0, 60, -30, 0],
    y: [0, -40, 40, 0],
    duration: 42,
  },
  {
    className: "right-[4%] bottom-[10%] h-[46vmax] w-[46vmax]",
    color: "rgba(143, 173, 212, 0.13)",
    x: [0, -50, 40, 0],
    y: [0, 50, -30, 0],
    duration: 54,
  },
  {
    className: "left-[26%] bottom-[22%] h-[34vmax] w-[34vmax]",
    color: "rgba(223, 166, 92, 0.1)",
    x: [0, 40, -50, 0],
    y: [0, -50, 30, 0],
    duration: 48,
  },
];

/**
 * Slow, low-contrast wash behind the app. It dims during a session so the grid
 * stays the only thing moving, and holds still when motion is reduced.
 */
export function AmbientBackground({ dimmed }: { dimmed: boolean }) {
  const reduceMotion = useReducedMotion();

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas">
      <motion.div
        className="absolute inset-0 blur-[110px]"
        initial={{ opacity: 1 }}
        animate={{ opacity: dimmed ? 0.35 : 1 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      >
        {BLOBS.map((blob, index) => (
          <motion.div
            key={index}
            className={`absolute rounded-full ${blob.className}`}
            style={{ backgroundColor: blob.color }}
            animate={reduceMotion ? undefined : { x: blob.x, y: blob.y }}
            transition={{ duration: blob.duration, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </motion.div>

      {/* Vignette keeps the centre of the screen the brightest area. */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,transparent_35%,rgba(4,6,6,0.75)_100%)]" />
    </div>
  );
}
