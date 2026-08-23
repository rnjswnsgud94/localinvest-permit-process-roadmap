import type {
  ApplicabilityRule,
  Condition,
  DurationEstimate,
  LegalCitation,
  LegalSource,
  Procedure,
  ProcedureEdge,
} from "@/lib/domain/schemas";
import {
  advancedStrategicIndustryCandidateIds,
  filterPlanDeemedProcedureIds,
  industrialComplexPlanDeemedProcedureIds,
  isFastTrackTargetProcedure,
  regionalSpecialZoneDeemedProcedureIds,
  semiconductorClusterCandidateIndustryIds,
  semiconductorClusterPlanDeemedProcedureIds,
} from "@/lib/data/special-law-processes";

export const AI_DATA_CENTER_INDUSTRY_ID = "AI_DATA_CENTER" as const;
export const AI_DATA_CENTER_SPECIAL_ACT_EFFECTIVE_DATE = "2027-03-10" as const;

export const aiDataCenterSpecialLawIds = [
  "AIDC_ONE_STOP",
  "AIDC_GRID_IMPACT_EXEMPTION",
  "AIDC_BUILDING_STANDARDS",
  "AIDC_INDUSTRIAL_COMPLEX_LOCATION",
  "AIDC_PORT_HINTERLAND_ENTRY",
] as const;

export const automaticSpecialLawIds = [
  "ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK",
  "SEMICONDUCTOR_CLUSTER_FAST_TRACK",
  "SEMICONDUCTOR_CLUSTER_PLAN_DEEMING",
  "INDUSTRIAL_COMPLEX_PLAN_INTEGRATED_APPROVAL",
  "REGIONAL_SPECIAL_ZONE_PLAN_DEEMING",
] as const;

export const specialLawIds = [
  ...aiDataCenterSpecialLawIds,
  ...automaticSpecialLawIds,
] as const;

export type SpecialLawId = (typeof specialLawIds)[number];
export type AiDataCenterSpecialLawId =
  (typeof aiDataCenterSpecialLawIds)[number];
export type AutomaticSpecialLawQualificationKey =
  | "advancedStrategicIndustryFastTrackConfirmed"
  | "semiconductorClusterFastTrackConfirmed"
  | "semiconductorClusterPlanDeemingConfirmed"
  | "industrialComplexPlanSpecialCaseConfirmed"
  | "regionalSpecialZonePlanDeemingConfirmed";
export type SpecialLawStatus =
  | "ACTIVE"
  | "FUTURE"
  | "MISMATCH"
  | "UNCONFIRMED";
export type SpecialLawEffect =
  | "ONE_STOP"
  | "EXEMPTION"
  | "DEEMED_REPORT"
  | "STANDARD_RELAXATION"
  | "LOCATION_SPECIAL_CASE"
  | "FAST_TRACK"
  | "INTEGRATED_APPROVAL"
  | "PLAN_DEEMING";

export type SpecialLawDefinition = {
  id: SpecialLawId;
  lawName?: string;
  scopeLabel?: string;
  selectionMode?: "MANUAL" | "AUTOMATIC_CONFIRMATION";
  effectiveFrom?: string;
  qualificationKey?: AutomaticSpecialLawQualificationKey;
  shortLabel: string;
  title: string;
  article: string;
  effect: SpecialLawEffect;
  description: string;
  conditionNote: string;
  affectedProcedureIds: readonly string[];
  officialUrl: string;
};

export type SpecialLawEvaluation = SpecialLawDefinition & {
  status: SpecialLawStatus;
  statusLabel: string;
  statusNote: string;
};

export type SpecialLawImpact = {
  lawId: SpecialLawId;
  lawTitle: string;
  article: string;
  effect: SpecialLawEffect;
  effectLabel: string;
  status: SpecialLawStatus;
  statusLabel: string;
  description: string;
  statutoryCap?: string;
  citationIds: string[];
  officialUrl: string;
};

const AIDC_SPECIAL_ACT_URL =
  "https://www.law.go.kr/LSW/lsInfoP.do?ancYnChk=&chrClsCd=010202&efYd=20270310&lsiSeq=286707&urlMode=lsInfoP";
const PORT_ACT_URL =
  "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=283707";
const PORT_ACT_DECREE_URL =
  "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=287353";
const INDUSTRIAL_CLUSTER_ENFORCEMENT_RULE_URL =
  "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=285509";
const CIVIL_PETITIONS_ACT_URL =
  "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=239293";
const CIVIL_PETITIONS_ENFORCEMENT_DECREE_URL =
  "https://www.law.go.kr/법령/민원처리에관한법률시행령/제20조";
const ADMINISTRATIVE_PROCEDURE_ENFORCEMENT_DECREE_URL =
  "https://www.law.go.kr/법령/행정절차법시행령/제11조";

const ADVANCED_STRATEGIC_INDUSTRY_ACT_URL =
  "https://www.law.go.kr/LSW/lsInfoP.do?ancYnChk=&lsId=014238";
const ADVANCED_STRATEGIC_INDUSTRY_DECREE_URL =
  "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=282935";
const SEMICONDUCTOR_SPECIAL_ACT_URL =
  "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=286559";
const SEMICONDUCTOR_SPECIAL_RULE_URL =
  "https://www.law.go.kr/LSW/lsInfoP.do?ancYnChk=0&chrClsCd=010202&efYd=20260811&lsiSeq=288757&urlMode=lsInfoP";
const ADVANCED_STRATEGIC_INDUSTRY_RULE_URL =
  "https://www.law.go.kr/법령/국가첨단전략산업경쟁력강화및보호에관한특별조치법시행규칙";
const INDUSTRIAL_COMPLEX_FAST_TRACK_ACT_URL =
  "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=276999";
const INDUSTRIAL_COMPLEX_FAST_TRACK_DECREE_URL =
  "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=264497";
const REGIONAL_SPECIAL_ZONE_ACT_URL =
  "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=281979";
const REGIONAL_SPECIAL_ZONE_DECREE_URL =
  "https://www.law.go.kr/LSW/lsInfoP.do?lsId=009762&urlMode=lsInfoP";

export const specialLawDefinitions: readonly SpecialLawDefinition[] = [
  {
    id: "AIDC_ONE_STOP",
    lawName: "인공지능 데이터센터 산업 진흥에 관한 특별법",
    scopeLabel: "AI 데이터센터",
    selectionMode: "MANUAL",
    effectiveFrom: AI_DATA_CENTER_SPECIAL_ACT_EFFECTIVE_DATE,
    shortLabel: "인허가 일괄처리",
    title: "AI 데이터센터 인허가 일괄처리",
    article: "제18조",
    effect: "ONE_STOP",
    description:
      "과학기술정보통신부에 전력계통영향평가, 에너지사용계획, 교통·경관·건축 심의, 건축 인허가와 소방동의를 일괄신청할 수 있습니다. 관계기관이 법정기한까지 거부를 통지하지 않으면 기한 종료 다음 날 해당 인허가등의 처리가 완료된 것으로 봅니다.",
    conditionNote:
      "신청만으로 면제되거나 처리 완료되는 제도가 아닙니다. 과기정통부 사전검토·보완과 국가인공지능전략위원회 심의 뒤 관계기관 요청 다음 날부터 기본 처리기한이 시작되고, 주민의견 청취·특별사유 시 원칙적으로 1회 30일 이내 연장될 수 있습니다. 기한완료 의제는 적용되는 기한까지 거부 통지가 없는 경우에만 성립하며, 일괄처리를 받은 경우에만 AI 데이터센터 신고가 의제됩니다.",
    affectedProcedureIds: [
      "ai-data-center-one-stop-application",
      "ai-data-center-one-stop-result",
      "power-grid-impact-assessment",
      "energy-use-plan-consultation",
      "traffic-impact-assessment",
      "landscape-review",
      "building-committee-review",
      "building-permit",
      "fire-building-permit-consent",
      "ai-data-center-business-report",
    ],
    officialUrl: AIDC_SPECIAL_ACT_URL,
  },
  {
    id: "AIDC_GRID_IMPACT_EXEMPTION",
    lawName: "인공지능 데이터센터 산업 진흥에 관한 특별법",
    scopeLabel: "AI 데이터센터",
    selectionMode: "MANUAL",
    effectiveFrom: AI_DATA_CENTER_SPECIAL_ACT_EFFECTIVE_DATE,
    shortLabel: "계통영향평가 면제",
    title: "비수도권 AI 데이터센터 전력계통영향평가 특례",
    article: "제19조",
    effect: "EXEMPTION",
    description:
      "비수도권 AI 데이터센터의 신축·확장·기존 데이터센터 전환이 시행령상 시설·전력용량 기준을 충족하면 전력계통영향평가 대상에서 제외됩니다.",
    conditionNote:
      "현재 하위 시행령이 제정되지 않아 AI 데이터센터 인정기준과 면제 전력용량이 확정되지 않았습니다. 시행 후 공식 요건 충족을 확인한 경우에만 선택하세요.",
    affectedProcedureIds: ["power-grid-impact-assessment"],
    officialUrl: AIDC_SPECIAL_ACT_URL,
  },
  {
    id: "AIDC_BUILDING_STANDARDS",
    lawName: "인공지능 데이터센터 산업 진흥에 관한 특별법",
    scopeLabel: "AI 데이터센터",
    selectionMode: "MANUAL",
    effectiveFrom: AI_DATA_CENTER_SPECIAL_ACT_EFFECTIVE_DATE,
    shortLabel: "시설 규모 산정 특례",
    title: "AI 데이터센터 시설 규모 산정 특례",
    article: "제21조",
    effect: "STANDARD_RELAXATION",
    description:
      "승강기, 친환경자동차 충전·전용주차, 부설주차장, 건축물 미술작품의 규모 등을 대통령령에 따라 달리 산정할 수 있습니다.",
    conditionNote:
      "건축허가 면제가 아닙니다. 시행령의 별도 산정기준을 설계도서와 관할 건축부서에서 확인해야 합니다.",
    affectedProcedureIds: ["building-permit"],
    officialUrl: AIDC_SPECIAL_ACT_URL,
  },
  {
    id: "AIDC_INDUSTRIAL_COMPLEX_LOCATION",
    lawName: "인공지능 데이터센터 산업 진흥에 관한 특별법",
    scopeLabel: "AI 데이터센터",
    selectionMode: "MANUAL",
    effectiveFrom: AI_DATA_CENTER_SPECIAL_ACT_EFFECTIVE_DATE,
    shortLabel: "산단 입지 특례",
    title: "산업단지 AI 데이터센터 입지 특례",
    article: "제22조",
    effect: "LOCATION_SPECIAL_CASE",
    description:
      "대통령령으로 정하는 산업단지의 AI 데이터센터를 정보통신산업 관련 산업시설용지 시설과 산업집적기반시설로 볼 수 있습니다.",
    conditionNote:
      "산업단지 입주계약은 그대로 필요합니다. 대상 산업단지와 관리기본계획 반영 여부를 관리기관에서 확인하세요.",
    affectedProcedureIds: [],
    officialUrl: AIDC_SPECIAL_ACT_URL,
  },
  {
    id: "AIDC_PORT_HINTERLAND_ENTRY",
    lawName: "인공지능 데이터센터 산업 진흥에 관한 특별법",
    scopeLabel: "AI 데이터센터",
    selectionMode: "MANUAL",
    effectiveFrom: AI_DATA_CENTER_SPECIAL_ACT_EFFECTIVE_DATE,
    shortLabel: "항만배후단지 입주",
    title: "1종 항만배후단지 AI 데이터센터 입주 특례",
    article: "제23조",
    effect: "LOCATION_SPECIAL_CASE",
    description:
      "AI 데이터센터가 1종 항만배후단지에 입주할 수 있도록 허용하는 특례입니다.",
    conditionNote:
      "항만배후단지 입주계약은 별도로 체결해야 하며, 본 대시보드의 일반 산업단지 입주계약과 동일한 절차로 보지 않습니다.",
    affectedProcedureIds: ["port-hinterland-entry-contract"],
    officialUrl: AIDC_SPECIAL_ACT_URL,
  },
  {
    id: "ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK",
    lawName: "국가첨단전략산업 경쟁력 강화 및 보호에 관한 특별조치법",
    scopeLabel: "전략산업 특화단지",
    selectionMode: "AUTOMATIC_CONFIRMATION",
    effectiveFrom: "2023-07-01",
    qualificationKey: "advancedStrategicIndustryFastTrackConfirmed",
    shortLabel: "국가첨단전략산업 신속처리",
    title: "전략산업 특화단지 인허가 신속처리",
    article: "제19조",
    effect: "FAST_TRACK",
    description:
      "특화단지 사업시행자의 제19조제1항 열거 인허가등이 지연되어 조성·운영에 현저한 지장이 우려되는 경우, 위원회 심의·의결을 거쳐 산업통상부장관이 인허가권자에게 신속처리를 요청하는 절차입니다. 처리계획 회신·처리결과 통보의 특례 단계기한을 지키지 않은 경우에만 장관 요청일부터 60일이 지난 날 처리가 완료된 것으로 봅니다.",
    conditionNote:
      "반도체·디스플레이, 이차전지, 바이오 업종명만으로는 적용되지 않습니다. 법정 특화단지 사업시행자 지위, 인허가 지연과 현저한 지장 우려, 위원회 의결, 산업통상부장관의 실제 요청일을 모두 확인해야 하며, 제19조제1항이 열거·인용한 범위에 속하는 대상 인허가만 반영합니다.",
    affectedProcedureIds: [],
    officialUrl: ADVANCED_STRATEGIC_INDUSTRY_ACT_URL,
  },
  {
    id: "SEMICONDUCTOR_CLUSTER_PLAN_DEEMING",
    lawName: "반도체산업 경쟁력 강화 및 지원에 관한 특별법",
    scopeLabel: "반도체클러스터 조성계획",
    selectionMode: "AUTOMATIC_CONFIRMATION",
    effectiveFrom: "2026-08-11",
    qualificationKey: "semiconductorClusterPlanDeemingConfirmed",
    shortLabel: "반도체클러스터 계획승인 의제",
    title: "반도체클러스터 조성계획 승인 시 개별 인허가 의제",
    article: "제26조",
    effect: "PLAN_DEEMING",
    description:
      "산업통상부장관의 반도체클러스터 조성계획 승인·변경승인 때, 계획에 포함되고 관계기관과 필요한 사전협의·승인을 거친 법정 열거 인허가만 받은 것으로 보는 경로입니다.",
    conditionNote:
      "반도체 업종이나 특화단지 소재만으로는 적용되지 않습니다. 법정 반도체클러스터, 조성계획의 실제 승인·고시, 인허가별 서류 포함과 관계기관 사전협의·승인을 항목별로 확인해야 합니다.",
    affectedProcedureIds: semiconductorClusterPlanDeemedProcedureIds,
    officialUrl: SEMICONDUCTOR_SPECIAL_ACT_URL,
  },
  {
    id: "SEMICONDUCTOR_CLUSTER_FAST_TRACK",
    lawName: "반도체산업 경쟁력 강화 및 지원에 관한 특별법",
    scopeLabel: "반도체클러스터",
    selectionMode: "AUTOMATIC_CONFIRMATION",
    effectiveFrom: "2026-08-11",
    qualificationKey: "semiconductorClusterFastTrackConfirmed",
    shortLabel: "반도체클러스터 신속처리",
    title: "반도체클러스터 인허가 신속처리",
    article: "제27조",
    effect: "FAST_TRACK",
    description:
      "반도체클러스터 부지 조성 사업시행자 등 법정 신청자의 제26조 열거 인허가등이 지연되어 조성·운영에 현저한 지장이 우려되는 경우, 위원회 심의·의결 후 산업통상부장관이 신속처리를 요청하는 절차입니다. 처리계획 회신·처리결과 통보의 특례 단계기한을 지키지 않은 경우에만 장관 요청일로부터 60일이 지난 날 처리가 완료된 것으로 봅니다.",
    conditionNote:
      "반도체 업종·국가첨단전략산업 특화단지와 법정 반도체클러스터는 동일하지 않습니다. 법정 신청자 지위, 지연과 현저한 지장 우려, 위원회 의결, 장관의 실제 요청일을 모두 확인해야 하며, 제26조 각 호 범위에 속하는 대상 인허가만 반영합니다.",
    affectedProcedureIds: [],
    officialUrl: SEMICONDUCTOR_SPECIAL_ACT_URL,
  },
  {
    id: "INDUSTRIAL_COMPLEX_PLAN_INTEGRATED_APPROVAL",
    lawName: "산업단지 인·허가 절차 간소화를 위한 특례법",
    scopeLabel: "산업단지계획",
    selectionMode: "AUTOMATIC_CONFIRMATION",
    effectiveFrom: "2008-09-06",
    qualificationKey: "industrialComplexPlanSpecialCaseConfirmed",
    shortLabel: "산업단지계획 통합승인·의제",
    title: "산업단지계획 통합승인 및 관련 인허가 의제",
    article: "제15조·제16조 / 산업입지법 제21조",
    effect: "INTEGRATED_APPROVAL",
    description:
      "산업단지계획 승인 절차로 지정·개발계획과 실시계획을 통합 처리하고, 계획에 서류가 포함되어 관계기관과 협의된 개발행위·농지·산지·하천·공유수면·건축 등의 인허가는 실시계획 승인 시 의제될 수 있습니다. 민간기업등의 승인신청은 접수일부터 6개월 이내 승인 여부를 결정해야 합니다.",
    conditionNote:
      "기존 산업단지에 입주하는 것만으로는 적용되지 않습니다. 이번 사업이 산업단지계획의 수립·변경 승인 대상이고, 의제할 개별 인허가 서류가 계획에 포함되어 관계기관 협의를 거치는 경로인지 확인해야 합니다.",
    affectedProcedureIds: industrialComplexPlanDeemedProcedureIds,
    officialUrl: INDUSTRIAL_COMPLEX_FAST_TRACK_ACT_URL,
  },
  {
    id: "REGIONAL_SPECIAL_ZONE_PLAN_DEEMING",
    lawName: "규제자유특구 및 지역특화발전특구에 관한 규제특례법",
    scopeLabel: "지역특화발전특구",
    selectionMode: "AUTOMATIC_CONFIRMATION",
    effectiveFrom: "2019-04-17",
    qualificationKey: "regionalSpecialZonePlanDeemingConfirmed",
    shortLabel: "지역특화발전특구계획 의제",
    title: "지역특화발전특구 토지이용계획 인허가 의제",
    article: "제64조·제65조",
    effect: "PLAN_DEEMING",
    description:
      "특구토지이용계획이 포함된 특화특구계획을 승인할 때, 계획에 포함되고 관계기관과 미리 협의된 개발행위·농지·산지·하천·공유수면 등의 허가를 받은 것으로 볼 수 있습니다.",
    conditionNote:
      "해당 시·군에 특구가 있다는 사실만으로는 적용되지 않습니다. 사업이 승인 대상 특화특구계획에 포함되고, 의제할 인허가 서류가 계획에 반영되어 관계기관 사전협의를 거치는지를 확인해야 합니다. 규제자유특구 지정 자체의 일반 면제로 보지 않습니다.",
    affectedProcedureIds: regionalSpecialZoneDeemedProcedureIds,
    officialUrl: REGIONAL_SPECIAL_ZONE_ACT_URL,
  },
] as const;

