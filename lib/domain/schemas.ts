import { z } from "zod";

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "YYYY-MM-DD 형식이어야 합니다.")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "실제 달력에 존재하는 날짜여야 합니다.");

export const factStatusSchema = z.enum([
  "KNOWN",
  "UNKNOWN",
  "NOT_APPLICABLE",
]);

export const factSchema = z.object({
  status: factStatusSchema,
  value: z
    .union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.string()),
      z.null(),
    ])
    .optional(),
  unit: z.string().optional(),
  source: z.string().optional(),
  checkedAt: z.string().optional(),
});

export const projectInputSchema = z.object({
  assessmentDate: isoDateSchema,
  plannedConstructionStart: z.string().optional(),
  plannedCompletion: z.string().optional(),
  plannedEquipmentInstallationCompletion: z.string().optional(),
  plannedCommissioningStart: z.string().optional(),
  investmentType: factSchema,
  location: z.object({
    province: factSchema,
    city: factSchema,
    address: factSchema,
    capitalRegionControlArea: factSchema,
  }),
  industrialComplex: z.object({
    inside: factSchema,
    name: factSchema,
    type: factSchema,
    identifier: factSchema,
    occupancyContractStatus: factSchema,
    occupancyContractHeld: factSchema,
    managingAuthority: factSchema,
  }),
  industry: z.object({
    category: factSchema,
    aiDataCenterActFacilityConfirmed: factSchema,
    aiDataCenterOneStopStatus: factSchema,
    ksic: factSchema,
    products: factSchema,
    coreProcesses: factSchema,
  }),
  site: z.object({
    zoning: factSchema,
    landCategory: factSchema,
    ownership: factSchema,
    developmentAreaM2: factSchema,
    restrictedFactors: factSchema,
    demolitionRequired: factSchema,
    roadConnectionRequired: factSchema,
    trafficImpactAssessmentRequired: factSchema,
    landscapeReviewRequired: factSchema,
    groundwaterDevelopment: factSchema,
    disasterImpactAssessmentType: factSchema,
    undergroundSafetyAssessmentType: factSchema,
    nationalHeritageAssessmentType: factSchema,
    militaryProtectionConsultationRequired: factSchema,
    riverOccupationRequired: factSchema,
    publicWaterOccupationRequired: factSchema,
    waterSourceProtectionZone: factSchema,
  }),
  building: z.object({
    action: factSchema,
    mechanicalEquipmentActTarget: factSchema,
    existingAreaM2: factSchema,
    increaseAreaM2: factSchema,
    totalAreaM2: factSchema,
    buildingCommitteeReviewRequired: factSchema,
    fireFacilityWork: factSchema,
  }),
  environment: z.object({
    airEmissionFacility: factSchema,
    airTotalManagementBusinessTarget: factSchema,
    waterDischargeFacility: factSchema,
    noiseVibrationFacility: factSchema,
    wasteFacility: factSchema,
    chemicalsHandled: factSchema,
    environmentalAssessmentType: factSchema,
    integratedPermitTarget: factSchema,
    chemicalManufactureOrImport: factSchema,
    hazardousChemicalBusiness: factSchema,
    chemicalRegistrationRequired: factSchema,
    restrictedOrToxicChemicalImport: factSchema,
  }),
  safety: z.object({
    hazardousMaterials: factSchema,
    highPressureGas: factSchema,
    specificHighPressureGasUse: factSchema,
    lpgSpecificUseFacility: factSchema,
    cityGasSpecificUseFacility: factSchema,
    psmCovered: factSchema,
    psmCoversSameHazardPreventionScope: factSchema,
    fireSafetyManagerRequired: factSchema,
    hazardousMaterialsTank: factSchema,
    hazardousMaterialsPreventionRulesRequired: factSchema,
    heatUseEquipment: factSchema,
    hazardousMachineryInspectionRequired: factSchema,
  }),
  construction: z.object({
    safetyManagementPlanRequired: factSchema,
    specificWorkReportRequired: factSchema,
    asbestosPresent: factSchema,
  }),
  utilities: z.object({
    powerIncreaseMw: factSchema,
    waterDemandM3Day: factSchema,
    wastewaterM3Day: factSchema,
    gridImpactAssessmentRequired: factSchema,
    privateElectricalFacilityWork: factSchema,
    energyUsePlanRequired: factSchema,
    publicSewerConnection: factSchema,
    privateSewageTreatmentFacility: factSchema,
  }),
  organization: z.object({
    safetyManagerRequired: factSchema,
    healthManagerRequired: factSchema,
  }),
  confirmation: z.object({
    forestRestorationObligation: factSchema,
    supplementalPermitTargets: z.record(z.string(), factSchema),
    specialLawProcessTokens: z.record(z.string(), factSchema),
    fireWorkSupervisionTarget: factSchema,
    firstFireSelfInspectionTarget: factSchema,
    highPressureGasBusinessStartTarget: factSchema,
    semiconductorClusterPlanDocumentsIncluded: factSchema,
    semiconductorClusterPlanConsultationCompleted: factSchema,
    semiconductorClusterPlanApprovalPublished: factSchema,
    semiconductorClusterPlanApprovalPublishedDate: factSchema,
    semiconductorClusterPlanApprovalNoticeReference: factSchema,
    industrialComplexPlanDocumentsIncluded: factSchema,
    industrialComplexPlanConsultationCompleted: factSchema,
    industrialComplexPlanApprovalPublished: factSchema,
    industrialComplexPlanApprovalPublishedDate: factSchema,
    industrialComplexPlanApprovalNoticeReference: factSchema,
    regionalSpecialZonePlanDocumentsIncluded: factSchema,
    regionalSpecialZonePlanConsultationCompleted: factSchema,
    regionalSpecialZonePlanApprovalPublished: factSchema,
    regionalSpecialZonePlanApprovalPublishedDate: factSchema,
    regionalSpecialZonePlanApprovalNoticeReference: factSchema,
  }),
  permitCoordination: factSchema,
  strategicIndustrySpecialCase: factSchema,
  existingApprovalIds: factSchema,
});

