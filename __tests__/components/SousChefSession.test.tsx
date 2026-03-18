/**
 * Tests for components/SousChefSession.tsx
 *
 * Mocks:
 *  - fetch (global) — returns a minimal SSE stream
 *  - lib/tts TTSManager — prevents real SpeechSynthesis calls
 *  - SpeechRecognition — prevents real mic access
 *  - navigator.mediaDevices — prevents real permission prompts
 *
 * We test:
 *  - Renders recipe title and "Getting ready" on mount
 *  - Shows step counter once a step is detected
 *  - Renders the conversation log
 *  - CookingVoiceInput is rendered in the mic area
 *  - Exit button calls onExit
 *  - Shows error state when API fails
 *  - Shows "complete" state when final step reached
 */

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextEncoder } from "util";
import SousChefSession from "@/components/SousChefSession";
import { Recipe } from "@/lib/types";

// ─── Mock TTSManager ──────────────────────────────────────────────────────────

const mockTTS = {
  appendText: jest.fn(),
  flush: jest.fn(),
  interrupt: jest.fn(),
  setupVisibilityWorkaround: jest.fn(),
  destroy: jest.fn(),
  isAvailable: true,
  isSpeaking: false,
};

let capturedOnSpeakingChange: ((speaking: boolean) => void) | null = null;

jest.mock("@/lib/tts", () => ({
  TTSManager: jest.fn().mockImplementation((onSpeakingChange: (s: boolean) => void) => {
    capturedOnSpeakingChange = onSpeakingChange;
    return mockTTS;
  }),
}));

// ─── Mock SpeechRecognition ───────────────────────────────────────────────────

class MockSpeechRecognition {
  continuous = false; interimResults = false; lang = "";
  onresult = null; onend = null; onerror = null;
  start = jest.fn(); abort = jest.fn(); stop = jest.fn();
}

beforeAll(() => {
  Object.defineProperty(window, "SpeechRecognition", {
    writable: true, configurable: true, value: MockSpeechRecognition,
  });
  Object.defineProperty(window, "webkitSpeechRecognition", {
    writable: true, configurable: true, value: MockSpeechRecognition,
  });
});

// ─── Mock navigator.mediaDevices ─────────────────────────────────────────────

beforeAll(() => {
  Object.defineProperty(navigator, "mediaDevices", {
    writable: true,
    configurable: true,
    value: { getUserMedia: jest.fn().mockResolvedValue({}) },
  });
});

// ─── Fetch mock helpers ───────────────────────────────────────────────────────

/**
 * Build a fake response body that behaves like a SSE ReadableStream.
 * The component only calls response.body.getReader() and reader.read(), so
 * we implement that interface directly (avoids the ReadableStream constructor
 * which is not available in the jsdom global scope).
 */
function makeFakeBody(chunks: string[]) {
  const encoder = new TextEncoder();
  const encoded = [
    ...chunks.map((text) => encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)),
    encoder.encode("data: [DONE]\n\n"),
  ];
  let index = 0;
  return {
    getReader: () => ({
      read: jest.fn().mockImplementation(async () => {
        if (index < encoded.length) {
          return { done: false, value: encoded[index++] };
        }
        return { done: true, value: undefined };
      }),
    }),
  };
}

function mockFetchSuccess(chunks: string[]) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    body: makeFakeBody(chunks),
  } as unknown as Response);
}

function mockFetchError() {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    body: null,
  } as unknown as Response);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: "r1",
    title: "Classic Omelette",
    description: "A fluffy omelette.",
    servings: "1 serving",
    prepTime: "2 minutes",
    cookTime: "5 minutes",
    ingredients: [
      { amount: "3", unit: "", name: "eggs" },
      { amount: "1 tbsp", unit: "", name: "butter" },
    ],
    instructions: ["Crack the eggs.", "Melt butter in pan.", "Pour and fold."],
    tips: [{ category: "tip", content: "Low heat is key." }],
    dietaryTags: ["vegetarian"],
    allergens: ["eggs", "dairy"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  capturedOnSpeakingChange = null;
});

// ─── Rendering ────────────────────────────────────────────────────────────────

