"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Recipe } from "@/lib/types";
import { TTSManager } from "@/lib/tts";
import CookingVoiceInput from "@/components/CookingVoiceInput";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

type SessionPhase = "initializing" | "cooking" | "complete" | "error";

interface SousChefSessionProps {
  recipe: Recipe;
  onExit: () => void;
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
  const [phase, setPhase] = useState<SessionPhase>("initializing");
  const [currentStep, setCurrentStep] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const ttsRef = useRef<TTSManager | null>(null);
  const sessionStartedRef = useRef(false);

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
        const res = await fetch("/api/sous-chef", {
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

  // ─── Start session on mount ──────────────────────────────────────────────────

  useEffect(() => {
    if (sessionStartedRef.current) return;
    sessionStartedRef.current = true;

    // Request mic permission early, then start conversation
    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {
        // Permission denied — we'll fall back to text input; no-op here
      });
    }

    sendMessage("Hello! I'm ready to start cooking.", []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Handle user speech ──────────────────────────────────────────────────────

  const handleSend = useCallback(
    (text: string) => {
      sendMessage(text, messages);
    },
    [sendMessage, messages]
  );

  const handleSpeechStart = useCallback(() => {
    ttsRef.current?.interrupt();
    setIsListening(true);
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────────

  const currentStepText =
    currentStep > 0 && currentStep <= totalSteps
      ? recipe.instructions[currentStep - 1]
      : null;

  // Last few conversation messages for the log
  const recentMessages = messages.slice(-6);

  return (
    <div className="fixed inset-0 bg-gray-950 text-white flex flex-col overflow-hidden">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"
          aria-label="Exit cooking session"
        >
          ← Exit
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-xs">
            {recipe.title}
          </p>
        </div>
        <div className="text-sm text-gray-400">
          {currentStep > 0 ? (
            <span aria-label={`Step ${currentStep} of ${totalSteps}`}>
              Step {currentStep} / {totalSteps}
            </span>
          ) : (
            <span className="text-amber-400">Getting ready</span>
          )}
        </div>
      </div>

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
                  {step}
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* ── Bottom mic area ── */}
      <div className="shrink-0 px-4 pb-6 pt-3 bg-gray-900 border-t border-gray-800 flex flex-col items-center gap-3">
        <CookingVoiceInput
          isActive={isListening && !isLoading}
          onSend={handleSend}
          onSpeechStart={handleSpeechStart}
          disabled={isLoading}
        />
        {isLoading && (
          <p className="text-xs text-gray-500 animate-pulse">Chef is thinking…</p>
        )}
      </div>
    </div>
  );
}