export const procedureStageSchema = z.enum([
  "SITE_REVIEW",
  "PLAN_AND_OCCUPANCY",
  "PRE_CONSTRUCTION",
  "DURING_CONSTRUCTION",
  "PRE_OPERATION",
  "POST_OPERATION",
]);

export const laneSchema = z.enum([
  "COMPANY",
  "INDUSTRIAL_COMPLEX_AUTHORITY",
  "CITY_COUNTY_DISTRICT",
  "PROVINCE",
  "CENTRAL_OR_REGIONAL_OFFICE",
  "ENVIRONMENT_SAFETY_FIRE_UTILITY",
]);

export const procedureSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  description: z.string(),
  outcome: z.string(),
  stage: procedureStageSchema,
  actionType: z.enum([
    "PERMIT",
    "APPROVAL",
    "NOTICE",
    "CONSULTATION",
    "REVIEW",
    "INSPECTION",
    "REGISTRATION",
    "CONTRACT",
  ]),
  domain: z.string(),
  lane: laneSchema,
  applicant: z.string(),
  receivingAuthority: z.string(),
  statutoryDecisionMaker: z.string(),
  consultationAuthorities: z.array(z.string()),
  submissions: z.array(z.string()),
  validity: z.string().nullable(),
  followUpObligations: z.array(z.string()),
  ruleIds: z.array(z.string()),
  citationIds: z.array(z.string()),
  durationId: z.string().nullable(),
  verificationStatus: z.enum([
    "AI_ASSISTED_DRAFT",
    "INTERNAL_REVIEWED",
    "EXPERT_REVIEWED",
    "TODO_LEGAL_REVIEW",
  ]),
  reviewedAt: z.string(),
  reviewNote: z.string(),
  deemedByProcedureIds: z.array(z.string()).default([]),
  deemedProcedureIds: z.array(z.string()).default([]),
});

