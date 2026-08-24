import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  procedureCategoryForDecision,
  type ProcedureCategory,
} from "@/app/components/dashboard/constants";
import { renderPermitReportPdf } from "@/app/components/dashboard/pdf/generate-permit-report-pdf";
import { buildPermitReportModel } from "@/app/components/dashboard/pdf/permit-report-model";
import {
  catalog,
  scenarioAnswerSchema,
  type ScenarioAnswers,
} from "@/lib/data/catalog";
import {
  constructionEnvironmentSupplementalPermitTargetIds,
  supplementalPermitTargetIds,
  type SupplementalPermitTargetId,
} from "@/lib/data/supplemental-permit-targets";
import { evaluateProject } from "@/lib/engine/pipeline";

type Evaluation = ReturnType<typeof evaluateProject>;

const reportFontsPromise = Promise.all([
  readFile(resolve("public/fonts/nanum-gothic-coding/NanumGothicCoding-Regular.ttf")),
  readFile(resolve("public/fonts/nanum-gothic-coding/NanumGothicCoding-Bold.ttf")),
]).then(([regular, bold]) => ({ regular, bold }));

type InvestmentRegressionCase = {
  name: string;
  answers: ScenarioAnswers;
  include: readonly string[];
  exclude: readonly string[];
  deemed: readonly string[];
  orderedPairs: readonly (readonly [string, string])[];
  completionProcedureId: string;
  completedCheckpoints?: readonly {
    procedureId: string;
    label: string;
  }[];
  normalizedCity?: string;
  specialLawStatuses?: Readonly<Record<string, string>>;
};

const reviewedBase = scenarioAnswerSchema.parse({
  ...catalog.scenarios[0].answers,
  assessmentDate: "2026-08-21",
  plannedConstructionStartDate: "2027-03-01",
  plannedConstructionEndDate: "2029-02-28",
  equipmentInstallationCompletionDate: "2028-10-31",
  commissioningStartDate: "2028-11-01",
  investmentType: "NEW",
  province: "충청남도",
  city: "아산시",
  siteAddress: "검증용 사업부지",
  siteZoning: "도시지역",
  siteRestrictedFactors: "검토 완료",
  insideIndustrialComplex: false,
  industrialComplexName: "",
  industrialComplexIdentifier: "",
  industrialComplexManagingAuthority: "",
  industrialComplexOccupancyContractStatus: "NOT_APPLIED",
  industryCategory: "GENERAL_MANUFACTURING",
  ksicCode: "",
  products: "검증용 생산품",
  coreProcesses: "검증용 제조공정",
  existingApprovalIds: "기존 승인 검토 완료",
  buildingAction: "NEW_BUILD",
  mechanicalEquipmentActTarget: false,
  existingAreaM2: 0,
  increaseAreaM2: 10_000,
  totalAreaM2: 10_000,
  landCategory: "OTHER",
  demolitionRequired: false,
  roadConnectionRequired: false,
  trafficImpactAssessmentRequired: false,
  landscapeReviewRequired: false,
  buildingCommitteeReviewRequired: false,
  gridImpactAssessmentRequired: false,
  aiDataCenterActFacilityConfirmed: false,
  aiDataCenterOneStopStatus: "NOT_APPLIED",
  appliedSpecialLawIds: [],
  advancedStrategicIndustryFastTrackConfirmed: false,
  advancedStrategicIndustryApplicantRoleConfirmed: false,
  advancedStrategicIndustryDelayRiskConfirmed: false,
  advancedStrategicIndustryCommitteeResolved: false,
  advancedStrategicIndustryMinisterRequestDate: null,
  advancedStrategicIndustryFastTrackPermitIds: [],
  semiconductorClusterFastTrackConfirmed: false,
  semiconductorClusterApplicantRoleConfirmed: false,
  semiconductorClusterDelayRiskConfirmed: false,
  semiconductorClusterCommitteeResolved: false,
  semiconductorClusterMinisterRequestDate: null,
  semiconductorClusterFastTrackPermitIds: [],
  semiconductorClusterPlanDeemingConfirmed: false,
  semiconductorClusterPlanDocumentsIncluded: false,
  semiconductorClusterPlanConsultationCompleted: false,
  semiconductorClusterPlanApprovalPublished: false,
  semiconductorClusterPlanApprovalPublishedDate: null,
  semiconductorClusterPlanApprovalNoticeReference: "",
  semiconductorClusterPlanIncludedPermitIds: [],
  industrialComplexPlanSpecialCaseConfirmed: false,
  industrialComplexPlanDocumentsIncluded: false,
  industrialComplexPlanConsultationCompleted: false,
  industrialComplexPlanApprovalPublished: false,
  industrialComplexPlanApprovalPublishedDate: null,
  industrialComplexPlanApprovalNoticeReference: "",
  industrialComplexPlanIncludedPermitIds: [],
  regionalSpecialZonePlanDeemingConfirmed: false,
  regionalSpecialZonePlanDocumentsIncluded: false,
  regionalSpecialZonePlanConsultationCompleted: false,
  regionalSpecialZonePlanApprovalPublished: false,
  regionalSpecialZonePlanApprovalPublishedDate: null,
  regionalSpecialZonePlanApprovalNoticeReference: "",
  regionalSpecialZonePlanIncludedPermitIds: [],
  permitCoordination: "OTHER_LT_20",
  airEmissionFacility: false,
  airTotalManagementBusinessTarget: false,
  supplementalPermitReviewedIds: [...supplementalPermitTargetIds],
  supplementalPermitTargetIds: [],
  waterDischargeFacility: false,
  noiseVibrationFacility: false,
  environmentalAssessmentType: "NONE",
  integratedEnvironmentalPermitTarget: false,
  chemicalsHandled: false,
  chemicalManufactureOrImport: false,
  hazardousChemicalBusiness: false,
  hazardousMaterials: false,
  highPressureGas: false,
  highPressureGasBusinessStartTarget: false,
  specificHighPressureGasUse: false,
  lpgSpecificUseFacility: false,
  cityGasSpecificUseFacility: false,
  psmCovered: false,
  psmCoversSameHazardPreventionScope: null,
  fireFacilityWork: true,
  fireWorkSupervisionTarget: false,
  firstFireSelfInspectionTarget: false,
  privateElectricalFacilityWork: true,
  energyUsePlanRequired: false,
  groundwaterDevelopment: false,
  disasterImpactAssessmentType: "NONE",
  undergroundSafetyAssessmentType: "NONE",
  nationalHeritageAssessmentType: "NONE",
  militaryProtectionConsultationRequired: false,
  riverOccupationRequired: false,
  publicWaterOccupationRequired: false,
  waterSourceProtectionZone: false,
  safetyManagementPlanRequired: true,
  specificWorkReportRequired: true,
  asbestosPresent: false,
  publicSewerConnection: true,
  privateSewageTreatmentFacility: false,
  wasteFacility: false,
  chemicalRegistrationRequired: false,
  restrictedOrToxicChemicalImport: false,
  fireSafetyManagerRequired: true,
  hazardousMaterialsTank: false,
  hazardousMaterialsPreventionRulesRequired: false,
  heatUseEquipment: false,
  hazardousMachineryInspectionRequired: true,
  safetyManagerRequired: true,
  healthManagerRequired: true,
  forestRestorationObligation: false,
  powerIncreaseMw: 5,
  waterDemandM3Day: 100,
  wastewaterM3Day: 50,
});

