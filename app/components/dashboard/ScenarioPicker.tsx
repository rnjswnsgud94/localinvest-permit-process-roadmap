import { inputLabel } from "@/app/components/dashboard/constants";
import { catalog, type ScenarioAnswers } from "@/lib/data/catalog";
import { getIndustryProfile } from "@/lib/data/industry-profiles";
import { getSpecialLawDefinition } from "@/lib/data/special-laws";
import { getOfficialLocalOrdinanceLinks } from "@/lib/regions/local-ordinances";

type InputField = {
  key: string;
  unit?: string;
};

type InputSection = {
  id: string;
  title: string;
  fields: readonly InputField[];
};

/**
 * 로드맵 판정에 사용하는 핵심 조건을 화면 순서와 무관하게 한 번씩 보여 줍니다.
 * 기존 공유 URL 호환용 기록 필드는 ScenarioAnswers에 남겨 두되 이 요약에서는 제외합니다.
 */
export const projectInputSections: readonly InputSection[] = [
  {
    id: "site",
    title: "입지",
    fields: [
      { key: "assessmentDate" },
      { key: "province" },
      { key: "city" },
      { key: "insideIndustrialComplex" },
      { key: "industrialComplexOccupancyContractStatus" },
      { key: "industrialComplexPlanSpecialCaseConfirmed" },
      { key: "industrialComplexPlanDocumentsIncluded" },
      { key: "industrialComplexPlanConsultationCompleted" },
      { key: "industrialComplexPlanApprovalPublished" },
      { key: "industrialComplexPlanApprovalPublishedDate" },
      { key: "industrialComplexPlanApprovalNoticeReference" },
      { key: "industrialComplexPlanIncludedPermitIds" },
      { key: "regionalSpecialZonePlanDeemingConfirmed" },
      { key: "regionalSpecialZonePlanDocumentsIncluded" },
      { key: "regionalSpecialZonePlanConsultationCompleted" },
      { key: "regionalSpecialZonePlanApprovalPublished" },
      { key: "regionalSpecialZonePlanApprovalPublishedDate" },
      { key: "regionalSpecialZonePlanApprovalNoticeReference" },
      { key: "regionalSpecialZonePlanIncludedPermitIds" },
      { key: "landCategory" },
      { key: "forestRestorationObligation" },
      { key: "demolitionRequired" },
      { key: "roadConnectionRequired" },
      { key: "trafficImpactAssessmentRequired" },
      { key: "landscapeReviewRequired" },
      { key: "disasterImpactAssessmentType" },
      { key: "undergroundSafetyAssessmentType" },
      { key: "nationalHeritageAssessmentType" },
      { key: "militaryProtectionConsultationRequired" },
      { key: "riverOccupationRequired" },
      { key: "publicWaterOccupationRequired" },
      { key: "waterSourceProtectionZone" },
    ],
  },
  {
    id: "investment",
    title: "업종·투자",
    fields: [
      { key: "investmentType" },
      { key: "industryCategory" },
      { key: "buildingAction" },
      { key: "buildingCommitteeReviewRequired" },
      { key: "mechanicalEquipmentActTarget" },
      { key: "totalAreaM2", unit: "㎡" },
      { key: "permitCoordination" },
      { key: "aiDataCenterActFacilityConfirmed" },
      { key: "aiDataCenterOneStopStatus" },
      { key: "appliedSpecialLawIds" },
      { key: "advancedStrategicIndustryFastTrackConfirmed" },
      { key: "advancedStrategicIndustryApplicantRoleConfirmed" },
      { key: "advancedStrategicIndustryDelayRiskConfirmed" },
      { key: "advancedStrategicIndustryCommitteeResolved" },
      { key: "advancedStrategicIndustryMinisterRequestDate" },
      { key: "advancedStrategicIndustryFastTrackPermitIds" },
      { key: "semiconductorClusterFastTrackConfirmed" },
      { key: "semiconductorClusterApplicantRoleConfirmed" },
      { key: "semiconductorClusterDelayRiskConfirmed" },
      { key: "semiconductorClusterCommitteeResolved" },
      { key: "semiconductorClusterMinisterRequestDate" },
      { key: "semiconductorClusterFastTrackPermitIds" },
      { key: "semiconductorClusterPlanDeemingConfirmed" },
      { key: "semiconductorClusterPlanDocumentsIncluded" },
      { key: "semiconductorClusterPlanConsultationCompleted" },
      { key: "semiconductorClusterPlanApprovalPublished" },
      { key: "semiconductorClusterPlanApprovalPublishedDate" },
      { key: "semiconductorClusterPlanApprovalNoticeReference" },
      { key: "semiconductorClusterPlanIncludedPermitIds" },
    ],
  },
  {
    id: "facility-environment",
    title: "시설·환경",
    fields: [
      { key: "airEmissionFacility" },
      { key: "airTotalManagementBusinessTarget" },
      { key: "supplementalPermitReviewedIds" },
      { key: "supplementalPermitTargetIds" },
      { key: "waterDischargeFacility" },
      { key: "noiseVibrationFacility" },
      { key: "wasteFacility" },
      { key: "environmentalAssessmentType" },
      { key: "integratedEnvironmentalPermitTarget" },
      { key: "powerIncreaseMw", unit: "MW" },
      { key: "waterDemandM3Day", unit: "㎥/일" },
      { key: "wastewaterM3Day", unit: "㎥/일" },
      { key: "groundwaterDevelopment" },
      { key: "publicSewerConnection" },
      { key: "privateSewageTreatmentFacility" },
      { key: "privateElectricalFacilityWork" },
      { key: "energyUsePlanRequired" },
      { key: "gridImpactAssessmentRequired" },
    ],
  },
  {
    id: "chemical-safety",
    title: "위험물·안전",
    fields: [
      { key: "chemicalsHandled" },
      { key: "chemicalManufactureOrImport" },
      { key: "hazardousChemicalBusiness" },
      { key: "chemicalRegistrationRequired" },
      { key: "restrictedOrToxicChemicalImport" },
      { key: "hazardousMaterials" },
      { key: "hazardousMaterialsTank" },
      { key: "hazardousMaterialsPreventionRulesRequired" },
      { key: "highPressureGas" },
      { key: "highPressureGasBusinessStartTarget" },
      { key: "specificHighPressureGasUse" },
      { key: "lpgSpecificUseFacility" },
      { key: "cityGasSpecificUseFacility" },
      { key: "psmCovered" },
      { key: "psmCoversSameHazardPreventionScope" },
      { key: "fireFacilityWork" },
      { key: "fireWorkSupervisionTarget" },
      { key: "firstFireSelfInspectionTarget" },
      { key: "fireSafetyManagerRequired" },
      { key: "heatUseEquipment" },
      { key: "hazardousMachineryInspectionRequired" },
      { key: "safetyManagerRequired" },
      { key: "healthManagerRequired" },
    ],
  },
  {
    id: "construction",
    title: "공사 일정",
    fields: [
      { key: "plannedConstructionStartDate" },
      { key: "plannedConstructionEndDate" },
      { key: "equipmentInstallationCompletionDate" },
      { key: "commissioningStartDate" },
      { key: "safetyManagementPlanRequired" },
      { key: "specificWorkReportRequired" },
      { key: "asbestosPresent" },
    ],
  },
] as const;

