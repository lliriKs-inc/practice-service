import { afterEach, describe, expect, it, vi } from "vitest";
import { CohortStatus } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { InvitationService } from "./invitation.service";

const cohort = {
  id: "cohort-1",
  title: "Cohort",
  status: CohortStatus.ACTIVE,
  application_start: new Date(Date.now() - 60_000),
  application_end: new Date(Date.now() + 86_400_000),
  _count: { tracks: 1 },
};

describe("InvitationService", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects non-positive expiration", async () => {
    await expect(new InvitationService().createInvitation({ cohort_id: "cohort-1", expires_in_days: 0 })).rejects.toMatchObject({ code: "INVALID_EXPIRATION" });
  });

  it("creates or replaces an invitation for a cohort", async () => {
    vi.spyOn(prisma.cohort, "findUnique").mockResolvedValue(cohort as any);
    const upsert = vi.spyOn(prisma.invitation, "upsert").mockResolvedValue({ id: "inv-1", cohort_id: "cohort-1", token: "token", created_at: new Date(), expires_at: new Date() } as any);
    await new InvitationService().createInvitation({ cohort_id: "cohort-1", expires_in_days: 7 });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { cohort_id: "cohort-1" }, create: expect.objectContaining({ cohort_id: "cohort-1" }) }));
  });

  it("rejects creating an invitation for a cohort without tracks", async () => {
    vi.spyOn(prisma.cohort, "findUnique").mockResolvedValue({
      ...cohort,
      _count: { tracks: 0 },
    } as any);
    const upsert = vi.spyOn(prisma.invitation, "upsert");

    await expect(
      new InvitationService().createInvitation({
        cohort_id: "cohort-1",
        expires_in_days: 7,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "COHORT_TRACK_REQUIRED",
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects expired tokens and closed cohorts", async () => {
    vi.spyOn(prisma.invitation, "findUnique").mockResolvedValue({ token: "expired", expires_at: new Date(Date.now() - 1), cohort } as any);
    await expect(new InvitationService().validateToken("expired")).rejects.toMatchObject({ code: "TOKEN_EXPIRED" });

    vi.restoreAllMocks();
    vi.spyOn(prisma.invitation, "findUnique").mockResolvedValue({ token: "closed", expires_at: new Date(Date.now() + 1000), cohort: { ...cohort, status: CohortStatus.CLOSED } } as any);
    await expect(new InvitationService().validateToken("closed")).rejects.toMatchObject({ code: "COHORT_CLOSED" });
  });

  it("returns only public cohort data for a valid token", async () => {
    vi.spyOn(prisma.invitation, "findUnique").mockResolvedValue({ token: "valid", cohort_id: "cohort-1", expires_at: new Date(Date.now() + 1000), cohort } as any);
    await expect(new InvitationService().validateToken("valid")).resolves.toEqual({ valid: true, cohort_id: "cohort-1", cohort_title: "Cohort" });
  });

  it("deletes the invitation for a cohort", async () => {
    vi.spyOn(prisma.invitation, "findUnique").mockResolvedValue({ id: "inv-1", cohort_id: "cohort-1" } as any);
    const remove = vi.spyOn(prisma.invitation, "delete").mockResolvedValue({} as any);
    await new InvitationService().deleteInvitation("cohort-1");
    expect(remove).toHaveBeenCalledWith({ where: { cohort_id: "cohort-1" } });
  });
});
