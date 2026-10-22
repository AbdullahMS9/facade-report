import { Section, Select, TextArea, YesNoSelect } from "@/components/fields";
import { Field } from "@/components/ui";
import { BOROUGHS, BOROUGH_LABEL } from "@/lib/schemas/building";
import type { Database } from "@/types/database";

type Building = Database["public"]["Tables"]["buildings"]["Row"];

const v = (x: string | number | null) => (x === null ? "" : String(x));

// All building fields, grouped as in the report (CLAUDE.md §3.5 items 2–4).
export function BuildingFields({ building }: { building: Building }) {
  return (
    <>
      <Section title="Identifiers">
        <Field label="Address" name="address" required maxLength={300} defaultValue={building.address} autoComplete="street-address" />
        <Select label="Borough" name="borough" required defaultValue={building.borough}>
          {BOROUGHS.map((b) => (
            <option key={b} value={b}>{BOROUGH_LABEL[b]}</option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Block" name="block" inputMode="numeric" maxLength={5} defaultValue={v(building.block)} />
          <Field label="Lot" name="lot" inputMode="numeric" maxLength={4} defaultValue={v(building.lot)} />
        </div>
        <Field label="BIN" name="bin" inputMode="numeric" maxLength={7} defaultValue={v(building.bin)} hint="7 digits" />
        <Field label="Nearest cross street" name="cross_street" maxLength={200} defaultValue={v(building.cross_street)} />
        <YesNoSelect label="Landmark?" name="is_landmark" value={building.is_landmark} />
      </Section>

      <Section title="Description">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stories" name="stories" inputMode="numeric" defaultValue={v(building.stories)} />
          <Field label="Height (ft)" name="height_ft" inputMode="decimal" defaultValue={v(building.height_ft)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Year built" name="year_built" inputMode="numeric" maxLength={4} defaultValue={v(building.year_built)} />
          <Field label="C of O number" name="co_number" maxLength={50} defaultValue={v(building.co_number)} />
        </div>
        <Field label="Use" name="use" maxLength={200} defaultValue={v(building.use)} hint="For example: residential, mixed use" />
        <TextArea
          label="Exterior wall materials"
          name="materials"
          defaultValue={building.materials.join(", ")}
          hint="Separate with commas, for example: brick, terra cotta, cast stone"
        />
        <TextArea
          label="Material notes"
          name="materials_notes"
          maxLength={2000}
          defaultValue={v(building.materials_notes)}
          hint="Age of each material, later additions, etc."
        />
        <YesNoSelect label="Cavity wall?" name="is_cavity_wall" value={building.is_cavity_wall} hint="Cavity walls need probes." />
      </Section>

      <Section title="Owner">
        <Field label="Owner name" name="owner_name" maxLength={200} defaultValue={v(building.owner_name)} />
        <TextArea label="Mailing address" name="owner_address" maxLength={500} defaultValue={v(building.owner_address)} />
        <Field label="Phone" name="owner_phone" type="tel" maxLength={50} defaultValue={v(building.owner_phone)} />
        <Field
          label="Principal's name"
          name="owner_principal_name"
          maxLength={200}
          defaultValue={v(building.owner_principal_name)}
          hint="If the owner is a company"
        />
        <Field label="Principal's title" name="owner_principal_title" maxLength={200} defaultValue={v(building.owner_principal_title)} />
      </Section>
    </>
  );
}
