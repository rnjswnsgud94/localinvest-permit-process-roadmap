import { z } from "zod";

import citationsJson from "@/data/catalog/citations.json";
import coverageJson from "@/data/catalog/coverage.json";
import durationsJson from "@/data/catalog/durations.json";
import edgesJson from "@/data/catalog/edges.json";
import legalSourcesJson from "@/data/catalog/legal-sources.json";
import proceduresJson from "@/data/catalog/procedures.json";
import rulesJson from "@/data/catalog/rules.json";
import scenariosJson from "@/data/scenarios/golden.json";
import {
  expandedCitations,
  expandedDurations,
  expandedEdges,
  expandedLegalSources,
  expandedProcedures,
  expandedRules,
} from "@/lib/data/expanded-catalog";
import {
  aiDataCenterProfileRules,
  aiDataCenterSpecialLawIds,
  specialLawCitations,
  specialLawDurations,
  specialLawEdges,
  specialLawLegalSources,
  specialLawProcedures,
  specialLawRuleIdsByProcedure,
  specialLawRules,
} from "@/lib/data/special-laws";
import {
  buildFastTrackTargetEdges,
  buildFastTrackTargetRules,
  specialLawDeemingParentsByProcedure,
  specialLawProcessDurations,
  specialLawProcessEdges,
  specialLawProcessProcedures,
  specialLawProcessRuleIdsByProcedure,
  specialLawProcessRules,
} from "@/lib/data/special-law-processes";
import { supplementalPermitTargetIds } from "@/lib/data/supplemental-permit-targets";
import {
  applicabilityRuleSchema,
  durationEstimateSchema,
  isoDateSchema,
  legalCitationSchema,
  legalSourceSchema,
  procedureEdgeSchema,
  procedureSchema,
} from "@/lib/domain/schemas";

const coverageSchema = z.object({
  catalogVersion: z.string(),
  assessmentDefault: z.string(),
  lastLegalReviewAt: z.string(),
  lastLawApiSyncAt: z.string().nullable(),
  snapshotStatus: z.enum(["LIVE", "SNAPSHOT", "SNAPSHOT_ONLY", "STALE"]),
  nextReviewDueAt: z.string(),
  sourceAttribution: z.string(),
  supported: z.object({
    nationwideCommon: z.array(z.string()),
    regions: z.array(z.string()),
    industries: z.array(z.string()),
  }),
  gaps: z.array(z.string()),
  futureLawWarnings: z.array(z.string()),
  disclaimer: z.string(),
});

