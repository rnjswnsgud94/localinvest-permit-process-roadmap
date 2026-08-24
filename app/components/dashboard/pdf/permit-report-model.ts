import {
  inputLabel,
  procedureCategoryForDecision,
  roadmapInclusionBreakdown,
  stageLabels,
  statusLabels,
  type ProcedureCategory,
} from "@/app/components/dashboard/constants";
import {
  formatProjectInputValue,
  getProjectInputValue,
  getVisibleProjectInputSections,
} from "@/app/components/dashboard/ScenarioPicker";
import { catalog, type ScenarioAnswers } from "@/lib/data/catalog";
import { verifiedSequenceCitationIds } from "@/lib/data/edge-evidence";
import { buildInputConsistencyWarnings } from "@/lib/data/input-consistency";
import type { SpecialLawEffect } from "@/lib/data/special-laws";
import { PRACTITIONER_REVIEW_NOTICE } from "@/lib/domain/legal-review";
import { coreFlowEdges, describeFlowEdges } from "@/lib/engine/flow-edges";
import type { evaluateProject } from "@/lib/engine/pipeline";
import type { DurationScenario, ScheduleResult } from "@/lib/engine/schedule";
import {
  formatCalendarPeriod,
  formatResolvedOfficialDurationSummary,
  formatTimelineProcessingDuration,
} from "@/lib/format-duration";
import {
  getReviewedElisOrdinanceRecords,
  reviewedElisSnapshotCheckedAt,
} from "@/lib/regions/elis-reviewed-snapshot";
import { getTransitionalElisOrdinanceRecords } from "@/lib/regions/elis-transitional-records";
import {
  getElisJurisdictionTargets,
  getElisTransitionalJurisdictionTargets,
  getOfficialLocalOrdinanceLinks,
  localOrdinanceReviewCategories,
} from "@/lib/regions/local-ordinances";
import { matchOrdinancesToCategories } from "@/lib/regions/ordinance-resolution";

type ProjectEvaluation = ReturnType<typeof evaluateProject>;

const durationScenarioLabels: Record<DurationScenario, string> = {
  MIN: "최소기간",
  TYPICAL: "공식 기준",
  USER: "사용자 예상",
};

const categoryLabels: Record<ProcedureCategory, string> = {
  REQUIRED: "로드맵 포함",
  CONFIRM: "추가 확인",
  NOT_REQUIRED: "확인된 제외",
};

const effectLabels: Record<SpecialLawEffect, string> = {
  ONE_STOP: "일괄처리",
  EXEMPTION: "면제",
  DEEMED_REPORT: "신고 의제",
  STANDARD_RELAXATION: "규모 산정 특례",
  LOCATION_SPECIAL_CASE: "입지 특례",
  FAST_TRACK: "신속처리",
  INTEGRATED_APPROVAL: "통합승인·의제",
  PLAN_DEEMING: "계획승인 의제",
};

const stageOrder = Object.keys(stageLabels) as Array<keyof typeof stageLabels>;

function stableUnique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))];
}

function matchedRuleCitationIds(
  decision: ProjectEvaluation["decisions"][number],
) {
  const matchedRuleIds = new Set(decision.matchedRuleIds);
  return decision.traces
    .filter((trace) => matchedRuleIds.has(trace.ruleId))
    .flatMap((trace) => trace.citationIds);
}

function citationLocator(citation: (typeof catalog.citations)[number]) {
  return [citation.article, citation.paragraph, citation.subparagraph, citation.item]
    .filter(Boolean)
    .join(" ") || "관련 조문";
}

function projectDescriptor(answers: ScenarioAnswers) {
  const place = [answers.province, answers.city].filter(Boolean).join(" ") || "지역 미입력";
  const industry = formatProjectInputValue("industryCategory", answers.industryCategory);
  const location = answers.insideIndustrialComplex === null
    ? "입지 미확인"
    : answers.insideIndustrialComplex
      ? "산업단지"
      : "개별입지";
  return `${place} · ${industry} · ${location}`;
}

function filenameSegment(value: string, fallback: string, maximumCharacters: number) {
  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  const limited = Array.from(normalized).slice(0, maximumCharacters).join("");
  return limited || fallback;
}

