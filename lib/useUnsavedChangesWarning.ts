import { useEffect } from "react";

/**
 * Shows a native browser warning when the user tries to close the tab,
 * refresh the page, or navigate away at the browser level while there is
 * unsaved data on the page.
 *
 * Engineering standard: this hook MUST be used on any page or component
 * where unsaved user data could be lost on navigation. Apply it whenever
 * a form, text input, voice narration, or edit session is in progress.
 *
 * @param isDirty - true when there is unsaved data that would be lost on navigation.
 *                  Set to false once the data has been saved or discarded.
 *
 * Usage:
 *   useUnsavedChangesWarning(transcript.length > 20);
 *   useUnsavedChangesWarning(isEditing);
 *
 * Note: Modern browsers do not show custom messages in the beforeunload
 * dialog — they show their own generic "Leave site?" prompt. Calling
 * e.preventDefault() is sufficient to trigger it.
 */
export function useUnsavedChangesWarning(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // preventDefault() triggers the browser's built-in "Leave site?" dialog.
      // Setting returnValue is the legacy fallback for older browsers.
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);
}
