import { describe, expect, it } from "vitest";

import { catalog, type ScenarioAnswers } from "@/lib/data/catalog";
import { evaluateProject } from "@/lib/engine/pipeline";

function scenario(overrides: Partial<ScenarioAnswers>): ScenarioAnswers {
  return {
    ...catalog.scenarios[0].answers,
    assessmentDate: "2026-08-21",
    province: "충청남도",
    city: "아산시",
    siteAddress: "충청남도 아산시 검토필지",
    siteZoning: "산업시설용지",
    siteRestrictedFactors: "별도 확인",
    ...overrides,
  };
}

function decision(
  evaluation: ReturnType<typeof evaluateProject>,
  procedureId: string,
) {
  const result = evaluation.decisions.find(
    (item) => item.procedure.id === procedureId,
  );
  expect(result, procedureId).toBeDefined();
  return result!;
}

describe("roadmap readiness scenarios", () => {
  it("routes an industrial-complex resident through the actual occupancy contract and deems only factory approval after completion", () => {
    const evaluation = evaluateProject(
      scenario({
        insideIndustrialComplex: true,
        industrialComplexName: "아산 검토산업단지",
        industrialComplexIdentifier: "TEST-ASAN-001",
        industrialComplexManagingAuthority: "아산시 산업단지 담당부서",
        industrialComplexOccupancyContractStatus: "COMPLETED",
        industryCategory: "GENERAL_MANUFACTURING",
      }),
    );

    expect(decision(evaluation, "industrial-complex-occupancy-contract")).toMatchObject({
      status: "APPLIES",
      provisionalEffect: "INCLUDE",
    });
    expect(decision(evaluation, "factory-establishment-approval")).toMatchObject({
      status: "DOES_NOT_APPLY",
      provisionalEffect: "EXCLUDE",
      isDeemed: true,
    });
    expect(decision(evaluation, "building-permit").isDeemed).toBe(false);
    expect(decision(evaluation, "development-activity-permit")).toMatchObject({
      status: "APPLIES",
      provisionalEffect: "INCLUDE",
      isDeemed: false,
    });
    expect(decision(evaluation, "development-activity-completion-inspection")).toMatchObject({
      status: "POSSIBLY_APPLIES",
      provisionalEffect: "INCLUDE",
      isDeemed: false,
    });
    expect(
      evaluation.schedules.TYPICAL.topologicalOrder.indexOf(
        "industrial-complex-occupancy-contract",
      ),
    ).toBeLessThan(
      evaluation.schedules.TYPICAL.topologicalOrder.indexOf(
        "factory-completion-report-complex",
      ),
    );
    expect(
      evaluation.schedules.TYPICAL.projectTimeline?.nodes.find(
        (node) => node.procedureId === "industrial-complex-occupancy-contract",
      ),
    ).toMatchObject({
      processingDuration: 0,
      startDate: "2026-08-21",
      finishDate: "2026-08-21",
      completedCheckpoint: {
        label: "산업단지 입주계약 체결 완료",
        completedDate: null,
        confirmedAsOfDate: "2026-08-21",
      },
    });
    expect(
      evaluation.schedules.TYPICAL.projectTimeline
        ?.unknownPlanningDurationProcedureIds,
    ).not.toContain("industrial-complex-occupancy-contract");
  });

  it("does not deem factory approval merely because a site is inside an industrial complex", () => {
    const evaluation = evaluateProject(
      scenario({
        insideIndustrialComplex: true,
        industrialComplexName: "아산 검토산업단지",
        industrialComplexIdentifier: "TEST-ASAN-001",
        industrialComplexManagingAuthority: "아산시 산업단지 담당부서",
        industrialComplexOccupancyContractStatus: "PLANNED",
        industryCategory: "GENERAL_MANUFACTURING",
      }),
    );

    expect(decision(evaluation, "industrial-complex-occupancy-contract").status).toBe("APPLIES");
    expect(decision(evaluation, "factory-establishment-approval").isDeemed).toBe(false);
    expect(
      evaluation.schedules.TYPICAL.projectTimeline
        ?.unknownPlanningDurationProcedureIds,
    ).toContain("industrial-complex-occupancy-contract");
    expect(
      evaluation.schedules.TYPICAL.projectTimeline?.nodes.find(
        (node) => node.procedureId === "industrial-complex-occupancy-contract",
      ),
    ).toMatchObject({
      processingDuration: null,
      processingUpperBound: 10,
      processingUnit: "BUSINESS_DAY",
      durationPlanningBasis: "OFFICIAL_CAP_ONLY",
    });
  });

  it("uses an industrial-complex plan only for permits documented and consulted in the approved plan", () => {
    const evaluation = evaluateProject(
      scenario({
        insideIndustrialComplex: true,
        industrialComplexName: "신규 산업단지 개발사업",
        industrialComplexIdentifier: "TEST-DEV-001",
        industrialComplexManagingAuthority: "충청남도 산업단지 지정권자",
        industrialComplexOccupancyContractStatus: "IN_PROGRESS",
        industrialComplexPlanSpecialCaseConfirmed: true,
        industrialComplexPlanDocumentsIncluded: true,
        industrialComplexPlanConsultationCompleted: true,
        industrialComplexPlanApprovalPublished: true,
        industrialComplexPlanApprovalPublishedDate: "2026-08-20",
        industrialComplexPlanApprovalNoticeReference: "충청남도고시 제2026-100호",
        industrialComplexPlanIncludedPermitIds: [
          "farmland-conversion-permit",
          "building-permit",
        ],
        landCategory: "FARMLAND",
      }),
    );

    expect(decision(evaluation, "industrial-complex-plan-application").status).toBe("DOES_NOT_APPLY");
    expect(decision(evaluation, "industrial-complex-plan-consultation").status).toBe("DOES_NOT_APPLY");
    expect(decision(evaluation, "industrial-complex-plan-approval").status).toBe("APPLIES");
    expect(decision(evaluation, "farmland-conversion-permit").isDeemed).toBe(true);
    expect(decision(evaluation, "building-permit").isDeemed).toBe(true);
    expect(decision(evaluation, "road-occupation-permit").isDeemed).toBe(false);
    expect(
      decision(evaluation, "building-permit").specialLawImpacts?.[0].statutoryCap,
    ).toContain("6개월");
    expect(
      evaluation.schedules.TYPICAL.projectTimeline?.nodes.find(
        (node) => node.procedureId === "industrial-complex-plan-approval",
      ),
    ).toMatchObject({
      processingDuration: 0,
      startDate: "2026-08-20",
      finishDate: "2026-08-20",
      completedCheckpoint: {
        label: "계획 승인·고시 완료",
        completedDate: "2026-08-20",
        confirmedAsOfDate: "2026-08-21",
      },
    });
  });

  it("keeps the industrial-complex plan application, consultation, and approval phases mutually exclusive before gazette evidence", () => {
    const basePlan: Partial<ScenarioAnswers> = {
      insideIndustrialComplex: false,
      industryCategory: "GENERAL_MANUFACTURING",
      industrialComplexPlanSpecialCaseConfirmed: true,
      industrialComplexPlanIncludedPermitIds: ["building-permit"],
    };

    const application = evaluateProject(
      scenario({
        ...basePlan,
        industrialComplexPlanDocumentsIncluded: null,
        industrialComplexPlanConsultationCompleted: null,
      }),
    );
    expect(decision(application, "industrial-complex-plan-application").status).toBe("APPLIES");
    expect(decision(application, "industrial-complex-plan-consultation").status).toBe("DOES_NOT_APPLY");
    expect(decision(application, "industrial-complex-plan-approval").status).toBe("DOES_NOT_APPLY");
    expect(decision(application, "building-permit").isDeemed).toBe(false);

    const consultation = evaluateProject(
      scenario({
        ...basePlan,
        industrialComplexPlanDocumentsIncluded: true,
        industrialComplexPlanConsultationCompleted: false,
      }),
    );
    expect(decision(consultation, "industrial-complex-plan-application").status).toBe("DOES_NOT_APPLY");
    expect(decision(consultation, "industrial-complex-plan-consultation").status).toBe("APPLIES");
    expect(decision(consultation, "industrial-complex-plan-approval").status).toBe("DOES_NOT_APPLY");
    expect(decision(consultation, "building-permit").isDeemed).toBe(false);

    const approvalPending = evaluateProject(
      scenario({
        ...basePlan,
        industrialComplexPlanDocumentsIncluded: true,
        industrialComplexPlanConsultationCompleted: true,
        industrialComplexPlanApprovalPublished: true,
        industrialComplexPlanApprovalPublishedDate: null,
        industrialComplexPlanApprovalNoticeReference: "",
      }),
    );
    expect(decision(approvalPending, "industrial-complex-plan-application").status).toBe("DOES_NOT_APPLY");
    expect(decision(approvalPending, "industrial-complex-plan-consultation").status).toBe("DOES_NOT_APPLY");
    expect(decision(approvalPending, "industrial-complex-plan-approval").status).toBe("APPLIES");
    expect(decision(approvalPending, "building-permit").isDeemed).toBe(false);
    expect(
      approvalPending.specialLawEvaluations.find(
        (item) => item.id === "INDUSTRIAL_COMPLEX_PLAN_INTEGRATED_APPROVAL",
      ),
    ).toMatchObject({ status: "UNCONFIRMED" });
  });

  it("tracks a semiconductor fast-track request only against permits named in the minister request", () => {
    const evaluation = evaluateProject(
      scenario({
        insideIndustrialComplex: true,
        industrialComplexName: "반도체 클러스터 검토구역",
        industrialComplexIdentifier: "TEST-SEMI-001",
        industrialComplexManagingAuthority: "클러스터 담당기관",
        industrialComplexOccupancyContractStatus: "IN_PROGRESS",
        industryCategory: "SEMICONDUCTOR_ELECTRONICS",
        semiconductorClusterFastTrackConfirmed: true,
        semiconductorClusterApplicantRoleConfirmed: true,
        semiconductorClusterDelayRiskConfirmed: true,
        semiconductorClusterCommitteeResolved: true,
        semiconductorClusterMinisterRequestDate: "2026-08-15",
        semiconductorClusterFastTrackPermitIds: ["building-permit"],
        advancedStrategicIndustryFastTrackConfirmed: false,
        regionalSpecialZonePlanDeemingConfirmed: false,
      }),
    );

    expect(decision(evaluation, "semiconductor-cluster-fast-track-request").status).toBe("APPLIES");
    expect(decision(evaluation, "semiconductor-cluster-fast-track-result-check").status).toBe("APPLIES");
    expect(decision(evaluation, "building-permit").specialLawImpacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lawId: "SEMICONDUCTOR_CLUSTER_FAST_TRACK",
          statutoryCap: expect.stringContaining("처리 완료로 봄"),
        }),
      ]),
    );
    expect(decision(evaluation, "farmland-conversion-permit").specialLawImpacts ?? []).toEqual([]);
    expect(evaluation.schedules.TYPICAL.projectTimeline?.unknownPlanningDurationProcedureIds).toContain(
      "semiconductor-cluster-fast-track-result-check",
    );
  });

  it("keeps pre-effective AI data-center relief inactive and preserves environment and safety paths", () => {
    const evaluation = evaluateProject(
      scenario({
        assessmentDate: "2026-08-21",
        insideIndustrialComplex: false,
        industryCategory: "AI_DATA_CENTER",
        aiDataCenterActFacilityConfirmed: true,
        aiDataCenterOneStopStatus: "PLANNED",
        appliedSpecialLawIds: ["AIDC_ONE_STOP", "AIDC_GRID_IMPACT_EXEMPTION"],
        gridImpactAssessmentRequired: true,
        fireFacilityWork: true,
        airEmissionFacility: true,
        waterDischargeFacility: true,
      }),
    );

    expect(
      evaluation.specialLawEvaluations
        .filter((item) => item.id.startsWith("AIDC_"))
        .every((item) => item.status === "FUTURE"),
    ).toBe(true);
    expect(decision(evaluation, "power-grid-impact-assessment").provisionalEffect).toBe("INCLUDE");
    expect(decision(evaluation, "air-emission-installation-permit").provisionalEffect).toBe("INCLUDE");
    expect(decision(evaluation, "water-discharge-installation-permit").provisionalEffect).toBe("INCLUDE");
    expect(decision(evaluation, "fire-facility-completion-inspection").provisionalEffect).toBe("INCLUDE");
  });

  it("keeps a completed post-effective AI one-stop result as a zero-remaining checkpoint", () => {
    const evaluation = evaluateProject(
      scenario({
        assessmentDate: "2027-04-01",
        industryCategory: "AI_DATA_CENTER",
        insideIndustrialComplex: false,
        aiDataCenterActFacilityConfirmed: true,
        aiDataCenterOneStopStatus: "COMPLETED",
        appliedSpecialLawIds: ["AIDC_ONE_STOP"],
      }),
    );

    expect(decision(evaluation, "ai-data-center-one-stop-result")).toMatchObject({
      status: "APPLIES",
      provisionalEffect: "INCLUDE",
    });
    expect(
      evaluation.schedules.TYPICAL.projectTimeline?.nodes.find(
        (node) => node.procedureId === "ai-data-center-one-stop-result",
      ),
    ).toMatchObject({
      processingDuration: 0,
      startDate: "2027-04-01",
      finishDate: "2027-04-01",
      completedCheckpoint: {
        label: "AI 데이터센터 일괄처리 결과통지 완료",
        completedDate: null,
        confirmedAsOfDate: "2027-04-01",
      },
    });
    expect(
      evaluation.schedules.TYPICAL.projectTimeline
        ?.unknownPlanningDurationProcedureIds,
    ).not.toContain("ai-data-center-one-stop-result");
  });

  it("never reports a total duration while active permits still have no reviewed duration", () => {
    const evaluation = evaluateProject(
      scenario({
        plannedConstructionStartDate: "2027-03-01",
        plannedConstructionEndDate: "2029-02-28",
        equipmentInstallationCompletionDate: "2028-10-31",
        commissioningStartDate: "2029-01-15",
        insideIndustrialComplex: true,
        industrialComplexName: "아산 검토산업단지",
        industrialComplexIdentifier: "TEST-ASAN-001",
        industrialComplexManagingAuthority: "아산시 산업단지 담당부서",
        industrialComplexOccupancyContractStatus: "IN_PROGRESS",
      }),
    );
    const timeline = evaluation.schedules.TYPICAL.projectTimeline;

    expect(timeline).not.toBeNull();
    expect(timeline?.durationStatus).toBe("MINIMUM_ONLY");
    expect(timeline?.operationReadyDate).toBeNull();
    expect(timeline?.unknownPlanningDurationProcedureIds.length).toBeGreaterThan(0);
    expect(timeline?.warnings.join(" ")).toContain("일정 하한");
  });
});
