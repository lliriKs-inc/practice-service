import { z } from "zod";

export const missedProgressQuerySchema = z
  .object({
    weekStart: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "weekStart must be YYYY-MM-DD"),

    studentId: z.string().min(1).optional(),
  })
  .strict();

export type MissedProgressQueryDto = z.infer<
  typeof missedProgressQuerySchema
>;
