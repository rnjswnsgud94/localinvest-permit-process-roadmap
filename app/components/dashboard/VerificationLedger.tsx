"use client";

import { useMemo, useState } from "react";

import { catalog } from "@/lib/data/catalog";
import {
  buildVerificationLedger,
  verificationDimensionLabels,
  verificationDimensions,
  verificationLedgerSummary,
  verificationStatusLabels,
  type VerificationDimension,
  type VerificationLedgerItem,
  type VerificationLedgerStatus,
} from "@/lib/data/verification-ledger";

const DEFAULT_VISIBLE_COUNT = 60;

type DimensionFilter = VerificationDimension | "ALL";
type StatusFilter = VerificationLedgerStatus | "ALL";

const statusOrder: Record<VerificationLedgerStatus, number> = {
  NEEDS_CONFIRMATION: 0,
  FUTURE_EFFECTIVE: 1,
  VERIFIED: 2,
  NOT_APPLICABLE: 3,
};

const dimensionOrder = new Map(
  verificationDimensions.map((dimension, index) => [dimension, index]),
);

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("ko-KR");
}

function statusDescription(status: VerificationLedgerStatus) {
  if (status === "VERIFIED") {
    return "수록된 주장과 공식 근거가 연결된 상태이며 사업별 적용을 자동 확정하는 표시는 아닙니다.";
  }
  if (status === "FUTURE_EFFECTIVE") {
    return "공식 근거는 확인됐지만 평가기준일 뒤 시행되므로 현재 적용·검증 완료 건수에는 포함하지 않습니다.";
  }
  if (status === "NEEDS_CONFIRMATION") {
    return "공식 원문, 관할기관 또는 사업 사실을 추가로 확인해야 합니다.";
  }
  return "현재 카탈로그에 별도 검증 항목이 없다는 뜻이며 법적 비적용을 뜻하지 않습니다.";
}

