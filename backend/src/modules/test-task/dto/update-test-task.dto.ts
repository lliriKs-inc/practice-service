import { z } from "zod";

export const UpdateTestTaskSchema = z
  .object({
    title: z.string().trim().min(1, "Название задания обязательно").optional(),
    description: z.string().trim().nullable().optional(),
    published_at: z.null().optional(),
  })
  .refine((value) => value.title !== undefined || value.description !== undefined || value.published_at !== undefined, {
    message: "Необходимо передать хотя бы одно поле",
  });

export type UpdateTestTaskDto = z.infer<typeof UpdateTestTaskSchema>;