type SpecialLawScenario = {
  assessmentDate: string;
  province: string;
  insideIndustrialComplex: boolean | null;
  industryCategory: string;
  aiDataCenterActFacilityConfirmed: boolean | null;
  aiDataCenterOneStopStatus: "NOT_APPLIED" | "PLANNED" | "IN_PROGRESS" | "COMPLETED";
  appliedSpecialLawIds: readonly AiDataCenterSpecialLawId[];
  advancedStrategicIndustryFastTrackConfirmed: boolean | null;
  advancedStrategicIndustryApplicantRoleConfirmed: boolean | null;
  advancedStrategicIndustryDelayRiskConfirmed: boolean | null;
  advancedStrategicIndustryCommitteeResolved: boolean | null;
  advancedStrategicIndustryMinisterRequestDate: string | null;
  advancedStrategicIndustryFastTrackPermitIds: readonly string[];
  semiconductorClusterFastTrackConfirmed: boolean | null;
  semiconductorClusterApplicantRoleConfirmed: boolean | null;
  semiconductorClusterDelayRiskConfirmed: boolean | null;
  semiconductorClusterCommitteeResolved: boolean | null;
  semiconductorClusterMinisterRequestDate: string | null;
  semiconductorClusterFastTrackPermitIds: readonly string[];
  semiconductorClusterPlanDeemingConfirmed: boolean | null;
  semiconductorClusterPlanDocumentsIncluded: boolean | null;
  semiconductorClusterPlanConsultationCompleted: boolean | null;
  semiconductorClusterPlanApprovalPublished: boolean | null;
  semiconductorClusterPlanApprovalPublishedDate: string | null;
  semiconductorClusterPlanApprovalNoticeReference: string;
  semiconductorClusterPlanIncludedPermitIds: readonly string[];
  industrialComplexPlanSpecialCaseConfirmed: boolean | null;
  industrialComplexPlanDocumentsIncluded: boolean | null;
  industrialComplexPlanConsultationCompleted: boolean | null;
  industrialComplexPlanApprovalPublished: boolean | null;
  industrialComplexPlanApprovalPublishedDate: string | null;
  industrialComplexPlanApprovalNoticeReference: string;
  industrialComplexPlanIncludedPermitIds: readonly string[];
  regionalSpecialZonePlanDeemingConfirmed: boolean | null;
  regionalSpecialZonePlanDocumentsIncluded: boolean | null;
  regionalSpecialZonePlanConsultationCompleted: boolean | null;
  regionalSpecialZonePlanApprovalPublished: boolean | null;
  regionalSpecialZonePlanApprovalPublishedDate: string | null;
  regionalSpecialZonePlanApprovalNoticeReference: string;
  regionalSpecialZonePlanIncludedPermitIds: readonly string[];
};

const advancedStrategicIndustryCandidateIdSet: ReadonlySet<string> = new Set(
  advancedStrategicIndustryCandidateIds,
);
const semiconductorClusterCandidateIndustryIdSet: ReadonlySet<string> = new Set(
  semiconductorClusterCandidateIndustryIds,
);

export function getAiDataCenterSpecialLawDefinitions() {
  return specialLawDefinitions.filter(
    (item) => item.selectionMode === "MANUAL",
  );
}

export function getAutomaticSpecialLawDefinitions(
  answers: Pick<
    SpecialLawScenario,
    "province" | "insideIndustrialComplex" | "industryCategory"
  >,
) {
  return specialLawDefinitions.filter((definition) => {
    if (definition.selectionMode !== "AUTOMATIC_CONFIRMATION") return false;
    if (definition.id === "ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK") {
      return advancedStrategicIndustryCandidateIdSet.has(answers.industryCategory);
    }
    if (definition.id === "SEMICONDUCTOR_CLUSTER_FAST_TRACK") {
      return semiconductorClusterCandidateIndustryIdSet.has(answers.industryCategory);
    }
    if (definition.id === "SEMICONDUCTOR_CLUSTER_PLAN_DEEMING") {
      return semiconductorClusterCandidateIndustryIdSet.has(answers.industryCategory);
    }
    if (definition.id === "INDUSTRIAL_COMPLEX_PLAN_INTEGRATED_APPROVAL") {
      // 산업단지계획은 기존 산단 입주기업뿐 아니라 신규 지정·계획변경
      // 사업시행자도 사용할 수 있는 경로이므로 소재 여부로 후보를 막지 않는다.
      return Boolean(answers.province.trim());
    }
    if (definition.id === "REGIONAL_SPECIAL_ZONE_PLAN_DEEMING") {
      return Boolean(answers.province.trim());
    }
    return false;
  });
}

export function getSpecialLawDefinition(id: SpecialLawId) {
  return specialLawDefinitions.find((item) => item.id === id) ?? null;
}

export function evaluateSelectedSpecialLaws(
  answers: SpecialLawScenario,
): SpecialLawEvaluation[] {
  const evaluations: SpecialLawEvaluation[] = [];
  for (const id of answers.appliedSpecialLawIds) {
    const definition = getSpecialLawDefinition(id);
    if (!definition) continue;
    if (answers.industryCategory !== AI_DATA_CENTER_INDUSTRY_ID) {
      evaluations.push({
        ...definition,
        status: "MISMATCH",
        statusLabel: "업종 불일치",
        statusNote: "AI 데이터센터 업종에서만 적용할 수 있어 절차 판정에는 반영하지 않았습니다.",
      });
      continue;
    }
    if (answers.assessmentDate < AI_DATA_CENTER_SPECIAL_ACT_EFFECTIVE_DATE) {
      evaluations.push({
        ...definition,
        status: "FUTURE",
        statusLabel: "시행 전",
        statusNote: `법 시행일 ${AI_DATA_CENTER_SPECIAL_ACT_EFFECTIVE_DATE} 전이므로 현재 절차를 면제하거나 대체하지 않습니다.`,
      });
      continue;
    }
    if (answers.aiDataCenterActFacilityConfirmed !== true) {
      evaluations.push({
        ...definition,
        status:
          answers.aiDataCenterActFacilityConfirmed === false
            ? "MISMATCH"
            : "UNCONFIRMED",
        statusLabel:
          answers.aiDataCenterActFacilityConfirmed === false
            ? "시설요건 미해당"
            : "요건 확인 필요",
        statusNote:
          answers.aiDataCenterActFacilityConfirmed === false
            ? "특별법상 AI 데이터센터 인정요건에 미해당으로 입력되어 절차 판정에는 반영하지 않았습니다."
            : "대통령령상 AI 데이터센터 인정요건 확인값이 없어 절차를 면제하거나 대체하지 않았습니다.",
      });
      continue;
    }
    if (
      definition.id === "AIDC_ONE_STOP" &&
      answers.aiDataCenterOneStopStatus === "NOT_APPLIED"
    ) {
      evaluations.push({
        ...definition,
        status: "UNCONFIRMED",
        statusLabel: "진행상태 확인 필요",
        statusNote: "일괄처리 특례는 선택되었지만 신청·심사·완료 상태가 입력되지 않아 절차 판정에 반영하지 않았습니다.",
      });
      continue;
    }
    const oneStopStatusNote =
      definition.id !== "AIDC_ONE_STOP"
        ? null
        : answers.aiDataCenterOneStopStatus === "COMPLETED"
          ? "일괄처리를 받은 상태로 입력되어 제10조제2항의 신고 의제를 반영합니다."
          : answers.aiDataCenterOneStopStatus === "IN_PROGRESS"
            ? "일괄처리 심사 중으로 입력되었습니다. 완료 전에는 AI 데이터센터 신고 의제가 성립하지 않습니다."
            : "일괄처리 신청 예정으로 입력되었습니다. 완료 전에는 AI 데이터센터 신고 의제가 성립하지 않습니다.";
    evaluations.push({
      ...definition,
      status: "ACTIVE",
      statusLabel: "선택 반영",
      statusNote:
        oneStopStatusNote ??
        (definition.affectedProcedureIds.length
          ? "사용자가 특별법상 시설 인정요건과 개별 특례요건 충족을 확인한 값으로 절차 판정에 반영했습니다."
          : "사용자가 적용요건 충족을 확인한 입지 특례로 표시합니다. 별도 인허가 면제는 적용하지 않습니다."),
    });
  }

  for (const definition of getAutomaticSpecialLawDefinitions(answers)) {
    const qualificationKey = definition.qualificationKey;
    if (!qualificationKey) continue;
    const confirmed = answers[qualificationKey];
    if (confirmed === false) continue;
    if (
      definition.effectiveFrom &&
      answers.assessmentDate < definition.effectiveFrom
    ) {
      evaluations.push({
        ...definition,
        status: "FUTURE",
        statusLabel: "시행 전",
        statusNote: `이 특례의 시행일 ${definition.effectiveFrom} 전이므로 현재 인허가 판정에는 반영하지 않았습니다.`,
      });
      continue;
    }
    if (confirmed !== true) {
      evaluations.push({
        ...definition,
        status: "UNCONFIRMED",
        statusLabel: "요건 확인 필요",
        statusNote:
          "업종·지역·산업단지 입력으로 검토 후보를 자동 표시했습니다. 사업시행자 지위, 승인계획 포함, 신속처리 요청 또는 관계기관 사전협의 요건이 확인되기 전에는 절차를 면제하거나 일정을 줄이지 않습니다.",
      });
      continue;
    }

    const fastTrackChecklist =
      definition.id === "ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK"
        ? {
            role: answers.advancedStrategicIndustryApplicantRoleConfirmed,
            delay: answers.advancedStrategicIndustryDelayRiskConfirmed,
            committee: answers.advancedStrategicIndustryCommitteeResolved,
            requestDate: answers.advancedStrategicIndustryMinisterRequestDate,
            includedCount: answers.advancedStrategicIndustryFastTrackPermitIds.length,
          }
        : definition.id === "SEMICONDUCTOR_CLUSTER_FAST_TRACK"
          ? {
              role: answers.semiconductorClusterApplicantRoleConfirmed,
              delay: answers.semiconductorClusterDelayRiskConfirmed,
              committee: answers.semiconductorClusterCommitteeResolved,
              requestDate: answers.semiconductorClusterMinisterRequestDate,
              includedCount: answers.semiconductorClusterFastTrackPermitIds.length,
            }
          : null;
    if (
      fastTrackChecklist &&
      (fastTrackChecklist.role !== true ||
        fastTrackChecklist.delay !== true ||
        fastTrackChecklist.committee !== true ||
        fastTrackChecklist.requestDate === null ||
        (definition.effectiveFrom !== undefined &&
          fastTrackChecklist.requestDate < definition.effectiveFrom) ||
        fastTrackChecklist.requestDate > answers.assessmentDate ||
        fastTrackChecklist.includedCount === 0)
    ) {
      const missing = [
        ...(fastTrackChecklist.role === true ? [] : ["법정 신청자·사업시행자 지위"]),
        ...(fastTrackChecklist.delay === true ? [] : ["인허가 지연·현저한 지장 우려"]),
        ...(fastTrackChecklist.committee === true ? [] : ["위원회 심의·의결"]),
        ...(fastTrackChecklist.requestDate
          ? definition.effectiveFrom &&
            fastTrackChecklist.requestDate < definition.effectiveFrom
            ? [`법 시행일(${definition.effectiveFrom}) 이후의 장관 요청일`]
            : fastTrackChecklist.requestDate > answers.assessmentDate
              ? ["검토 기준일까지 실제로 도래한 장관 요청일"]
              : []
          : ["산업통상부장관의 인허가권자 요청일"]),
        ...(fastTrackChecklist.includedCount > 0 ? [] : ["신속처리 요청 공문에 포함된 인허가"]),
      ];
      evaluations.push({
        ...definition,
        status: "UNCONFIRMED",
        statusLabel: "신속처리 증빙 필요",
        statusNote: `${missing.join(" · ")}가 확인되지 않아 신속처리 절차와 60일 조건을 적용하지 않았습니다.`,
      });
      continue;
    }

    const deemingChecklist =
      definition.id === "INDUSTRIAL_COMPLEX_PLAN_INTEGRATED_APPROVAL"
        ? {
            documents: answers.industrialComplexPlanDocumentsIncluded,
            consultation: answers.industrialComplexPlanConsultationCompleted,
            approvalPublished: answers.industrialComplexPlanApprovalPublished,
            approvalPublishedDate: answers.industrialComplexPlanApprovalPublishedDate,
            approvalNoticeReference: answers.industrialComplexPlanApprovalNoticeReference,
            includedCount: filterPlanDeemedProcedureIds(
              "INDUSTRIAL_COMPLEX_PLAN_INTEGRATED_APPROVAL",
              answers.industrialComplexPlanIncludedPermitIds,
            ).length,
          }
        : definition.id === "SEMICONDUCTOR_CLUSTER_PLAN_DEEMING"
          ? {
              documents: answers.semiconductorClusterPlanDocumentsIncluded,
              consultation: answers.semiconductorClusterPlanConsultationCompleted,
              approvalPublished: answers.semiconductorClusterPlanApprovalPublished,
              approvalPublishedDate: answers.semiconductorClusterPlanApprovalPublishedDate,
              approvalNoticeReference: answers.semiconductorClusterPlanApprovalNoticeReference,
              includedCount: filterPlanDeemedProcedureIds(
                "SEMICONDUCTOR_CLUSTER_PLAN_DEEMING",
                answers.semiconductorClusterPlanIncludedPermitIds,
              ).length,
            }
        : definition.id === "REGIONAL_SPECIAL_ZONE_PLAN_DEEMING"
          ? {
              documents: answers.regionalSpecialZonePlanDocumentsIncluded,
              consultation: answers.regionalSpecialZonePlanConsultationCompleted,
              approvalPublished: answers.regionalSpecialZonePlanApprovalPublished,
              approvalPublishedDate: answers.regionalSpecialZonePlanApprovalPublishedDate,
              approvalNoticeReference: answers.regionalSpecialZonePlanApprovalNoticeReference,
              includedCount: filterPlanDeemedProcedureIds(
                "REGIONAL_SPECIAL_ZONE_PLAN_DEEMING",
                answers.regionalSpecialZonePlanIncludedPermitIds,
              ).length,
            }
          : null;
    if (
      deemingChecklist &&
      (deemingChecklist.documents !== true ||
        deemingChecklist.consultation !== true ||
        deemingChecklist.approvalPublished !== true ||
        deemingChecklist.approvalPublishedDate === null ||
        (definition.effectiveFrom !== undefined &&
          deemingChecklist.approvalPublishedDate < definition.effectiveFrom) ||
        deemingChecklist.approvalPublishedDate > answers.assessmentDate ||
        deemingChecklist.approvalNoticeReference.trim().length === 0 ||
        deemingChecklist.includedCount === 0)
    ) {
      const missing = [
        ...(deemingChecklist.documents === true ? [] : ["의제별 법정서류의 상위 계획 반영"]),
        ...(deemingChecklist.consultation === true ? [] : ["관계기관 협의 완료"]),
        ...(deemingChecklist.approvalPublished === true
          ? []
          : ["계획 승인·고시 완료"]),
        ...(deemingChecklist.approvalPublishedDate
          ? definition.effectiveFrom &&
            deemingChecklist.approvalPublishedDate < definition.effectiveFrom
            ? [`법 시행일(${definition.effectiveFrom}) 이후의 승인·고시일`]
            : deemingChecklist.approvalPublishedDate > answers.assessmentDate
              ? ["검토 기준일까지 도래한 승인·고시일"]
              : []
          : ["승인·고시일"]),
        ...(deemingChecklist.approvalNoticeReference.trim()
          ? []
          : ["승인·고시문 번호 또는 공식 URL"]),
        ...(deemingChecklist.includedCount > 0
          ? []
          : ["실제 의제대상 인허가 항목 선택"]),
      ];
      evaluations.push({
        ...definition,
        status: "UNCONFIRMED",
        statusLabel: "의제요건 확인 필요",
        statusNote: `${missing.join(" · ")}가 확인되지 않아 개별 인허가를 면제·의제 처리하지 않았습니다. 계획승인 후보 경로만 검토하세요.`,
      });
      continue;
    }

    const statusNoteById: Partial<Record<SpecialLawId, string>> = {
      ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK:
        "전략산업 특화단지 사업시행자와 산업통상부장관의 신속처리 요청 대상임을 확인한 입력으로 관련 절차에 신속처리 경로를 표시합니다. 요청목록에 포함되지 않은 개별 인허가에는 적용되지 않습니다. 처리계획 회신일·처리결과 통지일·연장 요청 및 사유는 별도 증빙이 없어 일정과 처리완료 의제를 자동 확정하지 않습니다.",
      SEMICONDUCTOR_CLUSTER_FAST_TRACK:
        "반도체클러스터 사업시행자와 산업통상부장관의 신속처리 요청 대상임을 확인한 입력으로 관련 절차에 신속처리 경로를 표시합니다. 요청목록에 포함되지 않은 개별 인허가에는 적용되지 않습니다. 처리계획 회신일·처리결과 통지일·연장 요청 및 사유는 별도 증빙이 없어 일정과 처리완료 의제를 자동 확정하지 않습니다.",
      SEMICONDUCTOR_CLUSTER_PLAN_DEEMING:
        "반도체클러스터 조성계획의 승인·고시, 인허가별 서류 포함과 관계기관 사전협의·승인을 확인한 항목만 계획승인 의제로 표시합니다.",
      INDUSTRIAL_COMPLEX_PLAN_INTEGRATED_APPROVAL:
        "산업단지계획 승인 대상과 의제서류 포함·관계기관 협의 경로를 확인한 입력으로 통합승인·의제 가능성을 표시합니다. 기존 산업단지 입주만으로 개별 인허가가 면제되는 것은 아닙니다.",
      REGIONAL_SPECIAL_ZONE_PLAN_DEEMING:
        "승인 대상 특화특구계획에 사업과 의제서류가 포함되고 관계기관 사전협의를 거치는 경로를 확인한 입력으로 계획승인 의제를 표시합니다. 지역 소재지만으로 적용한 결과가 아닙니다.",
    };
    evaluations.push({
      ...definition,
      status: "ACTIVE",
      statusLabel: "요건 확인",
      statusNote:
        statusNoteById[definition.id] ??
        "법정 적용요건을 확인한 입력으로 특례 검토 결과에 반영했습니다.",
    });
  }
  return evaluations;
}

const oneStopCaps: Record<string, string> = {
  "power-grid-impact-assessment": "관계기관 요청 다음 날부터 150일 이내",
  "energy-use-plan-consultation": "관계기관 요청 다음 날부터 90일 이내",
  "traffic-impact-assessment": "관계기관 요청 다음 날부터 90일 이내",
  "landscape-review": "관계기관 요청 다음 날부터 90일 이내",
  "building-committee-review": "관계기관 요청 다음 날부터 90일 이내",
  "building-permit": "관계기관 요청 다음 날부터 40일 이내",
  "fire-building-permit-consent": "관계기관 요청 다음 날부터 40일 이내",
};

const effectLabels: Record<SpecialLawEffect, string> = {
  ONE_STOP: "일괄처리",
  EXEMPTION: "특례 면제",
  DEEMED_REPORT: "신고 의제",
  STANDARD_RELAXATION: "규모 산정 특례",
  LOCATION_SPECIAL_CASE: "입지 특례",
  FAST_TRACK: "신속처리",
  INTEGRATED_APPROVAL: "통합승인·의제",
  PLAN_DEEMING: "계획승인 의제",
};

const citationIdsByLaw: Record<SpecialLawId, string[]> = {
  AIDC_ONE_STOP: ["cit-aidc-special-act-18", "cit-aidc-special-act-18-9"],
  AIDC_GRID_IMPACT_EXEMPTION: ["cit-aidc-special-act-19"],
  AIDC_BUILDING_STANDARDS: ["cit-aidc-special-act-21"],
  AIDC_INDUSTRIAL_COMPLEX_LOCATION: ["cit-aidc-special-act-22"],
  AIDC_PORT_HINTERLAND_ENTRY: ["cit-aidc-special-act-23"],
  ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK: [
    "cit-advanced-strategic-industry-act-19-applicability",
    "cit-advanced-strategic-industry-act-19-deeming",
    "cit-advanced-strategic-industry-decree-30",
  ],
  SEMICONDUCTOR_CLUSTER_FAST_TRACK: [
    "cit-semiconductor-special-act-27-applicability",
    "cit-semiconductor-special-act-27-deeming",
  ],
  SEMICONDUCTOR_CLUSTER_PLAN_DEEMING: [
    "cit-semiconductor-special-act-26-deeming",
  ],
  INDUSTRIAL_COMPLEX_PLAN_INTEGRATED_APPROVAL: [
    "cit-industrial-complex-fast-track-act-15",
    "cit-industrial-complex-fast-track-act-16",
    "cit-industrial-location-act-21",
  ],
  REGIONAL_SPECIAL_ZONE_PLAN_DEEMING: [
    "cit-regional-special-zone-act-64-65",
  ],
};

