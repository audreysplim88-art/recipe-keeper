/**
 * Tests for components/CookingVoiceInput.tsx
 *
 * SpeechRecognition is mocked at the module level so tests run in jsdom.
 * We test:
 *  - Renders voice UI when SpeechRecognition is available
 *  - Renders text fallback when SpeechRecognition is unavailable
 *  - Starts recognition when isActive becomes true
 *  - Stops recognition when isActive becomes false
 *  - Calls onSpeechStart immediately on first speech
 *  - Auto-sends after 2 s silence (via fake timers)
 *  - Does not send empty utterances
 *  - Disabled state disables the fallback input
 */

import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import CookingVoiceInput from "@/components/CookingVoiceInput";

// ─── Mock SpeechRecognition ───────────────────────────────────────────────────

type SpeechResultCallback = (event: {
  resultIndex: number;
  results: { isFinal: boolean; 0: { transcript: string } }[];
}) => void;

interface MockRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: SpeechResultCallback | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: jest.Mock;
  abort: jest.Mock;
  stop: jest.Mock;
}

let mockRecognitionInstance: MockRecognitionInstance | null = null;

class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = "";
  onresult: SpeechResultCallback | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  start = jest.fn();
  abort = jest.fn();
  stop = jest.fn();

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    mockRecognitionInstance = this;
  }
}

// Helper: fire a fake speech result
function fireSpeechResult(transcript: string, isFinal = true) {
  mockRecognitionInstance?.onresult?.({
    resultIndex: 0,
    results: [{ isFinal, 0: { transcript } }],
  });
}

