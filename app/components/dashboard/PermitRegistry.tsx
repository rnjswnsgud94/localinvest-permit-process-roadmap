"use client";

import { useId, useMemo, useRef, useState } from "react";

import {
  actionLabels,
  compareProcedures,
  procedureSortLabels,
  stageLabels,
  type ProcedureSortMode,
} from "@/app/components/dashboard/constants";
import { catalog } from "@/lib/data/catalog";
import type { LegalSource, Procedure } from "@/lib/domain/schemas";
import { practicalPriorityForProcedure } from "@/lib/engine/practical-priority";
import {
  formatOfficialDurationSummary,
  hasQuantifiedOfficialPeriod,
} from "@/lib/format-duration";

type VerificationStatus = Procedure["verificationStatus"];
type DurationStatus =
  | "QUANTIFIED"
  | "NO_NATIONWIDE_TOTAL"
  | "FUTURE_EFFECTIVE"
  | "NEEDS_CONFIRMATION";

const verificationLabels: Record<VerificationStatus, string> = {
  AI_ASSISTED_DRAFT: "관계기관 확인 권장",
  INTERNAL_REVIEWED: "공식자료 내부 대조",
  EXPERT_REVIEWED: "전문가 검토 완료",
  TODO_LEGAL_REVIEW: "관계기관 확인 필요",
};

const durationStatusLabels: Record<DurationStatus, string> = {
  QUANTIFIED: "법정·공식 수치 확인",
  NO_NATIONWIDE_TOTAL: "전국 공통 총기간 미규정",
  FUTURE_EFFECTIVE: "시행 전 기간 근거 · 현재 미적용",
  NEEDS_CONFIRMATION: "기간 근거 추가 확인",
};

const citationsById = new Map(catalog.citations.map((citation) => [citation.id, citation]));
const sourcesById = new Map(catalog.legalSources.map((source) => [source.id, source]));
const rulesById = new Map(catalog.rules.map((rule) => [rule.id, rule]));
const durationsById = new Map(catalog.durations.map((duration) => [duration.id, duration]));

function normalizeSearchText(value: string) {
  return value.toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim();
}

function sourcesForCitationIds(citationIds: readonly string[]) {
  return [...new Set(citationIds)].flatMap<LegalSource>((citationId) => {
    const citation = citationsById.get(citationId);
    const source = citation ? sourcesById.get(citation.sourceId) : undefined;
    return source ? [source] : [];
  }).filter((source, index, items) =>
    items.findIndex((item) => item.id === source.id) === index,
  );
}

function durationSourcesFor(procedure: Procedure) {
  const duration = procedure.durationId ? durationsById.get(procedure.durationId) : undefined;
  return sourcesForCitationIds([
    ...(duration?.citationIds ?? []),
    ...(duration?.referencePeriods?.flatMap((period) => period.citationIds) ?? []),
  ]);
}

function isFutureEffective(source: LegalSource, assessmentDate: string) {
  return Boolean(source.effectiveDate && source.effectiveDate > assessmentDate);
}

function durationStatusFor(procedure: Procedure, assessmentDate: string): DurationStatus {
  const duration = procedure.durationId ? durationsById.get(procedure.durationId) : undefined;
  if (durationSourcesFor(procedure).some((source) => isFutureEffective(source, assessmentDate))) {
    return "FUTURE_EFFECTIVE";
  }
  if (formatOfficialDurationSummary(duration).includes("전국 공통 법정 총기간 미규정")) {
    return "NO_NATIONWIDE_TOTAL";
  }
  if (hasQuantifiedOfficialPeriod(duration)) return "QUANTIFIED";
  return "NEEDS_CONFIRMATION";
}

function legalSourcesFor(procedure: Procedure) {
  const duration = procedure.durationId ? durationsById.get(procedure.durationId) : undefined;
  const citationIds = new Set([
    ...procedure.citationIds,
    ...procedure.ruleIds.flatMap((ruleId) => rulesById.get(ruleId)?.citationIds ?? []),
    ...(duration?.citationIds ?? []),
    ...(duration?.referencePeriods?.flatMap((period) => period.citationIds) ?? []),
  ]);
  return sourcesForCitationIds([...citationIds])
    .sort((left, right) => left.title.localeCompare(right.title, "ko"));
}

const registryBaseEntries = catalog.procedures.map((procedure) => {
  const duration = procedure.durationId ? durationsById.get(procedure.durationId) : undefined;
  return {
    procedure,
    practicalPriority: practicalPriorityForProcedure(procedure),
    legalSources: legalSourcesFor(procedure),
    durationSources: durationSourcesFor(procedure),
    duration,
    durationSummary: formatOfficialDurationSummary(duration),
  };
});

