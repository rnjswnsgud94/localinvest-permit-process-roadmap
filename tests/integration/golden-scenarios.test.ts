import { describe, expect, it } from "vitest";

import { catalog, type ScenarioAnswers } from "@/lib/data/catalog";
import { evaluateProject } from "@/lib/engine/pipeline";

describe("golden manufacturing scenarios", () => {
  it.each(catalog.scenarios.map((scenario) => [scenario.id, scenario.answers] as const))(
    "evaluates %s without conflicts or cycles",
    (_id, answers) => {
      const result = evaluateProject(answers);
      expect(result.decisions).toHaveLength(catalog.procedures.length);
      expect(result.decisions.flatMap((decision) => decision.conflictRuleIds)).toEqual([]);
      expect(result.schedules.TYPICAL.topologicalOrder.length).toBeGreaterThan(0);
      if (answers.plannedConstructionStartDate && answers.plannedConstructionEndDate) {
        expect(result.schedules.MIN.projectTimeline?.nodes.length).toBe(
          result.schedules.MIN.topologicalOrder.length,
        );
      } else {
        expect(result.schedules.MIN.projectTimeline).toBeNull();
      }
    },
  );

  it("switches mutually exclusive completion branches", () => {
    const complex = evaluateProject(catalog.scenarios[1].answers);
    const offsite = evaluateProject(catalog.scenarios[2].answers);
    const byId = (result: typeof complex, id: string) =>
      result.decisions.find((decision) => decision.procedure.id === id);
    expect(byId(complex, "factory-completion-report-complex")?.provisionalEffect).toBe("INCLUDE");
    expect(byId(complex, "factory-completion-report-offsite")?.provisionalEffect).toBe("EXCLUDE");
    expect(byId(offsite, "factory-completion-report-complex")?.provisionalEffect).toBe("EXCLUDE");
    expect(byId(offsite, "factory-completion-report-offsite")?.provisionalEffect).toBe("INCLUDE");
  });

  it("adds the capital-region factory restriction review only to covered factories", () => {
    const evaluate = (totalAreaM2: number, industryCategory = "GENERAL_MANUFACTURING") =>
      evaluateProject({
        ...catalog.scenarios[0].answers,
        province: "경기도",
        city: "고양시",
        insideIndustrialComplex: false,
        investmentType: "NEW",
        buildingAction: "NEW_BUILD",
        industryCategory,
        totalAreaM2,
        increaseAreaM2: totalAreaM2,
      });
    const capitalReview = (result: ReturnType<typeof evaluateProject>) =>
      result.decisions.find(
        (item) => item.procedure.id === "capital-region-factory-restriction-review",
      );

    expect(capitalReview(evaluate(500))).toMatchObject({
      status: "APPLIES",
      provisionalEffect: "INCLUDE",
      procedure: {
        citationIds: expect.arrayContaining([
          "cit-exp-capital-region-factory-restriction-review-planning-act",
          "cit-exp-capital-region-factory-restriction-review-planning-decree",
        ]),
      },
    });
    expect(capitalReview(evaluate(499))?.provisionalEffect).toBe("EXCLUDE");
    expect(capitalReview(evaluate(30_000, "AI_DATA_CENTER"))?.provisionalEffect).toBe("EXCLUDE");
  });

  it("keeps new capital-region site gates explicit and preserves nationwide site reviews", () => {
    const capitalOnlyTargets = [
      "capital-region-large-scale-development-review",
      "road-occupation-traffic-flow-plan-review",
    ] as const;
    const gyeonggiOnlyTargets = [
      "paldang-special-measures-zone-wastewater-location-review",
    ] as const;
    const nationwideSiteTargets = [
      "development-restriction-zone-action-permit",
      "airport-obstacle-limitation-consultation",
      "education-environment-protection-zone-review",
      "railway-protection-zone-action-report",
      "building-safety-impact-assessment",
      "fire-performance-based-design-review",
      "water-supply-factory-restriction-zone-review",
      "water-discharge-facility-restriction-zone-review",
      "han-river-riparian-zone-factory-location-review",
      "han-river-water-pollution-load-allocation",
    ] as const;
    const selectedTargets = [
      ...capitalOnlyTargets,
      ...gyeonggiOnlyTargets,
      ...nationwideSiteTargets,
      "road-occupation-permit",
    ] as const;
    const base = catalog.scenarios[0].answers;
    const capital = evaluateProject({
      ...base,
      province: "경기도",
      city: "용인시",
      insideIndustrialComplex: false,
      investmentType: "NEW",
      buildingAction: "NEW_BUILD",
      industryCategory: "GENERAL_MANUFACTURING",
      totalAreaM2: 100_000,
      increaseAreaM2: 100_000,
      siteDevelopmentAreaM2: 100_000,
      environmentalAssessmentType: "SMALL",
      localEnvironmentalAssessmentRequired: true,
      supplementalPermitReviewedIds: [
        ...new Set([...base.supplementalPermitReviewedIds, ...selectedTargets]),
      ],
      supplementalPermitTargetIds: [
        ...new Set([...base.supplementalPermitTargetIds, ...selectedTargets]),
      ],
    });
    const byId = (result: typeof capital, procedureId: string) =>
      result.decisions.find((item) => item.procedure.id === procedureId);

    for (const procedureId of [
      ...capitalOnlyTargets,
      ...gyeonggiOnlyTargets,
      ...nationwideSiteTargets,
    ]) {
      expect(byId(capital, procedureId), procedureId).toMatchObject({
        status: "APPLIES",
        provisionalEffect: "INCLUDE",
      });
    }
    expect(byId(capital, "local-environmental-impact-assessment")).toMatchObject({
      status: "APPLIES",
      provisionalEffect: "INCLUDE",
      traces: expect.arrayContaining([
        expect.objectContaining({
          ruleId: "rule-exp-local-environmental-impact-assessment-gyeonggi",
          citationIds: expect.arrayContaining([
          "cit-exp-local-environmental-impact-assessment-gyeonggi",
          ]),
        }),
      ]),
    });
    expect(byId(capital, "environmental-impact-assessment")?.provisionalEffect).toBe("EXCLUDE");
    expect(byId(capital, "small-environmental-impact-assessment")?.provisionalEffect).toBe("INCLUDE");

    const nonCapital = evaluateProject({
      ...base,
      province: "강원특별자치도",
      city: "춘천시",
      supplementalPermitReviewedIds: [
        ...new Set([...base.supplementalPermitReviewedIds, ...selectedTargets]),
      ],
      supplementalPermitTargetIds: [
        ...new Set([...base.supplementalPermitTargetIds, ...selectedTargets]),
      ],
    });
    for (const procedureId of capitalOnlyTargets) {
      expect(byId(nonCapital, procedureId)?.provisionalEffect, procedureId).toBe("EXCLUDE");
    }
    for (const procedureId of gyeonggiOnlyTargets) {
      expect(byId(nonCapital, procedureId)?.provisionalEffect, procedureId).toBe("EXCLUDE");
    }
    for (const procedureId of nationwideSiteTargets) {
      expect(byId(nonCapital, procedureId)?.provisionalEffect, procedureId).toBe("INCLUDE");
    }

    const legacyFactoryOnlyTargets = [
      "water-supply-factory-restriction-zone-review",
      "han-river-riparian-zone-factory-location-review",
    ] as const;
    const aiDataCenterWithLegacyFactoryTarget = evaluateProject({
      ...base,
      province: "경기도",
      city: "용인시",
      industryCategory: "AI_DATA_CENTER",
      supplementalPermitReviewedIds: [
        ...new Set<ScenarioAnswers["supplementalPermitReviewedIds"][number]>([
          ...base.supplementalPermitReviewedIds,
          ...legacyFactoryOnlyTargets,
        ]),
      ],
      supplementalPermitTargetIds: [
        ...new Set<ScenarioAnswers["supplementalPermitTargetIds"][number]>([
          ...base.supplementalPermitTargetIds,
          ...legacyFactoryOnlyTargets,
        ]),
      ],
    });
    for (const procedureId of legacyFactoryOnlyTargets) {
      expect(
        byId(aiDataCenterWithLegacyFactoryTarget, procedureId)?.provisionalEffect,
        procedureId,
      ).toBe("EXCLUDE");
    }
  });

  it("provides minimum, official-basis, and user-expected schedules", () => {
    const result = evaluateProject(catalog.scenarios[2].answers);
    expect(Object.keys(result.schedules).sort()).toEqual(["MIN", "TYPICAL", "USER"]);
    expect(result.schedules.MIN.total).toBeLessThanOrEqual(result.schedules.TYPICAL.total);
    expect(result.schedules.MIN.projectTimeline?.minimumKnownCalendarDays).toBeLessThanOrEqual(
      result.schedules.TYPICAL.projectTimeline?.minimumKnownCalendarDays ?? 0,
    );
  });

  it("evaluates a post-effective non-capital AI data-center one-stop roadmap without conflicts or cycles", () => {
    const result = evaluateProject({
      ...catalog.scenarios[0].answers,
      assessmentDate: "2027-04-01",
      plannedConstructionStartDate: "2028-01-01",
      plannedConstructionEndDate: "2030-12-31",
      province: "충청남도",
      city: "아산시",
      insideIndustrialComplex: false,
      investmentType: "NEW",
      industryCategory: "AI_DATA_CENTER",
      buildingAction: "NEW_BUILD",
      totalAreaM2: 40_000,
      aiDataCenterActFacilityConfirmed: true,
      aiDataCenterOneStopStatus: "PLANNED",
      appliedSpecialLawIds: ["AIDC_ONE_STOP"],
      gridImpactAssessmentRequired: true,
      energyUsePlanRequired: true,
      trafficImpactAssessmentRequired: true,
      landscapeReviewRequired: true,
      buildingCommitteeReviewRequired: true,
      fireFacilityWork: true,
    });

    expect(result.decisions.flatMap((decision) => decision.conflictRuleIds)).toEqual([]);
    expect(result.specialLawEvaluations[0]).toMatchObject({
      id: "AIDC_ONE_STOP",
      status: "ACTIVE",
    });
    const order = result.schedules.TYPICAL.topologicalOrder;
    expect(order.indexOf("ai-data-center-one-stop-application")).toBeLessThan(
      order.indexOf("building-permit"),
    );
    expect(result.schedules.TYPICAL.projectTimeline?.warnings.join(" ")).not.toContain("순환");
  });

  it("includes every selected maximum-coverage procedure in the automatic date schedule", () => {
    const maximumCoverageAnswers: ScenarioAnswers = {
      ...catalog.scenarios[2].answers,
      assessmentDate: "2026-08-20",
      plannedConstructionStartDate: "2026-09-01",
      plannedConstructionEndDate: "2028-08-31",
      insideIndustrialComplex: false,
      totalAreaM2: 50_000,
      mechanicalEquipmentActTarget: true,
      landCategory: "FARMLAND",
      demolitionRequired: true,
      roadConnectionRequired: true,
      trafficImpactAssessmentRequired: true,
      permitCoordination: "OTHER_GTE_20",
      environmentalAssessmentType: "ENVIRONMENTAL",
      integratedEnvironmentalPermitTarget: true,
      disasterImpactAssessmentType: "DISASTER_IMPACT",
      undergroundSafetyAssessmentType: "UNDERGROUND_SAFETY",
      nationalHeritageAssessmentType: "IMPACT_DIAGNOSIS",
      militaryProtectionConsultationRequired: true,
      riverOccupationRequired: true,
      publicWaterOccupationRequired: true,
      waterSourceProtectionZone: true,
      airEmissionFacility: true,
      waterDischargeFacility: true,
      noiseVibrationFacility: true,
      wasteFacility: true,
      chemicalsHandled: true,
      chemicalManufactureOrImport: true,
      hazardousChemicalBusiness: true,
      chemicalRegistrationRequired: true,
      restrictedOrToxicChemicalImport: true,
      hazardousMaterials: true,
      hazardousMaterialsTank: true,
      hazardousMaterialsPreventionRulesRequired: true,
      highPressureGas: true,
      specificHighPressureGasUse: true,
      lpgSpecificUseFacility: true,
      cityGasSpecificUseFacility: true,
      psmCovered: true,
      fireFacilityWork: true,
      fireSafetyManagerRequired: true,
      heatUseEquipment: true,
      hazardousMachineryInspectionRequired: true,
      safetyManagerRequired: true,
      healthManagerRequired: true,
      privateElectricalFacilityWork: true,
      energyUsePlanRequired: true,
      groundwaterDevelopment: true,
      publicSewerConnection: true,
      privateSewageTreatmentFacility: true,
      safetyManagementPlanRequired: true,
      specificWorkReportRequired: true,
      asbestosPresent: true,
      powerIncreaseMw: 100,
      waterDemandM3Day: 10_000,
      wastewaterM3Day: 10_000,
    };

    const result = evaluateProject(maximumCoverageAnswers);
    const minimum = result.schedules.MIN.projectTimeline;
    const typical = result.schedules.TYPICAL.projectTimeline;

    expect(result.decisions.filter((decision) => decision.provisionalEffect === "INCLUDE").length).toBeGreaterThan(50);
    expect(result.schedules.TYPICAL.topologicalOrder.length).toBeGreaterThan(70);
    expect(typical?.nodes).toHaveLength(result.schedules.TYPICAL.topologicalOrder.length);
    expect(typical?.nodes.filter((node) => node.processingDuration !== null).length).toBeGreaterThan(40);
    expect(typical?.minimumKnownCalendarDays).toBeGreaterThanOrEqual(minimum?.minimumKnownCalendarDays ?? 0);
    expect(typical?.minimumKnownCalendarDays).toBeGreaterThan(731);
    expect(typical?.warnings.join(" ")).not.toContain("역행");

    const typicalNode = (id: string) => typical?.nodes.find((node) => node.procedureId === id);
    expect(typicalNode("factory-establishment-approval")?.processingDuration).toBe(30);
    expect(typicalNode("building-permit")).toMatchObject({
      processingDuration: null,
      processingUpperBound: 70,
      durationPlanningBasis: "UNRESOLVED_OFFICIAL_BRANCH",
    });
    expect(typicalNode("disaster-impact-assessment-consultation")).toMatchObject({
      processingDuration: null,
      processingUpperBound: null,
      durationPlanningBasis: "UNRESOLVED_OFFICIAL_BRANCH",
      durationReferencePeriods: expect.arrayContaining([
        expect.objectContaining({
          range: expect.objectContaining({ max: 45 }),
        }),
      ]),
    });
  });

  it("calculates stable schedules across ten diverse factory-investment inputs", () => {
    const general = catalog.scenarios[0].answers;
    const semiconductor = catalog.scenarios[1].answers;
    const battery = catalog.scenarios[2].answers;
    const insufficient = catalog.scenarios[3].answers;
    const scenarios: Array<{ name: string; answers: ScenarioAnswers }> = [
      {
        name: "부산 기장 식품 산단 신설",
        answers: { ...general, province: "부산광역시", city: "기장군", industryCategory: "FOOD_BEVERAGE_TOBACCO", totalAreaM2: 999, increaseAreaM2: 999, plannedConstructionStartDate: "2025-01-01", plannedConstructionEndDate: "2025-12-31" },
      },
      {
        name: "충남 아산 화학 개별입지",
        answers: { ...battery, province: "충청남도", city: "아산시", industryCategory: "CHEMICAL_PRODUCTS", landCategory: "FARMLAND", totalAreaM2: 50_000, increaseAreaM2: 50_000, environmentalAssessmentType: "ENVIRONMENTAL", plannedConstructionStartDate: "2026-09-01", plannedConstructionEndDate: "2029-08-31" },
      },
      {
        name: "충북 청주 반도체 산단 증설",
        answers: { ...semiconductor, province: "충청북도", city: "청주시", plannedConstructionStartDate: "2027-01-01", plannedConstructionEndDate: "2028-12-31" },
      },
      {
        name: "경북 포항 철강 산지 개별입지",
        answers: { ...battery, province: "경상북도", city: "포항시", industryCategory: "PRIMARY_METAL", landCategory: "FOREST", totalAreaM2: 30_000, increaseAreaM2: 30_000, environmentalAssessmentType: "ENVIRONMENTAL", plannedConstructionStartDate: "2027-03-15", plannedConstructionEndDate: "2030-03-14" },
      },
      {
        name: "광주 자동차 산단 증설 과거 착공",
        answers: { ...semiconductor, province: "전남광주통합특별시", city: "광산구", industryCategory: "AUTOMOTIVE_MOBILITY", totalAreaM2: 24_000, increaseAreaM2: 9_000, integratedEnvironmentalPermitTarget: false, plannedConstructionStartDate: "2025-06-01", plannedConstructionEndDate: "2026-05-31" },
      },
      {
        name: "제주 서귀포 소규모 기계 개별입지",
        answers: { ...general, province: "제주특별자치도", city: "서귀포시", insideIndustrialComplex: false, industryCategory: "MACHINERY_EQUIPMENT", totalAreaM2: 499, increaseAreaM2: 499, permitCoordination: "NONE", plannedConstructionStartDate: "2026-09-01", plannedConstructionEndDate: "2026-12-31" },
      },
      {
        name: "울산 조선 산단 대규모 장기공사",
        answers: { ...battery, province: "울산광역시", city: "동구", insideIndustrialComplex: true, industryCategory: "SHIPBUILDING_AEROSPACE_RAIL", totalAreaM2: 80_000, increaseAreaM2: 80_000, riverOccupationRequired: true, publicWaterOccupationRequired: true, plannedConstructionStartDate: "2026-08-21", plannedConstructionEndDate: "2032-08-20" },
      },
      {
        name: "세종 의약바이오 산단 신설",
        answers: { ...general, province: "세종특별자치시", city: "", industryCategory: "PHARMACEUTICAL_BIO", totalAreaM2: 10_000, increaseAreaM2: 10_000, chemicalsHandled: true, chemicalManufactureOrImport: false, plannedConstructionStartDate: "2026-12-01", plannedConstructionEndDate: "2028-06-30" },
      },
      {
        name: "전북 군산 이차전지 최대 검토범위",
        answers: {
          ...battery,
          province: "전북특별자치도",
          city: "군산시",
          landCategory: "FARMLAND",
          totalAreaM2: 50_000,
          increaseAreaM2: 50_000,
          demolitionRequired: true,
          roadConnectionRequired: true,
          trafficImpactAssessmentRequired: true,
          environmentalAssessmentType: "ENVIRONMENTAL",
          integratedEnvironmentalPermitTarget: true,
          disasterImpactAssessmentType: "DISASTER_IMPACT",
          undergroundSafetyAssessmentType: "UNDERGROUND_SAFETY",
          nationalHeritageAssessmentType: "IMPACT_DIAGNOSIS",
          militaryProtectionConsultationRequired: true,
          riverOccupationRequired: true,
          publicWaterOccupationRequired: true,
          waterSourceProtectionZone: true,
          hazardousMaterialsTank: true,
          hazardousMaterialsPreventionRulesRequired: true,
          wasteFacility: true,
          chemicalRegistrationRequired: true,
          restrictedOrToxicChemicalImport: true,
          groundwaterDevelopment: true,
          publicSewerConnection: true,
          privateSewageTreatmentFacility: true,
          safetyManagementPlanRequired: true,
          specificWorkReportRequired: true,
          asbestosPresent: true,
          plannedConstructionStartDate: "2026-09-01",
          plannedConstructionEndDate: "2028-08-31",
        },
      },
      {
        name: "대전 유성 미확인값 포함",
        answers: { ...insufficient, plannedConstructionStartDate: "2027-01-01", plannedConstructionEndDate: "2028-12-31" },
      },
    ];

    expect(scenarios).toHaveLength(10);
    for (const scenario of scenarios) {
      const result = evaluateProject(scenario.answers);
      const repeated = evaluateProject(scenario.answers);
      const expectedConstructionDays = Math.floor(
        (new Date(`${scenario.answers.plannedConstructionEndDate}T00:00:00.000Z`).getTime() -
          new Date(`${scenario.answers.plannedConstructionStartDate}T00:00:00.000Z`).getTime()) /
          86_400_000,
      ) + 1;

      expect(result.decisions.flatMap((decision) => decision.conflictRuleIds), scenario.name).toEqual([]);
      expect(result, scenario.name).toEqual(repeated);
      for (const schedule of [result.schedules.MIN, result.schedules.TYPICAL]) {
        const timeline = schedule.projectTimeline;
        expect(timeline, scenario.name).not.toBeNull();
        const nodeIds = timeline!.nodes.map((node) => node.procedureId).sort();
        expect(nodeIds, scenario.name).toEqual([...schedule.topologicalOrder].sort());
        expect(timeline!.constructionCalendarDays, scenario.name).toBe(expectedConstructionDays);
        expect(timeline!.minimumKnownCalendarDays, scenario.name).toBeGreaterThanOrEqual(expectedConstructionDays);
        const scheduled = new Set(nodeIds);
        for (const decision of result.decisions) {
          if (decision.provisionalEffect === "INCLUDE") {
            expect(scheduled.has(decision.procedure.id), `${scenario.name}: ${decision.procedure.id}`).toBe(true);
          }
          if (decision.provisionalEffect === "EXCLUDE") {
            expect(scheduled.has(decision.procedure.id), `${scenario.name}: ${decision.procedure.id}`).toBe(false);
          }
        }
      }
      expect(result.schedules.TYPICAL.projectTimeline!.minimumKnownCalendarDays, scenario.name).toBeGreaterThanOrEqual(
        result.schedules.MIN.projectTimeline!.minimumKnownCalendarDays,
      );
    }
  }, 30_000);
});
