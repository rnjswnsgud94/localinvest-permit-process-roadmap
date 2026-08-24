import { describe, expect, it } from "vitest";

import { catalog } from "@/lib/data/catalog";
import { scenarioAnswersToProjectInput } from "@/lib/domain/project-input";

describe("project input normalization", () => {
  it("keeps an unselected province and choice sentinels unknown", () => {
    const input = scenarioAnswersToProjectInput(
      {
        ...catalog.scenarios[0].answers,
        province: "",
        city: "",
        investmentType: "UNKNOWN",
        industryCategory: "UNKNOWN",
        buildingAction: "UNKNOWN",
        insideIndustrialComplex: null,
        entryContractRegime: "NONE",
      },
      catalog.procedures,
    );

    expect(input.location.province).toEqual({ status: "UNKNOWN" });
    expect(input.location.city).toEqual({ status: "UNKNOWN" });
    expect(input.investmentType).toEqual({ status: "UNKNOWN" });
    expect(input.industry.category).toEqual({ status: "UNKNOWN" });
    expect(input.building.action).toEqual({ status: "UNKNOWN" });
    expect(input.entryContract.regime).toEqual({ status: "UNKNOWN" });
    expect(input.existingApprovalIds).toEqual({ status: "UNKNOWN" });
  });

  it("marks hazardous-material follow-ups not applicable when the parent answer is no", () => {
    const input = scenarioAnswersToProjectInput(
      {
        ...catalog.scenarios[0].answers,
        hazardousMaterials: false,
        hazardousMaterialsTank: null,
        hazardousMaterialsPreventionRulesRequired: null,
      },
      catalog.procedures,
    );

    expect(input.safety.hazardousMaterials).toMatchObject({
      status: "KNOWN",
      value: false,
    });
    expect(input.safety.hazardousMaterialsTank).toEqual({
      status: "NOT_APPLICABLE",
    });
    expect(input.safety.hazardousMaterialsPreventionRulesRequired).toEqual({
      status: "NOT_APPLICABLE",
    });
  });

  it("keeps development area and local environmental assessment separate from building area and national assessment", () => {
    const input = scenarioAnswersToProjectInput(
      {
        ...catalog.scenarios[0].answers,
        totalAreaM2: 12_000,
        siteDevelopmentAreaM2: 80_000,
        environmentalAssessmentType: "SMALL",
        localEnvironmentalAssessmentRequired: true,
      },
      catalog.procedures,
    );

    expect(input.building.totalAreaM2).toMatchObject({
      status: "KNOWN",
      value: 12_000,
      unit: "m2",
    });
    expect(input.site.developmentAreaM2).toMatchObject({
      status: "KNOWN",
      value: 80_000,
      unit: "m2",
    });
    expect(input.environment.environmentalAssessmentType).toMatchObject({
      status: "KNOWN",
      value: "SMALL",
    });
    expect(input.environment.localEnvironmentalAssessmentRequired).toMatchObject({
      status: "KNOWN",
      value: true,
    });
  });
});
