"use client";

import { useEffect, useMemo, useRef } from "react";

import { stageLabels } from "@/app/components/dashboard/constants";
import { catalog } from "@/lib/data/catalog";
import type { ScheduleResult } from "@/lib/engine/schedule";
import {
  formatCalendarPeriod,
  formatCompletedCheckpoint,
  formatResolvedOfficialDurationSummary,
  formatTimelineProcessingDuration,
  hasQuantifiedOfficialPeriod,
} from "@/lib/format-duration";

const procedureNames = new Map(
  catalog.procedures.map((procedure) => [procedure.id, procedure.name]),
);
const procedureStages = new Map(
  catalog.procedures.map((procedure) => [procedure.id, procedure.stage]),
);
const durationByProcedure = new Map(
  catalog.durations.map((duration) => [duration.procedureId, duration]),
);

export function TotalDurationDialog({
  schedule,
  onClose,
}: {
  schedule: ScheduleResult;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const timeline = schedule.projectTimeline;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
    headingRef.current?.focus();
    return () => {
      if (typeof dialog.close === "function" && dialog.open) dialog.close();
    };
  }, []);

  const groups = useMemo(() => {
    if (!timeline) return [];
    return Object.entries(stageLabels).map(([stage, label]) => ({
      stage,
      label,
      nodes: timeline.nodes
        .filter((node) => procedureStages.get(node.procedureId) === stage)
        .sort(
          (left, right) =>
            left.startOffsetDays - right.startOffsetDays ||
            left.finishOffsetDays - right.finishOffsetDays ||
            left.procedureId.localeCompare(right.procedureId),
        ),
    }));
  }, [timeline]);

  const completionDate = timeline
    ? timeline.operationReadyDate ?? timeline.minimumKnownCompletionDate
    : null;
  const unknownActiveCount = timeline
    ? timeline.unknownPlanningDurationProcedureIds.filter(
        (id) => !timeline.postOperationProcedureIds.includes(id),
      ).length
    : 0;
  const statutoryMilestoneOnlyCount = timeline
    ? timeline.nodes.filter(
        (node) =>
          !node.excludedFromOperationReady &&
          node.processingDuration === null &&
          hasQuantifiedOfficialPeriod(durationByProcedure.get(node.procedureId)),
      ).length
    : 0;
  const nationwideTotalUnregulatedCount = Math.max(
    0,
    unknownActiveCount - statutoryMilestoneOnlyCount,
  );
  const planningDurationByProcedure = new Map(
    schedule.planningDurations.map((duration) => [duration.procedureId, duration]),
  );
  const incompleteActiveCount = timeline
    ? timeline.incompleteDurationComponentProcedureIds.filter(
        (id) => !timeline.postOperationProcedureIds.includes(id),
      ).length
    : 0;
  const isMinimumOnly = timeline?.durationStatus === "MINIMUM_ONLY";
  const resultLabel = isMinimumOnly ? "확인된 일정 하한 계산 경로" : "총 소요기간 계산 경로";

  return (
    <dialog
      ref={dialogRef}
      id="total-duration-dialog"
      className="status-summary-dialog duration-flow-dialog"
      aria-modal="true"
      aria-labelledby="total-duration-dialog-title"
      aria-describedby="total-duration-dialog-description"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="status-dialog-panel duration-flow-panel">
        <header>
          <div>
            <span>사업 전체 일정</span>
            <h2 id="total-duration-dialog-title" ref={headingRef} tabIndex={-1}>
              {resultLabel}
            </h2>
            <p id="total-duration-dialog-description">
              {isMinimumOnly
                ? "총경과를 계산할 수 있는 절차와 공사기간만 6단계로 묶었습니다. 카드의 법정 상한·중간기한은 별도로 확인할 수 있습니다."
                : "착공 전 인허가, 공사와 병행하는 절차, 준공·가동 준비 절차를 6단계로 묶었습니다."}
            </p>
          </div>
          <button type="button" className="dialog-close" onClick={onClose} aria-label={`${isMinimumOnly ? "확인된 일정 하한" : "총 소요기간"} 닫기`}>×</button>
        </header>

        {!timeline ? (
          <div className="duration-flow-empty">
            <strong>공사 시작일과 준공일을 입력해 주세요.</strong>
            <span>두 날짜가 입력되면 확인된 인허가 선행기간과 공사기간을 연결하고, 기간이 비어 있으면 일정 하한으로 표시합니다.</span>
            {schedule.completedCheckpoints.length ? (
              <section className="company-milestones" aria-label="확인된 완료 이정표">
                <header><strong>확인된 완료 이정표</strong><span>이미 끝난 절차는 남은 처리기간에 더하지 않습니다.</span></header>
                <div>{schedule.completedCheckpoints.map((checkpoint) => <p key={checkpoint.procedureId}><span>{procedureNames.get(checkpoint.procedureId) ?? checkpoint.procedureId}</span><strong>{formatCompletedCheckpoint(checkpoint)}</strong></p>)}</div>
              </section>
            ) : null}
          </div>
        ) : (
          <div className="duration-flow-body">
            <section className="duration-route-summary" aria-label={`${isMinimumOnly ? "확인된 일정 하한" : "총 소요기간"} 주요 구간`}>
              <div><span>계획상 인허가 착수</span><strong>{timeline.projectStartDate}</strong></div>
              <i aria-hidden="true">→</i>
              <div><span>착공 전 인허가</span><strong>{timeline.permitLeadCalendarDays ?? timeline.plannedPreConstructionCalendarDays}일</strong></div>
              <i aria-hidden="true">→</i>
              <div><span>건설공사</span><strong>{formatCalendarPeriod(timeline.plannedConstructionStartDate, timeline.plannedConstructionEndDate)}</strong></div>
              <i aria-hidden="true">→</i>
              <div><span>가동 준비 완료</span><strong>{completionDate}</strong></div>
            </section>

            <div className={`duration-result-note ${timeline.durationStatus === "MINIMUM_ONLY" ? "has-gap" : ""}`} role="note">
              <strong>{formatCalendarPeriod(timeline.projectStartDate, completionDate!)}</strong>
              <span>
                {timeline.durationStatus === "MINIMUM_ONLY"
                  ? `총 소요기간이 아닙니다. 현재 확인된 공식 총경과${schedule.scenario === "USER" ? `와 사용자 예상 ${timeline.userDurationOverrideProcedureIds.length}건` : ""}, 공사기간만 합산했습니다. 법정 상한·단계기한만 확인된 절차 ${statutoryMilestoneOnlyCount}개, 전국 공통 총기간이 규정되지 않은 절차 ${nationwideTotalUnregulatedCount}개, 신청준비·심사·협의 기간 구성이 미확인인 절차 ${incompleteActiveCount}개가 남아 있습니다.`
                  : schedule.scenario === "MIN"
                    ? "각 절차의 확인된 최소 처리기간을 적용했습니다."
                    : schedule.scenario === "USER"
                      ? `사용자가 카드에 입력한 전체 경과 예상값 ${timeline.userDurationOverrideProcedureIds.length}건을 우선 적용하고, 나머지는 공식 기준을 사용했습니다. 사용자값은 법정 처리기간이나 기관 평균이 아닙니다.`
                      : "각 절차의 확인된 공식 처리분기·관할 기준을 적용했습니다. 실제 평균 처리기간을 뜻하지 않습니다."}
              </span>
            </div>

            <ol className="duration-stage-flow" aria-label="전체 절차 6단계 그래픽">
              {groups.map((group, index) => (
                <li key={group.stage}>
                  <header><span>{index + 1}</span><strong>{group.label}</strong><small>{group.nodes.length}개</small></header>
                  <div className="duration-procedure-chips">
                    {group.nodes.map((node) => (
                      <span
                        key={node.procedureId}
                        data-procedure-id={node.procedureId}
                        className={[
                          node.excludedFromOperationReady ? "is-post-operation" : "",
                          node.processingDuration === null ? "is-unknown" : "",
                          node.extendsOperationReady ? "is-extending" : "",
                          node.completedCheckpoint ? "is-completed" : "",
                        ].filter(Boolean).join(" ")}
                      >
                        <b>{procedureNames.get(node.procedureId) ?? node.procedureId}</b>
                        {node.completedCheckpoint ? (
                          <small>완료 이정표 · 잔여 처리기간 0일</small>
                        ) : (
                          <small>
                            {node.processingDuration === null
                              ? formatResolvedOfficialDurationSummary(
                                  durationByProcedure.get(node.procedureId),
                                  planningDurationByProcedure.get(node.procedureId),
                                )
                              : formatTimelineProcessingDuration(node)}
                            {node.excludedFromOperationReady
                              ? " · 가동 후 별도"
                              : node.extendsOperationReady
                                ? " · 총기간 연장"
                                : node.overlapsConstruction
                                  ? " · 공사와 병행"
                                  : ""}
                          </small>
                        )}
                      </span>
                    ))}
                    {!group.nodes.length ? <em>현재 포함된 절차 없음</em> : null}
                  </div>
                </li>
              ))}
            </ol>

            <p className="duration-flow-legend">
              같은 단계의 절차는 병렬 진행이 가능할 수 있으며, 실제 착수일은 선행절차·보완요구·관계기관 협의에 따라 달라집니다.
            </p>
          </div>
        )}
      </div>
    </dialog>
  );
}
