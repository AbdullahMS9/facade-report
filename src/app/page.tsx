import Link from "next/link";
import { DaysLeft, StatusBadge } from "@/components/Badges";
import { PageShell } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { listProjects } from "@/lib/db/queries";
import { filingSummary } from "@/lib/rules";
import { BOROUGH_LABEL } from "@/lib/schemas/building";
import { REPORT_TYPE_LABEL } from "@/lib/schemas/project";
import { formatDate, todayInNewYork } from "@/lib/today";
import { SignOutButton } from "@/components/SignOutButton";

export default async function Home() {
  const { supabase, user, membership } = await requireMember();
  const { data: projects } = await listProjects(supabase);
  const today = todayInNewYork();

  return (
    <PageShell title="Projects">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {membership.firmName} · {user.email} · {membership.role === "qewi" ? "QEWI" : "Staff"}
      </p>
      <Link
        href="/projects/new"
        className="flex min-h-12 items-center justify-center rounded-lg bg-blue-700 px-4 font-medium text-white hover:bg-blue-800"
      >
        New project
      </Link>

      {projects && projects.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {projects.map((p) => {
            const b = p.buildings;
            const summary = filingSummary({
              block: b?.block ?? null,
              cycle: p.cycle,
              finalInspectionDate: p.final_visual_date,
              closeupCompleteDate: p.closeup_complete_date,
              today,
            });
            return (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex flex-col gap-1 rounded-lg border border-neutral-200 p-4 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                >
                  <span className="font-medium">{b?.address}</span>
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    {b ? BOROUGH_LABEL[b.borough] : ""} · Cycle {p.cycle} · {REPORT_TYPE_LABEL[p.report_type]}
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={p.status} />
                    {summary.kind === "ok" && p.status !== "filed" ? (
                      <>
                        <span className="text-sm">Due {formatDate(summary.deadline.deadline)}</span>
                        <DaysLeft days={summary.daysLeft} />
                      </>
                    ) : summary.kind === "missing_block" ? (
                      <span className="text-sm text-amber-700">Add the block number to see the deadline</span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p>No projects yet. Create one to start an inspection.</p>
      )}

      <div className="flex items-center justify-between">
        <Link href="/team" className="min-h-12 content-center text-sm underline">Team</Link>
        <SignOutButton />
      </div>
    </PageShell>
  );
}
