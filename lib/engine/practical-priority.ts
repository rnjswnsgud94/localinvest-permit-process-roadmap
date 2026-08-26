import type {
  ApplicabilityStatus,
  Procedure,
} from "@/lib/domain/schemas";
import { supplementalPermitTargetIds } from "@/lib/data/supplemental-permit-targets";

export const practicalPriorityLevels = ["P0", "P1", "P2"] as const;

export type PracticalPriorityLevel = (typeof practicalPriorityLevels)[number];

export type PracticalPriority = {
  level: PracticalPriorityLevel;
  label: "핵심 게이트" | "일정 선행" | "조건부 확인";
  rank: 0 | 1 | 2;
  reasons: string[];
};

export type PracticalPriorityContext = {
  applicability?: ApplicabilityStatus | null;
  isDeemed?: boolean;
  critical?: boolean;
};

/**
 * Procedures repeatedly identified as project gates while cross-checking
 * anonymized company and local-government working lists. This is field
 * evidence for prioritisation, not a legal source or an applicability rule.
 */
export const fieldReviewedGateProcedureIds: ReadonlySet<string> = new Set([
  "factory-establishment-approval",
  "industrial-complex-occupancy-contract",
  "industrial-complex-plan-approval",
  "industrial-complex-plan-change-approval",
  "industrial-complex-management-plan-change",
  "urban-county-management-plan-change-proposal",
  "development-activity-permit",
  "building-permit",
  "environmental-impact-assessment",
  "integrated-environmental-permit",
  "air-emission-installation-permit",
  "water-discharge-installation-permit",
  "power-grid-impact-assessment",
  "industrial-water-master-plan-reflection-consultation",
  "han-river-water-pollution-load-allocation",
  "energy-use-plan-consultation",
  "process-safety-report",
  "psm-pre-operation-confirmation",
  "construction-safety-management-plan-approval",
  "hazard-prevention-plan",
  "chemical-accident-prevention-plan",
  "military-protection-consultation",
  "hazardous-materials-facility-installation-permit",
  "construction-start-report",
  "fire-facility-completion-inspection",
  "electrical-pre-use-inspection",
  "building-use-approval",
  "building-temporary-use-approval",
  "facility-management-document-registration",
  "construction-restart-safety-inspection",
  "factory-completion-report-complex",
  "factory-completion-report-offsite",
  "factory-completion-report-free-trade-zone",
]);

const conditionalSupplementalProcedureIds: ReadonlySet<string> = new Set(
  supplementalPermitTargetIds,
);

const labels: Record<PracticalPriorityLevel, PracticalPriority["label"]> = {
  P0: "핵심 게이트",
  P1: "일정 선행",
  P2: "조건부 확인",
};

const ranks: Record<PracticalPriorityLevel, PracticalPriority["rank"]> = {
  P0: 0,
  P1: 1,
  P2: 2,
};

function result(
  level: PracticalPriorityLevel,
  reasons: string[],
): PracticalPriority {
  return {
    level,
    label: labels[level],
    rank: ranks[level],
    reasons: [...new Set(reasons)],
  };
}

function applicabilityReason(
  applicability: ApplicabilityStatus | null | undefined,
): string | null {
  if (applicability === "APPLIES") return "현재 입력에서 적용 절차로 판정됨";
  if (applicability === "POSSIBLY_APPLIES") {
    return "적용 가능성이 있어 관계기관 확인이 필요함";
  }
  if (applicability === "NEEDS_MORE_INFO") {
    return "판정 입력 또는 관계기관 확인이 더 필요함";
  }
  if (applicability === "DOES_NOT_APPLY") {
    return "현재 입력에서는 적용 제외로 판정됨";
  }
  return null;
}

/**
 * Derives a project-specific, practitioner-facing priority without changing
 * legal applicability or reusing ApplicabilityRule.priority.
 *
 * Conditional/deemed procedures stay P2 even if their procedure type is a
 * common field gate. Confirmed field gates and current schedule-critical nodes
 * are P0, while other pre-operation procedures are P1.
 */
export function practicalPriorityForProcedure(
  procedure: Procedure,
  context: PracticalPriorityContext = {},
): PracticalPriority {
  const reasons: string[] = [];
  const statusReason = applicabilityReason(context.applicability);
  if (statusReason) reasons.push(statusReason);

  const isFieldReviewedGate = fieldReviewedGateProcedureIds.has(procedure.id);
  if (context.isDeemed) {
    reasons.push("상위 절차의 의제서류·관계기관 협의 조건을 확인해야 함");
    if (isFieldReviewedGate) {
      reasons.push("기업·지자체 실무목록 교차검토에서 일정 게이트로 반복 확인");
    }
    return result("P2", reasons);
  }

  if (
    context.applicability === "DOES_NOT_APPLY" ||
    context.applicability === "POSSIBLY_APPLIES" ||
    context.applicability === "NEEDS_MORE_INFO"
  ) {
    return result("P2", reasons);
  }

  if (
    context.applicability == null &&
    conditionalSupplementalProcedureIds.has(procedure.id) &&
    !isFieldReviewedGate
  ) {
    reasons.push("입지·시설 또는 공사조건이 맞을 때만 적용되는 선택형 절차임");
    return result("P2", reasons);
  }

  if (context.critical) {
    reasons.push("현재 인허가 일정 그래프의 임계경로에 포함됨");
    if (isFieldReviewedGate) {
      reasons.push("기업·지자체 실무목록 교차검토에서 일정 게이트로 반복 확인");
    }
    return result("P0", reasons);
  }

  if (isFieldReviewedGate) {
    reasons.push("기업·지자체 실무목록 교차검토에서 일정 게이트로 반복 확인");
    return result("P0", reasons);
  }

  if (procedure.stage !== "POST_OPERATION") {
    reasons.push("착공·가동 전에 검토하거나 완료할 선행 단계에 배치됨");
    return result("P1", reasons);
  }

  reasons.push("가동 후 이행·정기점검 단계로 별도 추적이 필요함");
  return result("P2", reasons);
}
