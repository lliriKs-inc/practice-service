import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { UserRole } from "@prisma/client";
import { createApp } from "../app";
import { generateToken } from "../shared/jwt";
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

describe("B-07 executable HTTP contract examples", () => {
  const app = createApp({ readinessCheck: async () => undefined });
  const adminToken = generateToken({ id: "contract-admin", role: UserRole.ADMIN });
  const studentToken = generateToken({ id: "contract-student", role: UserRole.STUDENT });

  function expectErrorContract(response: request.Response, status: number, code: string) {
    expect(response.status).toBe(status);
    expect(response.body).toMatchObject({
      code,
      message: expect.any(String),
      requestId: expect.any(String),
    });
    expect(response.body).toHaveProperty("details");
  }

  it("returns the documented validation envelope for an invalid public request", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .set("X-Request-Id", "contract-validation")
      .send({ email: "not-an-email" });

    expectErrorContract(response, 400, "VALIDATION_ERROR");
    expect(response.body.requestId).toBe("contract-validation");
  });

  it("enforces the documented authentication and RBAC boundary", async () => {
    const unauthenticated = await request(app).get("/api/v1/me");
    expectErrorContract(unauthenticated, 401, "AUTH_TOKEN_MISSING");

    const forbidden = await request(app)
      .get("/api/v1/cohorts/cohort-1/admin/overview")
      .set("Authorization", `Bearer ${studentToken}`);
    expectErrorContract(forbidden, 403, "INSUFFICIENT_PERMISSIONS");
  });

  it("validates cohort context and upload media type before domain access", async () => {
    const missingContext = await request(app)
      .get("/api/v1/tracks")
      .set("Authorization", `Bearer ${adminToken}`);
    expectErrorContract(missingContext, 400, "COHORT_CONTEXT_MISSING");

    const invalidUpload = await request(app)
      .put("/api/v1/me/applications/application-1/report")
      .set("Authorization", `Bearer ${studentToken}`)
      .attach("report", Buffer.from("plain text"), {
        filename: "report.txt",
        contentType: "text/plain",
      });
    expectErrorContract(invalidUpload, 400, "UPLOAD_FILE_TYPE_NOT_ALLOWED");
  });

  it("rejects malformed JSON and removed legacy mount paths consistently", async () => {
    const malformedJson = await request(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":');
    expectErrorContract(malformedJson, 400, "INVALID_JSON");

    const legacyPath = await request(app)
      .get("/api/v1/admin/cohorts/cohort-1/admin/overview")
      .set("Authorization", `Bearer ${adminToken}`);
    expectErrorContract(legacyPath, 404, "ROUTE_NOT_FOUND");
  });
});
