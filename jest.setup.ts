import "@testing-library/jest-dom";

// ─── Web API polyfills for jsdom ──────────────────────────────────────────────
// Node 18+ has these natively but jsdom doesn't forward them to globalThis
// automatically. These are needed by component tests that exercise fetch,
// SSE streaming, and text encoding.

import { TextEncoder, TextDecoder } from "util";
Object.assign(global, {
  TextEncoder,
  TextDecoder,
  ReadableStream: globalThis.ReadableStream,
  fetch: globalThis.fetch,
});
