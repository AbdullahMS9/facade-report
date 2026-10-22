import { z } from "zod";
import { formFields, optionalInt, optionalNumber, optionalText, requiredText, yesNoUnknown } from ".";

export const BOROUGHS = ["manhattan", "bronx", "brooklyn", "queens", "staten_island"] as const;
export type Borough = (typeof BOROUGHS)[number];

export const BOROUGH_LABEL: Record<Borough, string> = {
  manhattan: "Manhattan",
  bronx: "Bronx",
  brooklyn: "Brooklyn",
  queens: "Queens",
  staten_island: "Staten Island",
};

// First digit of a BIN is the borough code.
const BOROUGH_CODE: Record<Borough, string> = {
  manhattan: "1",
  bronx: "2",
  brooklyn: "3",
  queens: "4",
  staten_island: "5",
};

const binField = z.preprocess(
  (v) => (v === null || v === undefined ? "" : v),
  z
    .string()
    .trim()
    .refine((v) => v === "" || /^[1-5]\d{6}$/.test(v), {
      error: "BIN must be 7 digits starting with 1–5 (the borough code).",
    })
    .transform((v) => (v === "" ? null : v)),
);

// Comma- or line-separated list → unique, trimmed items.
const materialsField = z.preprocess(
  (v) => (typeof v === "string" ? v : ""),
  z
    .string()
    .transform((v) => [...new Set(v.split(/[,\n]/).map((s) => s.trim()).filter(Boolean))])
    .refine((list) => list.length <= 30, { error: "List up to 30 materials." })
    .refine((list) => list.every((m) => m.length <= 100), { error: "Each material must be 100 characters or fewer." }),
);

export const buildingSchema = z.object({
  address: requiredText("the address", 300),
  borough: z.enum(BOROUGHS, { error: "Choose a borough." }),
  block: optionalInt("block", 1, 99999),
  lot: optionalInt("lot", 1, 9999),
  bin: binField,
  cross_street: optionalText("cross street", 200),
  is_landmark: yesNoUnknown,
  stories: optionalInt("stories", 1, 300),
  height_ft: optionalNumber("height", 1, 2999),
  year_built: optionalInt("year built", 1600, 2100),
  co_number: optionalText("C of O number", 50),
  use: optionalText("use", 200),
  materials: materialsField,
  materials_notes: optionalText("material notes", 2000),
  is_cavity_wall: yesNoUnknown,
  owner_name: optionalText("owner name", 200),
  owner_address: optionalText("owner mailing address", 500),
  owner_phone: optionalText("owner phone", 50),
  owner_principal_name: optionalText("principal's name", 200),
  owner_principal_title: optionalText("principal's title", 200),
});

export type BuildingInput = z.infer<typeof buildingSchema>;

// Not a blocker: shown so a typo in the BIN or borough gets caught early.
export function binBoroughWarning(bin: string | null, borough: Borough): string | null {
  if (!bin || bin.startsWith(BOROUGH_CODE[borough])) return null;
  return `BIN ${bin} starts with ${bin[0]}, but ${BOROUGH_LABEL[borough]} BINs start with ${BOROUGH_CODE[borough]}. Check the BIN and borough.`;
}

export function buildingFromForm(formData: FormData) {
  return buildingSchema.safeParse(formFields(buildingSchema, formData));
}
