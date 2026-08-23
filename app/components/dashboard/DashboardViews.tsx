import {
  inputLabel,
  isInputMatchedRoadmapInclusion,
  procedureCategoryForDecision,
  stageLabels,
} from "@/app/components/dashboard/constants";
import { StatusBadge } from "@/app/components/dashboard/StatusBadge";
import { catalog } from "@/lib/data/catalog";
import type { ScenarioAnswers } from "@/lib/data/catalog";
import {
  isVerifiedLegalSequence,
  verifiedSequenceCitationIds,
} from "@/lib/data/edge-evidence";
import { planningDurationNotice } from "@/lib/data/planning-durations";
import type { ProcedureDecision } from "@/lib/engine/rule-engine";
import type { ScheduleResult } from "@/lib/engine/schedule";
import {
  formatCalendarPeriod,
  formatCompletedCheckpoint,
  formatResolvedOfficialDurationSummary,
  formatTimelineProcessingDuration,
  hasQuantifiedOfficialPeriod,
} from "@/lib/format-duration";

const durationById = new Map(
  catalog.durations.map((duration) => [duration.id, duration]),
);
const procedureById = new Map(
  catalog.procedures.map((procedure) => [procedure.id, procedure]),
);

const documentTypeLabels: Record<(typeof catalog.legalSources)[number]["documentType"], string> = {
  ACT: "법률",
  ENFORCEMENT_DECREE: "시행령",
  ENFORCEMENT_RULE: "시행규칙",
  ADMINISTRATIVE_RULE: "행정규칙",
  NOTICE: "고시",
  LOCAL_ORDINANCE: "자치법규",
  INDUSTRIAL_COMPLEX_PLAN: "산업단지 관리계획",
  OFFICIAL_SERVICE_GUIDE: "공식 민원안내",
};

const sourceStatusLabels: Record<(typeof catalog.legalSources)[number]["status"], string> = {
  AUTHORITATIVE: "공식 원문 확인",
  STALE: "재검토 필요",
  UNVERIFIED: "원문 미검증",
};

const citationRoleLabels: Record<(typeof catalog.citations)[number]["role"], string> = {
  APPLICABILITY: "적용조건",
  AUTHORITY: "관할·권한",
  SEQUENCE: "선후행",
  DEEMING: "인허가 의제",
  DURATION: "처리기간",
  SUBMISSION: "제출자료",
};

const companyOwnerByDomain: Array<[RegExp, string]> = [
  [/환경|대기|수질|폐기물|화학/, "환경 담당"],
  [/안전|소방|위험|가스/, "안전·소방 담당"],
  [/건축|공사|기계/, "설계·건설 담당"],
  [/전력|에너지|용수|하수/, "설비·유틸리티 담당"],
  [/산업단지|입지|공장설립|특별법/, "입지·인허가 PM"],
];

function recommendedOwner(decision: ProcedureDecision) {
  return companyOwnerByDomain.find(([pattern]) => pattern.test(decision.procedure.domain))?.[1]
    ?? "인허가 PM";
}

function authorityNeedsConfirmation(authority: string) {
  return /관할|관계기관|개별 인허가|지정권자|관리기관|입력한/.test(authority);
}

const localAuthorityPattern = /시[·ㆍ/]?군[·ㆍ/]?구|시장[·ㆍ/]?군수[·ㆍ/]?구청장|관할\s*(?:시장|군수|구청장|시청|군청|구청)/;
const provincialAuthorityPattern = /시[·ㆍ]?도(?:지사)?|광역시장|특별자치시장|도지사/;

function hasMultipleAuthorityTiers(authority: string) {
  const tiers = [
    localAuthorityPattern.test(authority),
    provincialAuthorityPattern.test(authority),
    /중앙(?:부처|행정기관)|(?:기후에너지환경|농림축산식품|국토교통|산업통상|고용노동|행정안전|과학기술정보통신)부|장관/.test(authority),
  ].filter(Boolean).length;
  return tiers > 1;
}

type AuthorityResolution = {
  label: string;
  note: string | null;
  specific: boolean;
};

function localDecisionMaker(city: string) {
  if (city.endsWith("시")) return `${city.slice(0, -1)}시장`;
  if (city.endsWith("군")) return `${city.slice(0, -1)}군수`;
  if (city.endsWith("구")) return `${city.slice(0, -1)}구청장`;
  return `${city} 단체장`;
}

function localGovernmentOffice(city: string) {
  return `${city}청`;
}

function provincialDecisionMaker(province: string) {
  if (province.endsWith("시")) return `${province.slice(0, -1)}시장`;
  if (province.endsWith("도")) return `${province}지사`;
  return `${province} 단체장`;
}

