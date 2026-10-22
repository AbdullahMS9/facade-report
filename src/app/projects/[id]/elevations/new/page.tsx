import { ActionForm } from "@/components/ActionForm";
import { ElevationFields } from "@/components/ElevationFields";
import { BackLink, PageShell } from "@/components/ui";
import { loadProject } from "../../load";
import { createElevation } from "../actions";

export default async function NewElevationPage(props: PageProps<"/projects/[id]/elevations/new">) {
  const { id } = await props.params;
  const { project, building } = await loadProject(id);
  return (
    <PageShell title="Add elevation">
      <BackLink href={`/projects/${project.id}`}>{building.address}</BackLink>
      <ActionForm action={createElevation.bind(null, project.id)} submitLabel="Add elevation" pendingLabel="Adding…">
        <ElevationFields />
      </ActionForm>
    </PageShell>
  );
}