function investmentAnswers(overrides: Partial<ScenarioAnswers>) {
  return scenarioAnswerSchema.parse({
    ...reviewedBase,
    ...overrides,
  });
}

function decision(evaluation: Evaluation, procedureId: string) {
  const result = evaluation.decisions.find(
    (item) => item.procedure.id === procedureId,
  );
  if (!result) throw new Error(`Missing procedure decision: ${procedureId}`);
  return result;
}

const cases: readonly InvestmentRegressionCase[] = [
  {
    name: "부산 기장 식품 산단 신설·폐수",
    answers: investmentAnswers({
      province: "부산광역시",
      city: "기장군",
      insideIndustrialComplex: true,
      industrialComplexName: "기장 검증산업단지",
      industrialComplexIdentifier: "BUSAN-FOOD-01",
      industrialComplexManagingAuthority: "검증 산업단지 관리기관",
      industrialComplexOccupancyContractStatus: "COMPLETED",
      industryCategory: "FOOD_BEVERAGE_TOBACCO",
      increaseAreaM2: 7_000,
      totalAreaM2: 7_000,
      waterDischargeFacility: true,
      noiseVibrationFacility: true,
      energyUsePlanRequired: true,
      waterDemandM3Day: 1_000,
      wastewaterM3Day: 800,
      supplementalPermitTargetIds: [
        "fugitive-dust-business-report",
        "nonpoint-source-installation-report",
        "business-waste-generator-report",
        "construction-waste-plan-report",
        "hazard-prevention-plan",
        "odor-emission-facility-report",
        "water-tank-installation-report",
        "building-energy-saving-plan-review",
        "elevator-installation-report",
        "information-communication-design-confirmation",
        "information-communication-pre-use-inspection",
      ],
    }),
    include: [
      "industrial-complex-occupancy-contract",
      "water-discharge-installation-permit",
      "water-facility-operation-start-report",
      "business-waste-generator-report",
      "hazard-prevention-plan",
      "odor-emission-facility-report",
      "water-tank-installation-report",
      "building-energy-saving-plan-review",
      "elevator-installation-report",
      "elevator-installation-inspection",
      "information-communication-design-confirmation",
      "information-communication-pre-use-inspection",
      "factory-completion-report-complex",
    ],
    exclude: [
      "air-emission-installation-permit",
      "air-total-management-business-permit",
      "integrated-environmental-permit",
      "noise-vibration-facility-report",
      "factory-completion-report-offsite",
    ],
    deemed: ["factory-establishment-approval"],
    orderedPairs: [
      ["industrial-complex-occupancy-contract", "factory-completion-report-complex"],
      ["water-discharge-installation-permit", "water-facility-operation-start-report"],
      ["building-permit", "construction-start-report"],
      ["construction-start-report", "information-communication-pre-use-inspection"],
      ["information-communication-pre-use-inspection", "building-use-approval"],
      ["building-use-approval", "factory-completion-report-complex"],
    ],
    completionProcedureId: "factory-completion-report-complex",
    completedCheckpoints: [
      {
        procedureId: "industrial-complex-occupancy-contract",
        label: "산업단지 입주계약 체결 완료",
      },
    ],
  },
  {
    name: "충북 청주 반도체 산단 증설·통합환경·PSM",
    answers: investmentAnswers({
      investmentType: "EXPANSION",
      province: "충청북도",
      city: "청주시",
      insideIndustrialComplex: true,
      industrialComplexName: "청주 반도체산업단지",
      industrialComplexIdentifier: "CHEONGJU-SEMI-01",
      industrialComplexManagingAuthority: "검증 산업단지 관리기관",
      industrialComplexOccupancyContractStatus: "COMPLETED",
      industryCategory: "SEMICONDUCTOR_ELECTRONICS",
      buildingAction: "EXTENSION",
      existingAreaM2: 80_000,
      increaseAreaM2: 30_000,
      totalAreaM2: 110_000,
      permitCoordination: "OTHER_GTE_20",
      trafficImpactAssessmentRequired: true,
      buildingCommitteeReviewRequired: true,
      gridImpactAssessmentRequired: true,
      airEmissionFacility: true,
      airTotalManagementBusinessTarget: true,
      waterDischargeFacility: true,
      noiseVibrationFacility: true,
      integratedEnvironmentalPermitTarget: true,
      chemicalsHandled: true,
      chemicalManufactureOrImport: true,
      hazardousChemicalBusiness: true,
      chemicalRegistrationRequired: true,
      restrictedOrToxicChemicalImport: true,
      hazardousMaterials: true,
      hazardousMaterialsTank: true,
      hazardousMaterialsPreventionRulesRequired: true,
      highPressureGas: true,
      highPressureGasBusinessStartTarget: true,
      specificHighPressureGasUse: true,
      psmCovered: true,
      psmCoversSameHazardPreventionScope: true,
      energyUsePlanRequired: true,
      powerIncreaseMw: 80,
      waterDemandM3Day: 6_000,
      wastewaterM3Day: 4_000,
      supplementalPermitTargetIds: [
        "fugitive-emission-facility-report",
        "fugitive-dust-business-report",
        "nonpoint-source-installation-report",
        "business-waste-generator-report",
        "designated-waste-plan-confirmation",
        "construction-waste-plan-report",
        "soil-contamination-facility-report",
        "hazard-prevention-plan",
        "chemical-emission-reduction-plan-review",
        "gas-pipeline-excavation-confirmation",
        "information-communication-design-confirmation",
        "information-communication-supervisor-assignment-report",
        "building-structure-construction-report",
      ],
    }),
    include: [
      "industrial-complex-occupancy-contract",
      "air-total-management-business-permit",
      "integrated-environmental-permit",
      "integrated-environmental-operation-start-report",
      "fugitive-emission-facility-report",
      "chemical-accident-prevention-plan",
      "hazardous-chemical-facility-inspection",
      "hazardous-chemical-business-permit",
      "process-safety-report",
      "chemical-emission-reduction-plan-review",
      "gas-pipeline-excavation-confirmation",
      "information-communication-design-confirmation",
      "information-communication-supervisor-assignment-report",
      "information-communication-supervision-result-submission",
      "building-structure-construction-report",
      "factory-completion-report-complex",
    ],
    exclude: [
      "factory-completion-report-offsite",
      "information-communication-pre-use-inspection",
    ],
    deemed: [
      "factory-establishment-approval",
      "air-emission-installation-permit",
      "air-facility-operation-start-report",
      "water-discharge-installation-permit",
      "water-facility-operation-start-report",
      "noise-vibration-facility-report",
      "hazard-prevention-plan",
    ],
    orderedPairs: [
      ["integrated-environmental-permit", "integrated-environmental-operation-start-report"],
      ["chemical-accident-prevention-plan", "hazardous-chemical-facility-inspection"],
      ["hazardous-chemical-facility-inspection", "hazardous-chemical-business-permit"],
      ["information-communication-supervisor-assignment-report", "information-communication-supervision-result-submission"],
      ["information-communication-supervision-result-submission", "building-use-approval"],
      ["industrial-complex-occupancy-contract", "factory-completion-report-complex"],
    ],
    completionProcedureId: "factory-completion-report-complex",
    completedCheckpoints: [
      {
        procedureId: "industrial-complex-occupancy-contract",
        label: "산업단지 입주계약 체결 완료",
      },
    ],
  },
  {
    name: "전북 군산 이차전지 개별입지·환경영향평가·유해화학",
    answers: investmentAnswers({
      province: "전북특별자치도",
      city: "군산시",
      industryCategory: "SECONDARY_BATTERY_CHEMICAL",
      increaseAreaM2: 65_000,
      totalAreaM2: 65_000,
      landCategory: "FARMLAND",
      roadConnectionRequired: true,
      trafficImpactAssessmentRequired: true,
      buildingCommitteeReviewRequired: true,
      permitCoordination: "OTHER_GTE_20",
      environmentalAssessmentType: "ENVIRONMENTAL",
      disasterImpactAssessmentType: "DISASTER_IMPACT",
      undergroundSafetyAssessmentType: "UNDERGROUND_SAFETY",
      nationalHeritageAssessmentType: "IMPACT_DIAGNOSIS",
      publicWaterOccupationRequired: true,
      airEmissionFacility: true,
      airTotalManagementBusinessTarget: true,
      waterDischargeFacility: true,
      noiseVibrationFacility: true,
      chemicalsHandled: true,
      chemicalManufactureOrImport: true,
      hazardousChemicalBusiness: true,
      chemicalRegistrationRequired: true,
      restrictedOrToxicChemicalImport: true,
      hazardousMaterials: true,
      hazardousMaterialsTank: true,
      hazardousMaterialsPreventionRulesRequired: true,
      highPressureGas: true,
      highPressureGasBusinessStartTarget: true,
      energyUsePlanRequired: true,
      powerIncreaseMw: 50,
      waterDemandM3Day: 4_000,
      wastewaterM3Day: 3_000,
      supplementalPermitTargetIds: [
        "fugitive-emission-facility-report",
        "fugitive-dust-business-report",
        "nonpoint-source-installation-report",
        "business-waste-generator-report",
        "designated-waste-plan-confirmation",
        "construction-waste-plan-report",
        "soil-contamination-facility-report",
        "hazard-prevention-plan",
        "land-transaction-contract-permit",
        "buried-heritage-excavation-permit",
        "construction-quality-plan-submission",
        "marine-use-impact-assessment",
      ],
    }),
    include: [
      "factory-establishment-approval",
      "farmland-conversion-permit",
      "environmental-impact-assessment",
      "development-activity-permit",
      "air-emission-installation-permit",
      "air-facility-operation-start-report",
      "water-discharge-installation-permit",
      "water-facility-operation-start-report",
      "noise-vibration-facility-report",
      "chemical-accident-prevention-plan",
      "hazardous-chemical-facility-inspection",
      "hazardous-chemical-business-permit",
      "hazard-prevention-plan",
      "land-transaction-contract-permit",
      "buried-heritage-excavation-permit",
      "buried-heritage-excavation-investigation",
      "construction-quality-plan-submission",
      "marine-use-impact-assessment",
      "public-water-occupation-use-permit",
      "public-water-implementation-plan-approval-report",
      "public-water-completion-inspection-report",
      "factory-completion-report-offsite",
    ],
    exclude: [
      "integrated-environmental-permit",
      "industrial-complex-occupancy-contract",
      "road-occupation-permit",
      "factory-completion-report-complex",
    ],
    deemed: [],
    orderedPairs: [
      ["environmental-impact-assessment", "development-activity-permit"],
      ["farmland-conversion-permit", "development-activity-permit"],
      ["buried-heritage-excavation-permit", "buried-heritage-excavation-investigation"],
      ["buried-heritage-excavation-investigation", "construction-start-report"],
      ["chemical-accident-prevention-plan", "hazardous-chemical-facility-inspection"],
      ["hazardous-chemical-facility-inspection", "hazardous-chemical-business-permit"],
      ["building-use-approval", "factory-completion-report-offsite"],
    ],
    completionProcedureId: "factory-completion-report-offsite",
  },
  {
    name: "세종 바이오의약 산단 증설·개별 대기수질",
    answers: investmentAnswers({
      investmentType: "EXPANSION",
      province: "세종특별자치시",
      city: "",
      insideIndustrialComplex: true,
      industrialComplexName: "세종 바이오산업단지",
      industrialComplexIdentifier: "SEJONG-BIO-01",
      industrialComplexManagingAuthority: "검증 산업단지 관리기관",
      industrialComplexOccupancyContractStatus: "COMPLETED",
      industryCategory: "PHARMACEUTICAL_BIO",
      buildingAction: "EXTENSION",
      existingAreaM2: 15_000,
      increaseAreaM2: 8_000,
      totalAreaM2: 23_000,
      airEmissionFacility: true,
      airTotalManagementBusinessTarget: false,
      waterDischargeFacility: true,
      noiseVibrationFacility: true,
      chemicalsHandled: true,
      highPressureGas: true,
      specificHighPressureGasUse: true,
      energyUsePlanRequired: true,
      powerIncreaseMw: 12,
      waterDemandM3Day: 800,
      wastewaterM3Day: 600,
      supplementalPermitTargetIds: [
        "road-occupation-permit",
        "business-waste-generator-report",
        "construction-waste-plan-report",
      ],
    }),
    include: [
      "industrial-complex-occupancy-contract",
      "road-occupation-permit",
      "air-emission-installation-permit",
      "air-facility-operation-start-report",
      "water-discharge-installation-permit",
      "water-facility-operation-start-report",
      "specific-high-pressure-gas-use-report",
      "factory-completion-report-complex",
    ],
    exclude: [
      "air-total-management-business-permit",
      "integrated-environmental-permit",
      "noise-vibration-facility-report",
      "chemical-substance-confirmation",
      "hazardous-chemical-business-permit",
      "factory-completion-report-offsite",
    ],
    deemed: ["factory-establishment-approval"],
    orderedPairs: [
      ["air-emission-installation-permit", "air-facility-operation-start-report"],
      ["water-discharge-installation-permit", "water-facility-operation-start-report"],
      ["industrial-complex-occupancy-contract", "factory-completion-report-complex"],
    ],
    completionProcedureId: "factory-completion-report-complex",
    completedCheckpoints: [
      {
        procedureId: "industrial-complex-occupancy-contract",
        label: "산업단지 입주계약 체결 완료",
      },
    ],
    normalizedCity: "세종특별자치시",
  },
  {
    name: "경남 김해 자동차부품 개별입지·도로·위험물",
    answers: investmentAnswers({
      province: "경상남도",
      city: "김해시",
      industryCategory: "AUTOMOTIVE_MOBILITY",
      increaseAreaM2: 9_000,
      totalAreaM2: 9_000,
      roadConnectionRequired: true,
      airEmissionFacility: true,
      noiseVibrationFacility: true,
      hazardousMaterials: true,
      hazardousMaterialsPreventionRulesRequired: true,
      powerIncreaseMw: 8,
      waterDemandM3Day: 120,
      wastewaterM3Day: 30,
      supplementalPermitTargetIds: [
        "fugitive-dust-business-report",
        "construction-waste-plan-report",
        "soil-contamination-facility-report",
        "hazard-prevention-plan",
        "road-work-police-report",
      ],
    }),
    include: [
      "factory-establishment-approval",
      "development-activity-permit",
      "road-connection-permit",
      "air-emission-installation-permit",
      "air-facility-operation-start-report",
      "noise-vibration-facility-report",
      "hazardous-materials-facility-installation-permit",
      "hazardous-materials-facility-completion-inspection",
      "hazard-prevention-plan",
      "road-work-police-report",
      "factory-completion-report-offsite",
    ],
    exclude: [
      "water-discharge-installation-permit",
      "integrated-environmental-permit",
      "industrial-complex-occupancy-contract",
      "road-occupation-permit",
      "factory-completion-report-complex",
    ],
    deemed: [],
    orderedPairs: [
      ["factory-establishment-approval", "building-permit"],
      ["air-emission-installation-permit", "air-facility-operation-start-report"],
      ["hazardous-materials-facility-installation-permit", "hazardous-materials-facility-completion-inspection"],
      ["building-use-approval", "factory-completion-report-offsite"],
    ],
    completionProcedureId: "factory-completion-report-offsite",
  },
  {
    name: "경북 포항 철강 산지 개별입지·환경영향·하천",
    answers: investmentAnswers({
      province: "경상북도",
      city: "포항시",
      industryCategory: "PRIMARY_METAL",
      increaseAreaM2: 30_000,
      totalAreaM2: 30_000,
      landCategory: "FOREST",
      environmentalAssessmentType: "ENVIRONMENTAL",
      disasterImpactAssessmentType: "DISASTER_IMPACT",
      riverOccupationRequired: true,
      forestRestorationObligation: true,
      airEmissionFacility: true,
      waterDischargeFacility: true,
      noiseVibrationFacility: true,
      energyUsePlanRequired: true,
      powerIncreaseMw: 25,
      waterDemandM3Day: 2_000,
      wastewaterM3Day: 1_200,
      supplementalPermitTargetIds: [
        "fugitive-dust-business-report",
        "nonpoint-source-installation-report",
        "business-waste-generator-report",
        "construction-waste-plan-report",
        "hazard-prevention-plan",
        "pasture-conversion-permit",
        "small-stream-occupation-permit",
      ],
    }),
    include: [
      "factory-establishment-approval",
      "forestland-conversion-permit",
      "forestland-restoration-design-approval",
      "forestland-restoration-completion-inspection",
      "environmental-impact-assessment",
      "disaster-impact-assessment-consultation",
      "river-occupation-permit",
      "pasture-conversion-permit",
      "small-stream-occupation-permit",
      "development-activity-permit",
      "air-emission-installation-permit",
      "water-discharge-installation-permit",
      "noise-vibration-facility-report",
      "factory-completion-report-offsite",
    ],
    exclude: [
      "farmland-conversion-permit",
      "industrial-complex-occupancy-contract",
      "factory-completion-report-complex",
    ],
    deemed: [],
    orderedPairs: [
      ["environmental-impact-assessment", "development-activity-permit"],
      ["forestland-conversion-permit", "development-activity-permit"],
      ["forestland-conversion-permit", "forestland-restoration-design-approval"],
      ["forestland-restoration-design-approval", "forestland-restoration-completion-inspection"],
      ["forestland-restoration-completion-inspection", "factory-completion-report-offsite"],
    ],
    completionProcedureId: "factory-completion-report-offsite",
  },
  {
    name: "울산 조선 산단 증설·하천·공유수면",
    answers: investmentAnswers({
      investmentType: "EXPANSION",
      province: "울산광역시",
      city: "동구",
      insideIndustrialComplex: true,
      industrialComplexName: "울산 조선산업단지",
      industrialComplexIdentifier: "ULSAN-SHIP-01",
      industrialComplexManagingAuthority: "검증 산업단지 관리기관",
      industrialComplexOccupancyContractStatus: "IN_PROGRESS",
      industryCategory: "SHIPBUILDING_AEROSPACE_RAIL",
      buildingAction: "EXTENSION",
      existingAreaM2: 45_000,
      increaseAreaM2: 35_000,
      totalAreaM2: 80_000,
      riverOccupationRequired: true,
      publicWaterOccupationRequired: true,
      energyUsePlanRequired: true,
      powerIncreaseMw: 35,
      waterDemandM3Day: 900,
      wastewaterM3Day: 500,
      supplementalPermitTargetIds: [
        "fugitive-dust-business-report",
        "nonpoint-source-installation-report",
        "business-waste-generator-report",
        "construction-waste-plan-report",
        "marine-use-consultation",
      ],
    }),
    include: [
      "industrial-complex-occupancy-contract",
      "river-occupation-permit",
      "public-water-occupation-use-permit",
      "public-water-implementation-plan-approval-report",
      "public-water-completion-inspection-report",
      "marine-use-consultation",
      "factory-completion-report-complex",
    ],
    exclude: [
      "farmland-conversion-permit",
      "forestland-conversion-permit",
      "factory-completion-report-offsite",
    ],
    deemed: [],
    orderedPairs: [
      ["public-water-occupation-use-permit", "public-water-implementation-plan-approval-report"],
      ["public-water-implementation-plan-approval-report", "construction-start-report"],
      ["public-water-implementation-plan-approval-report", "public-water-completion-inspection-report"],
      ["public-water-completion-inspection-report", "building-use-approval"],
      ["industrial-complex-occupancy-contract", "factory-completion-report-complex"],
    ],
    completionProcedureId: "factory-completion-report-complex",
  },
  {
    name: "충남 아산 AI 데이터센터 특별법 시행 전",
    answers: investmentAnswers({
      province: "충청남도",
      city: "아산시",
      industryCategory: "AI_DATA_CENTER",
      increaseAreaM2: 40_000,
      totalAreaM2: 40_000,
      aiDataCenterActFacilityConfirmed: true,
      aiDataCenterOneStopStatus: "PLANNED",
      appliedSpecialLawIds: [
        "AIDC_ONE_STOP",
        "AIDC_GRID_IMPACT_EXEMPTION",
        "AIDC_BUILDING_STANDARDS",
      ],
      gridImpactAssessmentRequired: true,
      trafficImpactAssessmentRequired: true,
      landscapeReviewRequired: true,
      buildingCommitteeReviewRequired: true,
      energyUsePlanRequired: true,
      powerIncreaseMw: 100,
      waterDemandM3Day: 2_000,
      wastewaterM3Day: 100,
      supplementalPermitTargetIds: [
        "fugitive-dust-business-report",
        "nonpoint-source-installation-report",
        "construction-waste-plan-report",
      ],
    }),
    include: [
      "power-grid-impact-assessment",
      "building-permit",
      "construction-start-report",
      "building-use-approval",
    ],
    exclude: [
      "ai-data-center-one-stop-application",
      "ai-data-center-one-stop-result",
      "ai-data-center-business-report",
      "factory-establishment-approval",
      "factory-completion-report-complex",
      "factory-completion-report-offsite",
    ],
    deemed: [],
    orderedPairs: [
      ["fire-building-permit-consent", "building-permit"],
      ["building-permit", "construction-start-report"],
      ["construction-start-report", "building-use-approval"],
    ],
    completionProcedureId: "building-use-approval",
    specialLawStatuses: {
      AIDC_ONE_STOP: "FUTURE",
      AIDC_GRID_IMPACT_EXEMPTION: "FUTURE",
      AIDC_BUILDING_STANDARDS: "FUTURE",
    },
  },
  {
    name: "전남 AI 데이터센터 특별법 시행 후 일괄처리 완료",
    answers: investmentAnswers({
      assessmentDate: "2027-04-01",
      plannedConstructionStartDate: "2028-01-01",
      plannedConstructionEndDate: "2030-12-31",
      equipmentInstallationCompletionDate: "2030-10-31",
      commissioningStartDate: "2030-11-01",
      province: "전라남도",
      city: "나주시",
      industryCategory: "AI_DATA_CENTER",
      increaseAreaM2: 45_000,
      totalAreaM2: 45_000,
      aiDataCenterActFacilityConfirmed: true,
      aiDataCenterOneStopStatus: "COMPLETED",
      appliedSpecialLawIds: [
        "AIDC_ONE_STOP",
        "AIDC_GRID_IMPACT_EXEMPTION",
        "AIDC_BUILDING_STANDARDS",
      ],
      gridImpactAssessmentRequired: true,
      trafficImpactAssessmentRequired: true,
      buildingCommitteeReviewRequired: true,
      energyUsePlanRequired: true,
      powerIncreaseMw: 120,
      waterDemandM3Day: 2_500,
      wastewaterM3Day: 120,
      supplementalPermitTargetIds: [
        "fugitive-dust-business-report",
        "nonpoint-source-installation-report",
        "construction-waste-plan-report",
      ],
    }),
    include: [
      "building-permit",
      "ai-data-center-one-stop-result",
      "building-use-approval",
    ],
    exclude: [
      "ai-data-center-one-stop-application",
      "power-grid-impact-assessment",
      "factory-establishment-approval",
      "factory-completion-report-complex",
      "factory-completion-report-offsite",
    ],
    deemed: ["ai-data-center-business-report"],
    orderedPairs: [
      ["building-permit", "ai-data-center-one-stop-result"],
      ["fire-building-permit-consent", "ai-data-center-one-stop-result"],
      ["building-permit", "construction-start-report"],
    ],
    completionProcedureId: "ai-data-center-one-stop-result",
    completedCheckpoints: [
      {
        procedureId: "ai-data-center-one-stop-result",
        label: "AI 데이터센터 일괄처리 결과통지 완료",
      },
    ],
    specialLawStatuses: {
      AIDC_ONE_STOP: "ACTIVE",
      AIDC_GRID_IMPACT_EXEMPTION: "ACTIVE",
      AIDC_BUILDING_STANDARDS: "ACTIVE",
    },
  },
  {
    name: "충남 반도체클러스터 계획승인·개별 인허가 의제",
    answers: investmentAnswers({
      province: "충청남도",
      city: "천안시",
      industryCategory: "SEMICONDUCTOR_ELECTRONICS",
      increaseAreaM2: 55_000,
      totalAreaM2: 55_000,
      landCategory: "FARMLAND",
      environmentalAssessmentType: "ENVIRONMENTAL",
      airEmissionFacility: true,
      waterDischargeFacility: true,
      noiseVibrationFacility: true,
      chemicalsHandled: true,
      semiconductorClusterPlanDeemingConfirmed: true,
      semiconductorClusterPlanDocumentsIncluded: true,
      semiconductorClusterPlanConsultationCompleted: true,
      semiconductorClusterPlanApprovalPublished: true,
      semiconductorClusterPlanApprovalPublishedDate: "2026-08-15",
      semiconductorClusterPlanApprovalNoticeReference: "산업통상부 고시 제2026-검증호",
      semiconductorClusterPlanIncludedPermitIds: [
        "factory-establishment-approval",
        "development-activity-permit",
        "farmland-conversion-permit",
        "building-permit",
        "air-emission-installation-permit",
        "water-discharge-installation-permit",
      ],
      powerIncreaseMw: 40,
      waterDemandM3Day: 2_500,
      wastewaterM3Day: 1_600,
      supplementalPermitTargetIds: [
        "fugitive-emission-facility-report",
        "fugitive-dust-business-report",
        "nonpoint-source-installation-report",
        "business-waste-generator-report",
        "designated-waste-plan-confirmation",
        "construction-waste-plan-report",
        "soil-contamination-facility-report",
        "hazard-prevention-plan",
      ],
    }),
    include: [
      "semiconductor-cluster-plan-approval",
      "environmental-impact-assessment",
      "air-facility-operation-start-report",
      "water-facility-operation-start-report",
      "noise-vibration-facility-report",
      "factory-completion-report-offsite",
    ],
    exclude: [
      "air-total-management-business-permit",
      "integrated-environmental-permit",
      "industrial-complex-occupancy-contract",
      "factory-completion-report-complex",
    ],
    deemed: [
      "factory-establishment-approval",
      "development-activity-permit",
      "farmland-conversion-permit",
      "building-permit",
      "air-emission-installation-permit",
      "water-discharge-installation-permit",
    ],
    orderedPairs: [
      ["air-facility-operation-start-report", "factory-completion-report-offsite"],
      ["water-facility-operation-start-report", "factory-completion-report-offsite"],
    ],
    completionProcedureId: "factory-completion-report-offsite",
    completedCheckpoints: [
      {
        procedureId: "semiconductor-cluster-plan-approval",
        label: "계획 승인·고시 완료",
      },
    ],
    specialLawStatuses: {
      SEMICONDUCTOR_CLUSTER_PLAN_DEEMING: "ACTIVE",
    },
  },
];