const statutoryCapsByLaw: Partial<Record<SpecialLawId, string>> = {
  ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK:
    "장관 요청 후 처리계획 15일(보완기간 제외, 늦어도 30일) · 계획 제출 후 결과 15일(불가피한 경우 1회 15일 연장) · 해당 단계 기한 미준수 시에만 장관 요청일부터 60일 경과일에 처리 완료로 봄 · 허가 승인으로 단정하지 않음",
  SEMICONDUCTOR_CLUSTER_FAST_TRACK:
    "장관 요청 후 처리계획 15일(보완기간 제외, 늦어도 30일) · 계획 제출 후 결과 15일(불가피한 경우 1회 15일 연장) · 해당 단계 기한 미준수 시에만 장관 요청일부터 60일 경과일에 처리 완료로 봄 · 허가 승인으로 단정하지 않음",
  INDUSTRIAL_COMPLEX_PLAN_INTEGRATED_APPROVAL:
    "민간기업등의 산업단지계획 승인신청 접수일부터 6개월 이내 승인 여부 결정 · 개별 의제는 서류 포함과 관계기관 협의 전제 · 일반 일정 자동 단축 없음",
};

export function specialLawImpactsForProcedure(
  answers: SpecialLawScenario,
  procedure: Pick<Procedure, "id" | "actionType" | "domain">,
): SpecialLawImpact[] {
  const procedureId = procedure.id;
  return evaluateSelectedSpecialLaws(answers).flatMap((evaluation) => {
    if (
      (evaluation.id === "ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK" ||
        evaluation.id === "SEMICONDUCTOR_CLUSTER_FAST_TRACK") &&
      !isFastTrackTargetProcedure(evaluation.id, procedure)
    ) return [];
    const affectedProcedureIds =
      evaluation.id === "ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK"
        ? answers.advancedStrategicIndustryFastTrackPermitIds
        : evaluation.id === "SEMICONDUCTOR_CLUSTER_FAST_TRACK"
          ? answers.semiconductorClusterFastTrackPermitIds
          : evaluation.affectedProcedureIds;
    if (!affectedProcedureIds.includes(procedureId)) return [];
    if (
      evaluation.id === "INDUSTRIAL_COMPLEX_PLAN_INTEGRATED_APPROVAL" &&
      !answers.industrialComplexPlanIncludedPermitIds.includes(procedureId)
    ) return [];
    if (
      evaluation.id === "SEMICONDUCTOR_CLUSTER_PLAN_DEEMING" &&
      !answers.semiconductorClusterPlanIncludedPermitIds.includes(procedureId)
    ) return [];
    if (
      evaluation.id === "REGIONAL_SPECIAL_ZONE_PLAN_DEEMING" &&
      !answers.regionalSpecialZonePlanIncludedPermitIds.includes(procedureId)
    ) return [];
    if (
      evaluation.selectionMode === "AUTOMATIC_CONFIRMATION" &&
      evaluation.status !== "ACTIVE"
    ) {
      return [];
    }
    const isReportDeemed =
      evaluation.id === "AIDC_ONE_STOP" &&
      procedureId === "ai-data-center-business-report" &&
      answers.aiDataCenterOneStopStatus === "COMPLETED" &&
      evaluation.status === "ACTIVE";
    const effect = isReportDeemed ? "DEEMED_REPORT" : evaluation.effect;
    return [{
      lawId: evaluation.id,
      lawTitle: evaluation.title,
      article: evaluation.article,
      effect,
      effectLabel:
        evaluation.status === "ACTIVE"
          ? effectLabels[effect]
          : `${effectLabels[effect]} 검토`,
      status: evaluation.status,
      statusLabel: evaluation.statusLabel,
      description: isReportDeemed
        ? "제18조에 따른 일괄처리를 받은 경우 제10조제1항의 AI 데이터센터 신고를 한 것으로 봅니다."
        : evaluation.id === "AIDC_ONE_STOP" && procedureId === "ai-data-center-business-report"
          ? "일괄처리를 받은 경우에만 별도 신고 제출을 생략할 수 있습니다. 신청 예정·심사 중에는 신고 의제가 성립하지 않습니다."
        : evaluation.description,
      ...(evaluation.id === "AIDC_ONE_STOP" && oneStopCaps[procedureId]
        ? { statutoryCap: `${oneStopCaps[procedureId]} · 주민의견 청취 또는 특별사유 시 1회 30일 이내 연장 가능(관련 법률이 의견청취를 포함한 처리기간을 정한 경우 제외) · 기한 내 거부 통지가 없으면 기한 종료 다음 날 해당 인허가등 처리 완료 의제` }
        : statutoryCapsByLaw[evaluation.id]
          ? { statutoryCap: statutoryCapsByLaw[evaluation.id] }
          : {}),
      citationIds:
        evaluation.id === "AIDC_ONE_STOP" &&
        procedureId === "ai-data-center-business-report"
        ? ["cit-aidc-special-act-10-2", "cit-aidc-special-act-18"]
        : citationIdsByLaw[evaluation.id],
      officialUrl: evaluation.officialUrl,
    }];
  });
}

export const specialLawLegalSources: LegalSource[] = [
  {
    id: "src-aidc-special-act-20270310",
    title: "인공지능 데이터센터 산업 진흥에 관한 특별법",
    documentType: "ACT",
    issuingAuthority: "과학기술정보통신부",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: "015145",
    mst: "286707",
    proclamationDate: "2026-06-09",
    proclamationNumber: "21759",
    effectiveDate: AI_DATA_CENTER_SPECIAL_ACT_EFFECTIVE_DATE,
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-21",
    contentHash: "official-final-text-286707",
    officialUrl: AIDC_SPECIAL_ACT_URL,
    status: "AUTHORITATIVE",
  },
  {
    id: "src-port-act-20260227",
    title: "항만법",
    documentType: "ACT",
    issuingAuthority: "해양수산부",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: "001737",
    mst: "283707",
    proclamationDate: "2026-02-27",
    proclamationNumber: "21415",
    effectiveDate: "2026-02-27",
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-21",
    contentHash: "official-text-283707-article-71",
    officialUrl: PORT_ACT_URL,
    status: "AUTHORITATIVE",
  },
  {
    id: "src-port-act-decree-20260701",
    title: "항만법 시행령",
    documentType: "ENFORCEMENT_DECREE",
    issuingAuthority: "해양수산부",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: "005528",
    mst: "287353",
    proclamationDate: "2026-06-23",
    proclamationNumber: "36439",
    effectiveDate: "2026-07-01",
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-21",
    contentHash: "official-text-287353-article-72",
    officialUrl: PORT_ACT_DECREE_URL,
    status: "AUTHORITATIVE",
  },
  {
    id: "src-industrial-cluster-enforcement-rule-20260409",
    title: "산업집적활성화 및 공장설립에 관한 법률 시행규칙",
    documentType: "ENFORCEMENT_RULE",
    issuingAuthority: "산업통상부",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: "006335",
    mst: "285509",
    proclamationDate: "2026-04-09",
    proclamationNumber: "11",
    effectiveDate: "2026-04-09",
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-21",
    contentHash: "official-text-285509-articles-34-35",
    officialUrl: INDUSTRIAL_CLUSTER_ENFORCEMENT_RULE_URL,
    status: "AUTHORITATIVE",
  },
  {
    id: "src-civil-petitions-act-20220712",
    title: "민원 처리에 관한 법률",
    documentType: "ACT",
    issuingAuthority: "행정안전부",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: "001359",
    mst: "239293",
    proclamationDate: "2022-01-11",
    proclamationNumber: "18748",
    effectiveDate: "2022-07-12",
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-21",
    contentHash: "official-text-239293-article-19",
    officialUrl: CIVIL_PETITIONS_ACT_URL,
    status: "AUTHORITATIVE",
  },
  {
    id: "src-civil-petitions-enforcement-decree-current",
    title: "민원 처리에 관한 법률 시행령",
    documentType: "ENFORCEMENT_DECREE",
    issuingAuthority: "행정안전부",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: null,
    mst: null,
    proclamationDate: null,
    proclamationNumber: null,
    effectiveDate: null,
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-22",
    contentHash: "official-current-article-20-review-20260822",
    officialUrl: CIVIL_PETITIONS_ENFORCEMENT_DECREE_URL,
    status: "AUTHORITATIVE",
  },
  {
    id: "src-administrative-procedure-enforcement-decree-current",
    title: "행정절차법 시행령",
    documentType: "ENFORCEMENT_DECREE",
    issuingAuthority: "행정안전부",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: null,
    mst: null,
    proclamationDate: null,
    proclamationNumber: null,
    effectiveDate: null,
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-22",
    contentHash: "official-current-article-11-review-20260822",
    officialUrl: ADMINISTRATIVE_PROCEDURE_ENFORCEMENT_DECREE_URL,
    status: "AUTHORITATIVE",
  },
  {
    id: "src-advanced-strategic-industry-act-20260602",
    title: "국가첨단전략산업 경쟁력 강화 및 보호에 관한 특별조치법",
    documentType: "ACT",
    issuingAuthority: "산업통상부",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: "014238",
    mst: null,
    proclamationDate: "2026-06-02",
    proclamationNumber: "21738",
    effectiveDate: "2026-06-02",
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-21",
    contentHash: "official-current-law-id-014238-review-20260821",
    officialUrl: ADVANCED_STRATEGIC_INDUSTRY_ACT_URL,
    status: "AUTHORITATIVE",
  },
  {
    id: "src-advanced-strategic-industry-decree-20260201",
    title: "국가첨단전략산업 경쟁력 강화 및 보호에 관한 특별조치법 시행령",
    documentType: "ENFORCEMENT_DECREE",
    issuingAuthority: "산업통상부",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: "014320",
    mst: "282935",
    proclamationDate: "2026-01-27",
    proclamationNumber: "36055",
    effectiveDate: "2026-02-01",
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-21",
    contentHash: "official-text-282935",
    officialUrl: ADVANCED_STRATEGIC_INDUSTRY_DECREE_URL,
    status: "AUTHORITATIVE",
  },
  {
    id: "src-semiconductor-special-act-20260811",
    title: "반도체산업 경쟁력 강화 및 지원에 관한 특별법",
    documentType: "ACT",
    issuingAuthority: "산업통상부",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: "015044",
    mst: "286559",
    proclamationDate: "2026-06-02",
    proclamationNumber: "21738",
    effectiveDate: "2026-08-11",
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-21",
    contentHash: "official-text-286559",
    officialUrl: SEMICONDUCTOR_SPECIAL_ACT_URL,
    status: "AUTHORITATIVE",
  },
  {
    id: "src-semiconductor-special-rule-20260811",
    title: "반도체산업 경쟁력 강화 및 지원에 관한 특별법 시행규칙",
    documentType: "ENFORCEMENT_RULE",
    issuingAuthority: "산업통상부",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: null,
    mst: "288757",
    proclamationDate: "2026-08-11",
    proclamationNumber: "19",
    effectiveDate: "2026-08-11",
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-22",
    contentHash: "official-forms-1-3-review-20260822",
    officialUrl: SEMICONDUCTOR_SPECIAL_RULE_URL,
    status: "AUTHORITATIVE",
  },
  {
    id: "src-advanced-strategic-industry-rule-20251001",
    title: "국가첨단전략산업 경쟁력 강화 및 보호에 관한 특별조치법 시행규칙",
    documentType: "ENFORCEMENT_RULE",
    issuingAuthority: "산업통상부",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: null,
    mst: null,
    proclamationDate: "2025-10-01",
    proclamationNumber: null,
    effectiveDate: "2025-10-01",
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-22",
    contentHash: "official-form-9-review-20260822",
    officialUrl: ADVANCED_STRATEGIC_INDUSTRY_RULE_URL,
    status: "AUTHORITATIVE",
  },
  {
    id: "src-industrial-complex-fast-track-act-20251001",
    title: "산업단지 인·허가 절차 간소화를 위한 특례법",
    documentType: "ACT",
    issuingAuthority: "국토교통부",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: null,
    mst: "276999",
    proclamationDate: "2025-10-01",
    proclamationNumber: "21065",
    effectiveDate: "2025-10-01",
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-21",
    contentHash: "official-text-276999",
    officialUrl: INDUSTRIAL_COMPLEX_FAST_TRACK_ACT_URL,
    status: "AUTHORITATIVE",
  },
  {
    id: "src-industrial-complex-fast-track-decree-20240730",
    title: "산업단지 인·허가 절차 간소화를 위한 특례법 시행령",
    documentType: "ENFORCEMENT_DECREE",
    issuingAuthority: "국토교통부",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: null,
    mst: "264497",
    proclamationDate: "2024-07-30",
    proclamationNumber: "34785",
    effectiveDate: "2024-07-30",
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-22",
    contentHash: "official-text-264497-article-11",
    officialUrl: INDUSTRIAL_COMPLEX_FAST_TRACK_DECREE_URL,
    status: "AUTHORITATIVE",
  },
  {
    id: "src-industrial-location-act-20260102",
    title: "산업입지 및 개발에 관한 법률",
    documentType: "ACT",
    issuingAuthority: "국토교통부",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: null,
    mst: "277001",
    proclamationDate: "2025-10-01",
    proclamationNumber: "21065",
    effectiveDate: "2026-01-02",
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-21",
    contentHash: "official-text-277001",
    officialUrl: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=277001",
    status: "AUTHORITATIVE",
  },
  {
    id: "src-regional-special-zone-act-20260701",
    title: "규제자유특구 및 지역특화발전특구에 관한 규제특례법",
    documentType: "ACT",
    issuingAuthority: "중소벤처기업부",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: "009641",
    mst: "281979",
    proclamationDate: "2025-12-30",
    proclamationNumber: "21285",
    effectiveDate: "2026-07-01",
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-21",
    contentHash: "official-text-281979",
    officialUrl: REGIONAL_SPECIAL_ZONE_ACT_URL,
    status: "AUTHORITATIVE",
  },
  {
    id: "src-regional-special-zone-decree-current",
    title: "규제자유특구 및 지역특화발전특구에 관한 규제특례법 시행령",
    documentType: "ENFORCEMENT_DECREE",
    issuingAuthority: "중소벤처기업부",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: "009762",
    mst: null,
    proclamationDate: "2026-06-30",
    proclamationNumber: "36479",
    effectiveDate: "2026-07-01",
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-22",
    contentHash: "official-current-law-id-009762-article-7-review-20260822",
    officialUrl: REGIONAL_SPECIAL_ZONE_DECREE_URL,
    status: "AUTHORITATIVE",
  },
  {
    id: "src-distributed-energy-act-20260603",
    title: "분산에너지 활성화 특별법",
    documentType: "ACT",
    issuingAuthority: "기후에너지환경부",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: "014457",
    mst: "280059",
    proclamationDate: "2025-12-02",
    proclamationNumber: "21161",
    effectiveDate: "2026-06-03",
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-21",
    contentHash: "official-text-280059",
    officialUrl:
      "https://www.law.go.kr/LSW/lsInfoP.do?ancYnChk=0&chrClsCd=010202&efYd=20260603&lsiSeq=280059&urlMode=lsInfoP",
    status: "AUTHORITATIVE",
  },
  {
    id: "src-distributed-energy-decree-current",
    title: "분산에너지 활성화 특별법 시행령",
    documentType: "ENFORCEMENT_DECREE",
    issuingAuthority: "기후에너지환경부",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: null,
    mst: "286299",
    proclamationDate: null,
    proclamationNumber: null,
    effectiveDate: null,
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-22",
    contentHash: "official-text-286299-article-29-review-20260822",
    officialUrl: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=286299",
    status: "AUTHORITATIVE",
  },
  {
    id: "src-grid-impact-pilot-operation-2026",
    title: "전력계통영향평가 시범운영 절차 변경 공고",
    documentType: "NOTICE",
    issuingAuthority: "기후에너지환경부",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: null,
    mst: null,
    proclamationDate: null,
    proclamationNumber: null,
    effectiveDate: null,
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-22",
    contentHash: "official-notice-grid-impact-pilot-review-20260822",
    officialUrl:
      "https://www.mcee.go.kr/home/mob/board/read.do?boardId=1824110&boardMasterId=39&menuId=10524",
    status: "AUTHORITATIVE",
  },
  {
    id: "src-landscape-act-20251001",
    title: "경관법",
    documentType: "ACT",
    issuingAuthority: "국토교통부",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: "010447",
    mst: "276931",
    proclamationDate: "2025-10-01",
    proclamationNumber: "21065",
    effectiveDate: "2025-10-01",
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-21",
    contentHash: "official-text-276931",
    officialUrl:
      "https://www.law.go.kr/LSW/lsInfoP.do?ancYnChk=0&chrClsCd=010202&efYd=20251001&lsiSeq=276931&urlMode=lsInfoP",
    status: "AUTHORITATIVE",
  },
  {
    id: "src-landscape-review-guideline-current",
    title: "경관 심의 운영 지침",
    documentType: "ADMINISTRATIVE_RULE",
    issuingAuthority: "국토교통부",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: null,
    mst: null,
    proclamationDate: null,
    proclamationNumber: null,
    effectiveDate: null,
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-22",
    contentHash: "official-landscape-review-guideline-review-20260822",
    officialUrl:
      "https://www.law.go.kr/LSW/admRulLsInfoP.do?admRulId=43925&efYd=0",
    status: "AUTHORITATIVE",
  },
  {
    id: "src-geoje-landscape-review-guide-current",
    title: "거제시 경관위원회 심의·자문 신청 민원편람",
    documentType: "OFFICIAL_SERVICE_GUIDE",
    issuingAuthority: "거제시",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: null,
    mst: null,
    proclamationDate: null,
    proclamationNumber: null,
    effectiveDate: null,
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-22",
    contentHash: "official-geoje-landscape-guide-review-20260822",
    officialUrl:
      "https://geoje.go.kr/board/view.geoje?boardId=NMINWON&dataSid=305954475&menuCd=DOM_000008903001002000&paging=ok&startPage=1",
    status: "AUTHORITATIVE",
  },
  {
    id: "src-goyang-landscape-schedule-2026",
    title: "고양시 2026년 경관위원회 개최 일정",
    documentType: "OFFICIAL_SERVICE_GUIDE",
    issuingAuthority: "고양시",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: null,
    mst: null,
    proclamationDate: null,
    proclamationNumber: null,
    effectiveDate: "2026-01-01",
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-22",
    contentHash: "official-goyang-landscape-schedule-2026-review-20260822",
    officialUrl:
      "https://www.goyang.go.kr/www/www03/www03_10/www03_10_10/www03_10_10_tab5.jsp",
    status: "AUTHORITATIVE",
  },
  {
    id: "src-guri-landscape-operation-current",
    title: "구리시 경관위원회 운영 안내",
    documentType: "OFFICIAL_SERVICE_GUIDE",
    issuingAuthority: "구리시",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: null,
    mst: null,
    proclamationDate: null,
    proclamationNumber: null,
    effectiveDate: null,
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-22",
    contentHash: "official-guri-landscape-operation-review-20260822",
    officialUrl: "https://guri.go.kr/www/contents.do?key=581",
    status: "AUTHORITATIVE",
  },
  {
    id: "src-cheongju-building-review-guide-current",
    title: "청주시 건축위원회 심의절차 민원안내",
    documentType: "OFFICIAL_SERVICE_GUIDE",
    issuingAuthority: "청주시",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: null,
    mst: null,
    proclamationDate: null,
    proclamationNumber: null,
    effectiveDate: null,
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-22",
    contentHash: "official-cheongju-building-review-guide-review-20260822",
    officialUrl:
      "https://www.cheongju.go.kr/environment/selectCffdnGudList.do?key=675&pageIndex=33&pageUnit=10&searchCnd=all",
    status: "AUTHORITATIVE",
  },
  {
    id: "src-building-act-enforcement-decree-20260728",
    title: "건축법 시행령",
    documentType: "ENFORCEMENT_DECREE",
    issuingAuthority: "국토교통부",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: "002118",
    mst: null,
    proclamationDate: "2026-07-28",
    proclamationNumber: "36541",
    effectiveDate: "2026-07-28",
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-22",
    contentHash: "official-current-article-5-7-review-20260822",
    officialUrl:
      "https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lspttninfSeq=105344",
    status: "AUTHORITATIVE",
  },
  {
    id: "src-building-act-enforcement-rule-20260227",
    title: "건축법 시행규칙",
    documentType: "ENFORCEMENT_RULE",
    issuingAuthority: "국토교통부",
    jurisdictionCode: null,
    industrialComplexId: null,
    lawId: "006191",
    mst: "283727",
    proclamationDate: "2026-02-27",
    proclamationNumber: "1567",
    effectiveDate: "2026-02-27",
    repealDate: null,
    apiRetrievedAt: null,
    internallyVerifiedAt: "2026-08-22",
    contentHash: "official-current-article-2-4-review-20260822",
    officialUrl: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=283727",
    status: "AUTHORITATIVE",
  },
];

