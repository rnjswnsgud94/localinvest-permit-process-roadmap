import type { DurationEstimate, Procedure } from "@/lib/domain/schemas";
import type { ScenarioAnswers } from "@/lib/data/catalog";
import type {
  DurationUnit,
  PlanningDuration,
  PlanningOverlapPolicy,
  PlanningReleasePolicy,
} from "@/lib/engine/schedule";

const preConstructionMilestones = new Set([
  "building-demolition-permit-report",
  "building-permit",
  "construction-start-report",
  "construction-waste-plan-report",
  "fugitive-dust-business-report",
  "nonpoint-source-installation-report",
  "fire-building-permit-consent",
  "hazardous-materials-facility-installation-permit",
  "underground-safety-assessment",
  "construction-safety-management-plan-approval",
  "specific-construction-prior-report",
  "asbestos-removal-work-report",
  "public-sewer-drainage-facility-report",
  "groundwater-development-use-permit-report",
  "private-sewage-treatment-installation-report",
  "waste-treatment-facility-installation-approval-report",
]);

const constructionFinishRelease = new Set([
  "building-use-approval",
  "development-activity-completion-inspection",
  "public-water-completion-inspection-report",
  "lpg-specific-use-facility-completion-inspection",
  "city-gas-specific-use-facility-completion-inspection",
  "mechanical-equipment-pre-use-inspection",
  "small-factory-registration",
  "factory-completion-report-complex",
  "factory-completion-report-offsite",
  "groundwater-completion-report",
  "public-sewer-drainage-facility-completion-inspection",
  "private-sewage-treatment-completion-inspection",
  "waste-treatment-facility-inspection",
  "fire-facility-completion-inspection",
  "hazardous-materials-facility-completion-inspection",
  "electrical-pre-use-inspection",
  "high-pressure-gas-facility-inspection",
  "heat-use-equipment-installation-inspection",
]);

const aiOneStopRelationshipProcedureIds = new Set([
  "power-grid-impact-assessment",
  "energy-use-plan-consultation",
  "traffic-impact-assessment",
  "landscape-review",
  "building-committee-review",
  "building-permit",
  "fire-building-permit-consent",
]);

const unresolvedOfficialBranchProcedureIds = new Set([
  "factory-establishment-approval",
  "building-permit",
  "building-use-approval",
  "factory-completion-report-complex",
  "factory-completion-report-offsite",
  "farmland-conversion-permit",
  "road-occupation-permit",
  "groundwater-development-use-permit-report",
  "fire-building-permit-consent",
  "private-electrical-facility-construction-plan",
  "water-discharge-installation-permit",
  "hazardous-materials-facility-installation-permit",
  "high-pressure-gas-manufacture-storage-permit-report",
  "high-pressure-gas-technical-review",
  "disaster-impact-assessment-consultation",
  "river-occupation-permit",
  "public-water-occupation-use-permit",
  "public-water-implementation-plan-approval-report",
  "public-water-completion-inspection-report",
  "chemical-registration-notification",
  "restricted-toxic-chemical-import-permit-report",
  "small-factory-registration",
]);

function overlapPolicy(procedure: Procedure): PlanningOverlapPolicy {
  if (procedure.stage === "POST_OPERATION") return "POST_OPERATION";
  if (procedure.stage === "PRE_OPERATION") return "PRE_OPERATION";
  if (procedure.stage === "DURING_CONSTRUCTION") return "DURING_CONSTRUCTION";
  if (
    procedure.stage === "SITE_REVIEW" ||
    procedure.stage === "PLAN_AND_OCCUPANCY" ||
    procedure.stage === "PRE_CONSTRUCTION"
  ) return "PRE_CONSTRUCTION";
  if (preConstructionMilestones.has(procedure.id)) return "PRE_CONSTRUCTION";
  return "DURING_CONSTRUCTION";
}

function releasePolicy(procedure: Procedure): PlanningReleasePolicy {
  if (procedure.stage === "POST_OPERATION") return "OPERATION_READY";
  if (constructionFinishRelease.has(procedure.id)) return "CONSTRUCTION_FINISH";
  return "EARLIEST_ALLOWED";
}

