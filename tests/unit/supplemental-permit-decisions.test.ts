import { describe, expect, it } from "vitest";

import { procedureCategoryForDecision } from "@/app/components/dashboard/constants";
import {
  catalog,
  scenarioAnswerSchema,
  type ScenarioAnswers,
} from "@/lib/data/catalog";
import {
  capitalRegionSiteReviewTargetIds,
  gyeonggiSiteReviewTargetIds,
  supplementalPermitTargetIds,
} from "@/lib/data/supplemental-permit-targets";
import { evaluateProject } from "@/lib/engine/pipeline";

function evaluate(overrides: Partial<ScenarioAnswers>) {
  return evaluateProject({
    ...catalog.scenarios[0].answers,
    assessmentDate: "2026-08-21",
    province: "충청남도",
    city: "아산시",
    insideIndustrialComplex: false,
    industryCategory: "GENERAL_MANUFACTURING",
    roadConnectionRequired: false,
    integratedEnvironmentalPermitTarget: false,
    chemicalsHandled: false,
    hazardousMaterials: false,
    psmCovered: false,
    advancedStrategicIndustryFastTrackConfirmed: false,
    semiconductorClusterFastTrackConfirmed: false,
    semiconductorClusterPlanDeemingConfirmed: false,
    industrialComplexPlanSpecialCaseConfirmed: false,
    regionalSpecialZonePlanDeemingConfirmed: false,
    ...overrides,
  });
}

function decision(
  evaluation: ReturnType<typeof evaluate>,
  procedureId: string,
) {
  const result = evaluation.decisions.find(
    (item) => item.procedure.id === procedureId,
  );
  if (!result) throw new Error(`Missing decision: ${procedureId}`);
  return result;
}

