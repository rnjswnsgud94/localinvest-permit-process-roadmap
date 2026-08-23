import { describe, expect, it } from "vitest";

import { procedureCategoryForDecision } from "@/app/components/dashboard/constants";
import { catalog } from "@/lib/data/catalog";
import {
  scenarioAnswersToProjectInput as convertScenarioAnswersToProjectInput,
} from "@/lib/domain/project-input";
import { resolveAllProcedures, resolveProcedure } from "@/lib/engine/rule-engine";

function scenarioAnswersToProjectInput(
  answers: Parameters<typeof convertScenarioAnswersToProjectInput>[0],
) {
  return convertScenarioAnswersToProjectInput(answers, catalog.procedures);
}

function decide(answers = catalog.scenarios[0].answers) {
  const reviewedProcedures = catalog.procedures.map((procedure) => ({
    ...procedure,
    verificationStatus: "INTERNAL_REVIEWED" as const,
  }));
  const reviewedRules = catalog.rules.map((rule) => ({
    ...rule,
    status: rule.status === "RETIRED" ? rule.status : "INTERNAL_REVIEWED" as const,
  }));
  return resolveAllProcedures(reviewedProcedures, reviewedRules, scenarioAnswersToProjectInput(answers), catalog.coverage.catalogVersion);
}

function status(decisions: ReturnType<typeof decide>, id: string) {
  return decisions.find((decision) => decision.procedure.id === id)?.status;
}

function decision(decisions: ReturnType<typeof decide>, id: string) {
  return decisions.find((item) => item.procedure.id === id);
}

