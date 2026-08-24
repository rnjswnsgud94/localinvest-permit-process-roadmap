import { describe, expect, it } from "vitest";

import {
  isVerifiedLegalSequence,
  verifiedSequenceCitationIds,
} from "@/lib/data/edge-evidence";
import { catalog } from "@/lib/data/catalog";
import type {
  LegalCitation,
  LegalSource,
  Procedure,
  ProcedureEdge,
} from "@/lib/domain/schemas";
import {
  coreFlowEdges,
  describeFlowEdges,
  flowEdgeEvidence,
} from "@/lib/engine/flow-edges";
import { evaluateProject } from "@/lib/engine/pipeline";
import type { ScheduleNode } from "@/lib/engine/schedule";

function edge(strength: ProcedureEdge["strength"]): ProcedureEdge {
  return {
    id: `${strength.toLowerCase()}-edge`,
    from: "permit",
    to: "construction-start-report",
    relation: "FINISH_TO_START",
    lag: 0,
    lagUnit: "BUSINESS_DAY",
    strength,
    conditionRuleId: null,
    citationIds: ["sequence-citation"],
    branchId: null,
    note: "test",
  };
}

const citation = {
  id: "sequence-citation",
  sourceId: "source",
  role: "SEQUENCE",
} as LegalCitation;

function source(values: Partial<LegalSource> = {}) {
  return {
    id: "source",
    status: "AUTHORITATIVE",
    effectiveDate: "2026-01-01",
    repealDate: null,
    ...values,
  } as LegalSource;
}

describe("flow edge evidence and bottleneck diagnostics", () => {
  it("requires an effective authoritative sequence citation and legal-hard strength", () => {
    const ids = verifiedSequenceCitationIds({
      citations: [citation],
      sources: [source()],
      assessmentDate: "2026-08-23",
    });

    expect(isVerifiedLegalSequence(edge("LEGAL_HARD"), ids)).toBe(true);
    expect(isVerifiedLegalSequence(edge("PRACTICAL"), ids)).toBe(false);
    expect(flowEdgeEvidence(edge("PRACTICAL"), ids)).toBe("PRACTICAL_RELATION");
  });

  it("does not treat future, repealed, or unverified sources as current sequence evidence", () => {
    expect(verifiedSequenceCitationIds({
      citations: [citation],
      sources: [source({ effectiveDate: "2027-01-01" })],
      assessmentDate: "2026-08-23",
    }).has("sequence-citation")).toBe(false);
    expect(verifiedSequenceCitationIds({
      citations: [citation],
      sources: [source({ repealDate: "2026-08-01" })],
      assessmentDate: "2026-08-23",
    }).has("sequence-citation")).toBe(false);
    expect(verifiedSequenceCitationIds({
      citations: [citation],
      sources: [source({ status: "UNVERIFIED" })],
      assessmentDate: "2026-08-23",
    }).has("sequence-citation")).toBe(false);
  });

  it("excludes unknown-duration and post-operation edges from core bottleneck candidates", () => {
    const legalEdge = edge("LEGAL_HARD");
    const nodes = [
      {
        procedureId: legalEdge.from,
        earliestStart: 0,
        earliestFinish: 5,
        critical: true,
      },
      {
        procedureId: legalEdge.to,
        earliestStart: 5,
        earliestFinish: 7,
        critical: true,
      },
    ] as ScheduleNode[];
    const stages = new Map<string, Procedure["stage"]>([
      [legalEdge.from, "PRE_CONSTRUCTION"],
      [legalEdge.to, "DURING_CONSTRUCTION"],
    ]);
    const common = {
      edges: [legalEdge],
      scheduleNodes: nodes,
      timelineNodes: [],
      criticalEdgeIds: [legalEdge.id],
      procedureStageById: stages,
      sequenceCitationIds: new Set<string>(),
    };

    expect(describeFlowEdges({
      ...common,
      unknownDurationProcedureIds: [],
    })[0].bottleneckCandidate).toBe(true);
    expect(describeFlowEdges({
      ...common,
      unknownDurationProcedureIds: [legalEdge.from],
    })[0].bottleneckCandidate).toBe(false);

    stages.set(legalEdge.to, "POST_OPERATION");
    expect(describeFlowEdges({
      ...common,
      unknownDurationProcedureIds: [],
    })[0].bottleneckCandidate).toBe(false);
  });

  it("adds a small set of known-duration bottlenecks to the default flow", () => {
    for (const scenario of catalog.scenarios.slice(0, 4)) {
      const evaluation = evaluateProject(scenario.answers);
      const schedule = evaluation.schedules.TYPICAL;
      const scheduledIds = new Set(
        schedule.nodes.map((node) => node.procedureId),
      );
      const sequenceIds = verifiedSequenceCitationIds({
        citations: catalog.citations,
        sources: catalog.legalSources,
        assessmentDate: scenario.answers.assessmentDate,
      });
      const descriptors = describeFlowEdges({
        edges: catalog.edges.filter(
          (item) =>
            schedule.activeEdgeIds.includes(item.id) &&
            scheduledIds.has(item.from) &&
            scheduledIds.has(item.to),
        ),
        scheduleNodes: schedule.nodes,
        timelineNodes: schedule.projectTimeline?.nodes ?? [],
        criticalEdgeIds: schedule.criticalEdgeIds,
        procedureStageById: new Map(
          evaluation.decisions.map((decision) => [
            decision.procedure.id,
            decision.procedure.stage,
          ]),
        ),
        unknownDurationProcedureIds: schedule.unknownDurationProcedureIds,
        sequenceCitationIds: sequenceIds,
      });
      const core = coreFlowEdges(descriptors);
      const verifiedCount = descriptors.filter(
        (descriptor) => descriptor.verifiedSequence,
      ).length;

      expect(core.length).toBeGreaterThan(verifiedCount);
      expect(core.length).toBeLessThanOrEqual(18);
      expect(
        core.filter((descriptor) => descriptor.bottleneckCandidate),
      ).not.toHaveLength(0);
    }
  });

  it("orders each capital-region traffic plan no later than the road-occupation application", () => {
    const regionalEdges = ["seoul", "incheon", "gyeonggi"].map((regionId) =>
      catalog.edges.find(
        (item) => item.id === `edge-exp-${regionId}-traffic-flow-plan-to-road-occupation`,
      ),
    );

    for (const regionalEdge of regionalEdges) {
      expect(regionalEdge).toMatchObject({
        from: "road-occupation-traffic-flow-plan-review",
        to: "road-occupation-permit",
        relation: "START_TO_START",
        strength: "PRACTICAL",
      });
    }
    expect(
      catalog.edges.some(
        (item) =>
          item.from === "road-occupation-permit" &&
          item.to === "road-occupation-traffic-flow-plan-review",
      ),
    ).toBe(false);
  });

  it("keeps the railway-adjacent start proxy out of legal-hard project sequencing", () => {
    expect(
      catalog.edges.find(
        (item) => item.id === "edge-exp-railway-protection-report-to-start",
      ),
    ).toMatchObject({
      from: "railway-protection-zone-action-report",
      to: "construction-start-report",
      strength: "PRACTICAL",
    });
  });
});
