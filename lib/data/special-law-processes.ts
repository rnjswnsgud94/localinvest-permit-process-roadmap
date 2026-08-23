import type {
  ApplicabilityRule,
  Condition,
  DurationEstimate,
  Procedure,
  ProcedureEdge,
} from "@/lib/domain/schemas";

const nationwide = {
  nationwide: true,
  provinces: [],
  cities: [],
  industrialComplexIds: [],
};

const processTokenPath = (lawId: FastTrackLawId | PlanDeemingLawId) =>
  `confirmation.specialLawProcessTokens.${lawId}`;

const selectedLaw = (lawId: string, path: string): Condition => ({
  intersects: {
    path,
    values: [lawId],
  },
});

export type FastTrackLawId =
  | "ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK"
  | "SEMICONDUCTOR_CLUSTER_FAST_TRACK";

export const industrialComplexPlanDeemedProcedureIds = [
  "factory-establishment-approval",
  "development-activity-permit",
  "farmland-conversion-permit",
  "forestland-conversion-permit",
  "road-occupation-permit",
  "river-occupation-permit",
  "public-water-occupation-use-permit",
  "public-water-implementation-plan-approval-report",
  "energy-use-plan-consultation",
  "building-permit",
  "private-electrical-facility-construction-plan",
  "waste-treatment-facility-installation-approval-report",
] as const;

export const regionalSpecialZoneDeemedProcedureIds = [
  "development-activity-permit",
  "farmland-conversion-permit",
  "forestland-conversion-permit",
  "road-occupation-permit",
  "river-occupation-permit",
  "public-water-occupation-use-permit",
  "public-water-implementation-plan-approval-report",
] as const;

export const semiconductorClusterPlanDeemedProcedureIds = [
  ...industrialComplexPlanDeemedProcedureIds,
  "air-emission-installation-permit",
  "water-discharge-installation-permit",
  "national-heritage-impact-diagnosis",
] as const;

export type PlanDeemingLawId =
  | "SEMICONDUCTOR_CLUSTER_PLAN_DEEMING"
  | "INDUSTRIAL_COMPLEX_PLAN_INTEGRATED_APPROVAL"
  | "REGIONAL_SPECIAL_ZONE_PLAN_DEEMING";

export const planDeemedProcedureIdsByLaw: Record<
  PlanDeemingLawId,
  readonly string[]
> = {
  SEMICONDUCTOR_CLUSTER_PLAN_DEEMING:
    semiconductorClusterPlanDeemedProcedureIds,
  INDUSTRIAL_COMPLEX_PLAN_INTEGRATED_APPROVAL:
    industrialComplexPlanDeemedProcedureIds,
  REGIONAL_SPECIAL_ZONE_PLAN_DEEMING:
    regionalSpecialZoneDeemedProcedureIds,
};

export function filterPlanDeemedProcedureIds(
  lawId: PlanDeemingLawId,
  procedureIds: readonly string[],
) {
  const allowedIds = new Set(planDeemedProcedureIdsByLaw[lawId]);
  return [
    ...new Set(
      procedureIds.filter((procedureId) => allowedIds.has(procedureId)),
    ),
  ];
}

/**
 * Both fast-track Acts use a closed statutory gateway instead of every permit
 * connected to the project. The common list is the part represented in this
 * catalog of the Industrial Sites and Development Act art. 21 deemed matters
 * and the Industrial Cluster Development Act art. 13-2 deemed-matter
 * consultations.
 *
 * The national-strategic-industry Act also names rural-road occupancy and
 * buried-heritage development consultation, and its Enforcement Decree art.
 * 30(2) adds the two exact procedures appended to its own list below. The
 * catalog has no procedure whose legal source is either rural-road or
 * buried-heritage provision, so a generic Road Act permit or the newer
 * heritage-diagnosis procedure must not be substituted for them.
 */
const commonFastTrackTargetProcedureIds = [
  ...industrialComplexPlanDeemedProcedureIds,
  "air-emission-installation-permit",
  "water-discharge-installation-permit",
] as const;

export const fastTrackTargetProcedureIdsByLaw: Record<
  FastTrackLawId,
  readonly string[]
> = {
  ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK: [
    ...commonFastTrackTargetProcedureIds,
    "landscape-review",
    "building-use-approval",
  ],
  SEMICONDUCTOR_CLUSTER_FAST_TRACK: [
    ...commonFastTrackTargetProcedureIds,
    // Semiconductor Special Act art. 26(4) expressly includes this diagnosis.
    "national-heritage-impact-diagnosis",
  ],
};

export function isFastTrackTargetProcedure(
  lawId: FastTrackLawId,
  procedure: Pick<Procedure, "id">,
) {
  return fastTrackTargetProcedureIdsByLaw[lawId].includes(procedure.id);
}

export function getFastTrackTargetProcedureIds(
  lawId: FastTrackLawId,
  procedures: readonly Pick<Procedure, "id">[],
) {
  return procedures
    .filter((procedure) => isFastTrackTargetProcedure(lawId, procedure))
    .map((procedure) => procedure.id);
}

export function filterFastTrackTargetProcedureIds(
  lawId: FastTrackLawId,
  procedureIds: readonly string[],
  procedures: readonly Pick<Procedure, "id">[],
) {
  const allowedIds = new Set(
    getFastTrackTargetProcedureIds(lawId, procedures),
  );
  return [
    ...new Set(
      procedureIds.filter((procedureId) => allowedIds.has(procedureId)),
    ),
  ];
}

type FastTrackConfig = {
  lawId: FastTrackLawId;
  prefix: string;
  effectiveFrom: string;
  lawName: string;
  scope: string;
  citationIds: string[];
  durationCitationIds: string[];
  requestDurationDays: number;
  requestDurationCitationIds: string[];
};

const fastTracks: FastTrackConfig[] = [
  {
    lawId: "ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK",
    prefix: "advanced-strategic-industry-fast-track",
    effectiveFrom: "2023-07-01",
    lawName: "국가첨단전략산업 특별조치법",
    scope: "전략산업 특화단지",
    citationIds: [
      "cit-advanced-strategic-industry-act-19-applicability",
      "cit-advanced-strategic-industry-act-19-deeming",
      "cit-advanced-strategic-industry-decree-30",
    ],
    durationCitationIds: ["cit-advanced-strategic-industry-act-19-duration"],
    requestDurationDays: 21,
    requestDurationCitationIds: [
      "cit-advanced-strategic-industry-rule-form9-duration",
      "cit-civil-petitions-act-19-time-calculation",
      "cit-civil-petitions-decree-20-stop-clock",
      "cit-administrative-procedure-decree-11-stop-clock",
    ],
  },
  {
    lawId: "SEMICONDUCTOR_CLUSTER_FAST_TRACK",
    prefix: "semiconductor-cluster-fast-track",
    effectiveFrom: "2026-08-11",
    lawName: "반도체산업 특별법",
    scope: "반도체클러스터",
    citationIds: [
      "cit-semiconductor-special-act-27-applicability",
      "cit-semiconductor-special-act-27-deeming",
    ],
    durationCitationIds: ["cit-semiconductor-special-act-27-duration"],
    requestDurationDays: 15,
    requestDurationCitationIds: [
      "cit-semiconductor-special-rule-form3-duration",
      "cit-civil-petitions-act-19-time-calculation",
      "cit-civil-petitions-decree-20-stop-clock",
      "cit-administrative-procedure-decree-11-stop-clock",
    ],
  },
];

type PlanConfig = {
  lawId: string;
  prefix: string;
  effectiveFrom: string;
  lawName: string;
  planName: string;
  citationIds: string[];
  deemedProcedureIds: readonly string[];
  authority: string;
  decisionMaker: string;
};

