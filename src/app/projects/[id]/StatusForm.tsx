import { ActionForm } from "@/components/ActionForm";
import { Select } from "@/components/fields";
import { PROJECT_STATUSES, STATUS_LABEL } from "@/lib/schemas/project";
import { updateStatus } from "./actions";

export function StatusForm({ projectId, status }: { projectId: string; status: keyof typeof STATUS_LABEL }) {
  return (
    <ActionForm action={updateStatus.bind(null, projectId)} submitLabel="Update status" successMessage="Status updated.">
      <Select label="Status" name="status" defaultValue={status}>
        {PROJECT_STATUSES.map((s) => (
          <option key={s} value={s}>{STATUS_LABEL[s]}</option>
        ))}
      </Select>
    </ActionForm>
  );
}
