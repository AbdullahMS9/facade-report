import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { Section, Select } from "@/components/fields";
import { BackLink, Field, PageShell } from "@/components/ui";
import { listInspectors } from "@/lib/db/queries";
import { REPORT_TYPES, REPORT_TYPE_LABEL } from "@/lib/schemas/project";
import { updateProjectDetails } from "../actions";
import { loadProject } from "../load";

export default async function ProjectDetailsPage(props: PageProps<"/projects/[id]/details">) {
  const { id } = await props.params;
  const { supabase, project, building } = await loadProject(id);
  const { data: inspectors } = await listInspectors(supabase);
  const d = (x: string | null) => x ?? "";

  return (
    <PageShell title="Project details">
      <BackLink href={`/projects/${project.id}`}>{building.address}</BackLink>
      <ActionForm action={updateProjectDetails.bind(null, project.id)} submitLabel="Save details" successMessage="Saved.">
        <Section title="Report">
          <Field label="Cycle" name="cycle" inputMode="numeric" required defaultValue={String(project.cycle)} />
          <Select label="Report type" name="report_type" defaultValue={project.report_type}>
            {REPORT_TYPES.map((t) => (
              <option key={t} value={t}>{REPORT_TYPE_LABEL[t]}</option>
            ))}
          </Select>
          <Select label="QEWI" name="qewi_id" defaultValue={project.qewi_id ?? ""}>
            <option value="">Not chosen yet</option>
            {(inspectors ?? []).map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.license_type} {i.license_number})
              </option>
            ))}
          </Select>
          {inspectors?.length ? null : (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              No inspectors yet. A QEWI can add them on the <Link href="/team" className="underline">Team</Link> page.
            </p>
          )}
        </Section>

        <Section title="Examination dates">
          <Field label="Exam start" name="exam_start" type="date" defaultValue={d(project.exam_start)} />
          <Field label="Exam end" name="exam_end" type="date" defaultValue={d(project.exam_end)} />
          <Field
            label="Close-up inspections completed"
            name="closeup_complete_date"
            type="date"
            defaultValue={d(project.closeup_complete_date)}
            hint="File within 1 year of this date."
          />
          <Field
            label="QEWI final inspection"
            name="final_visual_date"
            type="date"
            defaultValue={d(project.final_visual_date)}
            hint="The final visual walk-around. File within 60 days of this date."
          />
        </Section>

        <Section title="UNSAFE conditions">
          <Field
            label="DOB and owner notified on"
            name="unsafe_notified_on"
            type="date"
            defaultValue={d(project.unsafe_notified_on)}
            hint="Only if there are UNSAFE conditions. The QEWI must notify DOB and the owner immediately."
          />
        </Section>
      </ActionForm>
    </PageShell>
  );
}
