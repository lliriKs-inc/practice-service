import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../shared/prisma";
import { createAdmissionsTestApp } from "./admissions-app";
import { cleanupAdmissionsFixture, createAdmissionsFixture, type AdmissionsFixture } from "./admissions-fixtures";

const integrationEnabled = process.env.RUN_DB_INTEGRATION === "true";
const describeIntegration = integrationEnabled ? describe : describe.skip;

function tokenFromSessionCookie(setCookie: string[] | undefined) {
  const cookie = setCookie?.find((value) => value.startsWith("practice_session="));
  expect(cookie).toEqual(expect.stringContaining("HttpOnly"));
  return decodeURIComponent(cookie!.split(";", 1)[0].slice("practice_session=".length));
}

describeIntegration("A-07 admissions candidate API flow", () => {
  const app = createAdmissionsTestApp();
  let fixture: AdmissionsFixture;
  let studentId: string;
  let studentToken: string;
  let adminToken: string;
  let applicationId: string;

  beforeAll(async () => {
    fixture = await createAdmissionsFixture();
  });

  afterAll(async () => {
    if (!fixture) return;
    await cleanupAdmissionsFixture(fixture, studentId ? [studentId] : []);
  });

  it("runs public invitation, auth, application, task and submission flow", async () => {
    const current = await request(app).get("/cohorts/public/current");
    expect(current.status).toBe(200);
    expect(current.body.id).toBe(fixture.cohortId);

    const validation = await request(app)
      .post("/invitations/validate")
      .send({ token: fixture.invitationToken });
    expect(validation.status).toBe(200);
    expect(validation.body).toMatchObject({ valid: true, cohort_id: fixture.cohortId });

    const form = await request(app).get(`/public/invitations/${fixture.invitationToken}/form`);
    expect(form.status).toBe(200);
    expect(form.body).toMatchObject({ cohort: { id: fixture.cohortId }, tracks: [{ id: fixture.trackId }] });
    expect(form.body.survey.questions[0]).toMatchObject({ id: fixture.questionId, required: true });
    expect(JSON.stringify(form.body)).not.toContain("password_hash");

    await prisma.invitation.update({
      where: { token: fixture.invitationToken },
      data: { expires_at: new Date(Date.now() - 60_000) },
    });
    const expiredValidation = await request(app)
      .post("/invitations/validate")
      .send({ token: fixture.invitationToken });
    expect(expiredValidation.status).toBe(400);
    await prisma.invitation.update({
      where: { token: fixture.invitationToken },
      data: { expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });

    const anonymousPrivate = await request(app).get("/me/applications");
    expect(anonymousPrivate.status).toBe(401);

    const email = `${fixture.prefix}-student@example.com`;
    const registration = await request(app).post("/auth/register").send({
      email,
      password: "Student-password-123!",
      full_name: "A-07 Test Student",
    });
    expect(registration.status).toBe(201);
    expect(registration.body).not.toHaveProperty("password_hash");
    studentId = registration.body.id;

    const login = await request(app).post("/auth/login").send({ email, password: "Student-password-123!" });
    expect(login.status).toBe(200);
    studentToken = tokenFromSessionCookie(login.headers["set-cookie"]);

    const me = await request(app).get("/auth/me").set("Authorization", `Bearer ${studentToken}`);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ id: studentId, role: "STUDENT" });

    const submitted = await request(app)
      .post(`/public/invitations/${fixture.invitationToken}/applications`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ track_id: fixture.trackId, answers: [{ question_id: fixture.questionId, answer_value: "I want to learn." }] });
    expect(submitted.status).toBe(201);
    expect(submitted.body.status).toBe("PENDING");
    applicationId = submitted.body.id;

    const duplicate = await request(app)
      .post(`/public/invitations/${fixture.invitationToken}/applications`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ track_id: fixture.trackId, answers: [{ question_id: fixture.questionId, answer_value: "Again" }] });
    expect(duplicate.status).toBe(409);

    const archive = await request(app).get("/me/applications").set("Authorization", `Bearer ${studentToken}`);
    expect(archive.status).toBe(200);
    expect(archive.body).toHaveLength(1);
    expect(archive.body[0]).toMatchObject({ id: applicationId, status: "PENDING" });

    const detail = await request(app).get(`/me/applications/${applicationId}`).set("Authorization", `Bearer ${studentToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.track.cohort.id).toBe(fixture.cohortId);

    const task = await request(app).get(`/me/applications/${applicationId}/test-task`).set("Authorization", `Bearer ${studentToken}`);
    expect(task.status).toBe(200);
    expect(task.body).toMatchObject({ available: true, has_file: false });

    const invalidUpload = await request(app)
      .put(`/me/applications/${applicationId}/test-task-submission`)
      .set("Authorization", `Bearer ${studentToken}`)
      .attach("file", Buffer.from("not a zip"), { filename: "solution.txt", contentType: "text/plain" });
    expect(invalidUpload.status).toBe(400);

    const submission = await request(app)
      .put(`/me/applications/${applicationId}/test-task-submission`)
      .set("Authorization", `Bearer ${studentToken}`)
      .attach("file", Buffer.from("zip-content"), { filename: "solution.zip", contentType: "application/zip" });
    expect(submission.status).toBe(200);
    expect(submission.body).toMatchObject({ application_id: applicationId, has_file: true });

    const ownSubmission = await request(app)
      .get(`/me/applications/${applicationId}/test-task-submission`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(ownSubmission.status).toBe(200);
    expect(ownSubmission.body.application_id).toBe(applicationId);

    const adminLogin = await request(app).post("/auth/login").send({ email: fixture.adminEmail, password: fixture.adminPassword });
    expect(adminLogin.status).toBe(200);
    adminToken = tokenFromSessionCookie(adminLogin.headers["set-cookie"]);

    const adminList = await request(app)
      .get(`/cohorts/${fixture.cohortId}/applications`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminList.status).toBe(200);
    expect(adminList.body).toHaveLength(1);
    expect(adminList.body[0].id).toBe(applicationId);

    const adminSubmission = await request(app)
      .get(`/cohorts/${fixture.cohortId}/applications/${applicationId}/test-task-submission`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminSubmission.status).toBe(200);

    const approved = await request(app)
      .patch(`/cohorts/${fixture.cohortId}/applications/${applicationId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "APPROVED" });
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe("APPROVED");

    const repeatedApproval = await request(app)
      .patch(`/cohorts/${fixture.cohortId}/applications/${applicationId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "APPROVED" });
    expect(repeatedApproval.status).toBe(200);

    const missingRejectionReason = await request(app)
      .patch(`/cohorts/${fixture.cohortId}/applications/${applicationId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "REJECTED" });
    expect(missingRejectionReason.status).toBe(400);

    const invalidTransition = await request(app)
      .patch(`/cohorts/${fixture.cohortId}/applications/${applicationId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "REJECTED", rejection_reason: "Too late" });
    expect(invalidTransition.status).toBe(400);

    const studentAfterApproval = await request(app)
      .get(`/me/applications/${applicationId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(studentAfterApproval.status).toBe(200);
    expect(studentAfterApproval.body.status).toBe("APPROVED");
  });

  it("enforces RBAC, ownership and cohort isolation", async () => {
    const invalidJwt = await request(app).get("/me/applications").set("Authorization", "Bearer invalid-token");
    expect(invalidJwt.status).toBe(401);

    const studentAdminRoute = await request(app)
      .get(`/cohorts/${fixture.cohortId}/applications`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(studentAdminRoute.status).toBe(403);

    const foreignApplication = await prisma.application.create({
      data: { user_id: studentId, track_id: fixture.foreignTrackId },
    });
    const foreignCohortList = await request(app)
      .get(`/cohorts/${fixture.cohortId}/applications`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(foreignCohortList.status).toBe(200);
    expect(foreignCohortList.body.map((item: { id: string }) => item.id)).not.toContain(foreignApplication.id);

    const wrongCohortApplication = await request(app)
      .get(`/cohorts/${fixture.cohortId}/applications/${foreignApplication.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(wrongCohortApplication.status).toBe(404);

    const foreignTrackSubmit = await request(app)
      .post(`/public/invitations/${fixture.invitationToken}/applications`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ track_id: fixture.foreignTrackId, answers: [{ question_id: fixture.questionId, answer_value: "No" }] });
    expect(foreignTrackSubmit.status).toBe(400);

    const foreignQuestionSubmit = await request(app)
      .post(`/public/invitations/${fixture.invitationToken}/applications`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ track_id: fixture.trackId, answers: [{ question_id: "foreign-question", answer_value: "No" }] });
    expect(foreignQuestionSubmit.status).toBe(400);
  });
});
