"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";

import { actionLabels, inputLabel, laneLabels, stageLabels } from "@/app/components/dashboard/constants";
import { LawApiVerifier } from "@/app/components/dashboard/LawApiVerifier";
import { StatusBadge } from "@/app/components/dashboard/StatusBadge";
import { catalog } from "@/lib/data/catalog";
import {
  isVerifiedLegalSequence,
  verifiedSequenceCitationIds,
} from "@/lib/data/edge-evidence";
import type { ProcedureDecision } from "@/lib/engine/rule-engine";
import type { ScheduleResult } from "@/lib/engine/schedule";
import {
  formatCompletedCheckpoint,
  formatResolvedOfficialDurationSummary,
  formatTimelineProcessingDuration,
} from "@/lib/format-duration";

function citationTitle(citationId: string) {
  const citation = catalog.citations.find((item) => item.id === citationId);
  const source = catalog.legalSources.find((item) => item.id === citation?.sourceId);
  if (!citation || !source) return null;
  const locator = [citation.article, citation.paragraph, citation.subparagraph, citation.item].filter(Boolean).join(" ");
  return { citation, source, locator };
}

function durationRangeLabel(range: (typeof catalog.durations)[number]["elapsed"]) {
  if (!range) return "근거자료 없음";
  const unit = range.unit === "BUSINESS_DAY" ? "업무일" : range.unit === "CALENDAR_DAY" ? "달력일" : "개월";
  const values = [range.min, range.base, range.max];
  if (values.every((value) => value === null)) return "근거자료 없음";
  if (range.min !== null && range.min === range.base && range.base === range.max) {
    return `${range.min} ${unit}`;
  }
  return `최단 ${range.min ?? "미정"} · 공식 기준 ${range.base ?? "미정"} · 확인 상한 ${range.max ?? "미정"} ${unit}`;
}

function officialTotalDurationLabel(
  duration: (typeof catalog.durations)[number],
  range: (typeof catalog.durations)[number]["elapsed"],
  scope: "AUTHORITY" | "ELAPSED",
) {
  const statutoryPeriod = duration.statutoryPeriod ?? "";
  const immediate = /3근무시간 이내/.test(statutoryPeriod) ||
    (duration.referencePeriods ?? []).some((period) =>
      /3근무시간 이내/.test(`${period.label} ${period.note}`),
    );
  if (scope === "AUTHORITY" && immediate) {
    return "즉시 · 3근무시간 이내 (0일 아님)";
  }
  if (range) {
    if (duration.planningBasis === "OFFICIAL_CAP_ONLY" && range.max !== null) {
      const unit = range.unit === "BUSINESS_DAY" ? "업무일" : range.unit === "CALENDAR_DAY" ? "달력일" : "개월";
      return `법정·공식 상한 ${range.max} ${unit} · 실제 평균 아님`;
    }
    return durationRangeLabel(range);
  }
  if (
    !/확인되지 않|미확인/.test(statutoryPeriod) &&
    /없음|두지 않|정해져 있지 않/.test(statutoryPeriod)
  ) {
    return "법령상 전국 공통 총기간 미규정";
  }
  if (duration.referencePeriods?.some((period) => period.range !== null)) {
    return "전국 공통 총기간 없음 · 아래 단계별 기준 참조";
  }
  return /확인되지 않|미확인/.test(statutoryPeriod)
    ? "전국 공통 총기간 미확인"
    : "공식 근거자료 미확인";
}

function durationReferenceRangeLabel(
  period: NonNullable<(typeof catalog.durations)[number]["referencePeriods"]>[number],
) {
  const range = period.range;
  if (!range) {
    return /3근무시간 이내/.test(period.note)
      ? "즉시 · 3근무시간 이내"
      : "전국 고정 수치 미규정";
  }
  const unit = range.unit === "BUSINESS_DAY" ? "업무일" : range.unit === "CALENDAR_DAY" ? "달력일" : "개월";
  if (range.min !== null && range.min === range.base && range.base === range.max) {
    return `${range.min} ${unit}`;
  }
  if (range.min !== null && range.base === null && range.max === null) {
    return `법정 최소 ${range.min} ${unit}`;
  }
  if (range.min === null && range.base === null && range.max !== null) {
    return `법정 상한 ${range.max} ${unit}`;
  }
  if (period.kind === "OFFICIAL_OPERATION_CAP") {
    return range.max === null ? "공식 상한 확인 필요" : `공식 상한 ${range.max} ${unit}`;
  }
  if (period.kind === "PLANNING_REFERENCE") {
    return range.min !== null && range.max !== null
      ? `계획 참고 ${range.min}~${range.max} ${unit}`
      : `계획 참고 ${range.base ?? range.min ?? range.max ?? "미정"} ${unit}`;
  }
  if (period.kind === "OBSERVED_PRACTICE") {
    return `관측 ${range.min ?? "미정"}~${range.max ?? "미정"} ${unit}`;
  }
  if (period.kind === "LEGAL_DEADLINE") {
    return `법정 분기 ${range.min ?? "미정"}~${range.max ?? "미정"} ${unit}`;
  }
  return durationRangeLabel(range);
}