export const scenarioAnswerSchema = z.object({
  assessmentDate: isoDateSchema,
  plannedConstructionStartDate: isoDateSchema.nullable().default(null),
  plannedConstructionEndDate: isoDateSchema.nullable().default(null),
  equipmentInstallationCompletionDate: isoDateSchema.nullable().default(null),
  commissioningStartDate: isoDateSchema.nullable().default(null),
  investmentType: z.string(),
  province: z.string(),
  city: z.string(),
  siteAddress: z.string().max(200).default(""),
  siteZoning: z.string().max(120).default(""),
  siteRestrictedFactors: z.string().max(500).default(""),
  insideIndustrialComplex: z.boolean().nullable(),
  industrialComplexName: z.string().max(120).default(""),
  industrialComplexIdentifier: z.string().max(80).default(""),
  industrialComplexManagingAuthority: z.string().max(120).default(""),
  industrialComplexOccupancyContractStatus: z
    .enum(["NOT_APPLIED", "PLANNED", "IN_PROGRESS", "COMPLETED"])
    .default("NOT_APPLIED"),
  entryContractRegime: z
    .enum([
      "NONE",
      "INDUSTRIAL_COMPLEX_ACT",
      "PORT_ACT",
      "FREE_TRADE_ZONE_ACT",
    ])
    .default("NONE"),
  entryEligibilityConfirmed: z.boolean().nullable().default(null),
  entryContractStatus: z
    .enum(["NOT_APPLIED", "PLANNED", "IN_PROGRESS", "COMPLETED"])
    .default("NOT_APPLIED"),
  entryZoneName: z.string().max(120).default(""),
  entryManagingAuthority: z.string().max(120).default(""),
  entryContractEvidence: z.string().max(300).default(""),
  industryCategory: z.string(),
  ksicCode: z.string().max(20).default(""),
  products: z.string().max(500).default(""),
  coreProcesses: z.string().max(500).default(""),
  existingApprovalIds: z.string().max(500).default(""),
  buildingAction: z.string(),
  mechanicalEquipmentActTarget: z.boolean().nullable().default(null),
  existingAreaM2: z.number().nullable(),
  increaseAreaM2: z.number().nullable(),
  totalAreaM2: z.number().nullable(),
  siteDevelopmentAreaM2: z.number().nullable().default(null),
  landCategory: z.enum(["OTHER", "FARMLAND", "FOREST"]).nullable(),
  demolitionRequired: z.boolean().nullable(),
  roadConnectionRequired: z.boolean().nullable(),
  trafficImpactAssessmentRequired: z.boolean().nullable(),
  landscapeReviewRequired: z.boolean().nullable().default(null),
  buildingCommitteeReviewRequired: z.boolean().nullable().default(null),
  gridImpactAssessmentRequired: z.boolean().nullable().default(null),
  aiDataCenterActFacilityConfirmed: z.boolean().nullable().default(null),
  aiDataCenterOneStopStatus: z
    .enum(["NOT_APPLIED", "PLANNED", "IN_PROGRESS", "COMPLETED"])
    .default("NOT_APPLIED"),
  appliedSpecialLawIds: z.array(z.enum(aiDataCenterSpecialLawIds)).default([]),
  advancedStrategicIndustryFastTrackConfirmed: z.boolean().nullable().default(null),
  advancedStrategicIndustryApplicantRoleConfirmed: z.boolean().nullable().default(null),
  advancedStrategicIndustryDelayRiskConfirmed: z.boolean().nullable().default(null),
  advancedStrategicIndustryCommitteeResolved: z.boolean().nullable().default(null),
  advancedStrategicIndustryMinisterRequestDate: isoDateSchema.nullable().default(null),
  advancedStrategicIndustryFastTrackPermitIds: z.array(z.string()).default([]),
  semiconductorClusterFastTrackConfirmed: z.boolean().nullable().default(null),
  semiconductorClusterApplicantRoleConfirmed: z.boolean().nullable().default(null),
  semiconductorClusterDelayRiskConfirmed: z.boolean().nullable().default(null),
  semiconductorClusterCommitteeResolved: z.boolean().nullable().default(null),
  semiconductorClusterMinisterRequestDate: isoDateSchema.nullable().default(null),
  semiconductorClusterFastTrackPermitIds: z.array(z.string()).default([]),
  semiconductorClusterPlanDeemingConfirmed: z.boolean().nullable().default(null),
  semiconductorClusterPlanDocumentsIncluded: z.boolean().nullable().default(null),
  semiconductorClusterPlanConsultationCompleted: z.boolean().nullable().default(null),
  semiconductorClusterPlanApprovalPublished: z.boolean().nullable().default(null),
  semiconductorClusterPlanApprovalPublishedDate: isoDateSchema.nullable().default(null),
  semiconductorClusterPlanApprovalNoticeReference: z.string().max(300).default(""),
  semiconductorClusterPlanIncludedPermitIds: z.array(z.string()).default([]),
  industrialComplexPlanSpecialCaseConfirmed: z.boolean().nullable().default(null),
  industrialComplexPlanDocumentsIncluded: z.boolean().nullable().default(null),
  industrialComplexPlanConsultationCompleted: z.boolean().nullable().default(null),
  industrialComplexPlanApprovalPublished: z.boolean().nullable().default(null),
  industrialComplexPlanApprovalPublishedDate: isoDateSchema.nullable().default(null),
  industrialComplexPlanApprovalNoticeReference: z.string().max(300).default(""),
  industrialComplexPlanIncludedPermitIds: z.array(z.string()).default([]),
  regionalSpecialZonePlanDeemingConfirmed: z.boolean().nullable().default(null),
  regionalSpecialZonePlanDocumentsIncluded: z.boolean().nullable().default(null),
  regionalSpecialZonePlanConsultationCompleted: z.boolean().nullable().default(null),
  regionalSpecialZonePlanApprovalPublished: z.boolean().nullable().default(null),
  regionalSpecialZonePlanApprovalPublishedDate: isoDateSchema.nullable().default(null),
  regionalSpecialZonePlanApprovalNoticeReference: z.string().max(300).default(""),
  regionalSpecialZonePlanIncludedPermitIds: z.array(z.string()).default([]),
  permitCoordination: z.string().nullable(),
  airEmissionFacility: z.boolean().nullable(),
  airTotalManagementBusinessTarget: z.boolean().nullable().default(null),
  supplementalPermitReviewedIds: z
    .array(z.enum(supplementalPermitTargetIds))
    .default([]),
  supplementalPermitTargetIds: z
    .array(z.enum(supplementalPermitTargetIds))
    .default([]),
  waterDischargeFacility: z.boolean().nullable(),
  noiseVibrationFacility: z.boolean().nullable().default(null),
  environmentalAssessmentType: z.enum(["NONE", "ENVIRONMENTAL", "SMALL"]).nullable(),
  localEnvironmentalAssessmentRequired: z.boolean().nullable().default(null),
  integratedEnvironmentalPermitTarget: z.boolean().nullable(),
  chemicalsHandled: z.boolean().nullable(),
  chemicalManufactureOrImport: z.boolean().nullable(),
  hazardousChemicalBusiness: z.boolean().nullable(),
  hazardousMaterials: z.boolean().nullable(),
  highPressureGas: z.boolean().nullable(),
  highPressureGasBusinessStartTarget: z.boolean().nullable().default(null),
  specificHighPressureGasUse: z.boolean().nullable(),
  lpgSpecificUseFacility: z.boolean().nullable().default(null),
  cityGasSpecificUseFacility: z.boolean().nullable().default(null),
  psmCovered: z.boolean().nullable(),
  psmCoversSameHazardPreventionScope: z.boolean().nullable().default(null),
  fireFacilityWork: z.boolean().nullable(),
  fireWorkSupervisionTarget: z.boolean().nullable().default(null),
  firstFireSelfInspectionTarget: z.boolean().nullable().default(null),
  privateElectricalFacilityWork: z.boolean().nullable(),
  energyUsePlanRequired: z.boolean().nullable(),
  groundwaterDevelopment: z.boolean().nullable(),
  disasterImpactAssessmentType: z
    .enum(["NONE", "DISASTER_IMPACT", "DISASTER_IMPACT_REVIEW"])
    .nullable()
    .default(null),
  undergroundSafetyAssessmentType: z
    .enum(["NONE", "UNDERGROUND_SAFETY", "SMALL_UNDERGROUND_SAFETY"])
    .nullable()
    .default(null),
  nationalHeritageAssessmentType: z
    .enum(["NONE", "PRELIMINARY_CONSULTATION", "IMPACT_DIAGNOSIS", "SIMPLIFIED_DIAGNOSIS"])
    .nullable()
    .default(null),
  militaryProtectionConsultationRequired: z.boolean().nullable().default(null),
  riverOccupationRequired: z.boolean().nullable().default(null),
  publicWaterOccupationRequired: z.boolean().nullable().default(null),
  waterSourceProtectionZone: z.boolean().nullable().default(null),
  safetyManagementPlanRequired: z.boolean().nullable().default(null),
  specificWorkReportRequired: z.boolean().nullable().default(null),
  asbestosPresent: z.boolean().nullable().default(null),
  publicSewerConnection: z.boolean().nullable().default(null),
  privateSewageTreatmentFacility: z.boolean().nullable().default(null),
  wasteFacility: z.boolean().nullable().default(null),
  chemicalRegistrationRequired: z.boolean().nullable().default(null),
  restrictedOrToxicChemicalImport: z.boolean().nullable().default(null),
  fireSafetyManagerRequired: z.boolean().nullable().default(null),
  hazardousMaterialsTank: z.boolean().nullable().default(null),
  hazardousMaterialsPreventionRulesRequired: z.boolean().nullable().default(null),
  heatUseEquipment: z.boolean().nullable().default(null),
  hazardousMachineryInspectionRequired: z.boolean().nullable().default(null),
  safetyManagerRequired: z.boolean().nullable().default(null),
  healthManagerRequired: z.boolean().nullable().default(null),
  forestRestorationObligation: z.boolean().nullable().default(null),
  powerIncreaseMw: z.number().nullable(),
  waterDemandM3Day: z.number().nullable(),
  wastewaterM3Day: z.number().nullable(),
  userDurationOverrides: z.record(
    z.string().regex(/^[a-z0-9-]{1,100}$/),
    z.object({
      value: z.number().int().min(0).max(3_650),
      unit: z.enum(["BUSINESS_DAY", "CALENDAR_DAY", "MONTH"]),
    }),
  ).default({}),
}).superRefine((answers, context) => {
  if (Object.keys(answers.userDurationOverrides).length > 250) {
    context.addIssue({
      code: "custom",
      path: ["userDurationOverrides"],
      message: "사용자 예상 처리기간은 최대 250개 절차까지 입력할 수 있습니다.",
    });
  }
  const reviewed = new Set(answers.supplementalPermitReviewedIds);
  for (const targetId of answers.supplementalPermitTargetIds) {
    if (reviewed.has(targetId)) continue;
    context.addIssue({
      code: "custom",
      path: ["supplementalPermitTargetIds"],
      message: "대상으로 선택한 정밀검토 절차는 검토 완료 목록에도 포함되어야 합니다.",
    });
  }
  for (const [left, right, message] of [
    [
      "information-communication-supervisor-assignment-report",
      "information-communication-pre-use-inspection",
      "동일 정보통신공사 범위는 감리결과보고서 제출 경로와 사용전검사 경로를 동시에 선택할 수 없습니다.",
    ],
    [
      "marine-use-consultation",
      "marine-use-impact-assessment",
      "동일 해양 이용사업은 해양이용협의와 해양이용영향평가를 동시에 선택할 수 없습니다.",
    ],
  ] as const) {
    if (
      !answers.supplementalPermitTargetIds.includes(left) ||
      !answers.supplementalPermitTargetIds.includes(right)
    ) continue;
    context.addIssue({
      code: "custom",
      path: ["supplementalPermitTargetIds"],
      message,
    });
  }
  if (
    answers.psmCoversSameHazardPreventionScope !== null
    && (
      answers.psmCovered !== true
      || !answers.supplementalPermitTargetIds.includes("hazard-prevention-plan")
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["psmCoversSameHazardPreventionScope"],
      message: "PSM 동일설비 범위는 PSM과 유해위험방지계획서가 모두 대상일 때만 입력할 수 있습니다.",
    });
  }
});

const scenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  answers: scenarioAnswerSchema,
});

const additionalRuleIdsByProcedure: Record<string, string[]> = [
  {
    "air-emission-installation-permit": ["rule-exp-air-integrated-exclusion"],
    "water-discharge-installation-permit": ["rule-exp-water-integrated-exclusion"],
  },
  specialLawRuleIdsByProcedure,
  specialLawProcessRuleIdsByProcedure,
].reduce<Record<string, string[]>>((merged, additions) => {
  for (const [procedureId, ruleIds] of Object.entries(additions)) {
    merged[procedureId] = [...new Set([...(merged[procedureId] ?? []), ...ruleIds])];
  }
  return merged;
}, {});

const excludedNonPermitProcedureIds = new Set([
  "utility-supply-consultation",
  "asbestos-survey",
  "air-environmental-technician-appointment",
  "water-environmental-technician-appointment",
  "local-investment-agreement",
  "local-investment-subsidy-application-review",
  "local-investment-subsidy-grant-payment",
  "local-investment-subsidy-settlement",
]);
const excludedNonPermitSourceIds = new Set([
  "src-local-investment-subsidy-notice-20260720",
  "src-exp-duration-local-investment-subsidy-application-review",
]);
const isExcludedCitation = (citationId: string) =>
  [...excludedNonPermitProcedureIds].some(
    (procedureId) =>
      citationId === `cit-exp-${procedureId}` ||
      citationId.startsWith(`cit-exp-${procedureId}-`),
  );