const valueLabels: Record<string, Record<string, string>> = {
  aiDataCenterOneStopStatus: {
    NOT_APPLIED: "선택 없음",
    PLANNED: "신청 예정",
    IN_PROGRESS: "심사 중",
    COMPLETED: "일괄처리 완료",
  },
  industrialComplexOccupancyContractStatus: {
    NOT_APPLIED: "미신청",
    PLANNED: "신청 예정",
    IN_PROGRESS: "협의·심사 중",
    COMPLETED: "계약 체결 완료",
  },
  investmentType: {
    NEW: "신설",
    EXPANSION: "증설",
    RELOCATION: "이전",
    PROCESS_CHANGE: "공정변경",
    INDUSTRY_CHANGE: "업종변경",
  },
  insideIndustrialComplex: {
    true: "산업단지 안",
    false: "개별입지",
  },
  industryCategory: {
    GENERAL_MANUFACTURING: "일반 제조업",
    SEMICONDUCTOR_ELECTRONICS: "반도체·전자",
    SECONDARY_BATTERY_CHEMICAL: "이차전지·화학",
  },
  buildingAction: {
    NEW_BUILD: "신축",
    EXTENSION: "증축",
    MAJOR_REPAIR: "대수선",
    CHANGE_OF_USE: "용도변경",
    NONE: "건축 없음",
  },
  landCategory: {
    OTHER: "일반 대지·공장용지 등",
    FARMLAND: "농지",
    FOREST: "산지",
  },
  permitCoordination: {
    NONE: "의제 인허가 없음",
    LOCAL_ONLY: "시·군·구 권한만 포함",
    OTHER_LT_20: "타 기관 20일 미만 인허가 포함",
    OTHER_GTE_20: "타 기관 20일 이상 인허가 포함",
  },
  environmentalAssessmentType: {
    NONE: "비대상",
    ENVIRONMENTAL: "환경영향평가 대상",
    SMALL: "소규모 환경영향평가 대상",
  },
  disasterImpactAssessmentType: {
    NONE: "비대상",
    DISASTER_IMPACT: "재해영향평가 대상",
    DISASTER_IMPACT_REVIEW: "재해영향성검토 대상",
  },
  undergroundSafetyAssessmentType: {
    NONE: "비대상",
    UNDERGROUND_SAFETY: "지하안전평가 대상",
    SMALL_UNDERGROUND_SAFETY: "소규모 지하안전평가 대상",
  },
  nationalHeritageAssessmentType: {
    NONE: "비대상",
    PRELIMINARY_CONSULTATION: "사전협의 대상",
    IMPACT_DIAGNOSIS: "영향진단 대상",
    SIMPLIFIED_DIAGNOSIS: "약식영향진단 대상",
  },
  chemicalManufactureOrImport: {
    true: "제조·수입",
    false: "국내 구매·사용",
  },
  groundwaterDevelopment: {
    true: "개발·이용",
    false: "없음",
  },
};

