import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplicationStatus } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { AuthService } from "./auth.service";

describe("AuthService.selectActiveApplication", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores an approved application before the practice starts", async () => {
    vi.spyOn(prisma.application, "findFirst").mockResolvedValue({
      track: { cohort: { practice_start: new Date(Date.now() + 60_000) } },
    } as any);
    const update = vi.spyOn(prisma.user, "update").mockResolvedValue({
      id: "student-1",
      active_application_id: "application-1",
    } as any);

    await expect(
      AuthService.selectActiveApplication("student-1", "application-1")
    ).resolves.toMatchObject({ active_application_id: "application-1" });

    expect(prisma.application.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "application-1",
          user_id: "student-1",
          status: ApplicationStatus.APPROVED,
        },
      })
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "student-1" },
        data: { active_application_id: "application-1" },
      })
    );
  });

  it("rejects another student's or non-approved application", async () => {
    vi.spyOn(prisma.application, "findFirst").mockResolvedValue(null);

    await expect(
      AuthService.selectActiveApplication("student-1", "application-1")
    ).rejects.toMatchObject({ code: "ACTIVE_APPLICATION_NOT_FOUND" });
  });

  it("does not allow changing the selection after the practice starts", async () => {
    vi.spyOn(prisma.application, "findFirst").mockResolvedValue({
      track: { cohort: { practice_start: new Date(Date.now() - 60_000) } },
    } as any);

    await expect(
      AuthService.selectActiveApplication("student-1", "application-1")
    ).rejects.toMatchObject({
      code: "ACTIVE_APPLICATION_SELECTION_LOCKED",
    });
  });
});
