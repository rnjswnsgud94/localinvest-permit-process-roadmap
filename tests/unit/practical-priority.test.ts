import { describe, expect, it } from "vitest";

import type { Procedure } from "@/lib/domain/schemas";
import {
  fieldReviewedGateProcedureIds,
  practicalPriorityForProcedure,
} from "@/lib/engine/practical-priority";

function procedure(
  id: string,
  stage: Procedure["stage"] = "PRE_CONSTRUCTION",
): Procedure {
  return {
    id,
    name: id,
    aliases: [],
    description: "test",
    outcome: "test",
    stage,
    actionType: "REVIEW",
    domain: "test",
    lane: "COMPANY",
    applicant: "test",
    receivingAuthority: "test",
    statutoryDecisionMaker: "test",
    consultationAuthorities: [],
    submissions: [],
    validity: null,
    followUpObligations: [],
    ruleIds: [],
    citationIds: [],
    durationId: null,
    verificationStatus: "INTERNAL_REVIEWED",
    reviewedAt: "2026-08-26",
    reviewNote: "test",
    deemedByProcedureIds: [],
    deemedProcedureIds: [],
  };
}

describe("practical procedure priority", () => {
  it("marks an applicable field-reviewed gate as P0 without naming a source company", () => {
    const priority = practicalPriorityForProcedure(
      procedure("industrial-water-master-plan-reflection-consultation", "SITE_REVIEW"),
      { applicability: "APPLIES" },
    );

    expect(fieldReviewedGateProcedureIds.has(
      "industrial-water-master-plan-reflection-consultation",
    )).toBe(true);
    expect(priority).toMatchObject({
      level: "P0",
      label: "핵심 게이트",
      rank: 0,
    });
    expect(priority.reasons).toContain(
      "기업·지자체 실무목록 교차검토에서 일정 게이트로 반복 확인",
    );
    expect(priority.reasons.join(" ")).not.toMatch(/삼성|SK|기업명/);
  });

  it("marks a schedule-critical non-gate as P0 and explains the schedule effect", () => {
    const priority = practicalPriorityForProcedure(
      procedure("road-work-police-report"),
      { applicability: "APPLIES", critical: true },
    );

    expect(priority).toEqual({
      level: "P0",
      label: "핵심 게이트",
      rank: 0,
      reasons: [
        "현재 입력에서 적용 절차로 판정됨",
        "현재 인허가 일정 그래프의 임계경로에 포함됨",
      ],
    });
  });

  it("uses the pre-operation stage as a P1 fallback when no critical context exists", () => {
    expect(
      practicalPriorityForProcedure(procedure("ordinary-pre-operation", "PRE_OPERATION")),
    ).toEqual({
      level: "P1",
      label: "일정 선행",
      rank: 1,
      reasons: ["착공·가동 전에 검토하거나 완료할 선행 단계에 배치됨"],
    });
  });

  it("keeps an unassessed low-frequency supplemental procedure at P2 in the encyclopedia", () => {
    expect(
      practicalPriorityForProcedure(
        procedure("marine-use-impact-assessment", "SITE_REVIEW"),
      ),
    ).toEqual({
      level: "P2",
      label: "조건부 확인",
      rank: 2,
      reasons: ["입지·시설 또는 공사조건이 맞을 때만 적용되는 선택형 절차임"],
    });
  });

  it.each(["POSSIBLY_APPLIES", "NEEDS_MORE_INFO", "DOES_NOT_APPLY"] as const)(
    "keeps %s procedures at P2 even when they would otherwise be critical gates",
    (applicability) => {
      const priority = practicalPriorityForProcedure(
        procedure("building-use-approval", "PRE_OPERATION"),
        { applicability, critical: true },
      );

      expect(priority).toMatchObject({
        level: "P2",
        label: "조건부 확인",
        rank: 2,
      });
    },
  );

  it("keeps a deemed gate at P2 so it is not presented as a separate P0 action", () => {
    const priority = practicalPriorityForProcedure(
      procedure("integrated-environmental-permit"),
      { applicability: "APPLIES", isDeemed: true, critical: true },
    );

    expect(priority.level).toBe("P2");
    expect(priority.reasons).toEqual(expect.arrayContaining([
      "상위 절차의 의제서류·관계기관 협의 조건을 확인해야 함",
      "기업·지자체 실무목록 교차검토에서 일정 게이트로 반복 확인",
    ]));
    expect(priority.reasons).not.toContain(
      "현재 인허가 일정 그래프의 임계경로에 포함됨",
    );
  });

  it("uses P2 for post-operation follow-up when no stronger context exists", () => {
    expect(
      practicalPriorityForProcedure(procedure("regular-inspection", "POST_OPERATION")),
    ).toEqual({
      level: "P2",
      label: "조건부 확인",
      rank: 2,
      reasons: ["가동 후 이행·정기점검 단계로 별도 추적이 필요함"],
    });
  });
});
