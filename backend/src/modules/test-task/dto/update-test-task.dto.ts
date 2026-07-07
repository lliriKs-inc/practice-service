import { z } from "zod";
import { CreateTestTaskSchema } from "./create-test-task.dto";

export const UpdateTestTaskSchema = CreateTestTaskSchema.partial();

export type UpdateTestTaskDto = z.infer<typeof UpdateTestTaskSchema>;