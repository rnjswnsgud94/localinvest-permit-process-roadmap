import { describe, expect, it } from "vitest";

import { buildPermitReportModel } from "@/app/components/dashboard/pdf/permit-report-model";
import { procedureCategoryForDecision } from "@/app/components/dashboard/constants";
import { buildInputConsistencyWarnings } from "@/lib/data/input-consistency";
import { evaluateProject } from "@/lib/engine/pipeline";
import { encodeInputCode } from "@/lib/share-state";
import { userSampleAnswers } from "@/tests/fixtures/user-sample-answers";

describe("user supplied FPR1.1a72c37b sample", () => {
  it("restores the exact state and keeps its practical risks visible in the report", () => {
    expect(encodeInputCode(userSampleAnswers)).toMatch(/^FPR1\.1a72c37b\./);

    const evaluation = evaluateProject(userSampleAnswers);
    const report = buildPermitReportModel({
      answers: userSampleAnswers,
      evaluation,
      durationScenario: "TYPICAL",
      generatedAt: new Date("2026-08-23T03:04:05.000Z"),
    });
    const categoryCounts = evaluation.decisions.reduce(
      (counts, decision) => {
        counts[procedureCategoryForDecision(decision)] += 1;
        return counts;
      },
      { REQUIRED: 0, CONFIRM: 0, NOT_REQUIRED: 0 },
    );

    expect(evaluation.counts).toEqual({
      APPLIES: 31,
      DOES_NOT_APPLY: 62,
      POSSIBLY_APPLIES: 52,
      NEEDS_MORE_INFO: 0,
    });
    expect(categoryCounts).toEqual({ REQUIRED: 89, CONFIRM: 0, NOT_REQUIRED: 56 });
    expect(report.summary.counts).toEqual(categoryCounts);
    expect(report.summary.roadmapBreakdown).toEqual({
      confirmed: 31,
      scopeCheck: 52,
      deemed: 6,
    });
    expect(report.summary.duration).toMatchObject({
      label: "확인된 일정 하한",
      value: "7개월 14일",
      isTotal: false,
    });
    expect(evaluation.schedules.TYPICAL.projectTimeline).toMatchObject({
      durationStatus: "MINIMUM_ONLY",
      operationReadyDate: null,
    });

    const warningText = report.warnings.join(" ");
    for (const phrase of [
      "화학물질 취급은 ‘아니오’",
      "내륙 지역 사업에 해양이용 절차",
      "공공하수도 연결과 개인하수처리시설",
      "초지법상 조성초지",
      "전력 증가량 3,900MW",
      "용수 수요 20,000㎥/일",
      "에너지사용계획은 비대상",
      "건축물 에너지절약계획서는 비대상",
      "건설폐기물 처리계획 신고는 비대상",
      "비점오염원 설치신고는 비대상",
      "완공 후 최초 자체점검은 비대상",
      "PSM·유해위험방지계획·안전관리자는 모두 비대상",
      "산업단지 입주계약 완료",
      "개발·입지 단계 절차가 함께 선택",
      "시운전 시작일이 전체 공사 종료일보다 빠릅니다",
      "시운전 목표일 2027-01-13보다 늦게 계획",
    ]) {
      expect(warningText).toContain(phrase);
    }

    expect(report.metadata).toMatchObject({
      title: "충청북도 청주시 · 반도체·디스플레이 전공정 · 신설·신축 인허가 결과보고서",
      filename: "인허가-결과보고서_충청북도-청주시_반도체-디스플레이-전공정_신설_신축_20260823-120405.pdf",
    });
    expect(report.summary.milestones).toEqual(expect.arrayContaining([
      { label: "설비완료(사용자 목표)", value: "2026-12-30" },
      { label: "시운전(사용자 목표)", value: "2027-01-13" },
    ]));

    const deemed = report.procedures.filter((procedure) =>
      procedure.status.includes("의제 처리"),
    );
    expect(deemed).toHaveLength(6);
    expect(deemed.every((procedure) =>
      procedure.status === "별도 신청 제외 · 상위 절차에서 의제 처리" &&
      procedure.officialDuration.includes("별도 신청·처리기간 없음") &&
      procedure.schedule === "상위 절차 일정에 포함",
    )).toBe(true);
    expect(report.procedures.find((procedure) =>
      procedure.id === "environmental-impact-assessment",
    )?.schedule).toBe("2026-11-17 전 완료 필요 · 개시일 역산 불가");
    expect(evaluation.decisions.find((decision) =>
      decision.procedure.id === "development-activity-permit",
    )).toMatchObject({ status: "APPLIES", isDeemed: false });
    expect(evaluation.decisions.find((decision) =>
      decision.procedure.id === "development-activity-completion-inspection",
    )).toMatchObject({ status: "POSSIBLY_APPLIES", isDeemed: false });

    const serialized = JSON.stringify(report);
    expect(serialized).not.toMatch(
      /rule-|판정규칙 법률 검토 필요|AI 보조 초안|근거 추가 검토 필요|의제 반영 · 확인된 제외/,
    );
  });

  it("does not warn after the cross-field scope questions are resolved", () => {
    expect(buildInputConsistencyWarnings({
      ...userSampleAnswers,
      chemicalsHandled: true,
      publicSewerConnection: true,
      privateSewageTreatmentFacility: false,
      powerIncreaseMw: 3.9,
      waterDemandM3Day: 500,
      energyUsePlanRequired: true,
      supplementalPermitTargetIds: [
        ...userSampleAnswers.supplementalPermitTargetIds.filter(
          (id) => ![
            "marine-use-consultation",
            "pasture-conversion-permit",
          ].includes(id),
        ),
        "building-energy-saving-plan-review",
        "construction-waste-plan-report",
        "nonpoint-source-installation-report",
        "hazard-prevention-plan",
      ],
      firstFireSelfInspectionTarget: true,
      psmCovered: true,
      safetyManagerRequired: true,
      industrialComplexName: "테스트산업단지",
      industrialComplexIdentifier: "IC-001",
      industrialComplexManagingAuthority: "테스트 관리기관",
      siteAddress: "충청북도 청주시 테스트로 1",
      existingApprovalIds: "입주계약 IC-2026-001",
      ksicCode: "26112",
      products: "반도체 소자",
      coreProcesses: "웨이퍼 전공정",
      commissioningStartDate: "2027-03-01",
    })).toEqual([]);
  });
});
