import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../shared/prisma";
import { TrackService } from "./track.service";

describe("TrackService", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects a missing cohort", async () => {
    vi.spyOn(prisma.cohort, "findUnique").mockResolvedValue(null);
    await expect(new TrackService().createTrack({ cohort_id: "missing", title: "Backend" })).rejects.toMatchObject({ code: "COHORT_NOT_FOUND" });
  });

  it("scopes reads by the requested cohort", async () => {
    const findMany = vi.spyOn(prisma.track, "findMany").mockResolvedValue([]);
    await new TrackService().getTracksByCohort("cohort-1");
    expect(findMany).toHaveBeenCalledWith({ where: { cohort_id: "cohort-1" } });
  });
});
