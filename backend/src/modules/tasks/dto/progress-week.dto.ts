import { z } from "zod";

export const progressWeekQuerySchema = z
  .object({
    weekStart: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "weekStart must be YYYY-MM-DD"),
  })
  .strict();

export type ProgressWeekQueryDto = z.infer<
  typeof progressWeekQuerySchema
>;
