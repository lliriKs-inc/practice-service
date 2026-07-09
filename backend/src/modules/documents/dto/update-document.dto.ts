import { z } from "zod";

export const UpdateDocumentSchema = z
  .object({
    student_fio: z.string().trim().optional(),
    group: z.string().trim().optional(),
    direction_code: z.string().trim().optional(),
    direction_name: z.string().trim().optional(),
    program_name: z.string().trim().optional(),
    specialty: z.string().trim().optional(),
    practice_topic: z.string().trim().optional(),
    main_stage_tasks: z.string().trim().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one document field is required",
  });

export type UpdateDocumentDto = z.infer<typeof UpdateDocumentSchema>;