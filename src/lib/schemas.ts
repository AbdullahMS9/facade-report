import { z } from "zod";

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

// First error message from a failed parse.
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

// State returned by simple form actions.
export type FormState = { error?: string };
