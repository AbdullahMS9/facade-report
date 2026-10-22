import "server-only";
import type { Db } from "@/lib/db/queries";

const ONE_HOUR = 60 * 60;

// Short-lived links for private photos (CLAUDE.md §6). Signed as the user, so
// storage rules apply. Returns path → URL; missing files are left out.
export async function signedUrls(db: Db, paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;
  const { data } = await db.storage.from("photos").createSignedUrls(paths, ONE_HOUR);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) map.set(item.path, item.signedUrl);
  }
  return map;
}