const procedures = z.array(procedureSchema).parse(
  [
    ...proceduresJson,
    ...expandedProcedures,
    ...specialLawProcedures,
    ...specialLawProcessProcedures,
  ]
  .filter((procedure) => !excludedNonPermitProcedureIds.has(procedure.id))
  .map((procedure) => ({
    ...procedure,
    ruleIds: [...new Set([
      ...procedure.ruleIds,
      ...(additionalRuleIdsByProcedure[procedure.id] ?? []),
    ])],
    deemedByProcedureIds: [...new Set([
      ...procedure.deemedByProcedureIds,
      ...(specialLawDeemingParentsByProcedure[procedure.id] ?? []),
    ])],
  })),
);
const fastTrackTargetRules = buildFastTrackTargetRules(procedures);
const fastTrackTargetEdges = buildFastTrackTargetEdges(procedures);
const edges = z.array(procedureEdgeSchema).parse(
  [
    ...edgesJson,
    ...expandedEdges,
    ...specialLawEdges,
    ...specialLawProcessEdges,
    ...fastTrackTargetEdges,
  ].filter(
    (edge) =>
      !excludedNonPermitProcedureIds.has(edge.from) &&
      !excludedNonPermitProcedureIds.has(edge.to),
  ),
);
const rules = z.array(applicabilityRuleSchema).parse(
  [
    ...rulesJson,
    ...expandedRules,
    ...specialLawRules,
    ...specialLawProcessRules,
    ...fastTrackTargetRules,
    ...aiDataCenterProfileRules,
  ].filter(
    (rule) => !excludedNonPermitProcedureIds.has(rule.procedureId),
  ),
);
const legalSources = z.array(legalSourceSchema).parse(
  [...legalSourcesJson, ...expandedLegalSources, ...specialLawLegalSources].filter(
    (source) => !excludedNonPermitSourceIds.has(source.id),
  ),
);
const citations = z.array(legalCitationSchema).parse(
  [...citationsJson, ...expandedCitations, ...specialLawCitations].filter(
    (citation) => !isExcludedCitation(citation.id),
  ),
);
const durations = z.array(durationEstimateSchema).parse(
  [
    ...durationsJson,
    ...expandedDurations,
    ...specialLawDurations,
    ...specialLawProcessDurations,
  ].filter(
    (duration) => !excludedNonPermitProcedureIds.has(duration.procedureId),
  ),
);
const coverage = coverageSchema.parse(coverageJson);
const scenarios = z.array(scenarioSchema).parse(scenariosJson);