const plans: PlanConfig[] = [
  {
    lawId: "SEMICONDUCTOR_CLUSTER_PLAN_DEEMING",
    prefix: "semiconductor-cluster-plan",
    effectiveFrom: "2026-08-11",
    lawName: "반도체산업 경쟁력 강화 및 지원에 관한 특별법",
    planName: "반도체클러스터 조성계획",
    citationIds: [
      "cit-semiconductor-special-act-26-deeming",
      "cit-semiconductor-special-act-26-duration-scope",
      "cit-semiconductor-special-rule-form1-duration",
      "cit-civil-petitions-act-19-time-calculation",
    ],
    deemedProcedureIds: semiconductorClusterPlanDeemedProcedureIds,
    authority: "산업통상부 반도체클러스터 담당부서",
    decisionMaker: "산업통상부장관 및 관계 행정기관의 장",
  },
  {
    lawId: "INDUSTRIAL_COMPLEX_PLAN_INTEGRATED_APPROVAL",
    prefix: "industrial-complex-plan",
    effectiveFrom: "2008-09-06",
    lawName: "산업단지 인·허가 절차 간소화 특례법",
    planName: "산업단지계획",
    citationIds: [
      "cit-industrial-complex-fast-track-act-9-duration",
      "cit-industrial-complex-fast-track-act-10-duration",
      "cit-industrial-complex-fast-track-act-15",
      "cit-industrial-complex-fast-track-act-16",
      "cit-industrial-complex-fast-track-act-16-2-duration",
      "cit-industrial-complex-fast-track-act-22-duration",
      "cit-industrial-complex-fast-track-act-23-duration",
      "cit-industrial-complex-fast-track-decree-11-duration-exception",
      "cit-industrial-location-act-21",
    ],
    deemedProcedureIds: industrialComplexPlanDeemedProcedureIds,
    authority: "산업단지 지정권자",
    decisionMaker: "산업단지 지정권자 및 산업단지계획심의위원회",
  },
  {
    lawId: "REGIONAL_SPECIAL_ZONE_PLAN_DEEMING",
    prefix: "regional-special-zone-plan",
    effectiveFrom: "2019-04-17",
    lawName: "규제자유특구 및 지역특화발전특구 규제특례법",
    planName: "특화특구계획·특구토지이용계획",
    citationIds: [
      "cit-regional-special-zone-act-64-65",
      "cit-regional-special-zone-decree-application-duration",
      "cit-regional-special-zone-decree-7-duration",
      "cit-regional-special-zone-decree-7-consultation-duration",
    ],
    deemedProcedureIds: regionalSpecialZoneDeemedProcedureIds,
    authority: "관할 지방자치단체 특구 담당부서",
    decisionMaker: "중소벤처기업부장관 및 관계 행정기관의 장",
  },
];

const includeRule = ({
  id,
  procedureId,
  effectiveFrom,
  lawId,
  processLawId,
  parentLawId,
  citationIds,
  explanation,
}: {
  id: string;
  procedureId: string;
  effectiveFrom: string;
  lawId: string;
  processLawId: FastTrackLawId | PlanDeemingLawId;
  parentLawId?: string;
  citationIds: string[];
  explanation: string;
}): ApplicabilityRule => ({
  id,
  version: "2026.08.21.1",
  procedureId,
  effect: "INCLUDE",
  effectiveFrom,
  effectiveTo: null,
  jurisdiction: nationwide,
  condition: parentLawId
    ? {
        all: [
          selectedLaw(parentLawId, processTokenPath(processLawId)),
          selectedLaw(lawId, processTokenPath(processLawId)),
        ],
      }
    : selectedLaw(lawId, processTokenPath(processLawId)),
  requiredInputs: [processTokenPath(processLawId)],
  missingPolicy: "INDETERMINATE",
  citationIds,
  explanationTemplate: explanation,
  priority: 700,
  status: "INTERNAL_REVIEWED",
  reviewActor: "법제처 현행 법률 조문 대조",
  note: "사용자가 사업시행자·요청 또는 계획·서류·협의 요건을 확인한 경우에만 활성화합니다.",
});

export const specialLawProcessRules: ApplicabilityRule[] = [
  ...fastTracks.flatMap((config) => [
    includeRule({
      id: `rule-${config.prefix}-request`,
      procedureId: `${config.prefix}-request`,
      effectiveFrom: config.effectiveFrom,
      lawId: config.lawId,
      processLawId: config.lawId,
      citationIds: config.citationIds,
      explanation: `${config.scope} 사업의 관계 인허가 신속처리 요청 요건을 확인해 요청·대상목록 관리 절차를 포함합니다.`,
    }),
    includeRule({
      id: `rule-${config.prefix}-result-check`,
      procedureId: `${config.prefix}-result-check`,
      effectiveFrom: config.effectiveFrom,
      lawId: config.lawId,
      processLawId: config.lawId,
      citationIds: config.citationIds,
      explanation: `${config.scope} 신속처리 요청 후 개별 법정기한·60일 조건과 실제 처리결과를 확인하는 절차를 포함합니다.`,
    }),
  ]),
  ...plans.flatMap((config) => [
    includeRule({
      id: `rule-${config.prefix}-application`,
      procedureId: `${config.prefix}-application`,
      effectiveFrom: config.effectiveFrom,
      lawId: `${config.lawId}:PHASE:APPLICATION`,
      processLawId: config.lawId as PlanDeemingLawId,
      citationIds: config.citationIds,
      explanation: `${config.planName}에 사업과 의제대상 서류를 포함해 승인 신청하는 절차를 포함합니다.`,
    }),
    includeRule({
      id: `rule-${config.prefix}-consultation`,
      procedureId: `${config.prefix}-consultation`,
      effectiveFrom: config.effectiveFrom,
      lawId: `${config.lawId}:PHASE:CONSULTATION`,
      processLawId: config.lawId as PlanDeemingLawId,
      citationIds: config.citationIds,
      explanation: `${config.planName}의 개별 인허가 의제를 위한 관계기관 협의 절차를 포함합니다.`,
    }),
    includeRule({
      id: `rule-${config.prefix}-approval`,
      procedureId: `${config.prefix}-approval`,
      effectiveFrom: config.effectiveFrom,
      lawId: `${config.lawId}:PHASE:APPROVAL`,
      processLawId: config.lawId as PlanDeemingLawId,
      citationIds: config.citationIds,
      explanation: `${config.planName} 승인과 협의 완료된 개별 인허가의 의제 결과 확인 절차를 포함합니다.`,
    }),
    ...config.deemedProcedureIds.map((procedureId): ApplicabilityRule => ({
      id: `rule-${config.prefix}-deems-${procedureId}`,
      version: "2026.08.21.1",
      procedureId,
      effect: "EXCLUDE",
      effectiveFrom: config.effectiveFrom,
      effectiveTo: null,
      jurisdiction: nationwide,
      condition: {
        all: [
          selectedLaw(
            config.lawId,
            processTokenPath(config.lawId as PlanDeemingLawId),
          ),
          selectedLaw(
            `${config.lawId}:${procedureId}`,
            processTokenPath(config.lawId as PlanDeemingLawId),
          ),
        ],
      },
      requiredInputs: [
        processTokenPath(config.lawId as PlanDeemingLawId),
      ],
      // A plan approval is deemed only after every approval/evidence fact is
      // confirmed. Until then this exceptional exclusion must stay neutral so
      // it cannot hide or delay the ordinary permit route.
      missingPolicy: "NON_MATCH",
      citationIds: config.citationIds,
      explanationTemplate: `${config.planName}에 이 인허가의 법정서류가 포함되고 관계기관 협의 및 계획 승인·고시 완료 증거가 확인되어 별도 신청 대신 계획승인 의제 경로로 표시합니다.`,
      priority: 900,
      status: "INTERNAL_REVIEWED",
      reviewActor: "법제처 현행 법률 의제조문 대조",
      note: "상위 계획 포함, 관계기관 협의, 승인·고시일과 고시문 근거가 모두 확인된 경우에만 적용합니다. 단순 지역·산업단지 소재로는 적용하지 않습니다.",
    })),
  ]),
];

export function buildFastTrackTargetRules(
  procedures: readonly Pick<Procedure, "id">[],
): ApplicabilityRule[] {
  return fastTracks.flatMap((config) =>
    getFastTrackTargetProcedureIds(config.lawId, procedures).map((procedureId) => includeRule({
      id: `rule-${config.prefix}-tracks-${procedureId}`,
      procedureId: `${config.prefix}-request`,
      effectiveFrom: config.effectiveFrom,
      lawId: `${config.lawId}:${procedureId}`,
      processLawId: config.lawId,
      parentLawId: config.lawId,
      citationIds: config.citationIds,
      explanation: `${config.scope} 신속처리 요청 공문의 대상목록에 ${procedureId} 절차가 포함된 것으로 확인했습니다.`,
    })),
  );
}

