import { scenarioAnswerSchema, type ScenarioAnswers } from "@/lib/data/catalog";
import { isSupportedProvince } from "@/lib/regions";

export const MAX_SHARE_STATE_LENGTH = 8_000;
export const INPUT_CODE_PREFIX = "FPR1.";
const MAX_INPUT_STATE_LENGTH = 60_000;
export const MAX_INPUT_CODE_LENGTH = 81_000;
const MAX_ARRAY_ITEMS = 250;
const ARRAY_CODEC_KEY = "ac";
const ARRAY_CODEC_VERSION = "1";
const EMPTY_ARRAY_ITEM_TOKEN = "%00";

export class ShareStateTooLongError extends RangeError {
  constructor(readonly actualLength: number) {
    super(`공유 주소 상태가 ${actualLength}자로 ${MAX_SHARE_STATE_LENGTH}자 한도를 초과했습니다.`);
    this.name = "ShareStateTooLongError";
  }
}

export class InputCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputCodeError";
  }
}

const keys: Array<[keyof ScenarioAnswers, string]> = [
  ["assessmentDate", "d"],
  ["plannedConstructionStartDate", "cs"],
  ["plannedConstructionEndDate", "ce"],
  ["equipmentInstallationCompletionDate", "eic"],
  ["commissioningStartDate", "cms"],
  ["investmentType", "it"],
  ["province", "pr"],
  ["city", "ct"],
  ["siteAddress", "addr"],
  ["siteZoning", "zone"],
  ["siteRestrictedFactors", "rf"],
  ["insideIndustrialComplex", "ic"],
  ["industrialComplexName", "icn"],
  ["industrialComplexIdentifier", "ici"],
  ["industrialComplexManagingAuthority", "icm"],
  ["industrialComplexOccupancyContractStatus", "ocs"],
  ["entryContractRegime", "ecr"],
  ["entryEligibilityConfirmed", "eec"],
  ["entryContractStatus", "ecs"],
  ["entryZoneName", "ezn"],
  ["entryManagingAuthority", "ema"],
  ["entryContractEvidence", "ece"],
  ["industryCategory", "ind"],
  ["ksicCode", "ksic"],
  ["products", "prod"],
  ["coreProcesses", "proc"],
  ["existingApprovalIds", "eai"],
  ["buildingAction", "ba"],
  ["mechanicalEquipmentActTarget", "mea"],
  ["existingAreaM2", "ex"],
  ["increaseAreaM2", "inc"],
  ["totalAreaM2", "tot"],
  ["siteDevelopmentAreaM2", "sda"],
  ["landCategory", "land"],
  ["demolitionRequired", "demo"],
  ["roadConnectionRequired", "road"],
  ["trafficImpactAssessmentRequired", "tia"],
  ["landscapeReviewRequired", "lsr"],
  ["buildingCommitteeReviewRequired", "bcr"],
  ["gridImpactAssessmentRequired", "gia"],
  ["aiDataCenterActFacilityConfirmed", "aic"],
  ["aiDataCenterOneStopStatus", "aos"],
  ["appliedSpecialLawIds", "sl"],
  ["advancedStrategicIndustryFastTrackConfirmed", "asf"],
  ["advancedStrategicIndustryApplicantRoleConfirmed", "asr"],
  ["advancedStrategicIndustryDelayRiskConfirmed", "asd"],
  ["advancedStrategicIndustryCommitteeResolved", "asc"],
  ["advancedStrategicIndustryMinisterRequestDate", "asm"],
  ["advancedStrategicIndustryFastTrackPermitIds", "aspi"],
  ["semiconductorClusterFastTrackConfirmed", "scf"],
  ["semiconductorClusterApplicantRoleConfirmed", "scr"],
  ["semiconductorClusterDelayRiskConfirmed", "scd"],
  ["semiconductorClusterCommitteeResolved", "scc"],
  ["semiconductorClusterMinisterRequestDate", "scm"],
  ["semiconductorClusterFastTrackPermitIds", "scpi"],
  ["semiconductorClusterPlanDeemingConfirmed", "scp"],
  ["semiconductorClusterPlanDocumentsIncluded", "spd"],
  ["semiconductorClusterPlanConsultationCompleted", "spc"],
  ["semiconductorClusterPlanApprovalPublished", "spp"],
  ["semiconductorClusterPlanApprovalPublishedDate", "spad"],
  ["semiconductorClusterPlanApprovalNoticeReference", "spar"],
  ["semiconductorClusterPlanIncludedPermitIds", "sppi"],
  ["industrialComplexPlanSpecialCaseConfirmed", "icp"],
  ["industrialComplexPlanDocumentsIncluded", "icd"],
  ["industrialComplexPlanConsultationCompleted", "icc"],
  ["industrialComplexPlanApprovalPublished", "ipa"],
  ["industrialComplexPlanApprovalPublishedDate", "ipad"],
  ["industrialComplexPlanApprovalNoticeReference", "ipar"],
  ["industrialComplexPlanIncludedPermitIds", "icpi"],
  ["regionalSpecialZonePlanDeemingConfirmed", "rsz"],
  ["regionalSpecialZonePlanDocumentsIncluded", "rsd"],
  ["regionalSpecialZonePlanConsultationCompleted", "rsc"],
  ["regionalSpecialZonePlanApprovalPublished", "rpa"],
  ["regionalSpecialZonePlanApprovalPublishedDate", "rpad"],
  ["regionalSpecialZonePlanApprovalNoticeReference", "rpar"],
  ["regionalSpecialZonePlanIncludedPermitIds", "rspi"],
  ["permitCoordination", "pc"],
  ["airEmissionFacility", "air"],
  ["airTotalManagementBusinessTarget", "atm"],
  ["supplementalPermitReviewedIds", "spr"],
  ["supplementalPermitTargetIds", "spt"],
  ["waterDischargeFacility", "wat"],
  ["noiseVibrationFacility", "noi"],
  ["environmentalAssessmentType", "eia"],
  ["localEnvironmentalAssessmentRequired", "leia"],
  ["integratedEnvironmentalPermitTarget", "iep"],
  ["chemicalsHandled", "chem"],
  ["chemicalManufactureOrImport", "cmi"],
  ["hazardousChemicalBusiness", "hcb"],
  ["hazardousMaterials", "haz"],
  ["highPressureGas", "hpg"],
  ["highPressureGasBusinessStartTarget", "hbs"],
  ["specificHighPressureGasUse", "shg"],
  ["lpgSpecificUseFacility", "lpg"],
  ["cityGasSpecificUseFacility", "cgs"],
  ["psmCovered", "psm"],
  ["psmCoversSameHazardPreventionScope", "pss"],
  ["fireFacilityWork", "fire"],
  ["fireWorkSupervisionTarget", "fws"],
  ["firstFireSelfInspectionTarget", "ffi"],
  ["privateElectricalFacilityWork", "pef"],
  ["energyUsePlanRequired", "eup"],
  ["groundwaterDevelopment", "gw"],
  ["disasterImpactAssessmentType", "dia"],
  ["undergroundSafetyAssessmentType", "usa"],
  ["nationalHeritageAssessmentType", "nha"],
  ["militaryProtectionConsultationRequired", "mil"],
  ["riverOccupationRequired", "riv"],
  ["publicWaterOccupationRequired", "pwo"],
  ["waterSourceProtectionZone", "wsp"],
  ["safetyManagementPlanRequired", "smp"],
  ["specificWorkReportRequired", "swr"],
  ["asbestosPresent", "asb"],
  ["publicSewerConnection", "sew"],
  ["privateSewageTreatmentFacility", "pst"],
  ["wasteFacility", "wst"],
  ["chemicalRegistrationRequired", "chr"],
  ["restrictedOrToxicChemicalImport", "cti"],
  ["fireSafetyManagerRequired", "fsm"],
  ["hazardousMaterialsTank", "hmt"],
  ["hazardousMaterialsPreventionRulesRequired", "hpr"],
  ["heatUseEquipment", "hue"],
  ["hazardousMachineryInspectionRequired", "hmi"],
  ["safetyManagerRequired", "smr"],
  ["healthManagerRequired", "hmr"],
  ["forestRestorationObligation", "fro"],
  ["powerIncreaseMw", "pow"],
  ["waterDemandM3Day", "sup"],
  ["wastewaterM3Day", "ww"],
  ["userDurationOverrides", "ud"],
];
export const SHARE_STATE_FIELDS = keys.map(([key]) => key);

