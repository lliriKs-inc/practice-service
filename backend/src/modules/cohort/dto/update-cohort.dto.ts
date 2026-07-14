import { z } from "zod";

export const updateCohortSchema = z.object({
  title: z.string().trim().min(1).optional(),
  application_start: z.coerce.date().optional().nullable(),
  application_end: z.coerce.date().optional().nullable(),
  practice_start: z.coerce.date().optional(),
  practice_end: z.coerce.date().optional(),
}).refine(
  (data) => !data.practice_start || !data.practice_end || data.practice_start <= data.practice_end,
  { path: ["practice_end"], message: "practice_end must be after practice_start" },
).refine(
  (data) => !data.application_start || !data.application_end || data.application_start <= data.application_end,
  { path: ["application_end"], message: "application_end must be after application_start" },
);

export type UpdateCohortDto = z.infer<typeof updateCohortSchema>;