const baseProcedure = ({
  id,
  name,
  description,
  outcome,
  stage,
  actionType,
  domain,
  applicant,
  receivingAuthority,
  statutoryDecisionMaker,
  consultationAuthorities,
  submissions,
  citations,
  deemedProcedureIds = [],
}: {
  id: string;
  name: string;
  description: string;
  outcome: string;
  stage: Procedure["stage"];
  actionType: Procedure["actionType"];
  domain: string;
  applicant: string;
  receivingAuthority: string;
  statutoryDecisionMaker: string;
  consultationAuthorities: string[];
  submissions: string[];
  citations: string[];
  deemedProcedureIds?: string[];
}): Procedure => ({
  id,
  name,
  aliases: [],
  description,
  outcome,
  stage,
  actionType,
  domain,
  lane: "CENTRAL_OR_REGIONAL_OFFICE",
  applicant,
  receivingAuthority,
  statutoryDecisionMaker,
  consultationAuthorities,
  submissions,
  validity: "승인·요청 대상 사업계획과 개별 인허가 조건에 따름",
  followUpObligations: ["대상 인허가별 신청·협의·처리결과 보관", "사업계획 변경 시 재협의·변경승인 여부 확인"],
  ruleIds: [],
  citationIds: citations,
  durationId: `duration-${id}`,
  verificationStatus: "INTERNAL_REVIEWED",
  reviewedAt: "2026-08-21",
  reviewNote: "법정 절차와 조건만 구조화했습니다. 하위 기관의 실제 접수서식·준비기간·보완기간은 별도 확인해야 합니다.",
  deemedByProcedureIds: [],
  deemedProcedureIds,
});

export const specialLawProcessProcedures: Procedure[] = [
  ...fastTracks.flatMap((config) => [
    baseProcedure({
      id: `${config.prefix}-request`,
      name: `${config.scope} 인허가 신속처리 요청`,
      description: `${config.lawName}에 따라 산업통상부장관이 관계 인허가의 신속처리를 요청하는 경로입니다. 요청 대상 인허가 목록을 실제 공문과 대조해야 합니다.`,
      outcome: "신속처리 요청 공문과 대상 인허가 목록",
      stage: "SITE_REVIEW",
      actionType: "NOTICE",
      domain: "특별법 신속처리",
      applicant: `${config.scope} 사업시행자와 산업통상부장관`,
      receivingAuthority: "산업통상부 및 개별 인허가 관계기관",
      statutoryDecisionMaker: "산업통상부장관과 개별 인허가 관계기관의 장",
      consultationAuthorities: ["신속처리 요청 대상 개별 인허가 관계기관"],
      submissions: ["사업시행자·특화단지 또는 클러스터 해당 확인자료", "신속처리 요청 대상 인허가 목록", "개별 인허가 신청서류와 접수일·법정 처리기한"],
      citations: [...config.citationIds, ...config.requestDurationCitationIds],
    }),
    baseProcedure({
      id: `${config.prefix}-result-check`,
      name: `${config.scope} 신속처리 결과·기한 확인`,
      description: "신속처리 요청 후 처리계획 회신(15일, 보완 시에도 최대 30일)과 계획 제출 후 결과 통보(15일, 불가피한 경우 1회 15일 연장) 준수 여부를 확인합니다. 해당 단계 기한을 지키지 않은 경우에만 장관 요청일로부터 60일 경과일에 ‘처리 완료로 봄’ 조건을 검토합니다.",
      outcome: "개별 인허가 처리결과 또는 법정 처리완료 의제 검토기록",
      stage: "PRE_CONSTRUCTION",
      actionType: "REVIEW",
      domain: "특별법 신속처리",
      applicant: `${config.scope} 사업시행자`,
      receivingAuthority: "산업통상부 및 개별 인허가 관계기관",
      statutoryDecisionMaker: "개별 인허가 관계기관의 장",
      consultationAuthorities: ["산업통상부", "개별 인허가 관계기관"],
      submissions: ["신속처리 요청일 증빙", "개별 신청 접수증", "처리계획 회신일·보완기간 산정표", "처리결과 통보일·연장요청·거부 통지"],
      citations: [...config.citationIds, ...config.durationCitationIds],
    }),
  ]),
  ...plans.flatMap((config) => [
    baseProcedure({
      id: `${config.prefix}-application`,
      name: `${config.planName} 승인 신청`,
      description: `${config.planName}에 사업계획과 의제받으려는 인허가별 법정서류를 포함해 승인권자에게 제출하는 절차입니다.`,
      outcome: `${config.planName} 승인신청 접수`,
      stage: "SITE_REVIEW",
      actionType: "APPROVAL",
      domain: "특별법 통합승인",
      applicant: "계획 수립권자 또는 법정 사업시행자",
      receivingAuthority: config.authority,
      statutoryDecisionMaker: config.decisionMaker,
      consultationAuthorities: ["계획 및 의제대상 인허가 관계기관"],
      submissions: [`${config.planName}안`, "의제대상 인허가 목록", "각 의제 인허가의 법정 신청서류", "토지이용·환경·교통·재해 등 관계 검토자료"],
      citations: config.citationIds,
    }),
    baseProcedure({
      id: `${config.prefix}-consultation`,
      name: `${config.planName} 관계기관 협의`,
      description: "상위 계획 승인 전에 의제받으려는 각 인허가의 관계기관과 법정서류·조건을 협의하는 절차입니다. 협의하지 않은 인허가는 의제로 표시하지 않습니다.",
      outcome: "관계기관 협의의견과 조치계획",
      stage: "PLAN_AND_OCCUPANCY",
      actionType: "CONSULTATION",
      domain: "특별법 통합승인",
      applicant: "계획 승인권자와 사업시행자",
      receivingAuthority: config.authority,
      statutoryDecisionMaker: config.decisionMaker,
      consultationAuthorities: ["의제대상 개별 인허가 관계기관"],
      submissions: ["인허가별 협의요청서", "법정 신청서류", "관계기관 의견", "협의조건 반영표"],
      citations: config.citationIds,
    }),
    baseProcedure({
      id: `${config.prefix}-approval`,
      name: `${config.planName} 승인·의제 결과 확인`,
      description: `${config.planName} 승인·고시와 함께 실제 서류 포함 및 관계기관 협의가 완료된 개별 인허가의 의제 범위와 조건을 확인합니다.`,
      outcome: `${config.planName} 승인·고시와 인허가별 의제 확인표`,
      stage: "PLAN_AND_OCCUPANCY",
      actionType: "APPROVAL",
      domain: "특별법 통합승인",
      applicant: "계획 승인권자와 사업시행자",
      receivingAuthority: config.authority,
      statutoryDecisionMaker: config.decisionMaker,
      consultationAuthorities: ["의제대상 개별 인허가 관계기관"],
      submissions: ["승인·고시문", "관계기관 협의완료 자료", "의제 인허가별 조건·유효기간 확인표"],
      citations: config.citationIds,
      deemedProcedureIds: [...config.deemedProcedureIds],
    }),
  ]),
];

const unknownDuration = (
  procedureId: string,
  citations: string[],
  statutoryPeriod: string,
  variabilityFactors: string[],
): DurationEstimate => {
  const durationCitations = citations.filter((citationId) =>
    /duration|time-calculation|stop-clock/.test(citationId),
  );
  return ({
  id: `duration-${procedureId}`,
  procedureId,
  applicantPreparation: null,
  authorityProcessing: null,
  interagencyConsultation: null,
  elapsed: null,
  statutoryPeriod,
  stopClockRules: [],
  variabilityFactors,
  evidenceType: "STATUTE",
  citationIds: citations,
  sampleSize: null,
  assumptions: ["해당 법률에 별도 처리기한이 없는 절차이므로 다른 인허가의 기간이나 임의 예상값을 대입하지 않습니다."],
  verifiedAt: "2026-08-22",
  legalConfidence: "HIGH",
  estimateConfidence: "UNVERIFIED",
  planningBasis: "MILESTONE_ONLY",
  referencePeriods: [
    {
      id: `ref-${procedureId}-no-national-period`,
      kind: "PROCESS_MILESTONE",
      label: "법령상 별도 총기간 미규정",
      range: null,
      jurisdiction: null,
      startsWhen: "해당 특별법 절차를 착수한 때",
      includes: [],
      citationIds: durationCitations,
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: statutoryPeriod,
    },
  ],
  });
};