const version8OnlyFields = new Set<keyof ScenarioAnswers>([
  "landscapeReviewRequired",
  "buildingCommitteeReviewRequired",
  "gridImpactAssessmentRequired",
  "aiDataCenterActFacilityConfirmed",
  "aiDataCenterOneStopStatus",
  "appliedSpecialLawIds",
]);

const version9OnlyFields = new Set<keyof ScenarioAnswers>([
  "advancedStrategicIndustryFastTrackConfirmed",
  "semiconductorClusterFastTrackConfirmed",
  "industrialComplexPlanSpecialCaseConfirmed",
  "regionalSpecialZonePlanDeemingConfirmed",
]);

const version10OnlyFields = new Set<keyof ScenarioAnswers>([
  "equipmentInstallationCompletionDate",
  "commissioningStartDate",
  "siteAddress",
  "siteZoning",
  "siteRestrictedFactors",
  "industrialComplexName",
  "industrialComplexIdentifier",
  "industrialComplexManagingAuthority",
  "industrialComplexOccupancyContractStatus",
  "ksicCode",
  "products",
  "coreProcesses",
  "existingApprovalIds",
  "industrialComplexPlanDocumentsIncluded",
  "industrialComplexPlanConsultationCompleted",
  "industrialComplexPlanIncludedPermitIds",
  "regionalSpecialZonePlanDocumentsIncluded",
  "regionalSpecialZonePlanConsultationCompleted",
  "regionalSpecialZonePlanIncludedPermitIds",
  "highPressureGasBusinessStartTarget",
  "fireWorkSupervisionTarget",
  "firstFireSelfInspectionTarget",
  "forestRestorationObligation",
  "advancedStrategicIndustryApplicantRoleConfirmed",
  "advancedStrategicIndustryDelayRiskConfirmed",
  "advancedStrategicIndustryCommitteeResolved",
  "advancedStrategicIndustryMinisterRequestDate",
  "advancedStrategicIndustryFastTrackPermitIds",
  "semiconductorClusterApplicantRoleConfirmed",
  "semiconductorClusterDelayRiskConfirmed",
  "semiconductorClusterCommitteeResolved",
  "semiconductorClusterMinisterRequestDate",
  "semiconductorClusterFastTrackPermitIds",
  "semiconductorClusterPlanDeemingConfirmed",
  "semiconductorClusterPlanDocumentsIncluded",
  "semiconductorClusterPlanConsultationCompleted",
  "semiconductorClusterPlanIncludedPermitIds",
]);

