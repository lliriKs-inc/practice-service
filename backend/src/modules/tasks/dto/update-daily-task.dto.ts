import { z } from "zod";

export const updateDailyTaskSchema = z
  .object({
    description: z
      .string()
      .trim()
      .max(10_000, "Description is too long")
      .nullable(),

    links: z
      .array(
        z.object({
          url: z.string().trim().url("Invalid URL").max(2_048),
        })
      )
      .max(50)
      .refine(
        (links) => new Set(links.map((link) => link.url)).size === links.length,
        {
          message: "Duplicate links are not allowed",
          path: ["links"],
        }
      ),
  })
  .strict();

export type UpdateDailyTaskDto = z.infer<
  typeof updateDailyTaskSchema
>;
