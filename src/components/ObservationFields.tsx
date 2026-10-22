"use client";

import { useState } from "react";
import { Select, TextArea } from "@/components/fields";
import { Field } from "@/components/ui";
import { checkRepairDate } from "@/lib/rules";
import { CLASSIFICATIONS, CLASSIFICATION_LABEL, ELEMENT_SUGGESTIONS } from "@/lib/schemas/observation";

export type ElevationOption = { id: string; name: string; closeups: { id: string; location_note: string }[] };
export type ObservationValues = {
  elevation_id: string | null;
  closeup_id: string | null;
  floor: string | null;
  element: string;
  condition: string;
  classification: "safe" | "swarmp" | "unsafe";
  cause: string | null;
  recommended_repair: string | null;
  repair_by_date: string | null;
  notes: string | null;
};

const CLASS_STYLE = {
  safe: "peer-checked:border-green-700 peer-checked:bg-green-50 peer-checked:text-green-900",
  swarmp: "peer-checked:border-amber-600 peer-checked:bg-amber-50 peer-checked:text-amber-900",
  unsafe: "peer-checked:border-red-700 peer-checked:bg-red-50 peer-checked:text-red-900",
} as const;

// Shared by the new and edit forms. Repair-date limits are shown as you type
// (warnings only; the checker blocks filing later).
export function ObservationFields({
  elevations,
  finalInspectionDate,
  initial,
}: {
  elevations: ElevationOption[];
  finalInspectionDate: string | null;
  initial?: ObservationValues;
}) {
  const [elevationId, setElevationId] = useState(initial?.elevation_id ?? "");
  const [classification, setClassification] = useState(initial?.classification ?? "");
  const [repairBy, setRepairBy] = useState(initial?.repair_by_date ?? "");
  const drops = elevations.find((e) => e.id === elevationId)?.closeups ?? [];
  const needsRepair = classification === "swarmp" || classification === "unsafe";
  const repairCheck =
    needsRepair
      ? checkRepairDate({ classification, repairBy: repairBy || null, finalInspectionDate })
      : { ok: true as const };

  return (
    <>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Classification</legend>
        <div className="grid grid-cols-3 gap-2">
          {CLASSIFICATIONS.map((c) => (
            <label key={c} className="relative">
              <input
                type="radio"
                name="classification"
                value={c}
                required
                checked={classification === c}
                onChange={() => setClassification(c)}
                className="peer sr-only"
              />
              <span
                className={`flex min-h-12 cursor-pointer items-center justify-center rounded-lg border-2 border-neutral-300 font-semibold peer-focus-visible:ring-2 dark:border-neutral-600 ${CLASS_STYLE[c]}`}
              >
                {CLASSIFICATION_LABEL[c]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Select label="Elevation" name="elevation_id" value={elevationId} onChange={(e) => setElevationId(e.target.value)}>
        <option value="">Not on a specific elevation</option>
        {elevations.map((e) => (
          <option key={e.id} value={e.id}>{e.name}</option>
        ))}
      </Select>
      {drops.length > 0 ? (
        <Select label="Drop" name="closeup_id" defaultValue={initial?.closeup_id ?? ""} key={elevationId}>
          <option value="">Not from a drop</option>
          {drops.map((d, i) => (
            <option key={d.id} value={d.id}>Drop {i + 1}: {d.location_note}</option>
          ))}
        </Select>
      ) : null}
      <Field label="Floor" name="floor" maxLength={50} defaultValue={initial?.floor ?? ""} hint="For example: 6, 6–8, Roof" />
      <Field
        label="Element"
        name="element"
        required
        maxLength={200}
        list="element-suggestions"
        defaultValue={initial?.element ?? ""}
        autoComplete="off"
      />
      <datalist id="element-suggestions">
        {ELEMENT_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <TextArea label="Condition" name="condition" required maxLength={2000} defaultValue={initial?.condition ?? ""} hint="What you found" />
      <TextArea label="Cause" name="cause" maxLength={2000} defaultValue={initial?.cause ?? ""} hint="Needed for SWARMP and UNSAFE conditions" />
      <TextArea label="Recommended repair" name="recommended_repair" maxLength={2000} defaultValue={initial?.recommended_repair ?? ""} />
      <Field
        label="Repair by"
        name="repair_by_date"
        type="date"
        value={repairBy}
        onChange={(e) => setRepairBy(e.target.value)}
      />
      {!repairCheck.ok ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">{repairCheck.message}</p>
      ) : null}
      <TextArea label="Notes" name="notes" maxLength={4000} defaultValue={initial?.notes ?? ""} />
    </>
  );
}
