"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Recipe } from "@/lib/types";
import { API_BASE } from "@/lib/api";
import { TTSManager } from "@/lib/tts";
import CookingVoiceInput from "@/components/CookingVoiceInput";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

type SessionPhase = "waiting" | "initializing" | "cooking" | "complete" | "error";

interface SousChefSessionProps {
  recipe: Recipe;
  onExit: () => void;
}

// ─── Wake phrase detection ─────────────────────────────────────────────────────
// Isolated in a single function so it can be swapped for a noise-robust
// library (e.g. Porcupine, Whisper) without touching the session UI.

const WAKE_PHRASE_PATTERN =
  /hello\s*chef|hey\s*chef|hi\s*chef|start|begin|let'?s\s*(go|cook|start)|ready/i;

function isWakePhrase(text: string): boolean {
  return WAKE_PHRASE_PATTERN.test(text.trim());
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Scan Claude's response for step advancement language */
function detectCurrentStep(text: string, totalSteps: number, current: number): number {
  const lower = text.toLowerCase();
  // Look for "step 2", "step two", "step 3", etc.
  for (let i = current + 1; i <= totalSteps; i++) {
    const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
    if (lower.includes(`step ${i}`) || (i < words.length && lower.includes(`step ${words[i]}`))) {
      return i;
    }
  }
  // Detect advancement phrases only if we're not already at the last step
  const advancePhrases = ["moving on", "next up", "now we'll", "now let's", "let's move", "on to the next"];
  if (current < totalSteps && advancePhrases.some((p) => lower.includes(p))) {
    return current + 1;
  }
  return current;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SousChefSession({ recipe, onExit }: SousChefSessionProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [phase, setPhase] = useState<SessionPhase>("waiting");
  const [currentStep, setCurrentStep] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showMobileSteps, setShowMobileSteps] = useState(false);

  const ttsRef = useRef<TTSManager | null>(null);
  const micPermissionRef = useRef(false);

  const totalSteps = recipe.instructions.length;

  // ─── TTS setup ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const tts = new TTSManager((speaking) => {
      setIsSpeaking(speaking);
      if (!speaking) {
        setIsListening(true);
      }
    });
    tts.setupVisibilityWorkaround();
    ttsRef.current = tts;

    return () => {
      tts.destroy();
      ttsRef.current = null;
    };
  }, []);

  // ─── Request mic permission on mount (no conversation yet) ──────────────────

  useEffect(() => {
    if (micPermissionRef.current) return;
    micPermissionRef.current = true;

    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {
        // Permission denied — fall back to text input; no-op here
      });
    }

    // Mic is active during waiting (for wake phrase detection)
    setIsListening(true);
  }, []);

  // ─── Send a message to the sous chef API ────────────────────────────────────

  const sendMessage = useCallback(
    async (userText: string, prependMessages: ConversationMessage[] = []) => {
      setIsListening(false);
      setIsLoading(true);
      setStreamingText("");

      const newUserMessage: ConversationMessage = { role: "user", content: userText };
      const updatedMessages = [...prependMessages, newUserMessage];
      setMessages(updatedMessages);

      let fullResponse = "";

      try {
        const res = await fetch(`${API_BASE}/api/sous-chef`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: updatedMessages, recipe }),
        });

        if (!res.ok || !res.body) {
          throw new Error("API request failed");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              ttsRef.current?.flush();
              break;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.text) {
                fullResponse += parsed.text;
                setStreamingText(fullResponse);
                ttsRef.current?.appendText(parsed.text);
              }
            } catch {
              // Ignore malformed JSON chunks
            }
          }
        }

        // Finalise the assistant message
        const assistantMessage: ConversationMessage = {
          role: "assistant",
          content: fullResponse,
        };
        const finalMessages = [...updatedMessages, assistantMessage];
        setMessages(finalMessages);
        setStreamingText("");

        // Detect step advancement
        setCurrentStep((prev) => detectCurrentStep(fullResponse, totalSteps, prev));

        // Detect session complete
        if (currentStep >= totalSteps && fullResponse.length > 0) {
          setPhase("complete");
        } else {
          setPhase("cooking");
        }
      } catch (err) {
        console.error("Sous chef error:", err);
        setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
        setPhase("error");
      } finally {
        setIsLoading(false);
      }
    },
    [recipe, totalSteps, currentStep]
  );

  // ─── Begin session (called by wake phrase or button) ────────────────────────
  // Isolated here so it can be replaced with a noise-robust wake-word library
  // (e.g. Porcupine) without touching the session UI or TTS layer.

  const handleBegin = useCallback(
    (triggerText: string) => {
      // Prime TTS from this user gesture so iOS Safari allows async audio playback.
      // iOS blocks speechSynthesis.speak() in fetch callbacks unless audio was
      // first triggered synchronously from a direct tap.
      ttsRef.current?.prime();
      setPhase("initializing");
      sendMessage(triggerText, []);
    },
    [sendMessage]
  );

  // ─── Handle user speech ──────────────────────────────────────────────────────

  const handleSend = useCallback(
    (text: string) => {
      if (phase === "waiting") {
        // Only respond to wake phrases during the waiting phase
        if (isWakePhrase(text)) {
          handleBegin(text);
        }
        // Non-matching speech is silently ignored
        return;
      }
      sendMessage(text, messages);
    },
    [phase, handleBegin, sendMessage, messages]
  );

  const handleSpeechStart = useCallback(() => {
    if (phase !== "waiting") {
      ttsRef.current?.interrupt();
    }
    setIsListening(true);
  }, [phase]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  const currentStepText =
    currentStep > 0 && currentStep <= totalSteps
      ? recipe.instructions[currentStep - 1]
      : null;

  // Last few conversation messages for the log
  const recentMessages = messages.slice(-6);

  // ── Mic permission ────────────────────────────────────────────────────────
  const [micPermission, setMicPermission] = useState<"prompt" | "granted" | "denied">("prompt");

  useEffect(() => {
    // Silently check current permission state without triggering a prompt
    if (typeof navigator === "undefined") { setMicPermission("prompt"); return; }

    // Try the Permissions API first (non-intrusive check)
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: "microphone" as PermissionName })
        .then((result) => {
          if (result.state === "granted") setMicPermission("granted");
          else if (result.state === "denied") setMicPermission("denied");
          else setMicPermission("prompt"); // "prompt" = not yet asked
        })
        .catch(() => setMicPermission("prompt")); // Safari may not support this — show button
    } else {
      setMicPermission("prompt"); // Permissions API not available — show button
    }
  }, []);

  const requestMicPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicPermission("granted");
    } catch {
      setMicPermission("denied");
    }
  }, []);

  // ── Waiting screen ──────────────────────────────────────────────────────────
  if (phase === "waiting") {
    return (
      <div className="fixed inset-0 bg-gray-950 text-white flex flex-col items-center justify-center gap-8 px-6">
        {/* Exit */}
        <button
          onClick={onExit}
          className="absolute top-4 left-4 p-2 -m-2 flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"
          style={{ minWidth: 44, minHeight: 44 }}
          aria-label="Exit cooking session"
        >
          ← Exit
        </button>

        {/* Prompt */}
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-2xl font-bold text-white">Ready to cook?</h1>
          <p className="text-lg text-amber-300 font-semibold">{recipe.title}</p>
          <p className="text-gray-400 text-sm leading-relaxed max-w-md mt-1">
            No more stains on your beautiful recipe books or cards, or trying to scroll through a
            recipe on your screen with sticky fingers. Talk to the Dodol Sous Chef and let it assist
            you while you work in the kitchen — ask it to guide you through cooking steps and
            ingredients, as well as remind you about helpful tips and tricks.
          </p>

          {micPermission === "granted" ? (
            <p className="text-gray-400 text-sm">
              Say <span className="text-white font-medium">&ldquo;Hello Chef&rdquo;</span> to begin,
              or tap the button below
            </p>
          ) : micPermission === "denied" ? (
            <div className="flex flex-col items-center gap-3 mt-2 bg-gray-900 rounded-2xl p-5">
              <p className="text-red-400 text-sm font-medium">
                🎙 Microphone access was denied
              </p>
              <p className="text-gray-400 text-xs max-w-xs leading-relaxed">
                The Sous Chef needs your microphone to listen while you cook.
                Please enable it in your device settings:
              </p>
              <p className="text-white text-xs font-medium">
                Settings → Safari → Microphone → Allow
              </p>
              <button
                onClick={requestMicPermission}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-6 py-3 rounded-full transition-colors text-sm mt-1"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 mt-2">
              <p className="text-gray-400 text-sm">
                The Sous Chef needs microphone access to listen while you cook
              </p>
              <button
                onClick={requestMicPermission}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-6 py-3 rounded-full transition-colors"
              >
                <span>🎙</span> Enable Microphone
              </button>
            </div>
          )}
        </div>

        {/* CTA button */}
        <button
          onClick={() => handleBegin("Hello Chef, let's start cooking!")}
          className="flex items-center gap-3 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-white font-semibold text-lg px-8 py-4 rounded-2xl transition-colors shadow-lg"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          Start Cooking
        </button>

        {/* Mic listening indicator */}
        {micPermission === "granted" && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Listening for wake phrase…
          </div>
        )}

        {/* Voice input active during waiting for wake phrase detection */}
        {micPermission === "granted" && (
          <div className="sr-only">
            <CookingVoiceInput
              isActive={isListening}
              onSend={handleSend}
              onSpeechStart={handleSpeechStart}
              disabled={false}
            />
          </div>
        )}
      </div>
    );
  }

  // ── Cooking session layout ──────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-gray-950 text-white flex flex-col overflow-hidden">
      {/* ── Top bar ── */}
      <div
        className="flex items-center gap-2 px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <button
          onClick={onExit}
          className="shrink-0 p-2 -m-2 flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"
          style={{ minWidth: 44, minHeight: 44 }}
          aria-label="Exit cooking session"
        >
          ← Exit
        </button>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-sm font-semibold text-white truncate">
            {recipe.title}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {/* Steps toggle — mobile only */}
          <button
            onClick={() => setShowMobileSteps((v) => !v)}
            className="lg:hidden p-2 -m-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
            style={{ minWidth: 44, minHeight: 44 }}
            aria-label={showMobileSteps ? "Close steps" : "Show recipe steps"}
          >
            Steps
          </button>
          <div className="text-xs text-gray-400 text-right">
            {currentStep > 0 ? (
              <span aria-label={`Step ${currentStep} of ${totalSteps}`}>
                {currentStep} / {totalSteps}
              </span>
            ) : (
              <span className="text-amber-400">Ready</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile steps overlay ── */}
      {showMobileSteps && (
        <div
          className="lg:hidden fixed inset-0 z-10 bg-gray-950/90"
          style={{ top: "calc(3.5rem + env(safe-area-inset-top))" }}
          onClick={() => setShowMobileSteps(false)}
          role="dialog"
          aria-label="Recipe steps"
        >
          <div
            className="bg-gray-900 border-b border-gray-800 p-4 overflow-y-auto overflow-x-hidden max-h-full w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
              Recipe Steps
            </p>
            <ol className="space-y-2">
              {recipe.instructions.map((step, i) => {
                const stepNum = i + 1;
                const isDone = stepNum < currentStep;
                const isCurrent = stepNum === currentStep;
                return (
                  <li
                    key={i}
                    className={`flex gap-2.5 text-sm leading-relaxed ${
                      isDone
                        ? "text-gray-600 line-through"
                        : isCurrent
                        ? "text-amber-300 font-semibold"
                        : "text-gray-400"
                    }`}
                  >
                    <span
                      className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isDone
                          ? "bg-gray-700 text-gray-500"
                          : isCurrent
                          ? "bg-amber-500 text-white"
                          : "bg-gray-800 text-gray-500"
                      }`}
                    >
                      {isDone ? "✓" : stepNum}
                    </span>
                    <span className="min-w-0 flex-1">{step}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}

      {/* ── Main body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: current step + conversation log */}
        <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">
          {/* Current step card */}
          {currentStepText && (
            <div className="bg-gray-800 rounded-xl p-5 border border-amber-500/30">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-2">
                Current Step
              </p>
              <p className="text-lg text-white leading-relaxed">{currentStepText}</p>
            </div>
          )}

          {phase === "initializing" && !currentStepText && (
            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 flex items-center gap-3">
              <span className="w-4 h-4 rounded-full bg-amber-400 animate-ping" />
              <p className="text-gray-300 text-sm">Starting your cooking session…</p>
            </div>
          )}

          {phase === "error" && (
            <div className="bg-red-900/40 border border-red-600/50 rounded-xl p-5">
              <p className="text-red-300 text-sm">{errorMessage || "Something went wrong."}</p>
              <button
                onClick={() => sendMessage("Let's continue.", messages)}
                className="mt-3 text-sm text-amber-400 underline"
              >
                Try again
              </button>
            </div>
          )}

          {phase === "complete" && (
            <div className="bg-green-900/40 border border-green-600/50 rounded-xl p-5">
              <p className="text-green-300 font-medium">🎉 Recipe complete! Enjoy your meal.</p>
            </div>
          )}

          {/* Conversation log */}
          <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
            {recentMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-amber-600/80 text-white rounded-br-sm"
                      : "bg-gray-800 text-gray-200 rounded-bl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {/* Streaming in-progress */}
            {streamingText && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm leading-relaxed bg-gray-800 text-gray-200">
                  {streamingText}
                  <span className="inline-block w-1.5 h-3.5 bg-gray-400 animate-pulse ml-0.5 align-middle" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar: recipe overview (hidden on mobile) */}
        <div className="hidden lg:flex w-72 flex-col border-l border-gray-800 p-4 overflow-y-auto shrink-0">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
            Recipe Steps
          </p>
          <ol className="space-y-2">
            {recipe.instructions.map((step, i) => {
              const stepNum = i + 1;
              const isDone = stepNum < currentStep;
              const isCurrent = stepNum === currentStep;
              return (
                <li
                  key={i}
                  className={`flex gap-2.5 text-xs leading-relaxed ${
                    isDone
                      ? "text-gray-600 line-through"
                      : isCurrent
                      ? "text-amber-300 font-semibold"
                      : "text-gray-400"
                  }`}
                >
                  <span
                    className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      isDone
                        ? "bg-gray-700 text-gray-500"
                        : isCurrent
                        ? "bg-amber-500 text-white"
                        : "bg-gray-800 text-gray-500"
                    }`}
                  >
                    {isDone ? "✓" : stepNum}
                  </span>
                  <span className="min-w-0 flex-1">{step}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* ── Bottom mic area ── */}
      <div
        className="shrink-0 px-4 pt-3 bg-gray-900 border-t border-gray-800 flex flex-col items-center gap-3"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <CookingVoiceInput
          isActive={isListening && !isLoading && !isSpeaking}
          onSend={handleSend}
          onSpeechStart={handleSpeechStart}
          disabled={isLoading || isSpeaking}
        />
        {isLoading && (
          <p className="text-xs text-gray-500 animate-pulse">Chef is thinking…</p>
        )}
      </div>
    </div>
  );
}
