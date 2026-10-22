import { z } from "zod";
import { compareDates } from "@/lib/rules";
import { optionalDate, optionalInt } from ".";

export const REPORT_TYPES = ["initial", "subsequent", "amended"] as const;
export const REPORT_TYPE_LABEL = { initial: "Initial", subsequent: "Subsequent", amended: "Amended" } as const;
export const PROJECT_STATUSES = ["draft", "ready", "filed"] as const;
export const STATUS_LABEL = { draft: "Draft", ready: "Ready to file", filed: "Filed" } as const;

const cycleField = optionalInt("cycle", 1, 99).refine((v) => v !== null, { error: "Enter the cycle number." });

export const newProjectSchema = z.object({
  cycle: cycleField,
  report_type: z.enum(REPORT_TYPES, { error: "Choose a report type." }),
});

const qewiField = z.preprocess(
  (v) => (v === null || v === undefined || v === "" ? null : v),
  z.uuid({ error: "Choose a QEWI from the list." }).nullable(),
);

export const projectDetailsSchema = z
  .object({
    cycle: cycleField,
    report_type: z.enum(REPORT_TYPES, { error: "Choose a report type." }),
    qewi_id: qewiField,
    exam_start: optionalDate("exam start"),
    exam_end: optionalDate("exam end"),
    final_visual_date: optionalDate("final inspection"),
    closeup_complete_date: optionalDate("close-up completion"),
    unsafe_notified_on: optionalDate("UNSAFE notification"),
  })
  .refine((p) => !p.exam_start || !p.exam_end || compareDates(p.exam_end, p.exam_start) >= 0, {
    error: "Exam end date can't be before the start date.",
    path: ["exam_end"],
  });

export const statusSchema = z.enum(PROJECT_STATUSES, { error: "Choose a status." });
