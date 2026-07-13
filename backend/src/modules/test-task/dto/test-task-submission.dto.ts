import { z } from "zod";

export const TestTaskSubmissionParamsSchema = z.object({
  applicationId: z.string().trim().min(1),
});

export type TestTaskSubmissionParams = z.infer<
  typeof TestTaskSubmissionParamsSchema
>;