describe("supplemental permit threshold review", () => {
  it("requires both additional water demand and an official plan-reflection confirmation", () => {
    const procedureId = "industrial-water-master-plan-reflection-consultation";
    const unreviewed = evaluate({
      waterDemandM3Day: 1_500,
      supplementalPermitReviewedIds: [],
      supplementalPermitTargetIds: [],
    });
    const included = evaluate({
      waterDemandM3Day: 1_500,
      supplementalPermitReviewedIds: [procedureId],
      supplementalPermitTargetIds: [procedureId],
    });
    const existingCapacity = evaluate({
      waterDemandM3Day: 1_500,
      supplementalPermitReviewedIds: [procedureId],
      supplementalPermitTargetIds: [],
    });
    const noAdditionalDemand = evaluate({
      waterDemandM3Day: 0,
      supplementalPermitReviewedIds: [procedureId],
      supplementalPermitTargetIds: [procedureId],
    });

    expect(procedureCategoryForDecision(decision(unreviewed, procedureId))).toBe("CONFIRM");
    expect(decision(unreviewed, procedureId).missingInputs).toContain(
      `confirmation.supplementalPermitTargets.${procedureId}`,
    );
    expect(procedureCategoryForDecision(decision(included, procedureId))).toBe("REQUIRED");
    expect(procedureCategoryForDecision(decision(existingCapacity, procedureId))).toBe("NOT_REQUIRED");
    expect(procedureCategoryForDecision(decision(noAdditionalDemand, procedureId))).toBe("NOT_REQUIRED");
  });

  it("keeps proxy-only procedures in confirmation until the threshold review is completed", () => {
    const evaluation = evaluate({
      supplementalPermitReviewedIds: [],
      supplementalPermitTargetIds: [],
    });

    for (const procedureId of supplementalPermitTargetIds) {
      const result = decision(evaluation, procedureId);
      const capitalOnly = capitalRegionSiteReviewTargetIds.includes(
        procedureId as (typeof capitalRegionSiteReviewTargetIds)[number],
      );
      const gyeonggiOnly = gyeonggiSiteReviewTargetIds.includes(
        procedureId as (typeof gyeonggiSiteReviewTargetIds)[number],
      );
      expect(procedureCategoryForDecision(result), procedureId).toBe(
        capitalOnly || gyeonggiOnly ? "NOT_REQUIRED" : "CONFIRM",
      );
      if (capitalOnly || gyeonggiOnly) {
        expect(result.missingInputs, procedureId).not.toContain(
          `confirmation.supplementalPermitTargets.${procedureId}`,
        );
      } else {
        expect(result.missingInputs, procedureId).toContain(
          `confirmation.supplementalPermitTargets.${procedureId}`,
        );
      }
    }
  });

  it("routes every reviewed item into either roadmap inclusion or confirmed exclusion", () => {
    const selected = [
      "road-occupation-permit",
      "fugitive-dust-business-report",
      "hazard-prevention-plan",
    ] as const;
    const evaluation = evaluate({
      supplementalPermitReviewedIds: [...supplementalPermitTargetIds],
      supplementalPermitTargetIds: [...selected],
    });

    for (const procedureId of supplementalPermitTargetIds) {
      const result = decision(evaluation, procedureId);
      expect(result.missingInputs, procedureId).toEqual([]);
      expect(procedureCategoryForDecision(result), procedureId).toBe(
        selected.includes(procedureId as (typeof selected)[number])
          ? "REQUIRED"
          : "NOT_REQUIRED",
      );
    }
  });

  it("resolves only the individually reviewed item and leaves every untouched item unconfirmed", () => {
    const evaluation = evaluate({
      supplementalPermitReviewedIds: ["road-occupation-permit"],
      supplementalPermitTargetIds: [],
    });

    expect(
      procedureCategoryForDecision(
        decision(evaluation, "road-occupation-permit"),
      ),
    ).toBe("NOT_REQUIRED");
    expect(
      procedureCategoryForDecision(
        decision(evaluation, "fugitive-dust-business-report"),
      ),
    ).toBe("CONFIRM");
  });

  it("routes supervised information-communications work to the result-report path instead of pre-use inspection", () => {
    const evaluation = evaluate({
      supplementalPermitReviewedIds: [
        "information-communication-supervisor-assignment-report",
        "information-communication-pre-use-inspection",
      ],
      supplementalPermitTargetIds: [
        "information-communication-supervisor-assignment-report",
      ],
    });
    const preUse = decision(
      evaluation,
      "information-communication-pre-use-inspection",
    );

    expect(procedureCategoryForDecision(decision(
      evaluation,
      "information-communication-supervisor-assignment-report",
    ))).toBe("REQUIRED");
    expect(procedureCategoryForDecision(decision(
      evaluation,
      "information-communication-supervision-result-submission",
    ))).toBe("REQUIRED");
    expect(procedureCategoryForDecision(preUse)).toBe("NOT_REQUIRED");
    expect(preUse.matchedRuleIds).toContain(
      "rule-exp-information-pre-use-supervision-exclusion",
    );
    expect(evaluation.schedules.TYPICAL.topologicalOrder).not.toContain(
      "information-communication-pre-use-inspection",
    );
  });

  it("keeps non-supervised pre-use inspection and rejects mutually exclusive threshold selections", () => {
    const evaluation = evaluate({
      supplementalPermitReviewedIds: [
        "information-communication-supervisor-assignment-report",
        "information-communication-pre-use-inspection",
      ],
      supplementalPermitTargetIds: [
        "information-communication-pre-use-inspection",
      ],
    });

    expect(procedureCategoryForDecision(decision(
      evaluation,
      "information-communication-pre-use-inspection",
    ))).toBe("REQUIRED");
    expect(procedureCategoryForDecision(decision(
      evaluation,
      "information-communication-supervision-result-submission",
    ))).toBe("NOT_REQUIRED");

    for (const mutuallyExclusiveIds of [
      [
        "information-communication-supervisor-assignment-report",
        "information-communication-pre-use-inspection",
      ],
      ["marine-use-consultation", "marine-use-impact-assessment"],
    ]) {
      const parsed = scenarioAnswerSchema.safeParse({
        ...catalog.scenarios[0].answers,
        supplementalPermitReviewedIds: mutuallyExclusiveIds,
        supplementalPermitTargetIds: mutuallyExclusiveIds,
      });
      expect(parsed.success, mutuallyExclusiveIds.join(" + ")).toBe(false);
    }
  });

  it.each([
    {
      procedureId: "information-communication-pre-use-inspection",
      alternateId: "information-communication-supervisor-assignment-report",
    },
    {
      procedureId: "marine-use-consultation",
      alternateId: "marine-use-impact-assessment",
    },
  ] as const)(
    "does not let an unreviewed alternate path contaminate the reviewed $procedureId decision",
    ({ procedureId, alternateId }) => {
      const excluded = evaluate({
        supplementalPermitReviewedIds: [procedureId],
        supplementalPermitTargetIds: [],
      });
      const included = evaluate({
        supplementalPermitReviewedIds: [procedureId],
        supplementalPermitTargetIds: [procedureId],
      });

      expect(procedureCategoryForDecision(decision(excluded, procedureId))).toBe(
        "NOT_REQUIRED",
      );
      expect(decision(excluded, procedureId).missingInputs).not.toContain(
        `confirmation.supplementalPermitTargets.${alternateId}`,
      );
      expect(procedureCategoryForDecision(decision(included, procedureId))).toBe(
        "REQUIRED",
      );
      expect(decision(included, procedureId).missingInputs).not.toContain(
        `confirmation.supplementalPermitTargets.${alternateId}`,
      );
    },
  );

  it.each([
    {
      name: "PSM 비대상",
      psmCovered: false,
      sameScope: null,
      category: "REQUIRED",
      status: "APPLIES",
      deemed: false,
    },
    {
      name: "PSM 대상이나 별도 설비·범위",
      psmCovered: true,
      sameScope: false,
      category: "REQUIRED",
      status: "APPLIES",
      deemed: false,
    },
    {
      name: "PSM 대상이나 동일설비 범위 미확인",
      psmCovered: true,
      sameScope: null,
      category: "CONFIRM",
      status: "NEEDS_MORE_INFO",
      deemed: false,
    },
    {
      name: "PSM이 동일 유해·위험설비를 포함",
      psmCovered: true,
      sameScope: true,
      category: "REQUIRED",
      status: "DOES_NOT_APPLY",
      deemed: true,
    },
  ] as const)("applies the PSM deeming boundary: $name", ({
    psmCovered,
    sameScope,
    category,
    status,
    deemed,
  }) => {
    const evaluation = evaluate({
      supplementalPermitReviewedIds: ["hazard-prevention-plan"],
      supplementalPermitTargetIds: ["hazard-prevention-plan"],
      psmCovered,
      psmCoversSameHazardPreventionScope: sameScope,
    });
    const hazardPlan = decision(evaluation, "hazard-prevention-plan");

    expect(procedureCategoryForDecision(hazardPlan)).toBe(category);
    expect(hazardPlan.status).toBe(status);
    expect(hazardPlan.isDeemed).toBe(deemed);
    expect(hazardPlan.procedure.citationIds).toContain(
      "cit-osh-42-3-psm-deeming",
    );

    if (sameScope === null && psmCovered) {
      expect(hazardPlan.missingInputs).toContain(
        "safety.psmCoversSameHazardPreventionScope",
      );
    }
    if (deemed) {
      const psm = decision(evaluation, "process-safety-report");
      expect(psm.status).toBe("APPLIES");
      expect(psm.procedure.citationIds).toContain(
        "cit-osh-42-3-psm-deeming",
      );
      expect(hazardPlan.matchedRuleIds).toContain(
        "rule-exp-hazard-prevention-psm-exclusion",
      );
      expect(evaluation.schedules.TYPICAL.topologicalOrder).not.toContain(
        "hazard-prevention-plan",
      );
    }
  });
});