export const specialLawCitations: LegalCitation[] = [
  {
    id: "cit-indcluster-2-1-factory-definition",
    sourceId: "src-industrial-cluster-act-20260701",
    article: "제2조",
    paragraph: "제1호",
    subparagraph: null,
    item: null,
    role: "APPLICABILITY",
    sourceVersion: "시행 2026-07-01",
    summary: "산업집적법상 공장은 제조시설과 부대시설을 갖추고 대통령령으로 정하는 제조업을 하기 위한 사업장이다.",
  },
  {
    id: "cit-building-act-4-2",
    sourceId: "src-building-act-20260227",
    article: "제4조의2",
    paragraph: "제1항·제2항",
    subparagraph: null,
    item: null,
    role: "APPLICABILITY",
    sourceVersion: "시행 2026-02-27",
    summary: "대통령령상 건축물을 건축하거나 대수선하려는 자는 건축위원회 심의를 신청하고 관할 행정청은 심의결과를 통보해야 한다.",
  },
  {
    id: "cit-landscape-act-28",
    sourceId: "src-landscape-act-20251001",
    article: "제28조",
    paragraph: "제1항",
    subparagraph: null,
    item: null,
    role: "APPLICABILITY",
    sourceVersion: "시행 2025-10-01",
    summary: "경관지구·중점경관관리구역 등 법과 지방자치단체 조례가 정한 건축물은 경관위원회 심의를 거쳐야 한다.",
  },
  {
    id: "cit-distributed-energy-act-23",
    sourceId: "src-distributed-energy-act-20260603",
    article: "제23조",
    paragraph: "제1항",
    subparagraph: null,
    item: null,
    role: "APPLICABILITY",
    sourceVersion: "시행 2026-06-03",
    summary: "전력계통영향평가 대상지역에서 대통령령상 일정 규모 이상의 전기를 사용하려는 사업자는 평가를 실시해야 한다.",
  },
  {
    id: "cit-distributed-energy-act-24-process",
    sourceId: "src-distributed-energy-act-20260603",
    article: "제24조",
    paragraph: "제1항·제4항·제5항",
    subparagraph: null,
    item: null,
    role: "AUTHORITY",
    sourceVersion: "시행 2026-06-03",
    summary: "계통영향사업자는 승인등 신청 전 평가서를 기후에너지환경부장관에게 제출하고, 장관은 전력정책심의회 심의를 거쳐 개선필요사항등을 사업자에게 통보한다.",
  },
  {
    id: "cit-distributed-energy-act-24-duration",
    sourceId: "src-distributed-energy-act-20260603",
    article: "제24조",
    paragraph: "제6항",
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "시행 2026-06-03",
    summary: "기후에너지환경부장관은 전력계통영향평가서를 접수한 날부터 3개월 이내에 개선필요사항등을 통보하여야 한다.",
  },
  {
    id: "cit-distributed-energy-decree-29-objection-duration",
    sourceId: "src-distributed-energy-decree-current",
    article: "제29조",
    paragraph: null,
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "현행 조문 확인 2026-08-22",
    summary: "사업자는 개선필요사항등을 통보받은 날부터 30일 이내 이의신청할 수 있고, 장관은 이의신청일부터 60일 이내 결과를 통보하되 부득이하면 한 차례 30일 연장할 수 있다.",
  },
  {
    id: "cit-grid-impact-pilot-operation-duration",
    sourceId: "src-grid-impact-pilot-operation-2026",
    article: "시범운영 절차",
    paragraph: null,
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "공식 공고 확인 2026-08-22",
    summary: "시범운영은 한전 공급가능 여부·여유 검토를 신청일부터 최대 90일, 정식 평가·심의·결과 회신을 평가서 제출일부터 최대 60일로 안내하며 보완기간은 제외한다.",
  },
  {
    id: "cit-landscape-guideline-review-timing",
    sourceId: "src-landscape-review-guideline-current",
    article: "경관 심의 운영 지침",
    paragraph: null,
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "현행 행정규칙 확인 2026-08-22",
    summary: "정식 경관위원회는 특별한 사유가 없으면 개최 요청일부터 30일 이내 개최한다. 지역별 사전검토·조치계획 기한은 해당 지자체 자료로 별도 확인한다.",
  },
  {
    id: "cit-geoje-landscape-review-duration",
    sourceId: "src-geoje-landscape-review-guide-current",
    article: "민원편람",
    paragraph: null,
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "공식 민원편람 확인 2026-08-22",
    summary: "거제시는 경관위원회 심의·자문 신청 처리기한을 신청일부터 30일로 안내하고 특별한 사유가 없으면 요청일부터 30일 이내 위원회를 개최한다고 설명한다.",
  },
  {
    id: "cit-goyang-landscape-schedule-duration",
    sourceId: "src-goyang-landscape-schedule-2026",
    article: "2026년 개최계획",
    paragraph: null,
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "2026년 운영일정 확인 2026-08-22",
    summary: "고양시는 월별 접수마감과 개최일을 공지하고 자료 미비·보완 시 다음 회차로 이월될 수 있음을 안내한다.",
  },
  {
    id: "cit-guri-landscape-operation-duration",
    sourceId: "src-guri-landscape-operation-current",
    article: "위원회 운영 안내",
    paragraph: null,
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "공식 운영안내 확인 2026-08-22",
    summary: "구리시는 경관위원회를 원칙적으로 월 1회 개최하고 안건을 최소 14일 전에 제출하도록 안내한다.",
  },
  {
    id: "cit-cheongju-building-review-duration",
    sourceId: "src-cheongju-building-review-guide-current",
    article: "민원서식자료",
    paragraph: null,
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "공식 민원안내 확인 2026-08-22",
    summary: "청주시는 건축위원회 심의절차의 처리기간을 30일로 안내한다.",
  },
  {
    id: "cit-building-review-initial-agenda-deadline",
    sourceId: "src-building-act-enforcement-decree-20260728",
    article: "제5조의7",
    paragraph: "제2항",
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "시행 2026-07-28",
    summary: "관할 행정청은 지방건축위원회 심의 신청 접수일부터 30일 이내에 심의 안건을 상정해야 한다.",
  },
  {
    id: "cit-building-review-reconsideration-agenda-deadline",
    sourceId: "src-building-act-20260227",
    article: "제4조의2",
    paragraph: "제4항",
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "시행 2026-02-27",
    summary: "관할 행정청은 재심의 신청을 받은 날부터 15일 이내에 건축위원회에 재심의 안건을 상정해야 한다.",
  },
  {
    id: "cit-building-review-result-notice-deadline",
    sourceId: "src-building-act-enforcement-rule-20260227",
    article: "제2조의4",
    paragraph: "제3항",
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "시행 2026-02-27",
    summary: "관할 행정청은 심의 또는 재심의를 완료한 날부터 14일 이내에 결과를 신청인에게 통보해야 한다.",
  },
  {
    id: "cit-aidc-special-act-10",
    sourceId: "src-aidc-special-act-20270310",
    article: "제10조",
    paragraph: "제1항",
    subparagraph: null,
    item: null,
    role: "APPLICABILITY",
    sourceVersion: "시행 예정 2027-03-10",
    summary: "AI 데이터센터 사업자 또는 AI 데이터센터를 구축·운영하려는 자는 구축장소와 운영목적 등 대통령령상 사항을 과학기술정보통신부장관에게 신고해야 한다.",
  },
  {
    id: "cit-aidc-special-act-10-2",
    sourceId: "src-aidc-special-act-20270310",
    article: "제10조",
    paragraph: "제2항",
    subparagraph: null,
    item: null,
    role: "DEEMING",
    sourceVersion: "시행 예정 2027-03-10",
    summary: "제18조에 따른 인허가 등의 일괄처리를 받은 경우 제10조제1항의 AI 데이터센터 신고를 한 것으로 본다.",
  },
  {
    id: "cit-aidc-special-act-10-duration-scope",
    sourceId: "src-aidc-special-act-20270310",
    article: "제10조",
    paragraph: "제1항·제2항",
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "시행 예정 2027-03-10",
    summary: "제10조는 AI 데이터센터 신고의 제출의무와 일괄처리 완료 시 신고 의제를 정하지만, 별도의 수리·승인 결정기간은 두지 않는다. 따라서 신고 제출일을 일정 이정표로만 표시한다.",
  },
  {
    id: "cit-aidc-special-act-18",
    sourceId: "src-aidc-special-act-20270310",
    article: "제18조",
    paragraph: null,
    subparagraph: null,
    item: null,
    role: "DEEMING",
    sourceVersion: "시행 예정 2027-03-10",
    summary: "5개 인허가군을 과기정통부에 일괄신청할 수 있고 관계기관 요청 다음 날부터 150일·90일·40일의 기본 처리기한을 둔다. 주민의견 청취 또는 특별한 사유가 있으면 원칙적으로 1회 30일 이내 연장할 수 있다.",
  },
  {
    id: "cit-aidc-special-act-18-duration-scope",
    sourceId: "src-aidc-special-act-20270310",
    article: "제18조",
    paragraph: "제3항부터 제9항까지",
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "시행 예정 2027-03-10",
    summary: "관계기관별 150일·90일·40일 기한은 과기정통부의 처리요청 다음 날부터 시작하고, 주민의견 청취 또는 특별한 사유가 있으면 원칙적으로 한 차례 30일 이내 연장할 수 있다. 신청 접수부터 사전검토·보완·전략위원회 심의까지와 관계기관 처리 후 최종 결과통지에는 별도 총기한을 두지 않는다.",
  },
  {
    id: "cit-aidc-special-act-18-9",
    sourceId: "src-aidc-special-act-20270310",
    article: "제18조",
    paragraph: "제9항",
    subparagraph: null,
    item: null,
    role: "DEEMING",
    sourceVersion: "시행 예정 2027-03-10",
    summary: "법정 처리기간 내 관계기관이 신청자에게 거부를 통지하지 않으면 기간이 끝난 날의 다음 날에 해당 기관 소관 인허가등의 처리가 완료된 것으로 본다.",
  },
  {
    id: "cit-aidc-special-act-19",
    sourceId: "src-aidc-special-act-20270310",
    article: "제19조",
    paragraph: null,
    subparagraph: null,
    item: null,
    role: "APPLICABILITY",
    sourceVersion: "시행 예정 2027-03-10",
    summary: "비수도권 AI 데이터센터의 신축·확장·전환이 대통령령상 요건을 충족하면 전력계통영향평가 실시대상 사업이 아닌 것으로 본다.",
  },
  {
    id: "cit-aidc-special-act-21",
    sourceId: "src-aidc-special-act-20270310",
    article: "제21조",
    paragraph: null,
    subparagraph: null,
    item: null,
    role: "APPLICABILITY",
    sourceVersion: "시행 예정 2027-03-10",
    summary: "승강기·친환경차 시설·부설주차장·미술작품의 규모 등을 대통령령으로 정하는 바에 따라 달리 산정할 수 있다.",
  },
  {
    id: "cit-aidc-special-act-22",
    sourceId: "src-aidc-special-act-20270310",
    article: "제22조",
    paragraph: null,
    subparagraph: null,
    item: null,
    role: "APPLICABILITY",
    sourceVersion: "시행 예정 2027-03-10",
    summary: "대통령령상 산업단지 AI 데이터센터를 정보통신산업 관련 산업시설용지 시설과 산업집적기반시설로 보되 입주계약은 유지된다.",
  },
  {
    id: "cit-aidc-special-act-23",
    sourceId: "src-aidc-special-act-20270310",
    article: "제23조",
    paragraph: null,
    subparagraph: null,
    item: null,
    role: "APPLICABILITY",
    sourceVersion: "시행 예정 2027-03-10",
    summary: "AI 데이터센터가 1종 항만배후단지에 입주할 수 있도록 허용하되 항만법상 입주계약은 필요하다.",
  },
  {
    id: "cit-port-act-71-entry-contract",
    sourceId: "src-port-act-20260227",
    article: "제71조",
    paragraph: "제1항",
    subparagraph: null,
    item: null,
    role: "APPLICABILITY",
    sourceVersion: "현행 2026-02-27",
    summary: "1종 항만배후단지에 입주하여 사업을 하려는 자는 관리기관과 입주계약을 체결해야 하며 계약 변경도 같은 절차를 거친다.",
  },
  {
    id: "cit-port-act-71-entry-authority",
    sourceId: "src-port-act-20260227",
    article: "제71조",
    paragraph: "제1항",
    subparagraph: null,
    item: null,
    role: "AUTHORITY",
    sourceVersion: "현행 2026-02-27",
    summary: "입주계약의 상대방이 1종 항만배후단지 관리기관임을 명시한다.",
  },
  {
    id: "cit-port-act-71-entry-submission",
    sourceId: "src-port-act-20260227",
    article: "제71조",
    paragraph: "제2항",
    subparagraph: null,
    item: null,
    role: "SUBMISSION",
    sourceVersion: "현행 2026-02-27",
    summary: "관리기관은 입주계약 체결 시 업종과 시설내용을 포함한 사업시설 조성계획 제출 등 입주목적 달성에 필요한 조건을 붙일 수 있다.",
  },
  {
    id: "cit-port-act-decree-72-1-2-submission",
    sourceId: "src-port-act-decree-20260701",
    article: "제72조",
    paragraph: "제1항·제2항",
    subparagraph: null,
    item: null,
    role: "SUBMISSION",
    sourceVersion: "시행 2026-07-01",
    summary: "1종 항만배후단지 입주계약 또는 변경계약 신청은 신청서에 사업계획서를 첨부해 관리기관에 제출하는 경로이다.",
  },
  {
    id: "cit-port-act-decree-72-3-duration",
    sourceId: "src-port-act-decree-20260701",
    article: "제72조",
    paragraph: "제3항",
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "시행 2026-07-01",
    summary: "관리기관은 입주계약 신청일부터 7일 이내에 계약 체결 여부를 결정해 신청인에게 알려야 한다.",
  },
  {
    id: "cit-industrial-cluster-rule-34-2-duration",
    sourceId: "src-industrial-cluster-enforcement-rule-20260409",
    article: "제34조",
    paragraph: "제2항",
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "시행 2026-04-09",
    summary: "관리기관은 입주계약 신청일부터 5일 이내에 계약 체결 여부를 결정하되, 관계기관 인허가 확인·협의가 필요하면 5일 범위에서 연장할 수 있다.",
  },
  {
    id: "cit-industrial-cluster-rule-35-4-duration",
    sourceId: "src-industrial-cluster-enforcement-rule-20260409",
    article: "제35조",
    paragraph: "제4항",
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "시행 2026-04-09",
    summary: "관리기관은 입주계약 변경신청일부터 5일 이내에 변경계약 체결 여부를 결정한다.",
  },
  {
    id: "cit-civil-petitions-act-19-time-calculation",
    sourceId: "src-civil-petitions-act-20220712",
    article: "제19조",
    paragraph: "제1항·제2항",
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "시행 2022-07-12",
    summary: "민원 처리기간이 5일 이하이면 접수시각부터 근무시간 단위로 계산하고, 6일 이상이면 첫날을 산입하여 일 단위로 계산하되 토요일과 공휴일은 제외한다.",
  },
  {
    id: "cit-civil-petitions-decree-20-stop-clock",
    sourceId: "src-civil-petitions-enforcement-decree-current",
    article: "제20조",
    paragraph: null,
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "현행 조문 확인 2026-08-22",
    summary: "민원 처리기간에 산입하지 않는 기간은 행정절차법 시행령 제11조를 준용해 계산한다.",
  },
  {
    id: "cit-administrative-procedure-decree-11-stop-clock",
    sourceId: "src-administrative-procedure-enforcement-decree-current",
    article: "제11조",
    paragraph: null,
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "현행 조문 확인 2026-08-22",
    summary: "신청서 보완, 원거리 기관 문서이송, 대표자 선정, 의견청취, 특별한 실험·검사·전문기술검토와 선행절차 등에 걸리는 법정 기간은 처리기간에서 제외한다.",
  },
  {
    id: "cit-advanced-strategic-industry-act-19-applicability",
    sourceId: "src-advanced-strategic-industry-act-20260602",
    article: "제19조",
    paragraph: "제1항·제2항",
    subparagraph: null,
    item: null,
    role: "APPLICABILITY",
    sourceVersion: "현행본 대조 · 제19조 신속처리 특례 시행 2023-07-01",
    summary: "전략산업 특화단지 사업시행자는 제19조제1항에 열거된 인허가등이 지연되어 현저한 지장이 우려될 때 신속처리를 신청할 수 있고, 장관은 위원회 심의·의결 후 해당 인허가권자에게 요청할 수 있다.",
  },
  {
    id: "cit-advanced-strategic-industry-act-19-deeming",
    sourceId: "src-advanced-strategic-industry-act-20260602",
    article: "제19조",
    paragraph: "제5항",
    subparagraph: null,
    item: null,
    role: "DEEMING",
    sourceVersion: "현행본 대조 · 제19조제5항 시행 2023-07-01",
    summary: "인허가권자가 처리계획 회신기한 또는 처리결과 통보기한을 지키지 않은 경우에만 장관 요청일부터 60일이 지난 날 인허가등의 처리가 완료된 것으로 본다.",
  },
  {
    id: "cit-advanced-strategic-industry-act-19-duration",
    sourceId: "src-advanced-strategic-industry-act-20260602",
    article: "제19조",
    paragraph: "제3항부터 제5항까지",
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "현행본 대조 · 제19조 신속처리 특례 시행 2023-07-01",
    summary: "인허가권자는 장관 요청 후 15일 이내 처리계획을 회신하고 보완이 있어도 늦어도 30일 이내 회신해야 하며, 계획 제출 후 15일 이내 처리결과를 통보하되 불가피하면 한 차례 15일 연장할 수 있다. 이 단계기한을 지키지 않은 경우에만 요청일부터 60일 경과 시 처리 완료로 본다.",
  },
  {
    id: "cit-advanced-strategic-industry-decree-30",
    sourceId: "src-advanced-strategic-industry-decree-20260201",
    article: "제30조",
    paragraph: "제2항",
    subparagraph: null,
    item: "제1호·제2호",
    role: "APPLICABILITY",
    sourceVersion: "시행 2026-02-01",
    summary: "법 제19조제1항제5호의 신속처리 대상에 경관법 제27조제1항의 개발사업 경관심의와 건축법 제22조에 따라 제출된 사용승인신청서의 검사 및 결과 통보를 포함한다.",
  },
  {
    id: "cit-semiconductor-special-act-26-deeming",
    sourceId: "src-semiconductor-special-act-20260811",
    article: "제26조",
    paragraph: null,
    subparagraph: null,
    item: null,
    role: "DEEMING",
    sourceVersion: "시행 2026-08-11",
    summary: "반도체클러스터 조성계획 승인·변경승인 시 계획에 포함되고 관계기관과 필요한 사전협의·승인을 거친 법정 열거 인허가만 받은 것으로 본다.",
  },
  {
    id: "cit-semiconductor-special-act-26-duration-scope",
    sourceId: "src-semiconductor-special-act-20260811",
    article: "제26조",
    paragraph: null,
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "시행 2026-08-11",
    summary: "제26조 자체는 의제효과를 정하고 단계별 별도 기한을 두지 않는다. 다만 반도체클러스터 지정신청서의 접수부터 검토·위원회 심의·지정까지에는 별지 제1호서식의 공식 처리기간 90일 이내가 별도로 적용된다.",
  },
  {
    id: "cit-semiconductor-special-rule-form1-duration",
    sourceId: "src-semiconductor-special-rule-20260811",
    article: "제2조·별지 제1호서식",
    paragraph: null,
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "시행 2026-08-11 · 공식 서식 확인 2026-08-22",
    summary: "반도체클러스터 지정신청서에는 접수부터 검토, 반도체산업경쟁력강화특별위원회 심의·의결 및 지정까지의 처리기간을 90일 이내로 표시한다.",
  },
  {
    id: "cit-semiconductor-special-rule-form3-duration",
    sourceId: "src-semiconductor-special-rule-20260811",
    article: "별지 제3호서식",
    paragraph: null,
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "시행 2026-08-11 · 공식 서식 확인 2026-08-22",
    summary: "반도체클러스터 인·허가 등 신속처리 신청서의 공식 처리기간은 15일 이내이다.",
  },
  {
    id: "cit-advanced-strategic-industry-rule-form9-duration",
    sourceId: "src-advanced-strategic-industry-rule-20251001",
    article: "별지 제9호서식",
    paragraph: null,
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "시행 2025-10-01 · 공식 서식 확인 2026-08-22",
    summary: "전략산업 특화단지 인가·허가·협의·승인 등 신속처리신청서의 공식 처리기간은 21일 이내이다.",
  },
  {
    id: "cit-semiconductor-special-act-27-applicability",
    sourceId: "src-semiconductor-special-act-20260811",
    article: "제27조",
    paragraph: "제1항·제2항",
    subparagraph: null,
    item: null,
    role: "APPLICABILITY",
    sourceVersion: "시행 2026-08-11",
    summary: "반도체클러스터 부지·산업기반시설 조성의 법정 신청자는 제26조 각 호 인허가등이 지연되어 현저한 지장이 우려될 때 신속처리를 신청할 수 있고, 장관은 위원회 심의·의결 후 해당 인허가권자에게 요청할 수 있다.",
  },
  {
    id: "cit-semiconductor-special-act-27-deeming",
    sourceId: "src-semiconductor-special-act-20260811",
    article: "제27조",
    paragraph: "제5항",
    subparagraph: null,
    item: null,
    role: "DEEMING",
    sourceVersion: "시행 2026-08-11",
    summary: "인허가권자가 처리계획 회신기한 또는 처리결과 통보기한을 지키지 않은 경우에만 장관 요청일부터 60일이 지난 날 인허가등의 처리가 완료된 것으로 본다.",
  },
  {
    id: "cit-semiconductor-special-act-27-duration",
    sourceId: "src-semiconductor-special-act-20260811",
    article: "제27조",
    paragraph: "제3항부터 제5항까지",
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "시행 2026-08-11",
    summary: "인허가권자는 장관 요청 후 15일 이내 처리계획을 회신하고 보완이 있어도 늦어도 30일 이내 회신해야 하며, 계획 제출 후 15일 이내 처리결과를 통보하되 불가피하면 한 차례 15일 연장할 수 있다. 이 단계기한을 지키지 않은 경우에만 요청일부터 60일 경과 시 처리 완료로 본다.",
  },
  {
    id: "cit-industrial-complex-fast-track-act-10-duration",
    sourceId: "src-industrial-complex-fast-track-act-20251001",
    article: "제10조",
    paragraph: "제2항부터 제4항까지",
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "시행 2025-10-01",
    summary: "관계 행정기관은 협의요청일부터 근무일 기준 10일 이내, 군사기지·군사시설 보호 협의는 근무일 기준 15일 이내 의견을 회신해야 한다. 관련 서류 보완은 한 차례만 요청할 수 있고 보완기간은 협의기간에서 제외한다.",
  },
  {
    id: "cit-industrial-complex-fast-track-act-9-duration",
    sourceId: "src-industrial-complex-fast-track-act-20251001",
    article: "제9조",
    paragraph: null,
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "시행 2025-10-01",
    summary: "특별한 사유가 없으면 승인신청일부터 3근무일 이내 공고하고, 공고일부터 20일 이상 일반열람하며, 선택적 합동설명회 또는 공청회는 공고일부터 10근무일 이내 개최한다.",
  },
  {
    id: "cit-industrial-complex-fast-track-act-16-2-duration",
    sourceId: "src-industrial-complex-fast-track-act-20251001",
    article: "제16조",
    paragraph: "제2항",
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "시행 2025-10-01",
    summary: "지정권자는 산업단지계획 승인신청일부터 늦어도 4개월 이내에 환경영향평가 관계기관 협의를 요청해야 한다.",
  },
  {
    id: "cit-industrial-complex-fast-track-act-22-duration",
    sourceId: "src-industrial-complex-fast-track-act-20251001",
    article: "제22조",
    paragraph: "제2항",
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "시행 2025-10-01",
    summary: "공유수면매립기본계획 관련 협의는 협의요청일부터 20근무일 이내 의견을 회신하는 특별 분기다.",
  },
  {
    id: "cit-industrial-complex-fast-track-act-23-duration",
    sourceId: "src-industrial-complex-fast-track-act-20251001",
    article: "제23조",
    paragraph: "제2항·제3항",
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "시행 2025-10-01",
    summary: "15만㎡ 미만 산업단지의 전략환경영향평가 의견은 협의요청일부터 30일, 15만㎡ 이상 산업단지의 환경영향평가 의견은 평가서 접수일부터 45일 이내 통보한다. 보완은 한 차례만 요구할 수 있고 보완기간은 산입하지 않는다.",
  },
  {
    id: "cit-industrial-complex-fast-track-act-15",
    sourceId: "src-industrial-complex-fast-track-act-20251001",
    article: "제15조·제15조의2",
    paragraph: null,
    subparagraph: null,
    item: null,
    role: "DEEMING",
    sourceVersion: "시행 2025-10-01",
    summary: "산업단지계획 승인·고시와 변경승인 절차를 두고, 경미한 변경은 의견청취와 위원회 심의의 일부를 생략할 수 있다.",
  },
  {
    id: "cit-industrial-complex-fast-track-act-16",
    sourceId: "src-industrial-complex-fast-track-act-20251001",
    article: "제16조",
    paragraph: "제1항",
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "시행 2025-10-01",
    summary: "지정권자는 민간기업등의 산업단지계획 승인신청을 접수한 날부터 6개월 이내에 승인 여부를 결정하여 통지해야 한다.",
  },
  {
    id: "cit-industrial-complex-fast-track-decree-11-duration-exception",
    sourceId: "src-industrial-complex-fast-track-decree-20240730",
    article: "제11조",
    paragraph: null,
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "시행 2024-07-30",
    summary: "민간기업등의 귀책사유로 산업단지계획 승인절차가 지연된 경우는 법 제16조제1항의 6개월 승인기한 예외인 정당한 사유에 해당한다.",
  },
  {
    id: "cit-industrial-location-act-21",
    sourceId: "src-industrial-location-act-20260102",
    article: "제21조",
    paragraph: "제1항·제3항",
    subparagraph: null,
    item: null,
    role: "DEEMING",
    sourceVersion: "시행 2026-01-02",
    summary: "실시계획 승인 시 필요한 서류를 제출하고 관계기관과 협의한 개발행위·농지·산지·하천·공유수면·건축 등의 인허가를 받은 것으로 보며, 관계기관은 협의요청을 받은 날부터 15일 이내 의견을 제출한다.",
  },
  {
    id: "cit-regional-special-zone-act-64-65",
    sourceId: "src-regional-special-zone-act-20260701",
    article: "제64조·제65조",
    paragraph: null,
    subparagraph: null,
    item: null,
    role: "DEEMING",
    sourceVersion: "현행 2026-07-01 · 현 조문 체계 시행 2019-04-17",
    summary: "특구토지이용계획이 포함된 특화특구계획 승인 시 도시·군관리계획결정 등이 의제되고, 계획에 포함되며 관계기관과 미리 협의된 개발행위·농지·산지·하천·공유수면 등의 허가를 받은 것으로 본다.",
  },
  {
    id: "cit-regional-special-zone-decree-7-duration",
    sourceId: "src-regional-special-zone-decree-current",
    article: "제7조",
    paragraph: "제1항·제2항",
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "현행 확인 2026-08-22",
    summary: "중소벤처기업부장관은 특화특구 지정신청을 받은 날부터 90일 이내 지정 여부를 결정하고, 부득이한 사유가 있으면 한 차례만 45일 범위에서 연장할 수 있다. 법정 협의·보완 등에 걸리는 기간과 신청 지방자치단체장이 위원회 심의·의결 연기를 요청한 기간은 산입하지 않는다.",
  },
  {
    id: "cit-regional-special-zone-decree-application-duration",
    sourceId: "src-regional-special-zone-decree-current",
    article: "제3조부터 제6조까지",
    paragraph: null,
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "현행 확인 2026-08-22",
    summary: "민간 제안 필요성 검토 60일, 계획 주요내용 공고 20일 이상, 공고일부터 6일이 지난 뒤 14일 이상 열람, 공청회 개최 14일 전까지 공고, 시·도지사 의견 제출 30일의 조건부 준비단계 기한을 둔다.",
  },
  {
    id: "cit-regional-special-zone-decree-7-consultation-duration",
    sourceId: "src-regional-special-zone-decree-current",
    article: "제7조",
    paragraph: "제3항",
    subparagraph: null,
    item: null,
    role: "DURATION",
    sourceVersion: "현행 확인 2026-08-22",
    summary: "관계 행정기관은 특화특구 지정 협의요청일부터 20일 이내 의견을 제출하며, 부득이한 경우 중소벤처기업부장관과 협의해 한 차례 10일 연장할 수 있다.",
  },
];

