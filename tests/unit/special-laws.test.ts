import { describe, expect, it } from "vitest";

import { procedureCategoryForDecision } from "@/app/components/dashboard/constants";
import { catalog, type ScenarioAnswers } from "@/lib/data/catalog";
import { evaluateProject } from "@/lib/engine/pipeline";

function answers(overrides: Partial<ScenarioAnswers>): ScenarioAnswers {
  return {
    ...catalog.scenarios[0].answers,
    province: "충청남도",
    city: "아산시",
    insideIndustrialComplex: false,
    industryCategory: "AI_DATA_CENTER",
    investmentType: "NEW",
    buildingAction: "NEW_BUILD",
    totalAreaM2: 30_000,
    gridImpactAssessmentRequired: true,
    aiDataCenterActFacilityConfirmed: true,
    aiDataCenterOneStopStatus: "NOT_APPLIED",
    appliedSpecialLawIds: [],
    ...overrides,
  };
}

function decision(
  evaluation: ReturnType<typeof evaluateProject>,
  procedureId: string,
) {
  const found = evaluation.decisions.find(
    (item) => item.procedure.id === procedureId,
  );
  expect(found, procedureId).toBeDefined();
  return found!;
}

describe("AI data-center special-law routing", () => {
  it("keeps the grid assessment before the Act takes effect", () => {
    const evaluation = evaluateProject(
      answers({
        assessmentDate: "2026-08-21",
        appliedSpecialLawIds: ["AIDC_GRID_IMPACT_EXEMPTION"],
      }),
    );

    expect(decision(evaluation, "power-grid-impact-assessment").provisionalEffect).toBe("INCLUDE");
    expect(evaluation.specialLawEvaluations[0]).toMatchObject({
      id: "AIDC_GRID_IMPACT_EXEMPTION",
      status: "FUTURE",
    });
    expect(decision(evaluation, "power-grid-impact-assessment").specialLawImpacts?.[0].status).toBe("FUTURE");
  });

  it("exempts only the grid assessment after confirmed post-effective selection", () => {
    const evaluation = evaluateProject(
      answers({
        assessmentDate: "2027-03-10",
        appliedSpecialLawIds: ["AIDC_GRID_IMPACT_EXEMPTION"],
      }),
    );

    expect(decision(evaluation, "power-grid-impact-assessment")).toMatchObject({
      status: "DOES_NOT_APPLY",
      provisionalEffect: "EXCLUDE",
    });
    expect(evaluation.specialLawEvaluations[0].status).toBe("ACTIVE");
    expect(decision(evaluation, "building-permit").provisionalEffect).not.toBe("EXCLUDE");
  });

  it("does not apply the non-capital grid exemption to a capital-region data center", () => {
    const evaluation = evaluateProject(
      answers({
        assessmentDate: "2027-03-10",
        province: "경기도",
        city: "고양시",
        appliedSpecialLawIds: ["AIDC_GRID_IMPACT_EXEMPTION"],
      }),
    );

    expect(decision(evaluation, "power-grid-impact-assessment")).toMatchObject({
      status: "APPLIES",
      provisionalEffect: "INCLUDE",
    });
    expect(evaluation.specialLawEvaluations[0]).toMatchObject({
      id: "AIDC_GRID_IMPACT_EXEMPTION",
      status: "MISMATCH",
      statusLabel: "수도권 미해당",
    });
    expect(
      decision(evaluation, "power-grid-impact-assessment").matchedRuleIds,
    ).not.toContain("rule-aidc-grid-impact-exemption");
  });

  it("adds the separate port-hinterland entry contract only after the location special case takes effect", () => {
    const beforeEffective = evaluateProject(
      answers({
        assessmentDate: "2027-03-09",
        appliedSpecialLawIds: ["AIDC_PORT_HINTERLAND_ENTRY"],
      }),
    );
    expect(beforeEffective.specialLawEvaluations[0]).toMatchObject({
      id: "AIDC_PORT_HINTERLAND_ENTRY",
      status: "FUTURE",
    });
    expect(decision(beforeEffective, "port-hinterland-entry-contract")).toMatchObject({
      status: "DOES_NOT_APPLY",
      provisionalEffect: "EXCLUDE",
    });

    const afterEffective = evaluateProject(
      answers({
        assessmentDate: "2027-03-10",
        appliedSpecialLawIds: ["AIDC_PORT_HINTERLAND_ENTRY"],
      }),
    );
    expect(afterEffective.specialLawEvaluations[0]).toMatchObject({
      id: "AIDC_PORT_HINTERLAND_ENTRY",
      status: "ACTIVE",
      affectedProcedureIds: ["port-hinterland-entry-contract"],
    });
    expect(decision(afterEffective, "port-hinterland-entry-contract")).toMatchObject({
      status: "APPLIES",
      provisionalEffect: "INCLUDE",
      procedure: {
        receivingAuthority: "해당 1종 항만배후단지 관리기관",
        citationIds: expect.arrayContaining([
          "cit-port-act-71-entry-contract",
          "cit-port-act-decree-72-3-duration",
        ]),
      },
    });
    expect(
      decision(afterEffective, "port-hinterland-entry-contract").traces
        .flatMap((trace) => trace.citationIds),
    ).toContain("cit-aidc-special-act-23");
    expect(
      catalog.durations.find(
        (item) => item.procedureId === "port-hinterland-entry-contract",
      ),
    ).toMatchObject({
      elapsed: { min: null, base: null, max: 7, unit: "BUSINESS_DAY" },
      evidenceType: "STATUTE",
      planningBasis: "OFFICIAL_CAP_ONLY",
      citationIds: expect.arrayContaining([
        "cit-port-act-decree-72-3-duration",
        "cit-civil-petitions-act-19-time-calculation",
      ]),
    });
    const order = afterEffective.schedules.TYPICAL.topologicalOrder;
    expect(order.indexOf("port-hinterland-entry-contract")).toBeLessThan(
      order.indexOf("building-permit"),
    );
  });

  it.each([null, false] as const)(
    "does not apply a selected exemption when facility qualification is %s",
    (aiDataCenterActFacilityConfirmed) => {
      const evaluation = evaluateProject(
        answers({
          assessmentDate: "2027-03-10",
          aiDataCenterActFacilityConfirmed,
          appliedSpecialLawIds: ["AIDC_GRID_IMPACT_EXEMPTION"],
        }),
      );

      expect(decision(evaluation, "power-grid-impact-assessment").provisionalEffect).toBe("INCLUDE");
      expect(evaluation.specialLawEvaluations[0].status).toBe(
        aiDataCenterActFacilityConfirmed === null ? "UNCONFIRMED" : "MISMATCH",
      );
    },
  );

  it("keeps the report while one-stop treatment is planned and routes affected permits after the application", () => {
    const evaluation = evaluateProject(
      answers({
        assessmentDate: "2027-04-01",
        energyUsePlanRequired: true,
        trafficImpactAssessmentRequired: true,
        landscapeReviewRequired: true,
        buildingCommitteeReviewRequired: true,
        fireFacilityWork: true,
        aiDataCenterOneStopStatus: "PLANNED",
        appliedSpecialLawIds: ["AIDC_ONE_STOP"],
      }),
    );

    expect(decision(evaluation, "ai-data-center-business-report").provisionalEffect).toBe("INCLUDE");
    expect(decision(evaluation, "ai-data-center-business-report").isDeemed).toBe(false);
    expect(decision(evaluation, "ai-data-center-one-stop-application").provisionalEffect).toBe("INCLUDE");
    expect(decision(evaluation, "power-grid-impact-assessment").provisionalEffect).toBe("INCLUDE");
    expect(decision(evaluation, "power-grid-impact-assessment").specialLawImpacts?.[0]).toMatchObject({
      effect: "ONE_STOP",
      statutoryCap: expect.stringContaining("150일"),
      citationIds: expect.arrayContaining(["cit-aidc-special-act-18-9"]),
    });
    expect(
      decision(evaluation, "power-grid-impact-assessment").specialLawImpacts?.[0]
        .statutoryCap,
    ).toContain("거부 통지가 없으면");
    expect(
      decision(evaluation, "power-grid-impact-assessment").specialLawImpacts?.[0]
        .statutoryCap,
    ).toContain("1회 30일 이내 연장");
    expect(decision(evaluation, "energy-use-plan-consultation").specialLawImpacts?.[0].statutoryCap).toContain("90일");
    expect(decision(evaluation, "landscape-review").specialLawImpacts?.[0].statutoryCap).toContain("90일");
    expect(decision(evaluation, "building-committee-review").specialLawImpacts?.[0].statutoryCap).toContain("90일");
    expect(decision(evaluation, "building-permit").specialLawImpacts?.[0].statutoryCap).toContain("40일");
    const order = evaluation.schedules.TYPICAL.topologicalOrder;
    expect(order.indexOf("ai-data-center-one-stop-application")).toBeLessThan(
      order.indexOf("power-grid-impact-assessment"),
    );
  });

  it("deems the report only after one-stop processing is completed", () => {
    const evaluation = evaluateProject(
      answers({
        assessmentDate: "2027-04-01",
        aiDataCenterOneStopStatus: "COMPLETED",
        appliedSpecialLawIds: ["AIDC_ONE_STOP"],
      }),
    );

    expect(decision(evaluation, "ai-data-center-one-stop-result").provisionalEffect).toBe("INCLUDE");
    expect(decision(evaluation, "ai-data-center-business-report")).toMatchObject({
      provisionalEffect: "EXCLUDE",
      isDeemed: true,
    });
    expect(decision(evaluation, "ai-data-center-business-report").specialLawImpacts?.[0]).toMatchObject({
      effect: "DEEMED_REPORT",
    });
  });

  it("keeps the general grid-review cap separate from the selected AIDC one-stop impact", () => {
    const procedure = catalog.procedures.find(
      (item) => item.id === "power-grid-impact-assessment",
    );
    const duration = catalog.durations.find(
      (item) => item.id === "duration-power-grid-impact-assessment",
    );
    const durationCitation = catalog.citations.find(
      (item) => item.id === "cit-distributed-energy-act-24-duration",
    );

    expect(procedure).toMatchObject({
      receivingAuthority: "기후에너지환경부",
      consultationAuthorities: expect.arrayContaining(["전력정책심의회"]),
      citationIds: expect.arrayContaining([
        "cit-distributed-energy-act-24-process",
        "cit-distributed-energy-act-24-duration",
      ]),
    });
    expect(procedure?.citationIds.some((id) => id.startsWith("cit-aidc-"))).toBe(false);
    expect(procedure?.consultationAuthorities).not.toContain("전기위원회");
    expect(duration).toMatchObject({
      elapsed: null,
      authorityProcessing: { min: null, base: null, max: 3, unit: "MONTH" },
      evidenceType: "STATUTE",
      statutoryPeriod: expect.stringContaining("평가서 접수일부터 3개월 이내"),
      planningBasis: "OFFICIAL_CAP_ONLY",
    });
    expect(duration?.statutoryPeriod).not.toContain("150일");
    expect(duration?.citationIds.some((id) => id.startsWith("cit-aidc-"))).toBe(false);
    expect(duration?.assumptions).toContain(
      "3개월은 통상 소요기간이 아니라 일반 경로의 법정 처리상한입니다.",
    );
    expect(durationCitation).toMatchObject({
      article: "제24조",
      paragraph: "제6항",
      role: "DURATION",
    });
  });

  it("removes factory-only approval and completion paths for the AIDC service profile", () => {
    for (const assessmentDate of ["2025-01-01", "2026-08-21"]) {
      const evaluation = evaluateProject(answers({ assessmentDate }));
      for (const procedureId of [
        "factory-establishment-approval",
        "factory-completion-report-complex",
        "factory-completion-report-offsite",
        "small-factory-registration",
      ]) {
        const result = decision(evaluation, procedureId);
        expect(result.provisionalEffect, `${assessmentDate}:${procedureId}`).toBe("EXCLUDE");
        expect(result.matchedRuleIds, `${assessmentDate}:${procedureId}`).toContain(
          `rule-aidc-exclude-${procedureId}`,
        );
        expect(
          result.traces.flatMap((trace) => trace.citationIds),
          `${assessmentDate}:${procedureId}`,
        ).toContain("cit-indcluster-2-1-factory-definition");
      }
    }
  });

  it("does not use the AIDC industry profile to exclude environmental or safety permits", () => {
    const evaluation = evaluateProject(
      answers({
        assessmentDate: "2026-08-21",
        airEmissionFacility: true,
        waterDischargeFacility: true,
        integratedEnvironmentalPermitTarget: false,
        hazardousMaterials: true,
        highPressureGas: true,
      }),
    );

    for (const procedureId of [
      "air-emission-installation-permit",
      "water-discharge-installation-permit",
      "hazardous-materials-facility-installation-permit",
      "high-pressure-gas-manufacture-storage-permit-report",
    ]) {
      const result = decision(evaluation, procedureId);
      expect(result.provisionalEffect, procedureId).not.toBe("EXCLUDE");
      expect(
        result.matchedRuleIds.some((ruleId) => ruleId.startsWith("rule-aidc-exclude-")),
        procedureId,
      ).toBe(false);
    }
  });

  it("does not apply an AIDC selection to another industry", () => {
    const evaluation = evaluateProject(
      answers({
        assessmentDate: "2027-04-01",
        industryCategory: "SEMICONDUCTOR_ELECTRONICS",
        appliedSpecialLawIds: ["AIDC_GRID_IMPACT_EXEMPTION"],
      }),
    );

    expect(evaluation.specialLawEvaluations[0].status).toBe("MISMATCH");
    expect(decision(evaluation, "power-grid-impact-assessment").provisionalEffect).toBe("INCLUDE");
  });

  it("does not expose AIDC citations in a post-effective non-AIDC legal-view decision set", () => {
    const evaluation = evaluateProject(
      answers({
        assessmentDate: "2027-04-01",
        industryCategory: "SEMICONDUCTOR_ELECTRONICS",
        aiDataCenterActFacilityConfirmed: null,
        aiDataCenterOneStopStatus: "NOT_APPLIED",
        appliedSpecialLawIds: [],
        gridImpactAssessmentRequired: true,
        landscapeReviewRequired: true,
        buildingCommitteeReviewRequired: true,
      }),
    );
    const legalViewDecisions = evaluation.decisions.filter(
      (item) => item.provisionalEffect !== "EXCLUDE" || item.specialLawImpacts?.length,
    );
    const visibleCitationIds = legalViewDecisions.flatMap((item) => [
      ...item.procedure.citationIds,
      ...item.traces.flatMap((trace) => trace.citationIds),
      ...(item.specialLawImpacts ?? []).flatMap((impact) => impact.citationIds),
    ]);

    expect(visibleCitationIds.some((id) => id.startsWith("cit-aidc-"))).toBe(false);
    expect(
      decision(evaluation, "power-grid-impact-assessment").traces.map(
        (trace) => trace.ruleId,
      ),
    ).not.toContain("rule-aidc-grid-impact-exemption");
  });
});

