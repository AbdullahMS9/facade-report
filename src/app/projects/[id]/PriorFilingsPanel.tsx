import type { ReactNode } from "react";
import Link from "next/link";
import type { Db } from "@/lib/db/queries";
import { latestPriorCycle } from "@/lib/opendata/facades";
import { getBuildingHistory } from "@/lib/opendata/history";
import type { Borough } from "@/lib/schemas/building";
import { formatDate, formatDateTime } from "@/lib/today";
import { refreshPriorFilings } from "./prior-actions";

type Building = { id: string; firm_id: string; bin: string | null; borough: Borough; block: number | null; lot: number | null };

function Shell({ children }: { children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <h2 className="text-lg font-semibold">Prior filings (DOB)</h2>
      {children}
    </section>
  );
}

export function PriorFilingsSkeleton() {
  return (
    <Shell>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">Loading prior filings from NYC Open Data…</p>
    </Shell>
  );
}

// Streams in after the rest of the page (wrapped in <Suspense>), so a slow
// Open Data request never holds up the overview.
export async function PriorFilingsPanel({
  db,
  building,
  projectId,
  cycle,
}: {
  db: Db;
  building: Building;
  projectId: string;
  cycle: number;
}) {
  const history = await getBuildingHistory(db, building);

  if (history.kind === "no_lookup") {
    return (
      <Shell>
        <p className="text-sm">
          Add the BIN, or the block and lot, on the{" "}
          <Link href={`/projects/${projectId}/building`} className="underline">building page</Link> to look up
          earlier facade filings.
        </p>
      </Shell>
    );
  }

  const { filings, fetchedAt, error } = history;
  const prior = latestPriorCycle(filings, cycle);

  return (
    <Shell>
      {error ? (
        <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
          {fetchedAt ? " Showing the last saved copy." : ""}
        </p>
      ) : null}

      {prior ? (
        <p>
          <span className="font-semibold">
            Cycle {prior.cycle}: {prior.status}
          </span>
          {prior.filingDate ? <span className="text-sm"> (filed {formatDate(prior.filingDate)})</span> : null}
        </p>
      ) : fetchedAt ? (
        <p className="text-sm">No earlier facade filings found for this building.</p>
      ) : null}

      {prior?.status === "SWARMP" ? (
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          The last cycle was SWARMP. List those conditions under{" "}
          <Link href={`/projects/${projectId}/prior-items`} className="underline">Prior-cycle items</Link>. Any not
          repaired must be reported as UNSAFE.
        </p>
      ) : null}

      {filings.length > 0 ? (
        <ul className="flex flex-col divide-y divide-neutral-200 text-sm dark:divide-neutral-700">
          {filings.map((f, i) => (
            <li key={`${f.tr6No ?? "row"}-${i}`} className="flex flex-col gap-0.5 py-2">
              <span className="font-medium">
                Cycle {f.cycle} · {f.filingType} · {f.filingStatus ?? "—"}
              </span>
              <span className="text-neutral-600 dark:text-neutral-400">
                {f.filingDate ? `Filed ${formatDate(f.filingDate)}` : "No filing date"}
                {f.qewiName ? ` · ${f.qewiName}${f.qewiLicense ? ` (${f.qewiLicense})` : ""}` : ""}
              </span>
              {f.tr6No ? <span className="text-neutral-600 dark:text-neutral-400">{f.tr6No}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      <form action={refreshPriorFilings.bind(null, projectId)} className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-neutral-600 dark:text-neutral-400">
          From NYC Open Data{fetchedAt ? `, updated ${formatDateTime(fetchedAt)}` : ""}.
        </span>
        <button type="submit" className="min-h-12 px-2 text-sm font-medium underline">
          Refresh
        </button>
      </form>
    </Shell>
  );
}