const version11OnlyFields = new Set<keyof ScenarioAnswers>([
  "semiconductorClusterPlanApprovalPublished",
  "semiconductorClusterPlanApprovalPublishedDate",
  "semiconductorClusterPlanApprovalNoticeReference",
  "industrialComplexPlanApprovalPublished",
  "industrialComplexPlanApprovalPublishedDate",
  "industrialComplexPlanApprovalNoticeReference",
  "regionalSpecialZonePlanApprovalPublished",
  "regionalSpecialZonePlanApprovalPublishedDate",
  "regionalSpecialZonePlanApprovalNoticeReference",
]);

const version12OnlyFields = new Set<keyof ScenarioAnswers>([
  "noiseVibrationFacility",
]);

const version13OnlyFields = new Set<keyof ScenarioAnswers>([
  "userDurationOverrides",
]);

const version14OnlyFields = new Set<keyof ScenarioAnswers>([
  "siteDevelopmentAreaM2",
  "localEnvironmentalAssessmentRequired",
]);

const version15OnlyFields = new Set<keyof ScenarioAnswers>([
  "entryContractRegime",
  "entryEligibilityConfirmed",
  "entryContractStatus",
  "entryZoneName",
  "entryManagingAuthority",
  "entryContractEvidence",
]);

const version2Fields: Array<[keyof ScenarioAnswers, string]> = [
  ["landCategory", "land"],
  ["demolitionRequired", "demo"],
  ["roadConnectionRequired", "road"],
  ["trafficImpactAssessmentRequired", "tia"],
  ["environmentalAssessmentType", "eia"],
  ["integratedEnvironmentalPermitTarget", "iep"],
  ["chemicalManufactureOrImport", "cmi"],
  ["hazardousChemicalBusiness", "hcb"],
  ["hazardousMaterials", "haz"],
  ["highPressureGas", "hpg"],
  ["specificHighPressureGasUse", "shg"],
  ["fireFacilityWork", "fire"],
  ["privateElectricalFacilityWork", "pef"],
  ["energyUsePlanRequired", "eup"],
  ["groundwaterDevelopment", "gw"],
];

const version3Fields: Array<[keyof ScenarioAnswers, string]> = [
  ["plannedConstructionStartDate", "cs"],
  ["plannedConstructionEndDate", "ce"],
  ["disasterImpactAssessmentType", "dia"],
  ["undergroundSafetyAssessmentType", "usa"],
  ["nationalHeritageAssessmentType", "nha"],
  ["militaryProtectionConsultationRequired", "mil"],
  ["riverOccupationRequired", "riv"],
  ["publicWaterOccupationRequired", "pwo"],
  ["waterSourceProtectionZone", "wsp"],
  ["safetyManagementPlanRequired", "smp"],
  ["specificWorkReportRequired", "swr"],
  ["asbestosPresent", "asb"],
  ["publicSewerConnection", "sew"],
  ["privateSewageTreatmentFacility", "pst"],
  ["wasteFacility", "wst"],
  ["chemicalRegistrationRequired", "chr"],
  ["restrictedOrToxicChemicalImport", "cti"],
  ["fireSafetyManagerRequired", "fsm"],
  ["hazardousMaterialsTank", "hmt"],
  ["hazardousMaterialsPreventionRulesRequired", "hpr"],
  ["heatUseEquipment", "hue"],
  ["hazardousMachineryInspectionRequired", "hmi"],
  ["safetyManagerRequired", "smr"],
  ["healthManagerRequired", "hmr"],
];

const textValueLimits: Partial<Record<keyof ScenarioAnswers, number>> = {
  siteAddress: 200,
  siteZoning: 120,
  siteRestrictedFactors: 500,
  industrialComplexName: 120,
  industrialComplexIdentifier: 80,
  industrialComplexManagingAuthority: 120,
  entryZoneName: 120,
  entryManagingAuthority: 120,
  entryContractEvidence: 300,
  ksicCode: 20,
  products: 500,
  coreProcesses: 500,
  existingApprovalIds: 500,
  semiconductorClusterPlanApprovalNoticeReference: 300,
  industrialComplexPlanApprovalNoticeReference: 300,
  regionalSpecialZonePlanApprovalNoticeReference: 300,
};

function encodeArrayItem(value: string) {
  if (value === "") return EMPTY_ARRAY_ITEM_TOKEN;
  return value.replaceAll("%", "%25").replaceAll(".", "%2E");
}

