import type { ApplicabilityStatus } from "@/lib/domain/schemas";
import { supplementalPermitTargetNames } from "@/lib/data/supplemental-permit-targets";

export const stageLabels = {
  SITE_REVIEW: "입지 사전검토",
  PLAN_AND_OCCUPANCY: "계획 승인·입주",
  PRE_CONSTRUCTION: "착공 준비",
  DURING_CONSTRUCTION: "공사 중",
  PRE_OPERATION: "준공·가동 준비",
  POST_OPERATION: "가동 이후",
} as const;

export const laneLabels = {
  COMPANY: "사업자·설계·대행",
  INDUSTRIAL_COMPLEX_AUTHORITY: "산업단지 관리기관",
  CITY_COUNTY_DISTRICT: "관할 시·군·구",
  PROVINCE: "관할 시·도",
  CENTRAL_OR_REGIONAL_OFFICE: "중앙부처·특별지방행정기관",
  ENVIRONMENT_SAFETY_FIRE_UTILITY: "환경·안전·소방·공급기관",
} as const;

export const statusLabels: Record<ApplicabilityStatus, string> = {
  APPLIES: "확정 필수 절차",
  DOES_NOT_APPLY: "확인된 제외",
  POSSIBLY_APPLIES: "대상 여부 확인 필요",
  NEEDS_MORE_INFO: "추가 입력 필요",
};

export type ProcedureCategory = "REQUIRED" | "CONFIRM" | "NOT_REQUIRED";

export const procedureCategoryOrder: ProcedureCategory[] = ["REQUIRED", "CONFIRM", "NOT_REQUIRED"];

export const procedureCategorySummaries: Record<ProcedureCategory, { label: string; description: string; empty: string }> = {
  REQUIRED: {
    label: "로드맵 포함 절차",
    description: "확정 절차뿐 아니라 적용기준 확인 전 보수적으로 포함한 절차와 상위 절차에서 의제 처리할 항목도 함께 집계합니다.",
    empty: "현재 입력값으로 로드맵에 포함된 절차가 없습니다.",
  },
  CONFIRM: {
    label: "추가 확인 필요 절차",
    description: "입력 누락·규칙 충돌·적용기준 부재 또는 잠정 제외로 실제 판정이 남은 절차입니다.",
    empty: "추가로 대상 여부를 확인할 절차가 없습니다.",
  },
  NOT_REQUIRED: {
    label: "확인된 제외 절차",
    description: "현재 입력값이 검토된 제외규칙과 일치하거나 적용조건에 해당하지 않는 절차입니다.",
    empty: "현재 조건에서 확인된 제외 절차가 없습니다.",
  },
};

export type ProcedureClassificationDecision = {
  status: ApplicabilityStatus;
  provisionalEffect: "INCLUDE" | "EXCLUDE" | null;
  conflictRuleIds: readonly string[];
  missingInputs: readonly string[];
  isDeemed?: boolean;
};

/**
 * A draft rule can deterministically match the supplied facts while its legal
 * evidence is still under review. Keep that warning, but do not mislabel an
 * already scheduled route as an unanswered applicability question.
 */
export function isInputMatchedRoadmapInclusion(
  decision: ProcedureClassificationDecision,
) {
  return (
    decision.status === "POSSIBLY_APPLIES" &&
    decision.provisionalEffect === "INCLUDE" &&
    decision.missingInputs.length === 0 &&
    decision.conflictRuleIds.length === 0
  );
}

export function procedureCategoryForDecision(
  decision: ProcedureClassificationDecision,
): ProcedureCategory {
  if (
    decision.isDeemed &&
    decision.status === "DOES_NOT_APPLY" &&
    decision.provisionalEffect === "EXCLUDE" &&
    !decision.conflictRuleIds.length
  ) return "REQUIRED";
  if (decision.status === "APPLIES") return "REQUIRED";
  if (isInputMatchedRoadmapInclusion(decision)) return "REQUIRED";
  if (decision.status === "DOES_NOT_APPLY") return "NOT_REQUIRED";
  return "CONFIRM";
}

export function roadmapInclusionBreakdown(
  decisions: readonly ProcedureClassificationDecision[],
) {
  return decisions.reduce(
    (counts, decision) => {
      if (decision.isDeemed) counts.deemed += 1;
      else if (decision.status === "APPLIES") counts.confirmed += 1;
      else if (isInputMatchedRoadmapInclusion(decision)) counts.scopeCheck += 1;
      return counts;
    },
    { confirmed: 0, scopeCheck: 0, deemed: 0 },
  );
}

