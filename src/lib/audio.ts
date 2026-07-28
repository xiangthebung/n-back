/** Resolved by Vite at build time; harmless outside a browser. */
const boopUrl = new URL("../boop.mp3", import.meta.url).href;

export type Cue = "tick" | "start" | "hit" | "slip" | "complete";

interface AudioPreferences {
  sound: boolean;
  voice: boolean;
}

/** Voices that read single letters clearly, in order of preference. */
const PREFERRED_VOICES = [
  "Samantha",
  "Karen",
  "Moira",
  "Daniel",
  "Google US English",
  "Microsoft Aria",
  "Microsoft Zira",
];

const NOVELTY_VOICE = /albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox/i;

type WindowWithLegacyAudio = Window &
  typeof globalThis & { webkitAudioContext?: typeof AudioContext };

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private boop: AudioBuffer | null = null;
  private boopRequest: Promise<void> | null = null;
  private voice: SpeechSynthesisVoice | null = null;
  private voicesBound = false;
  private speechWarmed = false;
  private prefs: AudioPreferences = { sound: true, voice: true };

  get speechSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      typeof window.SpeechSynthesisUtterance === "function"
    );
  }

  setPreferences(prefs: AudioPreferences): void {
    const voiceTurnedOff = this.prefs.voice && !prefs.voice;
    this.prefs = { ...prefs };
    if (voiceTurnedOff) this.stopSpeech();
  }

  /** Call from a user gesture: unlocks playback on iOS and warms the sample cache. */
  prepare(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === "suspended") void ctx.resume();
    void this.loadBoop();
    this.warmSpeech();
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === "undefined") return null;

    const Ctor = window.AudioContext ?? (window as WindowWithLegacyAudio).webkitAudioContext;
    if (!Ctor) return null;

    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
      this.master = null;
    }
    return this.ctx;
  }

  private loadBoop(): Promise<void> {
    if (this.boop) return Promise.resolve();
    if (this.boopRequest) return this.boopRequest;

    const ctx = this.ensureContext();
    if (!ctx) return Promise.resolve();

    this.boopRequest = fetch(boopUrl)
      .then((response) => response.arrayBuffer())
      .then((bytes) => ctx.decodeAudioData(bytes))
      .then((buffer) => {
        this.boop = buffer;
      })
      .catch(() => {
        // Falls back to the synthesised cue below.
      });

    return this.boopRequest;
  }

  private voiceList(): SpeechSynthesisVoice[] {
    if (!this.speechSupported) return [];
    if (!this.voicesBound) {
      this.voicesBound = true;
      window.speechSynthesis.addEventListener("voiceschanged", () => {
        this.voice = null;
      });
    }
    return window.speechSynthesis.getVoices();
  }

  private pickVoice(): SpeechSynthesisVoice | null {
    if (this.voice) return this.voice;

    const voices = this.voiceList().filter((v) => !NOVELTY_VOICE.test(v.name));
    if (voices.length === 0) return null;

    const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
    const pool = english.length > 0 ? english : voices;

    const preferred = PREFERRED_VOICES.map((name) =>
      pool.find((v) => v.name.toLowerCase().includes(name.toLowerCase())),
    ).find(Boolean);

    this.voice = preferred ?? pool.find((v) => v.localService) ?? pool[0] ?? null;
    return this.voice;
  }

  private warmSpeech(): void {
    if (this.speechWarmed || !this.speechSupported) return;
    this.speechWarmed = true;
    try {
      const utterance = new SpeechSynthesisUtterance(" ");
      utterance.volume = 0;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Some engines reject empty utterances; harmless.
    }
  }

  speakLetter(letter: string): void {
    if (!this.prefs.voice || !this.speechSupported) return;
    try {
      window.speechSynthesis.cancel();
      // Lowercase on purpose: several voices prefix an uppercase character with
      // "capital", which would read as "capital L" instead of "L".
      const utterance = new SpeechSynthesisUtterance(letter.trim().slice(0, 1).toLowerCase());
      const voice = this.pickVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Never let speech break the trial loop.
    }
  }

  stopSpeech(): void {
    if (!this.speechSupported) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }

  /** `stacked` raises the pitch when several streams are answered in the same trial. */
  cue(name: Cue, stacked = 0): void {
    if (!this.prefs.sound) return;
    const ctx = this.ensureContext();
    const out = this.master;
    if (!ctx || !out) return;
    if (ctx.state === "suspended") void ctx.resume();

    const now = ctx.currentTime;

    // Audio is decoration: a failing node graph must never interrupt a trial.
    try {
      switch (name) {
        case "hit":
          this.playHit(ctx, out, now, stacked);
          break;
        case "slip":
          this.playSlip(ctx, out, now);
          break;
        case "tick":
          this.playTone(ctx, out, now, { freq: 520, type: "sine", peak: 0.06, decay: 0.09 });
          break;
        case "start":
          this.playSwell(ctx, out, now);
          break;
        case "complete":
          this.playTone(ctx, out, now, { freq: 587.33, type: "sine", peak: 0.12, decay: 0.5 });
          this.playTone(ctx, out, now + 0.16, { freq: 880, type: "sine", peak: 0.1, decay: 0.7 });
          break;
      }
    } catch {
      // Ignore and keep playing.
    }
  }

  private playHit(ctx: AudioContext, out: GainNode, now: number, stacked: number): void {
    const rate = stacked >= 2 ? 1.4983 : stacked === 1 ? 1.2599 : 1;

    if (this.boop) {
      const source = ctx.createBufferSource();
      source.buffer = this.boop;
      source.playbackRate.value = rate;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.75, now);
      source.connect(gain);
      gain.connect(out);
      source.start(now);
      return;
    }

    // Warm, short "boop" fallback: pitch drop plus a lowpassed body.
    const fundamental = 120 * rate;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.5, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(340, now);
    filter.Q.setValueAtTime(1.1, now);
    filter.connect(gain);
    gain.connect(out);

    for (const type of ["sine", "triangle"] as OscillatorType[]) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(fundamental * 1.5, now);
      osc.frequency.exponentialRampToValueAtTime(fundamental, now + 0.015);
      osc.connect(filter);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  }

  private playSlip(ctx: AudioContext, out: GainNode, now: number): void {
    // Soft wood-block tap rather than a buzzer: informative, not punishing.
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(360, now);
    filter.Q.setValueAtTime(2.5, now);
    filter.connect(gain);
    gain.connect(out);

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(158, now);
    osc.frequency.exponentialRampToValueAtTime(104, now + 0.11);
    osc.connect(filter);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  private playSwell(ctx: AudioContext, out: GainNode, now: number): void {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    gain.connect(out);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(293.66, now);
    osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.15);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.85);
  }

  private playTone(
    ctx: AudioContext,
    out: GainNode,
    at: number,
    opts: { freq: number; type: OscillatorType; peak: number; decay: number },
  ): void {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(opts.peak, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + opts.decay);
    gain.connect(out);

    const osc = ctx.createOscillator();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.freq, at);
    osc.connect(gain);
    osc.start(at);
    osc.stop(at + opts.decay + 0.05);
  }
}

export const audio = new AudioEngine();
