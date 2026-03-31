/**
 * Platform detection helpers.
 *
 * Used to gate behaviour that differs between the web app and the
 * Capacitor-wrapped native app (iOS / Android).
 */

/**
 * Returns true when running inside the Capacitor native runtime.
 * On the web this is always false.
 *
 * Capacitor injects a global `Capacitor` object with `isNativePlatform()`
 * before the JS bundle runs, so this check is synchronous and safe to call
 * anywhere — including during render.
 */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).Capacitor?.isNativePlatform?.() === true;
}
