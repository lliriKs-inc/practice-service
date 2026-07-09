import { z } from "zod";

export const CreateTaskSchema = z
  .object({
    date: z.string().min(1, "date is required"),
    title: z.string().trim().min(1, "title is required"),
    description: z.string().trim().min(1, "description is required"),
    artifact_link: z.string().trim().optional().nullable(),
  })
  .strict();

export type CreateTaskDto = z.infer<typeof CreateTaskSchema>;