const nationwide = {
  nationwide: true,
  provinces: [],
  cities: [],
  industrialComplexIds: [],
};

const aiDataCenterCondition: Condition = {
  eq: { path: "industry.category", value: AI_DATA_CENTER_INDUSTRY_ID },
};

const aiDataCenterActFacilityCondition: Condition = {
  eq: {
    path: "industry.aiDataCenterActFacilityConfirmed",
    value: true,
  },
};

const selectedLawCondition = (id: SpecialLawId): Condition => ({
  intersects: { path: "strategicIndustrySpecialCase", values: [id] },
});

const factoryOnlyProcedureIds = [
  "factory-establishment-approval",
  "factory-completion-report-complex",
  "factory-completion-report-offsite",
  "small-factory-registration",
] as const;

export const specialLawRules: ApplicabilityRule[] = [
  {
    id: "rule-grid-impact-assessment",
    version: "2026.08.21.1",
    procedureId: "power-grid-impact-assessment",
    effect: "INCLUDE",
    effectiveFrom: "2024-06-14",
    effectiveTo: null,
    jurisdiction: nationwide,
    condition: { eq: { path: "utilities.gridImpactAssessmentRequired", value: true } },
    requiredInputs: ["utilities.gridImpactAssessmentRequired"],
    missingPolicy: "INDETERMINATE",
    citationIds: ["cit-distributed-energy-act-23"],
    explanationTemplate: "전력계통영향평가 대상으로 입력되어 계통 수용성 평가 절차를 포함합니다.",
    priority: 100,
    status: "INTERNAL_REVIEWED",
    reviewActor: "법제처 공포 법문 대조",
    note: "대상지역·전력용량과 시행령상 제외사업은 관할기관에서 확인해야 합니다.",
  },
  {
    id: "rule-aidc-grid-impact-exemption",
    version: "2026.08.21.1",
    procedureId: "power-grid-impact-assessment",
    effect: "EXCLUDE",
    industryScope: [AI_DATA_CENTER_INDUSTRY_ID],
    effectiveFrom: AI_DATA_CENTER_SPECIAL_ACT_EFFECTIVE_DATE,
    effectiveTo: null,
    jurisdiction: nationwide,
    condition: {
      all: [
        aiDataCenterCondition,
        aiDataCenterActFacilityCondition,
        selectedLawCondition("AIDC_GRID_IMPACT_EXEMPTION"),
      ],
    },
    requiredInputs: [
      "industry.category",
      "industry.aiDataCenterActFacilityConfirmed",
      "strategicIndustrySpecialCase",
    ],
    missingPolicy: "INDETERMINATE",
    citationIds: ["cit-aidc-special-act-19"],
    explanationTemplate: "시행 후 공식 요건 충족을 확인한 비수도권 AI 데이터센터 특례가 선택되어 전력계통영향평가를 면제합니다.",
    priority: 500,
    status: "INTERNAL_REVIEWED",
    reviewActor: "법제처 공포 법문 대조",
    note: "시행령상 AI 데이터센터 시설·전력용량 요건 확인을 전제로 한 사용자 선택입니다.",
  },
  {
    id: "rule-aidc-business-report-before-effective",
    version: "2026.08.21.1",
    procedureId: "ai-data-center-business-report",
    effect: "EXCLUDE",
    industryScope: [AI_DATA_CENTER_INDUSTRY_ID],
    effectiveFrom: "2025-01-01",
    effectiveTo: "2027-03-09",
    jurisdiction: nationwide,
    condition: aiDataCenterCondition,
    requiredInputs: ["industry.category"],
    missingPolicy: "INDETERMINATE",
    citationIds: ["cit-aidc-special-act-10"],
    explanationTemplate: "AI 데이터센터 신고 의무는 2027년 3월 10일부터 시행되므로 평가 기준일 현재는 적용되지 않습니다.",
    priority: 300,
    status: "INTERNAL_REVIEWED",
    reviewActor: "법제처 공포 법문 대조",
    note: "부칙상 시행일을 적용했습니다.",
  },
  {
    id: "rule-aidc-business-report",
    version: "2026.08.21.1",
    procedureId: "ai-data-center-business-report",
    effect: "INCLUDE",
    industryScope: [AI_DATA_CENTER_INDUSTRY_ID],
    effectiveFrom: AI_DATA_CENTER_SPECIAL_ACT_EFFECTIVE_DATE,
    effectiveTo: null,
    jurisdiction: nationwide,
    condition: {
      all: [aiDataCenterCondition, aiDataCenterActFacilityCondition],
    },
    requiredInputs: [
      "industry.category",
      "industry.aiDataCenterActFacilityConfirmed",
    ],
    missingPolicy: "INDETERMINATE",
    citationIds: ["cit-aidc-special-act-10"],
    explanationTemplate: "특별법상 AI 데이터센터 인정요건을 충족한다고 입력했고 시행일 이후이므로 과학기술정보통신부 신고 절차를 포함합니다.",
    priority: 100,
    status: "INTERNAL_REVIEWED",
    reviewActor: "법제처 공포 법문 대조",
    note: "신고항목과 서식은 시행령·시행규칙 공포 후 재확인해야 합니다.",
  },
  {
    id: "rule-aidc-business-report-not-qualified",
    version: "2026.08.21.1",
    procedureId: "ai-data-center-business-report",
    effect: "EXCLUDE",
    industryScope: [AI_DATA_CENTER_INDUSTRY_ID],
    effectiveFrom: AI_DATA_CENTER_SPECIAL_ACT_EFFECTIVE_DATE,
    effectiveTo: null,
    jurisdiction: nationwide,
    condition: {
      all: [
        aiDataCenterCondition,
        {
          eq: {
            path: "industry.aiDataCenterActFacilityConfirmed",
            value: false,
          },
        },
      ],
    },
    requiredInputs: [
      "industry.category",
      "industry.aiDataCenterActFacilityConfirmed",
    ],
    missingPolicy: "INDETERMINATE",
    citationIds: ["cit-aidc-special-act-10"],
    explanationTemplate: "특별법상 AI 데이터센터 인정요건에 미해당으로 입력되어 제10조 신고 절차를 적용하지 않습니다.",
    priority: 300,
    status: "INTERNAL_REVIEWED",
    reviewActor: "법제처 공포 법문 대조",
    note: "법 제2조의 시설 정의와 향후 시행령상 설비·규모 기준 확인을 전제로 합니다.",
  },
  {
    id: "rule-aidc-business-report-deemed-by-one-stop",
    version: "2026.08.21.1",
    procedureId: "ai-data-center-business-report",
    effect: "EXCLUDE",
    industryScope: [AI_DATA_CENTER_INDUSTRY_ID],
    effectiveFrom: AI_DATA_CENTER_SPECIAL_ACT_EFFECTIVE_DATE,
    effectiveTo: null,
    jurisdiction: nationwide,
    condition: {
      all: [
        aiDataCenterCondition,
        aiDataCenterActFacilityCondition,
        selectedLawCondition("AIDC_ONE_STOP"),
        {
          eq: {
            path: "industry.aiDataCenterOneStopStatus",
            value: "COMPLETED",
          },
        },
      ],
    },
    requiredInputs: [
      "industry.category",
      "industry.aiDataCenterActFacilityConfirmed",
      "industry.aiDataCenterOneStopStatus",
      "strategicIndustrySpecialCase",
    ],
    missingPolicy: "INDETERMINATE",
    citationIds: ["cit-aidc-special-act-10-2"],
    explanationTemplate: "제18조에 따른 일괄처리를 받은 상태로 입력되어 제10조제1항 신고를 별도 제출하지 않습니다.",
    priority: 500,
    status: "INTERNAL_REVIEWED",
    reviewActor: "법제처 공포 법문 대조",
    note: "일괄처리 신청 또는 심사 중이 아니라 일괄처리를 받은 경우에만 성립하는 신고 의제입니다.",
  },
  ...([
    "ai-data-center-one-stop-application",
    "ai-data-center-one-stop-result",
  ] as const).map((procedureId): ApplicabilityRule => ({
    id: `rule-${procedureId}-before-effective`,
    version: "2026.08.21.1",
    procedureId,
    effect: "EXCLUDE",
    industryScope: [AI_DATA_CENTER_INDUSTRY_ID],
    effectiveFrom: "2025-01-01",
    effectiveTo: "2027-03-09",
    jurisdiction: nationwide,
    condition: aiDataCenterCondition,
    requiredInputs: ["industry.category"],
    missingPolicy: "INDETERMINATE",
    citationIds: ["cit-aidc-special-act-18"],
    explanationTemplate: "AI 데이터센터 인허가 일괄처리 제도는 2027년 3월 10일부터 시행되므로 평가 기준일 현재 적용하지 않습니다.",
    priority: 300,
    status: "INTERNAL_REVIEWED",
    reviewActor: "법제처 공포 법문 대조",
    note: "부칙상 시행일을 적용했습니다.",
  })),
  {
    id: "rule-aidc-one-stop-application",
    version: "2026.08.21.1",
    procedureId: "ai-data-center-one-stop-application",
    effect: "INCLUDE",
    industryScope: [AI_DATA_CENTER_INDUSTRY_ID],
    effectiveFrom: AI_DATA_CENTER_SPECIAL_ACT_EFFECTIVE_DATE,
    effectiveTo: null,
    jurisdiction: nationwide,
    condition: {
      all: [
        aiDataCenterCondition,
        aiDataCenterActFacilityCondition,
        selectedLawCondition("AIDC_ONE_STOP"),
        {
          in: {
            path: "industry.aiDataCenterOneStopStatus",
            values: ["PLANNED", "IN_PROGRESS"],
          },
        },
      ],
    },
    requiredInputs: [
      "industry.category",
      "industry.aiDataCenterActFacilityConfirmed",
      "industry.aiDataCenterOneStopStatus",
      "strategicIndustrySpecialCase",
    ],
    missingPolicy: "INDETERMINATE",
    citationIds: ["cit-aidc-special-act-18"],
    explanationTemplate: "AI 데이터센터 인허가 일괄처리를 신청 예정 또는 심사 중으로 입력해 일괄처리 경로를 포함합니다.",
    priority: 300,
    status: "INTERNAL_REVIEWED",
    reviewActor: "법제처 공포 법문 대조",
    note: "과기정통부 사전검토·보완과 전략위원회 심의기간은 관계기관별 기본 처리기한에 포함되지 않으며, 제18조제8항의 1회 연장 가능성도 별도 확인합니다.",
  },
  {
    id: "rule-aidc-one-stop-result",
    version: "2026.08.21.1",
    procedureId: "ai-data-center-one-stop-result",
    effect: "INCLUDE",
    industryScope: [AI_DATA_CENTER_INDUSTRY_ID],
    effectiveFrom: AI_DATA_CENTER_SPECIAL_ACT_EFFECTIVE_DATE,
    effectiveTo: null,
    jurisdiction: nationwide,
    condition: {
      all: [
        aiDataCenterCondition,
        aiDataCenterActFacilityCondition,
        selectedLawCondition("AIDC_ONE_STOP"),
        {
          eq: {
            path: "industry.aiDataCenterOneStopStatus",
            value: "COMPLETED",
          },
        },
      ],
    },
    requiredInputs: [
      "industry.category",
      "industry.aiDataCenterActFacilityConfirmed",
      "industry.aiDataCenterOneStopStatus",
      "strategicIndustrySpecialCase",
    ],
    missingPolicy: "INDETERMINATE",
    citationIds: ["cit-aidc-special-act-18", "cit-aidc-special-act-10-2"],
    explanationTemplate: "일괄처리를 받은 상태로 입력되어 과기정통부의 일괄처리 결과와 신고 의제를 반영합니다.",
    priority: 300,
    status: "INTERNAL_REVIEWED",
    reviewActor: "법제처 공포 법문 대조",
    note: "관계기관별 인허가 완료 여부와 일괄처리 결과통지를 함께 보관해야 합니다.",
  },
  {
    id: "rule-aidc-port-hinterland-entry-before-effective",
    version: "2026.08.21.1",
    procedureId: "port-hinterland-entry-contract",
    effect: "EXCLUDE",
    industryScope: [AI_DATA_CENTER_INDUSTRY_ID],
    effectiveFrom: "2025-01-01",
    effectiveTo: "2027-03-09",
    jurisdiction: nationwide,
    condition: aiDataCenterCondition,
    requiredInputs: ["industry.category"],
    missingPolicy: "INDETERMINATE",
    citationIds: ["cit-aidc-special-act-23"],
    explanationTemplate: "1종 항만배후단지 AI 데이터센터 입주 특례는 2027년 3월 10일부터 시행되므로 평가 기준일 현재 적용하지 않습니다.",
    priority: 300,
    status: "INTERNAL_REVIEWED",
    reviewActor: "법제처 공포 법문·항만법 대조",
    note: "특별법 시행 전에는 제23조의 AI 데이터센터 입주자격 특례를 적용하지 않습니다.",
  },
  {
    id: "rule-aidc-port-hinterland-entry-contract",
    version: "2026.08.21.1",
    procedureId: "port-hinterland-entry-contract",
    effect: "INCLUDE",
    industryScope: [AI_DATA_CENTER_INDUSTRY_ID],
    effectiveFrom: AI_DATA_CENTER_SPECIAL_ACT_EFFECTIVE_DATE,
    effectiveTo: null,
    jurisdiction: nationwide,
    condition: {
      all: [
        aiDataCenterCondition,
        aiDataCenterActFacilityCondition,
        selectedLawCondition("AIDC_PORT_HINTERLAND_ENTRY"),
      ],
    },
    requiredInputs: [
      "industry.category",
      "industry.aiDataCenterActFacilityConfirmed",
      "strategicIndustrySpecialCase",
    ],
    missingPolicy: "INDETERMINATE",
    citationIds: [
      "cit-aidc-special-act-23",
      "cit-port-act-71-entry-contract",
    ],
    explanationTemplate: "특별법상 1종 항만배후단지 입주자격 특례를 선택했으므로 별도로 필요한 항만법상 입주계약·변경계약 절차를 포함합니다.",
    priority: 300,
    status: "INTERNAL_REVIEWED",
    reviewActor: "법제처 공포 법문·항만법 제71조 대조",
    note: "특별법 제23조는 입주자격 특례이고 항만법 제71조의 관리기관 입주계약을 면제하지 않습니다.",
  },
  {
    id: "rule-landscape-review-required",
    version: "2026.08.21.1",
    procedureId: "landscape-review",
    effect: "INCLUDE",
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    jurisdiction: nationwide,
    condition: { eq: { path: "site.landscapeReviewRequired", value: true } },
    requiredInputs: ["site.landscapeReviewRequired"],
    missingPolicy: "INDETERMINATE",
    citationIds: ["cit-landscape-act-28"],
    explanationTemplate: "경관심의 대상으로 입력되어 관할 경관계획·조례에 따른 심의 절차를 포함합니다.",
    priority: 100,
    status: "INTERNAL_REVIEWED",
    reviewActor: "경관법 법문 및 조례 연결 검토",
    note: "일반 적용근거와 대상기준은 경관법령·관할 경관조례·경관계획 원문을 별도 확인해야 합니다.",
  },
  {
    id: "rule-building-committee-review-required",
    version: "2026.08.21.1",
    procedureId: "building-committee-review",
    effect: "INCLUDE",
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    jurisdiction: nationwide,
    condition: {
      eq: {
        path: "building.buildingCommitteeReviewRequired",
        value: true,
      },
    },
    requiredInputs: ["building.buildingCommitteeReviewRequired"],
    missingPolicy: "INDETERMINATE",
    citationIds: ["cit-building-act-4-2"],
    explanationTemplate: "건축위원회 심의 대상으로 입력되어 건축허가와 구분된 사전 심의 절차를 포함합니다.",
    priority: 100,
    status: "INTERNAL_REVIEWED",
    reviewActor: "건축법 법문 및 건축절차 검토",
    note: "일반 심의대상은 건축법령과 관할 건축조례의 규모·용도 기준을 별도 확인해야 합니다.",
  },
  {
    id: "rule-industrial-complex-occupancy-contract",
    version: "2026.08.21.1",
    procedureId: "industrial-complex-occupancy-contract",
    effect: "INCLUDE",
    effectiveFrom: "2026-07-01",
    effectiveTo: null,
    jurisdiction: nationwide,
    condition: { eq: { path: "industrialComplex.inside", value: true } },
    requiredInputs: ["industrialComplex.occupancyContractStatus"],
    missingPolicy: "INDETERMINATE",
    citationIds: [
      "cit-indcluster-38-occupancy-contract",
      "cit-indcluster-13-2-deeming",
    ],
    explanationTemplate: "산업단지 입주사업이므로 관리기관과의 입주계약 또는 중요사항 변경계약 경로를 포함합니다.",
    priority: 200,
    status: "INTERNAL_REVIEWED",
    reviewActor: "법제처 현행 법률 제38조·제13조제2항 대조",
    note: "실제 입주계약·변경계약 진행상태를 입력해야 하며, 법정 예외 여부와 접수 관리기관은 해당 산업단지 관리기관에 확인합니다.",
  },
];

