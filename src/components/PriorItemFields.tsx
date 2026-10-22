import { Select, TextArea } from "@/components/fields";
import { Field } from "@/components/ui";

type Item = { id?: string; description: string; location_note: string | null; repaired: boolean | null; notes: string | null };

// `prefix` keeps ids unique when several item forms share a page.
export function PriorItemFields({ item, prefix }: { item?: Item; prefix: string }) {
  return (
    <>
      <TextArea
        label="Condition from the previous report"
        name="description"
        id={`${prefix}-description`}
        required
        maxLength={1000}
        defaultValue={item?.description ?? ""}
      />
      <Field label="Location" name="location_note" id={`${prefix}-location`} maxLength={300} defaultValue={item?.location_note ?? ""} />
      <Select
        label="Repaired?"
        name="repaired"
        id={`${prefix}-repaired`}
        defaultValue={item ? (item.repaired === null ? "" : item.repaired ? "yes" : "no") : ""}
        hint="Not repaired means it must be reported as UNSAFE in this report."
      >
        <option value="">Not decided yet</option>
        <option value="yes">Yes, repaired</option>
        <option value="no">No, report as UNSAFE</option>
      </Select>
      <TextArea label="Notes" name="notes" id={`${prefix}-notes`} maxLength={2000} defaultValue={item?.notes ?? ""} />
    </>
  );
}
