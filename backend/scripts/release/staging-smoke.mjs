import { readFile } from "node:fs/promises";
import { extname } from "node:path";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const baseUrl = required("STAGING_BASE_URL").replace(/\/$/, "");
const cohortId = encodeURIComponent(required("STAGING_COHORT_ID"));
const applicationId = encodeURIComponent(required("STAGING_APPLICATION_ID"));
const adminToken = required("STAGING_ADMIN_BEARER_TOKEN");
const studentToken = required("STAGING_STUDENT_BEARER_TOKEN");
const allowMutations = process.env.STAGING_ALLOW_MUTATIONS === "true";
const timeoutMilliseconds = Number(process.env.STAGING_REQUEST_TIMEOUT_MS ?? 10000);
if (!Number.isFinite(timeoutMilliseconds) || timeoutMilliseconds <= 0) {
  throw new Error("STAGING_REQUEST_TIMEOUT_MS must be a positive number");
}
const results = [];

async function check(name, path, token, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    signal: AbortSignal.timeout(timeoutMilliseconds),
  });
  const body = await response.arrayBuffer();
  if (!response.ok) {
    throw new Error(`${name} returned HTTP ${response.status}`);
  }
  results.push({ name, status: response.status, bytes: body.byteLength });
}

await check("cohort progress", `/api/v1/cohorts/${cohortId}/progress`, adminToken);
await check(
  "missed progress",
  `/api/v1/cohorts/${cohortId}/progress/missed`,
  adminToken,
);
await check(
  "admin overview",
  `/api/v1/cohorts/${cohortId}/admin/overview`,
  adminToken,
);
await check(
  "admin documents",
  `/api/v1/cohorts/${cohortId}/admin/documents`,
  adminToken,
);
await check(
  "student weekly tasks",
  `/api/v1/me/applications/${applicationId}/tasks`,
  studentToken,
);
await check(
  "document readiness",
  `/api/v1/me/applications/${applicationId}/documents/readiness`,
  studentToken,
);
await check(
  "report metadata",
  `/api/v1/me/applications/${applicationId}/report`,
  studentToken,
);

const reportFile = process.env.STAGING_REPORT_FILE?.trim();
const documentTypes = (process.env.STAGING_GENERATE_DOCUMENTS ?? "")
  .split(",")
  .map((type) => type.trim())
  .filter(Boolean);

if ((reportFile || documentTypes.length > 0) && !allowMutations) {
  throw new Error(
    "Set STAGING_ALLOW_MUTATIONS=true to upload a report or generate documents",
  );
}

if (reportFile) {
  const mimeTypes = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  const extension = extname(reportFile).toLowerCase();
  const mimeType = mimeTypes[extension];
  if (!mimeType) throw new Error("STAGING_REPORT_FILE must be PDF, DOC or DOCX");
  const form = new FormData();
  form.set(
    "report",
    new Blob([await readFile(reportFile)], { type: mimeType }),
    `report${extension}`,
  );
  await check(
    "report upload",
    `/api/v1/me/applications/${applicationId}/report`,
    studentToken,
    { method: "PUT", body: form },
  );
}

for (const type of documentTypes) {
  if (!/^(INDIVIDUAL_TASK|TITLE_PAGE|REVIEW|NOTICE)$/.test(type)) {
    throw new Error(`Unsupported document type '${type}'`);
  }
  await check(
    `generate ${type}`,
    `/api/v1/me/applications/${applicationId}/documents/${type}/generate`,
    studentToken,
    { method: "POST" },
  );
}

console.log(JSON.stringify({ baseUrl, checks: results }, null, 2));