/**
 * KSIC 63 서비스업으로 분류한 AI 데이터센터 업종 프로필에만 활성화되는
 * 카탈로그 규칙입니다. `industryScope`와 동일한 추적 조건을 함께 두어 다른
 * 업종의 과거 평가일 판정을 바꾸지 않으면서 산업집적법상 공장 경로만
 * 제외합니다. 환경·안전 인허가는 이 업종 프로필로 제외하지 않습니다.
 */
export const aiDataCenterProfileRules: ApplicabilityRule[] =
  factoryOnlyProcedureIds.map((procedureId): ApplicabilityRule => ({
    id: `rule-aidc-exclude-${procedureId}`,
    version: "2026.08.21.1",
    procedureId,
    effect: "EXCLUDE",
    industryScope: [AI_DATA_CENTER_INDUSTRY_ID],
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    jurisdiction: nationwide,
    condition: aiDataCenterCondition,
    requiredInputs: ["industry.category"],
    missingPolicy: "INDETERMINATE",
    citationIds: ["cit-indcluster-2-1-factory-definition"],
    explanationTemplate: "선택한 AI 데이터센터 업종 프로필은 제조업 공장이 아니므로 산업집적법상 공장설립 승인·완료·등록 경로를 적용하지 않습니다.",
    priority: 600,
    status: "INTERNAL_REVIEWED",
    reviewActor: "KSIC 업종 모델 및 산업집적법 제2조 대조",
    note: "동일 사업에 별도 제조시설이 있거나 제조업을 함께 영위하면 해당 제조업 프로필로 별도 검토해야 합니다.",
  }));

export const specialLawProcedures: Procedure[] = [
  {
    id: "port-hinterland-entry-contract",
    name: "1종 항만배후단지 입주계약·변경계약",
    aliases: ["항만배후단지 입주계약", "항만 입주 변경계약"],
    description: "AI 데이터센터가 특별법상 입주자격 특례로 1종 항만배후단지에 입주하더라도, 사업을 하기 전 항만배후단지 관리기관과 별도로 체결해야 하는 입주계약 경로입니다. 계약을 변경할 때도 같은 절차를 거칩니다.",
    outcome: "1종 항만배후단지 입주계약서 또는 변경계약서",
    stage: "PLAN_AND_OCCUPANCY",
    actionType: "CONTRACT",
    domain: "항만배후단지 입주",
    lane: "CENTRAL_OR_REGIONAL_OFFICE",
    applicant: "1종 항만배후단지에서 AI 데이터센터 사업을 하려는 자",
    receivingAuthority: "해당 1종 항만배후단지 관리기관",
    statutoryDecisionMaker: "해당 1종 항만배후단지 관리기관",
    consultationAuthorities: ["해양수산부 및 관할 항만기관(관리기관에 따라 확인)"],
    submissions: [
      "입주계약 또는 변경계약 신청서",
      "사업계획서와 AI 데이터센터 업종·시설내용",
      "특별법상 AI 데이터센터 인정·입주자격 특례 확인자료",
    ],
    validity: "입주계약 내용, 부가조건과 계약 변경·해지 사유에 따름",
    followUpObligations: [
      "입주계약 조건과 사업시설 조성계획 이행",
      "계약내용 변경 전 변경계약 여부 확인",
      "입주자격 유지 및 실제 계약서·관리기관 확인결과 보관",
    ],
    ruleIds: [
      "rule-aidc-port-hinterland-entry-before-effective",
      "rule-aidc-port-hinterland-entry-contract",
    ],
    citationIds: [
      "cit-aidc-special-act-23",
      "cit-port-act-71-entry-contract",
      "cit-port-act-71-entry-authority",
      "cit-port-act-71-entry-submission",
      "cit-port-act-decree-72-1-2-submission",
      "cit-port-act-decree-72-3-duration",
      "cit-civil-petitions-act-19-time-calculation",
    ],
    durationId: "duration-port-hinterland-entry-contract",
    verificationStatus: "INTERNAL_REVIEWED",
    reviewedAt: "2026-08-21",
    reviewNote: "AI 데이터센터 특별법 제23조의 입주자격 특례, 항만법 제71조의 별도 입주계약 의무와 시행령 제72조의 신청·결정기한을 대조했습니다. 모집·선정 선행단계와 민원처리법 적용 여부는 해당 관리기관에서 확인해야 합니다.",
    deemedByProcedureIds: [],
    deemedProcedureIds: [],
  },
  {
    id: "industrial-complex-occupancy-contract",
    name: "산업단지 입주계약·변경계약",
    aliases: ["산단 입주계약", "입주 변경계약"],
    description: "산업단지에서 제조업 또는 그 밖의 사업을 하려는 자가 관리기관과 체결하는 입주계약 경로입니다. 법정 중요사항을 변경하면 변경계약을 체결합니다.",
    outcome: "산업단지 입주계약서 또는 변경계약서",
    stage: "PLAN_AND_OCCUPANCY",
    actionType: "CONTRACT",
    domain: "산업단지 입주",
    lane: "INDUSTRIAL_COMPLEX_AUTHORITY",
    applicant: "산업단지에서 사업을 하려는 자 또는 입주기업체",
    receivingAuthority: "입력한 산업단지 관리기관",
    statutoryDecisionMaker: "해당 산업단지 관리기관",
    consultationAuthorities: ["관할 시장·군수·구청장(관리기관 보고 경로)"],
    submissions: [
      "입주계약 또는 변경계약 신청서",
      "사업계획서와 업종·생산품·공정 자료",
      "산업단지 관리기본계획상 입주자격 확인자료",
      "관리기관이 요구하는 공장·부지·환경 관련 자료",
    ],
    validity: "계약내용과 관리기본계획, 변경계약 대상 여부에 따름",
    followUpObligations: [
      "계약 중요사항 변경 전 변경계약 여부 확인",
      "계약조건과 산업단지 관리기본계획 준수",
      "실제 계약서와 관리기관 확인결과 보관",
    ],
    ruleIds: ["rule-industrial-complex-occupancy-contract"],
    citationIds: [
      "cit-indcluster-38-occupancy-contract",
      "cit-indcluster-13-2-deeming",
      "cit-industrial-cluster-rule-34-2-duration",
      "cit-industrial-cluster-rule-35-4-duration",
      "cit-civil-petitions-act-19-time-calculation",
    ],
    durationId: "duration-industrial-complex-occupancy-contract",
    verificationStatus: "INTERNAL_REVIEWED",
    reviewedAt: "2026-08-21",
    reviewNote: "법 제38조의 계약의무, 제13조제2항의 공장설립 승인 의제와 시행규칙 제34조·제35조의 계약 결정기한을 대조했습니다. 실제 접수창구와 민원처리법 적용 여부는 관리기관에서 확인해야 합니다.",
    deemedByProcedureIds: [],
    deemedProcedureIds: ["factory-establishment-approval"],
  },
  {
    id: "power-grid-impact-assessment",
    name: "전력계통영향평가",
    aliases: ["계통영향평가"],
    description: "대규모 전기사용 사업이 전력계통에 미치는 영향을 분석해 전력공급 가능성과 보강대책을 심의받는 절차입니다.",
    outcome: "전력계통영향평가 심의결과",
    stage: "SITE_REVIEW",
    actionType: "REVIEW",
    domain: "전력·에너지",
    lane: "ENVIRONMENT_SAFETY_FIRE_UTILITY",
    applicant: "전력계통영향평가 실시대상 사업자",
    receivingAuthority: "기후에너지환경부",
    statutoryDecisionMaker: "기후에너지환경부장관",
    consultationAuthorities: ["전력정책심의회", "한국전력공사 및 관계 전기사업자"],
    submissions: ["전력사용계획", "부지·시설 개요", "전력계통영향평가서", "계통 보강·수요관리 대책"],
    validity: "심의결과와 후속 사업계획 변경 여부에 따름",
    followUpObligations: ["심의결과를 사업계획과 전력공급 협의에 반영", "전력사용계획 변경 시 재평가 여부 확인"],
    ruleIds: ["rule-grid-impact-assessment", "rule-aidc-grid-impact-exemption"],
    citationIds: [
      "cit-distributed-energy-act-23",
      "cit-distributed-energy-act-24-process",
      "cit-distributed-energy-act-24-duration",
    ],
    durationId: "duration-power-grid-impact-assessment",
    verificationStatus: "INTERNAL_REVIEWED",
    reviewedAt: "2026-08-21",
    reviewNote: "대상지역·전력용량과 시행령상 제외사업은 현행 분산에너지법령 및 관할기관에서 확인해야 합니다. 선택한 업종별 특례는 별도 카드에 표시합니다.",
    deemedByProcedureIds: [],
    deemedProcedureIds: [],
  },
  {
    id: "landscape-review",
    name: "경관심의",
    aliases: ["경관위원회 심의"],
    description: "경관법령, 경관계획과 관할 조례상 대상 개발사업·건축물의 배치·높이·외관·주변 조화를 심의받는 절차입니다.",
    outcome: "경관위원회 심의결과",
    stage: "PRE_CONSTRUCTION",
    actionType: "REVIEW",
    domain: "입지·건축",
    lane: "CITY_COUNTY_DISTRICT",
    applicant: "대상 개발사업 시행자 또는 건축주",
    receivingAuthority: "관할 시·군·구 또는 시·도 경관부서",
    statutoryDecisionMaker: "관할 경관위원회 및 인허가권자",
    consultationAuthorities: ["관할 건축·도시계획부서"],
    submissions: ["경관계획서", "배치·입면·조경계획", "조망·주변경관 검토자료", "관할 조례상 심의자료"],
    validity: "심의결과와 사업계획 변경 여부에 따름",
    followUpObligations: ["심의의결 조건을 설계·인허가도서에 반영", "주요 설계변경 시 재심의 여부 확인"],
    ruleIds: ["rule-landscape-review-required"],
    citationIds: ["cit-landscape-act-28"],
    durationId: "duration-landscape-review",
    verificationStatus: "INTERNAL_REVIEWED",
    reviewedAt: "2026-08-21",
    reviewNote: "일반 심의대상·제출자료는 경관법령, 지역 경관계획과 관할 조례를 확인해야 합니다. 선택한 업종별 특례는 별도 카드에 표시합니다.",
    deemedByProcedureIds: [],
    deemedProcedureIds: [],
  },
  {
    id: "building-committee-review",
    name: "건축위원회 심의",
    aliases: ["지방건축위원회 심의"],
    description: "건축법령과 관할 건축조례상 대상 건축물의 건축계획·구조·안전·공공성을 건축허가 전에 심의받는 절차입니다.",
    outcome: "건축위원회 심의결과",
    stage: "PRE_CONSTRUCTION",
    actionType: "REVIEW",
    domain: "입지·건축",
    lane: "CITY_COUNTY_DISTRICT",
    applicant: "건축주 또는 설계자",
    receivingAuthority: "관할 허가권자 건축부서",
    statutoryDecisionMaker: "관할 지방건축위원회 및 허가권자",
    consultationAuthorities: ["소방·구조·교통 등 심의 관계부서"],
    submissions: ["건축위원회 심의신청서", "배치·평면·입면·단면도", "구조·피난·교통 검토자료", "관할 심의기준상 도서"],
    validity: "심의결과와 설계변경 여부에 따름",
    followUpObligations: ["심의의결 조건을 건축허가도서에 반영", "주요 설계변경 시 재심의 여부 확인"],
    ruleIds: ["rule-building-committee-review-required"],
    citationIds: ["cit-building-act-4-2"],
    durationId: "duration-building-committee-review",
    verificationStatus: "INTERNAL_REVIEWED",
    reviewedAt: "2026-08-21",
    reviewNote: "일반 심의대상은 건축법령과 관할 건축조례를 확인해야 합니다. 선택한 업종별 특례는 별도 카드에 표시합니다.",
    deemedByProcedureIds: [],
    deemedProcedureIds: [],
  },
  {
    id: "ai-data-center-one-stop-application",
    name: "AI 데이터센터 인허가 일괄처리 신청·심사",
    aliases: ["AI 데이터센터 일괄처리 신청"],
    description: "AI 데이터센터 사업자등이 특별법 제18조의 인허가군을 과학기술정보통신부에 일괄신청하고 사전검토·보완·전략위원회 심의를 거치는 절차입니다.",
    outcome: "일괄처리 관계기관 요청 및 심사 진행",
    stage: "SITE_REVIEW",
    actionType: "REVIEW",
    domain: "AI 데이터센터",
    lane: "CENTRAL_OR_REGIONAL_OFFICE",
    applicant: "AI 데이터센터 사업자 또는 AI 데이터센터를 구축·운영하려는 자",
    receivingAuthority: "과학기술정보통신부",
    statutoryDecisionMaker: "과학기술정보통신부장관 및 관계기관의 장",
    consultationAuthorities: ["국가인공지능전략위원회", "개별 인허가 관계기관"],
    submissions: ["일괄처리 신청서", "대상 인허가별 신청서류", "시설·입지·전력·건축계획", "하위법령에서 정할 자료"],
    validity: "신청 사업계획과 인허가별 관계기관 처리결과에 따름",
    followUpObligations: ["보완요구 대응", "관계기관별 인허가 결과와 조건 확인"],
    ruleIds: ["rule-aidc-one-stop-application"],
    citationIds: ["cit-aidc-special-act-18", "cit-aidc-special-act-18-9"],
    durationId: "duration-aidc-one-stop-application",
    verificationStatus: "INTERNAL_REVIEWED",
    reviewedAt: "2026-08-21",
    reviewNote: "관계기관별 150·90·40일 기본 처리기한은 과기정통부 요청 다음 날부터 적용됩니다. 주민의견 청취·특별사유 시 1회 30일 이내 연장 가능성과 사전검토·보완·전략위원회 심의기간을 별도로 관리합니다.",
    deemedByProcedureIds: [],
    deemedProcedureIds: [],
  },
  {
    id: "ai-data-center-one-stop-result",
    name: "AI 데이터센터 인허가 일괄처리 결과",
    aliases: ["AI 데이터센터 일괄처리 완료"],
    description: "관계기관 처리가 끝난 뒤 과학기술정보통신부가 일괄처리 신청 결과를 통지하는 절차입니다.",
    outcome: "인허가 일괄처리 결과통지",
    stage: "PRE_CONSTRUCTION",
    actionType: "NOTICE",
    domain: "AI 데이터센터",
    lane: "CENTRAL_OR_REGIONAL_OFFICE",
    applicant: "AI 데이터센터 사업자 또는 AI 데이터센터를 구축·운영하려는 자",
    receivingAuthority: "과학기술정보통신부",
    statutoryDecisionMaker: "과학기술정보통신부장관 및 관계기관의 장",
    consultationAuthorities: ["개별 인허가 관계기관"],
    submissions: ["일괄처리 신청·보완 이력", "관계기관별 인허가 처리결과"],
    validity: "개별 인허가 결과와 조건의 유효기간에 따름",
    followUpObligations: ["관계기관별 허가조건 이행", "일괄처리 결과통지와 관련 서류 보관"],
    ruleIds: ["rule-aidc-one-stop-result"],
    citationIds: [
      "cit-aidc-special-act-18",
      "cit-aidc-special-act-18-9",
      "cit-aidc-special-act-10-2",
    ],
    durationId: "duration-aidc-one-stop-result",
    verificationStatus: "INTERNAL_REVIEWED",
    reviewedAt: "2026-08-21",
    reviewNote: "완료 상태는 사용자가 실제 일괄처리를 받은 사실을 확인한 경우에만 선택해야 합니다.",
    deemedByProcedureIds: [],
    deemedProcedureIds: ["ai-data-center-business-report"],
  },
  {
    id: "ai-data-center-business-report",
    name: "AI 데이터센터 입지·운영 신고",
    aliases: ["AI 데이터센터 신고"],
    description: "AI 데이터센터 사업자 또는 AI 데이터센터를 구축·운영하려는 자가 구축장소와 운영목적 등 대통령령으로 정하는 사항을 과학기술정보통신부에 신고하는 절차입니다.",
    outcome: "AI 데이터센터 신고",
    stage: "PLAN_AND_OCCUPANCY",
    actionType: "NOTICE",
    domain: "AI 데이터센터",
    lane: "CENTRAL_OR_REGIONAL_OFFICE",
    applicant: "AI 데이터센터 사업자 또는 AI 데이터센터를 구축·운영하려는 자",
    receivingAuthority: "과학기술정보통신부",
    statutoryDecisionMaker: "과학기술정보통신부장관",
    consultationAuthorities: [],
    submissions: ["구축장소(예정 장소 포함)", "운영목적", "대통령령·시행규칙에서 정할 신고사항과 서류"],
    validity: "구축장소 등 대통령령상 중요사항 변경 시 변경신고",
    followUpObligations: ["구축장소 등 중요사항 변경 시 변경신고"],
    ruleIds: [
      "rule-aidc-business-report-before-effective",
      "rule-aidc-business-report",
      "rule-aidc-business-report-not-qualified",
      "rule-aidc-business-report-deemed-by-one-stop",
    ],
    citationIds: ["cit-aidc-special-act-10", "cit-aidc-special-act-10-2"],
    durationId: "duration-aidc-business-report",
    verificationStatus: "INTERNAL_REVIEWED",
    reviewedAt: "2026-08-21",
    reviewNote: "최종 법률은 확인했으나 신고항목·서식은 하위법령 공포 후 갱신해야 합니다.",
    deemedByProcedureIds: ["ai-data-center-one-stop-result"],
    deemedProcedureIds: [],
  },
];

