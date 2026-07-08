import { z } from "zod";

export const CreateTestTaskSchema = z.object({
  content: z.string().min(1, "Содержимое задания обязательно"),
  published_at: z.coerce.date().optional()
});

export type CreateTestTaskDto = z.infer<typeof CreateTestTaskSchema>;