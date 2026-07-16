import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoots = [
  path.resolve(__dirname, "shared"),
  path.resolve(__dirname, "modules/documents"),
  path.resolve(__dirname, "modules/tasks"),
  path.resolve(__dirname, "modules/admin"),
];

const removedReferences = [
  "CohortRole",
  "SurveyField",
  "StudentDocumentData",
  "TaskCard",
  "Application.cohort_id",
  "Application.role_id",
  "Application.review_comment",
];

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    if (
      entry.isFile() &&
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".test.ts")
    ) {
      return [entryPath];
    }
    return [];
  }));
  return nested.flat();
}

describe("B-08 B-zone legacy cleanup guard", () => {
  it("does not retain removed architecture references in runtime source", async () => {
    const files = (await Promise.all(sourceRoots.map(sourceFiles))).flat();
    const sources = await Promise.all(files.map(async (file) => ({
      file,
      content: await readFile(file, "utf8"),
    })));

    for (const reference of removedReferences) {
      const offenders = sources
        .filter(({ content }) => content.includes(reference))
        .map(({ file }) => path.relative(process.cwd(), file));
      expect(offenders, `${reference} found in ${offenders.join(", ")}`)
        .toEqual([]);
    }
  });
});