const fastTrackResultDuration = (
  procedureId: string,
  citations: string[],
): DurationEstimate => ({
  id: `duration-${procedureId}`,
  procedureId,
  applicantPreparation: null,
  authorityProcessing: null,
  interagencyConsultation: null,
  // The 15/30-day clocks start at different statutory events, and the
  // 60-day rule is conditional deeming rather than an ordinary elapsed cap.
  elapsed: null,
  statutoryPeriod: "장관 요청 후 처리계획 15일(보완기간 제외, 늦어도 30일), 계획 제출 후 처리결과 15일(불가피한 경우 한 차례 15일 연장), 해당 단계기한 미준수 시에만 요청일부터 60일 경과일에 처리 완료로 보는 조건부 규정",
  stopClockRules: [
    "처리계획 회신 15일 산정에서는 신청서류 보완에 걸린 기간을 제외함",
    "보완이 있더라도 처리계획은 장관 요청일부터 늦어도 30일 이내 회신해야 함",
  ],
  variabilityFactors: [
    "신속처리 요청일",
    "처리계획 회신일과 보완기간",
    "처리계획 제출일",
    "결과 통보의 한 차례 연장 여부",
    "두 단계기한 미준수 여부와 요청 대상 인허가 포함 여부",
  ],
  evidenceType: "STATUTE",
  citationIds: citations,
  sampleSize: null,
  assumptions: [
    "15일·30일은 서로 다른 기산점과 연장·보완 조건이 있는 단계기한이므로 하나의 총 처리기간으로 더하지 않습니다.",
    "60일은 해당 단계기한 미준수 요건이 성립할 때만 적용하는 처리완료 의제 시점이며 허가 승인으로 단정하지 않습니다.",
  ],
  verifiedAt: "2026-08-22",
  legalConfidence: "HIGH",
  estimateConfidence: "LOW",
  planningBasis: "MILESTONE_ONLY",
  referencePeriods: [
    {
      id: `ref-${procedureId}-plan-reply-basic-deadline`,
      kind: "PROCESS_MILESTONE",
      label: "처리계획 회신 기본기한",
      range: { min: null, base: null, max: 15, unit: "CALENDAR_DAY" },
      jurisdiction: null,
      startsWhen: "인허가권자가 산업통상부장관의 신속처리 요청을 받은 날",
      includes: ["AUTHORITY_PROCESSING", "RESULT_NOTICE"],
      citationIds: citations,
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: "신청서류 보완기간은 15일 산정에서 제외됩니다.",
    },
    {
      id: `ref-${procedureId}-plan-reply-absolute-deadline`,
      kind: "LEGAL_DEADLINE",
      label: "보완 포함 처리계획 회신 최장기한",
      range: { min: null, base: null, max: 30, unit: "CALENDAR_DAY" },
      jurisdiction: null,
      startsWhen: "인허가권자가 산업통상부장관의 신속처리 요청을 받은 날",
      includes: ["AUTHORITY_PROCESSING", "SUPPLEMENT", "RESULT_NOTICE"],
      citationIds: citations,
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: "보완이 있더라도 요청일부터 늦어도 30일 이내 처리계획을 회신하는 법정 단계기한입니다.",
    },
    {
      id: `ref-${procedureId}-result-basic-deadline`,
      kind: "PROCESS_MILESTONE",
      label: "처리결과 통보 기본기한",
      range: { min: null, base: null, max: 15, unit: "CALENDAR_DAY" },
      jurisdiction: null,
      startsWhen: "인허가권자가 산업통상부장관에게 처리계획을 제출한 날",
      includes: ["AUTHORITY_PROCESSING", "RESULT_NOTICE"],
      citationIds: citations,
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: "불가피한 사유가 있으면 한 차례 15일을 연장할 수 있습니다.",
    },
    {
      id: `ref-${procedureId}-result-extended-deadline`,
      kind: "LEGAL_DEADLINE",
      label: "한 차례 연장 시 처리결과 통보 최장기한",
      range: { min: null, base: null, max: 30, unit: "CALENDAR_DAY" },
      jurisdiction: null,
      startsWhen: "인허가권자가 산업통상부장관에게 처리계획을 제출한 날",
      includes: ["AUTHORITY_PROCESSING", "RESULT_NOTICE"],
      citationIds: citations,
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: "불가피한 사유로 법정 15일 연장을 모두 사용한 분기의 단계기한입니다.",
    },
    {
      id: `ref-${procedureId}-conditional-deemed-completion`,
      kind: "LEGAL_DEADLINE",
      label: "단계기한 미준수 시 조건부 처리완료 시점",
      range: { min: null, base: null, max: 60, unit: "CALENDAR_DAY" },
      jurisdiction: null,
      startsWhen: "산업통상부장관이 인허가권자에게 신속처리를 요청한 날",
      includes: ["AUTHORITY_PROCESSING", "RESULT_NOTICE"],
      citationIds: citations,
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: "처리계획 회신기한 또는 처리결과 통보기한을 지키지 않은 경우에만 처리 완료로 보는 시점입니다. 허가 승인으로 단정하지 않습니다.",
    },
  ],
});

const fastTrackRequestDuration = (
  config: FastTrackConfig,
): DurationEstimate => ({
  id: `duration-${config.prefix}-request`,
  procedureId: `${config.prefix}-request`,
  applicantPreparation: null,
  authorityProcessing: {
    min: null,
    base: null,
    max: config.requestDurationDays,
    unit: "BUSINESS_DAY",
  },
  interagencyConsultation: null,
  elapsed: {
    min: null,
    base: null,
    max: config.requestDurationDays,
    unit: "BUSINESS_DAY",
  },
  statutoryPeriod: `${config.lawName} 시행규칙 공식 신속처리신청서 처리기간 ${config.requestDurationDays}일 이내`,
  stopClockRules: [
    "민원 처리에 관한 법률상 보완 등 처리기간 불산입 사유가 있으면 실제 총 경과는 늘어날 수 있음",
  ],
  variabilityFactors: [
    "신속처리 대상 인허가 확정",
    "신청자료 보완",
    "위원회 심의·의결",
    "산업통상부장관 요청 공문 발송",
  ],
  evidenceType: "OFFICIAL_SERVICE_STANDARD",
  citationIds: config.requestDurationCitationIds,
  sampleSize: null,
  assumptions: [
    `${config.requestDurationDays}일은 신청 접수부터 산업통상부 신속처리 요청까지의 공식 처리 상한이며, 후속 인허가권자의 15일·30일·60일 단계기한과 중복 합산하지 않습니다.`,
    "6일 이상 민원 처리기간은 민원 처리에 관한 법률 제19조제2항에 따라 토요일과 공휴일을 제외하는 원 단위로 표시합니다.",
  ],
  verifiedAt: "2026-08-22",
  legalConfidence: "HIGH",
  estimateConfidence: "LOW",
  planningBasis: "OFFICIAL_CAP_ONLY",
  referencePeriods: [
    {
      id: `ref-${config.prefix}-request-official-cap`,
      kind: "NATIONWIDE_OFFICIAL_STANDARD",
      label: "신속처리신청 공식 처리 상한",
      range: {
        min: null,
        base: null,
        max: config.requestDurationDays,
        unit: "BUSINESS_DAY",
      },
      jurisdiction: null,
      startsWhen: "산업통상부가 완비된 신속처리신청서를 접수한 날",
      includes: [
        "AUTHORITY_PROCESSING",
        "COMMITTEE_WAIT",
        "RESULT_NOTICE",
      ],
      citationIds: config.requestDurationCitationIds,
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: "공식 서식의 처리기간입니다. 관계 인허가권자의 후속 처리기한은 결과·기한 확인 카드에서 별도로 표시합니다.",
    },
  ],
});