function decodeArrayItem(value: string) {
  if (value === EMPTY_ARRAY_ITEM_TOKEN) return "";
  return value.replaceAll("%2E", ".").replaceAll("%25", "%");
}

function encodeValue(
  key: keyof ScenarioAnswers,
  value: ScenarioAnswers[keyof ScenarioAnswers],
  useEscapedArrayCodec: boolean,
) {
  if (key === "userDurationOverrides") {
    const overrides = value as ScenarioAnswers["userDurationOverrides"];
    return Object.entries(overrides)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([procedureId, override]) => {
        const unit = override.unit === "BUSINESS_DAY"
          ? "b"
          : override.unit === "CALENDAR_DAY"
            ? "c"
            : "m";
        return `${procedureId}~${override.value}~${unit}`;
      })
      .join(".");
  }
  if (Array.isArray(value)) {
    return useEscapedArrayCodec
      ? value.map(encodeArrayItem).join(".")
      : value.join(".");
  }
  if (value === null) return "u";
  if (value === true) return "1";
  if (value === false) return "0";
  return String(value);
}

const arrayValueFields = new Set<keyof ScenarioAnswers>([
  "appliedSpecialLawIds",
  "industrialComplexPlanIncludedPermitIds",
  "regionalSpecialZonePlanIncludedPermitIds",
  "semiconductorClusterPlanIncludedPermitIds",
  "advancedStrategicIndustryFastTrackPermitIds",
  "semiconductorClusterFastTrackPermitIds",
  "supplementalPermitReviewedIds",
  "supplementalPermitTargetIds",
]);

const booleanValueFields = new Set<keyof ScenarioAnswers>([
  "insideIndustrialComplex",
  "entryEligibilityConfirmed",
  "mechanicalEquipmentActTarget",
  "airEmissionFacility",
  "airTotalManagementBusinessTarget",
  "waterDischargeFacility",
  "noiseVibrationFacility",
  "localEnvironmentalAssessmentRequired",
  "demolitionRequired",
  "roadConnectionRequired",
  "trafficImpactAssessmentRequired",
  "landscapeReviewRequired",
  "buildingCommitteeReviewRequired",
  "gridImpactAssessmentRequired",
  "aiDataCenterActFacilityConfirmed",
  "advancedStrategicIndustryFastTrackConfirmed",
  "advancedStrategicIndustryApplicantRoleConfirmed",
  "advancedStrategicIndustryDelayRiskConfirmed",
  "advancedStrategicIndustryCommitteeResolved",
  "semiconductorClusterFastTrackConfirmed",
  "semiconductorClusterApplicantRoleConfirmed",
  "semiconductorClusterDelayRiskConfirmed",
  "semiconductorClusterCommitteeResolved",
  "semiconductorClusterPlanDeemingConfirmed",
  "semiconductorClusterPlanDocumentsIncluded",
  "semiconductorClusterPlanConsultationCompleted",
  "semiconductorClusterPlanApprovalPublished",
  "industrialComplexPlanSpecialCaseConfirmed",
  "industrialComplexPlanDocumentsIncluded",
  "industrialComplexPlanConsultationCompleted",
  "industrialComplexPlanApprovalPublished",
  "regionalSpecialZonePlanDeemingConfirmed",
  "regionalSpecialZonePlanDocumentsIncluded",
  "regionalSpecialZonePlanConsultationCompleted",
  "regionalSpecialZonePlanApprovalPublished",
  "integratedEnvironmentalPermitTarget",
  "chemicalsHandled",
  "chemicalManufactureOrImport",
  "hazardousChemicalBusiness",
  "hazardousMaterials",
  "highPressureGas",
  "highPressureGasBusinessStartTarget",
  "specificHighPressureGasUse",
  "lpgSpecificUseFacility",
  "cityGasSpecificUseFacility",
  "psmCovered",
  "psmCoversSameHazardPreventionScope",
  "fireFacilityWork",
  "fireWorkSupervisionTarget",
  "firstFireSelfInspectionTarget",
  "privateElectricalFacilityWork",
  "energyUsePlanRequired",
  "groundwaterDevelopment",
  "militaryProtectionConsultationRequired",
  "riverOccupationRequired",
  "publicWaterOccupationRequired",
  "waterSourceProtectionZone",
  "safetyManagementPlanRequired",
  "specificWorkReportRequired",
  "asbestosPresent",
  "publicSewerConnection",
  "privateSewageTreatmentFacility",
  "wasteFacility",
  "chemicalRegistrationRequired",
  "restrictedOrToxicChemicalImport",
  "fireSafetyManagerRequired",
  "hazardousMaterialsTank",
  "hazardousMaterialsPreventionRulesRequired",
  "heatUseEquipment",
  "hazardousMachineryInspectionRequired",
  "safetyManagerRequired",
  "healthManagerRequired",
  "forestRestorationObligation",
]);

const numberValueFields = new Set<keyof ScenarioAnswers>([
  "existingAreaM2",
  "increaseAreaM2",
  "totalAreaM2",
  "siteDevelopmentAreaM2",
  "powerIncreaseMw",
  "waterDemandM3Day",
  "wastewaterM3Day",
]);

