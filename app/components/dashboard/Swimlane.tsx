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
import type { ProcedureEdge } from "@/lib/domain/schemas";
import type { ProcedureDecision } from "@/lib/engine/rule-engine";
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
export const denseProcedureColumnThreshold = 10;
export { orthogonalConnectorPath };

type ConnectorPath = {
  id: string;
  path: string;
  strength: ProcedureEdge["strength"];
  contextual: boolean;
  selected: boolean;
};

type ConnectorLayout = {
  width: number;
  height: number;
  paths: ConnectorPath[];
};

const emptyConnectorLayout: ConnectorLayout = {
  width: 0,
  height: 0,
  paths: [],
};

const durationById = new Map(
  catalog.durations.map((duration) => [duration.id, duration]),
);


function planningLabel(
  node: ProjectTimelineNode | undefined,
  checkpoint: ScheduleCompletedCheckpoint | undefined,
) {
  if (checkpoint) return formatCompletedCheckpoint(checkpoint);
  if (!node) return "예상 일정 · 공사일 입력 시 계산";
  const duration = formatTimelineProcessingDuration(node);
  if (node.excludedFromOperationReady) return `가동 후 별도 · ${duration}`;
  if (node.processingDuration === null) {
    return "예상 총경과 미규정 · 사용자 예상값 입력 가능";
  }
  if (node.overlapsConstruction) {
    return `일정 반영 ${duration} · 공사와 ${node.overlapWithConstructionDays}일 병행`;
  }
  return `일정 반영 ${duration}`;
}

function dateText(value: string | undefined) {
  if (!value) return "일정 미입력";
  return value.replaceAll("-", ".");
}

const stageGroupTitles: Record<keyof typeof stageLabels, string> = {
  SITE_REVIEW: "입지·사업성 검토",
  PLAN_AND_OCCUPANCY: "사업계획·입주 승인",
  PRE_CONSTRUCTION: "착공 전 승인·신고",
  DURING_CONSTRUCTION: "공사 병행 점검",
  PRE_OPERATION: "준공·가동 승인",
  POST_OPERATION: "가동 후 등록·관리",
};

function flowGroupTitle(decisions: ProcedureDecision[]) {
  const names = decisions.map((decision) => decision.procedure.name).join(" ");
  if (/사용승인|완료신고|완성검사|준공/.test(names)) return "준공·완성검사";
  if (/착공/.test(names)) return "착공 준비 완료";
  if (/건축허가|개발행위/.test(names)) return "개발·건축 허가";
  if (/공장설립|입주계약|사업계획/.test(names)) return "입지·공장설립 승인";
  if (/등록|사업개시|가동/.test(names)) return "등록·가동 준비";

  const stageOrder = Object.keys(stageLabels) as Array<keyof typeof stageLabels>;
  const stage = stageOrder
    .map((candidate) => ({
      candidate,
      count: decisions.filter((decision) => decision.procedure.stage === candidate).length,
    }))
    .sort((left, right) => right.count - left.count || stageOrder.indexOf(left.candidate) - stageOrder.indexOf(right.candidate))[0]?.candidate;
  return stage ? stageGroupTitles[stage] : "절차 착수";
}