describe("port and free-trade-zone manufacturing entry contracts", () => {
  it("keeps factory approval separate from an eligible Port Act contract and folds an overlapping industrial contract", () => {
    const evaluation = evaluateProject(
      answers({
        assessmentDate: "2026-08-24",
        industryCategory: "GENERAL_MANUFACTURING",
        insideIndustrialComplex: true,
        industrialComplexOccupancyContractStatus: "COMPLETED",
        entryContractRegime: "PORT_ACT",
        entryEligibilityConfirmed: true,
        entryContractStatus: "PLANNED",
      }),
    );

    expect(decision(evaluation, "port-hinterland-entry-contract")).toMatchObject({
      status: "APPLIES",
      provisionalEffect: "INCLUDE",
      isDeemed: false,
    });
    expect(
      decision(evaluation, "port-hinterland-entry-contract").procedure
        .citationIds,
    ).not.toContain("cit-aidc-special-act-23");
    expect(decision(evaluation, "industrial-complex-occupancy-contract")).toMatchObject({
      status: "DOES_NOT_APPLY",
      provisionalEffect: "EXCLUDE",
    });
    expect(decision(evaluation, "factory-establishment-approval")).toMatchObject({
      provisionalEffect: "INCLUDE",
      isDeemed: false,
    });
  });

  it.each([null, false] as const)(
    "does not remove the industrial contract when Port Act eligibility is %s",
    (entryEligibilityConfirmed) => {
      const evaluation = evaluateProject(
        answers({
          assessmentDate: "2026-08-24",
          industryCategory: "GENERAL_MANUFACTURING",
          insideIndustrialComplex: true,
          entryContractRegime: "PORT_ACT",
          entryEligibilityConfirmed,
        }),
      );

      expect(
        decision(evaluation, "industrial-complex-occupancy-contract")
          .provisionalEffect,
      ).not.toBe("EXCLUDE");
      expect(
        decision(evaluation, "port-hinterland-entry-contract")
          .provisionalEffect,
      ).not.toBe("INCLUDE");
    },
  );

  it("uses the dedicated FTZ completion route and deems factory approval only after completed, evidenced entry", () => {
    const planned = evaluateProject(
      answers({
        assessmentDate: "2026-08-24",
        industryCategory: "GENERAL_MANUFACTURING",
        insideIndustrialComplex: true,
        entryContractRegime: "FREE_TRADE_ZONE_ACT",
        entryEligibilityConfirmed: true,
        entryContractStatus: "PLANNED",
        entryContractEvidence: "",
      }),
    );
    expect(decision(planned, "free-trade-zone-entry-contract").provisionalEffect).toBe("INCLUDE");
    expect(decision(planned, "factory-establishment-approval").isDeemed).toBe(false);

    const completed = evaluateProject(
      answers({
        assessmentDate: "2026-08-24",
        industryCategory: "GENERAL_MANUFACTURING",
        insideIndustrialComplex: true,
        entryContractRegime: "FREE_TRADE_ZONE_ACT",
        entryEligibilityConfirmed: true,
        entryContractStatus: "COMPLETED",
        entryZoneName: "부산항 자유무역지역",
        entryManagingAuthority: "부산항만공사",
        entryContractEvidence: "입주계약 제2026-100호",
      }),
    );
    expect(decision(completed, "factory-establishment-approval")).toMatchObject({
      status: "DOES_NOT_APPLY",
      provisionalEffect: "EXCLUDE",
      isDeemed: true,
    });
    expect(decision(completed, "factory-completion-report-free-trade-zone").provisionalEffect).toBe("INCLUDE");
    expect(decision(completed, "factory-completion-report-complex").provisionalEffect).toBe("EXCLUDE");
    expect(decision(completed, "factory-completion-report-offsite").provisionalEffect).toBe("EXCLUDE");
  });

  it("has no FTZ include/exclude dead zone at the current Act effective edge", () => {
    const evaluation = evaluateProject(
      answers({
        assessmentDate: "2026-01-02",
        industryCategory: "GENERAL_MANUFACTURING",
        insideIndustrialComplex: true,
        entryContractRegime: "FREE_TRADE_ZONE_ACT",
        entryEligibilityConfirmed: true,
      }),
    );

    expect(decision(evaluation, "free-trade-zone-entry-contract").provisionalEffect).toBe("INCLUDE");
    expect(decision(evaluation, "industrial-complex-occupancy-contract").provisionalEffect).toBe("EXCLUDE");
  });
});

