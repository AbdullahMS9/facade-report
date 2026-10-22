import { BackLink, PageShell } from "@/components/ui";
import { listElevations } from "@/lib/db/queries";
import { loadProject } from "../../load";
import { NewObservationForm } from "./NewObservationForm";

export default async function NewObservationPage(props: PageProps<"/projects/[id]/observations/new">) {
  const { id } = await props.params;
  const { supabase, project, building, membership } = await loadProject(id);
  const { data: elevations } = await listElevations(supabase, project.id);

  return (
    <PageShell title="New observation">
      <BackLink href={`/projects/${project.id}/observations`}>Observations</BackLink>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{building.address}</p>
      <NewObservationForm
        projectId={project.id}
        firmId={membership.firmId}
        elevations={(elevations ?? []).map((e) => ({ id: e.id, name: e.name, closeups: e.closeups }))}
        finalInspectionDate={project.final_visual_date}
      />
    </PageShell>
  );
}