export const specialLawDurations: DurationEstimate[] = [
  {
    id: "duration-port-hinterland-entry-contract",
    procedureId: "port-hinterland-entry-contract",
    applicantPreparation: null,
    authorityProcessing: { min: null, base: null, max: 7, unit: "BUSINESS_DAY" },
    interagencyConsultation: null,
    elapsed: { min: null, base: null, max: 7, unit: "BUSINESS_DAY" },
    statutoryPeriod: "입주계약 신청일부터 7일 이내에 계약 체결 여부 결정·통보",
    stopClockRules: [
      "민원처리법이 적용되는 관리기관 경로에서는 6일 이상 처리기간의 첫날을 산입하고 토요일·공휴일을 제외",
      "서류 보완, 입주기업 모집·선정 등 신청 접수 전 단계는 7일에 포함되지 않음",
    ],
    variabilityFactors: [
      "항만배후단지 입주기업 모집·선정 절차",
      "입주자격 및 사업계획 심사",
      "사업시설 조성계획 보완",
      "관리기관별 계약 일정",
    ],
    evidenceType: "STATUTE",
    citationIds: [
      "cit-port-act-71-entry-contract",
      "cit-port-act-decree-72-3-duration",
      "cit-civil-petitions-act-19-time-calculation",
    ],
    sampleSize: null,
    assumptions: [
      "7일은 신청서가 관리기관에 접수된 뒤의 법정 결정 상한이며 실제 평균·최소가 아닙니다.",
      "업무일 표시는 해당 관리기관이 민원처리법상 행정기관이고 신청이 법정민원에 해당하는 경로를 전제로 하므로 접수 전 계산기준을 확인해야 합니다.",
      "변경계약 또는 관리기관별 별도 심사경로는 실제 모집공고·계약안내를 함께 확인해야 합니다.",
    ],
    verifiedAt: "2026-08-21",
    legalConfidence: "HIGH",
    estimateConfidence: "LOW",
    planningBasis: "OFFICIAL_CAP_ONLY",
    referencePeriods: [
      {
        id: "ref-port-hinterland-entry-contract-decision-cap",
        kind: "NATIONWIDE_STATUTORY",
        label: "항만배후단지 입주계약 체결 여부 결정기한",
        range: { min: null, base: null, max: 7, unit: "BUSINESS_DAY" },
        jurisdiction: null,
        startsWhen: "관리기관이 완비된 입주계약 신청을 받은 날",
        includes: ["AUTHORITY_PROCESSING", "RESULT_NOTICE"],
        citationIds: ["cit-port-act-decree-72-3-duration", "cit-civil-petitions-act-19-time-calculation"],
        sampleSize: null,
        observedFrom: null,
        observedTo: null,
        note: "입주기업 모집·선정과 신청인 준비기간은 포함하지 않는 법정 상한입니다.",
      },
    ],
  },
  {
    id: "duration-industrial-complex-occupancy-contract",
    procedureId: "industrial-complex-occupancy-contract",
    applicantPreparation: null,
    authorityProcessing: { min: null, base: null, max: 10, unit: "BUSINESS_DAY" },
    interagencyConsultation: null,
    elapsed: { min: null, base: null, max: 10, unit: "BUSINESS_DAY" },
    statutoryPeriod: "최초 입주계약은 신청일부터 5일 이내 결정, 관계기관 인허가 확인·협의가 필요하면 5일 범위 연장 가능; 변경계약은 5일 이내 결정",
    stopClockRules: [
      "민원처리법이 적용되는 관리기관 경로에서는 5일 이하 처리기간을 근무시간으로 계산",
      "신청서 보완과 관리기관 접수 전 입주자격 검토기간은 법정 결정기한과 구분",
    ],
    variabilityFactors: [
      "최초 입주계약 또는 변경계약 여부",
      "관계기관 인허가 확인·협의 필요 여부",
      "산업단지 관리기본계획과 입주업종 적합성",
      "신청서·사업계획서 보완",
    ],
    evidenceType: "STATUTE",
    citationIds: [
      "cit-indcluster-38-occupancy-contract",
      "cit-industrial-cluster-rule-34-2-duration",
      "cit-industrial-cluster-rule-35-4-duration",
      "cit-civil-petitions-act-19-time-calculation",
    ],
    sampleSize: null,
    assumptions: [
      "5일과 10일은 최초·변경계약 및 관계기관 협의 여부에 따른 법정 상한 분기이며 실제 최소·통상 범위가 아닙니다.",
      "업무일 표시는 해당 관리기관과 신청에 민원처리법이 적용되는 경로를 전제로 하므로 관리기관의 실제 계산기준을 확인해야 합니다.",
      "입주자격 사전검토와 신청인 준비기간은 포함하지 않습니다.",
    ],
    verifiedAt: "2026-08-21",
    legalConfidence: "HIGH",
    estimateConfidence: "LOW",
    planningBasis: "OFFICIAL_CAP_ONLY",
    referencePeriods: [
      {
        id: "ref-industrial-complex-occupancy-first-contract-cap",
        kind: "NATIONWIDE_STATUTORY",
        label: "최초 입주계약 기본 결정기한",
        range: { min: null, base: null, max: 5, unit: "BUSINESS_DAY" },
        jurisdiction: null,
        startsWhen: "관리기관이 최초 입주계약 신청을 받은 날",
        includes: ["AUTHORITY_PROCESSING", "RESULT_NOTICE"],
        citationIds: ["cit-industrial-cluster-rule-34-2-duration"],
        sampleSize: null,
        observedFrom: null,
        observedTo: null,
        note: "관계기관 인허가 확인·협의가 필요하지 않은 최초 계약 분기의 법정 상한입니다.",
      },
      {
        id: "ref-industrial-complex-occupancy-first-contract-extended-cap",
        kind: "NATIONWIDE_STATUTORY",
        label: "관계기관 협의 필요 시 최초 입주계약 상한",
        range: { min: null, base: null, max: 10, unit: "BUSINESS_DAY" },
        jurisdiction: null,
        startsWhen: "관리기관이 최초 입주계약 신청을 받은 날",
        includes: ["AUTHORITY_PROCESSING", "INTERAGENCY_CONSULTATION", "RESULT_NOTICE"],
        citationIds: ["cit-industrial-cluster-rule-34-2-duration"],
        sampleSize: null,
        observedFrom: null,
        observedTo: null,
        note: "관계 인허가 확인·협의 때문에 5일을 한 차례 연장한 분기의 상한입니다.",
      },
      {
        id: "ref-industrial-complex-occupancy-change-contract-cap",
        kind: "NATIONWIDE_STATUTORY",
        label: "입주 변경계약 결정기한",
        range: { min: null, base: null, max: 5, unit: "BUSINESS_DAY" },
        jurisdiction: null,
        startsWhen: "관리기관이 입주 변경계약 신청을 받은 날",
        includes: ["AUTHORITY_PROCESSING", "RESULT_NOTICE"],
        citationIds: ["cit-industrial-cluster-rule-35-4-duration"],
        sampleSize: null,
        observedFrom: null,
        observedTo: null,
        note: "변경계약 분기에 적용하는 별도 법정 상한입니다.",
      },
    ],
  },
  {
    id: "duration-power-grid-impact-assessment",
    procedureId: "power-grid-impact-assessment",
    applicantPreparation: null,
    authorityProcessing: { min: null, base: null, max: 3, unit: "MONTH" },
    interagencyConsultation: null,
    elapsed: null,
    statutoryPeriod: "검토 결과 개선필요사항등이 있는 경우 평가서 접수일부터 3개월 이내 그 사항 통보; 일반 심의완료·무조건 결과통보 총기한은 아님",
    stopClockRules: ["3개월은 전력계통영향평가서 접수일부터 계산"],
    variabilityFactors: ["계통 보강대책", "평가서 보완", "전력정책심의회 심의", "관계 전기사업자 검토"],
    evidenceType: "STATUTE",
    citationIds: [
      "cit-distributed-energy-act-23",
      "cit-distributed-energy-act-24-duration",
      "cit-distributed-energy-decree-29-objection-duration",
      "cit-grid-impact-pilot-operation-duration",
    ],
    sampleSize: null,
    assumptions: [
      "3개월은 통상 소요기간이 아니라 일반 경로의 법정 처리상한입니다.",
      "3개월은 개선필요사항등이 있는 조건부 통보기한이며 개선사항이 없는 분기의 일반 심의완료 상한으로 확대하지 않습니다.",
      "최소·통상 일정에는 상한을 실제 예상기간으로 임의 대입하지 않습니다.",
    ],
    verifiedAt: "2026-08-22",
    legalConfidence: "HIGH",
    estimateConfidence: "LOW",
    planningBasis: "OFFICIAL_CAP_ONLY",
    referencePeriods: [
      {
        id: "ref-grid-impact-statutory-cap",
        kind: "OFFICIAL_OPERATION_CAP",
        label: "개선필요사항등 조건부 통보 상한",
        range: { min: null, base: null, max: 3, unit: "MONTH" },
        jurisdiction: null,
        startsWhen: "기후에너지환경부가 전력계통영향평가서를 접수한 날",
        includes: ["AUTHORITY_PROCESSING", "INTERAGENCY_CONSULTATION", "RESULT_NOTICE"],
        citationIds: ["cit-distributed-energy-act-24-duration"],
        sampleSize: null,
        observedFrom: null,
        observedTo: null,
        note: "검토 결과 개선필요사항등이 있는 경우의 법률상 상한입니다. 일반 심의완료·무조건 결과통보 상한이 아니며 한전 사전 기술검토와 사업자 평가서 작성기간은 포함하지 않습니다.",
      },
      {
        id: "ref-grid-impact-pilot-total-cap",
        kind: "OFFICIAL_OPERATION_CAP",
        label: "현행 시범운영 순차 계획 상한",
        range: { min: null, base: null, max: 150, unit: "CALENDAR_DAY" },
        jurisdiction: null,
        startsWhen: "한전 공급가능 여부·전력공급 여유 검토 신청",
        includes: ["AUTHORITY_PROCESSING", "INTERAGENCY_CONSULTATION", "COMMITTEE_WAIT", "RESULT_NOTICE"],
        citationIds: ["cit-grid-impact-pilot-operation-duration"],
        sampleSize: null,
        observedFrom: null,
        observedTo: null,
        note: "한전 검토 최대 90일과 정식 평가·심의 최대 60일을 순차 합산한 공식 상한입니다. 평가서 작성과 보완기간은 빠져 있어 실제 총기간은 더 길 수 있습니다.",
      },
      {
        id: "ref-grid-impact-objection-filing-deadline",
        kind: "LEGAL_DEADLINE",
        label: "선택적 이의신청 제출기한",
        range: { min: null, base: null, max: 30, unit: "CALENDAR_DAY" },
        jurisdiction: null,
        startsWhen: "사업자가 개선필요사항등을 통보받은 날",
        includes: ["APPLICANT_PREPARATION"],
        citationIds: ["cit-distributed-energy-decree-29-objection-duration"],
        sampleSize: null,
        observedFrom: null,
        observedTo: null,
        note: "이의가 있는 경우에만 진행하는 선택적 후속 단계로 본 평가 총기간에 자동 합산하지 않습니다.",
      },
      {
        id: "ref-grid-impact-objection-result-basic-cap",
        kind: "PROCESS_MILESTONE",
        label: "이의신청 결과 기본 통보기한",
        range: { min: null, base: null, max: 60, unit: "CALENDAR_DAY" },
        jurisdiction: null,
        startsWhen: "기후에너지환경부장관이 이의신청을 받은 날",
        includes: ["AUTHORITY_PROCESSING", "RESULT_NOTICE"],
        citationIds: ["cit-distributed-energy-decree-29-objection-duration"],
        sampleSize: null,
        observedFrom: null,
        observedTo: null,
        note: "선택적 이의신청 분기의 기본 결과 통보기한입니다.",
      },
      {
        id: "ref-grid-impact-objection-result-extended-cap",
        kind: "LEGAL_DEADLINE",
        label: "이의신청 결과 연장 통보기한",
        range: { min: null, base: null, max: 90, unit: "CALENDAR_DAY" },
        jurisdiction: null,
        startsWhen: "기후에너지환경부장관이 이의신청을 받은 날",
        includes: ["AUTHORITY_PROCESSING", "RESULT_NOTICE"],
        citationIds: ["cit-distributed-energy-decree-29-objection-duration"],
        sampleSize: null,
        observedFrom: null,
        observedTo: null,
        note: "부득이한 사유로 한 차례 30일 연장한 선택적 후속 단계의 상한입니다.",
      },
    ],
  },
  {
    id: "duration-landscape-review",
    procedureId: "landscape-review",
    applicantPreparation: null,
    authorityProcessing: null,
    interagencyConsultation: null,
    elapsed: null,
    statutoryPeriod: "전국 공통 최종 의결·통보기한 없음. 국토교통부 지침의 위원회 개최기준과 선택 지역의 공식 민원기준을 별도 표시",
    stopClockRules: [],
    variabilityFactors: ["지역 경관계획", "관할 조례", "위원회 개최주기", "설계 보완"],
    evidenceType: "OFFICIAL_AGENCY_MATERIAL",
    citationIds: [
      "cit-landscape-act-28",
      "cit-landscape-guideline-review-timing",
      "cit-geoje-landscape-review-duration",
      "cit-goyang-landscape-schedule-duration",
      "cit-guri-landscape-operation-duration",
    ],
    sampleSize: null,
    assumptions: [
      "전국 공통 최종 의결·통보기한은 없으므로 공식 개최기준과 지역별 운영일정을 총 처리기간으로 단정하지 않습니다.",
      "지역별 접수마감, 공동·통합심의, 보완과 재심의 여부를 확인해야 합니다.",
    ],
    verifiedAt: "2026-08-22",
    legalConfidence: "MEDIUM",
    estimateConfidence: "LOW",
    planningBasis: "LOCAL_OFFICIAL_REFERENCE",
    referencePeriods: [
      {
        id: "ref-landscape-national-meeting-guideline",
        kind: "NATIONWIDE_OFFICIAL_STANDARD",
        label: "국토교통부 정식 위원회 개최기준",
        range: { min: null, base: null, max: 30, unit: "CALENDAR_DAY" },
        jurisdiction: null,
        startsWhen: "정식 경관위원회 개최 요청일",
        includes: ["COMMITTEE_WAIT"],
        citationIds: ["cit-landscape-guideline-review-timing"],
        sampleSize: null,
        observedFrom: null,
        observedTo: null,
        note: "특별한 사유가 없을 때의 위원회 개최기준이며 최종 의결·결과 통보기한은 아닙니다.",
      },
      {
        id: "ref-landscape-geoje-local-standard",
        kind: "LOCAL_OFFICIAL_STANDARD",
        label: "거제시 공식 민원 처리기준",
        range: { min: 30, base: 30, max: 30, unit: "BUSINESS_DAY" },
        jurisdiction: "거제시",
        startsWhen: "거제시 경관위원회 심의·자문 신청일",
        includes: ["AUTHORITY_PROCESSING", "COMMITTEE_WAIT"],
        citationIds: ["cit-geoje-landscape-review-duration"],
        sampleSize: null,
        observedFrom: null,
        observedTo: null,
        note: "거제시 관할에만 적용하는 공식 민원 기준입니다. 조건부 의결 후 조치확인과 재심의 기간은 별도입니다.",
      },
    ],
  },
  {
    id: "duration-building-committee-review",
    procedureId: "building-committee-review",
    applicantPreparation: null,
    authorityProcessing: null,
    interagencyConsultation: null,
    elapsed: null,
    statutoryPeriod: "초심 안건은 신청 접수일부터 30일 이내 상정, 재심 안건은 신청일부터 15일 이내 상정, 심의·재심 완료일부터 14일 이내 결과 통보. 단, 심의 회의 자체의 완료기한을 포함한 전국 공통 총 처리기간은 없음",
    stopClockRules: [],
    variabilityFactors: ["관할 건축조례", "위원회 개최주기", "구조·피난·교통 검토", "설계 보완"],
    evidenceType: "STATUTE",
    citationIds: [
      "cit-building-act-4-2",
      "cit-building-review-initial-agenda-deadline",
      "cit-building-review-reconsideration-agenda-deadline",
      "cit-building-review-result-notice-deadline",
      "cit-cheongju-building-review-duration",
    ],
    sampleSize: null,
    assumptions: [
      "30일·15일은 안건 상정기한이고 14일은 심의 완료 후 결과통보 기한이므로, 세 기간을 합산해 총 처리기간으로 표시하지 않습니다.",
      "심의 회의 실제 진행·보완·재심 기간은 별도이며, 관할 민원편람의 공식 기준이 있는 경우에만 지역 처리기간을 일정에 반영합니다.",
    ],
    verifiedAt: "2026-08-22",
    legalConfidence: "MEDIUM",
    estimateConfidence: "LOW",
    planningBasis: "MILESTONE_ONLY",
    referencePeriods: [
      {
        id: "ref-building-review-initial-agenda-deadline",
        kind: "LEGAL_DEADLINE",
        label: "초심 안건 상정기한",
        range: { min: 30, base: 30, max: 30, unit: "CALENDAR_DAY" },
        jurisdiction: null,
        startsWhen: "지방건축위원회 심의 신청 접수일",
        includes: ["COMMITTEE_WAIT"],
        citationIds: ["cit-building-review-initial-agenda-deadline"],
        sampleSize: null,
        observedFrom: null,
        observedTo: null,
        note: "심의 완료기한이 아니라 위원회에 안건을 올려야 하는 기한입니다.",
      },
      {
        id: "ref-building-review-reconsideration-agenda-deadline",
        kind: "LEGAL_DEADLINE",
        label: "재심 안건 상정기한",
        range: { min: 15, base: 15, max: 15, unit: "CALENDAR_DAY" },
        jurisdiction: null,
        startsWhen: "재심의 신청일",
        includes: ["COMMITTEE_WAIT"],
        citationIds: ["cit-building-review-reconsideration-agenda-deadline"],
        sampleSize: null,
        observedFrom: null,
        observedTo: null,
        note: "초심 30일 상정기한과 동시에 적용되는 기간이 아니라 재심의를 신청한 경우의 별도 분기입니다.",
      },
      {
        id: "ref-building-review-result-notice-deadline",
        kind: "LEGAL_DEADLINE",
        label: "심의·재심 결과 통보기한",
        range: { min: 14, base: 14, max: 14, unit: "CALENDAR_DAY" },
        jurisdiction: null,
        startsWhen: "심의 또는 재심의 완료일",
        includes: ["RESULT_NOTICE"],
        citationIds: ["cit-building-review-result-notice-deadline"],
        sampleSize: null,
        observedFrom: null,
        observedTo: null,
        note: "심의 회의가 끝난 뒤 결과를 통보하는 단계의 기한으로, 안건 상정기한에서 연속해 일률적으로 44일을 산정할 수는 없습니다.",
      },
      {
        id: "ref-building-review-cheongju-local-standard",
        kind: "LOCAL_OFFICIAL_STANDARD",
        label: "청주시 공식 민원 처리기준",
        range: { min: 30, base: 30, max: 30, unit: "BUSINESS_DAY" },
        jurisdiction: "청주시",
        startsWhen: "완비된 건축위원회 심의 신청 접수일",
        includes: ["AUTHORITY_PROCESSING", "COMMITTEE_WAIT", "RESULT_NOTICE"],
        citationIds: ["cit-cheongju-building-review-duration"],
        sampleSize: null,
        observedFrom: null,
        observedTo: null,
        note: "청주시 관할 공식 안내에 한해 적용합니다. 보완·재심의와 다른 위원회 통합심의 일정은 별도입니다.",
      },
    ],
  },
  {
    id: "duration-aidc-one-stop-application",
    procedureId: "ai-data-center-one-stop-application",
    applicantPreparation: null,
    authorityProcessing: null,
    interagencyConsultation: null,
    elapsed: null,
    statutoryPeriod: "과기정통부 사전검토·보완과 국가인공지능전략위원회 심의의 총 처리기간은 법률에 별도 상한이 없음",
    stopClockRules: ["관계기관별 150·90·40일 기본 처리기한은 과기정통부가 관계기관에 처리를 요청한 다음 날부터 시작. 주민의견 청취 또는 특별사유 시 원칙적으로 1회 30일 이내 연장 가능"],
    variabilityFactors: ["신청서류 완성도", "과기정통부 보완요구", "전략위원회 심의", "대상 인허가 수"],
    evidenceType: "STATUTE",
    citationIds: [
      "cit-aidc-special-act-18",
      "cit-aidc-special-act-18-duration-scope",
    ],
    sampleSize: null,
    assumptions: ["법에 없는 사전검토·심의기간을 임의로 생성하지 않습니다."],
    verifiedAt: "2026-08-21",
    legalConfidence: "HIGH",
    estimateConfidence: "LOW",
    planningBasis: "MILESTONE_ONLY",
    referencePeriods: [
      {
        id: "ref-aidc-one-stop-application-150-day-cap",
        kind: "NATIONWIDE_STATUTORY",
        label: "150일 대상 인허가 기본 처리기한",
        range: { min: null, base: null, max: 150, unit: "CALENDAR_DAY" },
        jurisdiction: null,
        startsWhen: "과학기술정보통신부가 관계기관에 처리를 요청한 다음 날",
        includes: ["INTERAGENCY_CONSULTATION", "RESULT_NOTICE"],
        citationIds: ["cit-aidc-special-act-18-duration-scope"],
        sampleSize: null,
        observedFrom: null,
        observedTo: null,
        note: "주민의견 청취 또는 특별한 사유가 있으면 원칙적으로 한 차례 30일 이내 연장할 수 있습니다.",
      },
      {
        id: "ref-aidc-one-stop-application-90-day-cap",
        kind: "NATIONWIDE_STATUTORY",
        label: "90일 대상 인허가 기본 처리기한",
        range: { min: null, base: null, max: 90, unit: "CALENDAR_DAY" },
        jurisdiction: null,
        startsWhen: "과학기술정보통신부가 관계기관에 처리를 요청한 다음 날",
        includes: ["INTERAGENCY_CONSULTATION", "RESULT_NOTICE"],
        citationIds: ["cit-aidc-special-act-18-duration-scope"],
        sampleSize: null,
        observedFrom: null,
        observedTo: null,
        note: "주민의견 청취 또는 특별한 사유가 있으면 원칙적으로 한 차례 30일 이내 연장할 수 있습니다.",
      },
      {
        id: "ref-aidc-one-stop-application-40-day-cap",
        kind: "NATIONWIDE_STATUTORY",
        label: "40일 대상 인허가 기본 처리기한",
        range: { min: null, base: null, max: 40, unit: "CALENDAR_DAY" },
        jurisdiction: null,
        startsWhen: "과학기술정보통신부가 관계기관에 처리를 요청한 다음 날",
        includes: ["INTERAGENCY_CONSULTATION", "RESULT_NOTICE"],
        citationIds: ["cit-aidc-special-act-18-duration-scope"],
        sampleSize: null,
        observedFrom: null,
        observedTo: null,
        note: "주민의견 청취 또는 특별한 사유가 있으면 원칙적으로 한 차례 30일 이내 연장할 수 있습니다.",
      },
      {
        id: "ref-aidc-one-stop-application-180-day-extended-cap",
        kind: "NATIONWIDE_STATUTORY",
        label: "150일 대상 인허가 30일 연장 시 상한",
        range: { min: null, base: null, max: 180, unit: "CALENDAR_DAY" },
        jurisdiction: null,
        startsWhen: "과학기술정보통신부가 관계기관에 처리를 요청한 다음 날",
        includes: ["INTERAGENCY_CONSULTATION", "RESULT_NOTICE"],
        citationIds: ["cit-aidc-special-act-18-duration-scope"],
        sampleSize: null,
        observedFrom: null,
        observedTo: null,
        note: "주민의견 청취 또는 특별한 사유가 있어 법정 30일 연장을 모두 사용한 조건부 상한입니다.",
      },
      {
        id: "ref-aidc-one-stop-application-120-day-extended-cap",
        kind: "NATIONWIDE_STATUTORY",
        label: "90일 대상 인허가 30일 연장 시 상한",
        range: { min: null, base: null, max: 120, unit: "CALENDAR_DAY" },
        jurisdiction: null,
        startsWhen: "과학기술정보통신부가 관계기관에 처리를 요청한 다음 날",
        includes: ["INTERAGENCY_CONSULTATION", "RESULT_NOTICE"],
        citationIds: ["cit-aidc-special-act-18-duration-scope"],
        sampleSize: null,
        observedFrom: null,
        observedTo: null,
        note: "주민의견 청취 또는 특별한 사유가 있어 법정 30일 연장을 모두 사용한 조건부 상한입니다.",
      },
      {
        id: "ref-aidc-one-stop-application-70-day-extended-cap",
        kind: "NATIONWIDE_STATUTORY",
        label: "40일 대상 인허가 30일 연장 시 상한",
        range: { min: null, base: null, max: 70, unit: "CALENDAR_DAY" },
        jurisdiction: null,
        startsWhen: "과학기술정보통신부가 관계기관에 처리를 요청한 다음 날",
        includes: ["INTERAGENCY_CONSULTATION", "RESULT_NOTICE"],
        citationIds: ["cit-aidc-special-act-18-duration-scope"],
        sampleSize: null,
        observedFrom: null,
        observedTo: null,
        note: "주민의견 청취 또는 특별한 사유가 있어 법정 30일 연장을 모두 사용한 조건부 상한입니다.",
      },
    ],
  },
  {
    id: "duration-aidc-one-stop-result",
    procedureId: "ai-data-center-one-stop-result",
    applicantPreparation: null,
    authorityProcessing: null,
    interagencyConsultation: null,
    elapsed: null,
    statutoryPeriod: "관계기관별 처리가 끝난 뒤 과기정통부가 결과를 통지하지만 결과통지 자체의 별도 처리기간은 법률에 정해져 있지 않음",
    stopClockRules: [],
    variabilityFactors: ["관계기관별 인허가 처리 완료일", "일괄처리 결과 통지"],
    evidenceType: "STATUTE",
    citationIds: [
      "cit-aidc-special-act-18",
      "cit-aidc-special-act-18-duration-scope",
      "cit-aidc-special-act-10-2",
    ],
    sampleSize: null,
    assumptions: ["법에 없는 결과통지 기간을 0일 또는 통상값으로 임의 산정하지 않습니다."],
    verifiedAt: "2026-08-22",
    legalConfidence: "HIGH",
    estimateConfidence: "LOW",
    planningBasis: "MILESTONE_ONLY",
    referencePeriods: [
      {
        id: "ref-aidc-one-stop-result-no-separate-deadline",
        kind: "PROCESS_MILESTONE",
        label: "결과통지 별도 기한 미규정",
        range: null,
        jurisdiction: null,
        startsWhen: "관계기관별 인허가 처리가 모두 끝난 때",
        includes: ["RESULT_NOTICE"],
        citationIds: ["cit-aidc-special-act-18-duration-scope"],
        sampleSize: null,
        observedFrom: null,
        observedTo: null,
        note: "과학기술정보통신부의 결과통지 의무는 있으나 결과통지 자체의 별도 전국 공통 기한은 정하지 않습니다.",
      },
    ],
  },
  {
    id: "duration-aidc-business-report",
    procedureId: "ai-data-center-business-report",
    applicantPreparation: null,
    authorityProcessing: null,
    interagencyConsultation: null,
    elapsed: null,
    statutoryPeriod: "신고 제출의무만 두고 별도의 수리·승인 처리기간은 정하지 않음",
    stopClockRules: [],
    variabilityFactors: ["하위법령상 신고항목·서식", "일괄처리 완료에 따른 신고 의제"],
    evidenceType: "STATUTE",
    citationIds: [
      "cit-aidc-special-act-10",
      "cit-aidc-special-act-10-duration-scope",
      "cit-aidc-special-act-10-2",
    ],
    sampleSize: null,
    assumptions: ["신고 제출일은 일정 이정표이며 0일 처리나 즉시 수리를 뜻하지 않습니다."],
    verifiedAt: "2026-08-21",
    legalConfidence: "HIGH",
    estimateConfidence: "LOW",
    planningBasis: "MILESTONE_ONLY",
    referencePeriods: [
      {
        id: "ref-aidc-business-report-submission-milestone",
        kind: "PROCESS_MILESTONE",
        label: "AI 데이터센터 신고 제출 이정표",
        range: null,
        jurisdiction: null,
        startsWhen: "법정 신고사항과 하위법령상 서류를 갖춰 신고하는 날",
        includes: ["APPLICANT_PREPARATION"],
        citationIds: ["cit-aidc-special-act-10-duration-scope"],
        sampleSize: null,
        observedFrom: null,
        observedTo: null,
        note: "법은 제출의무를 두지만 별도의 전국 공통 수리·승인 처리기한을 두지 않습니다.",
      },
    ],
  },
];

