import "server-only";
import type { Db } from "@/lib/db/queries";
import { serverEnv } from "@/lib/serverEnv";
import type { Borough } from "@/lib/schemas/building";
import {
  fetchPriorFilings,
  lookupFor,
  lookupKey,
  needsRefresh,
  OpenDataError,
  parseCachedFilings,
  type PriorFiling,
} from "./facades";

export type BuildingHistory =
  | { kind: "no_lookup" }
  | {
      kind: "ok";
      filings: PriorFiling[];
      fetchedAt: string | null; // null = never fetched successfully
      error: string | null; // latest attempt failed; filings are from the cache
    };

type BuildingRef = {
  id: string;
  firm_id: string;
  bin: string | null;
  borough: Borough;
  block: number | null;
  lot: number | null;
};

// Prior filings for a building: from the cache when fresh, otherwise from NYC
// Open Data (then cached). Never throws; a failed fetch falls back to the cache.
export async function getBuildingHistory(db: Db, building: BuildingRef, { force = false } = {}): Promise<BuildingHistory> {
  const lookup = lookupFor(building);
  if (!lookup) return { kind: "no_lookup" };
  const key = lookupKey(lookup);
  const now = new Date();

  const { data: cache } = await db
    .from("building_filings_cache")
    .select("lookup_key, filings, fetched_at, last_attempt_at, last_error")
    .eq("building_id", building.id)
    .maybeSingle();

  const sameKey = cache?.lookup_key === key;
  const cached = sameKey ? parseCachedFilings(cache?.filings) : [];
  const state = cache
    ? { lookupKey: cache.lookup_key, fetchedAt: cache.fetched_at, lastAttemptAt: cache.last_attempt_at, lastError: cache.last_error }
    : null;

  if (!needsRefresh(state, key, now, force)) {
    return { kind: "ok", filings: cached, fetchedAt: cache?.fetched_at ?? null, error: cache?.last_error ?? null };
  }

  const env = serverEnv();
  const base = { firm_id: building.firm_id, building_id: building.id, lookup_key: key, last_attempt_at: now.toISOString() };
  try {
    const filings = await fetchPriorFilings(lookup, {
      baseUrl: env.NYC_OPEN_DATA_URL,
      appToken: env.NYC_OPEN_DATA_APP_TOKEN,
    });
    await db
      .from("building_filings_cache")
      .upsert({ ...base, filings: JSON.parse(JSON.stringify(filings)), fetched_at: now.toISOString(), last_error: null }, { onConflict: "building_id" });
    return { kind: "ok", filings, fetchedAt: now.toISOString(), error: null };
  } catch (e) {
    const message = e instanceof OpenDataError ? e.message : "Couldn't load prior filings. Try again later.";
    await db.from("building_filings_cache").upsert(
      sameKey
        ? { ...base, last_error: message }
        : { ...base, filings: [], fetched_at: null, last_error: message },
      { onConflict: "building_id" },
    );
    return { kind: "ok", filings: cached, fetchedAt: sameKey ? (cache?.fetched_at ?? null) : null, error: message };
  }
}
