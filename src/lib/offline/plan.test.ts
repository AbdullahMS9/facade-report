import { describe, expect, it } from "vitest";
import { isDue, planSync, retryDelayMs, type QueuedObservation, type QueuedPhoto } from "./plan";

const obs = (id: string, createdAt: number, extra: Partial<QueuedObservation> = {}): QueuedObservation => ({
  kind: "observation",
  id,
  createdAt,
  attempts: 0,
  lastAttemptAt: null,
  ...extra,
});
const photo = (id: string, createdAt: number, observationId: string | null, extra: Partial<QueuedPhoto> = {}): QueuedPhoto => ({
  kind: "photo",
  id,
  createdAt,
  observationId,
  attempts: 0,
  lastAttemptAt: null,
  ...extra,
});

describe("retryDelayMs / isDue", () => {
  it("backs off and caps at 10 minutes", () => {
    expect([0, 1, 2, 3, 10].map(retryDelayMs)).toEqual([0, 15_000, 30_000, 60_000, 600_000]);
  });

  it("waits out the delay unless forced", () => {
    const item = { id: "a", createdAt: 0, attempts: 2, lastAttemptAt: 1_000 };
    expect(isDue(item, 30_999)).toBe(false);
    expect(isDue(item, 31_000)).toBe(true);
    expect(isDue(item, 2_000, true)).toBe(true);
  });
});

describe("planSync", () => {
  it("sends observations first, oldest first, then photos", () => {
    const plan = planSync([obs("o2", 20), obs("o1", 10)], [photo("p1", 5, null), photo("p2", 1, null)], 100);
    expect(plan.map((i) => i.id)).toEqual(["o1", "o2", "p2", "p1"]);
  });

  it("holds a photo while its observation is still waiting", () => {
    const plan = planSync([obs("o1", 10, { attempts: 1, lastAttemptAt: 99 })], [photo("p1", 11, "o1"), photo("p2", 12, null)], 100);
    // o1 isn't due (backoff), and p1 must wait for it; p2 can go.
    expect(plan.map((i) => i.id)).toEqual(["p2"]);
  });

  it("sends a photo once its observation has synced (no longer queued)", () => {
    expect(planSync([], [photo("p1", 11, "o1")], 100).map((i) => i.id)).toEqual(["p1"]);
  });

  it("forcing ignores backoff", () => {
    const plan = planSync([obs("o1", 10, { attempts: 5, lastAttemptAt: 99 })], [], 100, true);
    expect(plan.map((i) => i.id)).toEqual(["o1"]);
  });
});
