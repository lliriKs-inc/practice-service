import { z } from "zod";

export const activeApplicationSchema = z.object({
  application_id: z.string().cuid(),
});

export type ActiveApplicationDto = z.infer<typeof activeApplicationSchema>;
