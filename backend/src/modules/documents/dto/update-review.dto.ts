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
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one review field is required",
  });

export const UpdateReviewRequestSchema = z
  .object({
    userId: z.string().min(1, "userId is required"),
    review_activities: z.string().trim().optional(),
    review_characteristic: z.string().trim().optional(),
    review_employed: z.string().trim().optional(),
    review_next_practice: z.string().trim().optional(),
    review_employment_offer: z.string().trim().optional(),
    review_suggestions: z.string().trim().optional(),
    review_grade: z.string().trim().optional(),
  })
  .strict()
  .refine((data) => {
    const { userId, ...reviewFields } = data;
    return Object.keys(reviewFields).length > 0;
  }, {
    message: "At least one review field is required",
  });

export const ApproveReportSchema = z
  .object({
    userId: z.string().min(1, "userId is required"),
  })
  .strict();

export type UpdateReviewDto = z.infer<typeof UpdateReviewSchema>;