export function getProjectInputValue(answers: ScenarioAnswers, key: string) {
  if (
    key === "city" &&
    !answers.city &&
    answers.province === "세종특별자치시"
  ) return "세종특별자치시(광역 단층제)";
  return (answers as unknown as Record<string, unknown>)[key];
}

const industrialComplexBaseKeys = new Set([
  "industrialComplexOccupancyContractStatus",
]);
const industrialComplexPlanEvidenceKeys = new Set([
  "industrialComplexPlanDocumentsIncluded",
  "industrialComplexPlanConsultationCompleted",
  "industrialComplexPlanApprovalPublished",
  "industrialComplexPlanApprovalPublishedDate",
  "industrialComplexPlanApprovalNoticeReference",
  "industrialComplexPlanIncludedPermitIds",
]);
const regionalSpecialZoneEvidenceKeys = new Set([
  "regionalSpecialZonePlanDocumentsIncluded",
  "regionalSpecialZonePlanConsultationCompleted",
  "regionalSpecialZonePlanApprovalPublished",
  "regionalSpecialZonePlanApprovalPublishedDate",
  "regionalSpecialZonePlanApprovalNoticeReference",
  "regionalSpecialZonePlanIncludedPermitIds",
]);
const advancedFastTrackEvidenceKeys = new Set([
  "advancedStrategicIndustryApplicantRoleConfirmed",
  "advancedStrategicIndustryDelayRiskConfirmed",
  "advancedStrategicIndustryCommitteeResolved",
  "advancedStrategicIndustryMinisterRequestDate",
  "advancedStrategicIndustryFastTrackPermitIds",
]);
const semiconductorFastTrackEvidenceKeys = new Set([
  "semiconductorClusterApplicantRoleConfirmed",
  "semiconductorClusterDelayRiskConfirmed",
  "semiconductorClusterCommitteeResolved",
  "semiconductorClusterMinisterRequestDate",
  "semiconductorClusterFastTrackPermitIds",
]);
const semiconductorPlanEvidenceKeys = new Set([
  "semiconductorClusterPlanDocumentsIncluded",
  "semiconductorClusterPlanConsultationCompleted",
  "semiconductorClusterPlanApprovalPublished",
  "semiconductorClusterPlanApprovalPublishedDate",
  "semiconductorClusterPlanApprovalNoticeReference",
  "semiconductorClusterPlanIncludedPermitIds",
]);
const chemicalDetailKeys = new Set([
  "chemicalManufactureOrImport",
  "hazardousChemicalBusiness",
  "chemicalRegistrationRequired",
  "restrictedOrToxicChemicalImport",
]);

