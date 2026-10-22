import Link from "next/link";
import { BackLink, PageShell } from "@/components/ui";
import type { CheckResult } from "@/lib/rules";
import { checkLink, relatedLink } from "../checkLinks";
import { loadChecks, loadProject } from "../load";

function CheckItem({ check, projectId }: { check: CheckResult; projectId: string }) {
  const link = checkLink(projectId, check);
  const tone = check.passed
    ? "border-green-200"
    : check.severity === "blocker"
      ? "border-red-300 bg-red-50 dark:bg-red-950"
      : "border-amber-300 bg-amber-50 dark:bg-amber-950";
  return (
    <li className={`flex flex-col gap-1 rounded-lg border p-3 text-sm ${tone}`}>
      <span className="font-semibold">
        {check.passed ? "✓ " : check.severity === "blocker" ? "✕ " : "! "}
        {check.title}
      </span>
      <span>{check.message}</span>
      {!check.passed ? (
        <>
          <span className="text-neutral-700 dark:text-neutral-300">{check.fix}</span>
          {check.related.length ? (
            <ul className="flex flex-col">
              {check.related.map((r) => {
                const href = relatedLink(projectId, r.kind, r.id);
                return (
                  <li key={`${r.kind}-${r.id}`}>
                    {href ? (
                      <Link href={href} className="inline-flex min-h-12 items-center underline">{r.label}</Link>
                    ) : (
                      <span>{r.label}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
          <Link href={link.href} className="inline-flex min-h-12 items-center self-start font-medium underline">
            Go to {link.label} ›
          </Link>
        </>
      ) : null}
    </li>
  );
}

export default async function CheckerPage(props: PageProps<"/projects/[id]/checker">) {
  const { id } = await props.params;
  const { project, building } = await loadProject(id);
  const { blockers, warnings, passed } = await loadChecks(id);

  return (
    <PageShell title="Checker">
      <BackLink href={`/projects/${project.id}`}>{building.address}</BackLink>
      <p className="text-sm">
        Checks before filing with DOB. Blockers must be fixed before the report can be marked ready to file. Warnings
        are worth a look. The QEWI makes every classification; the checker only checks completeness.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Blockers ({blockers.length})</h2>
        {blockers.length ? (
          <ul className="flex flex-col gap-2">
            {blockers.map((c) => (
              <CheckItem key={c.id} check={c} projectId={project.id} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-green-800">No blockers.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Warnings ({warnings.length})</h2>
        {warnings.length ? (
          <ul className="flex flex-col gap-2">
            {warnings.map((c) => (
              <CheckItem key={c.id} check={c} projectId={project.id} />
            ))}
          </ul>
        ) : (
          <p className="text-sm">No warnings.</p>
        )}
      </section>

      <details className="rounded-lg border border-neutral-200 px-3 dark:border-neutral-700">
        <summary className="flex min-h-12 cursor-pointer items-center font-semibold">Passed ({passed.length})</summary>
        <ul className="flex flex-col gap-2 pb-3">
          {passed.map((c) => (
            <CheckItem key={c.id} check={c} projectId={project.id} />
          ))}
        </ul>
      </details>
    </PageShell>
  );
}
