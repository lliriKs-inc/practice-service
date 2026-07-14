import { describe, expect, it } from "vitest";
import authRoutes from "../modules/auth/auth.routes";
import cohortRoutes from "../modules/cohort/cohort.routes";
import trackRoutes, { nestedTrackRoutes } from "../modules/track/track.routes";
import invitationRoutes from "../modules/invitation/invitation.routes";
import surveyRoutes, { nestedSurveyRouter, publicSurveyRouter } from "../modules/survey/survey.routes";
import applicationRoutes from "../modules/application/application.routes";
import testTaskRoutes from "../modules/test-task/test-task.routes";

function routePaths(router: { stack?: Array<any> }) {
  return (router.stack ?? [])
    .filter((layer) => layer.route)
    .flatMap((layer) => Object.keys(layer.route.methods).map((method) => `${method.toUpperCase()} ${layer.route.path}`));
}

describe("Admissions route registry", () => {
  it("exports all public and private auth/admissions routes", () => {
    expect(routePaths(authRoutes)).toEqual(expect.arrayContaining([
      "POST /register", "POST /login", "GET /me",
    ]));
    expect(routePaths(cohortRoutes)).toContain("GET /public/current");
    expect(routePaths(invitationRoutes)).toContain("POST /validate");
    expect(routePaths(publicSurveyRouter)).toContain("GET /public/invitations/:token/form");
    expect(routePaths(trackRoutes)).toEqual(expect.arrayContaining(["POST /", "GET /"]));
    expect(routePaths(nestedTrackRoutes)).toEqual(expect.arrayContaining([
      "GET /cohorts/:cohortId/tracks", "POST /cohorts/:cohortId/tracks",
      "PATCH /cohorts/:cohortId/tracks/:trackId", "DELETE /cohorts/:cohortId/tracks/:trackId",
    ]));
    expect(routePaths(surveyRoutes)).toEqual(expect.arrayContaining([
      "POST /surveys", "GET /surveys/:surveyId", "POST /surveys/:surveyId/questions",
    ]));
    expect(routePaths(nestedSurveyRouter)).toEqual(expect.arrayContaining([
      "GET /cohorts/:cohortId/survey", "POST /cohorts/:cohortId/survey",
      "POST /cohorts/:cohortId/survey/questions", "PATCH /cohorts/:cohortId/survey/questions/:questionId",
      "DELETE /cohorts/:cohortId/survey/questions/:questionId",
    ]));
  });

  it("exports candidate and admin application/test-task routes", () => {
    const applicationPaths = routePaths(applicationRoutes);
    const testTaskPaths = routePaths(testTaskRoutes);
    expect(applicationPaths).toEqual(expect.arrayContaining([
      "POST /public/invitations/:token/applications",
      "GET /me/applications",
      "GET /me/applications/:applicationId",
      "PATCH /cohorts/:cohortId/applications/:applicationId/status",
    ]));
    expect(testTaskPaths).toEqual(expect.arrayContaining([
      "GET /me/applications/:applicationId/test-task",
      "PUT /me/applications/:applicationId/test-task-submission",
      "GET /me/applications/:applicationId/test-task-submission",
      "POST /cohorts/:cohortId/tracks/:trackId/test-task/publish",
      "POST /cohorts/:cohortId/tracks/:trackId/test-task/file",
      "DELETE /cohorts/:cohortId/tracks/:trackId/test-task",
      "GET /cohorts/:cohortId/applications/:applicationId/test-task-submission",
    ]));
  });
});