const domains = [...new Set(catalog.procedures.map((procedure) => procedure.domain))]
  .sort((left, right) => left.localeCompare(right, "ko"));

export function PermitRegistry({
  onSelectProcedure,
  assessmentDate = catalog.coverage.assessmentDefault,
}: {
  onSelectProcedure: (procedureId: string) => void;
  assessmentDate?: string;
}) {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("ALL");
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | "ALL">("ALL");
  const [durationStatus, setDurationStatus] = useState<DurationStatus | "ALL">("ALL");
  const [sortMode, setSortMode] = useState<ProcedureSortMode>("NAME");
  const queryInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const searchHelpId = useId();
  const resultSummaryId = useId();

  const registryEntries = useMemo(() => registryBaseEntries.map((entry) => {
    const futureSources = entry.legalSources.filter((source) =>
      isFutureEffective(source, assessmentDate),
    );
    const futureDurationDates = [...new Set(
      entry.durationSources.flatMap((source) =>
        isFutureEffective(source, assessmentDate) && source.effectiveDate
          ? [source.effectiveDate]
          : [],
      ),
    )].sort();
    const legalSourceLabels = entry.legalSources.map((source) =>
      isFutureEffective(source, assessmentDate)
        ? `${source.title} (시행 예정 ${source.effectiveDate} · 기준일 현재 미적용)`
        : source.title,
    );
    const durationStatus = durationStatusFor(entry.procedure, assessmentDate);
    const durationSummary = durationStatus === "FUTURE_EFFECTIVE"
      ? `시행 예정 ${futureDurationDates.join(" · ")} · 기준일 현재 미적용 — ${entry.durationSummary}`
      : entry.durationSummary;
    const searchText = normalizeSearchText([
      entry.procedure.name,
      ...entry.procedure.aliases,
      entry.procedure.domain,
      entry.procedure.description,
      entry.procedure.applicant,
      entry.procedure.receivingAuthority,
      entry.procedure.statutoryDecisionMaker,
      ...entry.procedure.consultationAuthorities,
      ...entry.procedure.submissions,
      entry.procedure.outcome,
      ...entry.procedure.followUpObligations,
      ...legalSourceLabels,
      durationStatusLabels[durationStatus],
      entry.practicalPriority.level,
      entry.practicalPriority.label,
    ].join(" "));

    return {
      ...entry,
      futureSources,
      legalSourceLabels,
      durationStatus,
      durationSummary,
      searchText,
    };
  }), [assessmentDate]);

  const filteredEntries = useMemo(() => {
    const terms = normalizeSearchText(query).split(" ").filter(Boolean);
    return registryEntries.filter((entry) => {
      if (domain !== "ALL" && entry.procedure.domain !== domain) return false;
      if (
        verificationStatus !== "ALL" &&
        entry.procedure.verificationStatus !== verificationStatus
      ) return false;
      if (durationStatus !== "ALL" && entry.durationStatus !== durationStatus) return false;
      return terms.every((term) => entry.searchText.includes(term));
    }).sort((left, right) => compareProcedures(left.procedure, right.procedure, sortMode));
  }, [domain, durationStatus, query, registryEntries, sortMode, verificationStatus]);

  const hasActiveFilters = Boolean(query) || domain !== "ALL" ||
    verificationStatus !== "ALL" || durationStatus !== "ALL";

  function resetFilters() {
    setQuery("");
    setDomain("ALL");
    setVerificationStatus("ALL");
    setDurationStatus("ALL");
    queryInputRef.current?.focus();
  }

  return (
    <section className="permit-registry" aria-labelledby={titleId}>
      <header className="permit-registry-header">
        <div>
          <p className="eyebrow">전체 인허가 백과</p>
          <h2 id={titleId}>인허가 통합검색</h2>
          <p>
            전체 {registryEntries.length}개 절차를 법령, 기관, 제출서류와 결과물까지 한 번에 검색합니다.
            평가기준일은 {assessmentDate}이며, 이후 시행 근거와 기간은 현재 미적용으로 표시합니다.
          </p>
          <p className="practical-priority-disclaimer">
            P0·P1·P2는 착공·가동 일정 관리를 위한 실무 중요도입니다. 법적 효력이나 적용 여부의 우열을 뜻하지 않습니다.
          </p>
        </div>
      </header>

      <div className="permit-registry-controls" role="search" aria-label="전체 인허가 검색">
        <div className="permit-registry-query">
          <label htmlFor={`${titleId}-query`}>법령·기관·서류 통합검색</label>
          <div className="permit-registry-query-field">
            <input
              ref={queryInputRef}
              id={`${titleId}-query`}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Escape" || !query) return;
                event.preventDefault();
                setQuery("");
              }}
              placeholder="예: 건축법, 교통개선대책, 환경청"
              autoComplete="off"
              aria-describedby={searchHelpId}
            />
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setQuery("");
                queryInputRef.current?.focus();
              }}
              disabled={!query}
            >
              검색어 지우기
            </button>
          </div>
          <small id={searchHelpId}>여러 단어를 입력하면 모든 단어가 포함된 절차를 찾습니다.</small>
        </div>

        <div className="permit-registry-filter-grid">
          <label>
            <span>분야</span>
            <select value={domain} onChange={(event) => setDomain(event.target.value)}>
              <option value="ALL">모든 분야</option>
              {domains.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>자료 검토 상태</span>
            <select
              value={verificationStatus}
              onChange={(event) => setVerificationStatus(event.target.value as VerificationStatus | "ALL")}
            >
              <option value="ALL">모든 검토 상태</option>
              {(Object.keys(verificationLabels) as VerificationStatus[]).map((status) => (
                <option key={status} value={status}>{verificationLabels[status]}</option>
              ))}
            </select>
          </label>
          <label>
            <span>기간 상태</span>
            <select
              value={durationStatus}
              onChange={(event) => setDurationStatus(event.target.value as DurationStatus | "ALL")}
            >
              <option value="ALL">모든 기간 상태</option>
              {(Object.keys(durationStatusLabels) as DurationStatus[]).map((status) => (
                <option key={status} value={status}>{durationStatusLabels[status]}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="secondary-button permit-registry-reset"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
          >
            필터 초기화
          </button>
        </div>
      </div>

      <div className="permit-registry-result-toolbar">
        <p
          id={resultSummaryId}
          className="permit-registry-result-summary"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          전체 {registryEntries.length}개 중 {filteredEntries.length}개 절차 · {procedureSortLabels[sortMode]}
        </p>
        <label className="permit-registry-sort">
          <span>정렬</span>
          <select
            aria-label="전체 인허가 정렬"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as ProcedureSortMode)}
          >
            <option value="NAME">가나다순</option>
            <option value="STAGE">일정 단계순</option>
            <option value="PRIORITY">실무 중요도순</option>
          </select>
        </label>
      </div>

      {filteredEntries.length ? (
        <ul className="permit-registry-results" aria-labelledby={resultSummaryId}>
          {filteredEntries.map((entry) => (
            <li key={entry.procedure.id}>
              <button
                type="button"
                className="permit-registry-card"
                onClick={() => onSelectProcedure(entry.procedure.id)}
                aria-label={`${entry.procedure.name} 상세 보기`}
              >
                <span className="permit-registry-card-topline">
                  <span>{stageLabels[entry.procedure.stage]} · {entry.procedure.domain} · {actionLabels[entry.procedure.actionType]}</span>
                  <span>{entry.futureSources.length
                    ? "시행 예정 근거 · 현재 미적용"
                    : verificationLabels[entry.procedure.verificationStatus]}</span>
                </span>
                <span className="permit-registry-title-row">
                  <strong>{entry.procedure.name}</strong>
                  <span className={`practical-priority-chip priority-${entry.practicalPriority.level.toLowerCase()}`}>
                    {entry.practicalPriority.level} · {entry.practicalPriority.label}
                  </span>
                </span>
                {entry.procedure.aliases.length ? (
                  <span className="permit-registry-aliases">
                    다른 이름 · {entry.procedure.aliases.join(", ")}
                  </span>
                ) : null}
                <span className="permit-registry-description">{entry.procedure.description}</span>
                <span className="permit-registry-metadata">
                  <span><b>접수</b> {entry.procedure.receivingAuthority}</span>
                  <span><b>결과</b> {entry.procedure.outcome}</span>
                  <span><b>기간</b> {entry.durationSummary}</span>
                  <span>
                    <b>법령</b> {entry.legalSourceLabels.length
                      ? entry.legalSourceLabels.slice(0, 3).join(", ")
                      : "연결된 공식 법령명 확인 필요"}
                  </span>
                </span>
                <span className="permit-registry-open-hint" aria-hidden="true">상세 보기 →</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="permit-registry-empty" role="note">
          <strong>조건에 맞는 인허가가 없습니다.</strong>
          <p>검색어를 줄이거나 분야·검토·기간 필터를 초기화해 보세요.</p>
          <button type="button" className="secondary-button" onClick={resetFilters}>필터 초기화</button>
        </div>
      )}
    </section>
  );
}
