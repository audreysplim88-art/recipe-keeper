/**
 * TTSManager — wraps window.speechSynthesis for the sous chef feature.
 *
 * Key design decisions:
 * - Streams text sentence-by-sentence as Claude generates it (low latency)
 * - Interrupts immediately when the user starts speaking
 * - Mitigates iOS Safari's ~15s silent TTS cutoff via a heartbeat
 * - Safe to instantiate on the server (all window access is guarded)
 */

// Sentence-ending punctuation followed by whitespace or end-of-string
const SENTENCE_BOUNDARY = /[.!?]+(?=\s|$)/;

// Preferred voice names in priority order
const PREFERRED_VOICES = ['Google US English', 'Samantha', 'Karen', 'Daniel'];

export class TTSManager {
  private buffer = '';
  private queue: string[] = [];
  private speaking = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private heartbeatId: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;
  private readonly onSpeakingChange: (speaking: boolean) => void;

  constructor(onSpeakingChange: (speaking: boolean) => void) {
    this.onSpeakingChange = onSpeakingChange;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Feed a text chunk from Claude's stream. Buffers until a sentence boundary
   * is found, then enqueues and speaks completed sentences immediately.
   * This means the cook hears the first sentence while Claude is still writing.
   */
  appendText(text: string): void {
    this.buffer += text;

    // Extract all completed sentences from the buffer
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
      this.buffer = '';
      this.processQueue();
    }
  }

  /**
   * Immediately cancels all speech and empties the queue.
   * Called the moment the user starts speaking so they're never talking
   * over the AI.
   */
  interrupt(): void {
    if (!this.isAvailable) return;
    window.speechSynthesis.cancel();
    this.queue = [];
    this.buffer = '';
    this.speaking = false;
    this.currentUtterance = null;
    this.onSpeakingChange(false);
  }

  /**
   * Sets up two workarounds for browser TTS quirks:
   * 1. iOS Safari stops speaking after ~15s — a periodic pause/resume heartbeat resets the timer.
   * 2. Chrome pauses TTS when the tab goes to the background — resume on visibility restore.
   *
   * Call once after constructing, before the first session starts.
   */
  setupVisibilityWorkaround(): void {
    if (typeof window === 'undefined') return;

    // iOS heartbeat — every 10s, nudge speechSynthesis to prevent silent cutoff
    this.heartbeatId = setInterval(() => {
      if (this.speaking && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10_000);

    // Chrome background-tab workaround
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible' && this.speaking) {
        window.speechSynthesis.resume();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  /**
   * Clean up timers and event listeners. Call from the component's
   * useEffect cleanup / unmount handler.
   */
  destroy(): void {
    this.interrupt();
    if (this.heartbeatId !== null) {
      clearInterval(this.heartbeatId);
      this.heartbeatId = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  /** True if the browser supports speechSynthesis. */
  get isAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /** True while any speech is playing or queued. */
  get isSpeaking(): boolean {
    return this.speaking;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private processQueue(): void {
    // Guard: already speaking, nothing to speak, or no API available
    if (this.speaking || this.queue.length === 0 || !this.isAvailable) return;

    // Set the flag BEFORE calling speak() to prevent a race condition where
    // a second appendText() call triggers processQueue() again in the same tick
    this.speaking = true;
    this.onSpeakingChange(true);

    const text = this.queue.shift()!;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;   // slightly faster — works well for instructions
    utterance.pitch = 1.0;

    const voice = this.selectVoice();
    if (voice) utterance.voice = voice;

    utterance.onend = () => {
      this.speaking = false;
      this.currentUtterance = null;
      if (this.queue.length > 0) {
        // Chain the next sentence
        this.processQueue();
      } else {
        this.onSpeakingChange(false);
      }
    };

    utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
      // 'interrupted' is thrown by our own interrupt() call — not a real error
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      console.warn('TTS error:', e.error);
      this.speaking = false;
      this.currentUtterance = null;
      if (this.queue.length > 0) {
        this.processQueue();
      } else {
        this.onSpeakingChange(false);
      }
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  /**
   * Picks the best available voice.
   * `getVoices()` may return [] on the first call in Chrome (async loading) —
   * returning null here means the browser will use its default voice,
   * which is fine for early utterances; later ones will pick up the preference.
   */
  private selectVoice(): SpeechSynthesisVoice | null {
    if (!this.isAvailable) return null;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return null;

    // Try preferred voices by name
    for (const name of PREFERRED_VOICES) {
      const match = voices.find((v) => v.name === name);
      if (match) return match;
    }

    // Fall back to first English-language voice
    return voices.find((v) => v.lang.startsWith('en')) ?? null;
  }
}
