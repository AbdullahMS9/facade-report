import { z } from "zod";
import { requiredText } from ".";

export const LICENSE_TYPES = ["PE", "RA"] as const;

export const inspectorSchema = z.object({
  name: requiredText("the inspector's name", 200),
  license_type: z.enum(LICENSE_TYPES, { error: "Choose PE or RA." }),
  license_number: requiredText("the license number", 50),
  user_id: z.preprocess(
    (v) => (v === null || v === undefined || v === "" ? null : v),
    z.uuid({ error: "Choose a team member from the list." }).nullable(),
  ),
});
