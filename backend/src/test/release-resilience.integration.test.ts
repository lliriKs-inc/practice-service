import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../shared/prisma";
import {
  cleanupAdmissionsFixture,
  createAdmissionsFixture,
  type AdmissionsFixture,
} from "./admissions-fixtures";

const describeIntegration = process.env.RUN_DB_INTEGRATION === "true"
  ? describe
  : describe.skip;
const API = "/api/v1";

describeIntegration("B-08 concurrent release resilience", () => {
  const app = createApp({ readinessCheck: async () => undefined });
  let fixture: AdmissionsFixture;
  let studentId = "";
  let studentToken = "";
  let adminToken = "";

  beforeAll(async () => {
    fixture = await createAdmissionsFixture();
    const email = `${fixture.prefix}-resilience@example.com`;
    const password = "B08-Resilience-password-123!";

    const registration = await request(app)
      .post(`${API}/auth/register`)
      .send({ email, password, full_name: "B-08 Resilience Student" });
    studentId = registration.body.id;

    studentToken = (await request(app)
      .post(`${API}/auth/login`)
      .send({ email, password })).body.token;
    adminToken = (await request(app)
      .post(`${API}/auth/login`)
      .send({
        email: fixture.adminEmail,
        password: fixture.adminPassword,
      })).body.token;
  });

  afterAll(async () => {
    if (fixture) {
      await cleanupAdmissionsFixture(fixture, studentId ? [studentId] : []);
    }
  });

  it("creates one application under concurrent duplicate submissions", async () => {
    const submit = () => request(app)
      .post(`${API}/public/invitations/${fixture.invitationToken}/applications`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        track_id: fixture.trackId,
        answers: [{
          question_id: fixture.questionId,
          answer_value: "Concurrent submission",
        }],
      });

    const responses = await Promise.all([submit(), submit()]);
    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);

    const count = await prisma.application.count({
      where: { user_id: studentId, track_id: fixture.trackId },
    });
    expect(count).toBe(1);
  });

  it("keeps approval and calendar generation idempotent under concurrency", async () => {
    const application = await prisma.application.findFirstOrThrow({
      where: { user_id: studentId, track_id: fixture.trackId },
      select: { id: true },
    });
    const approve = () => request(app)
      .patch(`${API}/cohorts/${fixture.cohortId}/applications/${application.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "APPROVED" });

    const responses = await Promise.all([approve(), approve()]);
    expect(responses.every(({ status }) => status === 200)).toBe(true);

    const tasks = await prisma.dailyTask.findMany({
      where: { application_id: application.id },
      select: { task_date: true },
    });
    expect(tasks.length).toBeGreaterThan(0);
    expect(new Set(tasks.map(({ task_date }) => task_date.toISOString())).size)
      .toBe(tasks.length);
  });
});
