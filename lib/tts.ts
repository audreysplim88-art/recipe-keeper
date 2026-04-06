/**
 * TTSManager — text-to-speech engine for the sous chef feature.
 *
 * Uses ElevenLabs API (via /api/tts proxy) for natural-sounding speech,
 * with automatic fallback to browser speechSynthesis if ElevenLabs fails.
 *
 * Key design decisions:
 * - Streams text sentence-by-sentence as Claude generates it (low latency)
 * - Pre-fetches the next sentence while the current one plays (pipelining)
 * - Interrupts immediately when the user starts speaking
 * - Falls back to browser speechSynthesis on network/API errors
 * - Safe to instantiate on the server (all window access is guarded)
 */

import {
  TTS_SPEECH_RATE,
  TTS_SPEECH_PITCH,
  TTS_HEARTBEAT_INTERVAL_MS,
  TTS_END_POLL_GRACE_MS,
  TTS_END_POLL_INTERVAL_MS,
  TTS_PREFERRED_VOICES,
} from "@/lib/constants";

// Sentence-ending punctuation followed by whitespace or end-of-string
const SENTENCE_BOUNDARY = /[.!?]+(?=\s|$)/;

type Backend = "elevenlabs" | "browser";

export interface TTSManagerOptions {
  /** Force a specific backend. Defaults to "elevenlabs". */
  backend?: Backend;
}

export class TTSManager {
  private buffer = "";
  private queue: string[] = [];
  private speaking = false;
  private backend: Backend;

  // ─── ElevenLabs state ────────────────────────────────────────────────────
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private prefetchPromise: Promise<AudioBuffer | null> | null = null;
  private prefetchText: string | null = null;

  // ─── Browser TTS fallback state ──────────────────────────────────────────
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private heartbeatId: ReturnType<typeof setInterval> | null = null;
  private endPollId: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;
  private cachedVoice: SpeechSynthesisVoice | null = null;
  private voicesChangedHandler: (() => void) | null = null;

  private readonly onSpeakingChange: (speaking: boolean) => void;

  constructor(
    onSpeakingChange: (speaking: boolean) => void,
    options?: TTSManagerOptions
  ) {
    this.onSpeakingChange = onSpeakingChange;
    this.backend = options?.backend ?? "elevenlabs";
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Public API (unchanged from before — SousChefSession doesn't need edits)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Feed a text chunk from Claude's stream. Buffers until a sentence boundary
   * is found, then enqueues and speaks completed sentences immediately.
   */
  appendText(text: string): void {
    this.buffer += text;

    let match: RegExpExecArray | null;
    while ((match = SENTENCE_BOUNDARY.exec(this.buffer)) !== null) {
      const end = match.index + match[0].length;
      const sentence = this.buffer.slice(0, end).trim();
      this.buffer = this.buffer.slice(end).trimStart();
      if (sentence.length > 0) {
        this.queue.push(sentence);
        this.processQueue();
      }
    }
  }

  /**
   * Called when Claude's `[DONE]` event fires — flushes any remaining
   * buffer that didn't end with sentence punctuation.
   */
  flush(): void {
    const remaining = this.buffer.trim();
    if (remaining.length > 0) {
      this.queue.push(remaining);
      this.buffer = "";
      this.processQueue();
    }
  }

  /**
   * Unlocks audio playback from a direct user gesture handler.
   *
   * For ElevenLabs: creates and resumes the AudioContext.
   * For browser TTS: speaks a silent utterance to unblock iOS Safari.
   *
   * Must be called synchronously from a click/tap handler before any await.
   */
  prime(): void {
    // Prime AudioContext for ElevenLabs
    if (typeof window !== "undefined") {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }
      if (this.audioContext.state === "suspended") {
        this.audioContext.resume();
      }
    }

    // Also prime browser speechSynthesis as fallback
    if (this.browserAvailable) {
      const utterance = new SpeechSynthesisUtterance("");
      utterance.volume = 0;
      window.speechSynthesis.speak(utterance);
    }
  }

  /**
   * Immediately cancels all speech and empties the queue.
   */
  interrupt(): void {
    // Cancel ElevenLabs playback
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // already stopped
      }
      this.currentSource = null;
    }
    this.prefetchPromise = null;
    this.prefetchText = null;

    // Cancel browser TTS
    if (this.browserAvailable) {
      window.speechSynthesis.cancel();
    }
    this.clearEndPoll();

