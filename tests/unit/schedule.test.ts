import { describe, expect, it } from "vitest";

import type { DurationEstimate, ProcedureEdge } from "@/lib/domain/schemas";
import type { ProcedureDecision } from "@/lib/engine/rule-engine";
import {
  calculateSchedule,
  type ConstructionPlan,
  type PlanningDuration,
} from "@/lib/engine/schedule";

function decisions(
  ids: string[],
  matchedRuleIdsByProcedure: Record<string, string[]> = {},
): ProcedureDecision[] {
  return ids.map((id) => ({
    status: "APPLIES",
    procedure: { id },
    matchedRuleIds: matchedRuleIdsByProcedure[id] ?? [],
  })) as ProcedureDecision[];
}

type DurationValue = number | null | [minimum: number, typical: number];

function durations(values: Record<string, DurationValue>): DurationEstimate[] {
  return Object.entries(values).map(([procedureId, value]) => {
    const minimum = Array.isArray(value) ? value[0] : value;
    const typical = Array.isArray(value) ? value[1] : value;
    return {
      procedureId,
      elapsed:
        value === null
          ? null
          : {
              min: minimum,
              base: typical,
              max: typical,
              unit: "BUSINESS_DAY",
            },
    } as DurationEstimate;
  });
}

function edge(
  id: string,
  from: string,
  to: string,
  options: Partial<
    Pick<ProcedureEdge, "relation" | "lag" | "lagUnit" | "strength" | "conditionRuleId">
  > = {},
): ProcedureEdge {
  return {
    id,
    from,
    to,
    relation: options.relation ?? "FINISH_TO_START",
    lag: options.lag ?? 0,
    lagUnit: options.lagUnit ?? "BUSINESS_DAY",
    strength: options.strength ?? "LEGAL_HARD",
    conditionRuleId: options.conditionRuleId ?? null,
    citationIds: [],
    branchId: null,
    note: "test",
  };
}

type PlanningSpec = {
  minimum: number | null;
  typical?: number | null;
  unit: PlanningDuration["unit"];
  overlapPolicy: PlanningDuration["overlapPolicy"];
  releasePolicy?: PlanningDuration["releasePolicy"];
  endToEndMissingComponents?: string[];
  completedCheckpoint?: PlanningDuration["completedCheckpoint"];
  evidenceType?: PlanningDuration["evidenceType"];
};

function planning(values: Record<string, PlanningSpec>): PlanningDuration[] {
  return Object.entries(values).map(([procedureId, value]) => {
    const typical = value.typical === undefined ? value.minimum : value.typical;
    const known = value.minimum !== null || typical !== null;
    return {
      procedureId,
      minimum: value.minimum,
      typical,
      unit: value.unit,
      overlapPolicy: value.overlapPolicy,
      releasePolicy: value.releasePolicy ?? "EARLIEST_ALLOWED",
      evidenceType: value.evidenceType ?? (known
        ? "OFFICIAL_SERVICE_STANDARD"
        : "INSUFFICIENT_DATA"),
      confidence: known ? "HIGH" : "UNVERIFIED",
      sourceLabel: known ? "테스트용 공식 처리기간" : null,
      assumptions: [],
      reviewedAt: known ? "2026-01-01" : null,
      endToEndMissingComponents: value.endToEndMissingComponents,
      completedCheckpoint: value.completedCheckpoint,
    } satisfies PlanningDuration;
  });
}

const constructionPlan: ConstructionPlan = {
  assessmentDate: "2026-01-02",
  plannedStartDate: "2026-02-01",
  plannedEndDate: "2026-05-31",
};

