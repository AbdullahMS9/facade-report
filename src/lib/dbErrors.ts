// Our database functions raise plain-English messages with these codes; show
// those to the user. Anything else gets a generic message.
const FRIENDLY_CODES = new Set(["28000", "22023", "23505", "42501", "P0002"]);

export function friendlyDbError(
  error: { code?: string; message: string } | null,
  fallback = "Something went wrong. Please try again.",
): string {
  if (error?.code && FRIENDLY_CODES.has(error.code) && !error.message.includes("duplicate key")) {
    return error.message;
  }
  return fallback;
}
