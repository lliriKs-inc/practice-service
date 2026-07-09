import { z } from "zod";

export const UpdateTaskSchema = z
  .object({
    date: z.string().min(1, "date is required").optional(),
    title: z.string().trim().min(1, "title is required").optional(),
    description: z.string().trim().min(1, "description is required").optional(),
    artifact_link: z.string().trim().optional().nullable(),
  })
  .strict();

export type UpdateTaskDto = z.infer<typeof UpdateTaskSchema>;