export function isProjectInputFieldVisible(
  answers: ScenarioAnswers,
  key: string,
) {
  if (
    key === "airTotalManagementBusinessTarget" &&
    answers.airEmissionFacility !== true
  ) return false;
  if (
    (key === "supplementalPermitReviewedIds" ||
      key === "supplementalPermitTargetIds") &&
    answers.supplementalPermitReviewedIds.length === 0
  ) return false;
  if (industrialComplexBaseKeys.has(key) && answers.insideIndustrialComplex !== true) return false;
  if (key === "industrialComplexPlanSpecialCaseConfirmed" && !answers.province) return false;
  if (industrialComplexPlanEvidenceKeys.has(key)) {
    return answers.industrialComplexPlanSpecialCaseConfirmed === true;
  }
  if (key === "permitCoordination" && answers.insideIndustrialComplex !== false) return false;
  if (key === "regionalSpecialZonePlanDeemingConfirmed" && !answers.province) return false;
  if (regionalSpecialZoneEvidenceKeys.has(key)) {
    return answers.regionalSpecialZonePlanDeemingConfirmed === true;
  }

  const isAdvancedIndustry = [
    "SEMICONDUCTOR_ELECTRONICS",
    "SECONDARY_BATTERY_CHEMICAL",
    "PHARMACEUTICAL_BIO",
  ].includes(answers.industryCategory);
  if (key === "advancedStrategicIndustryFastTrackConfirmed" && !isAdvancedIndustry) return false;
  if (advancedFastTrackEvidenceKeys.has(key)) {
    return isAdvancedIndustry && answers.advancedStrategicIndustryFastTrackConfirmed === true;
  }

  const isSemiconductor = answers.industryCategory === "SEMICONDUCTOR_ELECTRONICS";
  if (
    ["semiconductorClusterFastTrackConfirmed", "semiconductorClusterPlanDeemingConfirmed"].includes(key)
    && !isSemiconductor
  ) return false;
  if (semiconductorFastTrackEvidenceKeys.has(key)) {
    return isSemiconductor && answers.semiconductorClusterFastTrackConfirmed === true;
  }
  if (semiconductorPlanEvidenceKeys.has(key)) {
    return isSemiconductor && answers.semiconductorClusterPlanDeemingConfirmed === true;
  }

  const isAiDataCenter = answers.industryCategory === "AI_DATA_CENTER";
  if (["aiDataCenterActFacilityConfirmed", "appliedSpecialLawIds"].includes(key)) {
    return isAiDataCenter;
  }
  if (key === "aiDataCenterOneStopStatus") {
    return isAiDataCenter && answers.appliedSpecialLawIds.includes("AIDC_ONE_STOP");
  }

  if (chemicalDetailKeys.has(key)) return answers.chemicalsHandled === true;
  if (["hazardousMaterialsTank", "hazardousMaterialsPreventionRulesRequired"].includes(key)) {
    return answers.hazardousMaterials === true;
  }
  if (key === "highPressureGasBusinessStartTarget") return answers.highPressureGas === true;
  if (key === "psmCoversSameHazardPreventionScope") {
    return answers.psmCovered === true
      && answers.supplementalPermitTargetIds.includes("hazard-prevention-plan");
  }
  if (["fireWorkSupervisionTarget", "firstFireSelfInspectionTarget"].includes(key)) {
    return answers.fireFacilityWork === true;
  }
  if (key === "forestRestorationObligation") return answers.landCategory === "FOREST";
  if (key === "asbestosPresent") return answers.demolitionRequired === true;
  if (["equipmentInstallationCompletionDate", "commissioningStartDate"].includes(key)) {
    return Boolean(getProjectInputValue(answers, key));
  }
  if (["buildingCommitteeReviewRequired", "mechanicalEquipmentActTarget", "landscapeReviewRequired"].includes(key)) {
    return answers.buildingAction !== "NONE";
  }
  return true;
}

