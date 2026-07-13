import { afterEach, describe, expect, it, vi } from "vitest";
import { CohortStatus } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { SurveyService } from "./survey.service";

const survey = { id: "survey-1", cohort_id: "cohort-1", title: "Survey", updated_at: new Date() };
const question = { id: "question-1", survey_id: "survey-1", label: "About", type: "TEXT" as const, required: true, order_index: 0, options: null };

describe("SurveyService", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates a survey only for an existing cohort", async () => {
    vi.spyOn(prisma.cohort, "findUnique").mockResolvedValue({ id: "cohort-1" } as any);
    vi.spyOn(prisma.survey, "findUnique").mockResolvedValue(null);
    const create = vi.spyOn(prisma.survey, "create").mockResolvedValue(survey as any);
    await new SurveyService().createSurvey({ cohort_id: "cohort-1", title: " Survey " });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: { cohort_id: "cohort-1", title: "Survey" } }));
  });

  it("rejects a question from another survey", async () => {
    vi.spyOn(prisma.question, "findFirst").mockResolvedValue(null);
    await expect(new SurveyService().deleteQuestion("survey-1", "foreign-question")).rejects.toMatchObject({ code: "QUESTION_NOT_FOUND" });
  });

  it("validates a complete reorder list", async () => {
    vi.spyOn(prisma.survey, "findUnique").mockResolvedValue(survey as any);
    vi.spyOn(prisma.question, "findMany").mockResolvedValue([{ id: "q1" }, { id: "q2" }] as any);
    await expect(new SurveyService().reorderQuestions("survey-1", ["q1"])).rejects.toMatchObject({ code: "INVALID_QUESTION_ORDER" });
  });

  it("copies questions into a new independent survey in a transaction", async () => {
    vi.spyOn(prisma.survey, "findUnique").mockResolvedValueOnce({ ...survey, questions: [question] } as any).mockResolvedValueOnce(null);
    vi.spyOn(prisma.cohort, "findUnique").mockResolvedValue({ id: "cohort-2" } as any);
    const transaction = vi.spyOn(prisma, "$transaction").mockImplementation(async (arg: any) => {
      if (typeof arg === "function") return arg({ survey: { create: vi.fn().mockResolvedValue({ ...survey, id: "survey-2" }) } });
      return arg;
    });
    await new SurveyService().copySurvey("survey-1", "cohort-2");
    expect(transaction).toHaveBeenCalled();
  });

  it("returns only public cohort, tracks and questions for a valid invitation", async () => {
    vi.spyOn(prisma.invitation, "findUnique").mockResolvedValue({
      token: "token", expires_at: new Date(Date.now() + 60_000), cohort: {
        id: "cohort-1", title: "Cohort", status: CohortStatus.ACTIVE,
        application_start: new Date(Date.now() - 60_000), application_end: new Date(Date.now() + 60_000),
        survey: { ...survey, questions: [question] }, tracks: [{ id: "track-1", title: "Backend" }],
      },
    } as any);
    await expect(new SurveyService().getPublicFormByInvitationToken("token")).resolves.toEqual({
      cohort: { id: "cohort-1", title: "Cohort" }, tracks: [{ id: "track-1", title: "Backend" }],
      survey: { id: "survey-1", title: "Survey", questions: [{ id: "question-1", label: "About", type: "TEXT", required: true, order_index: 0, options: null }] },
    });
  });

  it("rejects expired invitations", async () => {
    vi.spyOn(prisma.invitation, "findUnique").mockResolvedValue({ token: "expired", expires_at: new Date(Date.now() - 1), cohort: {} } as any);
    await expect(new SurveyService().getPublicFormByInvitationToken("expired")).rejects.toMatchObject({ code: "TOKEN_EXPIRED" });
  });
});