/** 법령·정부24에서 확인한 기간을 원 단위 그대로 일정 엔진에 전달합니다. */
export function buildPlanningDurations(
  procedures: readonly Procedure[],
  durations: readonly DurationEstimate[],
  answers?: ScenarioAnswers,
): PlanningDuration[] {
  const durationByProcedure = new Map(
    durations.map((duration) => [duration.procedureId, duration]),
  );

  return procedures.map((procedure) => {
    const source = durationByProcedure.get(procedure.id);
    const elapsed = source?.elapsed ?? null;
    const resolved = resolveOfficialRoute(procedure.id, source, answers);
    const hasDurationComponent = (value: unknown) =>
      value !== null && value !== undefined;
    const endToEndMissingComponents = resolved.confirmedMilestone
      ? []
      : [
          hasDurationComponent(source?.applicantPreparation) || resolved.includes?.includes("APPLICANT_PREPARATION") ? null : "신청인 준비",
          hasDurationComponent(source?.authorityProcessing) || resolved.includes?.includes("AUTHORITY_PROCESSING") ? null : "기관 처리",
          hasDurationComponent(source?.interagencyConsultation) || resolved.includes?.includes("INTERAGENCY_CONSULTATION") ? null : "관계기관 협의",
          hasDurationComponent(source?.elapsed) || resolved.localReference ? null : "전체 경과",
        ].filter((item): item is string => item !== null);
    return {
      procedureId: procedure.id,
      minimum: resolved.minimum,
      typical: resolved.typical,
      upperBound: resolved.upperBound,
      unit: resolved.unit ?? elapsed?.unit ?? null,
      overlapPolicy: overlapPolicy(procedure),
      releasePolicy: releasePolicy(procedure),
      evidenceType: source?.evidenceType ?? "INSUFFICIENT_DATA",
      confidence: source?.estimateConfidence ?? "UNVERIFIED",
      sourceLabel: resolved.confirmedMilestone
        ? [
            resolved.sourceLabel,
            source?.statutoryPeriod
              ? `원 절차 처리기준: ${source.statutoryPeriod}`
              : null,
          ].filter(Boolean).join(" · ")
        : resolved.sourceLabel ?? source?.statutoryPeriod ?? null,
      assumptions: source?.assumptions ?? [],
      reviewedAt: source?.verifiedAt ?? null,
      planningBasis: resolved.planningBasis ?? source?.planningBasis,
      referencePeriods: source?.referencePeriods ?? [],
      endToEndMissingComponents,
      completedCheckpoint: resolved.completedCheckpoint ?? null,
    } satisfies PlanningDuration;
  });
}

