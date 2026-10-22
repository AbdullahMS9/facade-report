import { ActionForm } from "@/components/ActionForm";
import { BuildingFields } from "@/components/BuildingFields";
import { BackLink, PageShell } from "@/components/ui";
import { loadProject } from "../load";
import { updateBuilding } from "./actions";

export default async function BuildingPage(props: PageProps<"/projects/[id]/building">) {
  const { id } = await props.params;
  const { project, building } = await loadProject(id);

  return (
    <PageShell title="Building">
      <BackLink href={`/projects/${project.id}`}>{building.address}</BackLink>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Changes apply to every project for this building.
      </p>
      <ActionForm action={updateBuilding.bind(null, building.id, project.id)} submitLabel="Save building" successMessage="Saved.">
        <BuildingFields building={building} />
      </ActionForm>
    </PageShell>
  );
}
