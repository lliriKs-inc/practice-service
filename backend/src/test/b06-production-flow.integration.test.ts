import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../shared/prisma";
import {
  cleanupAdmissionsFixture,
  createAdmissionsFixture,
  type AdmissionsFixture,
} from "./admissions-fixtures";

const integrationEnabled = process.env.RUN_DB_INTEGRATION === "true";
const describeIntegration = integrationEnabled ? describe : describe.skip;
const API = "/api/v1";

function tokenFromSessionCookie(setCookie: string[] | undefined) {
  const cookie = setCookie?.find((value) => value.startsWith("practice_session="));
  expect(cookie).toEqual(expect.stringContaining("HttpOnly"));
  return decodeURIComponent(cookie!.split(";", 1)[0].slice("practice_session=".length));
}

function mondayOf(date: Date) {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = result.getUTCDay();
  result.setUTCDate(result.getUTCDate() - (day === 0 ? 6 : day - 1));
  return result.toISOString().slice(0, 10);
}

describeIntegration("B-06 production API candidate and practice flow", () => {
  const app = createApp({ readinessCheck: async () => undefined });
  let fixture: AdmissionsFixture;
  let studentId = "";
  let studentToken = "";
  let adminToken = "";
  let applicationId = "";
  let rejectedApplicationId = "";
  let apiSetupCohortId = "";

  beforeAll(async () => {
    fixture = await createAdmissionsFixture({ includeSecondTrack: true });
  });

  afterAll(async () => {
    if (apiSetupCohortId) {
      const tracks = await prisma.track.findMany({
        where: { cohort_id: apiSetupCohortId },
        select: { id: true },
      });
      const surveys = await prisma.survey.findMany({
        where: { cohort_id: apiSetupCohortId },
        select: { id: true },
      });
      const trackIds = tracks.map(({ id }) => id);
      const surveyIds = surveys.map(({ id }) => id);
      await prisma.testTask.deleteMany({ where: { track_id: { in: trackIds } } });
      await prisma.invitation.deleteMany({ where: { cohort_id: apiSetupCohortId } });
      await prisma.question.deleteMany({ where: { survey_id: { in: surveyIds } } });
      await prisma.survey.deleteMany({ where: { id: { in: surveyIds } } });
      await prisma.track.deleteMany({ where: { id: { in: trackIds } } });
      await prisma.cohort.deleteMany({ where: { id: apiSetupCohortId } });
    }
    if (fixture) {
      await cleanupAdmissionsFixture(fixture, studentId ? [studentId] : []);
    }
  });

  it("completes the candidate flow through the production /api/v1 router", async () => {
    const current = await request(app).get(`${API}/cohorts/public/current`);
    expect(current.status).toBe(200);
    expect(current.body.id).toEqual(expect.any(String));

    const form = await request(app).get(`${API}/public/invitations/${fixture.invitationToken}/form`);
    expect(form.status).toBe(200);
    expect(form.body.cohort.id).toBe(fixture.cohortId);

    const email = `${fixture.prefix}-b06-student@example.com`;
    const password = "B06-Student-password-123!";
    const registration = await request(app).post(`${API}/auth/register`).send({
      email,
      password,
      full_name: "B-06 Production Student",
    });
    expect(registration.status).toBe(201);
    studentId = registration.body.id;

    const studentLogin = await request(app).post(`${API}/auth/login`).send({ email, password });
    expect(studentLogin.status).toBe(200);
    studentToken = tokenFromSessionCookie(studentLogin.headers["set-cookie"]);

    const adminLogin = await request(app).post(`${API}/auth/login`).send({
      email: fixture.adminEmail,
      password: fixture.adminPassword,
    });
    expect(adminLogin.status).toBe(200);
    adminToken = tokenFromSessionCookie(adminLogin.headers["set-cookie"]);

    const submitted = await request(app)
      .post(`${API}/public/invitations/${fixture.invitationToken}/applications`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        track_id: fixture.trackId,
        answers: [{ question_id: fixture.questionId, answer_value: "Production route E2E" }],
      });
    expect(submitted.status).toBe(201);
    applicationId = submitted.body.id;

    const rejectedSubmission = await request(app)
      .post(`${API}/public/invitations/${fixture.invitationToken}/applications`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        track_id: fixture.secondTrackId!,
        answers: [{ question_id: fixture.questionId, answer_value: "Alternative track" }],
      });
    expect(rejectedSubmission.status).toBe(201);
    rejectedApplicationId = rejectedSubmission.body.id;

    const task = await request(app)
      .get(`${API}/me/applications/${applicationId}/test-task`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(task.status).toBe(200);
    expect(task.body.available).toBe(true);

    const submission = await request(app)
      .put(`${API}/me/applications/${applicationId}/test-task-submission`)
      .set("Authorization", `Bearer ${studentToken}`)
      .attach("file", Buffer.from("PK production test archive"), {
        filename: "solution.zip",
        contentType: "application/zip",
      });
    expect(submission.status).toBe(200);

    const rejected = await request(app)
      .patch(`${API}/cohorts/${fixture.cohortId}/applications/${rejectedApplicationId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "REJECTED", rejection_reason: "Another track was selected" });
    expect(rejected.status).toBe(200);
    expect(rejected.body).toMatchObject({
      id: rejectedApplicationId,
      status: "REJECTED",
      rejection_reason: "Another track was selected",
    });

    const approved = await request(app)
      .patch(`${API}/cohorts/${fixture.cohortId}/applications/${applicationId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "APPROVED" });
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe("APPROVED");
  });

  it("performs admin cohort setup through production routes", async () => {
    const now = Date.now();
    const cohort = await request(app)
      .post(`${API}/cohorts`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: `${fixture.prefix} API setup cohort`,
        status: "DRAFT",
        practice_start: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(),
        practice_end: new Date(now + 10 * 24 * 60 * 60 * 1000).toISOString(),
      });
    expect(cohort.status).toBe(201);
    apiSetupCohortId = cohort.body.id;

    const track = await request(app)
      .post(`${API}/tracks`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cohort_id: apiSetupCohortId, title: "API setup track" });
    expect(track.status).toBe(201);

    const survey = await request(app)
      .post(`${API}/surveys`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cohort_id: apiSetupCohortId, title: "API setup survey" });
    expect(survey.status).toBe(201);

    const question = await request(app)
      .post(`${API}/surveys/${survey.body.id}/questions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ label: "Motivation", type: "TEXTAREA", required: true });
    expect(question.status).toBe(201);

    const invitation = await request(app)
      .post(`${API}/invitations`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cohort_id: apiSetupCohortId, expires_in_days: 7 });
    expect(invitation.status).toBe(201);
    expect(invitation.body.token).toEqual(expect.any(String));

    const testTask = await request(app)
      .put(`${API}/cohorts/${apiSetupCohortId}/tracks/${track.body.id}/test-task`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "API setup test task", description: "Verify the setup flow" });
    expect(testTask.status).toBe(200);

    const published = await request(app)
      .post(`${API}/cohorts/${apiSetupCohortId}/tracks/${track.body.id}/test-task/publish`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(published.status).toBe(200);
    expect(published.body.available).toBe(true);
  });

  it("completes progress, report and all document workflows", async () => {
    const firstGeneratedTask = await prisma.dailyTask.findFirst({
      where: { application_id: applicationId },
      orderBy: { task_date: "asc" },
      select: { task_date: true },
    });
    expect(firstGeneratedTask).toBeDefined();

    // The practice can start on a weekend. In that case the current calendar
    // week has no practice days yet, even though approval correctly created
    // tasks for the following weekday. Request the week containing an actual
    // generated task rather than relying on the day CI happens to run.
    const weekStart = mondayOf(firstGeneratedTask!.task_date);
    const progress = await request(app)
      .get(`${API}/me/applications/${applicationId}/tasks`)
      .query({ weekStart })
      .set("Authorization", `Bearer ${studentToken}`);
    expect(progress.status).toBe(200);
    const progressDay = progress.body.days.find(
      (day: { task: { id: string } | null }) => Boolean(day.task)
    );
    expect(progressDay).toBeDefined();

    const taskId = progressDay.task.id;
    const updatedTask = await request(app)
      .put(`${API}/me/daily-tasks/${taskId}`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        description: "Implemented the B-06 production flow",
        links: [{ url: "https://example.com/b06" }],
      });
    expect(updatedTask.status).toBe(200);

    const cohortProgress = await request(app)
      .get(`${API}/cohorts/${fixture.cohortId}/progress`)
      .query({ weekStart })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(cohortProgress.status).toBe(200);
    expect(JSON.stringify(cohortProgress.body)).toContain(applicationId);
    expect(JSON.stringify(cohortProgress.body)).not.toContain(rejectedApplicationId);

    await expect(prisma.dailyTask.count({
      where: { application_id: applicationId },
    })).resolves.toBeGreaterThan(0);
    await expect(prisma.dailyTask.count({
      where: { application_id: rejectedApplicationId },
    })).resolves.toBe(0);

    const studentFields: Record<string, string[]> = {
      INDIVIDUAL_TASK: [
        "student_fio", "group", "direction_code", "direction_name",
        "program_name", "practice_topic", "main_stage_tasks",
      ],
      TITLE_PAGE: ["student_fio", "group", "specialty", "practice_topic"],
      REVIEW: ["student_fio", "group"],
      NOTICE: ["student_fio", "group", "practice_topic"],
    };
    for (const [type, fields] of Object.entries(studentFields)) {
      for (const field of fields) {
        const response = await request(app)
          .put(`${API}/me/applications/${applicationId}/documents/${type}/fields/${field}`)
          .set("Authorization", `Bearer ${studentToken}`)
          .send({ value: `${field} value` });
        expect(response.status).toBe(200);
      }
    }

    const reviewFields = [
      "review_activities", "review_characteristic", "review_employed",
      "review_next_practice", "review_employment_offer", "review_suggestions", "review_grade",
    ];
    for (const field of reviewFields) {
      const response = await request(app)
        .put(`${API}/cohorts/${fixture.cohortId}/admin/applications/${applicationId}/documents/REVIEW/fields/${field}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ value: `${field} value` });
      expect(response.status).toBe(200);
    }

    const report = await request(app)
      .put(`${API}/me/applications/${applicationId}/report`)
      .set("Authorization", `Bearer ${studentToken}`)
      .attach("report", Buffer.from("%PDF-1.4 B-06 report"), {
        filename: "report.pdf",
        contentType: "application/pdf",
      });
    expect(report.status).toBe(200);
    expect(report.body).not.toHaveProperty("file_url");

    const reviewed = await request(app)
      .patch(`${API}/cohorts/${fixture.cohortId}/applications/${applicationId}/report/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "APPROVED" });
    expect(reviewed.status).toBe(200);

    for (const type of ["INDIVIDUAL_TASK", "REVIEW", "TITLE_PAGE", "NOTICE"]) {
      const generated = await request(app)
        .post(`${API}/me/applications/${applicationId}/documents/${type}/generate`)
        .set("Authorization", `Bearer ${studentToken}`);
      expect(generated.status).toBe(200);
      expect(generated.headers["content-type"]).toContain("application/vnd.openxmlformats");
    }

    const readiness = await request(app)
      .get(`${API}/me/applications/${applicationId}/documents/readiness`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(readiness.status).toBe(200);
    expect(readiness.body.documents).toHaveLength(4);
    expect(readiness.body.documents.every((document: { ready: boolean; generated: boolean }) => document.ready && document.generated)).toBe(true);

    const studentReport = await request(app)
      .get(`${API}/me/applications/${applicationId}/report/file`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(studentReport.status).toBe(200);

    const adminReport = await request(app)
      .get(`${API}/cohorts/${fixture.cohortId}/admin/applications/${applicationId}/report/file`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminReport.status).toBe(200);

    const adminDocument = await request(app)
      .get(`${API}/cohorts/${fixture.cohortId}/admin/applications/${applicationId}/documents/NOTICE/file`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminDocument.status).toBe(200);

    const wrongCohort = await request(app)
      .get(`${API}/cohorts/${fixture.foreignCohortId}/admin/applications/${applicationId}/report/file`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(wrongCohort.status).toBe(404);

    const studentOnAdmin = await request(app)
      .get(`${API}/cohorts/${fixture.cohortId}/admin/overview`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(studentOnAdmin.status).toBe(403);
  });
});
