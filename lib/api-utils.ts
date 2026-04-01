import Anthropic from "@anthropic-ai/sdk";

/**
 * Shared error handler for Anthropic API calls.
 * Distinguishes auth failures (401) from all other errors (500).
 * Use in every API route that calls the Anthropic client.
 *
 * @param error  The caught error value
 * @param context Label used in the server-side console.error (e.g. "Recipe generation")
 */
export function handleAnthropicError(error: unknown, context: string): Response {
  if (error instanceof Anthropic.AuthenticationError) {
    return Response.json(
      { error: "Invalid API key. Please check your ANTHROPIC_API_KEY." },
      { status: 401 }
    );
  }
  console.error(`${context} error:`, error);
  return Response.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 }
  );
}