function resolveOfficialRoute(
  procedureId: string,
  source: DurationEstimate | undefined,
  answers?: ScenarioAnswers,
): {
  minimum: number | null;
  typical: number | null;
  upperBound: number | null;
  unit?: DurationUnit;
  sourceLabel?: string;
  planningBasis?: DurationEstimate["planningBasis"];
  includes?: NonNullable<DurationEstimate["referencePeriods"]>[number]["includes"];
  localReference?: boolean;
  confirmedMilestone?: boolean;
  completedCheckpoint?: NonNullable<PlanningDuration["completedCheckpoint"]>;
} {
  const elapsed = source?.elapsed ?? null;
  const aiOneStopRelationshipProcessingCompleted = Boolean(
    answers &&
    aiOneStopRelationshipProcedureIds.has(procedureId) &&
    answers.assessmentDate >= "2027-03-10" &&
    answers.industryCategory === "AI_DATA_CENTER" &&
    answers.aiDataCenterActFacilityConfirmed === true &&
    answers.appliedSpecialLawIds.includes("AIDC_ONE_STOP") &&
    answers.aiDataCenterOneStopStatus === "COMPLETED"
  );
  const unresolvedOfficialBranch = unresolvedOfficialBranchProcedureIds.has(procedureId);
  const unmatchedLocalReference = source?.planningBasis === "LOCAL_OFFICIAL_REFERENCE";
  const fallback = {
    minimum: unresolvedOfficialBranch ? null : elapsed?.min ?? null,
    typical: unresolvedOfficialBranch ? null : elapsed?.base ?? null,
    upperBound: elapsed?.max ?? null,
    unit: undefined,
    sourceLabel: unresolvedOfficialBranch
      ? `${source?.statutoryPeriod ?? "공식 처리기간"} · 적용 분기 확인 필요`
      : undefined,
    planningBasis: unresolvedOfficialBranch
      ? "UNRESOLVED_OFFICIAL_BRANCH" as const
      : unmatchedLocalReference
        ? "INSUFFICIENT_DATA" as const
        : source?.planningBasis,
    includes: undefined,
    localReference: false,
    confirmedMilestone: false,
    completedCheckpoint: undefined,
  };
  if (!answers) return fallback;

  const localReference = source?.referencePeriods?.find(
    (period) =>
      !aiOneStopRelationshipProcessingCompleted &&
      period.kind === "LOCAL_OFFICIAL_STANDARD" &&
      period.jurisdiction === answers.city &&
      period.range !== null,
  );
  if (localReference?.range) {
    return {
      minimum: localReference.range.min,
      typical: localReference.range.base,
      upperBound: localReference.range.max,
      unit: localReference.range.unit,
      sourceLabel: `${localReference.label} · ${localReference.startsWhen} 기준`,
      planningBasis: "LOCAL_OFFICIAL_REFERENCE",
      includes: localReference.includes,
      localReference: true,
      confirmedMilestone: false,
      completedCheckpoint: undefined,
    };
  }

  const confirmedMilestone = ({
    completedDate,
    label,
  }: {
    completedDate: string | null;
    label: string;
  }) => ({
    minimum: 0,
    typical: 0,
    upperBound: 0,
    unit: "CALENDAR_DAY" as const,
    sourceLabel: completedDate
      ? `${label} ${completedDate} 확인 · 남은 처리기간 0일`
      : `${answers.assessmentDate} 현재 ${label} 입력 확인 · 남은 처리기간 0일`,
    confirmedMilestone: true,
    planningBasis: "MILESTONE_ONLY" as const,
    localReference: false,
    completedCheckpoint: {
      label,
      completedDate,
      confirmedAsOfDate: answers.assessmentDate,
    },
  });

  if (aiOneStopRelationshipProcessingCompleted) {
    return confirmedMilestone({
      completedDate: null,
      label: "AI 데이터센터 일괄처리 관계기관 처리결과 확인",
    });
  }

  if (
    procedureId === "advanced-strategic-industry-fast-track-request" &&
    answers.advancedStrategicIndustryFastTrackConfirmed === true &&
    answers.advancedStrategicIndustryApplicantRoleConfirmed === true &&
    answers.advancedStrategicIndustryDelayRiskConfirmed === true &&
    answers.advancedStrategicIndustryCommitteeResolved === true &&
    answers.advancedStrategicIndustryFastTrackPermitIds.length > 0 &&
    answers.advancedStrategicIndustryMinisterRequestDate !== null &&
    answers.advancedStrategicIndustryMinisterRequestDate >= "2023-07-01" &&
    answers.advancedStrategicIndustryMinisterRequestDate <= answers.assessmentDate
  ) {
    return confirmedMilestone({
      completedDate: answers.advancedStrategicIndustryMinisterRequestDate,
      label: "산업통상부장관 신속처리 요청",
    });
  }

  if (
    procedureId === "semiconductor-cluster-fast-track-request" &&
    answers.semiconductorClusterFastTrackConfirmed === true &&
    answers.semiconductorClusterApplicantRoleConfirmed === true &&
    answers.semiconductorClusterDelayRiskConfirmed === true &&
    answers.semiconductorClusterCommitteeResolved === true &&
    answers.semiconductorClusterFastTrackPermitIds.length > 0 &&
    answers.semiconductorClusterMinisterRequestDate !== null &&
    answers.semiconductorClusterMinisterRequestDate >= "2026-08-11" &&
    answers.semiconductorClusterMinisterRequestDate <= answers.assessmentDate
  ) {
    return confirmedMilestone({
      completedDate: answers.semiconductorClusterMinisterRequestDate,
      label: "산업통상부장관 신속처리 요청",
    });
  }

  if (
    procedureId === "port-hinterland-entry-contract" &&
    answers.entryContractRegime === "PORT_ACT" &&
    answers.entryContractStatus === "COMPLETED"
  ) {
    return confirmedMilestone({
      completedDate: null,
      label: "1종 항만배후단지 입주계약 체결 완료",
    });
  }

  if (
    procedureId === "free-trade-zone-entry-contract" &&
    answers.entryContractRegime === "FREE_TRADE_ZONE_ACT" &&
    answers.entryContractStatus === "COMPLETED"
  ) {
    return confirmedMilestone({
      completedDate: null,
      label: "자유무역지역 입주계약 체결 완료",
    });
  }

  if (
    procedureId === "industrial-complex-occupancy-contract" &&
    answers.insideIndustrialComplex === true &&
    answers.industrialComplexOccupancyContractStatus === "COMPLETED"
  ) {
    return confirmedMilestone({
      completedDate: null,
      label: "산업단지 입주계약 체결 완료",
    });
  }

  if (
    procedureId === "ai-data-center-one-stop-result" &&
    answers.assessmentDate >= "2027-03-10" &&
    answers.industryCategory === "AI_DATA_CENTER" &&
    answers.aiDataCenterActFacilityConfirmed === true &&
    answers.appliedSpecialLawIds.includes("AIDC_ONE_STOP") &&
    answers.aiDataCenterOneStopStatus === "COMPLETED"
  ) {
    return confirmedMilestone({
      completedDate: null,
      label: "AI 데이터센터 일괄처리 결과통지 완료",
    });
  }

  const planApprovalMilestones = {
    "semiconductor-cluster-plan-approval": {
      qualified: answers.semiconductorClusterPlanDeemingConfirmed,
      documentsIncluded: answers.semiconductorClusterPlanDocumentsIncluded,
      consultationCompleted: answers.semiconductorClusterPlanConsultationCompleted,
      published: answers.semiconductorClusterPlanApprovalPublished,
      date: answers.semiconductorClusterPlanApprovalPublishedDate,
      reference: answers.semiconductorClusterPlanApprovalNoticeReference,
      includedCount: answers.semiconductorClusterPlanIncludedPermitIds.length,
      effectiveFrom: "2026-08-11",
    },
    "industrial-complex-plan-approval": {
      qualified: answers.industrialComplexPlanSpecialCaseConfirmed,
      documentsIncluded: answers.industrialComplexPlanDocumentsIncluded,
      consultationCompleted: answers.industrialComplexPlanConsultationCompleted,
      published: answers.industrialComplexPlanApprovalPublished,
      date: answers.industrialComplexPlanApprovalPublishedDate,
      reference: answers.industrialComplexPlanApprovalNoticeReference,
      includedCount: answers.industrialComplexPlanIncludedPermitIds.length,
      effectiveFrom: "2008-09-06",
    },
    "regional-special-zone-plan-approval": {
      qualified: answers.regionalSpecialZonePlanDeemingConfirmed,
      documentsIncluded: answers.regionalSpecialZonePlanDocumentsIncluded,
      consultationCompleted: answers.regionalSpecialZonePlanConsultationCompleted,
      published: answers.regionalSpecialZonePlanApprovalPublished,
      date: answers.regionalSpecialZonePlanApprovalPublishedDate,
      reference: answers.regionalSpecialZonePlanApprovalNoticeReference,
      includedCount: answers.regionalSpecialZonePlanIncludedPermitIds.length,
      effectiveFrom: "2019-04-17",
    },
  } as const;
  const planApproval =
    planApprovalMilestones[
      procedureId as keyof typeof planApprovalMilestones
    ];
  if (
    planApproval?.qualified === true &&
    planApproval.documentsIncluded === true &&
    planApproval.consultationCompleted === true &&
    planApproval.published === true &&
    planApproval.date !== null &&
    planApproval.date >= planApproval.effectiveFrom &&
    planApproval.date <= answers.assessmentDate &&
    planApproval.reference.trim().length > 0 &&
    planApproval.includedCount > 0
  ) {
    return confirmedMilestone({
      completedDate: planApproval.date,
      label: "계획 승인·고시 완료",
    });
  }

  if (procedureId === "factory-establishment-approval") {
    const daysByCoordination: Record<string, number> = {
      NONE: 7,
      LOCAL_ONLY: 14,
      OTHER_LT_20: 20,
      OTHER_GTE_20: 30,
    };
    const value = answers.permitCoordination
      ? daysByCoordination[answers.permitCoordination]
      : undefined;
    return value === undefined ? fallback : { ...fallback, minimum: value, typical: value, upperBound: value, planningBasis: "INPUT_RESOLVED_OFFICIAL" };
  }

  if (
    procedureId === "building-permit" &&
    answers.totalAreaM2 !== null &&
    answers.buildingCommitteeReviewRequired === false
  ) {
    if (answers.totalAreaM2 < 1_000) return { ...fallback, minimum: 7, typical: 7, upperBound: 7, planningBasis: "INPUT_RESOLVED_OFFICIAL" };
    if (answers.totalAreaM2 < 5_000) return { ...fallback, minimum: 7, typical: 14, upperBound: 14, planningBasis: "INPUT_RESOLVED_OFFICIAL" };
    if (answers.totalAreaM2 < 30_000) return { ...fallback, minimum: 10, typical: 14, upperBound: 14, planningBasis: "INPUT_RESOLVED_OFFICIAL" };
    return { ...fallback, minimum: 15, typical: 25, upperBound: 25, planningBasis: "INPUT_RESOLVED_OFFICIAL" };
  }

  return fallback;
}

export const planningDurationNotice =
  "일정의 ‘공식 기준’은 법령·정부24 또는 입력 지역의 공식 민원기준입니다. 실제 평균을 뜻하지 않으며, 서류 작성·보완·기관 협의는 근거가 있는 경우에만 합산합니다. 상한만 확인된 절차는 총기간에 임의 대입하지 않습니다.";