function expectCategory(
  evaluation: Evaluation,
  procedureId: string,
  category: ProcedureCategory,
) {
  const result = decision(evaluation, procedureId);
  expect(procedureCategoryForDecision(result), procedureId).toBe(category);
  return result;
}

describe("ten reviewed investment portfolio regressions", () => {
  it("defines ten materially different and fully reviewed threshold cases", () => {
    expect(cases).toHaveLength(10);
    expect(new Set(cases.map((scenario) => scenario.name))).toHaveLength(10);
    expect(
      new Set(cases.flatMap((scenario) => scenario.answers.supplementalPermitTargetIds)),
    ).toEqual(new Set(constructionEnvironmentSupplementalPermitTargetIds));

    for (const scenario of cases) {
      expect(
        new Set(scenario.answers.supplementalPermitReviewedIds),
        scenario.name,
      ).toEqual(new Set(supplementalPermitTargetIds));
      expect(scenario.answers.airTotalManagementBusinessTarget, scenario.name).not.toBeNull();
      for (const procedureId of scenario.answers.supplementalPermitTargetIds) {
        expect(supplementalPermitTargetIds, `${scenario.name}: ${procedureId}`).toContain(
          procedureId,
        );
      }
    }
  });

  it.each(cases)("$name", async (scenario) => {
    const evaluation = evaluateProject(scenario.answers);
    const repeated = evaluateProject(scenario.answers);
    const schedule = evaluation.schedules.TYPICAL;
    const timeline = schedule.projectTimeline;

    expect(evaluation, `${scenario.name}: deterministic evaluation`).toEqual(repeated);
    expect(
      evaluation.decisions.flatMap((item) => item.conflictRuleIds),
      `${scenario.name}: conflicting rules`,
    ).toEqual([]);
    expect(timeline, `${scenario.name}: dated timeline`).not.toBeNull();

    const order = schedule.topologicalOrder;
    const scheduled = new Set(order);
    expect(scheduled.size, `${scenario.name}: duplicate schedule node`).toBe(order.length);
    expect(timeline!.nodes, `${scenario.name}: timeline node coverage`).toHaveLength(
      order.length,
    );
    expect(
      new Set(timeline!.nodes.map((node) => node.procedureId)),
      `${scenario.name}: schedule/timeline node agreement`,
    ).toEqual(scheduled);
    expect(
      [...schedule.warnings, ...timeline!.warnings].join(" "),
      `${scenario.name}: cycle warning`,
    ).not.toContain("순환");

    const roadmapDecisions = evaluation.decisions.filter(
      (item) => procedureCategoryForDecision(item) !== "NOT_REQUIRED",
    );
    for (const item of roadmapDecisions) {
      expect(
        item.procedure.receivingAuthority.trim(),
        `${scenario.name}: receiving authority ${item.procedure.id}`,
      ).not.toBe("");
      expect(
        item.procedure.statutoryDecisionMaker.trim(),
        `${scenario.name}: decision maker ${item.procedure.id}`,
      ).not.toBe("");
      expect(
        item.procedure.submissions.length,
        `${scenario.name}: submissions ${item.procedure.id}`,
      ).toBeGreaterThan(0);
      expect(
        item.procedure.citationIds.length,
        `${scenario.name}: legal citations ${item.procedure.id}`,
      ).toBeGreaterThan(0);
    }

    for (const node of timeline!.nodes) {
      if (node.processingDuration === null) {
        expect(
          timeline!.unknownPlanningDurationProcedureIds,
          `${scenario.name}: unknown duration registry ${node.procedureId}`,
        ).toContain(node.procedureId);
      } else {
        expect(
          timeline!.unknownPlanningDurationProcedureIds,
          `${scenario.name}: known duration registry ${node.procedureId}`,
        ).not.toContain(node.procedureId);
      }
    }

    for (const procedureId of scenario.include) {
      const result = expectCategory(evaluation, procedureId, "REQUIRED");
      expect(result.provisionalEffect, `${scenario.name}: ${procedureId}`).toBe("INCLUDE");
      expect(scheduled.has(procedureId), `${scenario.name}: ${procedureId} scheduled`).toBe(true);
    }
    for (const procedureId of scenario.exclude) {
      const result = expectCategory(evaluation, procedureId, "NOT_REQUIRED");
      expect(result.provisionalEffect, `${scenario.name}: ${procedureId}`).toBe("EXCLUDE");
      expect(scheduled.has(procedureId), `${scenario.name}: ${procedureId} omitted`).toBe(false);
    }
    for (const procedureId of scenario.deemed) {
      const result = expectCategory(evaluation, procedureId, "REQUIRED");
      expect(result.isDeemed, `${scenario.name}: ${procedureId}`).toBe(true);
      expect(result.provisionalEffect, `${scenario.name}: ${procedureId}`).toBe("EXCLUDE");
      expect(scheduled.has(procedureId), `${scenario.name}: ${procedureId} not duplicated`).toBe(false);
    }

    for (const [before, after] of scenario.orderedPairs) {
      const beforeIndex = order.indexOf(before);
      const afterIndex = order.indexOf(after);
      expect(beforeIndex, `${scenario.name}: missing predecessor ${before}`).toBeGreaterThanOrEqual(0);
      expect(afterIndex, `${scenario.name}: missing successor ${after}`).toBeGreaterThanOrEqual(0);
      expect(beforeIndex, `${scenario.name}: ${before} must precede ${after}`).toBeLessThan(
        afterIndex,
      );
    }

    expect(
      scheduled.has(scenario.completionProcedureId),
      `${scenario.name}: completion milestone`,
    ).toBe(true);

    for (const checkpoint of scenario.completedCheckpoints ?? []) {
      const node = timeline!.nodes.find(
        (item) => item.procedureId === checkpoint.procedureId,
      );
      expect(node, `${scenario.name}: completed checkpoint ${checkpoint.procedureId}`).toBeDefined();
      expect(node?.processingDuration, checkpoint.procedureId).toBe(0);
      expect(node?.completedCheckpoint?.label, checkpoint.procedureId).toContain(
        checkpoint.label,
      );
      expect(
        timeline!.unknownPlanningDurationProcedureIds,
        `${scenario.name}: completed checkpoint duration`,
      ).not.toContain(checkpoint.procedureId);
      expect(
        schedule.unknownDurationProcedureIds,
        `${scenario.name}: completed checkpoint CPM duration`,
      ).not.toContain(checkpoint.procedureId);

      const incomingEdges = catalog.edges.filter(
        (edge) =>
          schedule.activeEdgeIds.includes(edge.id) &&
          edge.to === checkpoint.procedureId,
      );
      for (const edge of incomingEdges) {
        const predecessor = timeline!.nodes.find(
          (item) => item.procedureId === edge.from,
        );
        expect(predecessor, `${scenario.name}: checkpoint predecessor ${edge.from}`).toBeDefined();
        expect(
          predecessor!.finishDate <= node!.startDate,
          `${scenario.name}: ${edge.from} must finish no later than completed ${checkpoint.procedureId}`,
        ).toBe(true);
      }
    }

    for (const completedNode of timeline!.nodes.filter(
      (node) => node.completedCheckpoint !== null,
    )) {
      const activeIncoming = catalog.edges.filter(
        (edge) =>
          edge.relation === "FINISH_TO_START" &&
          schedule.activeEdgeIds.includes(edge.id) &&
          edge.to === completedNode.procedureId,
      );
      for (const edge of activeIncoming) {
        const predecessor = timeline!.nodes.find(
          (node) => node.procedureId === edge.from,
        );
        expect(predecessor, `${scenario.name}: active checkpoint predecessor ${edge.from}`).toBeDefined();
        expect(
          predecessor!.finishDate <= completedNode.startDate,
          `${scenario.name}: active edge ${edge.id} must not run after completed ${completedNode.procedureId}`,
        ).toBe(true);
      }
    }

    for (const procedureId of supplementalPermitTargetIds) {
      const result = decision(evaluation, procedureId);
      const category = procedureCategoryForDecision(result);
      expect(
        result.missingInputs,
        `${scenario.name}: supplemental review ${procedureId}`,
      ).not.toContain(
        `confirmation.supplementalPermitTargets.${procedureId}`,
      );
      expect(
        ["REQUIRED", "NOT_REQUIRED"],
        `${scenario.name}: reviewed threshold ${procedureId}`,
      ).toContain(category);
    }

    const selectedSupplemental = new Set<SupplementalPermitTargetId>(
      scenario.answers.supplementalPermitTargetIds,
    );
    for (const procedureId of selectedSupplemental) {
      expectCategory(evaluation, procedureId, "REQUIRED");
    }
    expect(
      procedureCategoryForDecision(
        decision(evaluation, "air-total-management-business-permit"),
      ),
      `${scenario.name}: reviewed air-total target`,
    ).not.toBe("CONFIRM");

    if (!timeline!.complete) {
      expect(timeline!.totalCalendarDays, `${scenario.name}: partial duration safety`).toBeNull();
    }

    if (scenario.normalizedCity) {
      expect(evaluation.input.location.city).toMatchObject({
        status: "KNOWN",
        value: scenario.normalizedCity,
      });
    }

    for (const [lawId, status] of Object.entries(
      scenario.specialLawStatuses ?? {},
    )) {
      expect(
        evaluation.specialLawEvaluations.find((item) => item.id === lawId),
        `${scenario.name}: ${lawId}`,
      ).toMatchObject({ id: lawId, status });
    }

    const report = buildPermitReportModel({
      answers: scenario.answers,
      evaluation,
      durationScenario: "TYPICAL",
      generatedAt: new Date("2026-08-23T00:00:00.000Z"),
    });
    const expectedCounts = evaluation.decisions.reduce(
      (counts, item) => {
        counts[procedureCategoryForDecision(item)] += 1;
        return counts;
      },
      { REQUIRED: 0, CONFIRM: 0, NOT_REQUIRED: 0 } as Record<ProcedureCategory, number>,
    );
    expect(report.summary.counts, `${scenario.name}: report counts`).toEqual(expectedCounts);
    expect(report.procedures, `${scenario.name}: report roadmap rows`).toHaveLength(
      expectedCounts.REQUIRED + expectedCounts.CONFIRM,
    );
    expect(report.excluded, `${scenario.name}: report excluded rows`).toHaveLength(
      expectedCounts.NOT_REQUIRED,
    );
    expect(
      new Set(report.flow.stages.flatMap((stage) => stage.items.map((item) => item.id))).size,
      `${scenario.name}: report flow duplicates`,
    ).toBe(report.flow.stages.flatMap((stage) => stage.items).length);
    expect(report.flow.coreRelations.length, `${scenario.name}: report core relations`).toBeLessThanOrEqual(10);
    expect(report.localOrdinances.categories.length, `${scenario.name}: report ELIS categories`).toBeGreaterThan(0);
    if (scenario.answers.province === "전라남도") {
      const ordinances = report.localOrdinances.categories.flatMap(
        (category) => category.ordinances,
      );
      expect(
        ordinances.some((ordinance) => ordinance.jurisdictionName === "나주시"),
        `${scenario.name}: canonical current municipality links`,
      ).toBe(true);
      expect(
        ordinances.some((ordinance) => ordinance.transitionNotice !== null),
        `${scenario.name}: former Jeonnam transition links`,
      ).toBe(true);
    }
    expect(JSON.stringify(report), `${scenario.name}: server identifier leak`).not.toContain(
      "LAW_API_OC",
    );

    const bytes = await renderPermitReportPdf(report, await reportFontsPromise);
    expect(new TextDecoder("latin1").decode(bytes.slice(0, 5))).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(
      pdf.getPages().filter((page) => Math.abs(page.getWidth() - 1190.55) < 0.2),
      `${scenario.name}: A3 flow page`,
    ).toHaveLength(1);
    expect(pdf.getPageCount(), `${scenario.name}: report page count`).toBeGreaterThan(3);
  }, 30_000);
});
