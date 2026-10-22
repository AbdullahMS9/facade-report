import Link from "next/link";
import { loadChecks } from "./load";

// Every project page shows the checker's state (CLAUDE.md §4 item 8: "always visible").
export default async function ProjectLayout(props: LayoutProps<"/projects/[id]">) {
  const { id } = await props.params;
  const { blockers, warnings } = await loadChecks(id);
  const tone = blockers.length
    ? "border-red-200 bg-red-50 text-red-900"
    : warnings.length
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-green-200 bg-green-50 text-green-900";
  const text = blockers.length
    ? `Checker: ${blockers.length} blocker${blockers.length === 1 ? "" : "s"}${warnings.length ? `, ${warnings.length} warning${warnings.length === 1 ? "" : "s"}` : ""}`
    : warnings.length
      ? `Checker: no blockers, ${warnings.length} warning${warnings.length === 1 ? "" : "s"}`
      : "Checker: ready to file";

  return (
    <>
      <Link
        href={`/projects/${id}/checker`}
        className={`sticky top-0 z-10 flex min-h-12 items-center justify-between border-b px-4 text-sm font-medium ${tone}`}
      >
        <span>{text}</span>
        <span aria-hidden="true">›</span>
      </Link>
      {props.children}
    </>
  );
}
