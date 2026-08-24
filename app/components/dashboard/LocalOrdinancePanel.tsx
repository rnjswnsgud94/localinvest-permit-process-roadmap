"use client";

import { useEffect, useMemo, useState } from "react";

import type { ScenarioAnswers } from "@/lib/data/catalog";
import {
  matchOrdinancesToCategories,
  type LocalOrdinanceCategoryLookup,
} from "@/lib/regions/ordinance-resolution";
import {
  getReviewedElisOrdinanceRecords,
  reviewedElisSnapshotCheckedAt,
} from "@/lib/regions/elis-reviewed-snapshot";
import { getTransitionalElisOrdinanceRecords } from "@/lib/regions/elis-transitional-records";
import {
  getElisJurisdictionTargets,
  getElisTransitionalJurisdictionTargets,
  getOfficialLocalOrdinanceLinks,
  isElisOrdinanceDetailUrl,
  localOrdinanceCoverageCaveat,
  localOrdinanceReviewCategories,
} from "@/lib/regions/local-ordinances";

interface LocalOrdinanceLookupPayload {
  checkedAt: string;
  source: string;
  mode: "LIVE" | "PARTIAL" | "SNAPSHOT";
  categories: LocalOrdinanceCategoryLookup[];
}

interface LocalOrdinanceLookupState {
  key: string;
  status: "READY" | "ERROR";
  payload: LocalOrdinanceLookupPayload | null;
}

function priorityReason(categoryId: string, answers: ScenarioAnswers): string | null {
  const hasBuildingWork = !["UNKNOWN", "NONE"].includes(answers.buildingAction);
  const hasArea = (answers.totalAreaM2 ?? 0) > 0 || (answers.siteDevelopmentAreaM2 ?? 0) > 0;
  if (categoryId === "urban-planning-development") return "입지와 공장 건축 가능 여부 확인";
  if (categoryId === "building-review-design" && hasBuildingWork) return "선택한 건축행위의 지역 심의·설계기준 확인";
  if (categoryId === "parking-installation" && hasBuildingWork && hasArea) return "공장 면적에 따른 부설주차장 기준 확인";
  if (categoryId === "traffic-impact" && answers.trafficImpactAssessmentRequired !== false) return "교통영향평가 지역 추가기준 확인";
  if (categoryId === "landscape-review" && hasBuildingWork) return "건축·개발사업의 경관심의 기준 확인";
  if (
    categoryId === "air-water-standards" &&
    (answers.airEmissionFacility !== false || answers.waterDischargeFacility !== false)
  ) return "대기·폐수 시설의 지역 기준·정책 확인";
  if (
    categoryId === "sewerage-wastewater-cost" &&
    (answers.publicSewerConnection !== false || (answers.wastewaterM3Day ?? 0) > 0)
  ) return "하수 연결·원인자부담금·유입조건 확인";
  if (categoryId === "water-supply" && (answers.waterDemandM3Day ?? 0) > 0) return "용수 수요에 따른 급수공사·부담금 확인";
  if (
    categoryId === "heritage-local-assets" &&
    answers.nationalHeritageAssessmentType !== null &&
    answers.nationalHeritageAssessmentType !== "NONE"
  ) return "지역유산 보호구역·현상변경 기준 확인";
  return null;
}

export function LocalJurisdictionLinks({ answers }: { answers: ScenarioAnswers }) {
  const links = getOfficialLocalOrdinanceLinks(answers.province, answers.city);
  if (!links.province) return <span>지역 미입력</span>;
  return (
    <span className="jurisdiction-links">
      <a href={links.province.url} target="_blank" rel="noreferrer" title="광역 자치법규 현행 목록">
        {links.province.name}
      </a>
      {links.municipality ? (
        <a href={links.municipality.url} target="_blank" rel="noreferrer" title="기초 자치법규 현행 목록">
          {links.municipality.name}
        </a>
      ) : answers.city ? <span>{answers.city}</span> : links.notice ? <span>시·군·구 미선택</span> : null}
    </span>
  );
}

