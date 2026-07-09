import { z } from "zod";

export const TaskParamsSchema = z
  .object({
    id: z.string().min(1, "Task id is required"),
  })
  .strict();

export const WeekQuerySchema = z
  .object({
    weekStart: z.string().min(1, "weekStart is required"),
  })
  .strict();

export type TaskParamsDto = z.infer<typeof TaskParamsSchema>;
export type WeekQueryDto = z.infer<typeof WeekQuerySchema>;