const semiconductorClusterPlanApprovalDuration = (): DurationEstimate => ({
  id: "duration-semiconductor-cluster-plan-approval",
  procedureId: "semiconductor-cluster-plan-approval",
  applicantPreparation: null,
  authorityProcessing: { min: null, base: null, max: 90, unit: "BUSINESS_DAY" },
  interagencyConsultation: null,
  elapsed: { min: null, base: null, max: 90, unit: "BUSINESS_DAY" },
  statutoryPeriod: "반도체클러스터 지정신청서 공식 처리기간 90일 이내(접수 → 검토 → 특별위원회 심의·의결 → 지정)",
  stopClockRules: [
    "민원 처리에 관한 법률상 보완 등 처리기간 불산입 사유가 있으면 실제 총 경과는 늘어날 수 있음",
  ],
  variabilityFactors: [
    "조성계획·첨부서류 완결성",
    "관계기관 협의",
    "특별위원회 심의·의결",
    "신청자료 보완",
  ],
  evidenceType: "OFFICIAL_SERVICE_STANDARD",
  citationIds: [
    "cit-semiconductor-special-rule-form1-duration",
    "cit-civil-petitions-act-19-time-calculation",
    "cit-civil-petitions-decree-20-stop-clock",
    "cit-administrative-procedure-decree-11-stop-clock",
  ],
  sampleSize: null,
  assumptions: [
    "90일은 공식 서식의 처리 상한이며 실제 평균이나 최소기간이 아닙니다.",
    "신청·관계기관 협의·승인 카드가 표현하는 하나의 지정 절차 전체 상한이므로 세 카드에 각각 더하지 않고 승인 카드에 한 번만 둡니다.",
    "6일 이상 민원 처리기간은 민원 처리에 관한 법률 제19조제2항에 따라 토요일과 공휴일을 제외하는 원 단위로 표시합니다.",
    "업무일 계산은 지방투자기업 등 민원인인 사업시행자가 신청하는 분기를 기준으로 하며, 관계 행정기관 명의 신청이면 처리기간 계산방식을 담당부서에 확인합니다.",
  ],
  verifiedAt: "2026-08-22",
  legalConfidence: "HIGH",
  estimateConfidence: "LOW",
  planningBasis: "OFFICIAL_CAP_ONLY",
  referencePeriods: [
    {
      id: "ref-semiconductor-cluster-designation-official-cap",
      kind: "NATIONWIDE_OFFICIAL_STANDARD",
      label: "반도체클러스터 지정 공식 처리 상한",
      range: { min: null, base: null, max: 90, unit: "BUSINESS_DAY" },
      jurisdiction: null,
      startsWhen: "산업통상부가 반도체클러스터 지정신청서를 접수한 날",
      includes: [
        "AUTHORITY_PROCESSING",
        "INTERAGENCY_CONSULTATION",
        "COMMITTEE_WAIT",
        "RESULT_NOTICE",
      ],
      citationIds: [
        "cit-semiconductor-special-rule-form1-duration",
        "cit-civil-petitions-act-19-time-calculation",
        "cit-civil-petitions-decree-20-stop-clock",
        "cit-administrative-procedure-decree-11-stop-clock",
      ],
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: "별지 제1호서식의 처리절차 전체에 적용하며 신청·협의 카드 기간과 중복 합산하지 않습니다.",
    },
  ],
});

const industrialComplexPlanApplicationDuration = (): DurationEstimate => ({
  id: "duration-industrial-complex-plan-application",
  procedureId: "industrial-complex-plan-application",
  applicantPreparation: null,
  authorityProcessing: null,
  interagencyConsultation: null,
  elapsed: null,
  statutoryPeriod: "특별한 사유가 없으면 승인신청일부터 3근무일 이내 공고, 공고일부터 20일 이상 일반열람, 선택적 합동설명회·공청회는 공고일부터 10근무일 이내 개최. 승인신청일부터 늦어도 4개월 이내 환경영향평가 협의 요청",
  stopClockRules: [],
  variabilityFactors: [
    "합동설명회·공청회 개최 여부",
    "주민의견과 계획 보완",
    "환경영향평가서 작성·제출 시점",
    "의제대상 인허가 서류 완결성",
  ],
  evidenceType: "STATUTE",
  citationIds: [
    "cit-industrial-complex-fast-track-act-9-duration",
    "cit-industrial-complex-fast-track-act-16-2-duration",
  ],
  sampleSize: null,
  assumptions: [
    "각 수치는 승인신청부터 최종 승인까지의 총기간이 아니라 서로 다른 공고·열람·설명회·협의요청 단계의 기한입니다.",
    "20일 열람기간과 공고일부터 10근무일 이내 설명회·공청회는 일부 겹칠 수 있으므로 순차 합산하지 않습니다.",
  ],
  verifiedAt: "2026-08-22",
  legalConfidence: "HIGH",
  estimateConfidence: "LOW",
  planningBasis: "MILESTONE_ONLY",
  referencePeriods: [
    {
      id: "ref-industrial-complex-plan-public-notice-deadline",
      kind: "PROCESS_MILESTONE",
      label: "산업단지계획 승인신청 공고기한",
      range: { min: null, base: null, max: 3, unit: "BUSINESS_DAY" },
      jurisdiction: null,
      startsWhen: "지정권자가 산업단지계획 승인신청을 받은 날",
      includes: ["AUTHORITY_PROCESSING"],
      citationIds: ["cit-industrial-complex-fast-track-act-9-duration"],
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: "특별한 사유가 없는 경우의 공고 단계 상한입니다.",
    },
    {
      id: "ref-industrial-complex-plan-public-inspection-window",
      kind: "LEGAL_DEADLINE",
      label: "산업단지계획 일반열람 최소기간",
      range: { min: 20, base: null, max: null, unit: "CALENDAR_DAY" },
      jurisdiction: null,
      startsWhen: "산업단지계획 주요 내용을 공고한 날",
      includes: ["COMMITTEE_WAIT"],
      citationIds: ["cit-industrial-complex-fast-track-act-9-duration"],
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: "최소 열람기간입니다. 10근무일 설명회·공청회 기한과 일부 겹칠 수 있어 더하지 않습니다.",
    },
    {
      id: "ref-industrial-complex-plan-hearing-deadline",
      kind: "PROCESS_MILESTONE",
      label: "선택적 합동설명회·공청회 개최기한",
      range: { min: null, base: null, max: 10, unit: "BUSINESS_DAY" },
      jurisdiction: null,
      startsWhen: "산업단지계획 주요 내용을 공고한 날",
      includes: ["COMMITTEE_WAIT"],
      citationIds: ["cit-industrial-complex-fast-track-act-9-duration"],
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: "합동설명회 또는 공청회를 실제 개최하는 경우에만 적용하는 선택적 단계입니다.",
    },
    {
      id: "ref-industrial-complex-plan-eia-request-deadline",
      kind: "PROCESS_MILESTONE",
      label: "환경영향평가 협의요청 최종기한",
      range: { min: null, base: null, max: 4, unit: "MONTH" },
      jurisdiction: null,
      startsWhen: "지정권자가 산업단지계획 승인신청을 받은 날",
      includes: ["AUTHORITY_PROCESSING", "INTERAGENCY_CONSULTATION"],
      citationIds: ["cit-industrial-complex-fast-track-act-16-2-duration"],
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: "환경영향평가 협의 완료기한이 아니라 협의를 요청해야 하는 중간기한입니다.",
    },
  ],
});

