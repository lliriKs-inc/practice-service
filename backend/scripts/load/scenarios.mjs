function required(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required for this load scenario`);
  return value;
}

function id(value) {
  return encodeURIComponent(value);
}

function bearer(env, role) {
  return required(
    env,
    role === "admin" ? "LOAD_ADMIN_BEARER_TOKEN" : "LOAD_STUDENT_BEARER_TOKEN",
  );
}

export function createLoadRequests(env = process.env) {
  if (env.LOAD_PATHS?.trim()) {
    const token = env.LOAD_BEARER_TOKEN?.trim();
    return env.LOAD_PATHS.split(",")
      .map((path) => path.trim())
      .filter(Boolean)
      .map((path) => ({ name: path, path, token }));
  }

  const scenario = env.LOAD_SCENARIO?.trim() || "operational";
  if (scenario === "operational") {
    return [
      { name: "health", path: "/health" },
      { name: "readiness", path: "/ready" },
    ];
  }

  if (scenario === "admin-reads") {
    const cohortId = id(required(env, "LOAD_COHORT_ID"));
    const token = bearer(env, "admin");
    return [
      { name: "cohort progress", path: `/api/v1/cohorts/${cohortId}/progress`, token },
      { name: "missed progress", path: `/api/v1/cohorts/${cohortId}/progress/missed`, token },
      { name: "admin overview", path: `/api/v1/cohorts/${cohortId}/admin/overview`, token },
      { name: "admin documents", path: `/api/v1/cohorts/${cohortId}/admin/documents`, token },
    ];
  }

  if (scenario === "student-reads") {
    const applicationId = id(required(env, "LOAD_APPLICATION_ID"));
    const token = bearer(env, "student");
    const weekStart = env.LOAD_WEEK_START?.trim();
    const tasksQuery = weekStart ? `?weekStart=${encodeURIComponent(weekStart)}` : "";
    return [
      {
        name: "weekly tasks",
        path: `/api/v1/me/applications/${applicationId}/tasks${tasksQuery}`,
        token,
      },
      {
        name: "document readiness",
        path: `/api/v1/me/applications/${applicationId}/documents/readiness`,
        token,
      },
      {
        name: "documents",
        path: `/api/v1/me/applications/${applicationId}/documents`,
        token,
      },
      {
        name: "report metadata",
        path: `/api/v1/me/applications/${applicationId}/report`,
        token,
      },
    ];
  }

  throw new Error(
    `Unknown LOAD_SCENARIO '${scenario}'. Use operational, admin-reads or student-reads`,
  );
}
