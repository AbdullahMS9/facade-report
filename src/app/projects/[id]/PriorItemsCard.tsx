import Link from "next/link";
import { resolvePriorItem } from "@/lib/rules";

// Counts of last cycle's conditions by what happened to them (CLAUDE.md §2).
export function PriorItemsCard({ projectId, items }: { projectId: string; items: { repaired: boolean | null }[] }) {
  const counts = { repaired: 0, carried_forward: 0, unresolved: 0 };
  for (const item of items) counts[resolvePriorItem(item).status]++;

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Prior-cycle items</h2>
        <Link
          href={`/projects/${projectId}/prior-items`}
          aria-label="Manage prior-cycle items"
          className="inline-flex min-h-12 items-center px-2 text-sm font-medium underline"
        >
          Manage
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm">None listed. Add the SWARMP conditions from the previous report, if any.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          <li>{counts.repaired} repaired</li>
          <li className={counts.carried_forward ? "font-medium text-red-700" : ""}>
            {counts.carried_forward} not repaired, reported as UNSAFE
          </li>
          <li className={counts.unresolved ? "font-medium text-amber-700" : ""}>{counts.unresolved} not decided yet</li>
        </ul>
      )}
    </section>
  );
}
