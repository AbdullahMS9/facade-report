// Pure sync planning: what to send next and when to retry. No browser APIs,
// so it can be unit-tested. CLAUDE.md §4 item 6 (capture offline, sync later).

export interface OutboxMeta {
  id: string;
  createdAt: number; // ms
  attempts: number;
  lastAttemptAt: number | null; // ms
  // Failed in a way retrying won't fix (e.g. invalid data); only sent when forced.
  blocked?: boolean;
}

export interface QueuedObservation extends OutboxMeta {
  kind: "observation";
}

export interface QueuedPhoto extends OutboxMeta {
  kind: "photo";
  observationId: string | null;
}

export type QueuedItem = QueuedObservation | QueuedPhoto;

const BASE_DELAY_MS = 15_000;
const MAX_DELAY_MS = 10 * 60_000;

// 15 s, 30 s, 1 min, 2 min … capped at 10 min.
export function retryDelayMs(attempts: number): number {
  if (attempts <= 0) return 0;
  return Math.min(BASE_DELAY_MS * 2 ** (attempts - 1), MAX_DELAY_MS);
}

export function isDue(item: OutboxMeta, now: number, force = false): boolean {
  if (force) return true;
  if (item.blocked) return false;
  if (item.lastAttemptAt === null) return true;
  return now - item.lastAttemptAt >= retryDelayMs(item.attempts);
}

// Order: observations (oldest first), then photos (oldest first). A photo
// waits while its observation is still in the outbox, so the server always
// has the observation before the photo that points at it.
export function planSync(
  observations: QueuedObservation[],
  photos: QueuedPhoto[],
  now: number,
  force = false,
): QueuedItem[] {
  const waiting = new Set(observations.map((o) => o.id));
  const byAge = (a: OutboxMeta, b: OutboxMeta) => a.createdAt - b.createdAt;
  return [
    ...observations.filter((o) => isDue(o, now, force)).sort(byAge),
    ...photos.filter((p) => !(p.observationId && waiting.has(p.observationId)) && isDue(p, now, force)).sort(byAge),
  ];
}
