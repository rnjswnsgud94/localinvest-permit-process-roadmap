"use client";

import {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  isInputMatchedRoadmapInclusion,
  laneLabels,
  stageLabels,
} from "@/app/components/dashboard/constants";
import {
  createObstacleAvoidingConnectorRouter,
  orthogonalConnectorPath,
  type CardRect,
} from "@/app/components/dashboard/connector-routing";
import { StatusBadge } from "@/app/components/dashboard/StatusBadge";
import { UserDurationEditor } from "@/app/components/dashboard/UserDurationEditor";
import { catalog } from "@/lib/data/catalog";
import { verifiedSequenceCitationIds } from "@/lib/data/edge-evidence";
import type { ProcedureEdge } from "@/lib/domain/schemas";
import type { ProcedureDecision } from "@/lib/engine/rule-engine";
import {
  coreFlowEdges,
  describeFlowEdges,
  type FlowEdgeEvidence,
} from "@/lib/engine/flow-edges";
import type {
  ProjectTimelineNode,
  ScheduleCompletedCheckpoint,
  ScheduleResult,
  UserDurationOverride,
} from "@/lib/engine/schedule";
import {
  formatCompletedCheckpoint,
  formatResolvedOfficialDurationSummary,
  formatTimelineProcessingDuration,
} from "@/lib/format-duration";

const lanes = Object.keys(laneLabels) as Array<keyof typeof laneLabels>;
const stages = Object.keys(stageLabels) as Array<keyof typeof stageLabels>;
export const denseProcedureColumnThreshold = 10;
export { orthogonalConnectorPath };

type ConnectorPath = {
  id: string;
  from: string;
  to: string;
  path: string;
  strength: ProcedureEdge["strength"];
  contextual: boolean;
  bottleneck: boolean;
  verifiedSequence: boolean;
  evidencePending: boolean;
  selected: boolean;
};

type ConnectorDisplayMode = "CORE" | "LEGAL" | "ALL";

type ConnectorLayout = {
  width: number;
  height: number;
  paths: ConnectorPath[];
  routing: boolean;
};

const emptyConnectorLayout: ConnectorLayout = {
  width: 0,
  height: 0,
  paths: [],
  routing: false,
};

const durationById = new Map(
  catalog.durations.map((duration) => [duration.id, duration]),
);


function dateText(value: string | undefined) {
  if (!value) return "일정 미입력";
  return value.replaceAll("-", ".");
}

function planningLabel(
  node: ProjectTimelineNode | undefined,
  checkpoint: ScheduleCompletedCheckpoint | undefined,
) {
  if (checkpoint) return formatCompletedCheckpoint(checkpoint);
  if (!node) return "예상 일정 · 공사일 입력 시 계산";
  const duration = formatTimelineProcessingDuration(node);
  const start = node.startDate ? `${dateText(node.startDate)} 착수 · ` : "";
  if (node.excludedFromOperationReady) return `${start}가동 후 별도 · ${duration}`;
  if (node.processingDuration === null) {
    return `${start}예상 총경과 미규정 · 사용자 예상값 입력 가능`;
  }
  if (node.overlapsConstruction) {
    return `${start}일정 반영 ${duration} · 공사와 ${node.overlapWithConstructionDays}일 병행`;
  }
  return `${start}일정 반영 ${duration}`;
}

