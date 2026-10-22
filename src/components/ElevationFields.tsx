import { Select, TextArea } from "@/components/fields";
import { Field } from "@/components/ui";

type Elevation = { name: string; faces_street: boolean; frontage_ft: number; setbacks_note: string | null };

export function ElevationFields({ elevation }: { elevation?: Elevation }) {
  return (
    <>
      <Field label="Name" name="name" required maxLength={100} defaultValue={elevation?.name ?? ""} hint="For example: North (Main Street)" />
      <Select
        label="Faces a street?"
        name="faces_street"
        required
        defaultValue={elevation ? (elevation.faces_street ? "yes" : "no") : ""}
        hint="Fronts a public right-of-way. Street elevations need a close-up every 60 ft."
      >
        <option value="" disabled>Select…</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </Select>
      <Field
        label="Frontage (ft)"
        name="frontage_ft"
        inputMode="decimal"
        defaultValue={elevation && elevation.frontage_ft > 0 ? String(elevation.frontage_ft) : ""}
        hint="Length of the elevation along the street"
      />
      <TextArea label="Setbacks" name="setbacks_note" maxLength={2000} defaultValue={elevation?.setbacks_note ?? ""} />
    </>
  );
}