const oneStopPermitProcedureIds = [
  "power-grid-impact-assessment",
  "energy-use-plan-consultation",
  "traffic-impact-assessment",
  "landscape-review",
  "building-committee-review",
  "building-permit",
  "fire-building-permit-consent",
] as const;

export const specialLawEdges: ProcedureEdge[] = [
  {
    id: "edge-port-hinterland-entry-contract-to-building-permit",
    from: "port-hinterland-entry-contract",
    to: "building-permit",
    relation: "FINISH_TO_START",
    lag: 0,
    lagUnit: "BUSINESS_DAY",
    strength: "PRACTICAL",
    conditionRuleId: "rule-aidc-port-hinterland-entry-contract",
    citationIds: [
      "cit-aidc-special-act-23",
      "cit-port-act-71-entry-contract",
    ],
    branchId: "aidc-port-hinterland-entry-route",
    note: "입주계약의 업종·시설내용과 사업시설 조성계획 조건을 건축계획에 반영하는 통상 경로이며, 실제 병행 가능 여부는 관리기관과 건축허가권자에게 확인합니다.",
  },
  {
    id: "edge-industrial-complex-occupancy-to-completion-report",
    from: "industrial-complex-occupancy-contract",
    to: "factory-completion-report-complex",
    relation: "FINISH_TO_START",
    lag: 0,
    lagUnit: "BUSINESS_DAY",
    strength: "PRACTICAL",
    conditionRuleId: "rule-industrial-complex-occupancy-contract",
    citationIds: ["cit-indcluster-38-occupancy-contract"],
    branchId: "industrial-complex-occupancy-route",
    note: "입주계약의 승인내용과 계약조건을 반영해 공장을 설치한 뒤 완료신고로 이어지는 실행 경로를 표시합니다.",
  },
  {
    id: "edge-landscape-review-to-building-permit",
    from: "landscape-review",
    to: "building-permit",
    relation: "FINISH_TO_START",
    lag: 0,
    lagUnit: "BUSINESS_DAY",
    strength: "PRACTICAL",
    conditionRuleId: "rule-landscape-review-required",
    citationIds: ["cit-landscape-act-28"],
    branchId: null,
    note: "경관심의 결과를 건축허가도서에 반영하는 통상 경로이며 관할 통합심의 운영 여부를 확인해야 합니다.",
  },
  {
    id: "edge-building-committee-review-to-building-permit",
    from: "building-committee-review",
    to: "building-permit",
    relation: "FINISH_TO_START",
    lag: 0,
    lagUnit: "BUSINESS_DAY",
    strength: "PRACTICAL",
    conditionRuleId: "rule-building-committee-review-required",
    citationIds: ["cit-building-act-4-2"],
    branchId: null,
    note: "건축위원회 심의결과를 건축허가도서에 반영하는 통상 경로이며 관할 운영절차를 확인해야 합니다.",
  },
  ...oneStopPermitProcedureIds.map((procedureId): ProcedureEdge => ({
    id: `edge-aidc-one-stop-application-to-${procedureId}`,
    from: "ai-data-center-one-stop-application",
    to: procedureId,
    relation: "FINISH_TO_START",
    lag: 0,
    lagUnit: "CALENDAR_DAY",
    strength: "PRACTICAL",
    conditionRuleId: "rule-aidc-one-stop-application",
    citationIds: ["cit-aidc-special-act-18"],
    branchId: "aidc-one-stop-route",
    note: "과기정통부 사전검토·보완과 전략위원회 심의 뒤 관계기관 요청이 이루어지는 일괄처리 경로를 표시합니다.",
  })),
  ...oneStopPermitProcedureIds.map((procedureId): ProcedureEdge => ({
    id: `edge-aidc-${procedureId}-to-one-stop-result`,
    from: procedureId,
    to: "ai-data-center-one-stop-result",
    relation: "FINISH_TO_START",
    lag: 0,
    lagUnit: "CALENDAR_DAY",
    strength: "PRACTICAL",
    conditionRuleId: "rule-aidc-one-stop-result",
    citationIds: ["cit-aidc-special-act-18"],
    branchId: "aidc-one-stop-route",
    note: "관계기관별 처리결과가 모인 뒤 과기정통부가 일괄처리 결과를 통지하는 경로를 표시합니다.",
  })),
];

export const specialLawRuleIdsByProcedure: Record<string, string[]> = Object.fromEntries(
  [...specialLawRules, ...aiDataCenterProfileRules].reduce((entries, rule) => {
    entries.set(rule.procedureId, [...(entries.get(rule.procedureId) ?? []), rule.id]);
    return entries;
  }, new Map<string, string[]>()),
);