function authorityNeedsConfirmation(authority: string) {
  return /관할|관계기관|개별 인허가|지정권자|관리기관|입력한/.test(authority);
}

const verificationLabels: Record<string, string> = {
  AI_ASSISTED_DRAFT: "공식자료 대조 초안",
  INTERNAL_REVIEWED: "내부 검토 완료",
  EXPERT_REVIEWED: "전문가 검토 완료",
  TODO_LEGAL_REVIEW: "법령 세부검토 필요",
};

const evidenceLabels: Record<string, string> = {
  STATUTE: "법령",
  OFFICIAL_SERVICE_STANDARD: "공식 민원처리기준",
  OFFICIAL_AGENCY_MATERIAL: "공식 기관자료",
  OBSERVED_CASE: "사례자료",
  EXPERT_ESTIMATE: "전문가 추정",
  INSUFFICIENT_DATA: "근거자료 부족",
};

const durationReferenceKindLabels: Record<string, string> = {
  NATIONWIDE_STATUTORY: "전국 법정기간",
  NATIONWIDE_OFFICIAL_STANDARD: "전국 공식 운영기준",
  LOCAL_OFFICIAL_STANDARD: "관할 공식 기준",
  OFFICIAL_OPERATION_CAP: "법정·공식 상한",
  PLANNING_REFERENCE: "실무 계획 참고",
  OBSERVED_PRACTICE: "실제 처리실적",
  LEGAL_DEADLINE: "법정 이행기한·주기",
  PROCESS_MILESTONE: "공식 절차 단계",
};

const durationComponentLabels: Record<string, string> = {
  APPLICANT_PREPARATION: "신청인 준비",
  AUTHORITY_PROCESSING: "기관 처리",
  INTERAGENCY_CONSULTATION: "관계기관 협의",
  COMMITTEE_WAIT: "위원회 대기",
  SUPPLEMENT: "보완",
  RESULT_NOTICE: "결과 통지",
};

const confidenceLabels: Record<string, string> = {
  HIGH: "높음",
  MEDIUM: "보통",
  LOW: "낮음",
  UNVERIFIED: "미검토",
};

const lagUnitLabels: Record<string, string> = {
  BUSINESS_DAY: "업무일",
  CALENDAR_DAY: "달력일",
  MONTH: "개월",
};

const citationRoleLabels: Record<string, string> = {
  APPLICABILITY: "적용조건",
  AUTHORITY: "관할·권한",
  SEQUENCE: "선후행",
  DEEMING: "인허가 의제",
  DURATION: "처리기간",
  SUBMISSION: "제출자료",
};