const regionalSpecialZonePlanApplicationDuration = (): DurationEstimate => ({
  id: "duration-regional-special-zone-plan-application",
  procedureId: "regional-special-zone-plan-application",
  applicantPreparation: null,
  authorityProcessing: null,
  interagencyConsultation: null,
  elapsed: null,
  statutoryPeriod: "조건부 민간제안 필요성 검토 60일, 계획 주요내용 공고 20일 이상, 공고일부터 6일 경과 후 14일 이상 열람, 공청회 개최 14일 전까지 공고, 시·도지사 의견 제출 30일",
  stopClockRules: [],
  variabilityFactors: [
    "민간 제안 경로 여부",
    "공청회 개최 여부",
    "주민·기업 의견 반영과 계획 보완",
    "시·도지사 의견 제출",
  ],
  evidenceType: "STATUTE",
  citationIds: ["cit-regional-special-zone-decree-application-duration"],
  sampleSize: null,
  assumptions: [
    "각 수치는 계획 수립·신청 준비 단계의 조건부 이정표이며 최종 지정 결정기간과 별도입니다.",
    "공고 20일과 공고 후 6일 경과 뒤 14일 열람은 겹치는 기간이므로 34일로 합산하지 않습니다.",
  ],
  verifiedAt: "2026-08-22",
  legalConfidence: "HIGH",
  estimateConfidence: "LOW",
  planningBasis: "MILESTONE_ONLY",
  referencePeriods: [
    {
      id: "ref-regional-special-zone-private-proposal-review",
      kind: "PROCESS_MILESTONE",
      label: "민간 제안 필요성 검토기한",
      range: { min: null, base: null, max: 60, unit: "CALENDAR_DAY" },
      jurisdiction: null,
      startsWhen: "시장·군수·구청장이 민간의 특화특구계획 제안을 받은 날",
      includes: ["AUTHORITY_PROCESSING", "RESULT_NOTICE"],
      citationIds: ["cit-regional-special-zone-decree-application-duration"],
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: "민간 제안 경로에만 적용하는 조건부 검토기한입니다.",
    },
    {
      id: "ref-regional-special-zone-plan-public-notice",
      kind: "LEGAL_DEADLINE",
      label: "특화특구계획 주요내용 공고 최소기간",
      range: { min: 20, base: null, max: null, unit: "CALENDAR_DAY" },
      jurisdiction: null,
      startsWhen: "특화특구계획 주요내용을 공고한 날",
      includes: ["COMMITTEE_WAIT"],
      citationIds: ["cit-regional-special-zone-decree-application-duration"],
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: "최소 공고기간입니다.",
    },
    {
      id: "ref-regional-special-zone-plan-public-inspection",
      kind: "LEGAL_DEADLINE",
      label: "공고 후 주민·기업 열람 최소기간",
      range: { min: 14, base: null, max: null, unit: "CALENDAR_DAY" },
      jurisdiction: null,
      startsWhen: "공고일부터 6일이 지난 날",
      includes: ["COMMITTEE_WAIT"],
      citationIds: ["cit-regional-special-zone-decree-application-duration"],
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: "20일 공고기간과 겹치므로 별도 14일을 순차 합산하지 않습니다.",
    },
    {
      id: "ref-regional-special-zone-plan-hearing-notice",
      kind: "LEGAL_DEADLINE",
      label: "공청회 사전공고 최소기간",
      range: { min: 14, base: null, max: null, unit: "CALENDAR_DAY" },
      jurisdiction: null,
      startsWhen: "공청회 개최 예정일 전",
      includes: ["COMMITTEE_WAIT"],
      citationIds: ["cit-regional-special-zone-decree-application-duration"],
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: "공청회를 개최하는 경우에만 적용하는 최소 사전공고 기간입니다.",
    },
    {
      id: "ref-regional-special-zone-governor-opinion",
      kind: "PROCESS_MILESTONE",
      label: "시·도지사 의견 제출기한",
      range: { min: null, base: null, max: 30, unit: "CALENDAR_DAY" },
      jurisdiction: null,
      startsWhen: "시·도지사가 특화특구계획 의견요청을 받은 날",
      includes: ["INTERAGENCY_CONSULTATION"],
      citationIds: ["cit-regional-special-zone-decree-application-duration"],
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: "계획 신청 준비 중의 관계기관 의견 단계기한입니다.",
    },
  ],
});

const industrialComplexPlanConsultationDuration = (): DurationEstimate => ({
  id: "duration-industrial-complex-plan-consultation",
  procedureId: "industrial-complex-plan-consultation",
  applicantPreparation: null,
  authorityProcessing: null,
  interagencyConsultation: null,
  // The 10/15-day reply periods are intermediate milestones inside the
  // application-to-decision six-month cap, not an additional elapsed phase.
  elapsed: null,
  statutoryPeriod: "법정 분기: 일반 관계기관 10근무일, 군사시설 보호 15근무일, 공유수면매립기본계획 20근무일, 15만㎡ 미만 전략환경영향평가 30일, 15만㎡ 이상 환경영향평가 45일 이내 의견 회신",
  stopClockRules: [
    "관계 행정기관은 관련 서류의 보완을 한 차례만 요청할 수 있음",
    "지정권자가 관련 서류를 보완하는 기간은 10일·15일 협의기간에 포함하지 않음",
  ],
  variabilityFactors: [
    "군사기지·군사시설 보호 협의 포함 여부",
    "공유수면매립기본계획 협의 포함 여부",
    "산업단지 면적과 전략·환경영향평가 분기",
    "관계기관의 한 차례 보완 요청",
    "보완 후 이견 조정 또는 통합조정회의",
  ],
  evidenceType: "STATUTE",
  citationIds: [
    "cit-industrial-complex-fast-track-act-10-duration",
    "cit-industrial-complex-fast-track-act-22-duration",
    "cit-industrial-complex-fast-track-act-23-duration",
  ],
  sampleSize: null,
  assumptions: [
    "10·15·20·30·45일은 빠름·통상·지연 범위가 아니라 관계기관·사업면적·영향평가 종류에 따른 상호배타적 또는 조건부 법정 회신 상한입니다.",
    "협의기한 내 의견을 회신하지 않으면 이견 없이 산업단지계획 신청내용을 협의한 것으로 보는 법정 효과와 실제 후속 의결·고시는 구분합니다.",
    "신청인 계획도서 작성, 주민의견 수렴, 영향평가 및 산업단지계획심의위원회 대기는 포함하지 않습니다.",
  ],
  verifiedAt: "2026-08-22",
  legalConfidence: "HIGH",
  estimateConfidence: "LOW",
  planningBasis: "MILESTONE_ONLY",
  referencePeriods: [
    {
      id: "ref-industrial-complex-plan-general-consultation-deadline",
      kind: "PROCESS_MILESTONE",
      label: "일반 관계기관 협의의견 회신 상한",
      range: { min: null, base: null, max: 10, unit: "BUSINESS_DAY" },
      jurisdiction: null,
      startsWhen: "지정권자가 관계 행정기관에 산업단지계획 협의를 요청한 날",
      includes: ["INTERAGENCY_CONSULTATION"],
      citationIds: ["cit-industrial-complex-fast-track-act-10-duration"],
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: "법정 회신 상한입니다. 한 차례 요청할 수 있는 서류 보완기간은 산입하지 않습니다.",
    },
    {
      id: "ref-industrial-complex-plan-military-consultation-deadline",
      kind: "PROCESS_MILESTONE",
      label: "군사기지·군사시설 보호 협의의견 회신 상한",
      range: { min: null, base: null, max: 15, unit: "BUSINESS_DAY" },
      jurisdiction: null,
      startsWhen: "지정권자가 군사시설 보호 관계기관에 산업단지계획 협의를 요청한 날",
      includes: ["INTERAGENCY_CONSULTATION"],
      citationIds: ["cit-industrial-complex-fast-track-act-10-duration"],
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: "군사기지·군사시설 보호 협의가 실제 포함된 경우에만 적용합니다. 보완기간은 산입하지 않습니다.",
    },
    {
      id: "ref-industrial-complex-plan-public-water-consultation-deadline",
      kind: "PROCESS_MILESTONE",
      label: "공유수면매립기본계획 협의의견 회신 상한",
      range: { min: null, base: null, max: 20, unit: "BUSINESS_DAY" },
      jurisdiction: null,
      startsWhen: "지정권자가 공유수면매립기본계획 관계기관에 협의를 요청한 날",
      includes: ["INTERAGENCY_CONSULTATION"],
      citationIds: ["cit-industrial-complex-fast-track-act-22-duration"],
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: "공유수면매립기본계획 협의가 실제 포함된 경우에만 적용하는 특별 분기입니다.",
    },
    {
      id: "ref-industrial-complex-plan-strategic-eia-consultation-deadline",
      kind: "PROCESS_MILESTONE",
      label: "15만㎡ 미만 전략환경영향평가 의견 통보기한",
      range: { min: null, base: null, max: 30, unit: "CALENDAR_DAY" },
      jurisdiction: null,
      startsWhen: "환경 관계기관이 전략환경영향평가 협의요청을 받은 날",
      includes: ["INTERAGENCY_CONSULTATION", "RESULT_NOTICE"],
      citationIds: ["cit-industrial-complex-fast-track-act-23-duration"],
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: "15만㎡ 미만 산업단지 분기에 적용합니다. 한 차례 보완기간은 산입하지 않습니다.",
    },
    {
      id: "ref-industrial-complex-plan-eia-consultation-deadline",
      kind: "PROCESS_MILESTONE",
      label: "15만㎡ 이상 환경영향평가 의견 통보기한",
      range: { min: null, base: null, max: 45, unit: "CALENDAR_DAY" },
      jurisdiction: null,
      startsWhen: "환경 관계기관이 환경영향평가서를 접수한 날",
      includes: ["INTERAGENCY_CONSULTATION", "RESULT_NOTICE"],
      citationIds: ["cit-industrial-complex-fast-track-act-23-duration"],
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: "15만㎡ 이상 산업단지 분기에 적용합니다. 한 차례 보완기간은 산입하지 않습니다.",
    },
  ],
});