export function VerificationLedger({
  items,
  procedureIds,
  onSelectProcedure,
  assessmentDate = catalog.coverage.assessmentDefault,
}: {
  items?: readonly VerificationLedgerItem[];
  procedureIds?: readonly string[];
  onSelectProcedure?: (procedureId: string) => void;
  assessmentDate?: string;
}) {
  const [query, setQuery] = useState("");
  const [dimension, setDimension] = useState<DimensionFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE_COUNT);

  const resolvedItems = useMemo(
    () => items ? [...items] : buildVerificationLedger(catalog, assessmentDate),
    [assessmentDate, items],
  );
  const scopedItems = useMemo(() => {
    if (!procedureIds) return resolvedItems;
    const procedureIdSet = new Set(procedureIds);
    return resolvedItems.filter((item) => procedureIdSet.has(item.procedureId));
  }, [procedureIds, resolvedItems]);

  const summary = useMemo(() => verificationLedgerSummary(scopedItems), [scopedItems]);
  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    return scopedItems
      .filter((item) => dimension === "ALL" || item.dimension === dimension)
      .filter((item) => status === "ALL" || item.status === status)
      .filter((item) => !normalizedQuery || item.searchText.includes(normalizedQuery))
      .sort((left, right) =>
        statusOrder[left.status] - statusOrder[right.status] ||
        left.procedureName.localeCompare(right.procedureName, "ko-KR") ||
        (dimensionOrder.get(left.dimension) ?? 0) -
          (dimensionOrder.get(right.dimension) ?? 0),
      );
  }, [dimension, query, scopedItems, status]);
  const visibleItems = filteredItems.slice(0, visibleCount);

  function resetVisibleCount() {
    setVisibleCount(DEFAULT_VISIBLE_COUNT);
  }

  return (
    <section className="action-plan-layout verification-ledger" aria-labelledby="verification-ledger-title">
      <header className="action-plan-heading">
        <div>
          <span className="eyebrow">공식 근거 검증 대장</span>
          <h3 id="verification-ledger-title">인허가별 확인 근거와 다음 검토사항</h3>
          <p id="verification-ledger-description">
            적용조건·기관·기간·제출자료·절차관계·지역기준을 서로 분리해 표시합니다.
            평가기준일은 {assessmentDate}이며, 시행 예정 근거는 현재 검증 완료에서 분리합니다.
            공식 근거 연결은 개별 사업의 적용·승인을 확정하는 표시가 아닙니다.
          </p>
        </div>
      </header>

      <section className="action-plan-evidence" aria-label="검증 대장 현황">
        <div><span>수록 절차</span><strong>{summary.procedures}</strong><small>개</small></div>
        <div><span>검증 차원</span><strong>{summary.total}</strong><small>건</small></div>
        <div><span>공식 근거 연결</span><strong>{summary.verified}</strong><small>건</small></div>
        <div className={summary.futureEffective ? "has-gap" : ""}><span>시행 예정</span><strong>{summary.futureEffective}</strong><small>현재 검증 제외</small></div>
        <div className={summary.needsConfirmation ? "has-gap" : ""}><span>추가 확인</span><strong>{summary.needsConfirmation}</strong><small>건</small></div>
        <div><span>등록 항목 없음</span><strong>{summary.notApplicable}</strong><small>법적 비적용 아님</small></div>
      </section>

      <div className="toolbar verification-ledger-toolbar" role="search" aria-describedby="verification-ledger-description">
        <label>
          <span>검색</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              resetVisibleCount();
            }}
            placeholder="절차·법령·기관·서류·검증 ID 검색"
            aria-label="검증 대장 검색"
          />
        </label>
        <label>
          <span>검증 차원</span>
          <select
            value={dimension}
            onChange={(event) => {
              setDimension(event.target.value as DimensionFilter);
              resetVisibleCount();
            }}
            aria-label="검증 차원 필터"
          >
            <option value="ALL">전체 차원</option>
            {verificationDimensions.map((item) => (
              <option key={item} value={item}>{verificationDimensionLabels[item]}</option>
            ))}
          </select>
        </label>
        <label>
          <span>검증 상태</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter);
              resetVisibleCount();
            }}
            aria-label="검증 상태 필터"
          >
            <option value="ALL">전체 상태</option>
            {(Object.keys(verificationStatusLabels) as VerificationLedgerStatus[]).map((item) => (
              <option key={item} value={item}>{verificationStatusLabels[item]}</option>
            ))}
          </select>
        </label>
      </div>

      <p className="verification-ledger-result" role="status" aria-live="polite">
        검색 결과 {filteredItems.length}건 · 현재 {visibleItems.length}건 표시
      </p>

      <div className="action-plan-list verification-ledger-list">
        {visibleItems.map((item) => (
          <article
            className={`action-plan-card verification-ledger-card verification-${item.status.toLowerCase()}`}
            key={item.id}
            aria-labelledby={`${item.id}-title`}
          >
            <header>
              <span>{verificationDimensionLabels[item.dimension]} · {item.id}</span>
              <strong id={`${item.id}-title`}>{item.procedureName}</strong>
              <em title={statusDescription(item.status)}>{verificationStatusLabels[item.status]}</em>
            </header>
            <dl>
              <div><dt>현재 판단</dt><dd>{item.summary}</dd></div>
              <div><dt>다음 확인사항</dt><dd>{item.nextAction}</dd></div>
              <div>
                <dt>수록 데이터</dt>
                <dd>{item.details.map((detail) => <span key={detail}>{detail}</span>)}</dd>
              </div>
              <div>
                <dt>공식 근거</dt>
                <dd>
                  {item.evidence.length
                    ? item.evidence.slice(0, 3).map((evidence) => (
                        <a
                          href={evidence.officialUrl}
                          target="_blank"
                          rel="noreferrer"
                          key={evidence.citationId}
                        >
                          {evidence.label} · {evidence.isFutureEffective
                            ? `시행 예정 ${evidence.effectiveDate} · 기준일 현재 미적용`
                            : `시행 ${evidence.effectiveDate ?? "추가 확인"}`} ↗
                        </a>
                      ))
                    : "연결된 공식 근거 없음"}
                  {item.evidence.length > 3
                    ? <small>외 {item.evidence.length - 3}건</small>
                    : null}
                </dd>
              </div>
            </dl>
            {onSelectProcedure ? (
              <button
                type="button"
                className="text-button"
                onClick={() => onSelectProcedure(item.procedureId)}
                aria-label={`${item.procedureName} 절차 상세 보기`}
              >
                절차 상세 보기
              </button>
            ) : null}
          </article>
        ))}
      </div>

      {!filteredItems.length ? (
        <div className="empty-state" role="status">
          현재 검색어와 필터에 일치하는 검증 항목이 없습니다.
        </div>
      ) : null}
      {visibleCount < filteredItems.length ? (
        <button
          type="button"
          className="secondary-button verification-ledger-more"
          onClick={() => setVisibleCount((count) => count + DEFAULT_VISIBLE_COUNT)}
        >
          다음 {Math.min(DEFAULT_VISIBLE_COUNT, filteredItems.length - visibleCount)}건 더 보기
        </button>
      ) : null}
    </section>
  );
}
