import Link from "next/link";
import { StatusBadge } from "@/components/Badges";
import { BackLink, PageShell } from "@/components/ui";
import { BOROUGH_LABEL } from "@/lib/schemas/building";
import { REPORT_TYPE_LABEL } from "@/lib/schemas/project";
import { loadProject } from "./load";

export default async function ProjectPage(props: PageProps<"/projects/[id]">) {
  const { id } = await props.params;
  const { project, building } = await loadProject(id);

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

      <section className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Building</h2>
          <Link href={`/projects/${project.id}/building`} className="min-h-12 content-center px-2 text-sm font-medium underline">
            Edit
          </Link>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-neutral-600 dark:text-neutral-400">Block / lot</dt>
          <dd>{building.block ?? "—"} / {building.lot ?? "—"}</dd>
          <dt className="text-neutral-600 dark:text-neutral-400">BIN</dt>
          <dd>{building.bin ?? "—"}</dd>
          <dt className="text-neutral-600 dark:text-neutral-400">Stories</dt>
          <dd>{building.stories ?? "—"}</dd>
          <dt className="text-neutral-600 dark:text-neutral-400">Cavity wall</dt>
          <dd>{building.is_cavity_wall === null ? "Not answered" : building.is_cavity_wall ? "Yes" : "No"}</dd>
          <dt className="text-neutral-600 dark:text-neutral-400">Materials</dt>
          <dd>{building.materials.length ? building.materials.join(", ") : "—"}</dd>
          <dt className="text-neutral-600 dark:text-neutral-400">Owner</dt>
          <dd>{building.owner_name ?? "—"}</dd>
        </dl>
      </section>
    </PageShell>
  );
}
