import { CaptureForm } from "@/components/CaptureForm";
import { OfflineSnapshot } from "@/components/OfflineSnapshot";
import { BackLink, PageShell } from "@/components/ui";
import { listElevations } from "@/lib/db/queries";
import { loadProject } from "../../load";

export default async function NewObservationPage(props: PageProps<"/projects/[id]/observations/new">) {
  const { id } = await props.params;
  const { supabase, project, building, membership } = await loadProject(id);
  const { data } = await listElevations(supabase, project.id);
  const elevations = (data ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    closeups: e.closeups.map((c) => ({ id: c.id, location_note: c.location_note })),
  }));

  return (
    <PageShell title="New observation">
      <BackLink href={`/projects/${project.id}/observations`}>Observations</BackLink>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{building.address}</p>
      <CaptureForm
        mode="online"
        project={{ projectId: project.id, firmId: membership.firmId, elevations, finalInspectionDate: project.final_visual_date }}
      />
      <OfflineSnapshot
        snapshot={{
          id: project.id,
          firmId: membership.firmId,
          address: building.address,
          cycle: project.cycle,
          finalInspectionDate: project.final_visual_date,
          elevations,
        }}
      />
    </PageShell>
  );
}
