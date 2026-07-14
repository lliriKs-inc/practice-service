import type { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import cohortRoutes from "../modules/cohort/cohort.routes";
import trackRoutes, { nestedTrackRoutes } from "../modules/track/track.routes";
import invitationRoutes, { nestedInvitationRoutes } from "../modules/invitation/invitation.routes";
import surveyRoutes, {
  nestedSurveyRouter,
  publicSurveyRouter,
} from "../modules/survey/survey.routes";
import applicationRoutes from "../modules/application/application.routes";
import testTaskRoutes from "../modules/test-task/test-task.routes";
import documentFileRoutes from "../modules/documents/document-file.routes";
import documentAdminRoutes from "../modules/documents/document-admin.routes";
import adminRoutes from "../modules/admin/admin.routes";

export const API_V1_PREFIX = "/api/v1";

export type ApiMountPhase = "public" | "private";

export type ApiMount = {
  id: string;
  prefix: string;
  phase: ApiMountPhase;
  router: Router;
};

export const API_V1_MOUNTS: readonly ApiMount[] = [
  { id: "auth", prefix: "/auth", phase: "public", router: authRoutes },
  { id: "cohorts", prefix: "/cohorts", phase: "public", router: cohortRoutes },
  { id: "invitations", prefix: "/invitations", phase: "public", router: invitationRoutes },
  { id: "cohort-invitations", prefix: "/", phase: "private", router: nestedInvitationRoutes },
  { id: "public-survey", prefix: "/", phase: "public", router: publicSurveyRouter },
  { id: "tracks", prefix: "/tracks", phase: "private", router: trackRoutes },
  { id: "cohort-tracks", prefix: "/", phase: "private", router: nestedTrackRoutes },
  { id: "survey", prefix: "/", phase: "private", router: surveyRoutes },
  { id: "cohort-survey", prefix: "/", phase: "private", router: nestedSurveyRouter },
  { id: "application-practice", prefix: "/", phase: "private", router: applicationRoutes },
  { id: "test-task", prefix: "/", phase: "private", router: testTaskRoutes },
  { id: "document-files", prefix: "/", phase: "private", router: documentFileRoutes },
  { id: "document-admin", prefix: "/", phase: "private", router: documentAdminRoutes },
  { id: "admin", prefix: "/", phase: "private", router: adminRoutes },
] as const;

function joinPaths(...parts: string[]) {
  const path = parts
    .join("/")
    .replace(/\/{2,}/g, "/")
    .replace(/\/$/, "");

  return path || "/";
}

export type RegisteredApiRoute = {
  mountId: string;
  method: string;
  path: string;
  phase: ApiMountPhase;
};

export function listRegisteredApiRoutes(): RegisteredApiRoute[] {
  return API_V1_MOUNTS.flatMap((mount) =>
    (mount.router.stack ?? [])
      .filter((layer) => Boolean(layer.route))
      .flatMap((layer) =>
        Object.keys((layer.route as any).methods).map((method) => ({
          mountId: mount.id,
          method: method.toUpperCase(),
          path: joinPaths(
            API_V1_PREFIX,
            mount.prefix,
            String((layer.route as any).path)
          ),
          phase: mount.phase,
        }))
      )
  );
}
