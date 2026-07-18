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

describe("AuthService.getMe", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("automatically persists the first approved application after practice starts", async () => {
    vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
      id: "student-1",
      email: "student@example.com",
      full_name: "Student",
      role: "STUDENT",
      active_cohort_id: null,
      active_application_id: null,
      created_at: new Date(),
      activeApplication: null,
    } as any);
    vi.spyOn(prisma.application, "findFirst").mockResolvedValue({
      id: "application-1",
    } as any);
    const update = vi.spyOn(prisma.user, "update").mockResolvedValue({
      id: "student-1",
      active_application_id: "application-1",
    } as any);

    await expect(AuthService.getMe("student-1")).resolves.toMatchObject({
      active_application_id: "application-1",
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { active_application_id: "application-1" },
      })
    );
  });

  it("keeps a valid saved selection without choosing another application", async () => {
    vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
      id: "student-1",
      email: "student@example.com",
      full_name: "Student",
      role: "STUDENT",
      active_cohort_id: null,
      active_application_id: "application-1",
      created_at: new Date(),
      activeApplication: {
        id: "application-1",
        status: ApplicationStatus.APPROVED,
      },
    } as any);
    const findFirst = vi.spyOn(prisma.application, "findFirst");

    await expect(AuthService.getMe("student-1")).resolves.toMatchObject({
      active_application_id: "application-1",
    });
    expect(findFirst).not.toHaveBeenCalled();
  });
});