const nullableScalarFields = new Set<keyof ScenarioAnswers>([
  ...booleanValueFields,
  ...numberValueFields,
  "plannedConstructionStartDate",
  "plannedConstructionEndDate",
  "equipmentInstallationCompletionDate",
  "commissioningStartDate",
  "advancedStrategicIndustryMinisterRequestDate",
  "semiconductorClusterMinisterRequestDate",
  "semiconductorClusterPlanApprovalPublishedDate",
  "industrialComplexPlanApprovalPublishedDate",
  "regionalSpecialZonePlanApprovalPublishedDate",
  "landCategory",
  "permitCoordination",
  "environmentalAssessmentType",
  "localEnvironmentalAssessmentRequired",
  "disasterImpactAssessmentType",
  "undergroundSafetyAssessmentType",
  "nationalHeritageAssessmentType",
]);

function decodeValue(
  key: keyof ScenarioAnswers,
  value: string,
  useEscapedArrayCodec: boolean,
): string | number | boolean | string[] | null | ScenarioAnswers["userDurationOverrides"] {
  if (key === "userDurationOverrides") {
    const overrides: ScenarioAnswers["userDurationOverrides"] = {};
    if (!value) return overrides;
    for (const entry of value.split(".").slice(0, MAX_ARRAY_ITEMS)) {
      const [procedureId, rawValue, rawUnit, ...extra] = entry.split("~");
      const number = Number(rawValue);
      const unit = rawUnit === "b"
        ? "BUSINESS_DAY"
        : rawUnit === "c"
          ? "CALENDAR_DAY"
          : rawUnit === "m"
            ? "MONTH"
            : null;
      if (
        extra.length ||
        !/^[a-z0-9-]{1,100}$/.test(procedureId ?? "") ||
        !Number.isInteger(number) ||
        number < 0 ||
        number > 3_650 ||
        unit === null ||
        Object.hasOwn(overrides, procedureId)
      ) continue;
      overrides[procedureId] = { value: number, unit };
    }
    return overrides;
  }
  if (value === "u" && nullableScalarFields.has(key)) return null;
  if (arrayValueFields.has(key)) {
    const items = value ? value.split(".").slice(0, MAX_ARRAY_ITEMS) : [];
    return useEscapedArrayCodec
      ? items.map(decodeArrayItem)
      : items.filter(Boolean);
  }
  if (booleanValueFields.has(key)) {
    if (value === "1") return true;
    if (value === "0") return false;
    return null;
  }
  if (numberValueFields.has(key)) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 1_000_000_000
      ? number
      : null;
  }
  return value.slice(0, textValueLimits[key] ?? 80);
}

function encodeState(
  answers: ScenarioAnswers,
  tab: string,
  useEscapedArrayCodec = true,
) {
  const params = new URLSearchParams();
  params.set("v", "15");
  if (useEscapedArrayCodec) params.set(ARRAY_CODEC_KEY, ARRAY_CODEC_VERSION);
  for (const [key, shortKey] of keys) {
    params.set(shortKey, encodeValue(key, answers[key], useEscapedArrayCodec));
  }
  params.set("tab", tab);
  params.sort();
  return params.toString();
}

export function encodeShareState(
  answers: ScenarioAnswers,
  tab: string,
) {
  const encoded = encodeState(answers, tab);
  if (encoded.length > MAX_SHARE_STATE_LENGTH) {
    throw new ShareStateTooLongError(encoded.length);
  }
  return encoded;
}