export const actionLabels = {
  PERMIT: "허가",
  APPROVAL: "승인",
  NOTICE: "신고",
  CONSULTATION: "협의",
  REVIEW: "심사",
  INSPECTION: "검사",
  REGISTRATION: "등록",
  CONTRACT: "계약",
} as const;

export const tabLabels = {
  SWIMLANE: "절차 흐름",
  ACTION: "실행 계획",
  LIST: "전체 절차",
  SCHEDULE: "사업 일정",
  LEGAL: "법령 근거",
  GAPS: "확인 필요",
} as const;

export type DashboardTab = keyof typeof tabLabels;

const inputLabels: Record<string, string> = {
  assessmentDate: "검토 기준일",
  plannedConstructionStartDate: "예상 공사 시작일",
  plannedConstructionEndDate: "예상 공사 종료일",
  equipmentInstallationCompletionDate: "주요 설비 설치완료 예정일",
  commissioningStartDate: "시운전 시작 예정일",
  investmentType: "투자 유형",
  "location.province": "시·도",
  "location.city": "시·군·구",
  province: "시·도",
  city: "시·군·구",
  siteAddress: "사업 부지 주소",
  siteZoning: "용도지역·지구",
  siteRestrictedFactors: "확인된 입지규제",
  "industrialComplex.inside": "산업단지 안/밖",
  insideIndustrialComplex: "입지 구분",
  "industrialComplex.name": "산업단지명",
  "industrialComplex.identifier": "산업단지 식별자",
  "industrialComplex.managingAuthority": "산업단지 관리기관",
  "industrialComplex.occupancyContractStatus": "입주계약·변경계약 상태",
  industrialComplexName: "산업단지명",
  industrialComplexIdentifier: "산업단지 식별자",
  industrialComplexManagingAuthority: "산업단지 관리기관",
  industrialComplexOccupancyContractStatus: "입주계약·변경계약 상태",
  "industry.category": "업종 유형",
  industryCategory: "업종·공정 유형",
  ksicCode: "한국표준산업분류(KSIC)",
  products: "생산품·서비스",
  coreProcesses: "핵심 공정·설비",
  existingApprovalIds: "기존 허가·신고 식별자",
  "industry.ksic": "한국표준산업분류(KSIC)",
  "industry.products": "생산제품",
  "industry.coreProcesses": "핵심 공정·설비·물질",
  "site.zoning": "용도지역·지구",
  "site.landCategory": "농지·산지·기타 부지 구분",
  landCategory: "부지 현황",
  "site.developmentAreaM2": "개발·사업 면적",
  "site.restrictedFactors": "입지 제한요인",
  "site.demolitionRequired": "기존 건축물 해체 여부",
  demolitionRequired: "기존 건축물 해체 여부",
  "site.roadConnectionRequired": "도로 직접 연결 여부",
  roadConnectionRequired: "도로 직접 연결허가 필요 여부",
  "site.trafficImpactAssessmentRequired": "교통영향평가 대상 여부",
  trafficImpactAssessmentRequired: "교통영향평가 대상 여부",
  "site.landscapeReviewRequired": "경관심의 대상 여부",
  landscapeReviewRequired: "경관심의 대상 여부",
  "building.buildingCommitteeReviewRequired": "건축위원회 심의 대상 여부",
  buildingCommitteeReviewRequired: "건축위원회 심의 대상 여부",
  "utilities.gridImpactAssessmentRequired": "전력계통영향평가 대상 여부",
  gridImpactAssessmentRequired: "전력계통영향평가 대상 여부",
  "industry.aiDataCenterActFacilityConfirmed": "특별법상 AI 데이터센터 인정요건",
  aiDataCenterActFacilityConfirmed: "특별법상 AI 데이터센터 인정요건",
  "industry.aiDataCenterOneStopStatus": "인허가 일괄처리 진행상태",
  aiDataCenterOneStopStatus: "인허가 일괄처리 진행상태",
  appliedSpecialLawIds: "적용 확인한 업종별 특례",
  advancedStrategicIndustryFastTrackConfirmed: "국가첨단전략산업 신속처리 요건",
  advancedStrategicIndustryApplicantRoleConfirmed: "전략산업 특화단지 법정 사업시행자 지위",
  advancedStrategicIndustryDelayRiskConfirmed: "전략산업 인허가 지연·현저한 지장 우려",
  advancedStrategicIndustryCommitteeResolved: "국가첨단전략산업위원회 의결",
  advancedStrategicIndustryMinisterRequestDate: "산업통상부장관 신속처리 요청일",
  advancedStrategicIndustryFastTrackPermitIds: "전략산업 신속처리 요청대상 인허가",
  semiconductorClusterFastTrackConfirmed: "반도체클러스터 신속처리 요건",
  semiconductorClusterApplicantRoleConfirmed: "반도체클러스터 법정 신청자 지위",
  semiconductorClusterDelayRiskConfirmed: "반도체 인허가 지연·현저한 지장 우려",
  semiconductorClusterCommitteeResolved: "반도체산업경쟁력강화위원회 의결",
  semiconductorClusterMinisterRequestDate: "반도체 신속처리 장관 요청일",
  semiconductorClusterFastTrackPermitIds: "반도체 신속처리 요청대상 인허가",
  semiconductorClusterPlanDeemingConfirmed: "반도체클러스터 조성계획 승인·의제 요건",
  semiconductorClusterPlanDocumentsIncluded: "반도체클러스터 계획의 인허가별 서류 포함",
  semiconductorClusterPlanConsultationCompleted: "반도체클러스터 계획 관계기관 사전협의·승인",
  semiconductorClusterPlanApprovalPublished: "반도체클러스터 계획 승인·고시 완료",
  semiconductorClusterPlanApprovalPublishedDate: "반도체클러스터 계획 승인·고시일",
  semiconductorClusterPlanApprovalNoticeReference: "반도체클러스터 계획 고시문 근거",
  semiconductorClusterPlanIncludedPermitIds: "반도체클러스터 계획의 실제 의제 인허가",
  industrialComplexPlanSpecialCaseConfirmed: "산업단지계획 통합승인·의제 요건",
  industrialComplexPlanDocumentsIncluded: "산업단지계획의 인허가별 서류 포함",
  industrialComplexPlanConsultationCompleted: "산업단지계획 관계기관 협의 완료",
  industrialComplexPlanApprovalPublished: "산업단지계획 승인·고시 완료",
  industrialComplexPlanApprovalPublishedDate: "산업단지계획 승인·고시일",
  industrialComplexPlanApprovalNoticeReference: "산업단지계획 고시문 근거",
  industrialComplexPlanIncludedPermitIds: "산업단지계획의 실제 의제 인허가",
  regionalSpecialZonePlanDeemingConfirmed: "지역특화발전특구계획 의제 요건",
  regionalSpecialZonePlanDocumentsIncluded: "특화특구계획의 인허가별 서류 포함",
  regionalSpecialZonePlanConsultationCompleted: "특화특구계획 관계기관 사전협의 완료",
  regionalSpecialZonePlanApprovalPublished: "특화특구계획 승인·고시 완료",
  regionalSpecialZonePlanApprovalPublishedDate: "특화특구계획 승인·고시일",
  regionalSpecialZonePlanApprovalNoticeReference: "특화특구계획 고시문 근거",
  regionalSpecialZonePlanIncludedPermitIds: "특화특구계획의 실제 의제 인허가",
  "site.disasterImpactAssessmentType": "재해영향평가등 협의 유형",
  disasterImpactAssessmentType: "재해영향평가등 협의 검토 결과",
  "site.undergroundSafetyAssessmentType": "지하안전평가 유형",
  undergroundSafetyAssessmentType: "지하안전평가 검토 결과",
  "site.nationalHeritageAssessmentType": "국가유산 영향 검토 유형",
  nationalHeritageAssessmentType: "국가유산 영향 검토 결과",
  "site.militaryProtectionConsultationRequired": "군사시설 보호구역 협의 여부",
  militaryProtectionConsultationRequired: "군사시설 보호구역 협의 여부",
  "site.riverOccupationRequired": "하천점용허가 필요 여부",
  riverOccupationRequired: "하천점용허가 필요 여부",
  "site.publicWaterOccupationRequired": "공유수면 점용·사용허가 필요 여부",
  publicWaterOccupationRequired: "공유수면 점용·사용허가 필요 여부",
  "site.waterSourceProtectionZone": "상수원보호구역 해당 여부",
  waterSourceProtectionZone: "상수원보호구역 해당 여부",
  "site.groundwaterDevelopment": "지하수 개발·이용 여부",
  groundwaterDevelopment: "지하수 개발·이용 여부",
  "building.action": "건축행위",
  buildingAction: "건축행위",
  "building.mechanicalEquipmentActTarget": "기계설비법 확인·검사 대상 여부",
  mechanicalEquipmentActTarget: "기계설비법 확인·검사 대상 여부",
  existingAreaM2: "기존 건축물 연면적",
  increaseAreaM2: "증가 연면적",
  totalAreaM2: "사업 후 건축물 연면적",
  "building.totalAreaM2": "사업 후 건축물 연면적",
  "building.fireFacilityWork": "소방시설공사 대상 여부",
  fireFacilityWork: "소방시설공사 대상 여부",
  "environment.airEmissionFacility": "대기배출시설 해당 여부",
  airEmissionFacility: "대기배출시설 해당 여부",
  "environment.airTotalManagementBusinessTarget": "대기 총량관리사업장 설치허가 대상 여부",
  airTotalManagementBusinessTarget: "대기 총량관리사업장 설치허가 대상 여부",
  supplementalPermitReviewedIds: "공사·환경 정밀검토 완료 항목",
  supplementalPermitTargetIds: "정밀검토 결과 대상 절차",
  "environment.waterDischargeFacility": "폐수배출시설 해당 여부",
  waterDischargeFacility: "폐수배출시설 해당 여부",
  "environment.noiseVibrationFacility": "소음·진동배출시설 해당 여부",
  noiseVibrationFacility: "소음·진동배출시설 해당 여부",
  "environment.wasteFacility": "폐기물 종류·발생량",
  wasteFacility: "폐기물처리시설 설치 여부",
  "environment.chemicalsHandled": "화학물질 취급 여부",
  chemicalsHandled: "화학물질 취급 여부",
  "environment.chemicalManufactureOrImport": "화학물질·혼합물 직접 제조·수입 여부",
  chemicalManufactureOrImport: "화학물질·혼합물 직접 제조·수입 여부",
  "environment.environmentalAssessmentType": "환경영향평가 유형",
  environmentalAssessmentType: "환경영향평가 검토 결과",
  "environment.integratedPermitTarget": "통합환경허가 대상 여부",
  integratedEnvironmentalPermitTarget: "통합환경허가 대상 여부",
  "environment.hazardousChemicalBusiness": "유해화학물질 영업허가 대상 여부",
  hazardousChemicalBusiness: "유해화학물질 영업허가 대상 여부",
  "environment.chemicalRegistrationRequired": "화학물질 등록·신고 대상 여부",
  chemicalRegistrationRequired: "화학물질 등록·신고 대상 여부",
  "environment.restrictedOrToxicChemicalImport": "제한·금지·유독물질 수입허가·신고 대상 여부",
  restrictedOrToxicChemicalImport: "제한·금지·유독물질 수입허가·신고 대상 여부",
  "safety.hazardousMaterials": "지정수량 이상 위험물 여부",
  hazardousMaterials: "지정수량 이상 위험물 취급 여부",
  "safety.hazardousMaterialsTank": "위험물 탱크 설치 여부",
  hazardousMaterialsTank: "위험물 탱크 설치 여부",
  "safety.hazardousMaterialsPreventionRulesRequired": "위험물 예방규정 작성 대상 여부",
  hazardousMaterialsPreventionRulesRequired: "위험물 예방규정 작성 대상 여부",
  "safety.highPressureGas": "허가·신고 대상 고압가스 여부",
  highPressureGas: "허가·신고 대상 고압가스 여부",
  highPressureGasBusinessStartTarget: "고압가스 사업·저장소 개시신고 대상 확인",
  "safety.specificHighPressureGasUse": "특정고압가스 사용신고 대상 여부",
  specificHighPressureGasUse: "특정고압가스 사용신고 대상 여부",
  "safety.lpgSpecificUseFacility": "LPG 특정사용시설 완성검사 대상 여부",
  lpgSpecificUseFacility: "LPG 특정사용시설 완성검사 대상 여부",
  "safety.cityGasSpecificUseFacility": "도시가스 특정사용시설 완성검사 대상 여부",
  cityGasSpecificUseFacility: "도시가스 특정사용시설 완성검사 대상 여부",
  "safety.psmCovered": "PSM 대상 여부",
  psmCovered: "공정안전보고서(PSM) 대상 여부",
  "safety.psmCoversSameHazardPreventionScope": "PSM 동일 유해·위험설비 포함 여부",
  psmCoversSameHazardPreventionScope: "PSM 동일 유해·위험설비 포함 여부",
  fireWorkSupervisionTarget: "소방공사 감리자 지정신고 대상 확인",
  firstFireSelfInspectionTarget: "최초 소방시설 자체점검·결과보고 대상 확인",
  forestRestorationObligation: "산지 복구의무·면제 확인",
  "safety.fireSafetyManagerRequired": "소방안전관리자 선임 대상 여부",
  fireSafetyManagerRequired: "소방안전관리자 선임 대상 여부",
  "safety.heatUseEquipment": "검사대상 열사용기자재 설치 여부",
  heatUseEquipment: "검사대상 열사용기자재 설치 여부",
  "safety.hazardousMachineryInspectionRequired": "유해·위험기계 안전검사 대상 여부",
  hazardousMachineryInspectionRequired: "유해·위험기계 안전검사 대상 여부",
  "construction.safetyManagementPlanRequired": "건설공사 안전관리계획 대상 여부",
  safetyManagementPlanRequired: "건설공사 안전관리계획 대상 여부",
  "construction.specificWorkReportRequired": "유해·위험 작업 신고 대상 여부",
  specificWorkReportRequired: "유해·위험 작업 신고 대상 여부",
  "construction.asbestosPresent": "석면 함유 자재 여부",
  asbestosPresent: "석면 함유 자재 여부",
  "utilities.powerIncreaseMw": "전력 증가분",
  powerIncreaseMw: "전력 증가분",
  "utilities.waterDemandM3Day": "용수 수요",
  waterDemandM3Day: "용수 수요",
  "utilities.wastewaterM3Day": "폐수 발생량",
  wastewaterM3Day: "폐수 발생량",
  "confirmation.highPressureGasBusinessStartTarget": "관할기관의 고압가스 사업·저장소 개시신고 대상 확인",
  "confirmation.fireWorkSupervisionTarget": "관할 소방기관의 소방공사 감리대상 확인",
  "confirmation.firstFireSelfInspectionTarget": "관할 소방기관의 최초 자체점검·결과보고 대상 확인",
  "confirmation.forestRestorationObligation": "산지전용 허가권자의 복구의무·면제 여부 확인",
  "utilities.privateElectricalFacilityWork": "자가용전기설비 공사·사용전검사 대상 여부",
  privateElectricalFacilityWork: "자가용전기설비 공사·사용전검사 대상 여부",
  "utilities.energyUsePlanRequired": "에너지사용계획 대상 여부",
  energyUsePlanRequired: "에너지사용계획 협의 대상 여부",
  "utilities.publicSewerConnection": "공공하수도 연결 여부",
  publicSewerConnection: "공공하수도 연결 여부",
  "utilities.privateSewageTreatmentFacility": "개인하수처리시설 설치 여부",
  privateSewageTreatmentFacility: "개인하수처리시설 설치 여부",
  "organization.safetyManagerRequired": "안전관리자 선임 대상 여부",
  safetyManagerRequired: "안전관리자 선임 대상 여부",
  "organization.healthManagerRequired": "보건관리자 선임 대상 여부",
  healthManagerRequired: "보건관리자 선임 대상 여부",
  permitCoordination: "공장설립 승인 의제협의 범위",
};

