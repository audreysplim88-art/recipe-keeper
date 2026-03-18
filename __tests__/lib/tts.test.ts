/**
 * Tests for TTSManager (lib/tts.ts)
 *
 * TTSManager wraps window.speechSynthesis. All browser APIs are mocked so
 * these tests run in jsdom without needing a real browser.
 */

import { TTSManager } from "@/lib/tts";

// ─── Mock speechSynthesis ────────────────────────────────────────────────────

const mockSpeak = jest.fn();
const mockCancel = jest.fn();
const mockPause = jest.fn();
const mockResume = jest.fn();
const mockGetVoices = jest.fn().mockReturnValue([]);

// Track the last utterance passed to speak() so we can fire its callbacks
let lastUtterance: MockUtterance | null = null;

class MockUtterance {
  text: string;
  rate = 1;
  pitch = 1;
  voice: null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;

  constructor(text: string) {
    this.text = text;
    lastUtterance = this;
  }
}

beforeAll(() => {
  Object.defineProperty(window, "speechSynthesis", {
    writable: true,
    value: {
      speak: mockSpeak,
      cancel: mockCancel,
      pause: mockPause,
      resume: mockResume,
      getVoices: mockGetVoices,
      speaking: false,
    },
  });
  Object.defineProperty(window, "SpeechSynthesisUtterance", {
    writable: true,
    value: MockUtterance,
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  lastUtterance = null;
});

// ─── isAvailable ─────────────────────────────────────────────────────────────

describe("isAvailable", () => {
  it("returns true when speechSynthesis exists on window", () => {
    const tts = new TTSManager(jest.fn());
    expect(tts.isAvailable).toBe(true);
  });
});

// ─── appendText — sentence splitting ─────────────────────────────────────────

describe("appendText", () => {
  it("speaks a completed sentence immediately", () => {
    const tts = new TTSManager(jest.fn());
    tts.appendText("The oil is ready.");
    expect(mockSpeak).toHaveBeenCalledTimes(1);
    expect(lastUtterance?.text).toBe("The oil is ready.");
  });

  it("splits two sentences and queues the second", () => {
    const tts = new TTSManager(jest.fn());
    tts.appendText("Stir gently. Add the garlic.");
    // First sentence spoken immediately
    expect(mockSpeak).toHaveBeenCalledTimes(1);
    expect(lastUtterance?.text).toBe("Stir gently.");
    // Simulate first utterance finishing
    lastUtterance!.onend!();
    // Second sentence now spoken
    expect(mockSpeak).toHaveBeenCalledTimes(2);
    expect(lastUtterance?.text).toBe("Add the garlic.");
  });

  it("buffers an incomplete sentence until a boundary arrives", () => {
    const tts = new TTSManager(jest.fn());
    tts.appendText("The onions should be");
    expect(mockSpeak).not.toHaveBeenCalled();
    tts.appendText(" golden brown.");
    expect(mockSpeak).toHaveBeenCalledTimes(1);
    expect(lastUtterance?.text).toBe("The onions should be golden brown.");
  });

  it("handles exclamation and question marks as boundaries", () => {
    const tts = new TTSManager(jest.fn());
    tts.appendText("Do you have all your ingredients? Great!");
    // Two sentences split
    expect(mockSpeak).toHaveBeenCalledTimes(1);
    expect(lastUtterance?.text).toBe("Do you have all your ingredients?");
    lastUtterance!.onend!();
    expect(mockSpeak).toHaveBeenCalledTimes(2);
    expect(lastUtterance?.text).toBe("Great!");
  });

  it("does not speak empty or whitespace-only segments", () => {
    const tts = new TTSManager(jest.fn());
    tts.appendText("   ");
    expect(mockSpeak).not.toHaveBeenCalled();
  });
});

// ─── flush ───────────────────────────────────────────────────────────────────

describe("flush", () => {
  it("speaks remaining buffer that has no trailing punctuation", () => {
    const tts = new TTSManager(jest.fn());
    tts.appendText("Add a pinch of salt");
    expect(mockSpeak).not.toHaveBeenCalled(); // no sentence boundary yet
    tts.flush();
    expect(mockSpeak).toHaveBeenCalledTimes(1);
    expect(lastUtterance?.text).toBe("Add a pinch of salt");
  });

  it("does nothing when buffer is empty", () => {
    const tts = new TTSManager(jest.fn());
    tts.flush();
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it("clears the buffer after flushing", () => {
    const tts = new TTSManager(jest.fn());
    tts.appendText("Season to taste");
    tts.flush();
    // A second flush should not speak again
    tts.flush();
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });
});

// ─── interrupt ───────────────────────────────────────────────────────────────

describe("interrupt", () => {
  it("calls speechSynthesis.cancel()", () => {
    const tts = new TTSManager(jest.fn());
    tts.interrupt();
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it("empties the queue so no further speech plays", () => {
    const tts = new TTSManager(jest.fn());
    // Queue up two sentences
    tts.appendText("First sentence. Second sentence.");
    expect(mockSpeak).toHaveBeenCalledTimes(1);
    // Interrupt before first finishes
    tts.interrupt();
    // Simulate the utterance ending after interruption
    lastUtterance!.onerror!({ error: "interrupted" });
    // No further speech should play
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });

  it("calls onSpeakingChange(false)", () => {
    const onChange = jest.fn();
    const tts = new TTSManager(onChange);
    tts.appendText("Hello.");
    onChange.mockClear();
    tts.interrupt();
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("sets isSpeaking to false", () => {
    const tts = new TTSManager(jest.fn());
    tts.appendText("Hello.");
    tts.interrupt();
    expect(tts.isSpeaking).toBe(false);
  });
});

// ─── onSpeakingChange callback ────────────────────────────────────────────────

describe("onSpeakingChange callback", () => {
  it("fires true when first utterance starts", () => {
    const onChange = jest.fn();
    const tts = new TTSManager(onChange);
    tts.appendText("Hello chef.");
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("fires false when the last utterance ends", () => {
    const onChange = jest.fn();
    const tts = new TTSManager(onChange);
    tts.appendText("Ready to cook.");
    onChange.mockClear();
    lastUtterance!.onend!();
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("stays true between chained sentences", () => {
    const onChange = jest.fn();
    const tts = new TTSManager(onChange);
    tts.appendText("First. Second.");
    onChange.mockClear();
    // End first sentence — second is queued, so should NOT fire false yet
    lastUtterance!.onend!();
    expect(onChange).not.toHaveBeenCalledWith(false);
    // End second sentence — now false
    lastUtterance!.onend!();
    expect(onChange).toHaveBeenCalledWith(false);
  });
});

// ─── destroy ─────────────────────────────────────────────────────────────────

describe("destroy", () => {
  it("cancels speech and clears timers without throwing", () => {
    const tts = new TTSManager(jest.fn());
    tts.setupVisibilityWorkaround();
    tts.appendText("About to be destroyed.");
    expect(() => tts.destroy()).not.toThrow();
    expect(mockCancel).toHaveBeenCalled();
  });
});