function decodeState(
  search: string,
  fallback: ScenarioAnswers,
  maximumLength: number,
  oversizedWarning: string,
): { answers: ScenarioAnswers; tab?: string; warning?: string } {
  const encodedLength = search.startsWith("?") ? search.length - 1 : search.length;
  if (encodedLength > maximumLength) {
    return { answers: fallback, warning: oversizedWarning };
  }
  const params = new URLSearchParams(search);
  if (!params.has("v")) return { answers: fallback };
  const version = params.get("v");
  const useEscapedArrayCodec =
    params.get(ARRAY_CODEC_KEY) === ARRAY_CODEC_VERSION;
  if (!["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"].includes(version ?? "")) {
    return { answers: fallback, warning: "지원하지 않는 공유 주소 버전입니다." };
  }
  const warnings: string[] = [];
  const candidate: Record<string, unknown> = { ...fallback };
  if (!["8", "9", "10", "11", "12", "13", "14", "15"].includes(version ?? "")) {
    candidate.gridImpactAssessmentRequired = null;
    candidate.aiDataCenterActFacilityConfirmed = null;
    candidate.landscapeReviewRequired = null;
    candidate.buildingCommitteeReviewRequired = null;
    candidate.aiDataCenterOneStopStatus = "NOT_APPLIED";
    candidate.appliedSpecialLawIds = [];
    warnings.push("예전 공유 주소에는 AI 데이터센터 특례 조건이 없어 미확인·미선택 상태로 복원했습니다.");
  }
  if (!["9", "10", "11", "12", "13", "14", "15"].includes(version ?? "")) {
    for (const key of version9OnlyFields) candidate[key] = null;
    warnings.push("예전 공유 주소에는 업종·지역·산업단지 특별법 확인값이 없어 미확인 상태로 복원했습니다.");
  }
  if (!["10", "11", "12", "13", "14", "15"].includes(version ?? "")) {
    for (const key of version10OnlyFields) candidate[key] = fallback[key];
    warnings.push("예전 공유 주소에는 산단 계약·의제 증빙·세부 사업정보가 없어 기본값으로 복원했습니다.");
  }
  if (!["11", "12", "13", "14", "15"].includes(version ?? "")) {
    for (const key of version11OnlyFields) {
      candidate[key] = key.endsWith("NoticeReference") ? "" : null;
    }
    warnings.push("예전 공유 주소에는 계획 승인·고시 완료 증거가 없어 미확인 상태로 복원했습니다.");
  }
  if (!["12", "13", "14", "15"].includes(version ?? "")) {
    for (const key of version12OnlyFields) candidate[key] = null;
    warnings.push("예전 공유 주소에는 소음·진동배출시설 확인값이 없어 미확인 상태로 복원했습니다.");
  }
  if (!["13", "14", "15"].includes(version ?? "")) {
    for (const key of version13OnlyFields) candidate[key] = {};
    warnings.push("예전 공유 주소에는 사용자 예상 처리기간이 없어 공식 기준으로 복원했습니다.");
  }
  if (!["14", "15"].includes(version ?? "")) {
    for (const key of version14OnlyFields) candidate[key] = null;
    warnings.push("예전 공유 주소에는 사업·개발면적과 시·도 조례 환경영향평가 확인값이 없어 미확인 상태로 복원했습니다.");
  }
  if (version !== "15") {
    for (const key of version15OnlyFields) candidate[key] = fallback[key];
  }
  if (version === "1") {
    const missingNewFields = version2Fields.filter(([, shortKey]) => !params.has(shortKey));
    for (const [key] of missingNewFields) candidate[key] = null;
    if (missingNewFields.length) {
      warnings.push("예전 공유 주소의 신규 조건은 미확인으로 복원했습니다.");
    }
  }
  if (version === "1" || version === "2") {
    for (const [key] of version3Fields) candidate[key] = null;
    warnings.push("예전 공유 주소에는 공사 일정이 없어 미입력 상태로 복원했습니다.");
  }
  for (const [key, shortKey] of keys) {
    const value = params.get(shortKey);
    if (value === null) continue;
    if (!["8", "9", "10", "11", "12", "13", "14", "15"].includes(version ?? "") && version8OnlyFields.has(key)) continue;
    if (!["9", "10", "11", "12", "13", "14", "15"].includes(version ?? "") && version9OnlyFields.has(key)) continue;
    if (!["10", "11", "12", "13", "14", "15"].includes(version ?? "") && version10OnlyFields.has(key)) continue;
    if (!["11", "12", "13", "14", "15"].includes(version ?? "") && version11OnlyFields.has(key)) continue;
    if (!["12", "13", "14", "15"].includes(version ?? "") && version12OnlyFields.has(key)) continue;
    if (!["13", "14", "15"].includes(version ?? "") && version13OnlyFields.has(key)) continue;
    if (!["14", "15"].includes(version ?? "") && version14OnlyFields.has(key)) continue;
    if (version !== "15" && version15OnlyFields.has(key)) continue;
    if (!["6", "7", "8", "9", "10", "11", "12", "13", "14", "15"].includes(version ?? "") && key === "plannedConstructionStartDate" && /^\d{4}-\d{2}$/.test(value)) {
      candidate[key] = `${value}-01`;
      continue;
    }
    if (!["6", "7", "8", "9", "10", "11", "12", "13", "14", "15"].includes(version ?? "") && key === "plannedConstructionEndDate" && /^\d{4}-\d{2}$/.test(value)) {
      const [year, month] = value.split("-").map(Number);
      const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
      candidate[key] = end;
      continue;
    }
    candidate[key] = decodeValue(key, value, useEscapedArrayCodec);
  }
  if (!["6", "7", "8", "9", "10", "11", "12", "13", "14", "15"].includes(version ?? "") && (params.has("cs") || params.has("ce"))) {
    warnings.push("예전 공유 주소의 월 단위 공사 일정을 해당 월의 첫날과 마지막 날로 변환했습니다.");
  }
  if (candidate.environmentalAssessmentType === "LOCAL") {
    candidate.environmentalAssessmentType = "NONE";
    candidate.localEnvironmentalAssessmentRequired = true;
    warnings.push("예전 공유 주소의 시·도 조례 환경영향평가 선택값을 별도 지역평가 확인값으로 변환했습니다.");
  }
  if (version !== "15") {
    const legacyPortProcedureId = "port-hinterland-entry-contract";
    const legacyFreeTradeProcedureId = "free-trade-zone-entry-contract";
    const reviewedIds = Array.isArray(candidate.supplementalPermitReviewedIds)
      ? candidate.supplementalPermitReviewedIds.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    const targetIds = Array.isArray(candidate.supplementalPermitTargetIds)
      ? candidate.supplementalPermitTargetIds.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    const hadPortTarget = targetIds.includes(legacyPortProcedureId);
    const hadFreeTradeTarget = targetIds.includes(legacyFreeTradeProcedureId);
    candidate.supplementalPermitReviewedIds = reviewedIds.filter(
      (id) => id !== legacyPortProcedureId && id !== legacyFreeTradeProcedureId,
    );
    candidate.supplementalPermitTargetIds = targetIds.filter(
      (id) => id !== legacyPortProcedureId && id !== legacyFreeTradeProcedureId,
    );

    if (hadPortTarget !== hadFreeTradeTarget) {
      candidate.entryContractRegime = hadPortTarget
        ? "PORT_ACT"
        : "FREE_TRADE_ZONE_ACT";
      candidate.entryEligibilityConfirmed = true;
      warnings.push("예전 공유 주소에서 별도 정밀검토 항목이던 입주계약을 단일 적용 법률 입력으로 변환했습니다. 계약 진행상태와 증빙은 미입력 상태로 유지했습니다.");
    } else if (hadPortTarget && hadFreeTradeTarget) {
      candidate.entryContractRegime = "NONE";
      candidate.entryEligibilityConfirmed = null;
      warnings.push("예전 공유 주소에 항만법과 자유무역지역법 입주계약이 함께 선택되어 단일 적용 법률은 미선택으로 복원했습니다. 실제 계약 근거 법률 하나를 확인하십시오.");
    } else if (
      Array.isArray(candidate.appliedSpecialLawIds) &&
      candidate.appliedSpecialLawIds.includes("AIDC_PORT_HINTERLAND_ENTRY")
    ) {
      candidate.entryContractRegime = "PORT_ACT";
      candidate.entryEligibilityConfirmed = true;
      warnings.push("예전 공유 주소의 AI 데이터센터 항만배후단지 특례를 항만법상 입주계약 입력과 연결했습니다. 계약 진행상태와 증빙은 미입력 상태로 유지했습니다.");
    } else if (candidate.insideIndustrialComplex === true) {
      candidate.entryContractRegime = "INDUSTRIAL_COMPLEX_ACT";
      candidate.entryContractStatus =
        candidate.industrialComplexOccupancyContractStatus;
      candidate.entryZoneName = candidate.industrialComplexName;
      candidate.entryManagingAuthority =
        candidate.industrialComplexManagingAuthority;
    }
    warnings.push("예전 공유 주소에는 통합 입주계약 세부 입력이 없어 기존 산업단지 정보 또는 미입력 상태로 안전하게 복원했습니다.");
  }
  const parsed = scenarioAnswerSchema.safeParse(candidate);
  if (!parsed.success) {
    return { answers: fallback, warning: "공유 주소 일부가 올바르지 않아 기본값을 사용했습니다." };
  }
  let answers = parsed.data;
  if (answers.province !== "" && !isSupportedProvince(answers.province)) {
    const safeProvince = isSupportedProvince(fallback.province)
      ? fallback.province
      : "";
    answers = {
      ...answers,
      province: safeProvince,
      city: safeProvince ? fallback.city : "",
    };
    warnings.push("지원 범위 밖 지역이어서 기본 지역으로 복원했습니다.");
  }
  const tab = params.get("tab")?.slice(0, 30);
  return {
    answers,
    ...(tab ? { tab } : {}),
    ...(warnings.length ? { warning: warnings.join(" ") } : {}),
  };
}

