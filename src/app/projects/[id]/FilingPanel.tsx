import Link from "next/link";
import { DaysLeft } from "@/components/Badges";
import { DEADLINE_LIMIT_LABEL, type FilingSummary } from "@/lib/rules";
import { formatDate } from "@/lib/today";

// Filing window and deadline for the overview (CLAUDE.md §3.1, §3.4).
export function FilingPanel({ summary, projectId, filed }: { summary: FilingSummary; projectId: string; filed: boolean }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <h2 className="text-lg font-semibold">Filing</h2>
      {summary.kind === "missing_block" ? (
        <p className="text-sm">
          Add the block number on the{" "}
          <Link href={`/projects/${projectId}/building`} className="underline">building page</Link> to see the
          filing window and deadline.
        </p>
      ) : (
        <>
          <p className="text-sm">
            Filing window: {formatDate(summary.window.start)} – {formatDate(summary.window.end)}{" "}
            <span className="text-neutral-600 dark:text-neutral-400">
              ({summary.windowStatus === "open" ? "open now" : summary.windowStatus === "not_open" ? "not open yet" : "closed"})
            </span>
          </p>
          {!filed ? (
            <div className="flex flex-col gap-1">
              <p className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold">Deadline {formatDate(summary.deadline.deadline)}</span>
                <DaysLeft days={summary.daysLeft} />
              </p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Set by: {DEADLINE_LIMIT_LABEL[summary.deadline.bindingLimit]}.
              </p>
            </div>
          ) : null}
          {summary.deadlineBeforeWindow && !filed ? (
            <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
              This deadline is before the filing window opens on {formatDate(summary.window.start)}, so the report
              can&apos;t be filed in time. Check the inspection dates; a new final inspection may be needed.
            </p>
          ) : null}
          {summary.deadline.limits.length > 1 && !filed ? (
            <ul className="flex flex-col gap-1 text-sm text-neutral-600 dark:text-neutral-400">
              {summary.deadline.limits.map((l) => (
                <li key={l.limit}>
                  {formatDate(l.date)}: {DEADLINE_LIMIT_LABEL[l.limit]}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
}