export function getVisibleProjectInputSections(answers: ScenarioAnswers) {
  return projectInputSections
    .map((section) => ({
      ...section,
      fields: section.fields.filter((field) => isProjectInputFieldVisible(answers, field.key)),
    }))
    .filter((section) => section.fields.length > 0);
}

export function formatProjectInputValue(
  key: string,
  value: unknown,
  unit?: string,
) {
  if (value === undefined) return "입력 항목 없음";
  if (value === null) return "미확인";
  if (value === "UNKNOWN") return "미확인";

  if (key === "industryCategory" && typeof value === "string") {
    const profile = getIndustryProfile(value);
    if (profile) return profile.label;
  }

  if (key === "appliedSpecialLawIds" && Array.isArray(value)) {
    if (!value.length) return "선택 없음";
    return value
      .map((id) => getSpecialLawDefinition(String(id) as Parameters<typeof getSpecialLawDefinition>[0])?.shortLabel ?? String(id))
      .join(" · ");
  }

  if (
    (key === "supplementalPermitReviewedIds" ||
      key === "supplementalPermitTargetIds") &&
    Array.isArray(value)
  ) {
    if (!value.length) return key === "supplementalPermitTargetIds" ? "대상 없음" : "검토 없음";
    return value
      .map((id) =>
        catalog.procedures.find((procedure) => procedure.id === id)?.name ??
        String(id),
      )
      .join(" · ");
  }

  if (key.endsWith("PermitIds") && Array.isArray(value)) {
    if (!value.length) return "선택 없음";
    return value
      .map((id) => catalog.procedures.find((procedure) => procedure.id === id)?.name ?? String(id))
      .join(" · ");
  }

  const mapped = valueLabels[key]?.[String(value)];
  if (mapped) return mapped;

  if (typeof value === "boolean") return value ? "예" : "아니오";
  if (typeof value === "number") {
    const formatted = value.toLocaleString("ko-KR", {
      maximumFractionDigits: 6,
    });
    return unit ? `${formatted} ${unit}` : formatted;
  }
  if (typeof value === "string") return value.length ? value : "미입력";
  return String(value);
}

export function ProjectInputSummary({ answers }: { answers: ScenarioAnswers }) {
  const ordinanceLinks = getOfficialLocalOrdinanceLinks(answers.province, answers.city);
  const visibleSections = getVisibleProjectInputSections(answers);
  return (
    <section className="project-input-summary" aria-labelledby="project-input-summary-title">
      <details>
      <summary className="project-input-summary-heading">
        <div>
          <h2 id="project-input-summary-title">현재 사업조건</h2>
          <p>판정에 사용한 핵심 조건 보기</p>
        </div>
        <span className="details-action" aria-hidden="true" />
      </summary>

      <div className="project-input-summary-sections">
        {visibleSections.map((section) => (
          <section
            className="project-input-summary-section"
            aria-labelledby={`project-input-section-${section.id}`}
            key={section.id}
          >
            <h3 id={`project-input-section-${section.id}`}>{section.title}</h3>
            <dl>
              {section.fields.map((field) => {
                const value = getProjectInputValue(answers, field.key);
                const state =
                  value === undefined
                    ? "absent"
                    : value === null || value === "UNKNOWN"
                      ? "unknown"
                      : value === false
                        ? "false"
                        : value === 0
                          ? "zero"
                          : "set";

                return (
                  <div data-input-key={field.key} data-input-state={state} key={field.key}>
                    <dt>{inputLabel(field.key)}</dt>
                    <dd>
                      {field.key === "province" && ordinanceLinks.province ? (
                        <a href={ordinanceLinks.province.url} target="_blank" rel="noreferrer">{ordinanceLinks.province.name}</a>
                      ) : field.key === "city" && ordinanceLinks.municipality ? (
                        <a href={ordinanceLinks.municipality.url} target="_blank" rel="noreferrer">{ordinanceLinks.municipality.name}</a>
                      ) : formatProjectInputValue(field.key, value, field.unit)}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
      </div>
      </details>
    </section>
  );
}
