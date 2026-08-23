import { describe, expect, it } from "vitest";

import { defaultAnswers } from "@/app/components/dashboard/DashboardClient";
import { procedureCategoryForDecision } from "@/app/components/dashboard/constants";
import { buildPermitReportModel } from "@/app/components/dashboard/pdf/permit-report-model";
import { specialLawProcessProcedures } from "@/lib/data/special-law-processes";
import { evaluateProject } from "@/lib/engine/pipeline";

describe("empty project decision state", () => {
  it("keeps every unreviewed procedure in additional confirmation instead of exclusion", () => {
    const evaluation = evaluateProject(defaultAnswers);
    const excluded = evaluation.decisions.filter(
      (decision) => procedureCategoryForDecision(decision) === "NOT_REQUIRED",
    );
    const report = buildPermitReportModel({
      answers: defaultAnswers,
      evaluation,
      durationScenario: "TYPICAL",
      generatedAt: new Date("2026-08-23T00:00:00.000Z"),
    });

    expect(evaluation.counts).toEqual({
      APPLIES: 0,
      DOES_NOT_APPLY: 0,
      POSSIBLY_APPLIES: 0,
      NEEDS_MORE_INFO: evaluation.decisions.length,
    });
    expect(excluded).toEqual([]);
    expect(report.excluded).toEqual([]);
    expect(report.summary.counts).toEqual({
      REQUIRED: 0,
      CONFIRM: evaluation.decisions.length,
      NOT_REQUIRED: 0,
    });
    expect(
      evaluation.decisions
        .filter((decision) =>
          specialLawProcessProcedures.some(
            (procedure) => procedure.id === decision.procedure.id,
          ),
        )
        .map(procedureCategoryForDecision),
    ).toEqual(specialLawProcessProcedures.map(() => "CONFIRM"));
  });

  it("excludes special-law process paths only after their qualification is explicitly denied", () => {
    const answers = {
      ...defaultAnswers,
      advancedStrategicIndustryFastTrackConfirmed: false,
      semiconductorClusterFastTrackConfirmed: false,
      semiconductorClusterPlanDeemingConfirmed: false,
      industrialComplexPlanSpecialCaseConfirmed: false,
      regionalSpecialZonePlanDeemingConfirmed: false,
    };
    const evaluation = evaluateProject(answers);
    const categories = new Map(
      evaluation.decisions.map((decision) => [
        decision.procedure.id,
        procedureCategoryForDecision(decision),
      ]),
    );

    expect(specialLawProcessProcedures).toHaveLength(13);
    specialLawProcessProcedures.forEach((procedure) => {
      expect(categories.get(procedure.id), procedure.name).toBe("NOT_REQUIRED");
    });
  });
});
