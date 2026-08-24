import type { Fact, Procedure, ProjectInput } from "@/lib/domain/schemas";
import type { ScenarioAnswers } from "@/lib/data/catalog";
import {
  filterFastTrackTargetProcedureIds,
  filterPlanDeemedProcedureIds,
} from "@/lib/data/special-law-processes";
import { supplementalPermitTargetIds } from "@/lib/data/supplemental-permit-targets";

export function known(value: NonNullable<Fact["value"]>, unit?: string): Fact {
  return {
    status: "KNOWN",
    value,
    ...(unit ? { unit } : {}),
    source: "사용자 입력",
  };
}

export function unknown(): Fact {
  return { status: "UNKNOWN" };
}

export function notApplicable(): Fact {
  return { status: "NOT_APPLICABLE" };
}

function nullableFact(
  value: string | number | boolean | string[] | null,
  unit?: string,
): Fact {
  return value === null ? unknown() : known(value, unit);
}

function choiceFact(value: string): Fact {
  const normalized = value.trim();
  return !normalized || normalized === "UNKNOWN" ? unknown() : known(normalized);
}

function planSpecialLawTokens({
  lawId,
  effectiveFrom,
  assessmentDate,
  qualificationConfirmed,
  documentsIncluded,
  consultationCompleted,
  approvalPublished,
  approvalPublishedDate,
  approvalNoticeReference,
  includedPermitIds,
}: {
  lawId: string;
  effectiveFrom: string;
  assessmentDate: string;
  qualificationConfirmed: boolean | null;
  documentsIncluded: boolean | null;
  consultationCompleted: boolean | null;
  approvalPublished: boolean | null;
  approvalPublishedDate: string | null;
  approvalNoticeReference: string;
  includedPermitIds: readonly string[];
}) {
  if (qualificationConfirmed !== true) return [];

  const phase =
    documentsIncluded !== true
      ? "APPLICATION"
      : consultationCompleted !== true
        ? "CONSULTATION"
        : "APPROVAL";
  const approvalEvidenceConfirmed =
    documentsIncluded === true &&
    consultationCompleted === true &&
    approvalPublished === true &&
    approvalPublishedDate !== null &&
    approvalPublishedDate >= effectiveFrom &&
    approvalPublishedDate <= assessmentDate &&
    approvalNoticeReference.trim().length > 0 &&
    includedPermitIds.length > 0;

  return [
    `${lawId}:PHASE:${phase}`,
    ...(approvalEvidenceConfirmed
      ? [
          lawId,
          `${lawId}:APPROVAL_PUBLISHED`,
          ...includedPermitIds.map(
            (procedureId) => `${lawId}:${procedureId}`,
          ),
        ]
      : []),
  ];
}

function fastTrackProcessFact({
  qualificationConfirmed,
  applicantRoleConfirmed,
  delayRiskConfirmed,
  committeeResolved,
  requestDate,
  effectiveFrom,
  assessmentDate,
  targetPermitIds,
  tokens,
}: {
  qualificationConfirmed: boolean | null;
  applicantRoleConfirmed: boolean | null;
  delayRiskConfirmed: boolean | null;
  committeeResolved: boolean | null;
  requestDate: string | null;
  effectiveFrom: string;
  assessmentDate: string;
  targetPermitIds: readonly string[];
  tokens: string[];
}): Fact {
  const confirmations = [
    qualificationConfirmed,
    applicantRoleConfirmed,
    delayRiskConfirmed,
    committeeResolved,
  ];
  if (confirmations.some((value) => value === false)) return known([]);

  const requestDateIsValid =
    requestDate !== null &&
    requestDate >= effectiveFrom &&
    requestDate <= assessmentDate;
  if (
    confirmations.every((value) => value === true) &&
    requestDateIsValid &&
    targetPermitIds.length > 0
  ) {
    return known(tokens);
  }
  if (requestDate !== null && !requestDateIsValid) return known([]);
  return unknown();
}

