import { z } from "zod";

export const MIN_COHORT_YEAR = 2000;
export const MAX_COHORT_YEAR = 2100;

export const cohortDateSchema = z.coerce.date().refine(
  (date) => {
    const year = date.getUTCFullYear();
    return year >= MIN_COHORT_YEAR && year <= MAX_COHORT_YEAR;
  },
  `Date must be between years ${MIN_COHORT_YEAR} and ${MAX_COHORT_YEAR}`,
);

export const createCohortSchema = z.object({
  title: z.string().trim().min(1),
  status: z.enum(["DRAFT", "ACTIVE", "CLOSED"]).optional(),
  application_start: cohortDateSchema.optional(),
  application_end: cohortDateSchema.optional(),
  practice_start: cohortDateSchema,
  practice_end: cohortDateSchema,
}).superRefine((data, ctx) => {
  if (data.practice_start > data.practice_end) ctx.addIssue({ code: "custom", path: ["practice_end"], message: "practice_end must be after practice_start" });
  if (data.application_start && data.application_end && data.application_start > data.application_end) ctx.addIssue({ code: "custom", path: ["application_end"], message: "application_end must be after application_start" });
  if (data.application_end && data.application_end > data.practice_start) ctx.addIssue({ code: "custom", path: ["application_end"], message: "Application window must end before practice starts" });
});

export type CreateCohortDto = z.infer<typeof createCohortSchema>;