function reportIdentity(answers: ScenarioAnswers) {
  const displaySegment = (value: string, fallback: string) => {
    const normalized = value
      .normalize("NFKC")
      .replace(/[\u0000-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return Array.from(normalized || fallback).slice(0, 40).join("");
  };
  const place = displaySegment(
    [answers.province, answers.city].filter(Boolean).join(" "),
    "지역 미입력",
  );
  const industry = displaySegment(
    formatProjectInputValue("industryCategory", answers.industryCategory),
    "업종 미입력",
  );
  const investment = displaySegment(
    formatProjectInputValue("investmentType", answers.investmentType),
    "투자유형 미입력",
  );
  const action = displaySegment(
    formatProjectInputValue("buildingAction", answers.buildingAction),
    "건축행위 미입력",
  );
  return {
    title: `${place} · ${industry} · ${investment}·${action} 인허가 결과보고서`,
    filenamePrefix: [place, industry, investment, action]
      .map((value, index) => filenameSegment(
        value,
        ["지역미입력", "업종미입력", "투자유형미입력", "건축행위미입력"][index],
        [18, 14, 10, 10][index],
      ))
      .join("_"),
  };
}

export type PermitReportModel = {
  metadata: {
    title: string;
    generatedAt: string;
    generatedAtLabel: string;
    assessmentDate: string;
    catalogVersion: string;
    lastLegalReviewAt: string;
    durationScenario: string;
    scheduleScope: string;
    filename: string;
  };
  project: {
    descriptor: string;
    sections: Array<{
      id: string;
      title: string;
      items: Array<{ label: string; value: string; unknown: boolean }>;
    }>;
  };
  summary: {
    counts: Record<ProcedureCategory, number>;
    roadmapBreakdown: {
      confirmed: number;
      scopeCheck: number;
      deemed: number;
    };
    duration: {
      label: "산정 불가" | "확인된 일정 하한" | "총 소요기간";
      value: string;
      detail: string;
      isTotal: boolean;
    };
    milestones: Array<{ label: string; value: string }>;
  };
  flow: {
    stages: Array<{
      id: keyof typeof stageLabels;
      title: string;
      items: Array<{
        id: string;
        name: string;
        category: Exclude<ProcedureCategory, "NOT_REQUIRED">;
        categoryLabel: string;
        officialDuration: string;
        wave: number | null;
        isDeemed: boolean;
        timing: string;
        timingSource: "OFFICIAL" | "USER_EXPECTED" | null;
      }>;
    }>;
    coreRelations: Array<{
      id: string;
      from: string;
      to: string;
      relation: string;
      evidence: string;
      bottleneck: boolean;
      binding: boolean;
      note: string;
    }>;
  };
  specialLaws: Array<{
    title: string;
    effect: string;
    status: string;
    isActive: boolean;
    note: string;
    law: string;
    article: string;
    officialUrl: string;
  }>;
  procedures: Array<{
    id: string;
    name: string;
    stage: string;
    category: Exclude<ProcedureCategory, "NOT_REQUIRED">;
    categoryLabel: string;
    status: string;
    reason: string;
    authority: string;
    decisionMaker: string;
    officialDuration: string;
    schedule: string;
    scheduleNote: string;
    outcome: string;
    submissions: string;
    followUp: string;
    missingInputs: string[];
    specialLawEffects: string[];
    legalReviewNote: string | null;
    sourceSummaries: string[];
  }>;
  gaps: Array<{
    input: string;
    affectedProcedures: string[];
  }>;
  localOrdinances: {
    checkedAt: string;
    notice: string | null;
    transitionBasisLinks: Array<{
      name: string;
      url: string;
      note: string;
    }>;
    categories: Array<{
      id: string;
      title: string;
      affects: string;
      reviewPoint: string;
      limitation: string;
      ordinances: Array<{
        name: string;
        level: "PROVINCE" | "MUNICIPALITY";
        jurisdictionName: string;
        url: string;
        amendmentDate: string | null;
        transitionNotice: string | null;
      }>;
      fallbackLinks: Array<{
        name: string;
        url: string;
        note: string;
      }>;
    }>;
  };
  excluded: string[];
  legalSources: Array<{
    title: string;
    authority: string;
    locator: string;
    summary: string;
    effectiveDate: string | null;
    effectiveStatus: string;
    officialUrl: string;
  }>;
  warnings: string[];
  disclaimer: string;
};

function formatSeoulGenerationTime(generatedAt: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(generatedAt);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const date = `${value("year")}-${value("month")}-${value("day")}`;
  const filenameStamp = [
    value("year"),
    value("month"),
    value("day"),
  ].join("") + `-${value("hour")}${value("minute")}${value("second")}`;
  return {
    date,
    filenameStamp,
    label: `${date} ${value("hour")}:${value("minute")}:${value("second")} KST`,
  };
}

function buildDurationSummary(
  answers: ScenarioAnswers,
  schedule: ScheduleResult,
  durationScenario: DurationScenario,
): PermitReportModel["summary"]["duration"] {
  const timeline = schedule.projectTimeline;
  if (!timeline) {
    return {
      label: "산정 불가",
      value: "산정 불가",
      detail: "착공 예정일과 준공 예정일을 입력해야 공사 일정과 인허가 일정을 결합할 수 있습니다.",
      isTotal: false,
    };
  }

  if (timeline.durationStatus === "MINIMUM_ONLY") {
    const operationUnknown = timeline.unknownPlanningDurationProcedureIds.filter(
      (id) => !timeline.postOperationProcedureIds.includes(id),
    );
    const omitted = timeline.omittedConditionalProcedureIds.filter(
      (id) => !timeline.postOperationProcedureIds.includes(id),
    );
    const incomplete = timeline.incompleteDurationComponentProcedureIds.filter(
      (id) => !timeline.postOperationProcedureIds.includes(id),
    );
    const gaps = [
      operationUnknown.length ? `처리기간 미확인 ${operationUnknown.length}건` : null,
      omitted.length ? `대상확인 절차 일정 제외 ${omitted.length}건` : null,
      incomplete.length ? `기간 구성 미확인 ${incomplete.length}건` : null,
    ];
    return {
      label: "확인된 일정 하한",
      value: formatCalendarPeriod(
        timeline.projectStartDate,
        timeline.minimumKnownCompletionDate,
      ),
      detail: `총 소요기간 아님 · ${stableUnique(gaps).join(" · ") || "일정 구성요소 추가 확인 필요"}`,
      isTotal: false,
    };
  }

  const completionDate = timeline.operationReadyDate ?? timeline.minimumKnownCompletionDate;
  return {
    label: "총 소요기간",
    value: formatCalendarPeriod(timeline.projectStartDate, completionDate),
    detail: durationScenario === "USER"
      ? `사용자 예상 ${timeline.userDurationOverrideProcedureIds.length}건 반영 · 공식값과 구분 표기`
      : `${durationScenarioLabels[durationScenario]} 처리경로 · 실제 평균을 뜻하지 않음`,
    isTotal: true,
  };
}

function buildMilestones(answers: ScenarioAnswers, schedule: ScheduleResult) {
  const timeline = schedule.projectTimeline;
  return [
    { label: "검토 기준일", value: answers.assessmentDate },
    { label: "계획 착공일", value: answers.plannedConstructionStartDate ?? "미입력" },
    { label: "계획 준공일", value: answers.plannedConstructionEndDate ?? "미입력" },
    ...(answers.equipmentInstallationCompletionDate
      ? [{ label: "설비완료(사용자 목표)", value: answers.equipmentInstallationCompletionDate }]
      : []),
    ...(answers.commissioningStartDate
      ? [{ label: "시운전(사용자 목표)", value: answers.commissioningStartDate }]
      : []),
    ...(timeline?.operationReadyDate
      ? [{ label: "가동 준비 완료", value: timeline.operationReadyDate }]
      : []),
    ...(timeline?.postOperationCompletionDate
      ? [{ label: "가동 후 절차 완료", value: timeline.postOperationCompletionDate }]
      : []),
  ];
}

function buildLocalOrdinanceSummary(
  answers: ScenarioAnswers,
): PermitReportModel["localOrdinances"] {
  const links = getOfficialLocalOrdinanceLinks(answers.province, answers.city);
  if (!links.province) {
    return {
      checkedAt: reviewedElisSnapshotCheckedAt,
      notice: links.notice,
      transitionBasisLinks: [],
      categories: [],
    };
  }

  const jurisdictionTargets = getElisJurisdictionTargets(
    answers.province,
    answers.city,
  );
  const transitionalTargets = getElisTransitionalJurisdictionTargets(
    answers.province,
    answers.city,
  );
  const reviewedRecords = jurisdictionTargets.flatMap((target) =>
    getReviewedElisOrdinanceRecords(
      links.province?.name ?? answers.province,
      target.name,
      target.level,
    ),
  );
  const currentByCategory = new Map(
    matchOrdinancesToCategories(reviewedRecords).map((item) => [
      item.categoryId,
      item.ordinances,
    ]),
  );
  const transitionalByCategory = new Map(
    matchOrdinancesToCategories(
      getTransitionalElisOrdinanceRecords(answers.province, answers.city),
    ).map((item) => [
      item.categoryId,
      item.ordinances,
    ]),
  );

  return {
    checkedAt: reviewedElisSnapshotCheckedAt,
    notice: links.notice,
    transitionBasisLinks: transitionalTargets.map((target) => ({
      name: `${target.name} 조례 경과조치 근거`,
      url: target.legalBasisUrl,
      note: target.notice,
    })),
    categories: localOrdinanceReviewCategories.map((category) => {
      const currentOrdinances = currentByCategory.get(category.id) ?? [];
      const transitionalOrdinances = currentOrdinances.some(
        (ordinance) => ordinance.level === "PROVINCE",
      )
        ? []
        : transitionalByCategory.get(category.id) ?? [];
      const ordinances = [...currentOrdinances, ...transitionalOrdinances].filter(
        (ordinance, index, list) =>
          list.findIndex(
            (candidate) =>
              candidate.level === ordinance.level &&
              candidate.name === ordinance.name &&
              candidate.url === ordinance.url,
          ) === index,
      );
      const matchedJurisdictions = new Set(
        ordinances.map(
          (ordinance) => `${ordinance.level}|${ordinance.jurisdictionName}`,
        ),
      );
      const fallbackTargets = [
        ...jurisdictionTargets.map((target) => ({
          ...target,
          notice: "정확히 일치하는 조례가 없을 때 확인하는 관할 전체 목록",
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
      return {
        id: category.id,
        title: category.title,
        affects: category.affects,
        reviewPoint: category.reviewPoint,
        limitation: category.limitation,
        ordinances: ordinances.map((ordinance) => ({
          name: ordinance.name,
          level: ordinance.level,
          jurisdictionName: ordinance.jurisdictionName,
          url: ordinance.url,
          amendmentDate: ordinance.amendmentDate,
          transitionNotice: ordinance.transitionNotice ?? null,
        })),
        fallbackLinks: fallbackTargets.map((target) => ({
          name: `${target.name} ELIS 현행 목록`,
          url: target.listUrl,
          note: target.notice,
        })),
      };
    }),
  };
}

export function buildPermitReportModel({
  answers,
  evaluation,
  durationScenario,
  includeConditional = true,
  includePractical = true,
  generatedAt = new Date(),
}: {
  answers: ScenarioAnswers;
  evaluation: ProjectEvaluation;
  durationScenario: DurationScenario;
  includeConditional?: boolean;
  includePractical?: boolean;
  generatedAt?: Date;
}): PermitReportModel {
  const schedule = evaluation.schedules[durationScenario];
  const planningByProcedureId = new Map(
    schedule.planningDurations.map((duration) => [duration.procedureId, duration]),
  );
  const timelineNodeByProcedureId = new Map(
    (schedule.projectTimeline?.nodes ?? []).map((node) => [node.procedureId, node]),
  );
  const scheduleNodeByProcedureId = new Map(
    schedule.nodes.map((node) => [node.procedureId, node]),
  );
  const decisionByProcedureId = new Map(
    evaluation.decisions.map((decision) => [decision.procedure.id, decision]),
  );
  const topologicalOrder = new Map(
    schedule.topologicalOrder.map((procedureId, index) => [procedureId, index]),
  );

  const projectSections: PermitReportModel["project"]["sections"] = getVisibleProjectInputSections(answers).map((section) => ({
    id: section.id,
    title: section.title,
    items: section.fields.map((field) => {
      const value = getProjectInputValue(answers, field.key);
      return {
        label: inputLabel(field.key),
        value: formatProjectInputValue(field.key, value, field.unit),
        unknown: value === undefined || value === null || value === "UNKNOWN" || value === "",
      };
    }),
  }));
  const detailedInputFields = [
    { key: "siteAddress" },
    { key: "siteZoning" },
    { key: "siteRestrictedFactors" },
    { key: "industrialComplexName" },
    { key: "industrialComplexIdentifier" },
    { key: "industrialComplexManagingAuthority" },
    { key: "ksicCode" },
    { key: "products" },
    { key: "coreProcesses" },
    { key: "existingApprovalIds" },
    { key: "existingAreaM2", unit: "㎡" },
    { key: "increaseAreaM2", unit: "㎡" },
  ].flatMap((field) => {
    const value = getProjectInputValue(answers, field.key);
    if (value === undefined || value === null || value === "" || value === "UNKNOWN") return [];
    return [{
      label: inputLabel(field.key),
      value: formatProjectInputValue(field.key, value, field.unit),
      unknown: false,
    }];
  });
  if (detailedInputFields.length) {
    projectSections.splice(1, 0, {
      id: "project-details",
      title: "사업 식별·상세",
      items: detailedInputFields,
    });
  }

  const counts = evaluation.decisions.reduce<PermitReportModel["summary"]["counts"]>(
    (result, decision) => {
      result[procedureCategoryForDecision(decision)] += 1;
      return result;
    },
    { REQUIRED: 0, CONFIRM: 0, NOT_REQUIRED: 0 },
  );

  const procedures = evaluation.decisions
    .filter((decision) => procedureCategoryForDecision(decision) !== "NOT_REQUIRED")
    .map((decision) => {
      const procedure = decision.procedure;
      const category = procedureCategoryForDecision(decision) as Exclude<
        ProcedureCategory,
        "NOT_REQUIRED"
      >;
      const duration = procedure.durationId
        ? catalog.durations.find((item) => item.id === procedure.durationId)
        : undefined;
      const planning = planningByProcedureId.get(procedure.id);
      const timelineNode = timelineNodeByProcedureId.get(procedure.id);
      const sourceSummaries = stableUnique([
        ...procedure.citationIds,
        ...matchedRuleCitationIds(decision),
      ].map((citationId) => {
        const citation = catalog.citations.find((item) => item.id === citationId);
        if (!citation) return null;
        const source = catalog.legalSources.find((item) => item.id === citation.sourceId);
        return `${source?.title ?? "공식 근거"} ${citationLocator(citation)}`;
      }));

      return {
        id: procedure.id,
        name: procedure.name,
        stage: stageLabels[procedure.stage],
        category,
        categoryLabel: categoryLabels[category],
        status: decision.isDeemed
          ? "별도 신청 제외 · 상위 절차에서 의제 처리"
          : statusLabels[decision.status],
        reason: decision.reason,
        authority: procedure.receivingAuthority,
        decisionMaker: procedure.statutoryDecisionMaker,
        officialDuration: decision.isDeemed
          ? "별도 신청·처리기간 없음 · 상위 절차 일정에 포함"
          : formatResolvedOfficialDurationSummary(duration, planning),
        schedule: decision.isDeemed
          ? "상위 절차 일정에 포함"
          : timelineNode
          ? timelineNode.processingDuration === null
            ? timelineNode.overlapPolicy === "PRE_CONSTRUCTION"
              ? `${answers.plannedConstructionStartDate ?? "착공일"} 전 완료 필요 · 개시일 역산 불가`
              : `${timelineNode.startDate} 착수 기준 · 종료일 미산정`
            : `${timelineNode.startDate} ~ ${timelineNode.finishDate}`
          : "일정 미반영",
        scheduleNote: decision.isDeemed
          ? "의제서류 제출·관계기관 협의를 전제로 별도 처리일정을 계산하지 않음"
          : timelineNode
          ? formatTimelineProcessingDuration(timelineNode)
          : category === "CONFIRM"
            ? "대상 여부 또는 처리기간을 확인한 뒤 일정에 반영"
            : "공사일 또는 공식 처리기간 추가 확인 필요",
        outcome: procedure.outcome,
        submissions: procedure.submissions.length
          ? procedure.submissions.join(" · ")
          : "절차 상세와 관할기관 안내 확인",
        followUp: procedure.followUpObligations.length
          ? procedure.followUpObligations.join(" · ")
          : "별도 후속의무 수록 없음",
        missingInputs: stableUnique(decision.missingInputs.map(inputLabel)),
        specialLawEffects: stableUnique((decision.specialLawImpacts ?? []).map((impact) =>
          `${impact.effectLabel} · ${impact.statusLabel} · ${impact.description}${impact.statutoryCap ? ` · ${impact.statutoryCap}` : ""}`,
        )),
        legalReviewNote:
          category === "CONFIRM" &&
          decision.needsLegalReview &&
          decision.missingInputs.length === 0
          ? PRACTITIONER_REVIEW_NOTICE
          : null,
        sourceSummaries,
        stageIndex: stageOrder.indexOf(procedure.stage),
        orderIndex: topologicalOrder.get(procedure.id) ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((left, right) =>
      left.stageIndex - right.stageIndex ||
      left.orderIndex - right.orderIndex ||
      left.name.localeCompare(right.name, "ko"),
    )
    .map(({ stageIndex, orderIndex, ...procedure }) => {
      void stageIndex;
      void orderIndex;
      return procedure;
    });

  const gapMap = new Map<string, string[]>();
  for (const decision of evaluation.decisions) {
    if (procedureCategoryForDecision(decision) === "NOT_REQUIRED") continue;
    for (const missingInput of decision.missingInputs) {
      const label = inputLabel(missingInput);
      gapMap.set(label, [...(gapMap.get(label) ?? []), decision.procedure.name]);
    }
  }
  const gaps = [...gapMap.entries()]
    .map(([input, affectedProcedures]) => ({
      input,
      affectedProcedures: stableUnique(affectedProcedures),
    }))
    .sort((left, right) =>
      right.affectedProcedures.length - left.affectedProcedures.length ||
      left.input.localeCompare(right.input, "ko"),
    );

  const scheduledProcedureIds = new Set(schedule.nodes.map((node) => node.procedureId));
  const activeEdgeIds = new Set(schedule.activeEdgeIds);
  const procedureById = new Map(catalog.procedures.map((procedure) => [procedure.id, procedure]));
  const procedureStageById = new Map(
    catalog.procedures.map((procedure) => [procedure.id, procedure.stage]),
  );
  const coreRelations = coreFlowEdges(
    describeFlowEdges({
      edges: catalog.edges.filter(
        (edge) =>
          activeEdgeIds.has(edge.id) &&
          scheduledProcedureIds.has(edge.from) &&
          scheduledProcedureIds.has(edge.to),
      ),
      scheduleNodes: schedule.nodes,
      timelineNodes: schedule.projectTimeline?.nodes ?? [],
      criticalEdgeIds: schedule.criticalEdgeIds,
      procedureStageById,
      unknownDurationProcedureIds: schedule.unknownDurationProcedureIds,
      sequenceCitationIds: verifiedSequenceCitationIds({
        citations: catalog.citations,
        sources: catalog.legalSources,
        assessmentDate: answers.assessmentDate,
      }),
    }),
  )
    .sort(
      (left, right) =>
        Number(right.bottleneckCandidate) - Number(left.bottleneckCandidate) ||
        Number(right.binding) - Number(left.binding) ||
        Number(right.verifiedSequence) - Number(left.verifiedSequence) ||
        right.score - left.score ||
        left.edge.id.localeCompare(right.edge.id),
    )
    .slice(0, 10)
    .map((descriptor) => {
      const edge = descriptor.edge;
      const evidence = descriptor.evidence === "VERIFIED_LEGAL_SEQUENCE"
        ? "법령 조문으로 확인된 선후행"
        : descriptor.evidence === "REGISTERED_LEGAL_RELATION"
          ? "법정 관계 · 조문 순서 추가 확인"
          : descriptor.evidence === "PRACTICAL_RELATION"
            ? "실무 선행관계"
            : "참고 관계";
      const relation = edge.relation === "FINISH_TO_START"
        ? "완료 후 착수"
        : edge.relation === "START_TO_START"
          ? "착수 연동"
          : "완료 연동";
      return {
        id: edge.id,
        from: procedureById.get(edge.from)?.name ?? edge.from,
        to: procedureById.get(edge.to)?.name ?? edge.to,
        relation,
        evidence,
        bottleneck: descriptor.bottleneckCandidate,
        binding: descriptor.binding,
        note: edge.note,
      };
    });

  const flow: PermitReportModel["flow"] = {
    stages: stageOrder.map((stageId) => ({
      id: stageId,
      title: stageLabels[stageId],
      items: procedures
        .filter((procedure) => procedure.stage === stageLabels[stageId])
        .map((procedure) => ({
          id: procedure.id,
          name: procedure.name,
          category: procedure.category,
          categoryLabel: procedure.categoryLabel,
          officialDuration: procedure.officialDuration,
          wave: scheduleNodeByProcedureId.get(procedure.id)?.wave ?? null,
          isDeemed: Boolean(decisionByProcedureId.get(procedure.id)?.isDeemed),
          timing: decisionByProcedureId.get(procedure.id)?.isDeemed
            ? "상위 절차 일정에 포함"
            : timelineNodeByProcedureId.has(procedure.id)
            ? timelineNodeByProcedureId.get(procedure.id)?.processingDuration === null
              ? `${timelineNodeByProcedureId.get(procedure.id)?.startDate} 착수 기준 · 종료 미산정`
              : `${timelineNodeByProcedureId.get(procedure.id)?.startDate} ~ ${timelineNodeByProcedureId.get(procedure.id)?.finishDate}`
            : procedure.officialDuration,
          timingSource: timelineNodeByProcedureId.get(procedure.id)?.durationSource ?? null,
        })),
    })),
    coreRelations,
  };

  const selectedSpecialLawCitationIds = stableUnique([
    ...evaluation.decisions.flatMap((decision) =>
      (decision.specialLawImpacts ?? []).flatMap((impact) => impact.citationIds),
    ),
    ...evaluation.specialLawEvaluations.flatMap((specialLaw) => {
      const sourceIds = new Set(catalog.legalSources
        .filter((source) => source.officialUrl === specialLaw.officialUrl)
        .map((source) => source.id));
      return catalog.citations
        .filter((citation) =>
          sourceIds.has(citation.sourceId) && citation.article === specialLaw.article,
        )
        .map((citation) => citation.id);
    }),
  ]);
  const includedCitationIds = stableUnique([
    ...evaluation.decisions
      .filter((decision) => procedureCategoryForDecision(decision) !== "NOT_REQUIRED")
      .flatMap((decision) => {
      const duration = decision.procedure.durationId
        ? catalog.durations.find((item) => item.id === decision.procedure.durationId)
        : undefined;
      return [
        ...decision.procedure.citationIds,
        ...matchedRuleCitationIds(decision),
        ...(duration?.citationIds ?? []),
        ...(duration?.referencePeriods ?? []).flatMap((period) => period.citationIds),
      ];
      }),
    ...selectedSpecialLawCitationIds,
  ]);
  const legalSourceCitations = includedCitationIds.flatMap((citationId) => {
    const citation = catalog.citations.find((item) => item.id === citationId);
    if (!citation) return [];
    const source = catalog.legalSources.find((item) => item.id === citation.sourceId);
    if (!source) return [];
    const future = Boolean(source.effectiveDate && source.effectiveDate > answers.assessmentDate);
    return [{
      title: source.title,
      authority: source.issuingAuthority,
      locator: citationLocator(citation),
      summary: citation.summary,
      effectiveDate: source.effectiveDate,
      effectiveStatus: future
        ? `${source.effectiveDate} 시행 예정 · 기준일 현재 미적용`
        : source.status === "AUTHORITATIVE"
          ? "공식 근거"
          : "원문 재확인 필요",
      officialUrl: source.officialUrl,
    }];
  });
  const legalSourceGroups = new Map<string, typeof legalSourceCitations>();
  for (const source of legalSourceCitations) {
    const key = `${source.title}\u0000${source.officialUrl}`;
    legalSourceGroups.set(key, [...(legalSourceGroups.get(key) ?? []), source]);
  }
  const legalSources = [...legalSourceGroups.values()]
    .map((sources) => ({
      ...sources[0],
      locator: stableUnique(sources.map((source) => source.locator)).join(" · "),
      summary: stableUnique(sources.map((source) => source.summary)).join(" / "),
    }))
    .sort((left, right) =>
      left.title.localeCompare(right.title, "ko") ||
      left.locator.localeCompare(right.locator, "ko"),
    );

  const excluded = evaluation.decisions
    .filter((decision) => procedureCategoryForDecision(decision) === "NOT_REQUIRED")
    .sort((left, right) =>
      stageOrder.indexOf(left.procedure.stage) - stageOrder.indexOf(right.procedure.stage) ||
      left.procedure.name.localeCompare(right.procedure.name, "ko"),
    )
    .map((decision) => decision.procedure.name);

  const generatedTime = formatSeoulGenerationTime(generatedAt);
  const identity = reportIdentity(answers);
  const specialLaws = evaluation.specialLawEvaluations.map((evaluation) => ({
    title: evaluation.shortLabel,
    effect: effectLabels[evaluation.effect],
    status: evaluation.statusLabel,
    isActive: evaluation.status === "ACTIVE",
    note: `${evaluation.statusNote} · ${evaluation.conditionNote}`,
    law: evaluation.lawName ?? "특별법",
    article: evaluation.article,
    officialUrl: evaluation.officialUrl,
  }));

  const commissioningPrerequisiteIds = new Set([
    "building-use-approval",
    "electrical-pre-use-inspection",
    "fire-facility-completion-inspection",
    "hazardous-materials-facility-completion-inspection",
    "high-pressure-gas-facility-inspection",
    "integrated-environmental-operation-start-report",
    "mechanical-equipment-pre-use-inspection",
  ]);
  const commissioningConflicts = answers.commissioningStartDate
    ? evaluation.decisions.flatMap((decision) => {
        if (
          !commissioningPrerequisiteIds.has(decision.procedure.id) ||
          procedureCategoryForDecision(decision) === "NOT_REQUIRED" ||
          decision.isDeemed
        ) return [];
        const node = timelineNodeByProcedureId.get(decision.procedure.id);
        if (!node) return [];
        const comparisonDate = node.processingDuration === null
          ? node.startDate
          : node.finishDate;
        if (comparisonDate <= answers.commissioningStartDate!) return [];
        return [
          `${decision.procedure.name}(${node.processingDuration === null ? `${node.startDate} 이후 종료 미산정` : `${node.finishDate} 완료`})`,
        ];
      })
    : [];
  const commissioningWarning = answers.commissioningStartDate && commissioningConflicts.length
    ? `시운전 목표일 ${answers.commissioningStartDate}보다 늦게 계획되었거나 종료일이 미산정된 가동 전 확인절차가 있습니다: ${commissioningConflicts.join(" · ")}. 단계준공·부분사용 또는 설비별 검사범위를 별도로 인정받지 않았다면 시운전 일정을 조정하십시오.`
    : null;

  return {
    metadata: {
      title: identity.title,
      generatedAt: generatedAt.toISOString(),
      generatedAtLabel: generatedTime.label,
      assessmentDate: answers.assessmentDate,
      catalogVersion: catalog.coverage.catalogVersion,
      lastLegalReviewAt: catalog.coverage.lastLegalReviewAt,
      durationScenario: durationScenarioLabels[durationScenario],
      scheduleScope: `${includeConditional ? "대상 확인 절차 포함" : "대상 확인 절차 제외"} · ${includePractical ? "실무 선행관계 포함" : "법정 선행관계만 반영"}`,
      filename: `인허가-결과보고서_${identity.filenamePrefix}_${generatedTime.filenameStamp}.pdf`,
    },
    project: {
      descriptor: projectDescriptor(answers),
      sections: projectSections,
    },
    summary: {
      counts,
      roadmapBreakdown: roadmapInclusionBreakdown(evaluation.decisions),
      duration: buildDurationSummary(answers, schedule, durationScenario),
      milestones: buildMilestones(answers, schedule),
    },
    flow,
    specialLaws,
    procedures,
    gaps,
    localOrdinances: buildLocalOrdinanceSummary(answers),
    excluded,
    legalSources,
    warnings: stableUnique([
      ...buildInputConsistencyWarnings(answers),
      commissioningWarning,
      ...schedule.warnings,
      ...(schedule.projectTimeline?.warnings ?? []),
      ...catalog.coverage.gaps,
      ...catalog.coverage.futureLawWarnings,
    ]),
    disclaimer: `${catalog.coverage.disclaimer} 이 보고서는 입력값을 기준으로 한 사전 검토자료이며, 인허가 처분·법률자문 또는 관할기관의 공식 답변을 대체하지 않습니다. 법정기간의 정지·보완·협의·주민의견 수렴과 지역별 기준은 실제 일정에 별도로 반영해야 합니다. 사용자 입력 고시번호·공문번호의 원본·발행기관·의제목록 진위는 사이트가 보증하지 않습니다.`,
  };
}
