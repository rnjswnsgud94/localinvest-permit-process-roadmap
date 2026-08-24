import { catalog } from "@/lib/data/catalog";
import type {
  ApplicabilityRule,
  DurationEstimate,
  LegalCitation,
  LegalSource,
  Procedure,
  ProcedureEdge,
} from "@/lib/domain/schemas";

export const verificationDimensions = [
  "APPLICABILITY",
  "AUTHORITY",
  "DURATION",
  "SUBMISSIONS",
  "RELATIONSHIPS",
  "LOCAL",
] as const;

export type VerificationDimension = (typeof verificationDimensions)[number];
export type VerificationLedgerStatus =
  | "VERIFIED"
  | "FUTURE_EFFECTIVE"
  | "NEEDS_CONFIRMATION"
  | "NOT_APPLICABLE";

export const verificationDimensionLabels: Record<VerificationDimension, string> = {
  APPLICABILITY: "적용조건",
  AUTHORITY: "기관·권한",
  DURATION: "법정·공식 기간",
  SUBMISSIONS: "제출서류",
  RELATIONSHIPS: "선후행·의제",
  LOCAL: "지자체·지역기준",
};

/**
 * NOT_APPLICABLE means that the catalog has no item registered for this
 * verification dimension. It must not be presented as a legal conclusion
 * that the permit, a local rule, or a relationship does not apply.
 */
export const verificationStatusLabels: Record<VerificationLedgerStatus, string> = {
  VERIFIED: "공식 근거 연결",
  FUTURE_EFFECTIVE: "시행 예정 · 현재 미적용",
  NEEDS_CONFIRMATION: "추가 확인 필요",
  NOT_APPLICABLE: "등록 항목 없음",
};

export type VerificationEvidence = {
  citationId: string;
  label: string;
  role: LegalCitation["role"];
  sourceTitle: string;
  sourceStatus: LegalSource["status"];
  effectiveDate: string | null;
  isFutureEffective: boolean;
  officialUrl: string;
};

export type VerificationLedgerItem = {
  id: string;
  procedureId: string;
  procedureName: string;
  procedureDomain: string;
  dimension: VerificationDimension;
  status: VerificationLedgerStatus;
  summary: string;
  nextAction: string;
  details: string[];
  evidence: VerificationEvidence[];
  searchText: string;
};

export type VerificationLedgerCatalog = {
  procedures: readonly Procedure[];
  rules: readonly ApplicabilityRule[];
  citations: readonly LegalCitation[];
  legalSources: readonly LegalSource[];
  durations: readonly DurationEstimate[];
  edges: readonly ProcedureEdge[];
};

const dimensionSlug: Record<VerificationDimension, string> = {
  APPLICABILITY: "applicability",
  AUTHORITY: "authority",
  DURATION: "duration",
  SUBMISSIONS: "submissions",
  RELATIONSHIPS: "relationships",
  LOCAL: "local",
};

const citationRoleLabels: Record<LegalCitation["role"], string> = {
  APPLICABILITY: "적용조건",
  AUTHORITY: "기관·권한",
  SEQUENCE: "선후행",
  DEEMING: "의제",
  DURATION: "기간",
  SUBMISSION: "제출자료",
};

const localAuthorityPattern =
  /관할|시[·ㆍ/]?군[·ㆍ/]?구|시장|군수|구청장|시[·ㆍ]?도|도지사|광역시장|특별자치|산업단지\s*관리기관|지방|조례|자치|지역/;

const reviewedProcedureStatuses = new Set<Procedure["verificationStatus"]>([
  "INTERNAL_REVIEWED",
  "EXPERT_REVIEWED",
]);

const reviewedRuleStatuses = new Set<ApplicabilityRule["status"]>([
  "INTERNAL_REVIEWED",
  "EXPERT_REVIEWED",
]);

export function verificationItemId(
  procedureId: string,
  dimension: VerificationDimension,
) {
  return `${procedureId}-verification-${dimensionSlug[dimension]}`;
}

function unique<T>(items: readonly T[]) {
  return [...new Set(items)];
}