describe("industry, industrial-complex, and regional special-law routing", () => {
  it.each([
    {
      lawId: "SEMICONDUCTOR_CLUSTER_PLAN_DEEMING" as const,
      overrides: {
        industryCategory: "SEMICONDUCTOR_ELECTRONICS",
        semiconductorClusterPlanDeemingConfirmed: true,
        semiconductorClusterPlanDocumentsIncluded: true,
        semiconductorClusterPlanConsultationCompleted: true,
        semiconductorClusterPlanApprovalPublished: true,
        semiconductorClusterPlanApprovalPublishedDate: "2026-08-20",
        semiconductorClusterPlanApprovalNoticeReference: "산업통상부고시 제2026-1호",
        semiconductorClusterPlanIncludedPermitIds: ["__forged-plan-permit__"],
      },
    },
    {
      lawId: "INDUSTRIAL_COMPLEX_PLAN_INTEGRATED_APPROVAL" as const,
      overrides: {
        industryCategory: "GENERAL_MANUFACTURING",
        industrialComplexPlanSpecialCaseConfirmed: true,
        industrialComplexPlanDocumentsIncluded: true,
        industrialComplexPlanConsultationCompleted: true,
        industrialComplexPlanApprovalPublished: true,
        industrialComplexPlanApprovalPublishedDate: "2026-08-20",
        industrialComplexPlanApprovalNoticeReference: "충청남도고시 제2026-1호",
        industrialComplexPlanIncludedPermitIds: ["__forged-plan-permit__"],
      },
    },
    {
      lawId: "REGIONAL_SPECIAL_ZONE_PLAN_DEEMING" as const,
      overrides: {
        industryCategory: "GENERAL_MANUFACTURING",
        regionalSpecialZonePlanDeemingConfirmed: true,
        regionalSpecialZonePlanDocumentsIncluded: true,
        regionalSpecialZonePlanConsultationCompleted: true,
        regionalSpecialZonePlanApprovalPublished: true,
        regionalSpecialZonePlanApprovalPublishedDate: "2026-08-20",
        regionalSpecialZonePlanApprovalNoticeReference: "중소벤처기업부고시 제2026-1호",
        regionalSpecialZonePlanIncludedPermitIds: ["__forged-plan-permit__"],
      },
    },
  ])(
    "rejects an injected invalid-only permit list for $lawId",
    ({ lawId, overrides }) => {
      const evaluation = evaluateProject(
        answers({
          aiDataCenterActFacilityConfirmed: null,
          advancedStrategicIndustryFastTrackConfirmed: false,
          semiconductorClusterFastTrackConfirmed: false,
          ...overrides,
        }),
      );
      const tokens = evaluation.input.strategicIndustrySpecialCase.value;
      const tokenList = Array.isArray(tokens) ? tokens : [];

      expect(
        evaluation.specialLawEvaluations.find((item) => item.id === lawId),
      ).toMatchObject({ status: "UNCONFIRMED" });
      expect(tokenList).not.toContain(lawId);
      expect(tokenList).not.toContain(`${lawId}:__forged-plan-permit__`);
      expect(evaluation.decisions.some((item) => item.isDeemed)).toBe(false);
    },
  );

  it("shows semiconductor fast tracks as candidates without changing procedures before qualification is confirmed", () => {
    const evaluation = evaluateProject(
      answers({
        industryCategory: "SEMICONDUCTOR_ELECTRONICS",
        aiDataCenterActFacilityConfirmed: null,
        semiconductorClusterFastTrackConfirmed: null,
        advancedStrategicIndustryFastTrackConfirmed: null,
        regionalSpecialZonePlanDeemingConfirmed: false,
      }),
    );

    expect(evaluation.specialLawEvaluations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK",
        status: "UNCONFIRMED",
      }),
      expect.objectContaining({
        id: "SEMICONDUCTOR_CLUSTER_FAST_TRACK",
        status: "UNCONFIRMED",
      }),
    ]));
    expect(decision(evaluation, "advanced-strategic-industry-fast-track-request").status).not.toBe("DOES_NOT_APPLY");
    expect(decision(evaluation, "semiconductor-cluster-fast-track-request").status).not.toBe("DOES_NOT_APPLY");
    expect(decision(evaluation, "semiconductor-cluster-plan-application").status).not.toBe("DOES_NOT_APPLY");
    expect(decision(evaluation, "building-permit").specialLawImpacts ?? []).toEqual([]);
  });

  it.each([
    {
      label: "hidden qualification inputs are unanswered",
      overrides: {},
    },
    {
      label: "a previously imported scenario retains confirmed special-law inputs",
      overrides: {
        advancedStrategicIndustryFastTrackConfirmed: true,
        advancedStrategicIndustryApplicantRoleConfirmed: true,
        advancedStrategicIndustryDelayRiskConfirmed: true,
        advancedStrategicIndustryCommitteeResolved: true,
        advancedStrategicIndustryMinisterRequestDate: "2026-08-15",
        advancedStrategicIndustryFastTrackPermitIds: ["building-permit"],
        semiconductorClusterFastTrackConfirmed: true,
        semiconductorClusterApplicantRoleConfirmed: true,
        semiconductorClusterDelayRiskConfirmed: true,
        semiconductorClusterCommitteeResolved: true,
        semiconductorClusterMinisterRequestDate: "2026-08-15",
        semiconductorClusterFastTrackPermitIds: ["building-permit"],
        semiconductorClusterPlanDeemingConfirmed: true,
        semiconductorClusterPlanDocumentsIncluded: true,
        semiconductorClusterPlanConsultationCompleted: true,
        semiconductorClusterPlanApprovalPublished: true,
        semiconductorClusterPlanApprovalPublishedDate: "2026-08-20",
        semiconductorClusterPlanApprovalNoticeReference: "산업통상부고시 제2026-100호",
        semiconductorClusterPlanIncludedPermitIds: ["building-permit"],
      } satisfies Partial<ScenarioAnswers>,
    },
  ])("excludes industry-specific special-law procedures for wood manufacturing when $label", ({ overrides }) => {
    const evaluation = evaluateProject(
      answers({
        industryCategory: "WOOD_PAPER_PRINTING",
        aiDataCenterActFacilityConfirmed: null,
        industrialComplexPlanSpecialCaseConfirmed: false,
        regionalSpecialZonePlanDeemingConfirmed: false,
        ...overrides,
      }),
    );

    const industrySpecificProcedureIds = [
      "advanced-strategic-industry-fast-track-request",
      "advanced-strategic-industry-fast-track-result-check",
      "semiconductor-cluster-fast-track-request",
      "semiconductor-cluster-fast-track-result-check",
      "semiconductor-cluster-plan-application",
      "semiconductor-cluster-plan-consultation",
      "semiconductor-cluster-plan-approval",
    ];
    for (const procedureId of industrySpecificProcedureIds) {
      const result = decision(evaluation, procedureId);
      expect(result).toMatchObject({
        status: "DOES_NOT_APPLY",
        provisionalEffect: "EXCLUDE",
        missingInputs: [],
      });
      expect(procedureCategoryForDecision(result)).toBe("NOT_REQUIRED");
    }
    expect(evaluation.specialLawEvaluations.map((item) => item.id)).not.toEqual(
      expect.arrayContaining([
        "ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK",
        "SEMICONDUCTOR_CLUSTER_FAST_TRACK",
        "SEMICONDUCTOR_CLUSTER_PLAN_DEEMING",
      ]),
    );
  });

  it("adds the semiconductor 60-day processing-completion review only after exact request facts are confirmed", () => {
    const scenario = answers({
        assessmentDate: "2026-08-21",
        industryCategory: "SEMICONDUCTOR_ELECTRONICS",
        aiDataCenterActFacilityConfirmed: null,
        semiconductorClusterFastTrackConfirmed: true,
        semiconductorClusterApplicantRoleConfirmed: true,
        semiconductorClusterDelayRiskConfirmed: true,
        semiconductorClusterCommitteeResolved: true,
        semiconductorClusterMinisterRequestDate: "2026-08-15",
        semiconductorClusterFastTrackPermitIds: ["building-permit"],
        advancedStrategicIndustryFastTrackConfirmed: false,
        regionalSpecialZonePlanDeemingConfirmed: false,
      });
    const evaluation = evaluateProject(scenario);
    const ordinarySchedule = evaluateProject({
      ...scenario,
      semiconductorClusterFastTrackConfirmed: false,
    }).schedules.TYPICAL;

    expect(evaluation.specialLawEvaluations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "SEMICONDUCTOR_CLUSTER_FAST_TRACK",
        status: "ACTIVE",
      }),
    ]));
    expect(decision(evaluation, "building-permit").specialLawImpacts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        lawId: "SEMICONDUCTOR_CLUSTER_FAST_TRACK",
        effect: "FAST_TRACK",
        statutoryCap: expect.stringContaining("60일"),
        citationIds: expect.arrayContaining(["cit-semiconductor-special-act-27-deeming"]),
      }),
    ]));
    expect(decision(evaluation, "building-permit").provisionalEffect).toBe("INCLUDE");
    expect(evaluation.schedules.TYPICAL.projectTimeline?.minimumKnownCompletionDate).toBe(
      ordinarySchedule.projectTimeline?.minimumKnownCompletionDate,
    );
    expect(evaluation.schedules.TYPICAL.projectTimeline?.operationReadyDate).toBe(
      ordinarySchedule.projectTimeline?.operationReadyDate,
    );
    expect(evaluation.schedules.TYPICAL.projectTimeline?.unknownPlanningDurationProcedureIds).toContain(
      "semiconductor-cluster-fast-track-result-check",
    );
  });

  it("does not activate the semiconductor special Act before its effective date", () => {
    const evaluation = evaluateProject(
      answers({
        assessmentDate: "2026-08-10",
        industryCategory: "SEMICONDUCTOR_ELECTRONICS",
        aiDataCenterActFacilityConfirmed: null,
        semiconductorClusterFastTrackConfirmed: true,
        advancedStrategicIndustryFastTrackConfirmed: false,
        regionalSpecialZonePlanDeemingConfirmed: false,
      }),
    );

    expect(evaluation.specialLawEvaluations.find(
      (item) => item.id === "SEMICONDUCTOR_CLUSTER_FAST_TRACK",
    )?.status).toBe("FUTURE");
    expect(decision(evaluation, "building-permit").specialLawImpacts ?? []).toEqual([]);
  });

  it("marks only confirmed industrial-complex-plan and regional-plan permits as deemed", () => {
    const evaluation = evaluateProject(
      answers({
        industryCategory: "GENERAL_MANUFACTURING",
        aiDataCenterActFacilityConfirmed: null,
        insideIndustrialComplex: true,
        landCategory: "FARMLAND",
        industrialComplexPlanSpecialCaseConfirmed: true,
        industrialComplexPlanDocumentsIncluded: true,
        industrialComplexPlanConsultationCompleted: true,
        industrialComplexPlanApprovalPublished: true,
        industrialComplexPlanApprovalPublishedDate: "2026-08-20",
        industrialComplexPlanApprovalNoticeReference: "충청남도고시 제2026-100호",
        industrialComplexPlanIncludedPermitIds: ["building-permit", "farmland-conversion-permit"],
        regionalSpecialZonePlanDeemingConfirmed: true,
        regionalSpecialZonePlanDocumentsIncluded: true,
        regionalSpecialZonePlanConsultationCompleted: true,
        regionalSpecialZonePlanApprovalPublished: true,
        regionalSpecialZonePlanApprovalPublishedDate: "2026-08-20",
        regionalSpecialZonePlanApprovalNoticeReference: "중소벤처기업부고시 제2026-200호",
        regionalSpecialZonePlanIncludedPermitIds: ["farmland-conversion-permit"],
      }),
    );

    expect(decision(evaluation, "building-permit").specialLawImpacts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        lawId: "INDUSTRIAL_COMPLEX_PLAN_INTEGRATED_APPROVAL",
        effect: "INTEGRATED_APPROVAL",
        statutoryCap: expect.stringContaining("6개월"),
      }),
    ]));
    expect(decision(evaluation, "farmland-conversion-permit").specialLawImpacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ lawId: "INDUSTRIAL_COMPLEX_PLAN_INTEGRATED_APPROVAL" }),
      expect.objectContaining({
        lawId: "REGIONAL_SPECIAL_ZONE_PLAN_DEEMING",
        article: "제64조·제65조",
        citationIds: ["cit-regional-special-zone-act-64-65"],
      }),
    ]));
    expect(decision(evaluation, "farmland-conversion-permit")).toMatchObject({
      status: "DOES_NOT_APPLY",
      provisionalEffect: "EXCLUDE",
      isDeemed: true,
    });
  });

  it("activates the national strategic-industry fast track for a confirmed battery-specialized-complex project", () => {
    const evaluation = evaluateProject(
      answers({
        industryCategory: "SECONDARY_BATTERY_CHEMICAL",
        aiDataCenterActFacilityConfirmed: null,
        advancedStrategicIndustryFastTrackConfirmed: true,
        advancedStrategicIndustryApplicantRoleConfirmed: true,
        advancedStrategicIndustryDelayRiskConfirmed: true,
        advancedStrategicIndustryCommitteeResolved: true,
        advancedStrategicIndustryMinisterRequestDate: "2026-08-15",
        advancedStrategicIndustryFastTrackPermitIds: ["building-permit"],
        regionalSpecialZonePlanDeemingConfirmed: false,
      }),
    );

    expect(evaluation.specialLawEvaluations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK",
        status: "ACTIVE",
      }),
    ]));
    expect(decision(evaluation, "building-permit").specialLawImpacts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        lawId: "ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK",
        effect: "FAST_TRACK",
      }),
    ]));
  });

  it("uses the 2023-07-01 strategic-industry effective date and rejects pre-effective minister requests for both fast tracks", () => {
    const postEffective = evaluateProject(
      answers({
        assessmentDate: "2024-01-15",
        industryCategory: "SECONDARY_BATTERY_CHEMICAL",
        aiDataCenterActFacilityConfirmed: null,
        advancedStrategicIndustryFastTrackConfirmed: true,
        advancedStrategicIndustryApplicantRoleConfirmed: true,
        advancedStrategicIndustryDelayRiskConfirmed: true,
        advancedStrategicIndustryCommitteeResolved: true,
        advancedStrategicIndustryMinisterRequestDate: "2023-12-15",
        advancedStrategicIndustryFastTrackPermitIds: ["building-permit"],
        regionalSpecialZonePlanDeemingConfirmed: false,
      }),
    );
    expect(
      postEffective.specialLawEvaluations.find(
        (item) => item.id === "ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK",
      ),
    ).toMatchObject({ status: "ACTIVE", effectiveFrom: "2023-07-01" });
    expect(
      decision(postEffective, "advanced-strategic-industry-fast-track-request").status,
    ).toBe("APPLIES");

    const advancedPreEffectiveRequest = evaluateProject(
      answers({
        assessmentDate: "2026-08-21",
        industryCategory: "SECONDARY_BATTERY_CHEMICAL",
        aiDataCenterActFacilityConfirmed: null,
        advancedStrategicIndustryFastTrackConfirmed: true,
        advancedStrategicIndustryApplicantRoleConfirmed: true,
        advancedStrategicIndustryDelayRiskConfirmed: true,
        advancedStrategicIndustryCommitteeResolved: true,
        advancedStrategicIndustryMinisterRequestDate: "2023-06-30",
        advancedStrategicIndustryFastTrackPermitIds: ["building-permit"],
        regionalSpecialZonePlanDeemingConfirmed: false,
      }),
    );
    expect(
      advancedPreEffectiveRequest.specialLawEvaluations.find(
        (item) => item.id === "ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK",
      ),
    ).toMatchObject({ status: "UNCONFIRMED" });
    expect(
      decision(
        advancedPreEffectiveRequest,
        "advanced-strategic-industry-fast-track-request",
      ).status,
    ).toBe("DOES_NOT_APPLY");

    const semiconductorPreEffectiveRequest = evaluateProject(
      answers({
        assessmentDate: "2026-08-21",
        industryCategory: "SEMICONDUCTOR_ELECTRONICS",
        aiDataCenterActFacilityConfirmed: null,
        semiconductorClusterFastTrackConfirmed: true,
        semiconductorClusterApplicantRoleConfirmed: true,
        semiconductorClusterDelayRiskConfirmed: true,
        semiconductorClusterCommitteeResolved: true,
        semiconductorClusterMinisterRequestDate: "2026-08-10",
        semiconductorClusterFastTrackPermitIds: ["building-permit"],
        advancedStrategicIndustryFastTrackConfirmed: false,
        regionalSpecialZonePlanDeemingConfirmed: false,
      }),
    );
    expect(
      semiconductorPreEffectiveRequest.specialLawEvaluations.find(
        (item) => item.id === "SEMICONDUCTOR_CLUSTER_FAST_TRACK",
      ),
    ).toMatchObject({ status: "UNCONFIRMED" });
    expect(
      decision(
        semiconductorPreEffectiveRequest,
        "semiconductor-cluster-fast-track-request",
      ).status,
    ).toBe("DOES_NOT_APPLY");
  });

  it("does not activate a fast track for a future request date or an unlisted permit", () => {
    const futureRequest = evaluateProject(
      answers({
        assessmentDate: "2026-08-21",
        industryCategory: "SECONDARY_BATTERY_CHEMICAL",
        aiDataCenterActFacilityConfirmed: null,
        advancedStrategicIndustryFastTrackConfirmed: true,
        advancedStrategicIndustryApplicantRoleConfirmed: true,
        advancedStrategicIndustryDelayRiskConfirmed: true,
        advancedStrategicIndustryCommitteeResolved: true,
        advancedStrategicIndustryMinisterRequestDate: "2026-08-22",
        advancedStrategicIndustryFastTrackPermitIds: ["building-permit"],
        regionalSpecialZonePlanDeemingConfirmed: false,
      }),
    );
    expect(futureRequest.specialLawEvaluations.find(
      (item) => item.id === "ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK",
    )).toMatchObject({ status: "UNCONFIRMED" });
    expect(decision(futureRequest, "building-permit").specialLawImpacts ?? []).toEqual([]);
    expect(
      decision(futureRequest, "advanced-strategic-industry-fast-track-request"),
    ).toMatchObject({
      status: "DOES_NOT_APPLY",
      provisionalEffect: "EXCLUDE",
    });
    expect(
      decision(futureRequest, "advanced-strategic-industry-fast-track-result-check"),
    ).toMatchObject({
      status: "DOES_NOT_APPLY",
      provisionalEffect: "EXCLUDE",
    });

    const selectedOnly = evaluateProject(
      answers({
        assessmentDate: "2026-08-21",
        industryCategory: "SECONDARY_BATTERY_CHEMICAL",
        aiDataCenterActFacilityConfirmed: null,
        advancedStrategicIndustryFastTrackConfirmed: true,
        advancedStrategicIndustryApplicantRoleConfirmed: true,
        advancedStrategicIndustryDelayRiskConfirmed: true,
        advancedStrategicIndustryCommitteeResolved: true,
        advancedStrategicIndustryMinisterRequestDate: "2026-08-15",
        advancedStrategicIndustryFastTrackPermitIds: ["building-permit"],
        regionalSpecialZonePlanDeemingConfirmed: false,
      }),
    );
    expect(decision(selectedOnly, "building-permit").specialLawImpacts).toHaveLength(1);
    expect(decision(selectedOnly, "farmland-conversion-permit").specialLawImpacts ?? []).toEqual([]);
  });
});
