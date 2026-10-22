"use client";

import { useState } from "react";
import { Select } from "@/components/fields";
import { Field } from "@/components/ui";
import { BOROUGHS, BOROUGH_LABEL } from "@/lib/schemas/building";

type BuildingOption = { id: string; address: string; borough: keyof typeof BOROUGH_LABEL; bin: string | null };

// Pick a building the firm already has (for a later cycle), or enter a new one.
export function BuildingChoice({ buildings }: { buildings: BuildingOption[] }) {
  const [choice, setChoice] = useState<"new" | "existing">("new");

  return (
    <div className="flex flex-col gap-4">
      {buildings.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Building</legend>
          <label className="flex min-h-12 items-center gap-3">
            <input type="radio" name="building_choice" value="new" checked={choice === "new"} onChange={() => setChoice("new")} className="size-5" />
            New building
          </label>
          <label className="flex min-h-12 items-center gap-3">
            <input
              type="radio"
              name="building_choice"
              value="existing"
              checked={choice === "existing"}
              onChange={() => setChoice("existing")}
              className="size-5"
            />
            Existing building
          </label>
        </fieldset>
      ) : (
        <input type="hidden" name="building_choice" value="new" />
      )}

      {choice === "existing" ? (
        <Select label="Choose building" name="building_id" required defaultValue="">
          <option value="" disabled>Select…</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.address}, {BOROUGH_LABEL[b.borough]}
              {b.bin ? ` (BIN ${b.bin})` : ""}
            </option>
          ))}
        </Select>
      ) : (
        <>
          <Field label="Address" name="address" required maxLength={300} autoComplete="street-address" />
          <Select label="Borough" name="borough" required defaultValue="">
            <option value="" disabled>Select…</option>
            {BOROUGHS.map((b) => (
              <option key={b} value={b}>{BOROUGH_LABEL[b]}</option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Block" name="block" inputMode="numeric" maxLength={5} hint="Sets the filing window" />
            <Field label="Lot" name="lot" inputMode="numeric" maxLength={4} />
          </div>
          <Field label="BIN" name="bin" inputMode="numeric" maxLength={7} hint="7 digits, if you have it" />
        </>
      )}
    </div>
  );
}
