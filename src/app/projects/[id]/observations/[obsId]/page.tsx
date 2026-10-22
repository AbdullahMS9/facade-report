import { notFound } from "next/navigation";
import { z } from "zod";
import { ActionForm } from "@/components/ActionForm";
import { ClassificationBadge } from "@/components/Badges";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { Section } from "@/components/fields";
import { ObservationFields } from "@/components/ObservationFields";
import { PhotoGrid } from "@/components/PhotoGrid";
import { PhotoUploader } from "@/components/PhotoUploader";
import { BackLink, PageShell } from "@/components/ui";
import { getObservation, listElevations } from "@/lib/db/queries";
import { signedUrls } from "@/lib/photos/signed";
import { loadProject } from "../../load";
import { deleteObservation, updateObservation } from "../actions";

export default async function ObservationPage(props: PageProps<"/projects/[id]/observations/[obsId]">) {
  const { id, obsId } = await props.params;
  const { supabase, project, membership } = await loadProject(id);
  const oid = z.uuid().safeParse(obsId);
  if (!oid.success) notFound();
  const [{ data: observation }, { data: elevations }] = await Promise.all([
    getObservation(supabase, project.id, oid.data),
    listElevations(supabase, project.id),
  ]);
  if (!observation) notFound();
  const urls = await signedUrls(supabase, observation.photos.map((p) => p.display_path));
  const isQewi = membership.role === "qewi";

  return (
    <PageShell title={observation.element}>
      <BackLink href={`/projects/${project.id}/observations`}>Observations</BackLink>
      <div className="flex items-center gap-2">
        <ClassificationBadge value={observation.classification} />
        {observation.floor ? <span className="text-sm">Floor {observation.floor}</span> : null}
      </div>

      <Section title={`Photos (${observation.photos.length})`}>
        <PhotoGrid photos={observation.photos} urls={urls} projectId={project.id} canDelete={isQewi} />
        <PhotoUploader
          firmId={membership.firmId}
          projectId={project.id}
          kind="condition"
          observationId={observation.id}
          label="Choose photos"
        />
      </Section>

      <Section title="Details">
        <ActionForm
          action={updateObservation.bind(null, project.id, observation.id)}
          submitLabel="Save observation"
          successMessage="Saved."
        >
          <ObservationFields
            elevations={(elevations ?? []).map((e) => ({ id: e.id, name: e.name, closeups: e.closeups }))}
            finalInspectionDate={project.final_visual_date}
            initial={observation}
          />
        </ActionForm>
      </Section>

      {isQewi ? (
        <ConfirmDelete
          action={deleteObservation.bind(null, project.id, observation.id)}
          label="Delete observation"
          warning={`Delete this observation and its ${observation.photos.length} photo(s)? This can't be undone.`}
        />
      ) : null}
    </PageShell>
  );
}