function planProcessFact(
  qualificationConfirmed: boolean | null,
  tokens: string[],
): Fact {
  if (qualificationConfirmed === null) return unknown();
  return qualificationConfirmed ? known(tokens) : known([]);
}

export function scenarioAnswersToProjectInput(
  answers: ScenarioAnswers,
  fastTrackTargetProcedures: readonly Pick<
    Procedure,
    "id" | "actionType" | "domain"
  >[],
): ProjectInput {
  const inside = nullableFact(answers.insideIndustrialComplex);
  // Published scenarios and v14-or-earlier share links only carried the
  // industrial-complex fields. Keep that route intact while letting an
  // explicitly selected Port Act or Free Trade Zone Act contract govern an
  // overlapping designation without activating two entry contracts.
  const entryContractRegime =
    answers.entryContractRegime === "NONE" &&
    answers.insideIndustrialComplex === true
      ? "INDUSTRIAL_COMPLEX_ACT"
      : answers.entryContractRegime;
  const usesIndustrialComplexContract =
    entryContractRegime === "INDUSTRIAL_COMPLEX_ACT";
  const hasEntryContract = entryContractRegime !== "NONE";
  const entryContractRegimeFact =
    entryContractRegime === "NONE" && answers.insideIndustrialComplex === null
      ? unknown()
      : known(entryContractRegime);
  const normalizedProvince = answers.province.trim();
  const normalizedCity = answers.city.trim() || (
    normalizedProvince === "세종특별자치시" ? normalizedProvince : ""
  );
  const advancedStrategicIndustryFastTrackPermitIds =
    filterFastTrackTargetProcedureIds(
      "ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK",
      answers.advancedStrategicIndustryFastTrackPermitIds,
      fastTrackTargetProcedures,
    );
  const semiconductorClusterFastTrackPermitIds =
    filterFastTrackTargetProcedureIds(
      "SEMICONDUCTOR_CLUSTER_FAST_TRACK",
      answers.semiconductorClusterFastTrackPermitIds,
      fastTrackTargetProcedures,
    );
  const semiconductorClusterPlanIncludedPermitIds =
    filterPlanDeemedProcedureIds(
      "SEMICONDUCTOR_CLUSTER_PLAN_DEEMING",
      answers.semiconductorClusterPlanIncludedPermitIds,
    );
  const industrialComplexPlanIncludedPermitIds =
    filterPlanDeemedProcedureIds(
      "INDUSTRIAL_COMPLEX_PLAN_INTEGRATED_APPROVAL",
      answers.industrialComplexPlanIncludedPermitIds,
    );
  const regionalSpecialZonePlanIncludedPermitIds =
    filterPlanDeemedProcedureIds(
      "REGIONAL_SPECIAL_ZONE_PLAN_DEEMING",
      answers.regionalSpecialZonePlanIncludedPermitIds,
    );
  const advancedStrategicIndustryFastTrackTokens =
    answers.advancedStrategicIndustryFastTrackConfirmed === true &&
    answers.advancedStrategicIndustryApplicantRoleConfirmed === true &&
    answers.advancedStrategicIndustryDelayRiskConfirmed === true &&
    answers.advancedStrategicIndustryCommitteeResolved === true &&
    answers.advancedStrategicIndustryMinisterRequestDate !== null &&
    answers.advancedStrategicIndustryMinisterRequestDate >= "2023-07-01" &&
    answers.advancedStrategicIndustryMinisterRequestDate <= answers.assessmentDate &&
    advancedStrategicIndustryFastTrackPermitIds.length > 0
      ? [
          "ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK",
          ...advancedStrategicIndustryFastTrackPermitIds.map(
            (procedureId) =>
              `ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK:${procedureId}`,
          ),
        ]
      : [];
  const semiconductorClusterFastTrackTokens =
    answers.semiconductorClusterFastTrackConfirmed === true &&
    answers.semiconductorClusterApplicantRoleConfirmed === true &&
    answers.semiconductorClusterDelayRiskConfirmed === true &&
    answers.semiconductorClusterCommitteeResolved === true &&
    answers.semiconductorClusterMinisterRequestDate !== null &&
    answers.semiconductorClusterMinisterRequestDate >= "2026-08-11" &&
    answers.semiconductorClusterMinisterRequestDate <= answers.assessmentDate &&
    semiconductorClusterFastTrackPermitIds.length > 0
      ? [
          "SEMICONDUCTOR_CLUSTER_FAST_TRACK",
          ...semiconductorClusterFastTrackPermitIds.map(
            (procedureId) =>
              `SEMICONDUCTOR_CLUSTER_FAST_TRACK:${procedureId}`,
          ),
        ]
      : [];
  const semiconductorClusterPlanTokens = planSpecialLawTokens({
    lawId: "SEMICONDUCTOR_CLUSTER_PLAN_DEEMING",
    effectiveFrom: "2026-08-11",
    assessmentDate: answers.assessmentDate,
    qualificationConfirmed: answers.semiconductorClusterPlanDeemingConfirmed,
    documentsIncluded: answers.semiconductorClusterPlanDocumentsIncluded,
    consultationCompleted: answers.semiconductorClusterPlanConsultationCompleted,
    approvalPublished: answers.semiconductorClusterPlanApprovalPublished,
    approvalPublishedDate: answers.semiconductorClusterPlanApprovalPublishedDate,
    approvalNoticeReference: answers.semiconductorClusterPlanApprovalNoticeReference,
    includedPermitIds: semiconductorClusterPlanIncludedPermitIds,
  });
  const industrialComplexPlanTokens = planSpecialLawTokens({
    lawId: "INDUSTRIAL_COMPLEX_PLAN_INTEGRATED_APPROVAL",
    effectiveFrom: "2008-09-06",
    assessmentDate: answers.assessmentDate,
    qualificationConfirmed: answers.industrialComplexPlanSpecialCaseConfirmed,
    documentsIncluded: answers.industrialComplexPlanDocumentsIncluded,
    consultationCompleted: answers.industrialComplexPlanConsultationCompleted,
    approvalPublished: answers.industrialComplexPlanApprovalPublished,
    approvalPublishedDate: answers.industrialComplexPlanApprovalPublishedDate,
    approvalNoticeReference: answers.industrialComplexPlanApprovalNoticeReference,
    includedPermitIds: industrialComplexPlanIncludedPermitIds,
  });
  const regionalSpecialZonePlanTokens = planSpecialLawTokens({
    lawId: "REGIONAL_SPECIAL_ZONE_PLAN_DEEMING",
    effectiveFrom: "2019-04-17",
    assessmentDate: answers.assessmentDate,
    qualificationConfirmed: answers.regionalSpecialZonePlanDeemingConfirmed,
    documentsIncluded: answers.regionalSpecialZonePlanDocumentsIncluded,
    consultationCompleted: answers.regionalSpecialZonePlanConsultationCompleted,
    approvalPublished: answers.regionalSpecialZonePlanApprovalPublished,
    approvalPublishedDate: answers.regionalSpecialZonePlanApprovalPublishedDate,
    approvalNoticeReference: answers.regionalSpecialZonePlanApprovalNoticeReference,
    includedPermitIds: regionalSpecialZonePlanIncludedPermitIds,
  });
  const confirmedAutomaticSpecialLaws = [
    ...advancedStrategicIndustryFastTrackTokens,
    ...semiconductorClusterFastTrackTokens,
    ...semiconductorClusterPlanTokens,
    ...industrialComplexPlanTokens,
    ...regionalSpecialZonePlanTokens,
  ];
  const chemicalDetailFact = (value: boolean | null) =>
    answers.chemicalsHandled === false
      ? notApplicable()
      : nullableFact(value);
  const hazardousMaterialDetailFact = (value: boolean | null) =>
    answers.hazardousMaterials === false
      ? notApplicable()
      : nullableFact(value);
  return {
    assessmentDate: answers.assessmentDate,
    ...(answers.plannedConstructionStartDate
      ? { plannedConstructionStart: answers.plannedConstructionStartDate }
      : {}),
    ...(answers.plannedConstructionEndDate
      ? { plannedCompletion: answers.plannedConstructionEndDate }
      : {}),
    ...(answers.equipmentInstallationCompletionDate
      ? { plannedEquipmentInstallationCompletion: answers.equipmentInstallationCompletionDate }
      : {}),
    ...(answers.commissioningStartDate
      ? { plannedCommissioningStart: answers.commissioningStartDate }
      : {}),
    investmentType: choiceFact(answers.investmentType),
    location: {
      province: choiceFact(normalizedProvince),
      city: normalizedCity ? known(normalizedCity) : unknown(),
      address: answers.siteAddress.trim() ? known(answers.siteAddress.trim()) : unknown(),
      capitalRegionControlArea: unknown(),
    },
    industrialComplex: {
      inside,
      name:
        answers.insideIndustrialComplex === true
          ? answers.industrialComplexName.trim()
            ? known(answers.industrialComplexName.trim())
            : unknown()
          : notApplicable(),
      type:
        answers.insideIndustrialComplex === true ? unknown() : notApplicable(),
      identifier:
        answers.insideIndustrialComplex === true
          ? answers.industrialComplexIdentifier.trim()
            ? known(answers.industrialComplexIdentifier.trim())
            : unknown()
          : notApplicable(),
      occupancyContractStatus:
        answers.insideIndustrialComplex === true
          ? known(answers.industrialComplexOccupancyContractStatus)
          : notApplicable(),
      occupancyContractHeld:
        answers.insideIndustrialComplex === true
          ? known(answers.industrialComplexOccupancyContractStatus === "COMPLETED")
          : notApplicable(),
      managingAuthority:
        answers.insideIndustrialComplex === true
          ? answers.industrialComplexManagingAuthority.trim()
            ? known(answers.industrialComplexManagingAuthority.trim())
            : unknown()
          : notApplicable(),
    },
    entryContract: {
      regime: entryContractRegimeFact,
      eligibilityConfirmed: hasEntryContract
        ? nullableFact(answers.entryEligibilityConfirmed)
        : entryContractRegimeFact.status === "UNKNOWN"
          ? unknown()
        : notApplicable(),
      status: !hasEntryContract
        ? notApplicable()
        : usesIndustrialComplexContract
          ? known(answers.industrialComplexOccupancyContractStatus)
          : known(answers.entryContractStatus),
      zoneName: !hasEntryContract
        ? notApplicable()
        : (answers.entryZoneName.trim() ||
            (usesIndustrialComplexContract
              ? answers.industrialComplexName.trim()
              : ""))
          ? known(
              answers.entryZoneName.trim() ||
                answers.industrialComplexName.trim(),
            )
          : unknown(),
      managingAuthority: !hasEntryContract
        ? notApplicable()
        : (answers.entryManagingAuthority.trim() ||
            (usesIndustrialComplexContract
              ? answers.industrialComplexManagingAuthority.trim()
              : ""))
          ? known(
              answers.entryManagingAuthority.trim() ||
                answers.industrialComplexManagingAuthority.trim(),
            )
          : unknown(),
      evidence: !hasEntryContract
        ? notApplicable()
        : answers.entryContractEvidence.trim()
          ? known(answers.entryContractEvidence.trim())
          : unknown(),
    },
    industry: {
      category: choiceFact(answers.industryCategory),
      aiDataCenterActFacilityConfirmed: nullableFact(
        answers.aiDataCenterActFacilityConfirmed,
      ),
      aiDataCenterOneStopStatus: known(answers.aiDataCenterOneStopStatus),
      ksic: answers.ksicCode.trim() ? known(answers.ksicCode.trim()) : unknown(),
      products: answers.products.trim()
        ? known(answers.products.split(/[,\n]/).map((item) => item.trim()).filter(Boolean))
        : unknown(),
      coreProcesses: answers.coreProcesses.trim()
        ? known(answers.coreProcesses.split(/[,\n]/).map((item) => item.trim()).filter(Boolean))
        : unknown(),
    },
    site: {
      zoning: answers.siteZoning.trim() ? known(answers.siteZoning.trim()) : unknown(),
      landCategory: nullableFact(answers.landCategory),
      ownership: unknown(),
      developmentAreaM2: nullableFact(answers.siteDevelopmentAreaM2, "m2"),
      restrictedFactors: answers.siteRestrictedFactors.trim()
        ? known(answers.siteRestrictedFactors.split(/[,\n]/).map((item) => item.trim()).filter(Boolean))
        : unknown(),
      demolitionRequired: nullableFact(answers.demolitionRequired),
      roadConnectionRequired: nullableFact(answers.roadConnectionRequired),
      trafficImpactAssessmentRequired: nullableFact(answers.trafficImpactAssessmentRequired),
      landscapeReviewRequired: nullableFact(answers.landscapeReviewRequired),
      groundwaterDevelopment: nullableFact(answers.groundwaterDevelopment),
      disasterImpactAssessmentType: nullableFact(answers.disasterImpactAssessmentType),
      undergroundSafetyAssessmentType: nullableFact(answers.undergroundSafetyAssessmentType),
      nationalHeritageAssessmentType: nullableFact(answers.nationalHeritageAssessmentType),
      militaryProtectionConsultationRequired: nullableFact(answers.militaryProtectionConsultationRequired),
      riverOccupationRequired: nullableFact(answers.riverOccupationRequired),
      publicWaterOccupationRequired: nullableFact(answers.publicWaterOccupationRequired),
      waterSourceProtectionZone: nullableFact(answers.waterSourceProtectionZone),
    },
    building: {
      action: choiceFact(answers.buildingAction),
      mechanicalEquipmentActTarget: nullableFact(answers.mechanicalEquipmentActTarget),
      existingAreaM2: nullableFact(answers.existingAreaM2, "m2"),
      increaseAreaM2: nullableFact(answers.increaseAreaM2, "m2"),
      totalAreaM2: nullableFact(answers.totalAreaM2, "m2"),
      buildingCommitteeReviewRequired: nullableFact(
        answers.buildingCommitteeReviewRequired,
      ),
      fireFacilityWork: nullableFact(answers.fireFacilityWork),
    },
    environment: {
      airEmissionFacility: nullableFact(answers.airEmissionFacility),
      airTotalManagementBusinessTarget: nullableFact(
        answers.airTotalManagementBusinessTarget,
      ),
      waterDischargeFacility: nullableFact(answers.waterDischargeFacility),
      noiseVibrationFacility: nullableFact(answers.noiseVibrationFacility),
      wasteFacility: nullableFact(answers.wasteFacility),
      chemicalsHandled: nullableFact(answers.chemicalsHandled),
      environmentalAssessmentType: nullableFact(answers.environmentalAssessmentType),
      localEnvironmentalAssessmentRequired: nullableFact(
        answers.localEnvironmentalAssessmentRequired,
      ),
      integratedPermitTarget: nullableFact(answers.integratedEnvironmentalPermitTarget),
      chemicalManufactureOrImport: chemicalDetailFact(answers.chemicalManufactureOrImport),
      hazardousChemicalBusiness: chemicalDetailFact(answers.hazardousChemicalBusiness),
      chemicalRegistrationRequired: chemicalDetailFact(answers.chemicalRegistrationRequired),
      restrictedOrToxicChemicalImport: chemicalDetailFact(answers.restrictedOrToxicChemicalImport),
    },
    safety: {
      hazardousMaterials: nullableFact(answers.hazardousMaterials),
      highPressureGas: nullableFact(answers.highPressureGas),
      specificHighPressureGasUse: nullableFact(answers.specificHighPressureGasUse),
      lpgSpecificUseFacility: nullableFact(answers.lpgSpecificUseFacility),
      cityGasSpecificUseFacility: nullableFact(answers.cityGasSpecificUseFacility),
      psmCovered: nullableFact(answers.psmCovered),
      psmCoversSameHazardPreventionScope: nullableFact(
        answers.psmCoversSameHazardPreventionScope,
      ),
      fireSafetyManagerRequired: nullableFact(answers.fireSafetyManagerRequired),
      hazardousMaterialsTank: hazardousMaterialDetailFact(answers.hazardousMaterialsTank),
      hazardousMaterialsPreventionRulesRequired: hazardousMaterialDetailFact(answers.hazardousMaterialsPreventionRulesRequired),
      heatUseEquipment: nullableFact(answers.heatUseEquipment),
      hazardousMachineryInspectionRequired: nullableFact(answers.hazardousMachineryInspectionRequired),
    },
    construction: {
      safetyManagementPlanRequired: nullableFact(answers.safetyManagementPlanRequired),
      specificWorkReportRequired: nullableFact(answers.specificWorkReportRequired),
      asbestosPresent: nullableFact(answers.asbestosPresent),
    },
    utilities: {
      powerIncreaseMw: nullableFact(answers.powerIncreaseMw, "MW"),
      waterDemandM3Day: nullableFact(answers.waterDemandM3Day, "m3/day"),
      wastewaterM3Day: nullableFact(answers.wastewaterM3Day, "m3/day"),
      gridImpactAssessmentRequired: nullableFact(answers.gridImpactAssessmentRequired),
      privateElectricalFacilityWork: nullableFact(answers.privateElectricalFacilityWork),
      energyUsePlanRequired: nullableFact(answers.energyUsePlanRequired),
      publicSewerConnection: nullableFact(answers.publicSewerConnection),
      privateSewageTreatmentFacility: nullableFact(answers.privateSewageTreatmentFacility),
    },
    organization: {
      safetyManagerRequired: nullableFact(answers.safetyManagerRequired),
      healthManagerRequired: nullableFact(answers.healthManagerRequired),
    },
    confirmation: {
      forestRestorationObligation: nullableFact(answers.forestRestorationObligation),
      supplementalPermitTargets: Object.fromEntries(
        supplementalPermitTargetIds.map((procedureId) => [
          procedureId,
          answers.supplementalPermitTargetIds.includes(procedureId)
            ? known(true)
            : answers.supplementalPermitReviewedIds.includes(procedureId)
              ? known(false)
          : unknown(),
        ]),
      ),
      specialLawProcessTokens: {
        ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK: fastTrackProcessFact({
          qualificationConfirmed: answers.advancedStrategicIndustryFastTrackConfirmed,
          applicantRoleConfirmed: answers.advancedStrategicIndustryApplicantRoleConfirmed,
          delayRiskConfirmed: answers.advancedStrategicIndustryDelayRiskConfirmed,
          committeeResolved: answers.advancedStrategicIndustryCommitteeResolved,
          requestDate: answers.advancedStrategicIndustryMinisterRequestDate,
          effectiveFrom: "2023-07-01",
          assessmentDate: answers.assessmentDate,
          targetPermitIds: advancedStrategicIndustryFastTrackPermitIds,
          tokens: advancedStrategicIndustryFastTrackTokens,
        }),
        SEMICONDUCTOR_CLUSTER_FAST_TRACK: fastTrackProcessFact({
          qualificationConfirmed: answers.semiconductorClusterFastTrackConfirmed,
          applicantRoleConfirmed: answers.semiconductorClusterApplicantRoleConfirmed,
          delayRiskConfirmed: answers.semiconductorClusterDelayRiskConfirmed,
          committeeResolved: answers.semiconductorClusterCommitteeResolved,
          requestDate: answers.semiconductorClusterMinisterRequestDate,
          effectiveFrom: "2026-08-11",
          assessmentDate: answers.assessmentDate,
          targetPermitIds: semiconductorClusterFastTrackPermitIds,
          tokens: semiconductorClusterFastTrackTokens,
        }),
        SEMICONDUCTOR_CLUSTER_PLAN_DEEMING: planProcessFact(
          answers.semiconductorClusterPlanDeemingConfirmed,
          semiconductorClusterPlanTokens,
        ),
        INDUSTRIAL_COMPLEX_PLAN_INTEGRATED_APPROVAL: planProcessFact(
          answers.industrialComplexPlanSpecialCaseConfirmed,
          industrialComplexPlanTokens,
        ),
        REGIONAL_SPECIAL_ZONE_PLAN_DEEMING: planProcessFact(
          answers.regionalSpecialZonePlanDeemingConfirmed,
          regionalSpecialZonePlanTokens,
        ),
      },
      fireWorkSupervisionTarget: nullableFact(answers.fireWorkSupervisionTarget),
      firstFireSelfInspectionTarget: nullableFact(answers.firstFireSelfInspectionTarget),
      highPressureGasBusinessStartTarget: nullableFact(answers.highPressureGasBusinessStartTarget),
      semiconductorClusterPlanDocumentsIncluded: nullableFact(answers.semiconductorClusterPlanDocumentsIncluded),
      semiconductorClusterPlanConsultationCompleted: nullableFact(answers.semiconductorClusterPlanConsultationCompleted),
      semiconductorClusterPlanApprovalPublished: nullableFact(answers.semiconductorClusterPlanApprovalPublished),
      semiconductorClusterPlanApprovalPublishedDate: nullableFact(answers.semiconductorClusterPlanApprovalPublishedDate),
      semiconductorClusterPlanApprovalNoticeReference: choiceFact(answers.semiconductorClusterPlanApprovalNoticeReference),
      industrialComplexPlanDocumentsIncluded: nullableFact(answers.industrialComplexPlanDocumentsIncluded),
      industrialComplexPlanConsultationCompleted: nullableFact(answers.industrialComplexPlanConsultationCompleted),
      industrialComplexPlanApprovalPublished: nullableFact(answers.industrialComplexPlanApprovalPublished),
      industrialComplexPlanApprovalPublishedDate: nullableFact(answers.industrialComplexPlanApprovalPublishedDate),
      industrialComplexPlanApprovalNoticeReference: choiceFact(answers.industrialComplexPlanApprovalNoticeReference),
      regionalSpecialZonePlanDocumentsIncluded: nullableFact(answers.regionalSpecialZonePlanDocumentsIncluded),
      regionalSpecialZonePlanConsultationCompleted: nullableFact(answers.regionalSpecialZonePlanConsultationCompleted),
      regionalSpecialZonePlanApprovalPublished: nullableFact(answers.regionalSpecialZonePlanApprovalPublished),
      regionalSpecialZonePlanApprovalPublishedDate: nullableFact(answers.regionalSpecialZonePlanApprovalPublishedDate),
      regionalSpecialZonePlanApprovalNoticeReference: choiceFact(answers.regionalSpecialZonePlanApprovalNoticeReference),
    },
    permitCoordination: nullableFact(answers.permitCoordination),
    strategicIndustrySpecialCase: known([
      ...answers.appliedSpecialLawIds,
      ...confirmedAutomaticSpecialLaws,
    ]),
    existingApprovalIds: answers.existingApprovalIds.trim()
      ? known(answers.existingApprovalIds.split(/[,\n]/).map((item) => item.trim()).filter(Boolean))
      : answers.buildingAction === "NONE"
        ? notApplicable()
        : unknown(),
  };
}
