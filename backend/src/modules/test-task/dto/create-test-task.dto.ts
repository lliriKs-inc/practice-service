import { z } from "zod";

export const CreateTestTaskSchema = z.object({
  title: z.string().trim().min(1, "Название задания обязательно"),
  description: z.string().trim().nullable().optional(),
});

export type CreateTestTaskDto = z.infer<typeof CreateTestTaskSchema>;