    this.queue = [];
    this.buffer = "";
    this.speaking = false;
    this.currentUtterance = null;
    this.onSpeakingChange(false);
  }

  /**
   * Sets up workarounds for browser TTS quirks (heartbeat, visibility).
   * Also primes voices for the browser fallback.
   */
  setupVisibilityWorkaround(): void {
    if (typeof window === "undefined") return;

    // Eager voice loading for browser fallback
    this.primeVoices();

    // iOS heartbeat for browser TTS fallback
    this.heartbeatId = setInterval(() => {
      if (
        this.speaking &&
        this.backend === "browser" &&
        window.speechSynthesis.speaking
      ) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, TTS_HEARTBEAT_INTERVAL_MS);

    // Chrome background-tab workaround
    this.visibilityHandler = () => {
      if (document.visibilityState === "visible" && this.speaking) {
        if (this.backend === "browser") {
          window.speechSynthesis.resume();
        }
        if (this.audioContext?.state === "suspended") {
          this.audioContext.resume();
        }
      }
    };
    document.addEventListener("visibilitychange", this.visibilityHandler);
  }

  /**
   * Clean up timers, listeners, and audio context.
   */
  destroy(): void {
    this.interrupt();
    this.clearEndPoll();
    if (this.heartbeatId !== null) {
      clearInterval(this.heartbeatId);
      this.heartbeatId = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.voicesChangedHandler && this.browserAvailable) {
      window.speechSynthesis.removeEventListener(
        "voiceschanged",
        this.voicesChangedHandler
      );
      this.voicesChangedHandler = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  /** True if the browser supports at least one TTS backend. */
  get isAvailable(): boolean {
    return (
      typeof window !== "undefined" &&
      ("speechSynthesis" in window || typeof AudioContext !== "undefined")
    );
  }

  /** True while any speech is playing or queued. */
  get isSpeaking(): boolean {
    return this.speaking;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Queue processing — dispatches to ElevenLabs or browser backend
  // ═══════════════════════════════════════════════════════════════════════════

  private processQueue(): void {
    if (this.speaking || this.queue.length === 0) return;

    this.speaking = true;
    this.onSpeakingChange(true);

    if (this.backend === "elevenlabs") {
      this.speakElevenLabs();
    } else {
      this.speakBrowser();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  ElevenLabs backend
  // ═══════════════════════════════════════════════════════════════════════════

  private async speakElevenLabs(): Promise<void> {
    const text = this.queue.shift()!;

    try {
      // Use prefetched audio if available for this exact text
      let audioBuffer: AudioBuffer | null = null;
      if (this.prefetchText === text && this.prefetchPromise) {
        audioBuffer = await this.prefetchPromise;
        this.prefetchPromise = null;
        this.prefetchText = null;
      }

      // Otherwise fetch fresh
      if (!audioBuffer) {
        audioBuffer = await this.fetchAudio(text);
      }

      if (!audioBuffer) {
        throw new Error("Failed to decode audio");
      }

      // Start prefetching the next sentence while this one plays
      if (this.queue.length > 0) {
        this.prefetchText = this.queue[0];
        this.prefetchPromise = this.fetchAudio(this.queue[0]);
      }

      // Play the audio
      await this.playAudioBuffer(audioBuffer);

      // Sentence finished — process next or signal done
      this.speaking = false;
      if (this.queue.length > 0) {
        this.processQueue();
      } else {
        this.onSpeakingChange(false);
      }
    } catch (err) {
      console.warn("ElevenLabs TTS failed, falling back to browser:", err);
      // Put the text back at the front of the queue and switch backends
      this.queue.unshift(text);
      this.speaking = false;
      this.backend = "browser";
      this.prefetchPromise = null;
      this.prefetchText = null;
      this.processQueue();
    }
  }

  private async fetchAudio(text: string): Promise<AudioBuffer | null> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`TTS API returned ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return this.audioContext.decodeAudioData(arrayBuffer);
  }

  private playAudioBuffer(buffer: AudioBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.audioContext) {
        reject(new Error("No AudioContext"));
        return;
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      this.currentSource = source;

      source.onended = () => {
        this.currentSource = null;
        resolve();
      };

      source.start(0);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Browser speechSynthesis backend (fallback)
  // ═══════════════════════════════════════════════════════════════════════════

  private get browserAvailable(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  private speakBrowser(): void {
    if (!this.browserAvailable) {
      this.speaking = false;
      this.onSpeakingChange(false);
      return;
    }

    const text = this.queue.shift()!;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = TTS_SPEECH_RATE;
    utterance.pitch = TTS_SPEECH_PITCH;

    const voice = this.selectVoice();
    if (voice) utterance.voice = voice;

    let completed = false;
    const onComplete = () => {
      if (completed) return;
      completed = true;
      this.clearEndPoll();
      this.speaking = false;
      this.currentUtterance = null;
      if (this.queue.length > 0) {
        this.processQueue();
      } else {
        this.onSpeakingChange(false);
      }
    };

    utterance.onend = onComplete;

    utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
      if (e.error === "interrupted" || e.error === "canceled") return;
      console.warn("Browser TTS error:", e.error);
      onComplete();
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);

    // iOS Safari fallback poll
    this.clearEndPoll();
    const startTime = Date.now();
    this.endPollId = setInterval(() => {
      if (Date.now() - startTime < TTS_END_POLL_GRACE_MS) return;
      if (!window.speechSynthesis.speaking) {
        onComplete();
      }
    }, TTS_END_POLL_INTERVAL_MS);
  }

  // ─── Shared helpers ────────────────────────────────────────────────────────

  private clearEndPoll(): void {
    if (this.endPollId !== null) {
      clearInterval(this.endPollId);
      this.endPollId = null;
    }
  }

  private findBestVoice(): SpeechSynthesisVoice | null {
    if (!this.browserAvailable) return null;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return null;

    for (const name of TTS_PREFERRED_VOICES) {
      const match = voices.find((v) => v.name === name);
      if (match) return match;
    }

    return voices.find((v) => v.lang.startsWith("en")) ?? null;
  }

  private selectVoice(): SpeechSynthesisVoice | null {
    return this.cachedVoice ?? this.findBestVoice();
  }

  private primeVoices(): void {
    if (!this.browserAvailable) return;

    this.cachedVoice = this.findBestVoice();

    this.voicesChangedHandler = () => {
      this.cachedVoice = this.findBestVoice();
    };
    window.speechSynthesis.addEventListener(
      "voiceschanged",
      this.voicesChangedHandler
    );
  }
}
