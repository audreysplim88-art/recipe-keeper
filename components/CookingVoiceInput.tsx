"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// iOS Safari requires SpeechRecognition.start() to be called from a direct
// user gesture (tap). Programmatic activation via useEffect is blocked.
// We detect iOS once at module level so it's stable across renders.
const isIOS =
  typeof navigator !== "undefined" &&
  /iPad|iPhone|iPod/.test(navigator.userAgent);

// ─── Web Speech API types ─────────────────────────────────────────────────────
// Declared globally in lib/speech-api.d.ts — no local declarations needed.

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CookingVoiceInputProps {
  /** Whether the component should be actively listening. Toggled by the parent
   *  based on whether the AI is currently speaking. */
  isActive: boolean;
  /** Called with the final transcript when a 2-second silence is detected. */
  onSend: (text: string) => void;
  /** Called immediately when the user starts speaking (so TTS can be interrupted). */
  onSpeechStart?: () => void;
  /** Disables the entire component (e.g. while the AI is loading a response). */
  disabled?: boolean;
}

/** How long (ms) of silence after speech before we auto-send the utterance. */
const SILENCE_MS = 2000;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * CookingVoiceInput
 *
 * Purpose-built for short conversational utterances:
 *  - Activates / deactivates based on the `isActive` prop
 *  - Auto-sends after 2 s of silence (clears transcript for next utterance)
 *  - Calls `onSpeechStart` immediately on any speech (interrupts TTS)
 *  - Falls back to a visible text <input> if SpeechRecognition is unavailable
 */
export default function CookingVoiceInput({
  isActive,
  onSend,
  onSpeechStart,
  disabled = false,
}: CookingVoiceInputProps) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef<string>("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep stable refs so event handlers never close over stale props
  const isActiveRef = useRef(isActive);
  const onSendRef = useRef(onSend);
  const onSpeechStartRef = useRef(onSpeechStart);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { onSendRef.current = onSend; }, [onSend]);
  useEffect(() => { onSpeechStartRef.current = onSpeechStart; }, [onSpeechStart]);

  const isSupported =
    typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  // iOS tap-to-speak state
  const [iosListening, setIosListening] = useState(false);
  // Mic denied / error message
  const [micError, setMicError] = useState<string | null>(null);

  // ─── Send helper ────────────────────────────────────────────────────────────

  const sendAndClear = useCallback(() => {
    const text = transcriptRef.current.trim();
    if (text) {
      onSendRef.current(text);
    }
    transcriptRef.current = "";
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  // ─── Recognition setup ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!isSupported) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Notify parent immediately on first speech so TTS can be interrupted
      if (transcriptRef.current === "") {
        onSpeechStartRef.current?.();
      }

      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalChunk += event.results[i][0].transcript;
        }
      }

      if (finalChunk) {
        transcriptRef.current += finalChunk + " ";
      }

      // Reset the silence timer on every result
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        sendAndClear();
      }, SILENCE_MS);
    };

    recognition.onend = () => {
      if (isIOS) {
        // On iOS: don't auto-restart — wait for the next explicit tap.
        setIosListening(false);
        return;
      }
      // Non-iOS: auto-restart after a short delay to avoid InvalidStateError.
      if (isActiveRef.current && recognitionRef.current) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch {
            // Already running — ignore
          }
        }, 150);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setMicError(
          "Microphone access was denied. On iPhone: Settings → Safari → Microphone → allow this site."
        );
        setIosListening(false);
        return;
      }
      // Ignore transient / expected errors
      if (event.error === "no-speech" || event.error === "aborted") return;
      console.warn("CookingVoiceInput speech error:", event.error);
    };

    recognitionRef.current = recognition;

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      recognition.abort();
      recognitionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupported]);

  // ─── Activate / deactivate based on isActive prop ───────────────────────────

  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (isIOS) {
      // iOS: never start programmatically — only abort when deactivated.
      // The first start comes from a direct tap (handleIOSTap).
      if (!isActive || disabled) {
        recognition.abort();
        setIosListening(false);
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      }
      return;
    }

    if (isActive && !disabled) {
      try {
        recognition.start();
      } catch {
        // Already running — harmless
      }
    } else {
      recognition.abort();
      // Send any pending utterance when deactivated
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      sendAndClear();
    }
  }, [isActive, disabled, sendAndClear]);

  // ─── iOS tap-to-speak handler ────────────────────────────────────────────────

  const handleIOSTap = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || disabled || !isActive) return;
    setMicError(null);
    setIosListening(true);
    try {
      recognition.start();
    } catch {
      setIosListening(false);
    }
  }, [disabled, isActive]);

  // ─── iOS voice UI (tap-to-speak) ─────────────────────────────────────────────

  if (isIOS && isSupported) {
    return (
      <div className="flex flex-col items-center gap-2 w-full">
        {micError && (
          <p className="text-red-400 text-xs text-center px-4 leading-relaxed">{micError}</p>
        )}
        <button
          onClick={handleIOSTap}
          disabled={disabled || !isActive || iosListening}
          aria-label={iosListening ? "Listening — speak now" : "Tap to speak"}
          className={`flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-white transition-all duration-200 ${
            iosListening
              ? "bg-amber-500 border border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)] animate-pulse"
              : isActive && !disabled
              ? "bg-amber-600 hover:bg-amber-500 active:scale-95"
              : "bg-gray-700 opacity-50 cursor-not-allowed"
          }`}
        >
          <span className="text-xl">🎙</span>
          <span>{iosListening ? "Listening…" : "Tap to speak"}</span>
        </button>
        {isActive && !iosListening && !disabled && !micError && (
          <p className="text-xs text-gray-500">Tap when ready to speak</p>
        )}
      </div>
    );
  }

  // ─── Fallback: text input ────────────────────────────────────────────────────

  if (!isSupported) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const input = (e.currentTarget.elements.namedItem("message") as HTMLInputElement);
          const text = input.value.trim();
          if (text) {
            onSend(text);
            input.value = "";
          }
        }}
        className="flex gap-2 w-full"
      >
        <input
          name="message"
          type="text"
          disabled={disabled}
          placeholder="Type your response and press Enter…"
          className="flex-1 px-4 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-amber-400 disabled:opacity-50"
          aria-label="Your message to the sous chef"
        />
        <button
          type="submit"
          disabled={disabled}
          className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50 transition-colors"
        >
          Send
        </button>
      </form>
    );
  }

  // ─── Voice UI ────────────────────────────────────────────────────────────────

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={
        disabled
          ? "Waiting…"
          : isActive
          ? "Listening — speak your response"
          : "AI is speaking"
      }
      className={`flex items-center justify-center gap-3 px-6 py-4 rounded-full transition-all duration-300 ${
        disabled
          ? "bg-gray-800 opacity-50"
          : isActive
          ? "bg-amber-500/20 border border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
          : "bg-blue-500/20 border border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]"
      }`}
    >
      {/* Animated dot */}
      <span
        className={`w-3 h-3 rounded-full ${
          disabled
            ? "bg-gray-500"
            : isActive
            ? "bg-amber-400 animate-pulse"
            : "bg-blue-400 animate-pulse"
        }`}
      />
      <span className="text-sm font-medium text-gray-200">
        {disabled ? "Waiting…" : isActive ? "Listening" : "Speaking"}
      </span>
    </div>
  );
}