export function decodeShareState(
  search: string,
  fallback: ScenarioAnswers,
): { answers: ScenarioAnswers; tab?: string; warning?: string } {
  return decodeState(
    search,
    fallback,
    MAX_SHARE_STATE_LENGTH,
    "공유 주소가 너무 길어 기본값을 사용했습니다.",
  );
}

function encodeBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8_192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8_192));
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

/**
 * FNV-1a is an accidental-corruption check, not an authentication mechanism.
 * Keeping it synchronous lets the same portable code work in every browser
 * without making the export action depend on Web Crypto availability.
 */
function inputCodeChecksum(value: string) {
  const bytes = new TextEncoder().encode(value);
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash = Math.imul(hash ^ byte, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function decodeBase64Url(value: string) {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) {
    throw new InputCodeError("입력 코드 형식이 올바르지 않습니다.");
  }
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  try {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new InputCodeError("입력 코드가 손상되어 내용을 읽을 수 없습니다.");
  }
}

/**
 * Portable, input-only envelope around the same versioned state used by share
 * URLs. The active result tab is intentionally fixed so importing never changes
 * a user's current view preference.
 */
function hasUnreviewedSupplementalTarget(answers: ScenarioAnswers) {
  const reviewedIds = new Set(answers.supplementalPermitReviewedIds);
  return answers.supplementalPermitTargetIds.some(
    (procedureId) => !reviewedIds.has(procedureId),
  );
}

function hasOrphanedPsmSameScopeAnswer(answers: ScenarioAnswers) {
  return answers.psmCoversSameHazardPreventionScope !== null
    && (
      answers.psmCovered !== true
      || !answers.supplementalPermitTargetIds.includes("hazard-prevention-plan")
    );
}

function hasStaleIndustrialWaterPlanAnswer(answers: ScenarioAnswers) {
  const procedureId = "industrial-water-master-plan-reflection-consultation";
  return answers.waterDemandM3Day === 0
    && (
      answers.supplementalPermitReviewedIds.includes(procedureId)
      || answers.supplementalPermitTargetIds.includes(procedureId)
    );
}

function hasOversizedArray(answers: ScenarioAnswers) {
  return [...arrayValueFields].some((key) => {
    const value = answers[key];
    return Array.isArray(value) && value.length > MAX_ARRAY_ITEMS;
  });
}

export function encodeInputCode(answers: ScenarioAnswers) {
  if (hasOversizedArray(answers)) {
    throw new InputCodeError(
      `선택 항목이 너무 많아 코드로 내보낼 수 없습니다. 항목별 ${MAX_ARRAY_ITEMS}개 이하로 줄여 주세요.`,
    );
  }
  if (hasUnreviewedSupplementalTarget(answers)) {
    throw new InputCodeError("정밀검토 대상 절차는 검토 완료 절차에 포함되어야 합니다.");
  }
  if (hasStaleIndustrialWaterPlanAnswer(answers)) {
    throw new InputCodeError(
      "추가 용수수요가 0이면 국가수도기본계획·수도정비계획 반영 검토값을 내보낼 수 없습니다.",
    );
  }
  if (hasOrphanedPsmSameScopeAnswer(answers)) {
    throw new InputCodeError(
      "PSM 동일설비 범위는 PSM과 유해위험방지계획서가 모두 대상일 때만 내보낼 수 있습니다.",
    );
  }
  const encodedState = encodeState(answers, "SWIMLANE");
  if (encodedState.length > MAX_INPUT_STATE_LENGTH) {
    throw new InputCodeError("입력 내용이 많아 코드로 내보낼 수 없습니다. 긴 설명이나 선택 항목을 줄여 주세요.");
  }
  const code = `${INPUT_CODE_PREFIX}${inputCodeChecksum(encodedState)}.${encodeBase64Url(encodedState)}`;
  if (code.length > MAX_INPUT_CODE_LENGTH) {
    throw new InputCodeError("입력 내용이 많아 코드로 내보낼 수 없습니다. 긴 설명이나 선택 항목을 줄여 주세요.");
  }
  return code;
}

export function decodeInputCode(
  code: string,
  fallback: ScenarioAnswers,
) {
  if (code.length > MAX_INPUT_CODE_LENGTH) {
    throw new InputCodeError("입력 코드가 허용 길이를 초과했습니다.");
  }
  const normalizedCode = code.trim();
  if (!normalizedCode.startsWith(INPUT_CODE_PREFIX)) {
    throw new InputCodeError("지원하지 않는 입력 코드입니다. FPR1.로 시작하는 코드를 사용해 주세요.");
  }
  const envelope = normalizedCode.slice(INPUT_CODE_PREFIX.length);
  const separatorIndex = envelope.indexOf(".");
  if (separatorIndex === -1 || envelope.indexOf(".", separatorIndex + 1) !== -1) {
    throw new InputCodeError("입력 코드 형식이 올바르지 않습니다.");
  }
  const checksum = envelope.slice(0, separatorIndex);
  if (!/^[0-9a-f]{8}$/.test(checksum)) {
    throw new InputCodeError("입력 코드 형식이 올바르지 않습니다.");
  }
  const encodedState = decodeBase64Url(envelope.slice(separatorIndex + 1));
  if (inputCodeChecksum(encodedState) !== checksum) {
    throw new InputCodeError("입력 코드가 변경되었거나 일부 항목이 손상되었습니다.");
  }
  if (encodedState.length > MAX_INPUT_STATE_LENGTH) {
    throw new InputCodeError("입력 코드의 데이터가 허용 길이를 초과했습니다.");
  }
  const encodedStateParams = new URLSearchParams(encodedState);
  const encodedVersion = encodedStateParams.get("v");
  const restored = decodeState(
    encodedState,
    fallback,
    MAX_INPUT_STATE_LENGTH,
    "입력 코드의 데이터가 허용 길이를 초과했습니다.",
  );
  const safeLegacyMigration =
    encodedVersion !== "15" &&
    restored.warning !== undefined &&
    ![
      "지원하지 않는",
      "올바르지 않아",
      "지원 범위 밖",
      "너무 길어",
    ].some((message) => restored.warning?.includes(message));
  if (restored.warning && !safeLegacyMigration) {
    throw new InputCodeError(
      `입력 코드를 적용할 수 없습니다. ${restored.warning.replaceAll("공유 주소", "입력 코드")}`,
    );
  }
  if (hasUnreviewedSupplementalTarget(restored.answers)) {
    throw new InputCodeError("정밀검토 대상 절차는 검토 완료 절차에 포함되어야 합니다.");
  }
  const canonicalState = encodeState(
    restored.answers,
    "SWIMLANE",
    encodedStateParams.get(ARRAY_CODEC_KEY) === ARRAY_CODEC_VERSION,
  );
  if (encodedVersion === "15" && canonicalState !== encodedState) {
    throw new InputCodeError("입력 코드가 변경되었거나 일부 항목이 손상되었습니다.");
  }
  return restored.answers;
}
