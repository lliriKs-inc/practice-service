import { z } from "zod";

export const updateDocumentFieldSchema = z
  .object({
    value: z
      .string()
      .trim()
      .max(10_000),
  })
  .strict();

export type UpdateDocumentFieldDto = z.infer<
  typeof updateDocumentFieldSchema
>;
