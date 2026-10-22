import { ActionForm } from "@/components/ActionForm";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { Section } from "@/components/fields";
import { PriorItemFields } from "@/components/PriorItemFields";
import { BackLink, PageShell } from "@/components/ui";
import { resolvePriorItem } from "@/lib/rules";
import { loadProject } from "../load";
import { addPriorItem, deletePriorItem, updatePriorItem } from "../prior-actions";

const STATUS_TEXT = {
  repaired: "Repaired",
  carried_forward: "Not repaired: report as UNSAFE",
  unresolved: "Not decided yet",
} as const;

export default async function PriorItemsPage(props: PageProps<"/projects/[id]/prior-items">) {
  const { id } = await props.params;
  const { supabase, project, building, membership } = await loadProject(id);
  const { data: items } = await supabase
    .from("prior_items")
    .select("id, description, location_note, repaired, notes")
    .eq("project_id", project.id)
    .order("created_at");

  return (
    <PageShell title="Prior-cycle items">
      <BackLink href={`/projects/${project.id}`}>{building.address}</BackLink>
      <p className="text-sm">
        List the conditions the previous report classified as SWARMP. A SWARMP condition that hasn&apos;t been
        repaired must be reported as UNSAFE in this report.
      </p>

      {(items ?? []).map((item, index) => (
        <Section key={item.id} title={`Item ${index + 1}: ${STATUS_TEXT[resolvePriorItem(item).status]}`}>
          <ActionForm action={updatePriorItem.bind(null, project.id, item.id)} submitLabel="Save item" successMessage="Saved.">
            <PriorItemFields item={item} prefix={`item-${item.id}`} />
          </ActionForm>
          {membership.role === "qewi" ? (
            <ConfirmDelete
              action={deletePriorItem.bind(null, project.id, item.id)}
              label="Delete item"
              warning="Delete this item? This can't be undone."
            />
          ) : null}
        </Section>
      ))}

      <Section title="Add an item">
        <ActionForm action={addPriorItem.bind(null, project.id)} submitLabel="Add item" pendingLabel="Adding…" resetOnSuccess>
          <PriorItemFields prefix="new" />
        </ActionForm>
      </Section>
    </PageShell>
  );
}