export function ProcedureDrawer({
  decision,
  schedule,
  assessmentDate = catalog.coverage.assessmentDefault,
  onClose,
}: {
  decision: ProcedureDecision | null;
  schedule: ScheduleResult;
  assessmentDate?: string;
  onClose: () => void;
}) {
  const drawerRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const procedureId = decision?.procedure.id ?? null;

  useEffect(() => {
    if (!procedureId) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    headingRef.current?.focus();
    return () => {
      const returnTarget = returnFocusRef.current;
      if (returnTarget?.isConnected) returnTarget.focus();
      returnFocusRef.current = null;
    };
  }, [procedureId]);

  function handleDrawerKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...(drawerRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? [])].filter((element) => !element.hasAttribute("hidden"));
    if (!focusable.length) {
      event.preventDefault();
      headingRef.current?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === headingRef.current)
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!decision) return null;
  const procedure = decision.procedure;
  const timelineNode = schedule.projectTimeline?.nodes.find((item) => item.procedureId === procedure.id);
  const completedCheckpoint =
    timelineNode?.completedCheckpoint ??
    schedule.completedCheckpoints.find(
      (item) => item.procedureId === procedure.id,
    ) ??
    null;
  const duration = catalog.durations.find((item) => item.id === procedure.durationId);
  const planningDuration = schedule.planningDurations.find(
    (item) => item.procedureId === procedure.id,
  );
  const relatedEdges = catalog.edges.filter((edge) => edge.from === procedure.id || edge.to === procedure.id);
  const sequenceCitationIds = verifiedSequenceCitationIds({
    citations: catalog.citations,
    sources: catalog.legalSources,
    assessmentDate,
  });
  const decisionCitationIds = [...new Set([
    ...procedure.citationIds,
    ...decision.traces.flatMap((trace) => trace.citationIds),
    ...(decision.specialLawImpacts ?? []).flatMap((impact) => impact.citationIds),
    ...(duration?.citationIds ?? []),
    ...(duration?.referencePeriods?.flatMap((period) => period.citationIds) ?? []),
  ])];
  const hasObservedPractice = duration?.referencePeriods?.some(
    (period) => period.kind === "OBSERVED_PRACTICE",
  ) ?? false;
  const apiSources = decisionCitationIds.flatMap((citationId) => {
    const item = citationTitle(citationId);
    if (!item || !["ACT", "ENFORCEMENT_DECREE", "ENFORCEMENT_RULE"].includes(item.source.documentType)) return [];
    return [{
      id: item.source.id,
      title: item.source.title,
      mst: item.source.mst,
      article: item.citation.article,
      officialUrl: item.source.officialUrl,
    }];
  });

  return (
    <aside
      ref={drawerRef}
      className="procedure-drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${procedure.id}-drawer-title`}
      onKeyDown={handleDrawerKeyDown}
    >
      <div className="drawer-header">
        <div>
          <StatusBadge
            status={decision.status}
            isDeemed={decision.isDeemed}
            provisionalEffect={decision.provisionalEffect}
            missingInputs={decision.missingInputs}
            conflictRuleIds={decision.conflictRuleIds}
            needsLegalReview={decision.needsLegalReview}
          />
          <p className="drawer-kicker">{procedure.domain} · {actionLabels[procedure.actionType]}</p>
          <h2 id={`${procedure.id}-drawer-title`} ref={headingRef} tabIndex={-1}>{procedure.name} 상세정보</h2>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="상세정보 닫기">×</button>
      </div>
      <div className="drawer-body">
        <section className="reason-box">
          <span>판정 이유</span><p>{decision.reason}</p>
          {decision.missingInputs.length ? <p className="missing-inputs"><strong>추가 확인:</strong> {decision.missingInputs.map(inputLabel).join(", ")}</p> : null}
        </section>
        <dl className="detail-grid">
          <div><dt>수행 단계</dt><dd>{stageLabels[procedure.stage]}</dd></div>
          <div><dt>주관 구분</dt><dd>{laneLabels[procedure.lane]}</dd></div>
          <div><dt>접수 기관</dt><dd>{procedure.receivingAuthority}{authorityNeedsConfirmation(procedure.receivingAuthority) ? <small>사업지 주소·위임사무 기준으로 최종 부서 확인 필요</small> : null}</dd></div>
          <div><dt>법정 결정권자</dt><dd>{procedure.statutoryDecisionMaker}</dd></div>
          <div><dt>신청·수행 주체</dt><dd>{procedure.applicant}</dd></div>
          <div><dt>협의 주체</dt><dd>{procedure.consultationAuthorities.length ? procedure.consultationAuthorities.join(", ") : "별도 협의 주체 없음"}</dd></div>
          <div><dt>결과물</dt><dd>{procedure.outcome}</dd></div>
          <div><dt>총 일정상 위치</dt><dd>{completedCheckpoint ? formatCompletedCheckpoint(completedCheckpoint) : timelineNode ? `${timelineNode.startDate} ~ ${timelineNode.finishDate} · ${timelineNode.processingDuration === null ? formatResolvedOfficialDurationSummary(duration, planningDuration) : formatTimelineProcessingDuration(timelineNode)}${timelineNode.overlapsConstruction ? ` · 공사와 ${timelineNode.overlapWithConstructionDays}일 병행` : timelineNode.excludedFromOperationReady ? " · 가동 후 별도" : ""}` : "공사 일정 입력 필요"}</dd></div>
        </dl>
        <section className="drawer-section"><h3>절차 설명</h3><p>{procedure.description}</p></section>
        <section className="drawer-section"><h3>주요 제출자료</h3><ul>{procedure.submissions.map((item) => <li key={item}>{item}</li>)}</ul></section>
        <section className="drawer-section">
          <h3>선후행·병행 관계</h3>
          {relatedEdges.length ? <ul>{relatedEdges.map((edge) => {
            const otherId = edge.from === procedure.id ? edge.to : edge.from;
            const other = catalog.procedures.find((item) => item.id === otherId)?.name ?? otherId;
            const direction = edge.from === procedure.id ? "후속" : "선행";
            const relation = edge.relation === "FINISH_TO_START" ? "완료 후 시작" : edge.relation === "START_TO_START" ? "병행 시작" : "완료 연계";
            const strength = isVerifiedLegalSequence(edge, sequenceCitationIds)
              ? "선후행 조문 연결"
              : edge.strength === "LEGAL_HARD"
                ? edge.citationIds.length
                  ? "법정 분류 · 선후행 조문 보강"
                  : "법정 분류 · 관계근거 미연결"
                : edge.strength === "PRACTICAL"
                  ? "실무 연결"
                  : "참고 연결";
            return <li key={edge.id}><strong>{direction} · {strength}</strong> — {other} ({relation}{edge.lag ? ` + ${edge.lag} ${lagUnitLabels[edge.lagUnit]}` : ""})</li>;
          })}</ul> : <p>현재 카탈로그에 직접 연결된 선후행 관계가 없습니다.</p>}
        </section>
        <section className="drawer-section duration-section">
          <h3>법정·공식 기간과 실무 참고값</h3>
          {duration ? <>
            <div className="official-duration-highlight">
              <span>카드 표시 법정·공식 기간</span>
              <strong>{formatResolvedOfficialDurationSummary(duration, planningDuration)}</strong>
              <small>상한·분기·중간기한은 실제 총 소요기간과 구분합니다.</small>
            </div>
            <dl className="duration-breakdown">
              {duration.applicantPreparation ? <div><dt>신청인 준비 · 접수 전</dt><dd>{durationRangeLabel(duration.applicantPreparation)}</dd></div> : null}
              <div><dt>기관 공식 처리</dt><dd>{officialTotalDurationLabel(duration, duration.authorityProcessing, "AUTHORITY")}</dd></div>
              {duration.interagencyConsultation ? <div><dt>관계기관 협의</dt><dd>{durationRangeLabel(duration.interagencyConsultation)}</dd></div> : null}
              <div><dt>접수 후 확인 경과</dt><dd>{officialTotalDurationLabel(duration, duration.elapsed, "ELAPSED")}</dd></div>
            </dl>
            <p><strong>법정·공식 처리기준:</strong> {duration.statutoryPeriod ?? "확인된 공통 처리기간 없음"}</p>
            <p className={`practical-duration-note${hasObservedPractice ? " has-observation" : ""}`}>
              <strong>실제 통상기간:</strong> {hasObservedPractice
                ? "관측자료가 있는 참고값만 아래에 표본·기간과 함께 표시합니다."
                : "전국 공신력 있는 평균·중앙값 자료가 없어 임의 숫자를 만들지 않았습니다. 아래 공식 상한·관할 기준·운영자료는 실제 평균과 구분해 사용하세요."}
            </p>
            {duration.referencePeriods?.length ? (
              <div className="duration-reference-list">
                {duration.referencePeriods.map((period) => {
                  const sources = period.citationIds.flatMap((citationId) => {
                    const item = citationTitle(citationId);
                    return item ? [item.source] : [];
                  });
                  return (
                    <article key={period.id} className={`duration-reference-card kind-${period.kind.toLowerCase()}`}>
                      <header><span>{durationReferenceKindLabels[period.kind] ?? period.kind}</span><strong>{durationReferenceRangeLabel(period)}</strong></header>
                      <h4>{period.label}</h4>
                      <p><b>기산점</b> {period.startsWhen}</p>
                      {period.jurisdiction ? <p><b>적용지역</b> {period.jurisdiction}</p> : null}
                      {period.includes.length ? <p><b>포함범위</b> {period.includes.map((item) => durationComponentLabels[item] ?? item).join(" · ")}</p> : null}
                      <p>{period.note}</p>
                      <footer>
                        {period.sampleSize
                          ? <span>{period.kind === "OBSERVED_PRACTICE" ? "실적 표본" : "공식 운영자료"} {period.sampleSize}건</span>
                          : <span>공식 기준·절차</span>}
                        {[...new Map(sources.map((source) => [source.id, source])).values()].map((source) => <a key={source.id} href={source.officialUrl} target="_blank" rel="noreferrer">{source.issuingAuthority} 원문 ↗</a>)}
                      </footer>
                    </article>
                  );
                })}
              </div>
            ) : null}
            {duration.stopClockRules.length ? <p><strong>정지·보완:</strong> {duration.stopClockRules.join(" · ")}</p> : null}
            {duration.assumptions.length ? <p><strong>적용 전제:</strong> {duration.assumptions.join(" · ")}</p> : null}
            {duration.variabilityFactors.length ? <p><strong>변동요인:</strong> {duration.variabilityFactors.join(" · ")}</p> : null}
            <small>기간 근거 {evidenceLabels[duration.evidenceType] ?? duration.evidenceType} · 법적 근거 수준 {confidenceLabels[duration.legalConfidence]} · 기간자료 수준 {confidenceLabels[duration.estimateConfidence]} · 확인일 {duration.verifiedAt}</small>
          </> : <p>연결된 기간 데이터가 없습니다.</p>}
        </section>
        {decision.specialLawImpacts?.length ? (
          <section className="drawer-section special-law-impact-section">
            <h3>업종별 특례 반영</h3>
            <div className="special-law-impact-list">
              {decision.specialLawImpacts.map((impact) => (
                <article key={`${impact.lawId}-${impact.effect}`}>
                  <div><strong>{impact.effectLabel}</strong><span className={`impact-status status-${impact.status.toLowerCase()}`}>{impact.statusLabel}</span></div>
                  <p>{impact.description}</p>
                  {impact.statutoryCap ? <small><b>법정 처리기한·조건</b> {impact.statutoryCap}</small> : null}
                  <a href={impact.officialUrl} target="_blank" rel="noreferrer">{impact.lawTitle} {impact.article} ↗</a>
                </article>
              ))}
            </div>
          </section>
        ) : null}
        {procedure.deemedByProcedureIds.length || procedure.deemedProcedureIds.length ? (
          <section className="drawer-section deeming-section">
            <h3>인허가 의제 관계</h3>
            {procedure.deemedByProcedureIds.length ? <p><strong>의제될 수 있는 상위 절차:</strong> {procedure.deemedByProcedureIds.map((id) => catalog.procedures.find((item) => item.id === id)?.name ?? id).join(", ")}</p> : null}
            {procedure.deemedProcedureIds.length ? <p><strong>의제 협의 가능 절차:</strong> {procedure.deemedProcedureIds.map((id) => catalog.procedures.find((item) => item.id === id)?.name ?? id).join(", ")}</p> : null}
            <small>의제는 신청서류 제출과 관계기관 협의를 전제로 하며 자동 승인으로 보지 않습니다.</small>
          </section>
        ) : null}
        <section className="drawer-section">
          <div className="section-heading-row"><h3>공식 근거</h3><span>{decisionCitationIds.length}건</span></div>
          <div className="citation-list">
            {decisionCitationIds.map((citationId) => {
              const item = citationTitle(citationId);
              if (!item) return null;
              return (
                <a key={citationId} href={item.source.officialUrl} target="_blank" rel="noreferrer" className="citation-card">
                  <span>{item.source.title}</span><strong>{item.locator || citationRoleLabels[item.citation.role]}</strong><p>{item.citation.summary}</p>
                  <small>{item.citation.sourceVersion} · 시행 {item.source.effectiveDate ?? "추가 확인"} · 검증 {item.source.internallyVerifiedAt} · 원문 열기 ↗</small>
                </a>
              );
            })}
            {!decisionCitationIds.length ? <div className="citation-empty">공식 공급기관 기준을 아직 수집하지 않아 확정 근거로 표시하지 않습니다.</div> : null}
          </div>
          <LawApiVerifier sources={apiSources} />
        </section>
        <section className="review-note">
          <strong>자료 확인 상태 · {verificationLabels[procedure.verificationStatus] ?? procedure.verificationStatus}</strong><p>{procedure.reviewNote}</p>
          {decision.needsLegalReview ? <p><strong>추가 법률검토:</strong> {decision.legalReviewReasons.join(" · ")}</p> : null}
          <small>검토일 {procedure.reviewedAt} · 데이터 {decision.dataVersion}</small>
        </section>
      </div>
    </aside>
  );
}