describe("deterministic four-state rules", () => {
  it("surfaces the industrial-complex occupancy contract without duplicating factory approval", () => {
    const decisions = decide(catalog.scenarios[0].answers);
    expect(status(decisions, "industrial-complex-occupancy-contract")).toBe("APPLIES");
    expect(status(decisions, "factory-establishment-approval")).toBe("DOES_NOT_APPLY");
    expect(status(decisions, "factory-completion-report-complex")).toBe("APPLIES");
    expect(status(decisions, "factory-completion-report-offsite")).toBe("DOES_NOT_APPLY");
  });

  it("marks factory approval deemed only when the winning exclusion is the completed occupancy contract", () => {
    const completedOccupancy = {
      ...catalog.scenarios[0].answers,
      industrialComplexName: "테스트산업단지",
      industrialComplexIdentifier: "TEST-COMPLEX-1",
      industrialComplexManagingAuthority: "테스트 산업단지 관리기관",
      industrialComplexOccupancyContractStatus: "COMPLETED" as const,
    };
    const completedDecisions = decide(completedOccupancy);
    expect(
      decision(completedDecisions, "industrial-complex-occupancy-contract"),
    ).toMatchObject({ status: "APPLIES", isDeemed: false });
    expect(
      decision(completedDecisions, "factory-establishment-approval"),
    ).toMatchObject({
      status: "DOES_NOT_APPLY",
      matchedRuleIds: ["rule-factory-approval-deemed-by-occupancy"],
      isDeemed: true,
    });

    const plannedDecisions = decide({
      ...completedOccupancy,
      industrialComplexOccupancyContractStatus: "PLANNED",
    });
    expect(
      decision(plannedDecisions, "industrial-complex-occupancy-contract")?.status,
    ).toBe("APPLIES");
    expect(
      decision(plannedDecisions, "factory-establishment-approval")?.isDeemed,
    ).toBe(false);

    const aiDataCenterDecisions = decide({
      ...completedOccupancy,
      assessmentDate: "2027-03-10",
      industryCategory: "AI_DATA_CENTER",
      aiDataCenterActFacilityConfirmed: true,
    });
    expect(
      decision(aiDataCenterDecisions, "factory-establishment-approval"),
    ).toMatchObject({
      status: "DOES_NOT_APPLY",
      matchedRuleIds: ["rule-aidc-exclude-factory-establishment-approval"],
      isDeemed: false,
    });
  });

  it.each([
    [499, "NONE", "DOES_NOT_APPLY"],
    [499, "LOCAL_ONLY", "APPLIES"],
    [500, "NONE", "APPLIES"],
    [501, "NONE", "APPLIES"],
  ] as const)("handles the 500㎡ boundary: %i㎡ / %s", (totalAreaM2, permitCoordination, expected) => {
    const base = catalog.scenarios[2].answers;
    const decisions = decide({ ...base, totalAreaM2, increaseAreaM2: totalAreaM2, permitCoordination });
    expect(status(decisions, "factory-establishment-approval")).toBe(expected);
  });

  it("uses NEEDS_MORE_INFO instead of guessing from an unknown fact", () => {
    const decisions = decide(catalog.scenarios[3].answers);
    expect(status(decisions, "air-emission-installation-permit")).toBe("NEEDS_MORE_INFO");
    expect(decisions.find((item) => item.procedure.id === "air-emission-installation-permit")?.missingInputs).toContain("environment.airEmissionFacility");
  });

  it("replaces individual air and water permits with the integrated permit path", () => {
    const decisions = decide(catalog.scenarios[2].answers);
    expect(status(decisions, "integrated-environmental-permit")).toBe("APPLIES");
    expect(status(decisions, "integrated-environmental-operation-start-report")).toBe("APPLIES");
    expect(status(decisions, "air-emission-installation-permit")).toBe("DOES_NOT_APPLY");
    expect(status(decisions, "water-discharge-installation-permit")).toBe("DOES_NOT_APPLY");
    expect(status(decisions, "air-facility-operation-start-report")).toBe("DOES_NOT_APPLY");
    expect(status(decisions, "water-facility-operation-start-report")).toBe("DOES_NOT_APPLY");
    expect(status(decisions, "noise-vibration-facility-report")).toBe("DOES_NOT_APPLY");
    expect(decision(decisions, "air-emission-installation-permit")?.isDeemed).toBe(true);
    expect(decision(decisions, "water-discharge-installation-permit")?.isDeemed).toBe(true);
    expect(decision(decisions, "air-facility-operation-start-report")?.isDeemed).toBe(true);
    expect(decision(decisions, "water-facility-operation-start-report")?.isDeemed).toBe(true);
    expect(status(decisions, "process-safety-report")).toBe("APPLIES");
    expect(status(decisions, "hazard-prevention-plan")).toBe("NEEDS_MORE_INFO");
    expect(decision(decisions, "hazard-prevention-plan")?.isDeemed).toBe(false);
    expect(decision(decisions, "hazard-prevention-plan")?.missingInputs).toContain(
      "confirmation.supplementalPermitTargets.hazard-prevention-plan",
    );
  });

  it("does not label an unrelated exclusion as deemed", () => {
    const decisions = decide(catalog.scenarios[0].answers);
    expect(status(decisions, "noise-vibration-facility-report")).toBe("DOES_NOT_APPLY");
    expect(decision(decisions, "noise-vibration-facility-report")?.isDeemed).toBe(false);
  });

  it("keeps factually inapplicable land, air, and water paths out of REQUIRED", () => {
    const decisions = decide({
      ...catalog.scenarios[2].answers,
      landCategory: "OTHER",
      airEmissionFacility: false,
      waterDischargeFacility: false,
      integratedEnvironmentalPermitTarget: false,
    });

    for (const id of [
      "farmland-conversion-permit",
      "forestland-conversion-permit",
      "air-emission-installation-permit",
      "water-discharge-installation-permit",
      "air-facility-operation-start-report",
      "water-facility-operation-start-report",
    ]) {
      const result = decision(decisions, id)!;
      expect(result.status, id).toBe("DOES_NOT_APPLY");
      expect(result.matchedRuleIds, id).toEqual([]);
      expect(result.isDeemed, id).toBe(false);
      expect(procedureCategoryForDecision(result), id).toBe("NOT_REQUIRED");
    }
  });

  it("requires a confirmed, fully supported upper procedure before deeming a lower path", () => {
    const procedureIds = new Set([
      "integrated-environmental-operation-start-report",
      "air-facility-operation-start-report",
    ]);
    const ruleIds = new Set([
      "rule-exp-integrated-environmental-operation-start-report",
      "rule-exp-air-facility-operation-start-report",
      "rule-exp-air-operation-integrated-exclusion",
    ]);
    const procedures = catalog.procedures
      .filter((procedure) => procedureIds.has(procedure.id))
      .map((procedure) => ({
        ...procedure,
        verificationStatus: "INTERNAL_REVIEWED" as const,
      }));
    const baseRules = catalog.rules
      .filter((rule) => ruleIds.has(rule.id))
      .map((rule) => ({ ...rule, status: "INTERNAL_REVIEWED" as const }));
    const input = scenarioAnswersToProjectInput({
      ...catalog.scenarios[2].answers,
      integratedEnvironmentalPermitTarget: true,
      airEmissionFacility: true,
    });
    const resolve = (rules: Parameters<typeof resolveAllProcedures>[1]) =>
      resolveAllProcedures(procedures, rules, input, "test");
    const parentRuleId = "rule-exp-integrated-environmental-operation-start-report";

    const draftParent = resolve(
      baseRules.map((rule) =>
        rule.id === parentRuleId
          ? { ...rule, status: "DRAFT" as const }
          : rule,
      ),
    );
    expect(
      decision(draftParent, "integrated-environmental-operation-start-report")?.status,
    ).toBe("POSSIBLY_APPLIES");
    expect(decision(draftParent, "air-facility-operation-start-report")?.isDeemed).toBe(false);
    expect(
      procedureCategoryForDecision(
        decision(draftParent, "air-facility-operation-start-report")!,
      ),
    ).not.toBe("REQUIRED");

    const missingSupportParent = resolve(
      baseRules.map((rule) =>
        rule.id === parentRuleId
          ? {
              ...rule,
              requiredInputs: [
                ...rule.requiredInputs,
                "industry.coreProcesses",
                "confirmation.industrialComplexPlanConsultationCompleted",
              ],
            }
          : rule,
      ),
    );
    expect(
      decision(
        missingSupportParent,
        "integrated-environmental-operation-start-report",
      ),
    ).toMatchObject({
      status: "NEEDS_MORE_INFO",
      missingInputs: [
        "confirmation.industrialComplexPlanConsultationCompleted",
        "industry.coreProcesses",
      ],
      isDeemed: false,
    });
    expect(
      procedureCategoryForDecision(
        decision(missingSupportParent, "air-facility-operation-start-report")!,
      ),
    ).not.toBe("REQUIRED");

    const confirmedParent = resolve(baseRules);
    const confirmedChild = decision(
      confirmedParent,
      "air-facility-operation-start-report",
    )!;
    expect(confirmedChild).toMatchObject({
      status: "DOES_NOT_APPLY",
      isDeemed: true,
    });
    expect(procedureCategoryForDecision(confirmedChild)).toBe("REQUIRED");
  });

  it("does not treat a true condition as applicable while a required input is unknown", () => {
    const procedure = {
      ...catalog.procedures.find((item) => item.id === "farmland-conversion-permit")!,
      verificationStatus: "INTERNAL_REVIEWED" as const,
    };
    const baseRule = catalog.rules.find(
      (item) => item.id === "rule-exp-farmland-conversion-permit",
    )!;
    const rule = {
      ...baseRule,
      status: "INTERNAL_REVIEWED" as const,
      requiredInputs: [...baseRule.requiredInputs, "site.restrictedFactors"],
    };
    const input = scenarioAnswersToProjectInput({
      ...catalog.scenarios[2].answers,
      landCategory: "FARMLAND",
    });

    const unresolved = resolveProcedure(procedure, [rule], input, "test");

    expect(unresolved.traces[0]).toMatchObject({
      status: "NEEDS_MORE_INFO",
      passedConditions: ["site.landCategory = FARMLAND"],
      missingInputs: ["site.restrictedFactors"],
    });
    expect(unresolved).toMatchObject({
      status: "NEEDS_MORE_INFO",
      matchedRuleIds: [],
      provisionalEffect: null,
      missingInputs: ["site.restrictedFactors"],
    });
  });

  it("keeps an explicitly non-matching exceptional rule neutral until its evidence is confirmed", () => {
    const procedure = {
      ...catalog.procedures.find((item) => item.id === "farmland-conversion-permit")!,
      verificationStatus: "INTERNAL_REVIEWED" as const,
    };
    const baseRule = catalog.rules.find(
      (item) => item.id === "rule-exp-farmland-conversion-permit",
    )!;
    const input = scenarioAnswersToProjectInput({
      ...catalog.scenarios[2].answers,
      landCategory: "FARMLAND",
    });
    const ruleWithMissingEvidence = {
      ...baseRule,
      status: "INTERNAL_REVIEWED" as const,
      requiredInputs: [...baseRule.requiredInputs, "site.restrictedFactors"],
    };

    const indeterminate = resolveProcedure(
      procedure,
      [ruleWithMissingEvidence],
      input,
      "test",
    );
    const nonMatch = resolveProcedure(
      procedure,
      [{ ...ruleWithMissingEvidence, missingPolicy: "NON_MATCH" as const }],
      input,
      "test",
    );

    expect(indeterminate).toMatchObject({
      status: "NEEDS_MORE_INFO",
      missingInputs: ["site.restrictedFactors"],
    });
    expect(nonMatch).toMatchObject({
      status: "DOES_NOT_APPLY",
      missingInputs: [],
      provisionalEffect: "EXCLUDE",
    });
    expect(nonMatch.traces[0]).toMatchObject({
      status: "DOES_NOT_APPLY",
      missingInputs: [],
    });
  });

  it("keeps a false condition excluded even when another required input is unknown", () => {
    const procedure = {
      ...catalog.procedures.find((item) => item.id === "farmland-conversion-permit")!,
      verificationStatus: "INTERNAL_REVIEWED" as const,
    };
    const baseRule = catalog.rules.find(
      (item) => item.id === "rule-exp-farmland-conversion-permit",
    )!;
    const rule = {
      ...baseRule,
      status: "INTERNAL_REVIEWED" as const,
      requiredInputs: [...baseRule.requiredInputs, "site.restrictedFactors"],
    };
    const input = scenarioAnswersToProjectInput({
      ...catalog.scenarios[2].answers,
      landCategory: "OTHER",
    });

    const excluded = resolveProcedure(procedure, [rule], input, "test");

    expect(excluded.traces[0]).toMatchObject({
      status: "DOES_NOT_APPLY",
      missingInputs: ["site.restrictedFactors"],
    });
    expect(excluded).toMatchObject({
      status: "DOES_NOT_APPLY",
      matchedRuleIds: [],
      provisionalEffect: "EXCLUDE",
      missingInputs: [],
    });
  });

  it("uses explicit facility facts instead of industry or demand proxies", () => {
    const base = catalog.scenarios[1].answers;
    const excluded = decide({
      ...base,
      chemicalManufactureOrImport: false,
      privateElectricalFacilityWork: false,
      specificHighPressureGasUse: false,
    });
    expect(status(excluded, "chemical-substance-confirmation")).toBe("DOES_NOT_APPLY");
    expect(status(excluded, "private-electrical-facility-construction-plan")).toBe("DOES_NOT_APPLY");
    expect(status(excluded, "electrical-pre-use-inspection")).toBe("DOES_NOT_APPLY");
    expect(status(excluded, "specific-high-pressure-gas-use-report")).toBe("DOES_NOT_APPLY");

    const included = decide({
      ...base,
      chemicalManufactureOrImport: true,
      powerIncreaseMw: 0,
      privateElectricalFacilityWork: true,
      specificHighPressureGasUse: true,
    });
    expect(status(included, "chemical-substance-confirmation")).toBe("APPLIES");
    expect(status(included, "private-electrical-facility-construction-plan")).toBe("APPLIES");
    expect(status(included, "electrical-pre-use-inspection")).toBe("APPLIES");
    expect(status(included, "specific-high-pressure-gas-use-report")).toBe("APPLIES");
  });

  it("confirms every dependent chemical procedure as excluded when chemicals are not handled", () => {
    const chemicalProcedureIds = [
      "chemical-substance-confirmation",
      "chemical-accident-prevention-plan",
      "hazardous-chemical-facility-inspection",
      "hazardous-chemical-business-permit",
      "chemical-registration-notification",
      "restricted-toxic-chemical-import-permit-report",
      "hazardous-chemical-manager-appointment-report",
      "hazardous-chemical-regular-inspection",
    ];
    const base = catalog.scenarios[1].answers;

    for (const staleChildValues of [false, true]) {
      const excluded = decide({
        ...base,
        chemicalsHandled: false,
        chemicalManufactureOrImport: staleChildValues,
        hazardousChemicalBusiness: staleChildValues,
        chemicalRegistrationRequired: staleChildValues,
        restrictedOrToxicChemicalImport: staleChildValues,
      });

      for (const procedureId of chemicalProcedureIds) {
        expect(decision(excluded, procedureId), procedureId).toMatchObject({
          status: "DOES_NOT_APPLY",
          missingInputs: [],
        });
        expect(
          procedureCategoryForDecision(decision(excluded, procedureId)!),
          procedureId,
        ).toBe("NOT_REQUIRED");
      }
    }
  });

  it.each([true, null] as const)(
    "does not infer dependent chemical answers when the parent is %s",
    (chemicalsHandled) => {
      const pending = decide({
        ...catalog.scenarios[1].answers,
        chemicalsHandled,
        chemicalManufactureOrImport: null,
        hazardousChemicalBusiness: null,
        chemicalRegistrationRequired: null,
        restrictedOrToxicChemicalImport: null,
      });

      for (const procedureId of [
        "chemical-substance-confirmation",
        "chemical-accident-prevention-plan",
        "hazardous-chemical-facility-inspection",
        "hazardous-chemical-business-permit",
        "chemical-registration-notification",
        "restricted-toxic-chemical-import-permit-report",
        "hazardous-chemical-manager-appointment-report",
        "hazardous-chemical-regular-inspection",
      ]) {
        expect(status(pending, procedureId), procedureId).toBe("NEEDS_MORE_INFO");
      }
    },
  );

  it("confirms hazardous-material child procedures as excluded when no hazardous materials are handled", () => {
    const excluded = decide({
      ...catalog.scenarios[1].answers,
      hazardousMaterials: false,
      hazardousMaterialsTank: null,
      hazardousMaterialsPreventionRulesRequired: null,
    });

    for (const procedureId of [
      "hazardous-materials-tank-safety-performance-inspection",
      "hazardous-materials-prevention-rules-submission",
    ]) {
      expect(decision(excluded, procedureId), procedureId).toMatchObject({
        status: "DOES_NOT_APPLY",
        missingInputs: [],
      });
      expect(
        procedureCategoryForDecision(decision(excluded, procedureId)!),
        procedureId,
      ).toBe("NOT_REQUIRED");
    }
  });

  it("registers expanded exclusion rules on their procedures", () => {
    expect(decision(decide(), "air-facility-operation-start-report")?.procedure.ruleIds).toContain("rule-exp-air-operation-integrated-exclusion");
    expect(decision(decide(), "water-facility-operation-start-report")?.procedure.ruleIds).toContain("rule-exp-water-operation-integrated-exclusion");
    expect(decision(decide(), "hazard-prevention-plan")?.procedure.ruleIds).toContain("rule-exp-hazard-prevention-psm-exclusion");
  });

  it("uses structured land and safety confirmations without free-text gates", () => {
    const answers = {
      ...catalog.scenarios[2].answers,
      landCategory: "FARMLAND" as const,
      integratedEnvironmentalPermitTarget: false,
    };
    const decisions = decide(answers);
    for (const id of [
      "farmland-conversion-permit",
      "small-environmental-impact-assessment",
      "hazardous-chemical-business-permit",
      "hazardous-materials-facility-installation-permit",
      "high-pressure-gas-manufacture-storage-permit-report",
    ]) {
      expect(status(decisions, id), id).toBe("APPLIES");
      expect(decision(decisions, id)?.missingInputs, id).toEqual([]);
    }
  });

  it("requires authority confirmation for added paths whose broad inputs are insufficient", () => {
    const base = catalog.scenarios[1].answers;
    const included = decide({
      ...base,
      wastewaterM3Day: 1500,
      landCategory: "FOREST" as const,
      highPressureGas: true,
      fireFacilityWork: true,
    });
    expect(status(included, "middle-water-installation-report")).toBe("APPLIES");
    for (const id of [
      "high-pressure-gas-business-start-report",
      "fire-work-supervisor-designation-report",
      "fire-facility-first-self-inspection-report",
      "forestland-restoration-design-approval",
      "forestland-restoration-completion-inspection",
    ]) {
      expect(status(included, id), id).toBe("NEEDS_MORE_INFO");
      expect(decision(included, id)?.provisionalEffect, id).toBeNull();
      expect(decision(included, id)?.missingInputs[0], id).toMatch(/^confirmation\./);
    }

    const belowMiddleWaterThreshold = decide({ ...base, wastewaterM3Day: 1499 });
    expect(status(belowMiddleWaterThreshold, "middle-water-installation-report")).toBe("DOES_NOT_APPLY");
  });

  it("returns byte-for-byte stable decisions for identical inputs", () => {
    const first = decide(catalog.scenarios[2].answers);
    const second = decide(catalog.scenarios[2].answers);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("separates assessment dates before and after a rule takes effect", () => {
    const before = decide({ ...catalog.scenarios[2].answers, assessmentDate: "2026-06-30" });
    const after = decide({ ...catalog.scenarios[2].answers, assessmentDate: "2026-07-01" });
    expect(status(before, "factory-establishment-approval")).toBe("POSSIBLY_APPLIES");
    expect(status(after, "factory-establishment-approval")).toBe("APPLIES");
  });

  it("applies an exact regional rule only inside its jurisdiction", () => {
    const procedure = {
      ...catalog.procedures.find((item) => item.id === "building-permit")!,
      verificationStatus: "INTERNAL_REVIEWED" as const,
    };
    const baseRule = catalog.rules.find((item) => item.id === "rule-building-action")!;
    const regionalRule = { ...baseRule, id: "rule-test-cheongbuk-only", status: "INTERNAL_REVIEWED" as const, jurisdiction: { nationwide: false, provinces: ["충청북도"], cities: [], industrialComplexIds: [] } };
    const chungbuk = resolveProcedure(procedure, [regionalRule], scenarioAnswersToProjectInput(catalog.scenarios[0].answers), "test");
    const chungnam = resolveProcedure(procedure, [regionalRule], scenarioAnswersToProjectInput({ ...catalog.scenarios[0].answers, province: "충청남도", city: "천안시" }), "test");
    expect(chungbuk.status).toBe("APPLIES");
    expect(chungnam.status).toBe("POSSIBLY_APPLIES");
  });

  it("surfaces equal-priority include/exclude conflicts", () => {
    const procedure = catalog.procedures.find((item) => item.id === "building-permit")!;
    const baseRule = catalog.rules.find((item) => item.id === "rule-building-action")!;
    const include = { ...baseRule, id: "rule-test-include", priority: 50 };
    const exclude = { ...baseRule, id: "rule-test-exclude", effect: "EXCLUDE" as const, priority: 50 };
    const decision = resolveProcedure(procedure, [include, exclude], scenarioAnswersToProjectInput(catalog.scenarios[0].answers), "test");
    expect(decision.status).toBe("POSSIBLY_APPLIES");
    expect(decision.conflictRuleIds).toEqual(["rule-test-exclude", "rule-test-include"]);
    expect(decision.reason).toContain("충돌");
  });

  it("separates deterministic draft matches from their legal-review disclosure", () => {
    const baseProcedure = catalog.procedures.find((item) => item.id === "building-permit")!;
    const procedure = { ...baseProcedure, verificationStatus: "INTERNAL_REVIEWED" as const };
    const baseRule = catalog.rules.find((item) => item.id === "rule-building-action")!;
    const input = scenarioAnswersToProjectInput(catalog.scenarios[0].answers);

    const draftInclude = resolveProcedure(
      procedure,
      [{ ...baseRule, status: "DRAFT" as const }],
      input,
      "test",
    );
    const draftExclude = resolveProcedure(
      procedure,
      [{ ...baseRule, id: "rule-test-draft-exclude", effect: "EXCLUDE" as const, status: "DRAFT" as const }],
      input,
      "test",
    );
    const reviewedInclude = resolveProcedure(
      procedure,
      [{ ...baseRule, status: "INTERNAL_REVIEWED" as const }],
      input,
      "test",
    );

    expect(draftInclude.status).toBe("POSSIBLY_APPLIES");
    expect(draftInclude.provisionalEffect).toBe("INCLUDE");
    expect(draftInclude.needsLegalReview).toBe(true);
    expect(draftInclude.legalReviewReasons.join(" ")).toContain(baseRule.id);
    expect(draftInclude.reason).toContain("세부 법률검토");
    expect(procedureCategoryForDecision(draftInclude)).toBe("REQUIRED");
    expect(draftExclude.status).toBe("POSSIBLY_APPLIES");
    expect(draftExclude.provisionalEffect).toBe("EXCLUDE");
    expect(draftExclude.needsLegalReview).toBe(true);
    expect(draftExclude.legalReviewReasons.join(" ")).toContain("rule-test-draft-exclude");
    expect(procedureCategoryForDecision(draftExclude)).toBe("CONFIRM");
    expect(reviewedInclude.status).toBe("APPLIES");
    expect(reviewedInclude.needsLegalReview).toBe(false);
    expect(reviewedInclude.legalReviewReasons).toEqual([]);
  });

  it("keeps procedure-detail review warnings visibly downgraded", () => {
    const procedure = catalog.procedures.find((item) => item.id === "building-permit")!;
    const baseRule = catalog.rules.find((item) => item.id === "rule-building-action")!;
    const result = resolveProcedure(
      procedure,
      [{ ...baseRule, status: "INTERNAL_REVIEWED" as const }],
      scenarioAnswersToProjectInput(catalog.scenarios[0].answers),
      "test",
    );

    expect(result.status).toBe("POSSIBLY_APPLIES");
    expect(result.provisionalEffect).toBe("INCLUDE");
    expect(result.needsLegalReview).toBe(true);
    expect(result.legalReviewReasons.join(" ")).toContain("AI 보조 초안");
  });

  it("keeps an unknown draft condition in the additional-information bucket", () => {
    const procedure = catalog.procedures.find((item) => item.id === "air-emission-installation-permit")!;
    const rule = catalog.rules.find((item) => item.id === "rule-air-emission-facility")!;
    const result = resolveProcedure(
      procedure,
      [rule],
      scenarioAnswersToProjectInput(catalog.scenarios[3].answers),
      "test",
    );

    expect(result.status).toBe("NEEDS_MORE_INFO");
    expect(result.missingInputs).toContain("environment.airEmissionFacility");
    expect(result.needsLegalReview).toBe(true);
    expect(result.legalReviewReasons.join(" ")).toContain(rule.id);
  });

  it("does not hold decisions in a missing-input state for removed free-text metadata", () => {
    const decisions = resolveAllProcedures(
      [...catalog.procedures],
      [...catalog.rules],
      scenarioAnswersToProjectInput({
        ...catalog.scenarios[0].answers,
        siteZoning: "",
        siteRestrictedFactors: "",
        industrialComplexName: "",
        industrialComplexIdentifier: "",
        industrialComplexManagingAuthority: "",
        ksicCode: "",
        products: "",
        coreProcesses: "",
      }),
      catalog.coverage.catalogVersion,
    );
    const missingInputs = new Set(decisions.flatMap((item) => item.missingInputs));

    for (const removedPath of [
      "site.zoning",
      "site.restrictedFactors",
      "industrialComplex.name",
      "industrialComplex.identifier",
      "industrialComplex.managingAuthority",
      "industry.ksic",
      "industry.products",
      "industry.coreProcesses",
    ]) {
      expect(missingInputs).not.toContain(removedPath);
    }
  });

  it("preserves a deterministic planning direction while keeping draft production matches downgraded", () => {
    const decisions = resolveAllProcedures(
      [...catalog.procedures],
      [...catalog.rules],
      scenarioAnswersToProjectInput(catalog.scenarios[0].answers),
      catalog.coverage.catalogVersion,
    );
    const building = decision(decisions, "building-permit");

    expect(building?.status).toBe("POSSIBLY_APPLIES");
    expect(building?.provisionalEffect).toBe("INCLUDE");
    expect(building?.needsLegalReview).toBe(true);
    expect(building?.legalReviewReasons.join(" ")).toContain("rule-building-action");
  });
});
