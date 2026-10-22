import { notFound } from "next/navigation";
import { z } from "zod";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { ElevationFields } from "@/components/ElevationFields";
import { Section, Select, TextArea } from "@/components/fields";
import { BackLink, Field, Message, PageShell } from "@/components/ui";
import { getElevation } from "@/lib/db/queries";
import { elevationProgress, probesApply } from "@/lib/rules";
import { CLOSEUP_METHODS, CLOSEUP_METHOD_LABEL } from "@/lib/schemas/elevation";
import { formatDate, todayInNewYork } from "@/lib/today";
import { loadProject } from "../../load";
import {
  addCloseup,
  addProbe,
  deleteCloseup,
  deleteElevation,
  deleteProbe,
  updateElevation,
} from "../actions";

export default async function ElevationPage(props: PageProps<"/projects/[id]/elevations/[elevationId]">) {
  const { id, elevationId } = await props.params;
  const { supabase, project, building, membership } = await loadProject(id);
  const eid = z.uuid().safeParse(elevationId);
  if (!eid.success) notFound();
  const { data: elevation } = await getElevation(supabase, project.id, eid.data);
  if (!elevation) notFound();

  const isQewi = membership.role === "qewi";
  const today = todayInNewYork();
  const progress = elevationProgress({
    facesStreet: elevation.faces_street,
    frontageFt: Number(elevation.frontage_ft),
    closeupCount: elevation.closeups.length,
  });
  const showProbes = probesApply(building.is_cavity_wall, project.cycle);

  return (
    <PageShell title={elevation.name}>
      <BackLink href={`/projects/${project.id}`}>{building.address}</BackLink>

      {progress.required === null ? (
        <Message tone="info">
          Not a street elevation: close-ups at a representative sample the QEWI chooses. {progress.recorded} drop
          {progress.recorded === 1 ? "" : "s"} recorded.
        </Message>
      ) : progress.required === 0 ? (
        <Message tone="error">Enter the frontage to see how many drops this street elevation needs.</Message>
      ) : (
        <Message tone={progress.short > 0 ? "error" : "success"}>
          {progress.recorded} of {progress.required} required drops recorded
          {progress.short > 0 ? ` (${progress.short} more needed)` : ""}.
        </Message>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Drops (close-up inspections)</h2>
        {elevation.closeups.length === 0 ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">No drops recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {elevation.closeups.map((c, index) => (
              <li key={c.id} className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
                <div className="flex flex-col gap-1">
                  <span className="font-medium">
                    Drop {index + 1}: {c.location_note}
                  </span>
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    {formatDate(c.inspected_on)} · {CLOSEUP_METHOD_LABEL[c.method]}
                  </span>
                </div>

                {showProbes ? (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold">Probes</h3>
                    {c.probes.length === 0 ? (
                      <p className="text-sm text-amber-700">
                        No probe yet. Cavity walls need at least one probe along each close-up interval.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {c.probes.map((p) => (
                          <li key={p.id} className="flex flex-col gap-1 rounded-md bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
                            <span className="font-medium">{p.location_note}</span>
                            <span>{formatDate(p.probed_on)}</span>
                            {p.tie_type ? <span>Tie type: {p.tie_type}</span> : null}
                            {p.tie_spacing ? <span>Spacing: {p.tie_spacing}</span> : null}
                            {p.tie_condition ? <span>Condition: {p.tie_condition}</span> : null}
                            {isQewi ? (
                              <ConfirmDelete
                                action={deleteProbe.bind(null, project.id, p.id)}
                                label="Delete probe"
                                warning="Delete this probe? This can't be undone."
                              />
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                    <details className="rounded-lg border border-neutral-200 px-3 dark:border-neutral-700">
                      <summary className="flex min-h-12 cursor-pointer items-center text-sm font-medium">Add probe</summary>
                      <div className="pb-3">
                        <ActionForm
                          action={addProbe.bind(null, project.id, c.id)}
                          submitLabel="Add probe"
                          pendingLabel="Adding…"
                          resetOnSuccess
                        >
                          <Field label="Probe location" name="location_note" id={`probe-loc-${c.id}`} required maxLength={300} />
                          <Field label="Probe date" name="probed_on" id={`probe-date-${c.id}`} type="date" required defaultValue={today} />
                          <Field label="Tie type" name="tie_type" id={`probe-type-${c.id}`} maxLength={200} />
                          <Field label="Tie spacing" name="tie_spacing" id={`probe-spacing-${c.id}`} maxLength={200} />
                          <TextArea label="Tie condition" name="tie_condition" id={`probe-cond-${c.id}`} maxLength={1000} />
                        </ActionForm>
                      </div>
                    </details>
                  </div>
                ) : null}

                {isQewi ? (
                  <ConfirmDelete
                    action={deleteCloseup.bind(null, project.id, c.id)}
                    label="Delete drop"
                    warning="Delete this drop and its probes? This can't be undone."
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {building.is_cavity_wall === null ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Is this a cavity wall building? Answer on the building page to see probe requirements.
          </p>
        ) : showProbes ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Probe waivers (recent tie repair, new building, DOB-accepted alternate method) aren&apos;t tracked yet.
          </p>
        ) : null}
      </section>

      <Section title="Add a drop">
        <ActionForm
          action={addCloseup.bind(null, project.id, elevation.id)}
          submitLabel="Add drop"
          pendingLabel="Adding…"
          successMessage="Drop added."
          resetOnSuccess
        >
          <Field label="Location" name="location_note" required maxLength={300} hint="For example: Bay 2, east of entrance" />
          <Field label="Date" name="inspected_on" type="date" required defaultValue={today} />
          <Select label="Method" name="method" required defaultValue="">
            <option value="" disabled>Select…</option>
            {CLOSEUP_METHODS.map((m) => (
              <option key={m} value={m}>{CLOSEUP_METHOD_LABEL[m]}</option>
            ))}
          </Select>
        </ActionForm>
      </Section>

      <Section title="Elevation details">
        <ActionForm
          action={updateElevation.bind(null, project.id, elevation.id)}
          submitLabel="Save elevation"
          successMessage="Saved."
        >
          <ElevationFields elevation={{ ...elevation, frontage_ft: Number(elevation.frontage_ft) }} />
        </ActionForm>
      </Section>

      {isQewi ? (
        <ConfirmDelete
          action={deleteElevation.bind(null, project.id, elevation.id)}
          label="Delete elevation"
          warning={`Delete ${elevation.name} with its ${elevation.closeups.length} drop(s) and their probes? This can't be undone.`}
        />
      ) : null}
    </PageShell>
  );
}