const industrialComplexPlanApprovalDuration = (): DurationEstimate => ({
  id: "duration-industrial-complex-plan-approval",
  procedureId: "industrial-complex-plan-approval",
  applicantPreparation: null,
  authorityProcessing: { min: null, base: null, max: 6, unit: "MONTH" },
  interagencyConsultation: null,
  elapsed: null,
  statutoryPeriod: "민간기업등의 산업단지계획 승인신청은 원칙적으로 접수일부터 6개월 이내 승인 여부 결정·통지. 신청인 귀책으로 지연된 분기는 6개월 제한의 예외",
  stopClockRules: [
    "민간기업등의 귀책사유로 승인절차가 지연된 경우에는 6개월 제한의 예외인 정당한 사유에 해당함",
  ],
  variabilityFactors: [
    "민간기업등의 법정 신청자 해당 여부",
    "주민의견 수렴과 영향평가",
    "관계기관 협의와 이견 조정",
    "산업단지계획심의위원회",
    "신청인 귀책 보완·변경",
  ],
  evidenceType: "STATUTE",
  citationIds: [
    "cit-industrial-complex-fast-track-act-16",
    "cit-industrial-complex-fast-track-decree-11-duration-exception",
  ],
  sampleSize: null,
  assumptions: [
    "6개월은 민간기업등이 법 제8조제2항에 따라 신청하고 신청인 귀책 지연이 없는 경로의 법정 상한이며 통상 소요기간이 아닙니다.",
    "공공 사업시행자의 신청이나 신청 접수 전 계획도서 작성기간에는 이 상한을 적용하지 않습니다.",
    "관계기관 10일·15일 회신기한은 6개월 전체 결정기한 안의 중간 마일스톤이므로 별도로 더하지 않습니다.",
  ],
  verifiedAt: "2026-08-22",
  legalConfidence: "HIGH",
  estimateConfidence: "LOW",
  planningBasis: "OFFICIAL_CAP_ONLY",
  referencePeriods: [
    {
      id: "ref-industrial-complex-plan-private-approval-cap",
      kind: "LEGAL_DEADLINE",
      label: "민간기업등 산업단지계획 승인 결정 상한",
      range: { min: null, base: null, max: 6, unit: "MONTH" },
      jurisdiction: null,
      startsWhen: "지정권자가 민간기업등의 산업단지계획 승인신청을 접수한 날",
      includes: [
        "AUTHORITY_PROCESSING",
        "INTERAGENCY_CONSULTATION",
        "COMMITTEE_WAIT",
        "RESULT_NOTICE",
      ],
      citationIds: [
        "cit-industrial-complex-fast-track-act-16",
        "cit-industrial-complex-fast-track-decree-11-duration-exception",
      ],
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: "민간기업등 귀책으로 승인절차가 지연된 경우에는 6개월 제한이 적용되지 않을 수 있으므로 전체 경과 상한으로 계산하지 않습니다.",
    },
  ],
});

const regionalSpecialZonePlanConsultationDuration = (): DurationEstimate => ({
  id: "duration-regional-special-zone-plan-consultation",
  procedureId: "regional-special-zone-plan-consultation",
  applicantPreparation: null,
  authorityProcessing: null,
  interagencyConsultation: { min: null, base: null, max: 30, unit: "CALENDAR_DAY" },
  elapsed: null,
  statutoryPeriod: "관계 행정기관 의견 제출 20일 이내, 부득이한 경우 중소벤처기업부장관과 협의해 한 차례 10일 연장하여 최대 30일",
  stopClockRules: [
    "관계기관 협의기간은 특화특구 지정 여부 90일 처리시계에서 제외",
  ],
  variabilityFactors: [
    "관계기관 수와 협의쟁점",
    "한 차례 10일 연장 여부",
    "신청자료 보완",
  ],
  evidenceType: "STATUTE",
  citationIds: ["cit-regional-special-zone-decree-7-consultation-duration"],
  sampleSize: null,
  assumptions: [
    "20일과 30일은 기본·연장 분기의 법정 의견 제출 상한이며 전체 특화특구 지정기간과 별도로 더하지 않습니다.",
  ],
  verifiedAt: "2026-08-22",
  legalConfidence: "HIGH",
  estimateConfidence: "LOW",
  planningBasis: "MILESTONE_ONLY",
  referencePeriods: [
    {
      id: "ref-regional-special-zone-consultation-basic-cap",
      kind: "PROCESS_MILESTONE",
      label: "관계 행정기관 의견 제출 기본기한",
      range: { min: null, base: null, max: 20, unit: "CALENDAR_DAY" },
      jurisdiction: null,
      startsWhen: "관계 행정기관이 특화특구 지정 협의요청을 받은 날",
      includes: ["INTERAGENCY_CONSULTATION"],
      citationIds: ["cit-regional-special-zone-decree-7-consultation-duration"],
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: "관계기관 의견 제출의 법정 기본 상한입니다.",
    },
    {
      id: "ref-regional-special-zone-consultation-extended-cap",
      kind: "PROCESS_MILESTONE",
      label: "한 차례 연장 시 관계기관 의견 제출 상한",
      range: { min: null, base: null, max: 30, unit: "CALENDAR_DAY" },
      jurisdiction: null,
      startsWhen: "관계 행정기관이 특화특구 지정 협의요청을 받은 날",
      includes: ["INTERAGENCY_CONSULTATION"],
      citationIds: ["cit-regional-special-zone-decree-7-consultation-duration"],
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: "부득이한 경우 중소벤처기업부장관과 협의해 10일을 연장한 분기의 상한입니다.",
    },
  ],
});