function resolveAuthority(
  authority: string,
  answers: ScenarioAnswers,
  role: "RECEIVING" | "DECISION" | "CONSULTATION",
): AuthorityResolution {
  const industrialComplexAuthority = answers.industrialComplexManagingAuthority.trim();
  if (
    industrialComplexAuthority &&
    /(?:입력한|해당)?\s*산업단지\s*관리기관/.test(authority)
  ) {
    return {
      label: industrialComplexAuthority,
      note: role === "RECEIVING"
        ? "산업단지 관리기관 입력값 · 실제 접수창구 확인"
        : "산업단지 관리기관 입력값 · 법정 권한 확인",
      specific: true,
    };
  }

  if (hasMultipleAuthorityTiers(authority)) {
    const enteredJurisdiction = [answers.province, answers.city].filter(Boolean).join(" ");
    return {
      label: authority,
      note: `${enteredJurisdiction ? `입력 지역: ${enteredJurisdiction} · ` : ""}권한분기와 실제 기관·담당부서 확인`,
      specific: false,
    };
  }

  if (
    answers.city &&
    localAuthorityPattern.test(authority)
  ) {
    const decisionMaker = localDecisionMaker(answers.city);
    const governmentOffice = localGovernmentOffice(answers.city);
    const label = authority
      .replace(/관할\s*시장[·ㆍ/]?군수[·ㆍ/]?구청장/g, decisionMaker)
      .replace(/관할\s*(?:시장|군수|구청장)/g, decisionMaker)
      .replace(/관할\s*(?:시청|군청|구청)/g, governmentOffice)
      .replace(/^관할\s*/, "")
      .replace(/시장[·ㆍ/]?군수[·ㆍ/]?구청장/g, decisionMaker)
      .replace(/시[·ㆍ/]?군[·ㆍ/]?구/g, answers.city);
    return {
      label,
      note: `원문 표기: ${authority} · 실제 담당부서 확인`,
      specific: false,
    };
  }

  if (
    answers.province &&
    provincialAuthorityPattern.test(authority)
  ) {
    const label = authority
      .replace(/^관할\s*/, "")
      .replace(/시[·ㆍ]?도지사/g, provincialDecisionMaker(answers.province))
      .replace(/시[·ㆍ]?도/g, answers.province)
      .replace(/(?:광역시장|특별자치시장|도지사)/g, provincialDecisionMaker(answers.province));
    return {
      label,
      note: `원문 표기: ${authority} · 실제 담당부서 확인`,
      specific: false,
    };
  }

  const needsConfirmation = authorityNeedsConfirmation(authority);
  return {
    label: authority,
    note: needsConfirmation ? "일반 기관 표기 · 실제 기관과 담당부서 확인" : null,
    specific: !needsConfirmation,
  };
}

