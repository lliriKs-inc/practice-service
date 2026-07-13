import { z } from "zod";

export const createTrackSchema = z.object({
  cohort_id: z.string().trim().min(1),
  title: z.string().trim().min(1),
});

export type CreateTrackDto = z.infer<typeof createTrackSchema>;
