import { ActionForm } from "@/components/ActionForm";
import { Select } from "@/components/fields";
import { BackLink, Field, PageShell } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { listBuildings } from "@/lib/db/queries";
import { FISP_RULES } from "@/lib/rules";
import { REPORT_TYPES, REPORT_TYPE_LABEL } from "@/lib/schemas/project";
import { createProject } from "./actions";
import { BuildingChoice } from "./BuildingChoice";

export default async function NewProjectPage() {
  const { supabase } = await requireMember();
  const { data: buildings } = await listBuildings(supabase);

  return (
    <PageShell title="New project">
      <BackLink href="/">Projects</BackLink>
      <ActionForm action={createProject} submitLabel="Create project" pendingLabel="Creating…">
        <BuildingChoice buildings={buildings ?? []} />
        <Field
          label="Cycle"
          name="cycle"
          inputMode="numeric"
          required
          defaultValue={String(FISP_RULES.cycle.referenceCycle)}
          hint="Cycle 10 runs Feb 21, 2025 – Feb 21, 2030"
        />
        <Select label="Report type" name="report_type" defaultValue="initial">
          {REPORT_TYPES.map((t) => (
            <option key={t} value={t}>{REPORT_TYPE_LABEL[t]}</option>
          ))}
        </Select>
      </ActionForm>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        You can add the rest of the building details after creating the project.
      </p>
    </PageShell>
  );
}
