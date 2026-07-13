import { z } from "zod";

export const applicationAnswerSchema = z.object({
  question_id: z.string().trim().min(1),
  answer_value: z.string(),
});

export const createApplicationSchema = z.object({
  track_id: z.string().trim().min(1),
  answers: z.array(applicationAnswerSchema),
});

export const updateApplicationStatusSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  rejection_reason: z.string().trim().min(1).optional(),
}).superRefine((value, ctx) => {
  if (value.status === "REJECTED" && !value.rejection_reason) {
    ctx.addIssue({ code: "custom", path: ["rejection_reason"], message: "Rejection reason is required" });
  }
});

export type CreateApplicationDto = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationStatusDto = z.infer<typeof updateApplicationStatusSchema>;
