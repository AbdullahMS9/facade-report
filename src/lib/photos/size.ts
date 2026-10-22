// Photo size rules and resize math (CLAUDE.md §3.6).

export const MIN_PHOTO = { width: 800, height: 600 } as const;
export const DISPLAY_MAX_EDGE = 2000;

// Meets 800 × 600 in either orientation (a portrait 600 × 800 counts).
export function meetsMinimumSize(width: number, height: number): boolean {
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  return long >= MIN_PHOTO.width && short >= MIN_PHOTO.height;
}

// Scale down so the longest side is at most `maxEdge`; never scale up.
export function fitWithin(width: number, height: number, maxEdge = DISPLAY_MAX_EDGE): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