export function Swimlane({
  decisions,
  schedule,
  assessmentDate = catalog.coverage.assessmentDefault,
  selectedId,
  userDurationOverrides = {},
  onSelect,
  onUserDurationOverrideChange = () => undefined,
}: {
  decisions: ProcedureDecision[];
  schedule: ScheduleResult;
  assessmentDate?: string;
  selectedId: string | null;
  userDurationOverrides?: Record<string, UserDurationOverride>;
  onSelect: (id: string) => void;
  onUserDurationOverrideChange?: (
    procedureId: string,
    value: UserDurationOverride | null,
  ) => void;
}) {
  const [collapsedLanes, setCollapsedLanes] = useState<string[]>([]);
  const [connectorDisplayMode, setConnectorDisplayMode] =
    useState<ConnectorDisplayMode>("CORE");
  const [connectorLayout, setConnectorLayout] = useState<ConnectorLayout>(emptyConnectorLayout);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const connectorRoutingGenerationRef = useRef(0);
  const connectorRoutingFrameRef = useRef<number | null>(null);
  const connectorMarkerId = `dependency-arrow-${useId().replaceAll(":", "")}`;
  const connectorGridId = `${connectorMarkerId}-grid`;
  const timelineNodes = useMemo(
    () => new Map(
      (schedule.projectTimeline?.nodes ?? []).map((node) => [node.procedureId, node]),
    ),
    [schedule.projectTimeline],
  );
  const planningDurationByProcedure = useMemo(
    () => new Map(
      schedule.planningDurations.map((duration) => [duration.procedureId, duration]),
    ),
    [schedule.planningDurations],
  );
  const completedCheckpointByProcedure = useMemo(
    () => new Map(
      schedule.completedCheckpoints.map((checkpoint) => [
        checkpoint.procedureId,
        checkpoint,
      ]),
    ),
    [schedule.completedCheckpoints],
  );
  const useDateOffsets = schedule.projectTimeline !== null;
  const scheduleNodes = useMemo(
    () => new Map(schedule.nodes.map((node) => [node.procedureId, node])),
    [schedule.nodes],
  );
  const scheduledDecisions = useMemo(
    () => decisions.filter((decision) => scheduleNodes.has(decision.procedure.id)),
    [decisions, scheduleNodes],
  );
  const unscheduledDecisions = useMemo(
    () => decisions.filter((decision) => !scheduleNodes.has(decision.procedure.id)),
    [decisions, scheduleNodes],
  );
  const usedLanes = useMemo(
    () => lanes.filter((lane) =>
      scheduledDecisions.some((decision) => decision.procedure.lane === lane),
    ),
    [scheduledDecisions],
  );
  const usedStages = useMemo(
    () => stages.filter((stage) =>
      scheduledDecisions.some((decision) => decision.procedure.stage === stage),
    ),
    [scheduledDecisions],
  );
  const activeEdges = useMemo(
    () => {
      const activeEdgeIds = new Set(schedule.activeEdgeIds);
      return catalog.edges.filter(
        (edge) =>
          activeEdgeIds.has(edge.id) &&
          !completedCheckpointByProcedure.has(edge.to),
      );
    },
    [completedCheckpointByProcedure, schedule.activeEdgeIds],
  );
  const decisionNames = useMemo(
    () => new Map(
      decisions.map((decision) => [decision.procedure.id, decision.procedure.name]),
    ),
    [decisions],
  );
  const procedureStageById = useMemo(
    () => new Map(
      decisions.map((decision) => [
        decision.procedure.id,
        decision.procedure.stage,
      ]),
    ),
    [decisions],
  );

  function toggleLane(lane: string) {
    setCollapsedLanes((current) => current.includes(lane)
      ? current.filter((item) => item !== lane)
      : [...current, lane]);
  }

  const decisionsByStage = useMemo(
    () => {
      const grouped = new Map<keyof typeof stageLabels, ProcedureDecision[]>(
        usedStages.map((stage) => [stage, []]),
      );
      for (const decision of scheduledDecisions) {
        grouped.get(decision.procedure.stage)?.push(decision);
      }
      return grouped;
    },
    [scheduledDecisions, usedStages],
  );
  const stageItemCounts = useMemo(
    () => new Map(
      usedStages.map((stage) => [stage, decisionsByStage.get(stage)?.length ?? 0]),
    ),
    [decisionsByStage, usedStages],
  );
  const denseStages = useMemo(
    () => new Set(
      usedStages.filter((stage) =>
        (stageItemCounts.get(stage) ?? 0) >= denseProcedureColumnThreshold,
      ),
    ),
    [stageItemCounts, usedStages],
  );
  const flowColumnTemplate = usedStages.length
    ? usedStages
        .map((stage) =>
          denseStages.has(stage)
            ? "minmax(440px, 2fr)"
            : "minmax(220px, 1fr)",
        )
        .join(" ")
    : "minmax(220px, 1fr)";
  const positionKeyByProcedure = useMemo(
    () => new Map(scheduledDecisions.map((decision) => {
      const procedureId = decision.procedure.id;
      const position = useDateOffsets
        ? `day:${timelineNodes.get(procedureId)?.startOffsetDays ?? 0}`
        : completedCheckpointByProcedure.has(procedureId)
          ? "completed:0"
          : `wave:${scheduleNodes.get(procedureId)?.wave ?? 0}`;
      return [procedureId, position];
    })),
    [completedCheckpointByProcedure, scheduleNodes, scheduledDecisions, timelineNodes, useDateOffsets],
  );
  const positionItemCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const position of positionKeyByProcedure.values()) {
      counts.set(position, (counts.get(position) ?? 0) + 1);
    }
    return counts;
  }, [positionKeyByProcedure]);
  const stageHeaderSummary = useMemo(
    () => new Map(usedStages.map((stage) => {
      const stageDecisions = decisionsByStage.get(stage) ?? [];
      const startDates = [...new Set(stageDecisions
        .map((decision) => timelineNodes.get(decision.procedure.id)?.startDate)
        .filter((value): value is string => Boolean(value)))]
        .sort();
      const waves = [...new Set(stageDecisions
        .map((decision) => scheduleNodes.get(decision.procedure.id)?.wave)
        .filter((value): value is number => typeof value === "number"))]
        .sort((left, right) => left - right);
      const sequenceRange = waves.length === 0
        ? "카드별 일정 확인"
        : waves.length === 1
          ? `선후행 ${waves[0] + 1}단계`
          : `선후행 ${waves[0] + 1}~${waves[waves.length - 1] + 1}단계`;
      const dateRange = startDates.length === 0
        ? sequenceRange
        : startDates.length === 1
          ? `${dateText(startDates[0])} 착수`
          : `${dateText(startDates[0])}~${dateText(startDates[startDates.length - 1])} 착수`;
      return [stage, `${stageDecisions.length}개 절차 · ${dateRange}`];
    })),
    [decisionsByStage, scheduleNodes, timelineNodes, usedStages],
  );

  const sequenceCitationIds = useMemo(
    () => verifiedSequenceCitationIds({
      citations: catalog.citations,
      sources: catalog.legalSources,
      assessmentDate,
    }),
    [assessmentDate],
  );
  const scheduledProcedureIds = useMemo(
    () => new Set(scheduledDecisions.map((decision) => decision.procedure.id)),
    [scheduledDecisions],
  );
  const flowEdgeDescriptors = useMemo(
    () => describeFlowEdges({
      edges: activeEdges.filter(
        (edge) =>
          scheduledProcedureIds.has(edge.from) &&
          scheduledProcedureIds.has(edge.to),
      ),
      scheduleNodes: schedule.nodes,
      timelineNodes: schedule.projectTimeline?.nodes ?? [],
      criticalEdgeIds: schedule.criticalEdgeIds,
      procedureStageById,
      unknownDurationProcedureIds: schedule.unknownDurationProcedureIds,
      sequenceCitationIds,
    }),
    [
      activeEdges,
      schedule.nodes,
      schedule.criticalEdgeIds,
      schedule.projectTimeline,
      schedule.unknownDurationProcedureIds,
      scheduledProcedureIds,
      procedureStageById,
      sequenceCitationIds,
    ],
  );
  const coreConnectorEdges = useMemo(
    () => coreFlowEdges(flowEdgeDescriptors),
    [flowEdgeDescriptors],
  );
  const connectorEdges = useMemo(() => {
    const baseVisible = connectorDisplayMode === "ALL"
      ? flowEdgeDescriptors
      : connectorDisplayMode === "LEGAL"
        ? flowEdgeDescriptors.filter(
            (descriptor) =>
              descriptor.edge.strength === "LEGAL_HARD" ||
              descriptor.verifiedSequence,
          )
        : coreConnectorEdges;
    const baseIds = new Set(baseVisible.map((descriptor) => descriptor.edge.id));
    const visible = flowEdgeDescriptors.filter(
      (descriptor) =>
        baseIds.has(descriptor.edge.id) ||
        (selectedId !== null &&
          (descriptor.edge.from === selectedId ||
            descriptor.edge.to === selectedId)),
    );

    return visible.map((descriptor) => ({
      ...descriptor,
      contextual: !baseIds.has(descriptor.edge.id),
      selected:
        selectedId !== null &&
        (descriptor.edge.from === selectedId || descriptor.edge.to === selectedId),
    }));
  }, [connectorDisplayMode, coreConnectorEdges, flowEdgeDescriptors, selectedId]);
  const predecessorsByProcedure = useMemo(() => {
    const grouped = new Map<string, Array<{
      name: string;
      strength: ProcedureEdge["strength"];
      evidence: FlowEdgeEvidence;
    }>>();
    for (const descriptor of flowEdgeDescriptors) {
      const { edge } = descriptor;
      const incoming = grouped.get(edge.to) ?? [];
      incoming.push({
        name: decisionNames.get(edge.from) ?? edge.from,
        strength: edge.strength,
        evidence: descriptor.evidence,
      });
      grouped.set(edge.to, incoming);
    }
    return grouped;
  }, [decisionNames, flowEdgeDescriptors]);
  const bottleneckTargets = useMemo(() => {
    const targetIds = new Set(
      flowEdgeDescriptors
        .filter((descriptor) => descriptor.bottleneckCandidate)
        .map((descriptor) => descriptor.edge.to),
    );
    return [...targetIds]
      .map((procedureId) => {
        const incoming = flowEdgeDescriptors.filter(
          (descriptor) => descriptor.edge.to === procedureId,
        );
        return {
          procedureId,
          name: decisionNames.get(procedureId) ?? procedureId,
          incomingCount: incoming.length,
          verifiedCount: incoming.filter(
            (descriptor) => descriptor.verifiedSequence,
          ).length,
          practicalCount: incoming.filter(
            (descriptor) => descriptor.evidence === "PRACTICAL_RELATION",
          ).length,
          reviewCount: incoming.filter(
            (descriptor) =>
              descriptor.evidence === "REGISTERED_LEGAL_RELATION",
          ).length,
          score: Math.max(...incoming.map((descriptor) => descriptor.score)),
        };
      })
      .sort(
        (left, right) =>
          right.score - left.score ||
          right.incomingCount - left.incomingCount ||
          left.name.localeCompare(right.name, "ko"),
      )
      .slice(0, 3);
  }, [decisionNames, flowEdgeDescriptors]);
  const officialDurationSummaryByProcedure = useMemo(
    () => new Map(decisions.map((decision) => {
      const officialDuration = decision.procedure.durationId
        ? durationById.get(decision.procedure.durationId)
        : undefined;
      return [
        decision.procedure.id,
        formatResolvedOfficialDurationSummary(
          officialDuration,
          planningDurationByProcedure.get(decision.procedure.id),
        ),
      ];
    })),
    [decisions, planningDurationByProcedure],
  );
  const collapsedKey = collapsedLanes.slice().sort().join("|");

  const measureConnectors = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const generation = connectorRoutingGenerationRef.current + 1;
    connectorRoutingGenerationRef.current = generation;
    if (connectorRoutingFrameRef.current !== null) {
      window.cancelAnimationFrame(connectorRoutingFrameRef.current);
      connectorRoutingFrameRef.current = null;
    }

    const gridRect = grid.getBoundingClientRect();
    const width = grid.scrollWidth;
    // `scrollHeight` includes overflow created by the connector SVG itself.
    // Reading it here would let a previously taller overlay keep the grid tall
    // after cards or lanes are removed. `clientHeight` reflects the rendered
    // grid tracks and lets the overlay shrink with the actual flow.
    const height = grid.clientHeight;
    const firstLaneCell = grid.querySelector<HTMLElement>(".lane-cell");
    const firstLaneCellRect = firstLaneCell?.getBoundingClientRect();
    // Keep connector halos and arrowheads below the stage-header row. Without
    // this inset, top-port detours can run behind the opaque header cells and
    // look broken even though the SVG path itself is continuous.
    const routingTop = firstLaneCellRect
      ? Math.min(height, Math.max(0, firstLaneCellRect.top - gridRect.top + 5))
      : 0;
    const visibleCardRects = new Map<string, CardRect>();
    for (const [id, card] of cardRefs.current.entries()) {
      const rect = card.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) visibleCardRects.set(id, rect);
    }
    const routeConnector = createObstacleAvoidingConnectorRouter(
      visibleCardRects,
      gridRect,
      { width, height, top: routingTop },
    );
    const strengthRoutePriority: Record<ProcedureEdge["strength"], number> = {
      LEGAL_HARD: 0,
      PRACTICAL: 1,
      ADVISORY: 2,
    };
    const routingOrder = [...connectorEdges].sort((left, right) =>
      Number(left.contextual) - Number(right.contextual)
      || Number(right.verifiedSequence) - Number(left.verifiedSequence)
      || Number(right.bottleneckCandidate) - Number(left.bottleneckCandidate)
      || strengthRoutePriority[left.edge.strength] - strengthRoutePriority[right.edge.strength]
      || left.edge.id.localeCompare(right.edge.id),
    );
    const paths: ConnectorPath[] = [];
    const routeOne = ({
      edge,
      verifiedSequence,
      bottleneckCandidate,
      contextual,
      selected,
    }: (typeof routingOrder)[number]) => {
      const path = routeConnector(edge.from, edge.to);
      if (!path) return;
      paths.push({
        id: edge.id,
        from: edge.from,
        to: edge.to,
        path,
        strength: edge.strength,
        contextual,
        bottleneck: !verifiedSequence && bottleneckCandidate,
        verifiedSequence,
        evidencePending:
          edge.strength === "LEGAL_HARD" && !verifiedSequence,
        selected,
      });
    };
    const sortForPaint = () => paths.sort((left, right) => {
      const strengthPaintPriority: Record<ProcedureEdge["strength"], number> = {
        ADVISORY: 0,
        PRACTICAL: 1,
        LEGAL_HARD: 2,
      };
      return Number(right.contextual) - Number(left.contextual)
        || strengthPaintPriority[left.strength] - strengthPaintPriority[right.strength]
        || Number(left.verifiedSequence) - Number(right.verifiedSequence)
        || Number(left.bottleneck) - Number(right.bottleneck)
        || Number(left.selected) - Number(right.selected)
        || left.id.localeCompare(right.id);
    });
    const commit = () => {
      if (connectorRoutingGenerationRef.current !== generation) return;
      connectorRoutingFrameRef.current = null;
      setConnectorLayout({ width, height, paths: sortForPaint(), routing: false });
    };

    if (routingOrder.length <= 24) {
      routingOrder.forEach(routeOne);
      commit();
      return;
    }

    // Large legal/all-edge views can contain hundreds of connectors. Route
    // them in frame-sized batches so changing a filter or collapsing a lane
    // never holds the main thread for the entire graph calculation.
    setConnectorLayout({ width, height, paths: [], routing: true });
    let nextIndex = 0;
    const routeBatch = () => {
      if (connectorRoutingGenerationRef.current !== generation) return;
      const deadline = window.performance.now() + 10;
      do {
        routeOne(routingOrder[nextIndex]);
        nextIndex += 1;
      } while (
        nextIndex < routingOrder.length
        && window.performance.now() < deadline
      );
      if (nextIndex >= routingOrder.length) {
        commit();
        return;
      }
      connectorRoutingFrameRef.current = window.requestAnimationFrame(routeBatch);
    };
    connectorRoutingFrameRef.current = window.requestAnimationFrame(routeBatch);
  }, [connectorEdges]);

  useLayoutEffect(() => {
    measureConnectors();
    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(measureConnectors);
    if (observer && gridRef.current) observer.observe(gridRef.current);
    for (const card of cardRefs.current.values()) observer?.observe(card);
    window.addEventListener("resize", measureConnectors);
    void document.fonts?.ready.then(measureConnectors);

    return () => {
      connectorRoutingGenerationRef.current += 1;
      if (connectorRoutingFrameRef.current !== null) {
        window.cancelAnimationFrame(connectorRoutingFrameRef.current);
        connectorRoutingFrameRef.current = null;
      }
      observer?.disconnect();
      window.removeEventListener("resize", measureConnectors);
    };
  }, [collapsedKey, flowColumnTemplate, measureConnectors]);

  function strengthLabel(
    strength: "LEGAL_HARD" | "PRACTICAL" | "ADVISORY",
    evidence: FlowEdgeEvidence,
  ) {
    if (evidence === "VERIFIED_LEGAL_SEQUENCE") return "조문 연결";
    if (strength === "LEGAL_HARD") return "모델·검토";
    if (strength === "PRACTICAL") return "실무";
    return "참고";
  }

  const verifiedConnectorCount = flowEdgeDescriptors.filter(
    (descriptor) => descriptor.verifiedSequence,
  ).length;
  const bottleneckCandidateCount = flowEdgeDescriptors.filter(
    (descriptor) => descriptor.bottleneckCandidate,
  ).length;
  const relationReviewCount = flowEdgeDescriptors.filter(
    (descriptor) => descriptor.evidence === "REGISTERED_LEGAL_RELATION",
  ).length;
  const bottleneckCalculationIsPartial =
    !schedule.complete ||
    schedule.projectTimeline === null ||
    !schedule.projectTimeline.complete;
  const displayModeCopy = connectorDisplayMode === "CORE"
    ? `선후행 조문 연결과 확인된 기간 기준 병목 후보 ${connectorEdges.length}건을 표시합니다.`
    : connectorDisplayMode === "LEGAL"
      ? `법정 선행으로 분류된 연결 ${connectorEdges.length}건을 표시합니다. 점선은 선후행 조문 보강이 필요합니다.`
      : `현재 일정 계산에 반영된 연결 ${connectorEdges.length}건을 모두 표시합니다.`;

  return (
    <section className="swimlane-shell" aria-label="선후행 순서와 병렬 진행을 표시한 인허가 흐름">
      <div className="flow-connector-toolbar">
        <div className="flow-connector-heading">
          <span>병목 가시화</span>
          <strong>연결선 표시 범위</strong>
          <small>카드를 선택하면 어느 모드에서도 해당 절차의 직접 연결을 함께 펼칩니다.</small>
        </div>
        <div
          className="connector-mode-switch"
          role="group"
          aria-label="연결선 표시 범위"
        >
          <button
            type="button"
            className={connectorDisplayMode === "CORE" ? "is-selected" : ""}
            aria-pressed={connectorDisplayMode === "CORE"}
            aria-controls={connectorGridId}
            onClick={() => setConnectorDisplayMode("CORE")}
          >
            핵심 병목 <span>{coreConnectorEdges.length}</span>
          </button>
          <button
            type="button"
            className={connectorDisplayMode === "LEGAL" ? "is-selected" : ""}
            aria-pressed={connectorDisplayMode === "LEGAL"}
            aria-controls={connectorGridId}
            onClick={() => setConnectorDisplayMode("LEGAL")}
          >
            법정 분류 <span>{flowEdgeDescriptors.filter(
              (descriptor) => descriptor.edge.strength === "LEGAL_HARD",
            ).length}</span>
          </button>
          <button
            type="button"
            className={connectorDisplayMode === "ALL" ? "is-selected" : ""}
            aria-pressed={connectorDisplayMode === "ALL"}
            aria-controls={connectorGridId}
            onClick={() => setConnectorDisplayMode("ALL")}
          >
            전체 연결 <span>{flowEdgeDescriptors.length}</span>
          </button>
        </div>
        <p className="connector-mode-status" aria-live="polite" aria-atomic="true">
          <strong>{displayModeCopy}</strong>
          <span>
            조문 연결 {verifiedConnectorCount}건 · 법정 분류 중 관계근거 보강 {relationReviewCount}건
            {bottleneckCalculationIsPartial
              ? schedule.unknownDurationProcedureIds.length
                ? ` · 기간 미확인 ${schedule.unknownDurationProcedureIds.length}개를 제외한 부분 계산`
                : " · 보완·협의 등 일부 공백을 제외한 부분 계산"
              : " · 확인된 기간 기준 계산"}
          </span>
        </p>
      </div>
      <div className="swimlane-legend" aria-label="표시 범례">
        <span><i className="legend-line bottleneck" /> 일정 계산상 병목 후보</span>
        <span><i className="legend-line hard" /> 선후행 조문 연결</span>
        <span><i className="legend-line pending" /> 법정 분류 · 관계근거 보강</span>
        <span><i className="legend-line practical" /> 실무 연결</span>
        <span><i className="legend-overlap" /> 공사와 병행</span>
        <span><i className="legend-critical" /> 총기간 연장</span>
      </div>
      <p className="flow-instruction">열은 최대 6개 사업단계로 묶었습니다. 기본은 현재 입력·기간값으로 계산한 병목 후보와 선후행 조문이 연결된 관계를 표시하며, 점선은 법적 강제순서로 단정하지 않습니다. 같은 단계 안에서도 카드의 착수일과 선행절차를 확인하세요.</p>
      {bottleneckTargets.length ? (
        <section className="bottleneck-focus" aria-label="연결이 집중되는 확인 지점">
          <header>
            <span>집중 확인 지점</span>
            <p>후속 단계로 넘어가거나 선행절차가 모이는 곳입니다. 보완·협의 지연 시 다음 일정에 영향이 커질 수 있습니다.</p>
          </header>
          <div>
            {bottleneckTargets.map((target, index) => (
              <button
                type="button"
                key={target.procedureId}
                aria-label={`집중 확인 지점 ${index + 1} 상세 열기`}
                aria-describedby={`${connectorGridId}-focus-${target.procedureId}`}
                onClick={() => onSelect(target.procedureId)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong id={`${connectorGridId}-focus-${target.procedureId}`}>{target.name}</strong>
                <small>
                  직접 선행 {target.incomingCount}건 · 조문 연결 {target.verifiedCount}건
                  {target.reviewCount ? ` · 근거보강 ${target.reviewCount}건` : ""}
                  {target.practicalCount ? ` · 실무 ${target.practicalCount}건` : ""}
                </small>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <ul className="sr-only" aria-label="현재 표시된 선후행 연결">
        {connectorEdges.map((descriptor) => (
          <li key={`accessible-${descriptor.edge.id}`}>
            {decisionNames.get(descriptor.edge.from) ?? descriptor.edge.from}
            {" → "}
            {decisionNames.get(descriptor.edge.to) ?? descriptor.edge.to}
            {": "}
            {descriptor.verifiedSequence
              ? "선후행 조문 연결"
              : descriptor.bottleneckCandidate
                ? "일정 계산상 병목 후보"
                : descriptor.evidence === "REGISTERED_LEGAL_RELATION"
                  ? "법정 분류·관계근거 보강 필요"
                  : "실무 연결"}
          </li>
        ))}
      </ul>
      <div className="swimlane-scroll" tabIndex={0} aria-label="가로로 스크롤할 수 있는 인허가 순서표">
        <div
          id={connectorGridId}
          ref={gridRef}
          className="swimlane-grid flow-grid"
          style={{ gridTemplateColumns: `180px ${flowColumnTemplate}` }}
          data-connector-mode={connectorDisplayMode}
          data-connector-routing={connectorLayout.routing ? "true" : "false"}
          aria-busy={connectorLayout.routing || undefined}
          data-visible-edge-count={connectorEdges.length}
          data-core-edge-count={coreConnectorEdges.length}
          data-bottleneck-edge-count={bottleneckCandidateCount}
          data-total-edge-count={flowEdgeDescriptors.length}
          data-evidence-edge-count={connectorEdges.filter((item) => item.verifiedSequence).length}
          data-context-edge-count={connectorEdges.filter((item) => item.contextual).length}
          data-flow-column-count={usedStages.length}
        >
          {connectorLayout.width > 0 && connectorLayout.height > 0 ? (
            <svg
              className="dependency-connector-layer"
              width={connectorLayout.width}
              height={connectorLayout.height}
              viewBox={`0 0 ${connectorLayout.width} ${connectorLayout.height}`}
              aria-hidden="true"
            >
              <defs>
                <marker
                  id={connectorMarkerId}
                  className="connector-marker-verified"
                  markerUnits="userSpaceOnUse"
                  viewBox="-1 -5 12 10"
                  refX="9"
                  refY="0"
                  markerWidth="12"
                  markerHeight="10"
                  orient="auto"
                  overflow="visible"
                >
                  <path d="M 0 -3.5 L 9 0 L 0 3.5 Z" />
                </marker>
                <marker
                  id={`${connectorMarkerId}-bottleneck`}
                  className="connector-marker-bottleneck"
                  markerUnits="userSpaceOnUse"
                  viewBox="-1 -5 12 10"
                  refX="9"
                  refY="0"
                  markerWidth="12"
                  markerHeight="10"
                  orient="auto"
                  overflow="visible"
                >
                  <path d="M 0 -3.5 L 9 0 L 0 3.5 Z" />
                </marker>
                <marker
                  id={`${connectorMarkerId}-pending`}
                  className="connector-marker-pending"
                  markerUnits="userSpaceOnUse"
                  viewBox="-1 -5 12 10"
                  refX="9"
                  refY="0"
                  markerWidth="12"
                  markerHeight="10"
                  orient="auto"
                  overflow="visible"
                >
                  <path d="M 0 -3.5 L 9 0 L 0 3.5 Z" />
                </marker>
                <marker
                  id={`${connectorMarkerId}-practical`}
                  className="connector-marker-practical"
                  markerUnits="userSpaceOnUse"
                  viewBox="-1 -5 12 10"
                  refX="9"
                  refY="0"
                  markerWidth="12"
                  markerHeight="10"
                  orient="auto"
                  overflow="visible"
                >
                  <path d="M 0 -3.5 L 9 0 L 0 3.5 Z" />
                </marker>
              </defs>
              {connectorLayout.paths.map((connector) => (
                <g
                  key={connector.id}
                  data-edge-id={connector.id}
                  data-from={connector.from}
                  data-to={connector.to}
                >
                  <path className="dependency-connector-halo" d={connector.path} />
                  <path
                    className={`dependency-connector-line strength-${connector.strength.toLowerCase()}${connector.verifiedSequence ? " is-verified-sequence" : ""}${connector.bottleneck ? " is-bottleneck" : ""}${connector.evidencePending ? " is-evidence-pending" : ""}${connector.contextual ? " is-contextual" : ""}${connector.selected ? " is-selected" : ""}`}
                    d={connector.path}
                    markerEnd={`url(#${connector.bottleneck
                      ? `${connectorMarkerId}-bottleneck`
                      : connector.evidencePending
                        ? `${connectorMarkerId}-pending`
                        : connector.strength === "PRACTICAL"
                          ? `${connectorMarkerId}-practical`
                          : connectorMarkerId})`}
                  />
                </g>
              ))}
            </svg>
          ) : null}
          <div className="swimlane-corner">주관 기관 / 사업 단계</div>
          {usedStages.map((stage) => {
            const stageNumber = stages.indexOf(stage) + 1;
            const summary = stageHeaderSummary.get(stage) ?? "카드별 일정 확인";
            return (
              <div
                className="stage-header flow-header"
                key={stage}
                aria-label={`${stageLabels[stage]} · ${summary}`}
                data-stage={stage}
              >
                <span>{String(stageNumber).padStart(2, "0")}</span>
                <strong>{stageLabels[stage]}</strong>
                <small>{summary}</small>
              </div>
            );
          })}
          {usedLanes.map((lane) => (
            <div className={`swimlane-row ${collapsedLanes.includes(lane) ? "is-collapsed" : ""}`} key={lane}>
              <button type="button" className="lane-header" aria-expanded={!collapsedLanes.includes(lane)} onClick={() => toggleLane(lane)}>
                <span className="lane-marker" aria-hidden="true" />
                <strong>{laneLabels[lane]}</strong>
                <span className="lane-toggle" aria-hidden="true">{collapsedLanes.includes(lane) ? "+" : "−"}</span>
              </button>
              {usedStages.map((stage) => {
                const cells = (decisionsByStage.get(stage) ?? [])
                  .filter((decision) => decision.procedure.lane === lane)
                  .sort((left, right) => {
                    const leftNode = timelineNodes.get(left.procedure.id);
                    const rightNode = timelineNodes.get(right.procedure.id);
                    const leftPosition = useDateOffsets
                      ? leftNode?.startOffsetDays ?? 0
                      : scheduleNodes.get(left.procedure.id)?.wave ?? 0;
                    const rightPosition = useDateOffsets
                      ? rightNode?.startOffsetDays ?? 0
                      : scheduleNodes.get(right.procedure.id)?.wave ?? 0;
                    return leftPosition - rightPosition
                      || (leftNode?.finishOffsetDays ?? 0) - (rightNode?.finishOffsetDays ?? 0)
                      || left.procedure.name.localeCompare(right.procedure.name, "ko");
                  });
                const isDense = denseStages.has(stage);
                return (
                  <div
                    className={`lane-cell flow-cell${isDense ? " is-dense" : ""}`}
                    key={`${lane}-${stage}`}
                    data-item-count={cells.length}
                    data-column-item-count={stageItemCounts.get(stage) ?? 0}
                    data-stage={stage}
                    aria-hidden={collapsedLanes.includes(lane)}
                  >
                    {cells.map((decision) => {
                      const timelineNode = timelineNodes.get(decision.procedure.id);
                      const completedCheckpoint = completedCheckpointByProcedure.get(
                        decision.procedure.id,
                      );
                      const parallelCount = positionItemCounts.get(
                        positionKeyByProcedure.get(decision.procedure.id) ?? "",
                      ) ?? 0;
                      const incoming = predecessorsByProcedure.get(decision.procedure.id) ?? [];
                      return (
                        <article
                          ref={(node) => {
                            if (node) cardRefs.current.set(decision.procedure.id, node);
                            else cardRefs.current.delete(decision.procedure.id);
                          }}
                          key={decision.procedure.id}
                          className={`procedure-card status-card-${isInputMatchedRoadmapInclusion(decision) ? "roadmap_included" : decision.status.toLowerCase()} ${completedCheckpoint ? "is-completed" : ""} ${timelineNode?.extendsOperationReady ? "is-critical" : ""} ${timelineNode?.overlapsConstruction ? "is-overlap" : ""} ${selectedId === decision.procedure.id ? "is-selected" : ""}`}
                        >
                          <button
                            type="button"
                            className="procedure-card-main"
                            aria-label={`${decision.procedure.name} 상세 보기`}
                            aria-pressed={selectedId === decision.procedure.id}
                            onClick={() => onSelect(decision.procedure.id)}
                          >
                            <span className="procedure-card-topline"><StatusBadge status={decision.status} isDeemed={decision.isDeemed} provisionalEffect={decision.provisionalEffect} missingInputs={decision.missingInputs} conflictRuleIds={decision.conflictRuleIds} needsLegalReview={decision.needsLegalReview} compact /><span>{stageLabels[decision.procedure.stage]}</span></span>
                            <strong className="procedure-card-title">
                              {decision.procedure.name}
                            </strong>
                            {decision.specialLawImpacts?.length ? <span className="special-law-chip">{decision.specialLawImpacts[0].effectLabel} · {decision.specialLawImpacts[0].statusLabel}</span> : null}
                            <span className="procedure-official-duration"><b>법정·공식 기간</b><span>{officialDurationSummaryByProcedure.get(decision.procedure.id)}</span></span>
                            <span className="procedure-meta">
                              <span className="procedure-meta-label">
                                {planningLabel(timelineNode, completedCheckpoint)}
                              </span>
                              {!completedCheckpoint && parallelCount > 1 ? <em>병렬</em> : null}
                            </span>
                            {completedCheckpoint ? (
                              <span className="procedure-route route-start"><b>완료 확인</b> 잔여 일정 계산에서 제외</span>
                            ) : incoming.length ? (
                              <span className="procedure-route">
                                <b>← 선행절차</b>
                                <span className="procedure-route-list">
                                  {incoming.slice(0, 3).map((item) => (
                                    <span className={`route-chip route-${item.strength.toLowerCase()}${item.evidence === "VERIFIED_LEGAL_SEQUENCE" ? " is-verified" : ""}`} key={`${item.name}-${item.strength}`}>
                                      <em>{strengthLabel(item.strength, item.evidence)}</em>
                                      <span>{item.name}</span>
                                    </span>
                                  ))}
                                  {incoming.length > 3 ? <span className="route-more">외 {incoming.length - 3}개</span> : null}
                                </span>
                              </span>
                            ) : <span className="procedure-route route-start"><b>시작 가능</b> 직접 선행절차 없음</span>}
                          </button>
                          <UserDurationEditor
                            procedureId={decision.procedure.id}
                            procedureName={decision.procedure.name}
                            value={userDurationOverrides[decision.procedure.id]}
                            completed={Boolean(completedCheckpoint)}
                            onChange={onUserDurationOverrideChange}
                          />
                        </article>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {unscheduledDecisions.length ? (
        <section className="unscheduled-procedures">
          <h3>현재 일정에서 제외된 절차</h3>
          <p>비적용 조건과 일치했거나 일정 포함 설정에서 빠진 항목입니다. 상세 화면에서 판정 이유를 확인할 수 있습니다.</p>
          <div>{unscheduledDecisions.map((decision) => <button type="button" key={decision.procedure.id} onClick={() => onSelect(decision.procedure.id)}><StatusBadge status={decision.status} isDeemed={decision.isDeemed} provisionalEffect={decision.provisionalEffect} missingInputs={decision.missingInputs} conflictRuleIds={decision.conflictRuleIds} needsLegalReview={decision.needsLegalReview} compact />{decision.procedure.name}</button>)}</div>
        </section>
      ) : null}
      <p className="panel-footnote">카드를 선택하면 적용 이유, 제출자료, 선행·후속 절차와 법령 원문을 확인할 수 있습니다.</p>
    </section>
  );
}
