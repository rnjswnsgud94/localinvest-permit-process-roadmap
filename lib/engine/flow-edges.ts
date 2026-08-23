import type { Procedure, ProcedureEdge } from "@/lib/domain/schemas";
import { isVerifiedLegalSequence } from "@/lib/data/edge-evidence";
import type { ProjectTimelineNode, ScheduleNode } from "@/lib/engine/schedule";

export const maximumCoreConnectorCount = 18;

const flowGateProcedureIds = new Set([
  "ai-data-center-one-stop-result",
  "building-use-approval",
  "construction-start-report",
  "factory-completion-report-complex",
  "factory-completion-report-offsite",
]);

export type FlowEdgeEvidence =
  | "VERIFIED_LEGAL_SEQUENCE"
  | "REGISTERED_LEGAL_RELATION"
  | "PRACTICAL_RELATION"
  | "ADVISORY_RELATION";

export type FlowEdgeDescriptor = {
  edge: ProcedureEdge;
  evidence: FlowEdgeEvidence;
  verifiedSequence: boolean;
  binding: boolean;
  bottleneckCandidate: boolean;
  incomingCount: number;
  score: number;
};

function approximatelyEqual(left: number, right: number) {
  return Math.abs(left - right) < 1e-9;
}

/**
 * Returns whether this relation is the active constraint that determines the
 * target node's earliest start in the current schedule calculation.
 *
 * Calendar/month lags cannot be compared to the business-day CPM node. A
 * zero-lag relation is still comparable because no unit conversion occurs.
 */
export function isBindingScheduleEdge(
  edge: ProcedureEdge,
  scheduleNodeById: ReadonlyMap<string, ScheduleNode>,
) {
  const source = scheduleNodeById.get(edge.from);
  const target = scheduleNodeById.get(edge.to);
  if (!source || !target) return false;
  if (edge.lag > 0 && edge.lagUnit !== "BUSINESS_DAY") return false;

  const lag = edge.lag;
  const targetDuration = target.earliestFinish - target.earliestStart;
  const constrainedStart = edge.relation === "FINISH_TO_START"
    ? source.earliestFinish + lag
    : edge.relation === "START_TO_START"
      ? source.earliestStart + lag
      : source.earliestFinish + lag - targetDuration;

  return approximatelyEqual(constrainedStart, target.earliestStart);
}

export function flowEdgeEvidence(
  edge: ProcedureEdge,
  sequenceCitationIds: ReadonlySet<string>,
): FlowEdgeEvidence {
  if (isVerifiedLegalSequence(edge, sequenceCitationIds)) {
    return "VERIFIED_LEGAL_SEQUENCE";
  }
  if (edge.strength === "LEGAL_HARD") return "REGISTERED_LEGAL_RELATION";
  if (edge.strength === "PRACTICAL") return "PRACTICAL_RELATION";
  return "ADVISORY_RELATION";
}

export function describeFlowEdges({
  edges,
  scheduleNodes,
  timelineNodes,
  criticalEdgeIds,
  procedureStageById,
  unknownDurationProcedureIds,
  sequenceCitationIds,
}: {
  edges: ProcedureEdge[];
  scheduleNodes: ScheduleNode[];
  timelineNodes: ProjectTimelineNode[];
  criticalEdgeIds: string[];
  procedureStageById: ReadonlyMap<string, Procedure["stage"]>;
  unknownDurationProcedureIds: string[];
  sequenceCitationIds: ReadonlySet<string>;
}): FlowEdgeDescriptor[] {
  const scheduleNodeById = new Map(
    scheduleNodes.map((node) => [node.procedureId, node]),
  );
  const timelineNodeById = new Map(
    timelineNodes.map((node) => [node.procedureId, node]),
  );
  const criticalEdgeIdSet = new Set(criticalEdgeIds);
  const unknownDurationIds = new Set(unknownDurationProcedureIds);
  const incomingCountById = new Map<string, number>();
  for (const edge of edges) {
    incomingCountById.set(edge.to, (incomingCountById.get(edge.to) ?? 0) + 1);
  }

  return edges.map((edge) => {
    const source = scheduleNodeById.get(edge.from);
    const target = scheduleNodeById.get(edge.to);
    const targetTimeline = timelineNodeById.get(edge.to);
    const evidence = flowEdgeEvidence(edge, sequenceCitationIds);
    const verifiedSequence = evidence === "VERIFIED_LEGAL_SEQUENCE";
    const binding = criticalEdgeIdSet.has(edge.id);
    const incomingCount = incomingCountById.get(edge.to) ?? 0;
    const sourceStage = procedureStageById.get(edge.from);
    const targetStage = procedureStageById.get(edge.to);
    const bottleneckCandidate =
      binding &&
      !unknownDurationIds.has(edge.from) &&
      !unknownDurationIds.has(edge.to) &&
      sourceStage !== undefined &&
      targetStage !== undefined &&
      sourceStage !== "POST_OPERATION" &&
      targetStage !== "POST_OPERATION" &&
      (sourceStage !== targetStage || flowGateProcedureIds.has(edge.to));
    const score =
      (targetTimeline?.extendsOperationReady ? 10_000 : 0) +
      (source?.critical && target?.critical ? 5_000 : 0) +
      incomingCount * 500 +
      Math.max(0, target?.earliestStart ?? 0) * 10 +
      (edge.strength === "LEGAL_HARD" ? 100 : 50) +
      (edge.relation === "FINISH_TO_START" ? 10 : 0);

    return {
      edge,
      evidence,
      verifiedSequence,
      binding,
      bottleneckCandidate,
      incomingCount,
      score,
    };
  });
}

export function coreFlowEdges(
  descriptors: FlowEdgeDescriptor[],
  maximum = maximumCoreConnectorCount,
) {
  const verified = descriptors.filter((descriptor) => descriptor.verifiedSequence);
  const candidateLimit = Math.max(0, maximum - verified.length);
  const candidates = descriptors
    .filter(
      (descriptor) =>
        !descriptor.verifiedSequence && descriptor.bottleneckCandidate,
    )
    .sort((left, right) => right.score - left.score || left.edge.id.localeCompare(right.edge.id))
    .slice(0, candidateLimit);
  const selectedIds = new Set([...verified, ...candidates].map(({ edge }) => edge.id));
  return descriptors.filter(({ edge }) => selectedIds.has(edge.id));
}
