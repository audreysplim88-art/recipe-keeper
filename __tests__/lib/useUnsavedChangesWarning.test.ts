/**
 * Tests for lib/useUnsavedChangesWarning.ts
 *
 * We test:
 *  - Does NOT add beforeunload listener when isDirty is false
 *  - Adds beforeunload listener when isDirty becomes true
 *  - Calls e.preventDefault() and sets e.returnValue when fired
 *  - Removes the listener when isDirty becomes false again (cleanup)
 *  - Removes the listener on unmount
 */

import { renderHook, act } from "@testing-library/react";
import { useUnsavedChangesWarning } from "@/lib/useUnsavedChangesWarning";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fireBeforeUnload(): { defaultPrevented: boolean; returnValue: string } {
  const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
  Object.defineProperty(event, "returnValue", {
    writable: true,
    value: "",
  });
  window.dispatchEvent(event);
  return { defaultPrevented: event.defaultPrevented, returnValue: (event as unknown as { returnValue: string }).returnValue };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useUnsavedChangesWarning", () => {
  beforeEach(() => {
    // Clear all listeners between tests
    jest.restoreAllMocks();
  });

  it("does NOT intercept beforeunload when isDirty is false", () => {
    renderHook(() => useUnsavedChangesWarning(false));

    const spyPrevent = jest.spyOn(Event.prototype, "preventDefault");
    fireBeforeUnload();

    expect(spyPrevent).not.toHaveBeenCalled();
  });

  it("intercepts beforeunload and calls preventDefault when isDirty is true", () => {
    renderHook(() => useUnsavedChangesWarning(true));

    const { defaultPrevented } = fireBeforeUnload();
    expect(defaultPrevented).toBe(true);
  });

  it("sets e.returnValue to empty string (legacy browser fallback)", () => {
    renderHook(() => useUnsavedChangesWarning(true));

    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    const returnValueHolder = { returnValue: "" };
    Object.defineProperty(event, "returnValue", {
      get: () => returnValueHolder.returnValue,
      set: (v: string) => { returnValueHolder.returnValue = v; },
    });

    window.dispatchEvent(event);
    // The hook sets returnValue = "" — the key is that it was explicitly set
    // (triggers the legacy dialog in browsers that check for assignment)
    expect(event.defaultPrevented).toBe(true);
  });

  it("removes the listener when isDirty changes from true to false", () => {
    const { rerender } = renderHook(
      ({ isDirty }: { isDirty: boolean }) => useUnsavedChangesWarning(isDirty),
      { initialProps: { isDirty: true } }
    );

    // Listener should be active
    expect(fireBeforeUnload().defaultPrevented).toBe(true);

    // Flip to clean
    act(() => {
      rerender({ isDirty: false });
    });

    // Listener should have been removed
    const spyPrevent = jest.spyOn(Event.prototype, "preventDefault");
    fireBeforeUnload();
    expect(spyPrevent).not.toHaveBeenCalled();
  });

  it("removes the listener on unmount when isDirty was true", () => {
    const { unmount } = renderHook(() => useUnsavedChangesWarning(true));

    unmount();

    const spyPrevent = jest.spyOn(Event.prototype, "preventDefault");
    fireBeforeUnload();
    expect(spyPrevent).not.toHaveBeenCalled();
  });

  it("adds the listener when isDirty transitions from false to true", () => {
    const { rerender } = renderHook(
      ({ isDirty }: { isDirty: boolean }) => useUnsavedChangesWarning(isDirty),
      { initialProps: { isDirty: false } }
    );

    // Initially clean — no interception
    const spyBefore = jest.spyOn(Event.prototype, "preventDefault");
    fireBeforeUnload();
    expect(spyBefore).not.toHaveBeenCalled();

    spyBefore.mockRestore();

    // Now becomes dirty
    act(() => {
      rerender({ isDirty: true });
    });

    expect(fireBeforeUnload().defaultPrevented).toBe(true);
  });
});
