# N-Back

Dual and triple n-back working-memory practice, without the gamification.

Live at [n-back.xiangli3625.workers.dev](https://n-back.xiangli3625.workers.dev/).

```bash
npm install
npm run dev       # http://localhost:3000
npm run verify    # typecheck, tests, build
```

Everything runs in the browser. No accounts, no server, no analytics; sessions are
kept in `localStorage` on your own device.

## The rule

You are not remembering a list. You are comparing the cue on screen **now** against
the cue from exactly *n* steps ago — and the cues in between are noise you have to
hold anyway.

- **Dual** — a square on a 3×3 grid, and a spoken letter. Two streams.
- **Triple** — adds a colour. Three.

Each stream is answered and scored **separately**, which is the part most
descriptions of n-back leave out: the third cue can repeat the first cue's square
without repeating its letter, and getting that right means pressing one key and not
the other.

## Why it looks like this

Most n-back implementations are either a lab instrument or a brain-training product
that promises you a higher IQ. This one is four quiet minutes.

**Pressing everything scores worse than pressing nothing.** Accuracy is *balanced*:
it counts correct silences as well as correct presses, averaged across streams, so
holding both keys down cannot inflate it. See `src/lib/scoring.ts` — the hit rate on
its own is the number that makes mashing look like skill.

**No streaks, no levels, no badges.** The results screen reports what happened —
targets, hits, misses, false presses, per stream — and one factual line about how it
went. It will suggest moving up at 85% and down at 55%, and otherwise suggests
another round at the same level, because that is usually the honest answer.

**The letters are chosen for not rhyming.** Eight consonants that do not sound alike,
so a miss is a memory failure rather than a hearing one.

## Shape

```
src/
  game/useSession.ts   the session clock: trial advance, response capture, ending
  lib/sequence.ts      sequence generation and the target rule
  lib/scoring.ts       balanced accuracy, per stream
  lib/stimuli.ts       the letter set, the grid, the colours
  lib/audio.ts         spoken letters and feedback tones
  lib/storage.ts       session history, on the device
  components/          home, play, results, board, response bar, dialogs
tests/
  sequence.test.ts     generation, target placement, the n-back rule itself
  scoring.test.ts      that pressing everything cannot beat playing well
```

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Vite on `:3000` |
| `npm run build` | Production bundle into `dist/` |
| `npm run preview` | Serve the built bundle |
| `npm run lint` | `tsc --noEmit` |
| `npm test` | Vitest: sequence generation and scoring |
| `npm run verify` | All three, in the order CI runs them |
