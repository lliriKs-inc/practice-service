import { z } from "zod";

export const createTrackSchema = z.object({
  cohort_id: z.string().trim().min(1),
  title: z.string().trim().min(1),
});

export type CreateTrackDto = z.infer<typeof createTrackSchema>;

export const updateTrackSchema = z.object({
  title: z.string().trim().min(1),
});

export type UpdateTrackDto = z.infer<typeof updateTrackSchema>;
