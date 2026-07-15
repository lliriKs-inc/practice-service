import { performance } from "node:perf_hooks";

function positiveNumber(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return value;
}

const baseUrl = (process.env.LOAD_BASE_URL ?? "http://localhost:3001")
  .replace(/\/$/, "");
const paths = (process.env.LOAD_PATHS ?? "/health,/ready")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const concurrency = positiveNumber("LOAD_CONCURRENCY", 10);
const durationMilliseconds = positiveNumber("LOAD_DURATION_SECONDS", 10) * 1000;
const maximumRequests = positiveNumber("LOAD_MAX_REQUESTS", 2000);
const timeoutMilliseconds = positiveNumber("LOAD_REQUEST_TIMEOUT_MS", 5000);
const maximumP95Milliseconds = positiveNumber("LOAD_MAX_P95_MS", 750);
const maximumErrorRate = Number(process.env.LOAD_MAX_ERROR_RATE ?? 0.01);
const token = process.env.LOAD_BEARER_TOKEN;

if (paths.length === 0) {
  throw new Error("LOAD_PATHS must contain at least one path");
}
if (maximumErrorRate < 0 || maximumErrorRate > 1) {
  throw new Error("LOAD_MAX_ERROR_RATE must be between 0 and 1");
}

const durations = [];
const statuses = new Map();
const errors = [];
let issuedRequests = 0;
const deadline = performance.now() + durationMilliseconds;

async function worker(workerId) {
  while (performance.now() < deadline && issuedRequests < maximumRequests) {
    const requestNumber = issuedRequests;
    issuedRequests += 1;
    const path = paths[(requestNumber + workerId) % paths.length];
    const startedAt = performance.now();

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        signal: AbortSignal.timeout(timeoutMilliseconds),
      });
      durations.push(performance.now() - startedAt);
      statuses.set(response.status, (statuses.get(response.status) ?? 0) + 1);
      await response.arrayBuffer();
      if (!response.ok) {
        errors.push(`${path}: HTTP ${response.status}`);
      }
    } catch (error) {
      durations.push(performance.now() - startedAt);
      errors.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

await Promise.all(
  Array.from({ length: concurrency }, (_, index) => worker(index)),
);

durations.sort((left, right) => left - right);
const percentile = (value) => {
  if (durations.length === 0) return 0;
  const index = Math.min(
    durations.length - 1,
    Math.ceil((value / 100) * durations.length) - 1,
  );
  return durations[index];
};
const errorRate = durations.length === 0 ? 1 : errors.length / durations.length;
const summary = {
  baseUrl,
  paths,
  concurrency,
  requests: durations.length,
  statuses: Object.fromEntries(statuses),
  latencyMilliseconds: {
    p50: Number(percentile(50).toFixed(2)),
    p95: Number(percentile(95).toFixed(2)),
    p99: Number(percentile(99).toFixed(2)),
  },
  errors: errors.length,
  errorRate: Number(errorRate.toFixed(4)),
  thresholds: {
    maximumP95Milliseconds,
    maximumErrorRate,
  },
};

console.log(JSON.stringify(summary, null, 2));

if (
  durations.length === 0 ||
  percentile(95) > maximumP95Milliseconds ||
  errorRate > maximumErrorRate
) {
  console.error("Load smoke thresholds were not met");
  process.exit(1);
}