const regionalSpecialZonePlanApprovalDuration = (): DurationEstimate => ({
  id: "duration-regional-special-zone-plan-approval",
  procedureId: "regional-special-zone-plan-approval",
  applicantPreparation: null,
  authorityProcessing: {
    min: null,
    base: null,
    max: 135,
    unit: "CALENDAR_DAY",
  },
  interagencyConsultation: null,
  elapsed: null,
  statutoryPeriod: "특화특구 지정신청 수령일부터 법정 처리시계 90일 이내 결정, 부득이한 경우 한 차례 최대 45일 연장. 보완·협의·위원회 연기 등 불산입기간 때문에 총 경과 상한은 없음",
  stopClockRules: [
    "시행령 제7조제2항이 열거한 제3조제2항 및 제7조제3항 단서에 따른 기간은 산입하지 않음",
    "신청 지방자치단체의 장이 특화특구위원회 심의·의결 연기를 요청한 기간은 산입하지 않음",
  ],
  variabilityFactors: [
    "한 차례 기간 연장 여부",
    "관계 행정기관 협의",
    "신청서류 보완",
    "특화특구위원회 심의·의결 연기 요청",
  ],
  evidenceType: "STATUTE",
  citationIds: ["cit-regional-special-zone-decree-7-duration"],
  sampleSize: null,
  assumptions: [
    "90일과 연장 후 135일은 통상 소요기간이나 접수 후 총 경과 상한이 아니라 법정 불산입기간을 제외한 처리시계 상한입니다.",
    "이 카탈로그의 지역특화발전특구 지정·특화특구계획 승인 경로에 적용하며 규제자유특구 지정 경로와 혼용하지 않습니다.",
    "특화특구계획 작성, 지방자치단체 내부 검토와 지정신청 전 의견수렴 기간은 포함하지 않습니다.",
  ],
  verifiedAt: "2026-08-22",
  legalConfidence: "HIGH",
  estimateConfidence: "LOW",
  planningBasis: "OFFICIAL_CAP_ONLY",
  referencePeriods: [
    {
      id: "ref-regional-special-zone-plan-decision-cap",
      kind: "LEGAL_DEADLINE",
      label: "특화특구 지정 여부 기본 결정 상한",
      range: { min: null, base: null, max: 90, unit: "CALENDAR_DAY" },
      jurisdiction: null,
      startsWhen: "중소벤처기업부장관이 특화특구 지정신청을 받은 날",
      includes: [
        "AUTHORITY_PROCESSING",
        "INTERAGENCY_CONSULTATION",
        "COMMITTEE_WAIT",
        "RESULT_NOTICE",
      ],
      citationIds: ["cit-regional-special-zone-decree-7-duration"],
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: "시행령 제7조제2항의 보완·협의·위원회 연기 등 불산입기간은 별도이므로 총 경과 상한으로 계산하지 않습니다.",
    },
    {
      id: "ref-regional-special-zone-plan-extended-cap",
      kind: "LEGAL_DEADLINE",
      label: "한 차례 연장 시 특화특구 지정 여부 최장 상한",
      range: { min: null, base: null, max: 135, unit: "CALENDAR_DAY" },
      jurisdiction: null,
      startsWhen: "중소벤처기업부장관이 특화특구 지정신청을 받은 날",
      includes: [
        "AUTHORITY_PROCESSING",
        "INTERAGENCY_CONSULTATION",
        "COMMITTEE_WAIT",
        "RESULT_NOTICE",
      ],
      citationIds: ["cit-regional-special-zone-decree-7-duration"],
      sampleSize: null,
      observedFrom: null,
      observedTo: null,
      note: "부득이한 사유로 한 차례 45일을 모두 연장한 처리시계 상한이며, 법정 불산입기간 때문에 총 경과 상한은 없습니다.",
    },
  ],
});

export const specialLawProcessDurations: DurationEstimate[] = [
  ...fastTracks.flatMap((config) => [
    fastTrackRequestDuration(config),
    fastTrackResultDuration(
      `${config.prefix}-result-check`,
      config.durationCitationIds,
    ),
  ]),
  ...plans.flatMap((config) => {
    const application =
      config.lawId === "INDUSTRIAL_COMPLEX_PLAN_INTEGRATED_APPROVAL"
        ? industrialComplexPlanApplicationDuration()
        : config.lawId === "REGIONAL_SPECIAL_ZONE_PLAN_DEEMING"
          ? regionalSpecialZonePlanApplicationDuration()
          : unknownDuration(
              `${config.prefix}-application`,
              config.citationIds,
              "법률은 계획승인에 따른 인허가 의제효과를 정하지만, 계획 승인신청 준비·접수 단계의 전국 공통 처리기한은 별도로 두지 않음",
              ["계획도서 완성도", "의제대상 서류", "주민의견·위원회 절차", "보완"],
            );
    const consultation =
      config.lawId === "INDUSTRIAL_COMPLEX_PLAN_INTEGRATED_APPROVAL"
        ? industrialComplexPlanConsultationDuration()
        : config.lawId === "REGIONAL_SPECIAL_ZONE_PLAN_DEEMING"
          ? regionalSpecialZonePlanConsultationDuration()
          : unknownDuration(
              `${config.prefix}-consultation`,
              config.citationIds,
              "법률은 의제대상 인허가에 필요한 관계기관 사전협의·승인을 요구하지만, 사전협의 전체의 전국 공통 처리기한은 별도로 두지 않음",
              ["의제 인허가 수", "관계기관 수", "서류 보완", "협의조건 조정"],
            );
    const approval =
      config.lawId === "INDUSTRIAL_COMPLEX_PLAN_INTEGRATED_APPROVAL"
        ? industrialComplexPlanApprovalDuration()
        : config.lawId === "REGIONAL_SPECIAL_ZONE_PLAN_DEEMING"
          ? regionalSpecialZonePlanApprovalDuration()
          : config.lawId === "SEMICONDUCTOR_CLUSTER_PLAN_DEEMING"
            ? semiconductorClusterPlanApprovalDuration()
          : unknownDuration(
              `${config.prefix}-approval`,
              config.citationIds,
              "법률은 계획 승인·변경승인 시 사전협의된 인허가의 의제효과를 정하지만, 승인·고시와 의제결과 정리의 전국 공통 처리기한은 별도로 두지 않음",
              ["심의위원회", "협의조건 반영", "승인·고시", "개별 의제 범위 확인"],
            );
    return [application, consultation, approval];
  }),
];

const practicalEdge = (
  id: string,
  from: string,
  to: string,
  conditionRuleId: string,
  citationIds: string[],
  branchId: string,
  note: string,
): ProcedureEdge => ({
  id,
  from,
  to,
  relation: "FINISH_TO_START",
  lag: 0,
  lagUnit: "CALENDAR_DAY",
  strength: "PRACTICAL",
  conditionRuleId,
  citationIds,
  branchId,
  note,
});

export const specialLawProcessEdges: ProcedureEdge[] = [
  ...fastTracks.flatMap((config) => {
    const request = `${config.prefix}-request`;
    const result = `${config.prefix}-result-check`;
    const rule = `rule-${config.prefix}-request`;
    const direct = practicalEdge(
      `edge-${config.prefix}-request-to-result-check`,
      request,
      result,
      rule,
      config.citationIds,
      config.prefix,
      "요청 공문과 대상목록을 기준으로 처리계획 회신·결과 통보 단계의 특례 기한과 실제 처리결과를 추적합니다.",
    );
    return [direct];
  }),
  ...plans.flatMap((config) => [
    practicalEdge(
      `edge-${config.prefix}-application-to-consultation`,
      `${config.prefix}-application`,
      `${config.prefix}-consultation`,
      `rule-${config.prefix}-application`,
      config.citationIds,
      config.prefix,
      "계획과 의제서류를 접수한 뒤 관계기관 협의를 진행하는 법정 경로를 표시합니다.",
    ),
    practicalEdge(
      `edge-${config.prefix}-consultation-to-approval`,
      `${config.prefix}-consultation`,
      `${config.prefix}-approval`,
      `rule-${config.prefix}-consultation`,
      config.citationIds,
      config.prefix,
      "관계기관 협의의견과 조건을 계획에 반영한 뒤 승인·고시 및 의제범위를 확인합니다.",
    ),
  ]),
];

export function buildFastTrackTargetEdges(
  procedures: readonly Pick<Procedure, "id">[],
): ProcedureEdge[] {
  return fastTracks.flatMap((config) => {
    const request = `${config.prefix}-request`;
    return getFastTrackTargetProcedureIds(config.lawId, procedures).map((procedureId) => practicalEdge(
      `edge-${config.prefix}-request-to-${procedureId}`,
      request,
      procedureId,
      `rule-${config.prefix}-tracks-${procedureId}`,
      config.citationIds,
      config.prefix,
      "실제 장관 요청 공문의 대상목록에 포함된 개별 인허가만 요청 이후 추적합니다. 처리결과 확인은 요청일부터 병행 관리합니다.",
    ));
  });
}

export const specialLawProcessRuleIdsByProcedure: Record<string, string[]> =
  Object.fromEntries(
    specialLawProcessRules.reduce((entries, rule) => {
      entries.set(rule.procedureId, [
        ...(entries.get(rule.procedureId) ?? []),
        rule.id,
      ]);
      return entries;
    }, new Map<string, string[]>()),
  );

export const specialLawDeemingParentsByProcedure: Record<string, string[]> =
  Object.fromEntries(
    plans.flatMap((config) =>
      config.deemedProcedureIds.map((procedureId) => [
        procedureId,
        `${config.prefix}-approval`,
      ] as const),
    ).reduce((entries, [procedureId, parentId]) => {
      entries.set(procedureId, [...(entries.get(procedureId) ?? []), parentId]);
      return entries;
    }, new Map<string, string[]>()),
  );
