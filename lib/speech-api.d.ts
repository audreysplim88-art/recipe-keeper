/**
 * Web Speech API global type declarations.
 *
 * TypeScript's lib.dom.d.ts (as of TS 5.9) includes SpeechRecognitionAlternative,
 * SpeechRecognitionResult, and SpeechRecognitionResultList but is missing the core
 * SpeechRecognition class, its event types, and the Window properties.
 * This file declares everything that's absent so both VoiceCapture and
 * CookingVoiceInput can share a single consistent definition.
 *
 * Keeping declarations here (rather than inline in each component) avoids the
 * "Subsequent property declarations must have the same type" error that occurs
 * when two files each augment Window.SpeechRecognition with their own locally-
 * scoped SpeechRecognition type.
 */

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  abort(): void;
  stop(): void;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};

interface Window {
  SpeechRecognition: typeof SpeechRecognition;
  webkitSpeechRecognition: typeof SpeechRecognition;
}
