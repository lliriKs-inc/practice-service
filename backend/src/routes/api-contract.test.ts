import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listRegisteredApiRoutes } from "./api-v1.registry";

const docsDirectory = path.resolve(__dirname, "../../../docs");
const contractPath = path.join(docsDirectory, "api-contract.md");
const checklistPath = path.join(docsDirectory, "e2e-api-checklist.md");
const readmePath = path.resolve(__dirname, "../../../README.md");

const contract = readFileSync(contractPath, "utf8");
const checklist = readFileSync(checklistPath, "utf8");
const readme = readFileSync(readmePath, "utf8");

function inventorySection() {
  const start = "<!-- ROUTE_INVENTORY_START -->";
  const end = "<!-- ROUTE_INVENTORY_END -->";
  const startIndex = contract.indexOf(start);
  const endIndex = contract.indexOf(end);

  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);

  return contract.slice(startIndex + start.length, endIndex);
}

function documentedRoutes() {
  const routePattern =
    /^\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`(\/api\/v1[^`]*)`\s*\|/gm;

  return [...inventorySection().matchAll(routePattern)].map(
    ([, method, routePath]) => `${method} ${routePath}`
  );
}

describe("B-07 central API contract", () => {
  it("documents every production registry route exactly once", () => {
    const actual = listRegisteredApiRoutes()
      .map(({ method, path: routePath }) => `${method} ${routePath}`)
      .sort();
    const documented = documentedRoutes().sort();

    expect(new Set(documented).size).toBe(documented.length);
    expect(documented).toEqual(actual);
  });

  it("contains only valid JSON examples", () => {
    const examples = [...contract.matchAll(/```json\s*([\s\S]*?)```/g)];

    expect(examples.length).toBeGreaterThan(10);
    for (const [, example] of examples) {
      expect(() => JSON.parse(example.trim())).not.toThrow();
    }
  });

  it("does not expose removed architecture terms in the central contract", () => {
    const removedTerms = [
      "CohortRole",
      "SurveyField",
      "TaskCard",
      "StudentDocumentData",
    ];

    for (const term of removedTerms) {
      expect(contract).not.toContain(term);
    }
  });

  it("links README to the contract and checklist", () => {
    expect(readme).toContain("docs/api-contract.md");
    expect(readme).toContain("docs/e2e-api-checklist.md");
  });

  it("maps the checklist to production and contract test suites", () => {
    expect(checklist).toContain("/api/v1");
    expect(checklist).toContain("b06-production-flow.integration.test.ts");
    expect(checklist).toContain("api-contract.test.ts");
    expect(checklist).toContain("RUN_DB_INTEGRATION=true");
  });
});
