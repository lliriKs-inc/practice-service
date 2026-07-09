import { z } from "zod";

export const UpdateReviewSchema = z
  .object({
    review_activities: z.string().trim().optional(),
    review_characteristic: z.string().trim().optional(),
    review_employed: z.string().trim().optional(),
    review_next_practice: z.string().trim().optional(),
    review_employment_offer: z.string().trim().optional(),
    review_suggestions: z.string().trim().optional(),
    review_grade: z.string().trim().optional(),
  })
  .strict();

export const UpdateReviewRequestSchema = UpdateReviewSchema.extend({
  userId: z.string().min(1, "userId is required"),
}).strict();

export const ApproveReportSchema = z
  .object({
    userId: z.string().min(1, "userId is required"),
  })
  .strict();

export type UpdateReviewDto = z.infer<typeof UpdateReviewSchema>;