export function LocalOrdinancePanel({ answers }: { answers: ScenarioAnswers }) {
  const lookupKey = `${answers.province}|${answers.city}`;
  const [lookupResult, setLookupResult] = useState<LocalOrdinanceLookupState | null>(null);

  useEffect(() => {
    if (!answers.province) return;
    const controller = new AbortController();
    const requestKey = `${answers.province}|${answers.city}`;
    const params = new URLSearchParams({ province: answers.province });
    if (answers.city) params.set("city", answers.city);
    fetch(`/api/local-ordinances?${params.toString()}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("local ordinance lookup failed");
        return response.json() as Promise<LocalOrdinanceLookupPayload>;
      })
      .then((payload) => {
        setLookupResult({ key: requestKey, status: "READY", payload });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLookupResult({ key: requestKey, status: "ERROR", payload: null });
      });
    return () => controller.abort();
  }, [answers.province, answers.city]);

  const lookup = lookupResult?.key === lookupKey ? lookupResult.payload : null;
  const lookupState: "LOADING" | "READY" | "ERROR" =
    lookupResult?.key === lookupKey ? lookupResult.status : "LOADING";

  const actualByCategory = useMemo(
    () =>
      new Map(
        lookup?.categories.map((item) => [
          item.categoryId,
          item.ordinances.filter((ordinance) =>
            isElisOrdinanceDetailUrl(ordinance.url),
          ),
        ]) ?? [],
      ),
    [lookup],
  );
  const reviewedByCategory = useMemo(() => {
    if (!answers.province) {
      return new Map<string, LocalOrdinanceCategoryLookup["ordinances"]>();
    }
    const canonicalProvince = getOfficialLocalOrdinanceLinks(
      answers.province,
      answers.city,
    ).province?.name ?? answers.province;
    const records = getElisJurisdictionTargets(
      answers.province,
      answers.city,
    ).flatMap((target) =>
      getReviewedElisOrdinanceRecords(
        canonicalProvince,
        target.name,
        target.level,
      ),
    );
    return new Map(
      matchOrdinancesToCategories(records).map((item) => [
        item.categoryId,
        item.ordinances,
      ]),
    );
  }, [answers.province, answers.city]);
  const transitionalByCategory = useMemo(
    () =>
      new Map(
        matchOrdinancesToCategories(
          getTransitionalElisOrdinanceRecords(
            answers.province,
            answers.city,
          ),
        ).map((item) => [item.categoryId, item.ordinances]),
      ),
    [answers.province, answers.city],
  );
  const hasReviewedFallback = [...reviewedByCategory.values()].some(
    (ordinances) => ordinances.length > 0,
  );
  if (!answers.province) return null;
  const links = getOfficialLocalOrdinanceLinks(answers.province, answers.city);
  const jurisdictionTargets = getElisJurisdictionTargets(
    answers.province,
    answers.city,
  );
  const transitionalTargets = getElisTransitionalJurisdictionTargets(
    answers.province,
    answers.city,
  );
  const prioritized = localOrdinanceReviewCategories
    .map((category) => ({ category, reason: priorityReason(category.id, answers) }))
    .filter((item): item is typeof item & { reason: string } => item.reason !== null);
  const remaining = localOrdinanceReviewCategories.filter(
    (category) => !prioritized.some((item) => item.category.id === category.id),
  );

  const renderCategory = (
    category: (typeof localOrdinanceReviewCategories)[number],
    reason?: string,
  ) => {
    const liveOrdinances = actualByCategory.get(category.id) ?? [];
    const reviewedOrdinances = reviewedByCategory.get(category.id) ?? [];
    const currentOrdinances = [
      ...liveOrdinances,
      ...reviewedOrdinances,
    ].filter(
      (ordinance, index, list) =>
        list.findIndex(
          (candidate) =>
            candidate.level === ordinance.level &&
            candidate.name === ordinance.name,
        ) === index,
    );
    const transitionalOrdinances = currentOrdinances.some(
      (ordinance) => ordinance.level === "PROVINCE",
    )
      ? []
      : transitionalByCategory.get(category.id) ?? [];
    const actualOrdinances = [
      ...currentOrdinances,
      ...transitionalOrdinances,
    ].filter(
      (ordinance, index, list) =>
        list.findIndex(
          (candidate) =>
            candidate.level === ordinance.level &&
            candidate.name === ordinance.name,
        ) === index,
    );
    const fallbackMessage = lookupState === "LOADING" && !hasReviewedFallback
      ? "선택 지역의 현행 조례 원문을 확인 중입니다."
      : lookupState === "READY" && lookup?.mode === "LIVE"
        ? "이 범주에 해당하는 현행 조례 원문을 확인하지 못했습니다."
        : hasReviewedFallback
          ? "검증 저장본에서 이 범주의 관련 조례를 찾지 못했습니다. 상단 관할 목록에서 다시 확인해 주세요."
          : "이 지역의 검증된 상세 링크를 준비 중입니다. 상단 관할 목록에서 확인해 주세요.";
    const matchedJurisdictions = new Set(
      actualOrdinances.map(
        (ordinance) => `${ordinance.level}|${ordinance.jurisdictionName}`,
      ),
    );
    const fallbackTargets = [
      ...jurisdictionTargets.map((target) => ({
        ...target,
        notice: null,
      })),
      ...(currentOrdinances.some((ordinance) => ordinance.level === "PROVINCE")
        ? []
        : transitionalTargets),
    ]
      .filter((target) =>
        category.scope === "PROVINCE"
          ? target.level === "PROVINCE"
          : category.scope === "MUNICIPALITY"
            ? target.level === "MUNICIPALITY"
            : true,
      )
      .filter(
        (target) =>
          !matchedJurisdictions.has(`${target.level}|${target.name}`),
      );
    return (
      <article className="local-ordinance-card" key={category.id}>
        <span>{reason ?? "추가 지역기준 검토"}</span>
        <h3>{category.title}</h3>
        <p>{category.affects}</p>
        <small>확인 항목 · {category.searchTerms.join(" · ")}</small>
        <div className="local-ordinance-links">
          {actualOrdinances.map((ordinance) => (
            <a
              key={`${ordinance.level}-${ordinance.name}`}
              href={ordinance.url}
              target="_blank"
              rel="noreferrer"
              title={ordinance.transitionNotice
                ? `${ordinance.jurisdictionName} 종전 조례 상세 · 해당 권역 경과 적용 확인`
                : `${ordinance.jurisdictionName} 현행 자치법규 상세 원문`}
            >
              {ordinance.name} ↗
              <small>
                {ordinance.transitionNotice
                  ? "종전 조례 · 해당 권역 한정"
                  : ordinance.level === "PROVINCE"
                    ? "광역"
                    : "기초"}
                {ordinance.amendmentDate ? ` · ${ordinance.amendmentDate}` : ""}
              </small>
            </a>
          ))}
          {!actualOrdinances.length ? <em>{fallbackMessage}</em> : null}
          {fallbackTargets.map((target) => (
            <a
              className="local-ordinance-fallback-link"
              href={target.listUrl}
              key={`${category.id}-${target.level}-${target.name}`}
              target="_blank"
              rel="noreferrer"
              title={`${target.name} ELIS 현행 목록에서 ${category.searchTerms.join("·")} 직접 확인`}
            >
              {target.name} ELIS 목록에서 직접 찾기 ↗
              <small>
                {target.notice ??
                  "이 관할에서 범주 일치 상세 조례가 없을 때 쓰는 전체 목록"}
              </small>
            </a>
          ))}
        </div>
      </article>
    );
  };

  return (
    <section className="local-ordinance-panel" aria-labelledby="local-ordinance-title">
      <header>
        <div><span className="eyebrow">선택 지역 반영</span><h2 id="local-ordinance-title">광역·기초 자치법규 확인</h2></div>
        <p>선택 지역의 현행 조례를 확인해 해당 조례의 ELIS 상세 원문으로 바로 연결합니다.</p>
      </header>
      <div className="local-ordinance-grid">{prioritized.map(({ category, reason }) => renderCategory(category, reason))}</div>
      {remaining.length ? (
        <details className="local-ordinance-more">
          <summary>그 밖의 지역 조례 검토 범주 {remaining.length}개</summary>
          <div className="local-ordinance-grid">{remaining.map((category) => renderCategory(category))}</div>
        </details>
      ) : null}
      {links.notice ? <p className="local-ordinance-notice">{links.notice}</p> : null}
      {transitionalTargets.length ? (
        <p className="local-ordinance-notice">
          통합특별시 새 조례가 확인되지 않는 범주는 선택 권역의 종전 조례 목록도 함께 확인합니다. 종전 조례는 해당 종전 권역에 한해 경과 적용될 수 있으므로 개별 조문과 필지를 대조해야 합니다.{" "}
          <a
            href={transitionalTargets[0].legalBasisUrl}
            target="_blank"
            rel="noreferrer"
          >
            경과조치 근거 ↗
          </a>
        </p>
      ) : null}
      {lookupState === "LOADING" && hasReviewedFallback ? (
        <p className="local-ordinance-checked">
          ELIS 실시간 확인 중 · {new Date(reviewedElisSnapshotCheckedAt).toLocaleDateString("ko-KR")} 검증 저장본 먼저 표시
        </p>
      ) : null}
      {lookupState === "READY" && lookup ? (
        <p className="local-ordinance-checked">
          {lookup.mode === "LIVE"
            ? "행정안전부 ELIS 현행 상세 원문 조회"
            : lookup.mode === "PARTIAL"
              ? "ELIS 실시간·검증 저장본 병합"
              : "ELIS 실시간 조회 실패 · 검증 저장본 표시"}
          {" · "}{new Date(lookup.checkedAt).toLocaleDateString("ko-KR")}
        </p>
      ) : null}
      {lookupState === "ERROR" ? (
        <p className="local-ordinance-checked">
          {hasReviewedFallback
            ? `ELIS 실시간 조회 실패 · ${new Date(reviewedElisSnapshotCheckedAt).toLocaleDateString("ko-KR")} 검증 저장본 표시`
            : "이 지역의 검증된 상세 링크 준비 중 · 상단 관할 목록 확인"}
        </p>
      ) : null}
      <p className="local-ordinance-caveat">{localOrdinanceCoverageCaveat}</p>
    </section>
  );
}