export const procedureEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  relation: z.enum(["FINISH_TO_START", "START_TO_START", "FINISH_TO_FINISH"]),
  lag: z.number().nonnegative(),
  lagUnit: z.enum(["BUSINESS_DAY", "CALENDAR_DAY", "MONTH"]),
  strength: z.enum(["LEGAL_HARD", "PRACTICAL", "ADVISORY"]),
  conditionRuleId: z.string().nullable(),
  citationIds: z.array(z.string()),
  branchId: z.string().nullable(),
  note: z.string(),
});

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { eq: { path: string; value: unknown } }
  | { in: { path: string; values: unknown[] } }
  | { intersects: { path: string; values: unknown[] } }
  | { gt: { path: string; value: number } }
  | { gte: { path: string; value: number } }
  | { lt: { path: string; value: number } }
  | { lte: { path: string; value: number } }
  | { between: { path: string; min: number; max: number } }
  | { exists: { path: string } };

const scalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(conditionSchema) }),
    z.object({ any: z.array(conditionSchema) }),
    z.object({ not: conditionSchema }),
    z.object({ eq: z.object({ path: z.string(), value: scalarSchema }) }),
    z.object({
      in: z.object({ path: z.string(), values: z.array(scalarSchema) }),
    }),
    z.object({
      intersects: z.object({ path: z.string(), values: z.array(scalarSchema) }),
    }),
    z.object({ gt: z.object({ path: z.string(), value: z.number() }) }),
    z.object({ gte: z.object({ path: z.string(), value: z.number() }) }),
    z.object({ lt: z.object({ path: z.string(), value: z.number() }) }),
    z.object({ lte: z.object({ path: z.string(), value: z.number() }) }),
    z.object({
      between: z.object({
        path: z.string(),
        min: z.number(),
        max: z.number(),
      }),
    }),
    z.object({ exists: z.object({ path: z.string() }) }),
  ]),
);

export const applicabilityRuleSchema = z.object({
  id: z.string(),
  version: z.string(),
  procedureId: z.string(),
  effect: z.enum(["INCLUDE", "EXCLUDE", "REPLACE", "SPECIAL_CASE"]),
  /**
   * Optional catalog-activation scope for industry-profile rules. The rule
   * condition still repeats the industry fact so a matched decision remains
   * fully traceable; this scope prevents an unrelated, false exclusion rule
   * from becoming the only active rule for another industry's historical
   * assessment date.
   */
  industryScope: z.array(z.string()).optional(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable(),
  jurisdiction: z.object({
    nationwide: z.boolean(),
    provinces: z.array(z.string()),
    cities: z.array(z.string()),
    industrialComplexIds: z.array(z.string()),
  }),
  condition: conditionSchema,
  requiredInputs: z.array(z.string()),
  missingPolicy: z.enum(["INDETERMINATE", "NON_MATCH"]),
  citationIds: z.array(z.string()),
  explanationTemplate: z.string(),
  priority: z.number().int(),
  status: z.enum([
    "DRAFT",
    "INTERNAL_REVIEWED",
    "EXPERT_REVIEWED",
    "RETIRED",
  ]),
  reviewActor: z.string(),
  note: z.string(),
});

export const legalSourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  documentType: z.enum([
    "ACT",
    "ENFORCEMENT_DECREE",
    "ENFORCEMENT_RULE",
    "ADMINISTRATIVE_RULE",
    "NOTICE",
    "LOCAL_ORDINANCE",
    "INDUSTRIAL_COMPLEX_PLAN",
    "OFFICIAL_SERVICE_GUIDE",
  ]),
  issuingAuthority: z.string(),
  jurisdictionCode: z.string().nullable(),
  industrialComplexId: z.string().nullable(),
  lawId: z.string().nullable(),
  mst: z.string().nullable(),
  proclamationDate: z.string().nullable(),
  proclamationNumber: z.string().nullable(),
  effectiveDate: z.string().nullable(),
  repealDate: z.string().nullable(),
  apiRetrievedAt: z.string().nullable(),
  internallyVerifiedAt: z.string(),
  contentHash: z.string(),
  officialUrl: z.string().url(),
  status: z.enum(["AUTHORITATIVE", "STALE", "UNVERIFIED"]),
});

export const legalCitationSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  article: z.string().nullable(),
  paragraph: z.string().nullable(),
  subparagraph: z.string().nullable(),
  item: z.string().nullable(),
  role: z.enum([
    "APPLICABILITY",
    "AUTHORITY",
    "SEQUENCE",
    "DEEMING",
    "DURATION",
    "SUBMISSION",
  ]),
  sourceVersion: z.string(),
  summary: z.string(),
});

