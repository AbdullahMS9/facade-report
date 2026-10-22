import { z } from "zod";
import { optionalDate, optionalText, requiredText } from ".";

export const CLASSIFICATIONS = ["safe", "swarmp", "unsafe"] as const;
export const CLASSIFICATION_LABEL = { safe: "SAFE", swarmp: "SWARMP", unsafe: "UNSAFE" } as const;

const optionalId = z.preprocess(
  (v) => (v === null || v === undefined || v === "" ? null : v),
  z.uuid({ error: "Choose from the list." }).nullable(),
);

export const observationSchema = z
  .object({
    elevation_id: optionalId,
    closeup_id: optionalId,
    floor: optionalText("floor", 50),
    element: requiredText("the element (for example Parapet)", 200),
    condition: requiredText("the condition you found", 2000),
    classification: z.enum(CLASSIFICATIONS, { error: "Choose SAFE, SWARMP or UNSAFE." }),
    cause: optionalText("cause", 2000),
    recommended_repair: optionalText("recommended repair", 2000),
    repair_by_date: optionalDate("the repair date"),
    notes: optionalText("notes", 4000),
  })
  .transform((o) => ({ ...o, closeup_id: o.elevation_id ? o.closeup_id : null }));

// Common facade elements, offered as suggestions (appurtenances from §103-04(a)).
export const ELEMENT_SUGGESTIONS = [
  "Brick masonry",
  "Terra cotta",
  "Stone",
  "Stucco",
  "Metal panel",
  "Curtain wall",
  "Lintel",
  "Relieving angle",
  "Sealant joint",
  "Parapet",
  "Coping",
  "Cornice",
  "Balcony",
  "Terrace enclosure",
  "Fire escape",
  "Railing",
  "Guard rail",
  "Window frame",
  "Window guard",
  "Window air conditioner",
  "Flower box",
  "Sign",
  "Flagpole",
  "Ladder to roof",
  "Satellite dish",
  "Antenna",
  "Exterior fixture",
];
