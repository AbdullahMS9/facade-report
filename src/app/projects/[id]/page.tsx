import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { StatusBadge } from "@/components/Badges";
import { BackLink, PageShell } from "@/components/ui";
import { listElevations } from "@/lib/db/queries";
import { filingSummary, probesApply } from "@/lib/rules";
import { BOROUGH_LABEL } from "@/lib/schemas/building";
import { REPORT_TYPE_LABEL } from "@/lib/schemas/project";
import { formatDate, todayInNewYork } from "@/lib/today";
import { ElevationsCard } from "./ElevationsCard";
import { FilingPanel } from "./FilingPanel";
import { ObservationsCard } from "./ObservationsCard";
import { PriorFilingsPanel, PriorFilingsSkeleton } from "./PriorFilingsPanel";
import { PriorItemsCard } from "./PriorItemsCard";
import { loadProject } from "./load";
import { StatusForm } from "./StatusForm";

function Card({ title, editHref, children }: { title: string; editHref?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {editHref ? (
          <Link
            href={editHref}
            aria-label={`Edit ${title.toLowerCase()}`}
            className="inline-flex min-h-12 items-center px-2 text-sm font-medium underline"
          >
            Edit
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-neutral-600 dark:text-neutral-400">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const yesNo = (v: boolean | null) => (v === null ? "Not answered" : v ? "Yes" : "No");
const date = (v: string | null) => (v ? formatDate(v) : "—");

export default async function ProjectPage(props: PageProps<"/projects/[id]">) {
  const { id } = await props.params;
  const { supabase, project, building, membership } = await loadProject(id);
  const { data: elevations } = await listElevations(supabase, project.id);
  const [{ data: priorItems }, { data: observations }, { count: projectPhotoCount }] = await Promise.all([
    supabase.from("prior_items").select("repaired").eq("project_id", project.id),
    supabase.from("observations").select("classification, photos(count)").eq("project_id", project.id),
    supabase
      .from("photos")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id)
      .is("observation_id", null),
  ]);
  const summary = filingSummary({
    block: building.block,
    cycle: project.cycle,
    finalInspectionDate: project.final_visual_date,
    closeupCompleteDate: project.closeup_complete_date,
    today: todayInNewYork(),
  });
  const qewi = project.inspectors;

  return (
    <PageShell title={building.address}>
      <BackLink href="/">Projects</BackLink>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>{BOROUGH_LABEL[building.borough]}</span>
        <span>·</span>
        <span>Cycle {project.cycle}</span>
        <span>·</span>
        <span>{REPORT_TYPE_LABEL[project.report_type]}</span>
        <StatusBadge status={project.status} />
      </div>

      <FilingPanel summary={summary} projectId={project.id} filed={project.status === "filed"} />

      <ObservationsCard
        projectId={project.id}
        observations={(observations ?? []).map((o) => ({
          classification: o.classification,
          photoCount: o.photos[0]?.count ?? 0,
        }))}
        priorItems={priorItems ?? []}
        projectPhotoCount={projectPhotoCount ?? 0}
      />

      <ElevationsCard
        projectId={project.id}
        elevations={elevations ?? []}
        showProbes={probesApply(building.is_cavity_wall, project.cycle)}
      />

      <Suspense fallback={<PriorFilingsSkeleton />}>
        <PriorFilingsPanel db={supabase} building={building} projectId={project.id} cycle={project.cycle} />
      </Suspense>

      <PriorItemsCard projectId={project.id} items={priorItems ?? []} />

      <Card title="Project" editHref={`/projects/${project.id}/details`}>
        <Facts
          rows={[
            ["QEWI", qewi ? `${qewi.name} (${qewi.license_type} ${qewi.license_number})` : "Not chosen yet"],
            ["Exam", project.exam_start || project.exam_end ? `${date(project.exam_start)} – ${date(project.exam_end)}` : "—"],
            ["Close-ups completed", date(project.closeup_complete_date)],
            ["Final inspection", date(project.final_visual_date)],
            ["UNSAFE notice sent", date(project.unsafe_notified_on)],
          ]}
        />
      </Card>

      <Card title="Building" editHref={`/projects/${project.id}/building`}>
        <Facts
          rows={[
            ["Block / lot", `${building.block ?? "—"} / ${building.lot ?? "—"}`],
            ["BIN", building.bin ?? "—"],
            ["Stories", building.stories ?? "—"],
            ["Cavity wall", yesNo(building.is_cavity_wall)],
            ["Landmark", yesNo(building.is_landmark)],
            ["Materials", building.materials.length ? building.materials.join(", ") : "—"],
            ["Owner", building.owner_name ?? "—"],
          ]}
        />
      </Card>

      {membership.role === "qewi" ? (
        <Card title="Status">
          <StatusForm projectId={project.id} status={project.status} />
        </Card>
      ) : null}
    </PageShell>
  );
}
