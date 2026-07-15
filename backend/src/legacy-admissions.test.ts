import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const modulesDirectory = path.resolve(__dirname, "modules");
const admissionsModules = [
  "application",
  "cohort",
  "invitation",
  "survey",
  "test-task",
  "track",
];
const removedPrismaDelegates = [
  "prisma.cohortRole",
  "prisma.surveyField",
];

describe("A-08 admissions legacy cleanup", () => {
  it("does not retain the cohort-role module", () => {
    expect(
      existsSync(path.join(modulesDirectory, "cohort-role")),
    ).toBe(false);
  });

  it("does not use removed Prisma delegates in admissions modules", async () => {
    const sources = await Promise.all(
      admissionsModules.map((moduleName) =>
        readFile(
          path.join(modulesDirectory, moduleName, `${moduleName}.service.ts`),
          "utf8",
        ),
      ),
    );

    for (const delegate of removedPrismaDelegates) {
      expect(sources.join("\n")).not.toContain(delegate);
    }
  });
});