describe("rendering", () => {
  it("shows the recipe title in the top bar", async () => {
    mockFetchSuccess(["Hello, ready to cook?"]);
    render(<SousChefSession recipe={makeRecipe()} onExit={jest.fn()} />);
    expect(screen.getByText("Classic Omelette")).toBeInTheDocument();
  });

  it("shows 'Getting ready' before any step is reached", async () => {
    mockFetchSuccess(["Hello!"]);
    render(<SousChefSession recipe={makeRecipe()} onExit={jest.fn()} />);
    expect(screen.getByText("Getting ready")).toBeInTheDocument();
  });

  it("renders the CookingVoiceInput status region", async () => {
    mockFetchSuccess(["Hi!"]);
    render(<SousChefSession recipe={makeRecipe()} onExit={jest.fn()} />);
    // The voice input renders a status region
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows the assistant response in the conversation log after loading", async () => {
    mockFetchSuccess(["Do you have all your ingredients ready?"]);

    render(<SousChefSession recipe={makeRecipe()} onExit={jest.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByText("Do you have all your ingredients ready?")
      ).toBeInTheDocument();
    });
  });

  it("streams text progressively (shows streaming indicator while loading)", async () => {
    // Use a body that never yields [DONE] to test the loading state
    const encoder = new TextEncoder();
    const singleChunk = encoder.encode('data: {"text":"Hello"}\n\n');
    let called = false;
    const neverEndingBody = {
      getReader: () => ({
        read: jest.fn().mockImplementation(async () => {
          if (!called) { called = true; return { done: false, value: singleChunk }; }
          // Stall forever — simulates an in-progress stream
          return new Promise<never>(() => {});
        }),
      }),
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, body: neverEndingBody,
    } as unknown as Response);

    render(<SousChefSession recipe={makeRecipe()} onExit={jest.fn()} />);

    await waitFor(() => {
      expect(screen.queryByText(/thinking/i)).toBeInTheDocument();
    });
  });
});

// ─── Exit button ─────────────────────────────────────────────────────────────

describe("exit button", () => {
  it("calls onExit when exit button is clicked", async () => {
    mockFetchSuccess(["Ready!"]);
    const onExit = jest.fn();

    render(<SousChefSession recipe={makeRecipe()} onExit={onExit} />);

    const exitBtn = screen.getByRole("button", { name: /exit/i });
    await userEvent.click(exitBtn);

    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

// ─── TTS integration ─────────────────────────────────────────────────────────

describe("TTS integration", () => {
  it("calls tts.appendText for each streaming chunk", async () => {
    mockFetchSuccess(["Add ", "some ", "salt."]);
    render(<SousChefSession recipe={makeRecipe()} onExit={jest.fn()} />);

    await waitFor(() => {
      expect(mockTTS.appendText).toHaveBeenCalledWith("Add ");
      expect(mockTTS.appendText).toHaveBeenCalledWith("some ");
      expect(mockTTS.appendText).toHaveBeenCalledWith("salt.");
    });
  });

  it("calls tts.flush when the stream ends", async () => {
    mockFetchSuccess(["Ready to start!"]);
    render(<SousChefSession recipe={makeRecipe()} onExit={jest.fn()} />);

    await waitFor(() => {
      expect(mockTTS.flush).toHaveBeenCalled();
    });
  });

  it("enables listening after TTS finishes speaking", async () => {
    mockFetchSuccess(["Let's cook!"]);
    render(<SousChefSession recipe={makeRecipe()} onExit={jest.fn()} />);

    await waitFor(() => expect(mockTTS.flush).toHaveBeenCalled());

    // Simulate TTS finishing — onSpeakingChange(false) enables listening
    act(() => {
      capturedOnSpeakingChange?.(false);
    });

    await waitFor(() => {
      expect(screen.getByText("Listening")).toBeInTheDocument();
    });
  });

  it("calls tts.destroy on unmount", async () => {
    mockFetchSuccess(["Hi!"]);
    const { unmount } = render(<SousChefSession recipe={makeRecipe()} onExit={jest.fn()} />);
    unmount();
    expect(mockTTS.destroy).toHaveBeenCalled();
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe("error handling", () => {
  it("shows an error message when the API call fails", async () => {
    mockFetchError();
    render(<SousChefSession recipe={makeRecipe()} onExit={jest.fn()} />);

    // The component surfaces err.message, and the fallback is "Something went wrong."
    // When res.ok is false we throw new Error("API request failed")
    await waitFor(() => {
      expect(screen.getByText(/api request failed|something went wrong/i)).toBeInTheDocument();
    });
  });
});

// ─── Step detection ───────────────────────────────────────────────────────────

describe("step detection helper (detectCurrentStep)", () => {
  // We test this indirectly through the component by checking step display.
  // Direct unit tests of the pure helper can be added in lib/ if extracted.

  it("updates the step counter when the assistant mentions 'step 2'", async () => {
    mockFetchSuccess(["Great! Now for step 2, melt the butter."]);
    render(<SousChefSession recipe={makeRecipe()} onExit={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Step 2 of 3")).toBeInTheDocument();
    });
  });
});