export function inputLabel(path: string) {
  const supplementalPrefix = "confirmation.supplementalPermitTargets.";
  if (path.startsWith(supplementalPrefix)) {
    const id = path.slice(supplementalPrefix.length);
    return `공사·환경 정밀검토 · ${supplementalPermitTargetNames[id as keyof typeof supplementalPermitTargetNames] ?? id}`;
  }
  const specialLawPrefix = "confirmation.specialLawProcessTokens.";
  if (path.startsWith(specialLawPrefix)) {
    const id = path.slice(specialLawPrefix.length);
    const labels: Record<string, string> = {
      ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK: "국가첨단전략산업 신속처리 요건",
      SEMICONDUCTOR_CLUSTER_FAST_TRACK: "반도체클러스터 신속처리 요건",
      SEMICONDUCTOR_CLUSTER_PLAN_DEEMING: "반도체클러스터 조성계획 승인·의제 요건",
      INDUSTRIAL_COMPLEX_PLAN_INTEGRATED_APPROVAL: "산업단지계획 통합승인·의제 요건",
      REGIONAL_SPECIAL_ZONE_PLAN_DEEMING: "지역특화발전특구계획 승인·의제 요건",
    };
    return labels[id] ?? "특별법 절차요건";
  }
  return inputLabels[path] ?? path;
}
