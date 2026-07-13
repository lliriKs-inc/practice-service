import { z } from "zod";

export const createCohortSchema = z.object({
  title: z.string().trim().min(1),
  status: z.enum(["DRAFT", "ACTIVE", "CLOSED"]).optional(),
  application_start: z.coerce.date().optional(),
  application_end: z.coerce.date().optional(),
  practice_start: z.coerce.date(),
  practice_end: z.coerce.date(),
}).superRefine((data, ctx) => {
  if (data.practice_start > data.practice_end) ctx.addIssue({ code: "custom", path: ["practice_end"], message: "practice_end must be after practice_start" });
  if (data.application_start && data.application_end && data.application_start > data.application_end) ctx.addIssue({ code: "custom", path: ["application_end"], message: "application_end must be after application_start" });
  if (data.application_end && data.application_end > data.practice_start) ctx.addIssue({ code: "custom", path: ["application_end"], message: "Application window must end before practice starts" });
});

export type CreateCohortDto = z.infer<typeof createCohortSchema>;
