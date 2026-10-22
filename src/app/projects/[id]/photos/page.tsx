import { Section } from "@/components/fields";
import { PhotoGrid } from "@/components/PhotoGrid";
import { PhotoUploader } from "@/components/PhotoUploader";
import { BackLink, PageShell } from "@/components/ui";
import { signedUrls } from "@/lib/photos/signed";
import { probesApply } from "@/lib/rules";
import { PHOTO_KIND_LABEL, type PhotoKind } from "@/lib/schemas/photo";
import { loadProject } from "../load";

// What each kind needs, from CLAUDE.md §3.6.
const HINTS: Record<Exclude<PhotoKind, "condition">, string> = {
  elevation: "The house number, and at least one full view of each street elevation.",
  inspector: "A dated photo of the QEWI or staff doing a close-up inspection.",
  typical: "A SAFE building needs at least three photos of typical conditions.",
  probe: "Probe openings, wall cross section, tie type and spacing, relieving angles.",
};

export default async function PhotosPage(props: PageProps<"/projects/[id]/photos">) {
  const { id } = await props.params;
  const { supabase, project, building, membership } = await loadProject(id);
  const { data } = await supabase
    .from("photos")
    .select("id, kind, display_path, width, height, taken_at, taken_at_source")
    .eq("project_id", project.id)
    .is("observation_id", null)
    .order("created_at");
  const photos = data ?? [];
  const urls = await signedUrls(supabase, photos.map((p) => p.display_path));

  const kinds: Exclude<PhotoKind, "condition">[] = ["elevation", "inspector", "typical"];
  if (probesApply(building.is_cavity_wall, project.cycle)) kinds.push("probe");

  return (
    <PageShell title="Project photos">
      <BackLink href={`/projects/${project.id}`}>{building.address}</BackLink>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Condition photos are added on each observation. Photos must be color, dated and at least 800 × 600.
      </p>
      {kinds.map((kind) => {
        const ofKind = photos.filter((p) => p.kind === kind);
        return (
          <Section key={kind} title={`${PHOTO_KIND_LABEL[kind]} (${ofKind.length})`}>
            <p className="text-sm">{HINTS[kind]}</p>
            <PhotoGrid photos={ofKind} urls={urls} projectId={project.id} canDelete={membership.role === "qewi"} />
            <PhotoUploader
              firmId={membership.firmId}
              projectId={project.id}
              kind={kind}
              label={`Choose ${PHOTO_KIND_LABEL[kind].toLowerCase()} photos`}
            />
          </Section>
        );
      })}
    </PageShell>
  );
}