export const durationRangeSchema = z.object({
  min: z.number().nonnegative().nullable(),
  base: z.number().nonnegative().nullable(),
  max: z.number().nonnegative().nullable(),
  unit: z.enum(["BUSINESS_DAY", "CALENDAR_DAY", "MONTH"]),
});

export const durationReferencePeriodSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "NATIONWIDE_STATUTORY",
    "NATIONWIDE_OFFICIAL_STANDARD",
    "LOCAL_OFFICIAL_STANDARD",
    "OFFICIAL_OPERATION_CAP",
    "PLANNING_REFERENCE",
    "OBSERVED_PRACTICE",
    "LEGAL_DEADLINE",
    "PROCESS_MILESTONE",
  ]),
  label: z.string(),
  range: durationRangeSchema.nullable(),
  jurisdiction: z.string().nullable(),
  startsWhen: z.string(),
  includes: z.array(z.enum([
    "APPLICANT_PREPARATION",
    "AUTHORITY_PROCESSING",
    "INTERAGENCY_CONSULTATION",
    "COMMITTEE_WAIT",
    "SUPPLEMENT",
    "RESULT_NOTICE",
  ])),
  citationIds: z.array(z.string()),
  sampleSize: z.number().int().positive().nullable(),
  observedFrom: isoDateSchema.nullable(),
  observedTo: isoDateSchema.nullable(),
  note: z.string(),
});

export const durationEstimateSchema = z.object({
  id: z.string(),
  procedureId: z.string(),
  applicantPreparation: durationRangeSchema.nullable(),
  authorityProcessing: durationRangeSchema.nullable(),
  interagencyConsultation: durationRangeSchema.nullable(),
  elapsed: durationRangeSchema.nullable(),
  statutoryPeriod: z.string().nullable(),
  stopClockRules: z.array(z.string()),
  variabilityFactors: z.array(z.string()),
  evidenceType: z.enum([
    "STATUTE",
    "OFFICIAL_SERVICE_STANDARD",
    "OFFICIAL_AGENCY_MATERIAL",
    "OBSERVED_CASE",
    "EXPERT_ESTIMATE",
    "INSUFFICIENT_DATA",
  ]),
  citationIds: z.array(z.string()),
  sampleSize: z.number().int().nullable(),
  assumptions: z.array(z.string()),
  verifiedAt: z.string(),
  legalConfidence: z.enum(["HIGH", "MEDIUM", "LOW", "UNVERIFIED"]),
  estimateConfidence: z.enum(["HIGH", "MEDIUM", "LOW", "UNVERIFIED"]),
  planningBasis: z.enum([
    "DIRECT_OFFICIAL",
    "INPUT_RESOLVED_OFFICIAL",
    "UNRESOLVED_OFFICIAL_BRANCH",
    "LOCAL_OFFICIAL_REFERENCE",
    "OFFICIAL_CAP_ONLY",
    "MILESTONE_ONLY",
    "INSUFFICIENT_DATA",
  ]).optional(),
  referencePeriods: z.array(durationReferencePeriodSchema).optional(),
});

export type Fact = z.infer<typeof factSchema>;
export type ProjectInput = z.infer<typeof projectInputSchema>;
export type Procedure = z.infer<typeof procedureSchema>;
export type ProcedureEdge = z.infer<typeof procedureEdgeSchema>;
export type ApplicabilityRule = z.infer<typeof applicabilityRuleSchema>;
export type LegalSource = z.infer<typeof legalSourceSchema>;
export type LegalCitation = z.infer<typeof legalCitationSchema>;
export type DurationEstimate = z.infer<typeof durationEstimateSchema>;

export type ApplicabilityStatus =
  | "APPLIES"
  | "DOES_NOT_APPLY"
  | "POSSIBLY_APPLIES"
  | "NEEDS_MORE_INFO";

export type RuleTrace = {
  ruleId: string;
  ruleVersion: string;
  procedureId: string;
  status: ApplicabilityStatus;
  usedInputs: Record<string, unknown>;
  missingInputs: string[];
  passedConditions: string[];
  failedConditions: string[];
  citationIds: string[];
  explanation: string;
  conflictWith: string[];
};