function assertUnique(label: string, ids: string[]) {
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) {
    throw new Error(`${label} 중복 ID: ${[...new Set(duplicates)].join(", ")}`);
  }
}

function assertCatalogReferences() {
  assertUnique("procedure", procedures.map((item) => item.id));
  assertUnique("edge", edges.map((item) => item.id));
  assertUnique("rule", rules.map((item) => item.id));
  assertUnique("source", legalSources.map((item) => item.id));
  assertUnique("citation", citations.map((item) => item.id));
  assertUnique("duration", durations.map((item) => item.id));

  const procedureIds = new Set(procedures.map((item) => item.id));
  const ruleIds = new Set(rules.map((item) => item.id));
  const sourceIds = new Set(legalSources.map((item) => item.id));
  const citationIds = new Set(citations.map((item) => item.id));
  const durationIds = new Set(durations.map((item) => item.id));

  for (const citation of citations) {
    if (!sourceIds.has(citation.sourceId)) {
      throw new Error(`citation ${citation.id}: source ${citation.sourceId} 없음`);
    }
  }

  for (const rule of rules) {
    if (!procedureIds.has(rule.procedureId)) {
      throw new Error(`rule ${rule.id}: procedure ${rule.procedureId} 없음`);
    }
    for (const citationId of rule.citationIds) {
      if (!citationIds.has(citationId)) {
        throw new Error(`rule ${rule.id}: citation ${citationId} 없음`);
      }
    }
  }

  for (const procedure of procedures) {
    for (const ruleId of procedure.ruleIds) {
      if (!ruleIds.has(ruleId)) throw new Error(`procedure ${procedure.id}: rule ${ruleId} 없음`);
    }
    for (const citationId of procedure.citationIds) {
      if (!citationIds.has(citationId)) {
        throw new Error(`procedure ${procedure.id}: citation ${citationId} 없음`);
      }
    }
    if (procedure.durationId && !durationIds.has(procedure.durationId)) {
      throw new Error(`procedure ${procedure.id}: duration ${procedure.durationId} 없음`);
    }
  }

  for (const edge of edges) {
    if (!procedureIds.has(edge.from) || !procedureIds.has(edge.to)) {
      throw new Error(`edge ${edge.id}: procedure 참조 없음`);
    }
    if (edge.conditionRuleId && !ruleIds.has(edge.conditionRuleId)) {
      throw new Error(`edge ${edge.id}: rule ${edge.conditionRuleId} 없음`);
    }
    for (const citationId of edge.citationIds) {
      if (!citationIds.has(citationId)) {
        throw new Error(`edge ${edge.id}: citation ${citationId} 없음`);
      }
    }
  }

  const adjacency = new Map<string, string[]>();
  const indegree = new Map(procedures.map((item) => [item.id, 0]));
  for (const edge of edges) {
    adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to]);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }
  const queue = [...indegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id)
    .sort();
  let visited = 0;
  while (queue.length) {
    const id = queue.shift()!;
    visited += 1;
    for (const next of (adjacency.get(id) ?? []).sort()) {
      const value = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, value);
      if (value === 0) queue.push(next);
    }
    queue.sort();
  }
  if (visited !== procedures.length) throw new Error("procedure edge graph에 순환이 있습니다.");
}

assertCatalogReferences();

export const catalog = {
  procedures,
  edges,
  rules,
  legalSources,
  citations,
  durations,
  coverage,
  scenarios,
} as const;

export type ScenarioAnswers = z.infer<typeof scenarioAnswerSchema>;