describe("business-day DAG and critical path", () => {
  it("uses the longest dependency path instead of summing parallel work", () => {
    const result = calculateSchedule({
      decisions: decisions(["a", "b", "c"]),
      edges: [edge("a-c", "a", "c"), edge("b-c", "b", "c")],
      durations: durations({ a: 5, b: 3, c: 2 }),
      scenario: "TYPICAL",
      includeConditional: true,
      includePractical: true,
    });

    expect(result.total).toBe(7);
    expect(result.criticalProcedureIds).toEqual(["a", "c"]);
    expect(result.criticalEdgeIds).toEqual(["a-c"]);
    expect(result.nodes.find((node) => node.procedureId === "b")?.slack).toBe(2);
  });

  it("keeps MIN and TYPICAL official values distinct", () => {
    const common = {
      decisions: decisions(["permit"]),
      edges: [],
      durations: durations({ permit: [7, 20] }),
      includeConditional: true,
      includePractical: true,
    };

    expect(calculateSchedule({ ...common, scenario: "MIN" }).total).toBe(7);
    expect(calculateSchedule({ ...common, scenario: "TYPICAL" }).total).toBe(20);
  });

  it("identifies binding start-to-start and finish-to-finish critical edges", () => {
    const result = calculateSchedule({
      decisions: decisions(["anchor", "parallel", "finish-together"]),
      edges: [
        edge("ss", "anchor", "parallel", { relation: "START_TO_START" }),
        edge("ff", "anchor", "finish-together", { relation: "FINISH_TO_FINISH" }),
      ],
      durations: durations({ anchor: 5, parallel: 5, "finish-together": 3 }),
      scenario: "TYPICAL",
      includeConditional: true,
      includePractical: true,
    });

    expect(result.criticalEdgeIds).toEqual(["ff", "ss"]);
  });

  it("marks a missing official duration as an incomplete partial path", () => {
    const result = calculateSchedule({
      decisions: decisions(["unknown"]),
      edges: [],
      durations: durations({ unknown: null }),
      scenario: "MIN",
      includeConditional: true,
      includePractical: true,
    });

    expect(result.complete).toBe(false);
    expect(result.unknownDurationProcedureIds).toEqual(["unknown"]);
    expect(result.warnings.join(" ")).toContain("부분 계산");
  });

  it("can exclude practical dependencies without changing legal edges", () => {
    const practical = edge("a-b", "a", "b", { strength: "PRACTICAL" });
    const common = {
      decisions: decisions(["a", "b"]),
      edges: [practical],
      durations: durations({ a: 5, b: 3 }),
      scenario: "MIN" as const,
      includeConditional: true,
    };

    expect(calculateSchedule({ ...common, includePractical: true }).total).toBe(8);
    expect(calculateSchedule({ ...common, includePractical: false }).total).toBe(5);
  });

  it("keeps calendar-day legal edges in the visible order without converting their lag to business days", () => {
    const result = calculateSchedule({
      decisions: decisions(["later-permit", "minister-request"]),
      edges: [
        edge("request-before-permit", "minister-request", "later-permit", {
          lag: 40,
          lagUnit: "CALENDAR_DAY",
        }),
      ],
      durations: durations({ "later-permit": 5, "minister-request": 1 }),
      scenario: "MIN",
      includeConditional: true,
      includePractical: true,
    });

    expect(result.topologicalOrder).toEqual(["minister-request", "later-permit"]);
    expect(result.nodes.find((node) => node.procedureId === "minister-request")?.wave).toBe(0);
    expect(result.nodes.find((node) => node.procedureId === "later-permit")?.wave).toBe(1);
    expect(result.total).toBe(5);
    expect(result.criticalEdgeIds).toEqual([]);
  });

  it("activates a conditioned edge only when its rule matched", () => {
    const conditioned = edge("a-b", "a", "b", {
      conditionRuleId: "rule-a",
    });
    const common = {
      edges: [conditioned],
      durations: durations({ a: 5, b: 3 }),
      scenario: "MIN" as const,
      includeConditional: true,
      includePractical: true,
    };

    expect(
      calculateSchedule({ ...common, decisions: decisions(["a", "b"]) }).total,
    ).toBe(5);
    expect(
      calculateSchedule({
        ...common,
        decisions: decisions(["a", "b"], { a: ["rule-a"] }),
      }).total,
    ).toBe(8);
  });

  it("does not schedule a provisional draft exclusion", () => {
    const excluded = {
      ...decisions(["excluded"])[0],
      status: "POSSIBLY_APPLIES",
      provisionalEffect: "EXCLUDE",
    } as ProcedureDecision;
    const result = calculateSchedule({
      decisions: [excluded],
      edges: [],
      durations: durations({ excluded: 5 }),
      scenario: "MIN",
      includeConditional: true,
      includePractical: true,
    });

    expect(result.topologicalOrder).toEqual([]);
    expect(result.nodes).toEqual([]);
  });

  it("rejects a cyclic selected graph", () => {
    expect(() =>
      calculateSchedule({
        decisions: decisions(["a", "b"]),
        edges: [edge("a-b", "a", "b"), edge("b-a", "b", "a")],
        durations: durations({ a: 1, b: 1 }),
        scenario: "MIN",
        includeConditional: true,
        includePractical: true,
      }),
    ).toThrow("순환");
  });
});

