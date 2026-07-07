import { z } from "zod";

export const UpdateTestTaskSchema = z.object({
  content: z.string().min(1, "Содержимое задания не может быть пустым"),
});

export type UpdateTestTaskDto = z.infer<typeof UpdateTestTaskSchema>;