function buildEvidence(
  citationIds: readonly string[],
  allowedRoles: readonly LegalCitation["role"][],
  citationById: ReadonlyMap<string, LegalCitation>,
  sourceById: ReadonlyMap<string, LegalSource>,
  assessmentDate: string,
) {
  const allowed = new Set(allowedRoles);
  return unique(citationIds).flatMap<VerificationEvidence>((citationId) => {
    const citation = citationById.get(citationId);
    if (!citation || !allowed.has(citation.role)) return [];
    const source = sourceById.get(citation.sourceId);
    if (!source) return [];
    const article = [citation.article, citation.paragraph, citation.subparagraph, citation.item]
      .filter(Boolean)
      .join(" ");
    return [{
      citationId,
      label: `${source.title}${article ? ` ${article}` : ""} · ${citationRoleLabels[citation.role]}`,
      role: citation.role,
      sourceTitle: source.title,
      sourceStatus: source.status,
      effectiveDate: source.effectiveDate,
      isFutureEffective: Boolean(
        source.effectiveDate && source.effectiveDate > assessmentDate,
      ),
      officialUrl: source.officialUrl,
    }];
  });
}

function hasOnlyAuthoritativeEvidence(evidence: readonly VerificationEvidence[]) {
  return evidence.length > 0 && evidence.every((item) => item.sourceStatus === "AUTHORITATIVE");
}

function evidenceStatus(
  evidence: readonly VerificationEvidence[],
): Exclude<VerificationLedgerStatus, "NOT_APPLICABLE"> {
  if (!hasOnlyAuthoritativeEvidence(evidence)) return "NEEDS_CONFIRMATION";
  return evidence.some((item) => item.isFutureEffective)
    ? "FUTURE_EFFECTIVE"
    : "VERIFIED";
}

function futureEffectiveDateSummary(evidence: readonly VerificationEvidence[]) {
  return unique(
    evidence.flatMap((item) => item.isFutureEffective && item.effectiveDate
      ? [item.effectiveDate]
      : []),
  ).join(" · ");
}

function localSource(source: LegalSource | undefined) {
  return Boolean(
    source && (
      source.documentType === "LOCAL_ORDINANCE" ||
      source.documentType === "INDUSTRIAL_COMPLEX_PLAN" ||
      source.jurisdictionCode ||
      source.industrialComplexId
    ),
  );
}

function makeItem(
  procedure: Procedure,
  dimension: VerificationDimension,
  status: VerificationLedgerStatus,
  summary: string,
  nextAction: string,
  details: readonly string[],
  evidence: readonly VerificationEvidence[],
): VerificationLedgerItem {
  const normalizedDetails = details.filter(Boolean);
  const item: VerificationLedgerItem = {
    id: verificationItemId(procedure.id, dimension),
    procedureId: procedure.id,
    procedureName: procedure.name,
    procedureDomain: procedure.domain,
    dimension,
    status,
    summary,
    nextAction,
    details: normalizedDetails,
    evidence: [...evidence],
    searchText: "",
  };
  item.searchText = [
    item.id,
    item.procedureId,
    item.procedureName,
    item.procedureDomain,
    verificationDimensionLabels[dimension],
    verificationStatusLabels[status],
    item.summary,
    item.nextAction,
    ...item.details,
    ...item.evidence.flatMap((entry) => [
      entry.label,
      entry.sourceTitle,
      entry.citationId,
      entry.effectiveDate ?? "시행일 추가 확인",
      entry.isFutureEffective ? "시행 예정 현재 미적용" : "",
    ]),
  ].join(" ").toLocaleLowerCase("ko-KR");
  return item;
}