beforeAll(() => {
  Object.defineProperty(window, "SpeechRecognition", {
    writable: true,
    configurable: true,
    value: MockSpeechRecognition,
  });
  Object.defineProperty(window, "webkitSpeechRecognition", {
    writable: true,
    configurable: true,
    value: MockSpeechRecognition,
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRecognitionInstance = null;
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ─── Renders correctly ────────────────────────────────────────────────────────

describe("rendering", () => {
  it("renders the listening status region when SpeechRecognition is available", () => {
    render(
      <CookingVoiceInput isActive={true} onSend={jest.fn()} />
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Listening")).toBeInTheDocument();
  });

  it("shows 'Speaking' label when isActive is false", () => {
    render(
      <CookingVoiceInput isActive={false} onSend={jest.fn()} />
    );
    expect(screen.getByText("Speaking")).toBeInTheDocument();
  });

  it("shows 'Waiting…' label when disabled", () => {
    render(
      <CookingVoiceInput isActive={true} onSend={jest.fn()} disabled={true} />
    );
    expect(screen.getByText("Waiting…")).toBeInTheDocument();
  });

  it("renders text fallback when SpeechRecognition is unavailable", () => {
    // Temporarily remove SpeechRecognition by setting to undefined
    // (delete doesn't work on non-configurable properties, assignment does)
    // @ts-expect-error — testing unavailable state
    window.SpeechRecognition = undefined;
    // @ts-expect-error — testing unavailable state
    window.webkitSpeechRecognition = undefined;

    render(<CookingVoiceInput isActive={false} onSend={jest.fn()} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();

    // Restore
    // @ts-expect-error — restore mock
    window.SpeechRecognition = MockSpeechRecognition;
    // @ts-expect-error — restore mock
    window.webkitSpeechRecognition = MockSpeechRecognition;
  });
});

// ─── Recognition lifecycle ────────────────────────────────────────────────────

describe("recognition lifecycle", () => {
  it("starts recognition when isActive is true", () => {
    render(<CookingVoiceInput isActive={true} onSend={jest.fn()} />);
    expect(mockRecognitionInstance?.start).toHaveBeenCalled();
  });

  it("does not start recognition when isActive is false", () => {
    render(<CookingVoiceInput isActive={false} onSend={jest.fn()} />);
    expect(mockRecognitionInstance?.start).not.toHaveBeenCalled();
  });

  it("aborts recognition when isActive switches to false", () => {
    const { rerender } = render(<CookingVoiceInput isActive={true} onSend={jest.fn()} />);
    rerender(<CookingVoiceInput isActive={false} onSend={jest.fn()} />);
    expect(mockRecognitionInstance?.abort).toHaveBeenCalled();
  });

  it("does not start recognition when disabled even if isActive is true", () => {
    render(<CookingVoiceInput isActive={true} onSend={jest.fn()} disabled={true} />);
    expect(mockRecognitionInstance?.start).not.toHaveBeenCalled();
  });
});

// ─── Speech events ────────────────────────────────────────────────────────────

describe("speech events", () => {
  it("calls onSpeechStart immediately on the first result", () => {
    const onSpeechStart = jest.fn();
    render(
      <CookingVoiceInput isActive={true} onSend={jest.fn()} onSpeechStart={onSpeechStart} />
    );

    act(() => {
      fireSpeechResult("Hello");
    });

    expect(onSpeechStart).toHaveBeenCalledTimes(1);
  });

  it("does not call onSpeechStart again for subsequent results in the same utterance", () => {
    const onSpeechStart = jest.fn();
    render(
      <CookingVoiceInput isActive={true} onSend={jest.fn()} onSpeechStart={onSpeechStart} />
    );

    act(() => {
      fireSpeechResult("Hello");
      fireSpeechResult(" chef");
    });

    // onSpeechStart only fires once when transcript goes from empty to non-empty.
    // After the silence timer fires and transcript is reset, the next utterance
    // would trigger it again — but here we have not advanced timers yet.
    expect(onSpeechStart).toHaveBeenCalledTimes(1);
  });

  it("sends the transcript after 2 s of silence", () => {
    const onSend = jest.fn();
    render(<CookingVoiceInput isActive={true} onSend={onSend} />);

    act(() => {
      fireSpeechResult("Add some salt");
    });

    expect(onSend).not.toHaveBeenCalled(); // silence not elapsed yet

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(onSend).toHaveBeenCalledWith("Add some salt");
  });

  it("resets the silence timer when new speech arrives", () => {
    const onSend = jest.fn();
    render(<CookingVoiceInput isActive={true} onSend={onSend} />);

    act(() => {
      fireSpeechResult("First chunk");
    });

    act(() => {
      jest.advanceTimersByTime(1500); // 1.5 s — not yet sent
    });

    act(() => {
      fireSpeechResult(" second chunk"); // resets timer
    });

    act(() => {
      jest.advanceTimersByTime(1500); // another 1.5 s — still not 2 s since last speech
    });

    expect(onSend).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(500); // now 2 s since last speech
    });

    expect(onSend).toHaveBeenCalledWith("First chunk  second chunk");
  });

  it("does not call onSend when the utterance is empty", () => {
    const onSend = jest.fn();
    render(<CookingVoiceInput isActive={true} onSend={onSend} />);

    // Advance timer without any speech
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(onSend).not.toHaveBeenCalled();
  });
});

// ─── Fallback text input ──────────────────────────────────────────────────────

describe("fallback text input", () => {
  beforeEach(() => {
    // Set to undefined — can't delete properties defined via Object.defineProperty
    // @ts-expect-error — testing unavailable state
    window.SpeechRecognition = undefined;
    // @ts-expect-error — testing unavailable state
    window.webkitSpeechRecognition = undefined;
  });

  afterEach(() => {
    // @ts-expect-error — restore mock
    window.SpeechRecognition = MockSpeechRecognition;
    // @ts-expect-error — restore mock
    window.webkitSpeechRecognition = MockSpeechRecognition;
  });

  it("calls onSend with input text and clears field on submit", () => {
    const onSend = jest.fn();
    render(<CookingVoiceInput isActive={false} onSend={onSend} />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "I'm ready!" } });
    fireEvent.submit(input.closest("form")!);

    expect(onSend).toHaveBeenCalledWith("I'm ready!");
    expect(input.value).toBe("");
  });

  it("does not call onSend when input is empty", () => {
    const onSend = jest.fn();
    render(<CookingVoiceInput isActive={false} onSend={onSend} />);

    const input = screen.getByRole("textbox");
    fireEvent.submit(input.closest("form")!);

    expect(onSend).not.toHaveBeenCalled();
  });

  it("disables the input when disabled prop is true", () => {
    render(<CookingVoiceInput isActive={false} onSend={jest.fn()} disabled={true} />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});