export function Swimlane({
  decisions,
  schedule,
  selectedId,
  userDurationOverrides = {},
  onSelect,
  onUserDurationOverrideChange = () => undefined,
}: {
  decisions: ProcedureDecision[];
  schedule: ScheduleResult;
  selectedId: string | null;
  userDurationOverrides?: Record<string, UserDurationOverride>;
  onSelect: (id: string) => void;
  onUserDurationOverrideChange?: (
    procedureId: string,
    value: UserDurationOverride | null,
  ) => void;
}) {
  const [collapsedLanes, setCollapsedLanes] = useState<string[]>([]);
  const [connectorLayout, setConnectorLayout] = useState<ConnectorLayout>(emptyConnectorLayout);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const connectorMarkerId = `dependency-arrow-${useId().replaceAll(":", "")}`;
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
  const offsets = useMemo(
    () => useDateOffsets
      ? [...new Set(
          scheduledDecisions.map(
            (decision) => timelineNodes.get(decision.procedure.id)?.startOffsetDays ?? 0,
          ),
        )].sort((a, b) => a - b)
      : [...new Set(
          scheduledDecisions.map(
            (decision) =>
              completedCheckpointByProcedure.has(decision.procedure.id)
                ? 0
                : scheduleNodes.get(decision.procedure.id)?.wave ?? 0,
          ),
        )].sort((a, b) => a - b),
    [completedCheckpointByProcedure, scheduleNodes, scheduledDecisions, timelineNodes, useDateOffsets],
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

  function toggleLane(lane: string) {
    setCollapsedLanes((current) => current.includes(lane)
      ? current.filter((item) => item !== lane)
      : [...current, lane]);
  }

  const decisionsByOffset = useMemo(
    () => {
      const grouped = new Map<number, ProcedureDecision[]>(
        offsets.map((offset) => [offset, []]),
      );
      for (const decision of scheduledDecisions) {
        const offset = useDateOffsets
          ? timelineNodes.get(decision.procedure.id)?.startOffsetDays ?? 0
          : completedCheckpointByProcedure.has(decision.procedure.id)
            ? 0
            : scheduleNodes.get(decision.procedure.id)?.wave ?? 0;
        grouped.get(offset)?.push(decision);
      }
      return grouped;
    },
    [completedCheckpointByProcedure, offsets, scheduleNodes, scheduledDecisions, timelineNodes, useDateOffsets],
  );
  const columnItemCounts = useMemo(
    () => new Map(
      offsets.map((offset) => [offset, decisionsByOffset.get(offset)?.length ?? 0]),
    ),
    [decisionsByOffset, offsets],
  );
  const denseOffsets = useMemo(
    () => new Set(
      offsets.filter((offset) =>
        (columnItemCounts.get(offset) ?? 0) >= denseProcedureColumnThreshold,
      ),
    ),
    [columnItemCounts, offsets],
  );
  const flowColumnTemplate = offsets.length
    ? offsets
        .map((offset) =>
          denseOffsets.has(offset)
            ? "minmax(440px, 2fr)"
            : "minmax(220px, 1fr)",
        )
        .join(" ")
    : "minmax(220px, 1fr)";

  const sequenceCitationIds = useMemo(
    () => new Set(
      catalog.citations
        .filter((citation) => citation.role === "SEQUENCE")
        .map((citation) => citation.id),
    ),
    [],
  );
  const scheduledProcedureIds = useMemo(
    () => new Set(scheduledDecisions.map((decision) => decision.procedure.id)),
    [scheduledDecisions],
  );
  const connectorEdges = useMemo(
    () => activeEdges
      .filter(
        (edge) =>
          scheduledProcedureIds.has(edge.from) &&
          scheduledProcedureIds.has(edge.to),
      )
      .map((edge) => ({
        edge,
        verifiedSequence: edge.citationIds.some((citationId) =>
          sequenceCitationIds.has(citationId),
        ),
        selected:
          selectedId !== null &&
          (edge.from === selectedId || edge.to === selectedId),
      }))
      .filter(
        ({ edge, verifiedSequence, selected }) =>
          verifiedSequence || (selected && edge.strength !== "ADVISORY"),
      ),
    [activeEdges, scheduledProcedureIds, selectedId, sequenceCitationIds],
  );
  const predecessorsByProcedure = useMemo(() => {
    const grouped = new Map<string, Array<{
      name: string;
      strength: ProcedureEdge["strength"];
    }>>();
    for (const edge of activeEdges) {
      const incoming = grouped.get(edge.to) ?? [];
      incoming.push({
        name: decisionNames.get(edge.from) ?? edge.from,
        strength: edge.strength,
      });
      grouped.set(edge.to, incoming);
    }
    return grouped;
  }, [activeEdges, decisionNames]);
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

    const gridRect = grid.getBoundingClientRect();
    const width = grid.scrollWidth;
    // `scrollHeight` includes overflow created by the connector SVG itself.
    // Reading it here would let a previously taller overlay keep the grid tall
    // after cards or lanes are removed. `clientHeight` reflects the rendered
    // grid tracks and lets the overlay shrink with the actual flow.
    const height = grid.clientHeight;
    const visibleCardRects = new Map<string, CardRect>();
    for (const [id, card] of cardRefs.current.entries()) {
      const rect = card.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) visibleCardRects.set(id, rect);
    }
    const routeConnector = createObstacleAvoidingConnectorRouter(
      visibleCardRects,
      gridRect,
      { width, height },
    );
    const paths = connectorEdges.flatMap(({ edge, verifiedSequence, selected }) => {
      const path = routeConnector(edge.from, edge.to);
      if (!path) return [];
      return [{
        id: edge.id,
        path,
        strength: edge.strength,
        contextual: !verifiedSequence,
        selected,
      } satisfies ConnectorPath];
    });

    setConnectorLayout({
      width,
      height,
      paths,
    });
  }, [connectorEdges]);

  useLayoutEffect(() => {
    measureConnectors();
    const frame = window.requestAnimationFrame(measureConnectors);
    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(measureConnectors);
    if (observer && gridRef.current) observer.observe(gridRef.current);
    for (const card of cardRefs.current.values()) observer?.observe(card);
    window.addEventListener("resize", measureConnectors);
    void document.fonts?.ready.then(measureConnectors);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", measureConnectors);
    };
  }, [collapsedKey, flowColumnTemplate, measureConnectors]);

  function strengthLabel(strength: "LEGAL_HARD" | "PRACTICAL" | "ADVISORY") {
    if (strength === "LEGAL_HARD") return "법정";
    if (strength === "PRACTICAL") return "실무";
    return "참고";
  }

  return (
    <section className="swimlane-shell" aria-label="선후행 순서와 병렬 진행을 표시한 인허가 흐름">
      <ol className="phase-route" aria-label="사업 단계">
        {Object.entries(stageLabels).map(([stage, label], index) => (
          <li key={stage}><span>{index + 1}</span><strong>{label}</strong></li>
        ))}
      </ol>
      <div className="swimlane-legend" aria-label="표시 범례">
        <span><i className="legend-line hard" /> 법정 선후행</span>
        <span><i className="legend-line practical" /> 실무 선후행 · 선택 시 확장</span>
        <span><i className="legend-overlap" /> 공사와 병행</span>
        <span><i className="legend-critical" /> 총기간 연장</span>
      </div>
      <p className="flow-instruction">왼쪽에서 오른쪽 순서로 진행합니다. 조문에서 선후행이 확인된 절차는 화살표로 잇고, 카드를 선택하면 관련 실무 연결도 점선으로 펼칩니다. 같은 열은 선행조건 충족 후 병행할 수 있습니다.</p>
      <div className="swimlane-scroll" tabIndex={0} aria-label="가로로 스크롤할 수 있는 인허가 순서표">
        <div
          ref={gridRef}
          className="swimlane-grid flow-grid"
          style={{ gridTemplateColumns: `180px ${flowColumnTemplate}` }}
          data-evidence-edge-count={connectorEdges.filter((item) => item.verifiedSequence).length}
          data-context-edge-count={connectorEdges.filter((item) => !item.verifiedSequence).length}
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
                <g key={connector.id}>
                  <path className="dependency-connector-halo" d={connector.path} />
                  <path
                    className={`dependency-connector-line strength-${connector.strength.toLowerCase()}${connector.contextual ? " is-contextual" : ""}${connector.selected ? " is-selected" : ""}`}
                    d={connector.path}
                    markerEnd={`url(#${connectorMarkerId})`}
                  />
                </g>
              ))}
            </svg>
          ) : null}
          <div className="swimlane-corner">주관 기관 / 착수 시점</div>
          {offsets.map((offset, index) => {
            const groupDecisions = decisionsByOffset.get(offset) ?? [];
            const sample = groupDecisions[0];
            const node = sample ? timelineNodes.get(sample.procedure.id) : undefined;
            const checkpoint = sample
              ? completedCheckpointByProcedure.get(sample.procedure.id)
              : undefined;
            const count = groupDecisions.length;
            return (
              <div className="stage-header flow-header" key={offset}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{flowGroupTitle(groupDecisions)}</strong>
                <small>{checkpoint ? `${dateText(checkpoint.completedDate ?? checkpoint.confirmedAsOfDate)} · 완료 이정표` : useDateOffsets ? `${dateText(node?.startDate)} · 시작 후 ${offset}일` : "선후행 기준"} · {count > 1 ? `${count}개 절차` : "1개 절차"}</small>
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
              {offsets.map((offset) => {
                const cells = (decisionsByOffset.get(offset) ?? [])
                  .filter((decision) => decision.procedure.lane === lane)
                  .sort((left, right) => {
                    const leftNode = timelineNodes.get(left.procedure.id);
                    const rightNode = timelineNodes.get(right.procedure.id);
                    return (leftNode?.finishOffsetDays ?? 0) - (rightNode?.finishOffsetDays ?? 0)
                      || left.procedure.name.localeCompare(right.procedure.name, "ko");
                  });
                const parallelCount = columnItemCounts.get(offset) ?? 0;
                const isDense = denseOffsets.has(offset);
                return (
                  <div
                    className={`lane-cell flow-cell${isDense ? " is-dense" : ""}`}
                    key={`${lane}-${offset}`}
                    data-item-count={cells.length}
                    data-column-item-count={parallelCount}
                    aria-hidden={collapsedLanes.includes(lane)}
                  >
                    {cells.map((decision) => {
                      const timelineNode = timelineNodes.get(decision.procedure.id);
                      const completedCheckpoint = completedCheckpointByProcedure.get(
                        decision.procedure.id,
                      );
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
                            <strong>{decision.procedure.name}</strong>
                            {decision.specialLawImpacts?.length ? <span className="special-law-chip">{decision.specialLawImpacts[0].effectLabel} · {decision.specialLawImpacts[0].statusLabel}</span> : null}
                            <span className="procedure-official-duration"><b>법정·공식 기간</b><span>{officialDurationSummaryByProcedure.get(decision.procedure.id)}</span></span>
                            <span className="procedure-meta">{planningLabel(timelineNode, completedCheckpoint)}{!completedCheckpoint && parallelCount > 1 ? <em>병렬</em> : null}</span>
                            {completedCheckpoint ? (
                              <span className="procedure-route route-start"><b>완료 확인</b> 잔여 일정 계산에서 제외</span>
                            ) : incoming.length ? (
                              <span className="procedure-route">
                                <b>← 선행절차</b>
                                <span className="procedure-route-list">
                                  {incoming.slice(0, 3).map((item) => (
                                    <span className={`route-chip route-${item.strength.toLowerCase()}`} key={`${item.name}-${item.strength}`}>
                                      <em>{strengthLabel(item.strength)}</em>{item.name}
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