function buildItemsForProcedure(
  procedure: Procedure,
  assessmentDate: string,
  indexes: {
    ruleByProcedure: ReadonlyMap<string, readonly ApplicabilityRule[]>;
    durationByProcedure: ReadonlyMap<string, DurationEstimate>;
    edgesByProcedure: ReadonlyMap<string, readonly ProcedureEdge[]>;
    procedureById: ReadonlyMap<string, Procedure>;
    citationById: ReadonlyMap<string, LegalCitation>;
    sourceById: ReadonlyMap<string, LegalSource>;
  },
) {
  const rules = (indexes.ruleByProcedure.get(procedure.id) ?? [])
    .filter((rule) => rule.status !== "RETIRED");
  const duration = indexes.durationByProcedure.get(procedure.id);
  const edges = indexes.edgesByProcedure.get(procedure.id) ?? [];
  const ruleCitationIds = rules.flatMap((rule) => rule.citationIds);
  const durationCitationIds = duration?.citationIds ?? [];
  const edgeCitationIds = edges.flatMap((edge) => edge.citationIds);
  const generalCitationIds = unique([
    ...procedure.citationIds,
    ...ruleCitationIds,
    ...durationCitationIds,
    ...edgeCitationIds,
  ]);

  const applicabilityEvidence = buildEvidence(
    [...procedure.citationIds, ...ruleCitationIds],
    ["APPLICABILITY"],
    indexes.citationById,
    indexes.sourceById,
    assessmentDate,
  );
  const applicabilityReviewed =
    reviewedProcedureStatuses.has(procedure.verificationStatus) &&
    rules.length > 0 &&
    rules.every((rule) => reviewedRuleStatuses.has(rule.status));
  const applicabilityStatus: VerificationLedgerStatus = applicabilityReviewed
    ? evidenceStatus(applicabilityEvidence)
    : "NEEDS_CONFIRMATION";

  const authorityEvidence = buildEvidence(
    [...procedure.citationIds, ...ruleCitationIds],
    ["AUTHORITY"],
    indexes.citationById,
    indexes.sourceById,
    assessmentDate,
  );
  const authorityStatus = evidenceStatus(authorityEvidence);

  const durationEvidence = buildEvidence(
    durationCitationIds,
    ["DURATION"],
    indexes.citationById,
    indexes.sourceById,
    assessmentDate,
  );
  const durationEligible = Boolean(
    duration?.statutoryPeriod?.trim() &&
    duration.legalConfidence !== "LOW" &&
    duration.legalConfidence !== "UNVERIFIED"
  );
  const durationStatus: VerificationLedgerStatus = durationEligible
    ? evidenceStatus(durationEvidence)
    : "NEEDS_CONFIRMATION";
  const totalPeriodNotFixed = Boolean(
    duration && (
      duration.planningBasis === "MILESTONE_ONLY" ||
      duration.planningBasis === "OFFICIAL_CAP_ONLY" ||
      duration.planningBasis === "INSUFFICIENT_DATA"
    ),
  );

  const submissionEvidence = buildEvidence(
    [...procedure.citationIds, ...ruleCitationIds],
    ["SUBMISSION"],
    indexes.citationById,
    indexes.sourceById,
    assessmentDate,
  );
  const submissionStatus: VerificationLedgerStatus = procedure.submissions.length > 0
    ? evidenceStatus(submissionEvidence)
    : "NEEDS_CONFIRMATION";

  const relationshipEvidence = buildEvidence(
    [...procedure.citationIds, ...ruleCitationIds, ...edgeCitationIds],
    ["SEQUENCE", "DEEMING"],
    indexes.citationById,
    indexes.sourceById,
    assessmentDate,
  );
  const hasDeemingRelationship =
    procedure.deemedByProcedureIds.length > 0 || procedure.deemedProcedureIds.length > 0;
  const edgeSupported = edges.every((edge) => {
    const evidence = buildEvidence(
      edge.citationIds,
      ["SEQUENCE", "DEEMING"],
      indexes.citationById,
      indexes.sourceById,
      assessmentDate,
    );
    return evidenceStatus(evidence) !== "NEEDS_CONFIRMATION";
  });
  const deemingSupported =
    !hasDeemingRelationship || relationshipEvidence.some((item) => item.role === "DEEMING");
  const hasRelationship = edges.length > 0 || hasDeemingRelationship;
  const relationshipStatus: VerificationLedgerStatus = !hasRelationship
    ? "NOT_APPLICABLE"
    : edgeSupported && deemingSupported && hasOnlyAuthoritativeEvidence(relationshipEvidence)
      ? evidenceStatus(relationshipEvidence)
      : "NEEDS_CONFIRMATION";

  const localRules = rules.filter((rule) =>
    !rule.jurisdiction.nationwide ||
    rule.jurisdiction.provinces.length > 0 ||
    rule.jurisdiction.cities.length > 0 ||
    rule.jurisdiction.industrialComplexIds.length > 0,
  );
  const localEvidence = unique(generalCitationIds).flatMap<VerificationEvidence>((citationId) => {
    const citation = indexes.citationById.get(citationId);
    const source = citation ? indexes.sourceById.get(citation.sourceId) : undefined;
    if (!citation || !localSource(source) || !source) return [];
    return buildEvidence(
      [citationId],
      [citation.role],
      indexes.citationById,
      indexes.sourceById,
      assessmentDate,
    );
  });
  const localRelevant =
    localRules.length > 0 ||
    [
      procedure.receivingAuthority,
      procedure.statutoryDecisionMaker,
      ...procedure.consultationAuthorities,
      procedure.reviewNote,
      ...procedure.submissions,
    ].some((value) => localAuthorityPattern.test(value)) ||
    ["INDUSTRIAL_COMPLEX_AUTHORITY", "CITY_COUNTY_DISTRICT", "PROVINCE"].includes(
      procedure.lane,
    );
  const localStatus: VerificationLedgerStatus = !localRelevant
    ? "NOT_APPLICABLE"
    : hasOnlyAuthoritativeEvidence(localEvidence)
      ? evidenceStatus(localEvidence)
      : "NEEDS_CONFIRMATION";

  const futureSummary = (evidence: readonly VerificationEvidence[]) =>
    `공식 근거는 ${futureEffectiveDateSummary(evidence)}부터 시행 예정이며 평가기준일 ${assessmentDate} 현재 적용되지 않습니다.`;

  const relationshipDetails = unique([
    ...edges.map((edge) => {
      const otherId = edge.from === procedure.id ? edge.to : edge.from;
      const otherName = indexes.procedureById.get(otherId)?.name ?? otherId;
      return `${edge.from === procedure.id ? "후행" : "선행"}: ${otherName} · ${edge.strength}`;
    }),
    ...procedure.deemedByProcedureIds.map((id) =>
      `상위 의제 절차: ${indexes.procedureById.get(id)?.name ?? id}`,
    ),
    ...procedure.deemedProcedureIds.map((id) =>
      `의제 대상: ${indexes.procedureById.get(id)?.name ?? id}`,
    ),
  ]);

  return [
    makeItem(
      procedure,
      "APPLICABILITY",
      applicabilityStatus,
      applicabilityStatus === "VERIFIED"
        ? `현행 적용규칙 ${rules.length}건과 공식 적용근거가 검토 상태로 연결되어 있습니다.`
        : applicabilityStatus === "FUTURE_EFFECTIVE"
          ? futureSummary(applicabilityEvidence)
        : `적용규칙 ${rules.length}건 중 초안·미검토 규칙 또는 공식 적용근거 연결을 확인해야 합니다.`,
      applicabilityStatus === "VERIFIED"
        ? "법령 개정일과 사업 사실이 달라지면 적용조건을 다시 검토합니다."
        : applicabilityStatus === "FUTURE_EFFECTIVE"
          ? "시행일 이후의 평가기준일에서만 적용조건을 검토하고, 시행 전에는 현행 절차를 유지합니다."
        : "신청 전 적용 임계값·예외·평가기준일을 공식 원문과 관할기관에 대조합니다.",
      [
        `절차 검토상태: ${procedure.verificationStatus}`,
        ...rules.map((rule) => `${rule.id} · ${rule.effect} · ${rule.status}`),
      ],
      applicabilityEvidence,
    ),
    makeItem(
      procedure,
      "AUTHORITY",
      authorityStatus,
      authorityStatus === "VERIFIED"
        ? "접수기관·법정 결정권자의 공식 권한근거가 연결되어 있습니다."
        : authorityStatus === "FUTURE_EFFECTIVE"
          ? futureSummary(authorityEvidence)
        : "기관 역할은 수록되어 있으나 AUTHORITY 역할의 공식 조문 연결이 부족합니다.",
      authorityStatus === "VERIFIED"
        ? "사업지와 시설규모에 따른 위임·기관명 변경 여부를 접수 전에 확인합니다."
        : authorityStatus === "FUTURE_EFFECTIVE"
          ? "시행 전에는 해당 권한규정을 현재 권한근거로 사용하지 않고 현행 기관·위임규정을 확인합니다."
        : "접수기관·결정권자·협의기관을 구분해 권한 조문과 위임규정을 연결합니다.",
      [
        `접수기관: ${procedure.receivingAuthority}`,
        `법정 결정권자: ${procedure.statutoryDecisionMaker}`,
        `협의기관: ${procedure.consultationAuthorities.join(" · ") || "별도 수록 없음"}`,
      ],
      authorityEvidence,
    ),
    makeItem(
      procedure,
      "DURATION",
      durationStatus,
      durationStatus === "VERIFIED"
        ? totalPeriodNotFixed
          ? "공식 단계기한·상한 또는 총기간 미규정 사실이 근거와 함께 확인되어 있습니다."
          : "법정·공식 처리기간 문구와 기간 근거가 연결되어 있습니다."
        : durationStatus === "FUTURE_EFFECTIVE"
          ? `기간 근거는 ${futureEffectiveDateSummary(durationEvidence)}부터 시행 예정이며 평가기준일 ${assessmentDate} 현재 일정에 적용할 수 없습니다.`
        : "법정·공식 기간 문구, 기산점 또는 기간근거를 추가 확인해야 합니다.",
      durationStatus === "VERIFIED"
        ? totalPeriodNotFixed
          ? "단계기한을 신청부터 완료까지의 총기간으로 합산하지 않고 실제 사건 일정을 별도 확인합니다."
          : "보완·연장·불산입과 실제 적용 분기를 접수 전에 확인합니다."
        : durationStatus === "FUTURE_EFFECTIVE"
          ? "시행 전 일정에는 이 기간을 합산하지 말고, 시행일 이후에도 기산점·연장·불산입 조건을 다시 확인합니다."
        : "기간을 추정해 채우지 말고 법령·공식 민원안내에서 원 단위와 기산점을 확인합니다.",
      duration
        ? [
            `공식 문구: ${duration.statutoryPeriod ?? "수록 없음"}`,
            `계획 반영유형: ${duration.planningBasis ?? "직접 공식기간"}`,
            `기간 법적 신뢰도: ${duration.legalConfidence}`,
            ...duration.stopClockRules.map((rule) => `정지·연장: ${rule}`),
          ]
        : ["기간 레코드 없음"],
      durationEvidence,
    ),
    makeItem(
      procedure,
      "SUBMISSIONS",
      submissionStatus,
      submissionStatus === "VERIFIED"
        ? `제출자료 ${procedure.submissions.length}건과 공식 제출근거가 연결되어 있습니다.`
        : submissionStatus === "FUTURE_EFFECTIVE"
          ? futureSummary(submissionEvidence)
        : `제출자료 ${procedure.submissions.length}건은 수록되어 있으나 SUBMISSION 역할의 공식 근거를 대조해야 합니다.`,
      submissionStatus === "VERIFIED"
        ? "최신 서식·첨부목록·수수료와 전자접수 가능 여부를 접수 전에 확인합니다."
        : submissionStatus === "FUTURE_EFFECTIVE"
          ? "시행 전에는 예정 제출자료를 현행 의무로 표시하지 않고, 하위법령 공포 뒤 서식과 첨부목록을 갱신합니다."
        : "각 문서의 법정 서식·첨부자료·수수료·전자접수 경로를 공식 안내와 연결합니다.",
      procedure.submissions.length
        ? procedure.submissions.map((submission) => `제출자료: ${submission}`)
        : ["수록된 제출자료 없음"],
      submissionEvidence,
    ),
    makeItem(
      procedure,
      "RELATIONSHIPS",
      relationshipStatus,
      relationshipStatus === "VERIFIED"
        ? "등록된 직접 선후행·의제 관계에 공식 관계근거가 연결되어 있습니다."
        : relationshipStatus === "FUTURE_EFFECTIVE"
          ? futureSummary(relationshipEvidence)
        : relationshipStatus === "NEEDS_CONFIRMATION"
          ? "선후행·의제 관계는 등록되어 있으나 일부 연결의 SEQUENCE·DEEMING 근거를 보강해야 합니다."
          : "현재 카탈로그에 직접 선후행·의제 관계가 등록되어 있지 않습니다. 이는 법적 관계가 없다는 결론이 아닙니다.",
      relationshipStatus === "VERIFIED"
        ? "의제는 상위 신청서류·관계기관 협의·완료 증빙이 충족된 경우에만 반영합니다."
        : relationshipStatus === "FUTURE_EFFECTIVE"
          ? "시행 전에는 해당 의제·선후행 관계를 현재 경로에 적용하지 않습니다."
        : relationshipStatus === "NEEDS_CONFIRMATION"
          ? "각 연결을 법정 선행, 실무 권장, 의제 관계로 구분하고 조문을 대조합니다."
          : "개별 사업에서 필요한 연계 절차가 발견되면 근거와 함께 관계를 등록합니다.",
      relationshipDetails.length ? relationshipDetails : ["등록된 직접 연결 없음"],
      relationshipEvidence,
    ),
    makeItem(
      procedure,
      "LOCAL",
      localStatus,
      localStatus === "VERIFIED"
        ? "지자체 조례·산업단지 관리계획 등 지역 공식자료가 연결되어 있습니다."
        : localStatus === "FUTURE_EFFECTIVE"
          ? futureSummary(localEvidence)
        : localStatus === "NEEDS_CONFIRMATION"
          ? "지역·관할기관에 따라 달라질 수 있으나 명명된 지역 공식자료가 연결되지 않았습니다."
          : "현재 데이터에는 이 절차의 별도 지역자료 대상이 등록되어 있지 않습니다. 이는 지역 확인이 법적으로 불필요하다는 결론이 아닙니다.",
      localStatus === "VERIFIED"
        ? "사업지·기준일과 연결 자료의 관할범위가 일치하는지 확인합니다."
        : localStatus === "FUTURE_EFFECTIVE"
          ? "시행 전에는 해당 지역자료를 현재 기준으로 적용하지 않고 현행 관할자료를 확인합니다."
        : localStatus === "NEEDS_CONFIRMATION"
          ? "사업지 지자체의 최신 조례·민원편람·위임사무와 실제 담당부서를 확인합니다."
          : "관할 차이가 확인되면 명명된 공식 지역자료를 추가합니다.",
      [
        `기관 레인: ${procedure.lane}`,
        `지역범위 규칙: ${localRules.length}건`,
        `지역 공식자료: ${localEvidence.length}건`,
      ],
      localEvidence,
    ),
  ];
}