describe("automatic integrated construction timeline", () => {
  it("rewinds MIN and TYPICAL business-day paths from planned construction", () => {
    const common = {
      decisions: decisions(["permit"]),
      edges: [],
      durations: durations({ permit: [5, 20] }),
      includeConditional: true,
      includePractical: true,
      constructionPlan: {
        assessmentDate: "2026-01-15",
        plannedStartDate: "2026-02-01",
        plannedEndDate: "2026-03-31",
      },
      planningDurations: planning({
        permit: {
          minimum: 5,
          typical: 20,
          unit: "BUSINESS_DAY",
          overlapPolicy: "PRE_CONSTRUCTION",
        },
      }),
    };

    const minimum = calculateSchedule({ ...common, scenario: "MIN" });
    const typical = calculateSchedule({ ...common, scenario: "TYPICAL" });

    expect(minimum.projectTimeline).toMatchObject({
      projectStartDate: "2026-01-26",
      adjustedConstructionStartDate: "2026-02-01",
      constructionCompletionDate: "2026-03-31",
      operationReadyDate: "2026-03-31",
      totalCalendarDays: 65,
      permitLeadCalendarDays: 5,
      constructionDelayCalendarDays: 0,
    });
    expect(typical.projectTimeline).toMatchObject({
      projectStartDate: "2026-01-05",
      adjustedConstructionStartDate: "2026-02-01",
      constructionCompletionDate: "2026-03-31",
      operationReadyDate: "2026-03-31",
      totalCalendarDays: 86,
      permitLeadCalendarDays: 26,
      constructionDelayCalendarDays: 0,
    });
    expect(
      minimum.projectTimeline?.nodes.find((node) => node.procedureId === "permit"),
    ).toMatchObject({
      processingDuration: 5,
      startDate: "2026-01-26",
      finishDate: "2026-01-30",
    });
    expect(
      typical.projectTimeline?.nodes.find((node) => node.procedureId === "permit"),
    ).toMatchObject({
      processingDuration: 20,
      startDate: "2026-01-05",
      finishDate: "2026-01-30",
    });
  });

  it("keeps schedule dates independent from the legal assessment date", () => {
    const common = {
      decisions: decisions(["permit"]),
      edges: [],
      durations: durations({ permit: 5 }),
      scenario: "MIN" as const,
      includeConditional: true,
      includePractical: true,
      planningDurations: planning({
        permit: {
          minimum: 5,
          unit: "BUSINESS_DAY",
          overlapPolicy: "PRE_CONSTRUCTION",
        },
      }),
    };
    const earlyAssessment = calculateSchedule({
      ...common,
      constructionPlan: {
        assessmentDate: "2026-01-15",
        plannedStartDate: "2026-02-01",
        plannedEndDate: "2026-03-31",
      },
    });
    const laterAssessment = calculateSchedule({
      ...common,
      constructionPlan: {
        assessmentDate: "2026-01-29",
        plannedStartDate: "2026-02-01",
        plannedEndDate: "2026-03-31",
      },
    });

    expect(earlyAssessment.projectTimeline?.projectStartDate).toBe("2026-01-26");
    expect(laterAssessment.projectTimeline?.projectStartDate).toBe("2026-01-26");
    expect(earlyAssessment.projectTimeline?.nodes[0].startDate).toBe(
      laterAssessment.projectTimeline?.nodes[0].startDate,
    );
    expect(laterAssessment.projectTimeline?.warnings.join(" ")).toContain(
      "검토 기준일 전에 인허가 착수",
    );
  });

  it("latest-start schedules independent parallel permit paths separately", () => {
    const result = calculateSchedule({
      decisions: decisions(["long", "short"]),
      edges: [],
      durations: durations({ long: 20, short: 5 }),
      scenario: "MIN",
      includeConditional: true,
      includePractical: true,
      constructionPlan: {
        assessmentDate: "2026-01-15",
        plannedStartDate: "2026-02-01",
        plannedEndDate: "2026-03-31",
      },
      planningDurations: planning({
        long: { minimum: 20, unit: "BUSINESS_DAY", overlapPolicy: "PRE_CONSTRUCTION" },
        short: { minimum: 5, unit: "BUSINESS_DAY", overlapPolicy: "PRE_CONSTRUCTION" },
      }),
    });
    const nodes = new Map(
      result.projectTimeline?.nodes.map((node) => [node.procedureId, node]),
    );

    expect(result.projectTimeline).toMatchObject({
      projectStartDate: "2026-01-05",
      adjustedConstructionStartDate: "2026-02-01",
      constructionDelayCalendarDays: 0,
    });
    expect(nodes.get("long")).toMatchObject({
      startDate: "2026-01-05",
      finishDate: "2026-01-30",
    });
    expect(nodes.get("short")).toMatchObject({
      startDate: "2026-01-26",
      finishDate: "2026-01-30",
    });
  });

  it("calculates business-day, calendar-day and month durations without unit approximation", () => {
    const result = calculateSchedule({
      decisions: decisions(["business", "calendar", "month"]),
      edges: [
        edge("business-calendar", "business", "calendar"),
        edge("calendar-month", "calendar", "month"),
      ],
      durations: durations({ business: 1, calendar: 1, month: 1 }),
      scenario: "MIN",
      includeConditional: true,
      includePractical: true,
      constructionPlan: {
        assessmentDate: "2026-01-02",
        plannedStartDate: "2026-07-01",
        plannedEndDate: "2026-08-31",
      },
      planningDurations: planning({
        business: {
          minimum: 2,
          unit: "BUSINESS_DAY",
          overlapPolicy: "PRE_CONSTRUCTION",
        },
        calendar: {
          minimum: 3,
          unit: "CALENDAR_DAY",
          overlapPolicy: "PRE_CONSTRUCTION",
        },
        month: {
          minimum: 1,
          unit: "MONTH",
          overlapPolicy: "PRE_CONSTRUCTION",
        },
      }),
    });

    const nodes = new Map(
      result.projectTimeline?.nodes.map((node) => [node.procedureId, node]),
    );
    expect(nodes.get("business")).toMatchObject({
      startDate: "2026-05-27",
      finishDate: "2026-05-28",
      processingUnit: "BUSINESS_DAY",
    });
    expect(nodes.get("calendar")).toMatchObject({
      startDate: "2026-05-29",
      finishDate: "2026-05-31",
      processingUnit: "CALENDAR_DAY",
    });
    expect(nodes.get("month")).toMatchObject({
      startDate: "2026-06-01",
      finishDate: "2026-06-30",
      processingUnit: "MONTH",
    });
    expect(result.projectTimeline?.permitLeadCalendarDays).toBe(35);
  });

  it("rewinds start-to-start and finish-to-finish lags in their original units", () => {
    const result = calculateSchedule({
      decisions: decisions(["ss-first", "ss-next", "ff-first", "ff-next"]),
      edges: [
        edge("ss", "ss-first", "ss-next", {
          relation: "START_TO_START",
          lag: 2,
          lagUnit: "CALENDAR_DAY",
        }),
        edge("ff", "ff-first", "ff-next", {
          relation: "FINISH_TO_FINISH",
          lag: 1,
          lagUnit: "BUSINESS_DAY",
        }),
      ],
      durations: durations({ "ss-first": 4, "ss-next": 3, "ff-first": 2, "ff-next": 4 }),
      scenario: "MIN",
      includeConditional: true,
      includePractical: true,
      constructionPlan: {
        assessmentDate: "2026-01-02",
        plannedStartDate: "2026-07-01",
        plannedEndDate: "2026-08-31",
      },
      planningDurations: planning({
        "ss-first": { minimum: 4, unit: "CALENDAR_DAY", overlapPolicy: "PRE_CONSTRUCTION" },
        "ss-next": { minimum: 3, unit: "CALENDAR_DAY", overlapPolicy: "PRE_CONSTRUCTION" },
        "ff-first": { minimum: 2, unit: "BUSINESS_DAY", overlapPolicy: "PRE_CONSTRUCTION" },
        "ff-next": { minimum: 4, unit: "BUSINESS_DAY", overlapPolicy: "PRE_CONSTRUCTION" },
      }),
    });
    const nodes = new Map(
      result.projectTimeline?.nodes.map((node) => [node.procedureId, node]),
    );

    expect(nodes.get("ss-first")).toMatchObject({
      startDate: "2026-06-26",
      finishDate: "2026-06-29",
    });
    expect(nodes.get("ss-next")).toMatchObject({
      startDate: "2026-06-28",
      finishDate: "2026-06-30",
    });
    expect(nodes.get("ff-first")).toMatchObject({
      startDate: "2026-06-26",
      finishDate: "2026-06-29",
    });
    expect(nodes.get("ff-next")).toMatchObject({
      startDate: "2026-06-25",
      finishDate: "2026-06-30",
    });
  });

  it("clamps month-based durations to the last day of shorter months", () => {
    const result = calculateSchedule({
      decisions: decisions(["month-end"]),
      edges: [],
      durations: durations({ "month-end": 1 }),
      scenario: "MIN",
      includeConditional: true,
      includePractical: true,
      constructionPlan: {
        assessmentDate: "2026-01-31",
        plannedStartDate: "2026-03-31",
        plannedEndDate: "2026-12-31",
      },
      planningDurations: planning({
        "month-end": {
          minimum: 1,
          unit: "MONTH",
          overlapPolicy: "PRE_CONSTRUCTION",
        },
      }),
    });

    expect(result.projectTimeline?.nodes[0]).toMatchObject({
      startDate: "2026-02-28",
      finishDate: "2026-03-27",
      processingUnit: "MONTH",
    });
  });

  it("rewinds long pre-construction work instead of moving the construction plan", () => {
    const result = calculateSchedule({
      decisions: decisions(["permit"]),
      edges: [],
      durations: durations({ permit: 1 }),
      scenario: "MIN",
      includeConditional: true,
      includePractical: true,
      constructionPlan: {
        assessmentDate: "2026-01-02",
        plannedStartDate: "2026-02-01",
        plannedEndDate: "2026-03-31",
      },
      planningDurations: planning({
        permit: {
          minimum: 3,
          unit: "MONTH",
          overlapPolicy: "PRE_CONSTRUCTION",
        },
      }),
    });

    expect(result.projectTimeline).toMatchObject({
      projectStartDate: "2025-11-01",
      plannedConstructionStartDate: "2026-02-01",
      plannedConstructionEndDate: "2026-03-31",
      adjustedConstructionStartDate: "2026-02-01",
      constructionCompletionDate: "2026-03-31",
      operationReadyDate: "2026-03-31",
      constructionCalendarDays: 59,
      constructionDelayCalendarDays: 0,
      totalCalendarDays: 151,
    });
  });

  it("moves construction only when a fixed completion checkpoint makes the plan infeasible", () => {
    const result = calculateSchedule({
      decisions: decisions(["checkpoint", "permit"]),
      edges: [edge("checkpoint-permit", "checkpoint", "permit")],
      durations: durations({ checkpoint: null, permit: 5 }),
      scenario: "MIN",
      includeConditional: true,
      includePractical: true,
      constructionPlan: {
        assessmentDate: "2026-02-05",
        plannedStartDate: "2026-02-01",
        plannedEndDate: "2026-03-31",
      },
      planningDurations: planning({
        checkpoint: {
          minimum: 0,
          unit: "CALENDAR_DAY",
          overlapPolicy: "PRE_CONSTRUCTION",
          evidenceType: "INSUFFICIENT_DATA",
          completedCheckpoint: {
            label: "관계기관 협의 완료",
            completedDate: "2026-02-05",
            confirmedAsOfDate: "2026-02-05",
          },
        },
        permit: {
          minimum: 5,
          unit: "BUSINESS_DAY",
          overlapPolicy: "PRE_CONSTRUCTION",
        },
      }),
    });

    expect(result.projectTimeline).toMatchObject({
      plannedConstructionStartDate: "2026-02-01",
      adjustedConstructionStartDate: "2026-02-12",
      constructionCompletionDate: "2026-04-11",
      constructionDelayCalendarDays: 11,
    });
    expect(result.projectTimeline?.nodes.find(
      (node) => node.procedureId === "checkpoint",
    )).toMatchObject({ startDate: "2026-02-05", finishDate: "2026-02-05" });
    expect(result.projectTimeline?.nodes.find(
      (node) => node.procedureId === "permit",
    )).toMatchObject({ startDate: "2026-02-05", finishDate: "2026-02-11" });
  });

  it("absorbs a during-construction procedure that finishes before completion", () => {
    const result = calculateSchedule({
      decisions: decisions(["during"]),
      edges: [],
      durations: durations({ during: 20 }),
      scenario: "MIN",
      includeConditional: true,
      includePractical: true,
      constructionPlan,
      planningDurations: planning({
        during: {
          minimum: 20,
          unit: "BUSINESS_DAY",
          overlapPolicy: "DURING_CONSTRUCTION",
        },
      }),
    });

    expect(result.projectTimeline).toMatchObject({
      constructionCompletionDate: "2026-05-31",
      operationReadyDate: "2026-05-31",
      totalCalendarDays: 120,
      absorbedByConstructionCalendarDays: 33,
    });
    expect(
      result.projectTimeline?.nodes.find((node) => node.procedureId === "during"),
    ).toMatchObject({
      startDate: "2026-02-01",
      finishDate: "2026-03-05",
      overlapsConstruction: true,
      overlapWithConstructionDays: 33,
      extendsOperationReady: false,
    });
  });

  it("starts a completion inspection after construction and extends operation readiness", () => {
    const result = calculateSchedule({
      decisions: decisions(["inspection"]),
      edges: [],
      durations: durations({ inspection: 5 }),
      scenario: "MIN",
      includeConditional: true,
      includePractical: true,
      constructionPlan,
      planningDurations: planning({
        inspection: {
          minimum: 5,
          unit: "BUSINESS_DAY",
          overlapPolicy: "PRE_OPERATION",
          releasePolicy: "CONSTRUCTION_FINISH",
        },
      }),
    });

    expect(result.projectTimeline).toMatchObject({
      constructionCompletionDate: "2026-05-31",
      operationReadyDate: "2026-06-05",
      totalCalendarDays: 125,
    });
    expect(
      result.projectTimeline?.nodes.find(
        (node) => node.procedureId === "inspection",
      ),
    ).toMatchObject({
      startDate: "2026-06-01",
      finishDate: "2026-06-05",
      overlapsConstruction: false,
      extendsOperationReady: true,
    });
  });

  it("dates post-operation work separately from the operation-ready total", () => {
    const result = calculateSchedule({
      decisions: decisions(["inspection", "report"]),
      edges: [edge("inspection-report", "inspection", "report")],
      durations: durations({ inspection: 5, report: 1 }),
      scenario: "MIN",
      includeConditional: true,
      includePractical: true,
      constructionPlan,
      planningDurations: planning({
        inspection: {
          minimum: 5,
          unit: "BUSINESS_DAY",
          overlapPolicy: "PRE_OPERATION",
          releasePolicy: "CONSTRUCTION_FINISH",
        },
        report: {
          minimum: 1,
          unit: "MONTH",
          overlapPolicy: "POST_OPERATION",
          releasePolicy: "OPERATION_READY",
        },
      }),
    });

    expect(result.projectTimeline).toMatchObject({
      operationReadyDate: "2026-06-05",
      postOperationCompletionDate: "2026-07-05",
      totalCalendarDays: 125,
      postOperationProcedureIds: ["report"],
    });
    expect(
      result.projectTimeline?.nodes.find((node) => node.procedureId === "report"),
    ).toMatchObject({
      startDate: "2026-06-06",
      finishDate: "2026-07-05",
      excludedFromOperationReady: true,
    });
  });

  it("returns null total and a visible schedule floor for an unknown blocking duration", () => {
    const result = calculateSchedule({
      decisions: decisions(["unknown"]),
      edges: [],
      durations: durations({ unknown: null }),
      scenario: "MIN",
      includeConditional: true,
      includePractical: true,
      constructionPlan,
      planningDurations: planning({
        unknown: {
          minimum: null,
          typical: null,
          unit: null,
          overlapPolicy: "PRE_OPERATION",
          releasePolicy: "CONSTRUCTION_FINISH",
        },
      }),
    });

    expect(result.projectTimeline).toMatchObject({
      durationStatus: "MINIMUM_ONLY",
      complete: false,
      totalCalendarDays: null,
      operationReadyDate: null,
      minimumKnownCompletionDate: "2026-05-31",
      minimumKnownCalendarDays: 120,
      unknownPlanningDurationProcedureIds: ["unknown"],
    });
    expect(result.projectTimeline?.warnings.join(" ")).toContain("일정 하한");
  });

  it("uses a user-entered end-to-end duration without hiding the official gap", () => {
    const result = calculateSchedule({
      decisions: decisions(["unknown"]),
      edges: [],
      durations: durations({ unknown: null }),
      scenario: "USER",
      includeConditional: true,
      includePractical: true,
      constructionPlan,
      planningDurations: planning({
        unknown: {
          minimum: null,
          typical: null,
          unit: null,
          overlapPolicy: "PRE_OPERATION",
          releasePolicy: "CONSTRUCTION_FINISH",
        },
      }),
      userDurationOverrides: {
        unknown: { value: 10, unit: "CALENDAR_DAY" },
      },
    });

    expect(result.projectTimeline).toMatchObject({
      durationStatus: "CALCULATED",
      calculationBasis: "USER_EXPECTED",
      totalCalendarDays: 130,
      operationReadyDate: "2026-06-10",
      unknownPlanningDurationProcedureIds: [],
      officialUnknownPlanningDurationProcedureIds: ["unknown"],
      userDurationOverrideProcedureIds: ["unknown"],
    });
    expect(result.projectTimeline?.nodes[0]).toMatchObject({
      processingDuration: 10,
      processingUnit: "CALENDAR_DAY",
      officialProcessingDuration: null,
      officialProcessingUnit: null,
      durationSource: "USER_EXPECTED",
      startDate: "2026-06-01",
      finishDate: "2026-06-10",
    });
    expect(result.projectTimeline?.warnings.join(" ")).toContain(
      "법정 처리기간이나 기관의 공식 평균이 아닙니다",
    );
  });

  it("treats a user total as complete while retaining official component gaps", () => {
    const result = calculateSchedule({
      decisions: decisions(["permit"]),
      edges: [],
      durations: durations({ permit: 7 }),
      scenario: "USER",
      includeConditional: true,
      includePractical: true,
      constructionPlan,
      planningDurations: planning({
        permit: {
          minimum: 7,
          typical: 7,
          unit: "BUSINESS_DAY",
          overlapPolicy: "PRE_CONSTRUCTION",
          endToEndMissingComponents: ["신청인 준비", "관계기관 협의"],
        },
      }),
      userDurationOverrides: {
        permit: { value: 1, unit: "MONTH" },
      },
    });

    expect(result.projectTimeline).toMatchObject({
      incompleteDurationComponentProcedureIds: [],
      officialIncompleteDurationComponentProcedureIds: ["permit"],
      calculationBasis: "USER_EXPECTED",
    });
    expect(result.projectTimeline?.nodes[0]).toMatchObject({
      processingDuration: 1,
      processingUnit: "MONTH",
      officialProcessingDuration: 7,
      officialProcessingUnit: "BUSINESS_DAY",
      durationSource: "USER_EXPECTED",
    });
  });

  it("keeps a completed checkpoint visible without treating its unknown original duration as remaining work", () => {
    const result = calculateSchedule({
      decisions: decisions(["checkpoint", "permit"]),
      edges: [edge("checkpoint-permit", "checkpoint", "permit")],
      durations: durations({ checkpoint: null, permit: 5 }),
      scenario: "MIN",
      includeConditional: true,
      includePractical: true,
      constructionPlan,
      planningDurations: planning({
        checkpoint: {
          minimum: 0,
          typical: 0,
          unit: "CALENDAR_DAY",
          overlapPolicy: "PRE_CONSTRUCTION",
          evidenceType: "INSUFFICIENT_DATA",
          endToEndMissingComponents: [],
          completedCheckpoint: {
            label: "입주계약 체결 완료",
            completedDate: null,
            confirmedAsOfDate: "2026-01-02",
          },
        },
        permit: {
          minimum: 5,
          unit: "BUSINESS_DAY",
          overlapPolicy: "PRE_CONSTRUCTION",
          endToEndMissingComponents: [],
        },
      }),
    });

    expect(result.complete).toBe(true);
    expect(result.completedCheckpoints).toEqual([
      {
        procedureId: "checkpoint",
        label: "입주계약 체결 완료",
        completedDate: null,
        confirmedAsOfDate: "2026-01-02",
      },
    ]);
    expect(result.unknownDurationProcedureIds).not.toContain("checkpoint");
    expect(result.projectTimeline?.unknownPlanningDurationProcedureIds).not.toContain(
      "checkpoint",
    );
    expect(result.projectTimeline?.nodes.find(
      (node) => node.procedureId === "checkpoint",
    )).toMatchObject({
      processingDuration: 0,
      completedCheckpoint: {
        label: "입주계약 체결 완료",
        completedDate: null,
        confirmedAsOfDate: "2026-01-02",
      },
    });
    expect(result.projectTimeline?.nodes.find(
      (node) => node.procedureId === "permit",
    )?.processingDuration).toBe(5);
  });

  it("lets a confirmed completion supersede only a conflicting practical predecessor", () => {
    const result = calculateSchedule({
      decisions: decisions(["recommended-first", "completed", "legal-first"]),
      edges: [
        edge("recommended-completed", "recommended-first", "completed", {
          strength: "PRACTICAL",
        }),
        edge("legal-completed", "legal-first", "completed"),
      ],
      durations: durations({ "recommended-first": 5, completed: null, "legal-first": 5 }),
      planningDurations: planning({
        "recommended-first": { minimum: 5, unit: "BUSINESS_DAY", overlapPolicy: "PRE_CONSTRUCTION" },
        "legal-first": { minimum: 5, unit: "BUSINESS_DAY", overlapPolicy: "PRE_CONSTRUCTION" },
        completed: {
          minimum: 0,
          unit: "CALENDAR_DAY",
          overlapPolicy: "PRE_CONSTRUCTION",
          completedCheckpoint: {
            label: "완료 확인",
            completedDate: null,
            confirmedAsOfDate: "2026-01-02",
          },
        },
      }),
      scenario: "MIN",
      includeConditional: true,
      includePractical: true,
      constructionPlan,
    });

    expect(result.activeEdgeIds).not.toContain("recommended-completed");
    expect(result.activeEdgeIds).toContain("legal-completed");
    expect(result.warnings.join(" ")).toContain("실무 권장 선후행 1건");
    expect(result.projectTimeline?.warnings.join(" ")).toContain("법적 선행절차 1건");
  });

  it("keeps a historical checkpoint at its actual date and ignores future incoming work in remaining-time arithmetic", () => {
    const common = {
      decisions: decisions(["future-permit", "checkpoint", "successor"]),
      edges: [
        edge("future-checkpoint", "future-permit", "checkpoint"),
        edge("checkpoint-successor", "checkpoint", "successor"),
      ],
      durations: durations({
        "future-permit": 10,
        checkpoint: null,
        successor: 5,
      }),
      scenario: "MIN" as const,
      includeConditional: true,
      includePractical: true,
      planningDurations: planning({
        "future-permit": {
          minimum: 10,
          unit: "BUSINESS_DAY",
          overlapPolicy: "PRE_CONSTRUCTION",
          endToEndMissingComponents: [],
        },
        checkpoint: {
          minimum: 0,
          typical: 0,
          unit: "CALENDAR_DAY",
          overlapPolicy: "PRE_CONSTRUCTION",
          evidenceType: "INSUFFICIENT_DATA",
          endToEndMissingComponents: [],
          completedCheckpoint: {
            label: "계획 승인·고시 완료",
            completedDate: "2026-01-01",
            confirmedAsOfDate: "2026-01-02",
          },
        },
        successor: {
          minimum: 5,
          unit: "BUSINESS_DAY",
          overlapPolicy: "PRE_CONSTRUCTION",
          endToEndMissingComponents: [],
        },
      }),
    };
    const result = calculateSchedule({ ...common, constructionPlan });
    const checkpointNode = result.nodes.find(
      (node) => node.procedureId === "checkpoint",
    );
    const datedCheckpoint = result.projectTimeline?.nodes.find(
      (node) => node.procedureId === "checkpoint",
    );

    expect(result.total).toBe(10);
    expect(checkpointNode).toMatchObject({
      earliestStart: 0,
      earliestFinish: 0,
      latestStart: 0,
      latestFinish: 0,
      critical: false,
    });
    expect(result.nodes.find(
      (node) => node.procedureId === "successor",
    )).toMatchObject({ earliestStart: 0, earliestFinish: 5 });
    expect(datedCheckpoint).toMatchObject({
      startDate: "2026-01-01",
      finishDate: "2026-01-01",
      processingDuration: 0,
      extendsOperationReady: false,
    });
    expect(result.projectTimeline?.nodes.find(
      (node) => node.procedureId === "successor",
    )?.startDate).toBe("2026-01-26");
  });

  it("exposes only validated completed checkpoints when construction dates are absent", () => {
    const valid = calculateSchedule({
      decisions: decisions(["checkpoint"]),
      edges: [],
      durations: durations({ checkpoint: null }),
      scenario: "MIN",
      includeConditional: true,
      includePractical: true,
      planningDurations: planning({
        checkpoint: {
          minimum: 0,
          typical: 0,
          unit: "CALENDAR_DAY",
          overlapPolicy: "PRE_CONSTRUCTION",
          evidenceType: "INSUFFICIENT_DATA",
          endToEndMissingComponents: [],
          completedCheckpoint: {
            label: "입주계약 체결 완료",
            completedDate: null,
            confirmedAsOfDate: "2026-01-02",
          },
        },
      }),
    });
    const malformed = calculateSchedule({
      decisions: decisions(["checkpoint"]),
      edges: [],
      durations: durations({ checkpoint: null }),
      scenario: "MIN",
      includeConditional: true,
      includePractical: true,
      constructionPlan,
      planningDurations: planning({
        checkpoint: {
          minimum: 0,
          typical: 0,
          unit: "CALENDAR_DAY",
          overlapPolicy: "PRE_CONSTRUCTION",
          evidenceType: "INSUFFICIENT_DATA",
          endToEndMissingComponents: [],
          completedCheckpoint: {
            label: "입주계약 체결 완료",
            completedDate: "2026-01-03",
            confirmedAsOfDate: "2026-01-02",
          },
        },
      }),
    });

    expect(valid.projectTimeline).toBeNull();
    expect(valid.completedCheckpoints).toEqual([
      expect.objectContaining({
        procedureId: "checkpoint",
        confirmedAsOfDate: "2026-01-02",
      }),
    ]);
    expect(valid.unknownDurationProcedureIds).not.toContain("checkpoint");
    expect(malformed.completedCheckpoints).toEqual([]);
    expect(malformed.unknownDurationProcedureIds).toContain("checkpoint");
    expect(malformed.projectTimeline?.nodes.find(
      (node) => node.procedureId === "checkpoint",
    )?.completedCheckpoint).toBeNull();
  });

  it("keeps a known processing period as a floor when preparation or consultation is missing", () => {
    const result = calculateSchedule({
      decisions: decisions(["permit"]),
      edges: [],
      durations: durations({ permit: 5 }),
      scenario: "MIN",
      includeConditional: true,
      includePractical: true,
      constructionPlan,
      planningDurations: planning({
        permit: {
          minimum: 5,
          unit: "BUSINESS_DAY",
          overlapPolicy: "PRE_CONSTRUCTION",
          endToEndMissingComponents: ["신청인 준비", "관계기관 협의"],
        },
      }),
    });

    expect(result.projectTimeline).toMatchObject({
      durationStatus: "MINIMUM_ONLY",
      totalCalendarDays: null,
      operationReadyDate: null,
      permitLeadCalendarDays: null,
      incompleteDurationComponentProcedureIds: ["permit"],
    });
    expect(result.projectTimeline?.minimumKnownCalendarDays).toBeGreaterThan(0);
    expect(result.projectTimeline?.warnings.join(" ")).toContain(
      "신청인 준비·기관 심사·관계기관 협의·전체 경과",
    );
  });

  it("does not calculate beyond the reviewed business-calendar coverage", () => {
    const result = calculateSchedule({
      decisions: decisions(["permit"]),
      edges: [],
      durations: durations({ permit: 40 }),
      scenario: "MIN",
      includeConditional: true,
      includePractical: true,
      constructionPlan: {
        assessmentDate: "2025-01-01",
        plannedStartDate: "2025-01-10",
        plannedEndDate: "2025-03-31",
      },
      planningDurations: planning({
        permit: {
          minimum: 40,
          unit: "BUSINESS_DAY",
          overlapPolicy: "PRE_CONSTRUCTION",
        },
      }),
    });

    expect(result.projectTimeline).toMatchObject({
      durationStatus: "MINIMUM_ONLY",
      totalCalendarDays: null,
      operationReadyDate: null,
    });
    expect(result.projectTimeline?.warnings.join(" ")).toContain(
      "공휴일 달력 지원범위",
    );
  });

  it.each([
    [{ ...constructionPlan, assessmentDate: "2026-02-30" }, "유효한 평가일"],
    [{ ...constructionPlan, plannedStartDate: "2026-13-01" }, "공사 시작일·완료일"],
    [
      {
        ...constructionPlan,
        plannedStartDate: "2026-06-01",
        plannedEndDate: "2026-05-31",
      },
      "빠를 수 없습니다",
    ],
  ])("rejects an invalid construction plan", (invalidPlan, warning) => {
    const result = calculateSchedule({
      decisions: decisions(["permit"]),
      edges: [],
      durations: durations({ permit: 5 }),
      scenario: "MIN",
      includeConditional: true,
      includePractical: true,
      constructionPlan: invalidPlan,
      planningDurations: planning({
        permit: {
          minimum: 5,
          unit: "BUSINESS_DAY",
          overlapPolicy: "PRE_CONSTRUCTION",
        },
      }),
    });

    expect(result.projectTimeline).toBeNull();
    expect(result.total).toBe(5);
    expect(result.warnings.join(" ")).toContain(warning);
  });

  it("calculates a daily plan that starts before the legal assessment date", () => {
    const result = calculateSchedule({
      decisions: decisions(["permit"]),
      edges: [],
      durations: durations({ permit: 5 }),
      scenario: "MIN",
      includeConditional: true,
      includePractical: true,
      constructionPlan: {
        assessmentDate: "2026-08-21",
        plannedStartDate: "2026-07-01",
        plannedEndDate: "2026-12-31",
      },
      planningDurations: planning({
        permit: {
          minimum: 5,
          unit: "BUSINESS_DAY",
          overlapPolicy: "PRE_CONSTRUCTION",
        },
      }),
    });

    expect(result.projectTimeline).toMatchObject({
      projectStartDate: "2026-06-24",
      plannedConstructionStartDate: "2026-07-01",
      plannedConstructionEndDate: "2026-12-31",
      constructionCalendarDays: 184,
    });
    expect(result.projectTimeline?.nodes[0]).toMatchObject({
      startDate: "2026-06-24",
      finishDate: "2026-06-30",
    });
    expect(result.projectTimeline?.warnings.join(" ")).toContain(
      "검토 기준일 전에 인허가 착수",
    );
  });

  it("detects a cycle present only in the integrated mixed-unit graph", () => {
    expect(() =>
      calculateSchedule({
        decisions: decisions(["a", "b"]),
        edges: [
          edge("a-b", "a", "b", { lagUnit: "MONTH" }),
          edge("b-a", "b", "a", { lagUnit: "MONTH" }),
        ],
        durations: durations({ a: 1, b: 1 }),
        scenario: "MIN",
        includeConditional: true,
        includePractical: true,
        constructionPlan,
        planningDurations: planning({
          a: {
            minimum: 1,
            unit: "MONTH",
            overlapPolicy: "PRE_CONSTRUCTION",
          },
          b: {
            minimum: 1,
            unit: "MONTH",
            overlapPolicy: "PRE_CONSTRUCTION",
          },
        }),
      }),
    ).toThrow("순환");
  });
});
