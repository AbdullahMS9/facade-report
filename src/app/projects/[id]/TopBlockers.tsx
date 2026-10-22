import Link from "next/link";
import type { CheckResult } from "@/lib/rules";
import { checkLink } from "./checkLinks";

// The first few blockers, near the top of the overview.
export function TopBlockers({ projectId, blockers }: { projectId: string; blockers: CheckResult[] }) {
  if (blockers.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-950 dark:bg-red-950 dark:text-red-100">
      <h2 className="text-lg font-semibold">Before filing</h2>
      <ul className="flex flex-col gap-1 text-sm">
        {blockers.slice(0, 3).map((b) => {
          const link = checkLink(projectId, b);
          return (
            <li key={b.id}>
              <Link href={link.href} className="inline-flex min-h-12 items-center underline">
                {b.title}: {b.message}
              </Link>
            </li>
          );
        })}
      </ul>
      {blockers.length > 3 ? (
        <Link href={`/projects/${projectId}/checker`} className="inline-flex min-h-12 items-center text-sm font-medium underline">
          See all {blockers.length} blockers ›
        </Link>
      ) : null}
    </section>
  );
}
