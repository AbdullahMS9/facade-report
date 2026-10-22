import { z } from "zod";
import { isIsoDate } from "@/lib/rules";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address." }));

export const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, { error: "Enter the 6-digit code from the email." });

export const firmNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Enter your firm's name." })
  .max(200, { error: "Firm name must be 200 characters or fewer." });

export const roleSchema = z.enum(["qewi", "staff"], { error: "Choose a role." });

export const tokenSchema = z.uuid({ error: "This invitation link is not valid." });

// Only same-site paths, so a crafted ?next= can't send people elsewhere.
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}

// Reads each field of an object schema from a submitted form.
export function formFields<T extends z.ZodObject>(schema: T, formData: FormData) {
  return Object.fromEntries(Object.keys(schema.shape).map((k) => [k, formData.get(k)]));
}

// First error message from a failed parse.
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

// State returned by simple form actions.
export type FormState = { error?: string; ok?: boolean; warning?: string };

// ---------------------------------------------------------------------------
// Form field helpers. FormData gives strings (or null when a field is absent);
// these turn blanks into null and give plain-English errors.
// ---------------------------------------------------------------------------

const blankToEmpty = (v: unknown) => (v === null || v === undefined ? "" : v);

export function requiredText(label: string, max: number) {
  return z.preprocess(
    blankToEmpty,
    z
      .string()
      .trim()
      .min(1, { error: `Enter ${label}.` })
      .max(max, { error: `${capitalize(label)} must be ${max} characters or fewer.` }),
  );
}

export function optionalText(label: string, max: number) {
  return z.preprocess(
    blankToEmpty,
    z
      .string()
      .trim()
      .max(max, { error: `${capitalize(label)} must be ${max} characters or fewer.` })
      .transform((v) => (v === "" ? null : v)),
  );
}

// Whole number, blank → null.
export function optionalInt(label: string, min: number, max: number) {
  return z.preprocess(
    blankToEmpty,
    z
      .string()
      .trim()
      .refine((v) => v === "" || /^\d+$/.test(v), { error: `${capitalize(label)} must be a whole number.` })
      .transform((v) => (v === "" ? null : Number(v)))
      .refine((v) => v === null || (v >= min && v <= max), {
        error: `${capitalize(label)} must be between ${min} and ${max}.`,
      }),
  );
}

// Decimal number, blank → null.
export function optionalNumber(label: string, min: number, max: number) {
  return z.preprocess(
    blankToEmpty,
    z
      .string()
      .trim()
      .refine((v) => v === "" || /^\d+(\.\d+)?$/.test(v), { error: `${capitalize(label)} must be a number.` })
      .transform((v) => (v === "" ? null : Number(v)))
      .refine((v) => v === null || (v >= min && v <= max), {
        error: `${capitalize(label)} must be between ${min} and ${max}.`,
      }),
  );
}

// <input type="date"> value (YYYY-MM-DD), blank → null.
export function optionalDate(label: string) {
  return z.preprocess(
    blankToEmpty,
    z
      .string()
      .trim()
      .refine((v) => v === "" || isIsoDate(v), { error: `Enter a valid date for ${label}.` })
      .transform((v) => (v === "" ? null : v)),
  );
}

export function requiredDate(label: string) {
  return z.preprocess(
    blankToEmpty,
    z.string().trim().refine((v) => isIsoDate(v), { error: `Enter a valid date for ${label}.` }),
  );
}

// Checkbox: present → true.
export const checkbox = z.preprocess((v) => v === "on" || v === "true", z.boolean());

// Yes / No / not answered select → true / false / null.
export const yesNoUnknown = z.preprocess(
  blankToEmpty,
  z.enum(["", "yes", "no"]).transform((v) => (v === "" ? null : v === "yes")),
);

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