function authorityExportText(authority: AuthorityResolution) {
  return authority.note ? `${authority.label} (${authority.note})` : authority.label;
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function ActionPlanView({
  decisions,
  schedule,
  answers,
  onSelect,
}: {
  decisions: ProcedureDecision[];
  schedule: ScheduleResult;
  answers: ScenarioAnswers;
  onSelect: (id: string) => void;
}) {
  const activeEdgeIds = new Set(schedule.activeEdgeIds);
  const sequenceCitationIds = verifiedSequenceCitationIds({
    citations: catalog.citations,
    sources: catalog.legalSources,
    assessmentDate: answers.assessmentDate,
  });
  const timelineById = new Map(
    (schedule.projectTimeline?.nodes ?? []).map((node) => [node.procedureId, node]),
  );
  const completedCheckpointById = new Map(
    schedule.completedCheckpoints.map((checkpoint) => [
      checkpoint.procedureId,
      checkpoint,
    ]),
  );
  const planningDurationById = new Map(
    schedule.planningDurations.map((duration) => [duration.procedureId, duration]),
  );
  const rows = decisions
    .filter((decision) => procedureCategoryForDecision(decision) !== "NOT_REQUIRED")
    .map((decision) => {
      const category = procedureCategoryForDecision(decision);
      const timeline = timelineById.get(decision.procedure.id);
      const completedCheckpoint =
        timeline?.completedCheckpoint ??
        completedCheckpointById.get(decision.procedure.id) ??
        null;
      const incoming = catalog.edges.filter(
        (edge) => edge.to === decision.procedure.id && activeEdgeIds.has(edge.id),
      );
      const predecessorName = (procedureId: string) =>
        catalog.procedures.find((procedure) => procedure.id === procedureId)?.name ?? procedureId;
      const legalPrerequisites = incoming
        .filter((edge) => isVerifiedLegalSequence(edge, sequenceCitationIds))
        .map((edge) => predecessorName(edge.from));
      const recommendedPrerequisites = incoming
        .filter((edge) => edge.strength !== "LEGAL_HARD")
        .map((edge) => predecessorName(edge.from));
      const unsupportedLegalPrerequisites = incoming
        .filter(
          (edge) =>
            edge.strength === "LEGAL_HARD" &&
            !isVerifiedLegalSequence(edge, sequenceCitationIds),
        )
        .map((edge) => predecessorName(edge.from));
      const receivingAuthority = resolveAuthority(
        decision.procedure.receivingAuthority,
        answers,
        "RECEIVING",
      );
      const statutoryDecisionMaker = resolveAuthority(
        decision.procedure.statutoryDecisionMaker,
        answers,
        "DECISION",
      );
      const consultationAuthorities = [...new Map(
        decision.procedure.consultationAuthorities.map((authority) => {
          const resolved = resolveAuthority(authority, answers, "CONSULTATION");
          return [authorityExportText(resolved), resolved] as const;
        }),
      ).values()];
      const hasSubmissionCitation = decision.procedure.citationIds.some((citationId) =>
        catalog.citations.some(
          (citation) => citation.id === citationId && citation.role === "SUBMISSION",
        ),
      );
      const hasAuthorityCitation = decision.procedure.citationIds.some((citationId) =>
        catalog.citations.some(
          (citation) => citation.id === citationId && citation.role === "AUTHORITY",
        ),
      );
      const milestoneTarget = decision.procedure.stage === "PRE_OPERATION"
        ? answers.equipmentInstallationCompletionDate ?? answers.commissioningStartDate
        : decision.procedure.stage === "DURING_CONSTRUCTION"
          ? answers.plannedConstructionStartDate
          : null;
      const inputMatchedInclusion = isInputMatchedRoadmapInclusion(decision);
      const nextAction = completedCheckpoint
        ? "완료 증빙을 보관하고 허가·계약 조건 및 후속 의무 이행상태를 확인"
        : decision.isDeemed
        ? `${receivingAuthority.label} 제출용 상위 승인문서·의제목록·관계기관 협의완료 증빙 확보`
        : category === "CONFIRM"
          ? decision.missingInputs.length
            ? `${decision.missingInputs.slice(0, 2).map(inputLabel).join(" · ")} 확인 후 ${receivingAuthority.label}에 적용 여부 문의`
            : `적용대상·관할·법적 근거를 ${receivingAuthority.label}에 확인`
          : inputMatchedInclusion && decision.needsLegalReview
            ? `적용근거와 실제 관할을 ${receivingAuthority.label}에 확인하고 접수용 구비서류·일정을 확정`
          : `${receivingAuthority.label} 접수용 구비서류를 확정하고 접수·협의 일정을 배정`;
      return {
        decision,
        officialDuration: decision.procedure.durationId
          ? durationById.get(decision.procedure.durationId) ?? null
          : null,
        planningDuration: planningDurationById.get(decision.procedure.id) ?? null,
        category,
        inputMatchedInclusion,
        timeline,
        completedCheckpoint,
        legalPrerequisites,
        recommendedPrerequisites,
        unsupportedLegalPrerequisites,
        receivingAuthority,
        statutoryDecisionMaker,
        consultationAuthorities,
        hasSubmissionCitation,
        hasAuthorityCitation,
        targetDate: completedCheckpoint
          ? completedCheckpoint.completedDate ?? `${completedCheckpoint.confirmedAsOfDate} 기준일 현재 완료`
          : timeline?.startDate ?? milestoneTarget ?? "미정",
        nextAction,
      };
    })
    .sort((left, right) =>
      Number(right.completedCheckpoint !== null) -
        Number(left.completedCheckpoint !== null) ||
      (left.timeline?.startOffsetDays ?? Number.MAX_SAFE_INTEGER) -
        (right.timeline?.startOffsetDays ?? Number.MAX_SAFE_INTEGER) ||
      left.decision.procedure.name.localeCompare(right.decision.procedure.name),
    );
  const evidenceSummary = {
    exactAuthority: rows.filter((row) => row.receivingAuthority.specific).length,
    authorityCitation: rows.filter((row) => row.hasAuthorityCitation).length,
    submissionCitation: rows.filter((row) => row.hasSubmissionCitation).length,
    durationScope: rows.filter((row) => row.completedCheckpoint === null).length,
    officialPeriod: rows.filter(
      (row) =>
        row.completedCheckpoint === null &&
        (
          hasQuantifiedOfficialPeriod(row.officialDuration) ||
          [row.planningDuration?.minimum, row.planningDuration?.typical, row.planningDuration?.upperBound]
            .some((value) => value !== null && value !== undefined)
        ),
    ).length,
    knownDuration: rows.filter(
      (row) =>
        row.completedCheckpoint === null &&
        row.timeline?.processingDuration !== null &&
        row.timeline !== undefined,
    ).length,
  };

  function downloadCsv() {
    const header = ["순번", "절차", "판정", "법정·공식 처리기간", "다음 행동", "권장 사내 담당", "접수기관", "법정 결정권자", "협의기관", "권한근거 상태", "선후행 조문 연결", "실무 권장 선행", "법정 분류·관계근거 보강", "목표 착수일", "준비서류", "서류근거 상태"];
    const body = rows.map((row, index) => [
      String(index + 1),
      row.decision.procedure.name,
      row.inputMatchedInclusion
        ? "로드맵 포함 · 근거 검토 중"
        : row.category === "REQUIRED"
          ? "확정 필수"
          : "추가 확인 필요",
      `${formatResolvedOfficialDurationSummary(row.officialDuration, row.planningDuration)} · ${row.officialDuration?.statutoryPeriod ?? "공식 기간자료 없음"}`,
      row.nextAction,
      recommendedOwner(row.decision),
      authorityExportText(row.receivingAuthority),
      authorityExportText(row.statutoryDecisionMaker),
      row.consultationAuthorities.map(authorityExportText).join(" · ") || "별도 협의기관 없음",
      row.hasAuthorityCitation ? "법정 권한 인용 연결" : "권한 원문 근거 미연결·관할 확인 필요",
      row.legalPrerequisites.join(" · ") || "선후행 조문이 연결된 직접 선행 없음",
      row.recommendedPrerequisites.join(" · ") || "직접 실무 권장 선행 없음",
      row.unsupportedLegalPrerequisites.join(" · ") || "없음",
      row.targetDate,
      row.decision.procedure.submissions.join(" · "),
      row.hasSubmissionCitation ? "법정 제출자료 인용 연결" : "초안 목록·원문 대조 필요",
    ]);
    const csv = [header, ...body].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `permit-action-plan-${answers.assessmentDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="action-plan-layout">
      <header className="action-plan-heading">
        <div><span className="eyebrow">실행 체크리스트</span><h3>다음 행동과 담당·접수 순서</h3><p>법정 제출자료 인용이 없는 항목은 초안 목록으로 표시하며, 접수 전 공식 서식과 관할부서에 대조해야 합니다.</p></div>
        <button type="button" className="secondary-button" onClick={downloadCsv}>CSV 내보내기</button>
      </header>
      <div className="action-plan-status" role="note">
        <strong>법정 처리기간과 회사 계획기간은 분리됩니다.</strong>
        <span>목표일은 현재 일정 그래프의 착수일이며 신청인 준비·보완·위원회 대기기간이 확인되지 않으면 총기간으로 사용할 수 없습니다.</span>
      </div>
      <section className="action-plan-evidence" aria-label="실행계획 근거 완성도">
        <div><span>현재 실행대상</span><strong>{rows.length}</strong><small>개 절차</small></div>
        <div><span>기관명 구체화</span><strong>{evidenceSummary.exactAuthority}</strong><small>/ {rows.length}</small></div>
        <div className={evidenceSummary.authorityCitation < rows.length ? "has-gap" : ""}><span>권한 원문 연결</span><strong>{evidenceSummary.authorityCitation}</strong><small>/ {rows.length}</small></div>
        <div className={evidenceSummary.submissionCitation < rows.length ? "has-gap" : ""}><span>제출자료 원문 연결</span><strong>{evidenceSummary.submissionCitation}</strong><small>/ {rows.length}</small></div>
        <div><span>정량 공식기간 확보</span><strong>{evidenceSummary.officialPeriod}</strong><small>/ {evidenceSummary.durationScope} · 미정량은 법정 총기한 미규정·단계기한</small></div>
        <div className={evidenceSummary.knownDuration < evidenceSummary.durationScope ? "has-gap" : ""}><span>잔여 처리기간 근거</span><strong>{evidenceSummary.knownDuration}</strong><small>/ {evidenceSummary.durationScope}</small></div>
      </section>
      <div className="action-plan-list">
        {rows.map((row, index) => (
          <article className={`action-plan-card action-${row.category.toLowerCase()}`} key={row.decision.procedure.id}>
            <header>
              <span>{String(index + 1).padStart(2, "0")} · {stageLabels[row.decision.procedure.stage]}</span>
              <strong>{row.decision.procedure.name}</strong>
              <em>{row.inputMatchedInclusion ? "로드맵 포함 · 근거 검토" : row.category === "REQUIRED" ? "확정 필수" : "추가 확인 필요"}</em>
            </header>
            <dl>
              <div><dt>다음 행동</dt><dd>{row.nextAction}</dd></div>
              <div><dt>권장 사내 담당</dt><dd>{recommendedOwner(row.decision)}</dd></div>
              <div><dt>접수기관</dt><dd>{row.receivingAuthority.label}{row.receivingAuthority.note ? <small>{row.receivingAuthority.note}</small> : null}</dd></div>
              <div><dt>법정 결정권자</dt><dd>{row.statutoryDecisionMaker.label}{row.statutoryDecisionMaker.note ? <small>{row.statutoryDecisionMaker.note}</small> : null}</dd></div>
              <div><dt>협의기관</dt><dd>{row.consultationAuthorities.length ? row.consultationAuthorities.map((authority, authorityIndex) => <span key={`${authority.label}-${authorityIndex}`}>{authority.label}{authority.note ? <small>{authority.note}</small> : null}</span>) : "별도 협의기관 없음"}</dd></div>
              <div><dt>법정·공식 처리기간</dt><dd>{formatResolvedOfficialDurationSummary(row.officialDuration, row.planningDuration)}<small>{row.officialDuration?.statutoryPeriod ?? "공식 기간자료 없음"}</small></dd></div>
              <div><dt>선후행 조문 연결</dt><dd>{row.legalPrerequisites.length ? row.legalPrerequisites.join(" · ") : "선후행 조문이 연결된 직접 선행 없음"}</dd></div>
              <div><dt>실무 권장 선행</dt><dd>{row.recommendedPrerequisites.length ? row.recommendedPrerequisites.join(" · ") : "직접 실무 권장 선행 없음"}</dd></div>
              {row.unsupportedLegalPrerequisites.length ? <div><dt>법정 분류·관계근거 보강</dt><dd>{row.unsupportedLegalPrerequisites.join(" · ")}<small>선후행 역할의 현행 공식 조문이 확인되기 전에는 법적 강제순서로 단정하지 않습니다.</small></dd></div> : null}
              <div><dt>목표 착수일</dt><dd>{row.targetDate}{row.timeline?.processingDuration === null ? " · 총경과 산정 제외" : ""}</dd></div>
              <div><dt>준비서류</dt><dd>{row.decision.procedure.submissions.join(" · ") || "수록 자료 없음"}<small>{row.hasSubmissionCitation ? "법정 제출자료 인용 연결" : "초안 목록 · 공식 서식/원문 대조 필요"}</small></dd></div>
            </dl>
            <button type="button" className="text-button" onClick={() => onSelect(row.decision.procedure.id)}>근거·기관·기간 상세 보기</button>
          </article>
        ))}
      </div>
      {!rows.length ? <div className="empty-state">현재 실행계획에 포함할 절차가 없습니다.</div> : null}
    </div>
  );
}

export function ProcedureList({ decisions, schedule, onSelect }: {
  decisions: ProcedureDecision[];
  schedule: ScheduleResult;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="table-shell">
      <table className="procedure-table">
        <thead><tr><th>판정</th><th>절차</th><th>단계</th><th>접수 기관</th><th>공식 처리기간</th><th>일정 반영</th><th><span className="sr-only">상세</span></th></tr></thead>
        <tbody>
          {decisions.map((decision) => {
            const node = schedule.nodes.find((item) => item.procedureId === decision.procedure.id);
            const timelineNode = schedule.projectTimeline?.nodes.find((item) => item.procedureId === decision.procedure.id);
            const officialDuration = decision.procedure.durationId
              ? durationById.get(decision.procedure.durationId)
              : undefined;
            const planningDuration = schedule.planningDurations.find(
              (duration) => duration.procedureId === decision.procedure.id,
            );
            const completedCheckpoint =
              timelineNode?.completedCheckpoint ??
              schedule.completedCheckpoints.find(
                (item) => item.procedureId === decision.procedure.id,
              ) ??
              null;
            return (
              <tr key={decision.procedure.id}>
                <td><StatusBadge status={decision.status} isDeemed={decision.isDeemed} provisionalEffect={decision.provisionalEffect} missingInputs={decision.missingInputs} conflictRuleIds={decision.conflictRuleIds} needsLegalReview={decision.needsLegalReview} /></td>
                <td><strong>{decision.procedure.name}</strong><small>{decision.procedure.domain}</small>{decision.specialLawImpacts?.length ? <em className="special-law-chip">{decision.specialLawImpacts[0].effectLabel} · {decision.specialLawImpacts[0].statusLabel}</em> : null}</td>
                <td>{stageLabels[decision.procedure.stage]}</td>
                <td>{decision.procedure.receivingAuthority}</td>
                <td><strong>{formatResolvedOfficialDurationSummary(officialDuration, planningDuration)}</strong><small>{officialDuration?.statutoryPeriod ?? "공식 기간자료 없음"}</small></td>
                <td>{completedCheckpoint ? "완료 이정표 · 잔여 업무 없음" : !timelineNode ? "공사일 입력 시 계산" : timelineNode.excludedFromOperationReady ? "가동 후 별도" : timelineNode.processingDuration === null ? "총경과 미규정 · 사용자값 입력 가능" : timelineNode.overlapsConstruction && !timelineNode.extendsOperationReady ? `공사 중 흡수(${timelineNode.overlapWithConstructionDays}일)` : timelineNode.extendsOperationReady ? `준공 뒤 연장 · ${formatTimelineProcessingDuration(timelineNode)}` : node?.parallel ? `병렬 진행 · ${formatTimelineProcessingDuration(timelineNode)}` : `순차 진행 · ${formatTimelineProcessingDuration(timelineNode)}`}</td>
                <td><button type="button" className="text-button" onClick={() => onSelect(decision.procedure.id)}>보기</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!decisions.length ? <div className="empty-state">현재 필터와 일치하는 절차가 없습니다.</div> : null}
    </div>
  );
}

export function ScheduleView({ schedule, answers }: { schedule: ScheduleResult; answers: ScenarioAnswers }) {
  const names = new Map(catalog.procedures.map((item) => [item.id, item.name]));
  const timeline = schedule.projectTimeline;
  if (!timeline) {
    return (
      <div className="schedule-layout">
        <div className="empty-state schedule-empty-state">
          <strong>공사 시작일과 준공일을 입력해 주세요.</strong>
          <span>공사 일정이 있어야 공식 처리기간, 공사기간, 병행 가능한 절차를 한 일정으로 계산할 수 있습니다.</span>
        </div>
        {schedule.completedCheckpoints.length ? (
          <section className="company-milestones" aria-label="확인된 완료 이정표">
            <header><strong>확인된 완료 이정표</strong><span>공사 일정과 별개로 이미 끝난 절차이며 남은 처리기간에 더하지 않습니다.</span></header>
            <div>{schedule.completedCheckpoints.map((checkpoint) => <p key={checkpoint.procedureId}><span>{names.get(checkpoint.procedureId) ?? checkpoint.procedureId}</span><strong>{formatCompletedCheckpoint(checkpoint)}</strong></p>)}</div>
          </section>
        ) : null}
      </div>
    );
  }

  const activeNodes = timeline.nodes.filter((node) => !node.excludedFromOperationReady);
  const postNodes = timeline.nodes.filter((node) => node.excludedFromOperationReady);
  const timedActiveNodes = activeNodes.filter(
    (node) => !node.completedCheckpoint && node.processingDuration !== null,
  );
  const absorbedNodes = timedActiveNodes.filter(
    (node) => node.overlapsConstruction && !node.extendsOperationReady,
  );
  const extendingNodes = timedActiveNodes.filter((node) => node.extendsOperationReady);
  const unknownActiveNodes = activeNodes.filter((node) => node.processingDuration === null);
  const planningDurationByProcedure = new Map(
    schedule.planningDurations.map((duration) => [duration.procedureId, duration]),
  );
  const officialSummaryForNode = (procedureId: string) => {
    const procedure = procedureById.get(procedureId);
    return formatResolvedOfficialDurationSummary(
      procedure?.durationId ? durationById.get(procedure.durationId) : null,
      planningDurationByProcedure.get(procedureId),
    );
  };
  const statutoryMilestoneOnlyNodes = unknownActiveNodes.filter((node) => {
    const procedure = procedureById.get(node.procedureId);
    return hasQuantifiedOfficialPeriod(
      procedure?.durationId ? durationById.get(procedure.durationId) : null,
    );
  });
  const nationwideTotalUnregulatedNodes = unknownActiveNodes.filter(
    (node) => !statutoryMilestoneOnlyNodes.includes(node),
  );
  const incompleteActiveDurationComponentCount =
    timeline.incompleteDurationComponentProcedureIds.filter(
      (id) => !timeline.postOperationProcedureIds.includes(id),
    ).length;
  const denominator = timeline.displayHorizonDays;
  const dayIndex = (value: string) =>
    Math.floor(new Date(value + "T00:00:00.000Z").getTime() / 86_400_000);
  const displayedConstructionStart =
    timeline.adjustedConstructionStartDate ?? timeline.plannedConstructionStartDate;
  const displayedConstructionEnd =
    timeline.constructionCompletionDate ?? timeline.plannedConstructionEndDate;
  const constructionStartOffset = Math.max(
    0,
    dayIndex(displayedConstructionStart) - dayIndex(timeline.projectStartDate),
  );
  const constructionDays =
    dayIndex(displayedConstructionEnd) - dayIndex(displayedConstructionStart) + 1;
  const constructionWidth = Math.max((constructionDays / denominator) * 100, 1.5);
  const completionDate = timeline.operationReadyDate ?? timeline.minimumKnownCompletionDate;
  const totalDuration = formatCalendarPeriod(timeline.projectStartDate, completionDate);
  const statusTitle =
    timeline.durationStatus === "MINIMUM_ONLY"
      ? "공식 처리기간이 확인된 절차만 합산한 결과입니다."
      : timeline.durationStatus === "CONDITIONAL_INCLUDED"
        ? "적용 여부를 확인할 절차까지 포함했습니다."
        : schedule.scenario === "MIN"
          ? "확인된 공식 최단 처리경로입니다."
          : schedule.scenario === "USER"
            ? `사용자 예상 처리기간 ${timeline.userDurationOverrideProcedureIds.length}건을 반영한 경로입니다.`
            : "확인된 공식 기준 처리경로입니다. 실제 평균을 뜻하지 않습니다.";
  const durationLabel = timeline.durationStatus === "MINIMUM_ONLY"
    ? "확인된 일정 하한"
    : "총 소요기간";
  const companyMilestones = [
    answers.equipmentInstallationCompletionDate
      ? { label: "주요 설비 설치완료", date: answers.equipmentInstallationCompletionDate }
      : null,
    answers.commissioningStartDate
      ? { label: "시운전 시작", date: answers.commissioningStartDate }
      : null,
  ].filter((item): item is { label: string; date: string } => item !== null);

  return (
    <div className="schedule-layout">
      <div className="schedule-summary">
        <div>
          <span>{durationLabel}</span>
          <strong>{totalDuration}<small>{timeline.durationStatus === "MINIMUM_ONLY" ? ` · 확인된 처리기간 기준 하한 · 법정기한만 확인 ${statutoryMilestoneOnlyNodes.length}개 · 전국 총기간 미규정 ${nationwideTotalUnregulatedNodes.length}개 · 기간 구성 미확인 ${incompleteActiveDurationComponentCount}개${schedule.scenario === "USER" ? ` · 사용자 예상 ${timeline.userDurationOverrideProcedureIds.length}건 반영` : ""}` : schedule.scenario === "MIN" ? " · 최소기간" : schedule.scenario === "USER" ? ` · 사용자 예상 ${timeline.userDurationOverrideProcedureIds.length}건 반영` : " · 공식 기준"}</small></strong>
        </div>
        <div>
          <span>{timeline.permitLeadCalendarDays === null ? "계획상 착공 준비" : "착공 전 인허가"}</span>
          <strong>{timeline.permitLeadCalendarDays ?? timeline.plannedPreConstructionCalendarDays}<small>일</small></strong>
        </div>
        <div><span>공사기간</span><strong>{formatCalendarPeriod(timeline.plannedConstructionStartDate, timeline.plannedConstructionEndDate)}<small> · {timeline.constructionCalendarDays}일</small></strong></div>
        <div><span>공사 중 병행</span><strong>{timeline.durationStatus === "MINIMUM_ONLY" ? "확인 범위" : timeline.absorbedByConstructionCalendarDays}<small>{timeline.durationStatus === "MINIMUM_ONLY" ? " " + absorbedNodes.length + "개 절차" : "일"}</small></strong></div>
      </div>
      <div className="schedule-coverage" aria-label="절차 기간 반영 현황">
        <div><span>가동 준비 경로</span><strong>{activeNodes.length}</strong><small>개 절차</small></div>
        <div><span>총경과 산정 가능</span><strong>{timedActiveNodes.length}</strong><small>개 절차</small></div>
        <div><span>공사 중 완료</span><strong>{absorbedNodes.length}</strong><small>개 절차</small></div>
        <div><span>준공 뒤 연장</span><strong>{extendingNodes.length}</strong><small>개 절차</small></div>
        <div className={unknownActiveNodes.length || incompleteActiveDurationComponentCount ? "has-gap" : ""}><span>총경과 산정 제외</span><strong>{unknownActiveNodes.length + incompleteActiveDurationComponentCount}</strong><small>법정기한만 {statutoryMilestoneOnlyNodes.length} · 전국 총기간 미규정 {nationwideTotalUnregulatedNodes.length} · 구성 {incompleteActiveDurationComponentCount}</small></div>
        <div><span>가동 후 별도</span><strong>{postNodes.length}</strong><small>개 절차</small></div>
      </div>
      <div className="timeline-milestones" aria-label="주요 일정">
        <div><span>계획상 인허가 착수</span><strong>{timeline.projectStartDate}</strong></div>
        <div><span>계획 착공</span><strong>{timeline.plannedConstructionStartDate}</strong></div>
        <div><span>계획 준공</span><strong>{timeline.plannedConstructionEndDate}</strong><small>사용자 입력</small></div>
        <div className={timeline.constructionDelayCalendarDays ? "is-delayed" : ""}>
          <span>인허가 반영 착공·준공</span>
          <strong>{timeline.adjustedConstructionStartDate && timeline.constructionCompletionDate ? timeline.adjustedConstructionStartDate + " ~ " + timeline.constructionCompletionDate : "기간 근거 확인 필요"}</strong>
          {timeline.constructionDelayCalendarDays ? <small>{timeline.constructionDelayCalendarDays}일 순연</small> : timeline.constructionDelayCalendarDays === 0 ? <small>계획대로</small> : <small>미확인 절차 있음</small>}
        </div>
        <div><span>가동 준비 완료</span><strong>{timeline.operationReadyDate ?? "기간 근거 확인 필요"}</strong>{timeline.operationReadyDate ? null : <small>확인된 경계 {timeline.minimumKnownCompletionDate}</small>}</div>
      </div>
      {companyMilestones.length ? (
        <section className="company-milestones" aria-label="사용자 계획 마일스톤">
          <header><strong>회사 계획 마일스톤</strong><span>인허가 계산값이 아닌 사용자 입력 목표일입니다.</span></header>
          <div>{companyMilestones.map((milestone) => <p key={milestone.label}><span>{milestone.label}</span><strong>{milestone.date}</strong></p>)}</div>
        </section>
      ) : null}
      <div className="schedule-warning" role="note"><strong>{statusTitle}</strong><span>{planningDurationNotice}</span></div>
      <div className="gantt-shell" aria-label="인허가와 공사를 합친 날짜별 일정">
        <div className="gantt-scale"><span>{timeline.projectStartDate}</span><span>중간</span><span>{completionDate}</span></div>
        <div className="gantt-row construction-gantt-row">
          <div className="gantt-label"><strong>건설공사</strong><span>{displayedConstructionStart} ~ {displayedConstructionEnd} · {timeline.constructionCalendarDays}일</span></div>
          <div className="gantt-track"><span className="gantt-bar is-construction" style={{ left: (constructionStartOffset / denominator) * 100 + "%", width: Math.min(constructionWidth, Math.max(1.5, 100 - (constructionStartOffset / denominator) * 100)) + "%" }} /></div>
        </div>
        {activeNodes.map((node) => {
          const left = Math.max(0, (node.startOffsetDays / denominator) * 100);
          const durationDays = Math.max(0, node.finishOffsetDays - node.startOffsetDays);
          const width = Math.max((durationDays / denominator) * 100, 1.2);
          return (
            <div className="gantt-row" key={node.procedureId}>
              <div className="gantt-label">
                <strong>{names.get(node.procedureId)}</strong>
                <span>{node.completedCheckpoint ? formatCompletedCheckpoint(node.completedCheckpoint) : `${node.processingDuration === null ? officialSummaryForNode(node.procedureId) : formatTimelineProcessingDuration(node)} · ${node.startDate} ~ ${node.finishDate}${node.overlapsConstruction ? " · 공사와 " + node.overlapWithConstructionDays + "일 병행" : ""}`}</span>
              </div>
              <div className="gantt-track"><span className={"gantt-bar " + (node.completedCheckpoint ? "is-completed " : "") + (node.extendsOperationReady ? "is-critical " : "") + (node.overlapsConstruction ? "is-overlap " : "") + (node.processingDuration === null ? "is-unknown" : "")} style={{ left: left + "%", width: Math.min(width, Math.max(1.2, 100 - left)) + "%" }} /></div>
            </div>
          );
        })}
      </div>
      {postNodes.length ? (
        <section className="post-operation-list">
          <h3>가동 후 별도 관리</h3>
          <p>아래 절차는 가동 준비 완료일과 총 소요기간에 넣지 않았습니다.</p>
          <ul>{postNodes.map((node) => <li key={node.procedureId}><strong>{names.get(node.procedureId)}</strong><span>{node.completedCheckpoint ? formatCompletedCheckpoint(node.completedCheckpoint) : `${node.processingDuration === null ? officialSummaryForNode(node.procedureId) : formatTimelineProcessingDuration(node)} · ${node.startDate}부터`}</span></li>)}</ul>
        </section>
      ) : null}
      <div className="warning-list">{timeline.warnings.map((warning) => <p key={warning}>※ {warning}</p>)}</div>
    </div>
  );
}

export function LegalView({ decisions, onSelect }: { decisions: ProcedureDecision[]; onSelect: (id: string) => void }) {
  const relevantCitationIds = new Set(decisions.flatMap((decision) => [
    ...decision.procedure.citationIds,
    ...decision.traces.flatMap((trace) => trace.citationIds),
    ...(decision.specialLawImpacts ?? []).flatMap((impact) => impact.citationIds),
  ]));
  const relevantSourceIds = new Set(catalog.citations.filter((citation) => relevantCitationIds.has(citation.id)).map((citation) => citation.sourceId));
  return (
    <div className="legal-grid">
      {catalog.legalSources.filter((source) => relevantSourceIds.has(source.id)).map((source) => {
        const sourceCitations = catalog.citations.filter((citation) => citation.sourceId === source.id && relevantCitationIds.has(citation.id));
        const linked = decisions.filter((decision) => [
          ...decision.procedure.citationIds,
          ...decision.traces.flatMap((trace) => trace.citationIds),
          ...(decision.specialLawImpacts ?? []).flatMap((impact) => impact.citationIds),
        ].some((id) => sourceCitations.some((citation) => citation.id === id)));
        return (
          <article className="source-card" key={source.id}>
            <div className="source-card-topline"><span>{documentTypeLabels[source.documentType]}</span><em className={`source-status source-${source.status.toLowerCase()}`}>{sourceStatusLabels[source.status]}</em></div>
            <h3>{source.title}</h3><p>{source.issuingAuthority} · {source.effectiveDate ? `시행 ${source.effectiveDate}` : "시행일 추가 확인"}</p>
            <ul>{sourceCitations.map((citation) => <li key={citation.id}><strong>{[citation.article, citation.paragraph].filter(Boolean).join(" ") || citationRoleLabels[citation.role]}</strong><span>{citation.summary}</span></li>)}</ul>
            <div className="source-card-actions"><a href={source.officialUrl} target="_blank" rel="noreferrer">공식 원문 ↗</a>{linked.slice(0, 2).map((decision) => <button key={decision.procedure.id} type="button" onClick={() => onSelect(decision.procedure.id)}>{decision.procedure.name}</button>)}</div>
          </article>
        );
      })}
    </div>
  );
}

export function GapsView({ decisions }: { decisions: ProcedureDecision[] }) {
  const stagePriority = Object.keys(stageLabels);
  const missing = [...new Set(decisions.flatMap((decision) => decision.missingInputs))]
    .map((path) => {
      const affected = decisions.filter((decision) => decision.missingInputs.includes(path));
      return {
        path,
        affected,
        stage: Math.min(...affected.map((decision) => stagePriority.indexOf(decision.procedure.stage))),
        requiredCandidateCount: affected.filter((decision) => decision.provisionalEffect === "INCLUDE").length,
      };
    })
    .sort((left, right) =>
      right.requiredCandidateCount - left.requiredCandidateCount ||
      left.stage - right.stage ||
      left.path.localeCompare(right.path),
    );
  return (
    <div className="gaps-layout">
      <section className="gap-section priority-gap"><span className="eyebrow">임계경로 영향순</span><h3>판정에 필요한 추가 정보</h3>{missing.length ? <ol className="priority-missing-list">{missing.map((item, index) => <li key={item.path}><span>{index + 1}</span><div><strong>{inputLabel(item.path)}</strong><small>관련 {item.affected.length}개 · 계획경로 후보 {item.requiredCandidateCount}개 · {item.affected.slice(0, 3).map((decision) => decision.procedure.name).join(" · ")}{item.affected.length > 3 ? " 외" : ""}</small></div></li>)}</ol> : <p>현재 수록된 판정규칙에 필요한 입력값은 모두 채워졌습니다. 필지별 규제와 지역기준은 별도로 확인해야 합니다.</p>}</section>
      <section className="gap-section"><span className="eyebrow">검토 범위</span><h3>현재 데이터에 포함되지 않은 항목</h3><ul>{catalog.coverage.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul></section>
      <section className="gap-section future-gap"><span className="eyebrow">법령 점검</span><h3>다음 확인 예정사항</h3><ul>{catalog.coverage.futureLawWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section>
    </div>
  );
}