export function buildVerificationLedger(
  data: VerificationLedgerCatalog = catalog,
  assessmentDate: string = catalog.coverage.assessmentDefault,
): VerificationLedgerItem[] {
  const ruleByProcedure = new Map<string, ApplicabilityRule[]>();
  for (const rule of data.rules) {
    ruleByProcedure.set(rule.procedureId, [
      ...(ruleByProcedure.get(rule.procedureId) ?? []),
      rule,
    ]);
  }
  const durationByProcedure = new Map(
    data.durations.map((duration) => [duration.procedureId, duration]),
  );
  const edgesByProcedure = new Map<string, ProcedureEdge[]>();
  for (const edge of data.edges) {
    edgesByProcedure.set(edge.from, [...(edgesByProcedure.get(edge.from) ?? []), edge]);
    edgesByProcedure.set(edge.to, [...(edgesByProcedure.get(edge.to) ?? []), edge]);
  }
  const indexes = {
    ruleByProcedure,
    durationByProcedure,
    edgesByProcedure,
    procedureById: new Map(data.procedures.map((procedure) => [procedure.id, procedure])),
    citationById: new Map(data.citations.map((citation) => [citation.id, citation])),
    sourceById: new Map(data.legalSources.map((source) => [source.id, source])),
  };

  return data.procedures.flatMap((procedure) =>
    buildItemsForProcedure(procedure, assessmentDate, indexes),
  );
}

export function verificationLedgerSummary(items: readonly VerificationLedgerItem[]) {
  return {
    total: items.length,
    verified: items.filter((item) => item.status === "VERIFIED").length,
    futureEffective: items.filter((item) => item.status === "FUTURE_EFFECTIVE").length,
    needsConfirmation: items.filter((item) => item.status === "NEEDS_CONFIRMATION").length,
    notApplicable: items.filter((item) => item.status === "NOT_APPLICABLE").length,
    procedures: new Set(items.map((item) => item.procedureId)).size,
  };
}
