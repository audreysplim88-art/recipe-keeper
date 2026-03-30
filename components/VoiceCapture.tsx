"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface VoiceCaptureProps {
  transcript: string;
  onTranscriptChange: (transcript: string) => void;
}

// Web Speech API types are declared globally in lib/speech-api.d.ts

export default function VoiceCapture({ transcript, onTranscriptChange }: VoiceCaptureProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [interimText, setInterimText] = useState("");
  const [networkWarning, setNetworkWarning] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + " ";
        } else {
          interim += result[0].transcript;
        }
      }

      if (finalTranscript) {
        onTranscriptChange(transcriptRef.current + finalTranscript);
      }
      setInterimText(interim);
    };

    recognition.onend = () => {
      // Auto-restart if still supposed to be listening.
      // 150ms delay prevents InvalidStateError on iOS Safari when restarting
      // immediately after an utterance ends.
      if (recognitionRef.current && isListeningRef.current) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch {
            setIsListening(false);
          }
        }, 150);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech" || event.error === "aborted") {
        // Expected — no action needed, onend will handle restart
        return;
      }
      if (event.error === "network") {
        // Transient network blip — show a warning but let onend auto-restart
        setNetworkWarning(true);
        setTimeout(() => setNetworkWarning(false), 4000);
        return;
      }
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setMicDenied(true);
        setIsListening(false);
        return;
      }
      // Other unrecoverable errors
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep a ref to latest transcript for the onend handler
  const transcriptRef = useRef(transcript);
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const isListeningRef = useRef(false);
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    setMicDenied(false);
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      // Already started
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    recognitionRef.current.abort();
    setIsListening(false);
    setInterimText("");
  }, []);

  // Auto-scroll textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [transcript, interimText]);

  return (
    <div className="space-y-4">
      {/* Voice button */}
      <div className="flex items-center gap-4">
        {isSupported ? (
          <button
            onClick={isListening ? stopListening : startListening}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white transition-all duration-200 shadow-md ${
              isListening
                ? "bg-red-500 hover:bg-red-600 animate-pulse"
                : "bg-amber-600 hover:bg-amber-700"
            }`}
          >
            {isListening ? "Stop Listening" : "Start Narrating"}
          </button>
        ) : (
          <p className="text-amber-700 text-sm italic">
            Voice input not supported in this browser. Please type your narration below.
          </p>
        )}
        {micDenied && (
          <p className="text-sm text-red-600 font-medium flex items-center gap-1.5">
            <span>🎙✗</span> Microphone access denied.{" "}
            On iPhone: <strong>Settings → Safari → Microphone</strong> → allow this site.
          </p>
        )}
      {isListening && !networkWarning && (
          <span className="text-sm text-red-500 font-medium flex items-center gap-1">
            <span className="w-2 h-2 bg-red-500 rounded-full inline-block animate-ping" />
            Listening...
          </span>
        )}
        {networkWarning && (
          <span className="text-sm text-amber-600 font-medium flex items-center gap-1.5">
            <span>⚠️</span> Brief network hiccup — still listening...
          </span>
        )}
      </div>

      {/* Transcript area */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={transcript + (interimText ? ` ${interimText}` : "")}
          onChange={(e) => {
            // Only update the committed transcript (strip interim)
            onTranscriptChange(e.target.value);
          }}
          placeholder="Your narration will appear here, or you can type directly. Speak naturally, as if sharing a recipe with a friend — include your tips, tricks and secrets."
          className="w-full h-64 p-4 border-2 border-amber-200 rounded-xl resize-none focus:outline-none focus:border-amber-400 text-stone-700 bg-amber-50 text-sm leading-relaxed"
        />
        {interimText && (
          <div className="absolute bottom-3 right-3 text-xs text-amber-400 italic">
            hearing...
          </div>
        )}
      </div>

      <div className="flex justify-between items-center text-xs text-stone-400">
        <span>Speak naturally — ramble, tell stories, share secrets. I'll find the recipe.</span>
        <span>{transcript.split(/\s+/).filter(Boolean).length} words</span>
      </div>
    </div>
  );
}
