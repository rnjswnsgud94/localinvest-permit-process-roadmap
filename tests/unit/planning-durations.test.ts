import { describe, expect, it } from "vitest";

import { catalog, type ScenarioAnswers } from "@/lib/data/catalog";
import { buildPlanningDurations } from "@/lib/data/planning-durations";
import { evaluateProject } from "@/lib/engine/pipeline";
import { formatTimelineProcessingDuration } from "@/lib/format-duration";

const baseAnswers = catalog.scenarios[0].answers;

function answers(overrides: Partial<ScenarioAnswers> = {}): ScenarioAnswers {
  return { ...baseAnswers, ...overrides };
}

function durationFor(
  procedureId: string,
  overrides: Partial<ScenarioAnswers> = {},
) {
  return buildPlanningDurations(
    catalog.procedures,
    catalog.durations,
    answers(overrides),
  ).find((duration) => duration.procedureId === procedureId);
}

describe("automatic planning durations", () => {
  it("keeps reviewed official values in their original units", () => {
    expect(
      durationFor("factory-establishment-approval", {
        permitCoordination: null,
      }),
    ).toMatchObject({
      minimum: null,
      typical: null,
      upperBound: 30,
      unit: "BUSINESS_DAY",
      overlapPolicy: "PRE_CONSTRUCTION",
      evidenceType: "OFFICIAL_SERVICE_STANDARD",
      planningBasis: "UNRESOLVED_OFFICIAL_BRANCH",
      endToEndMissingComponents: ["신청인 준비", "관계기관 협의"],
    });
    expect(durationFor("energy-use-plan-consultation")).toMatchObject({
      minimum: null,
      typical: null,
      upperBound: 50,
      unit: "CALENDAR_DAY",
      planningBasis: "OFFICIAL_CAP_ONLY",
    });
    expect(durationFor("traffic-impact-assessment")).toMatchObject({
      minimum: null,
      typical: null,
      upperBound: null,
      unit: null,
      planningBasis: "OFFICIAL_CAP_ONLY",
    });
    expect(durationFor("traffic-impact-assessment")?.referencePeriods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ref-traffic-impact-assessment-statutory-cap",
          range: expect.objectContaining({ max: 3, unit: "MONTH" }),
        }),
      ]),
    );
  });

  it("uses the Government24 nationwide standard for development completion inspection", () => {
    expect(durationFor("development-activity-completion-inspection")).toMatchObject({
      minimum: 7,
      typical: 7,
      upperBound: 7,
      unit: "BUSINESS_DAY",
      overlapPolicy: "PRE_OPERATION",
      releasePolicy: "CONSTRUCTION_FINISH",
      evidenceType: "OFFICIAL_SERVICE_STANDARD",
      confidence: "HIGH",
      planningBasis: "DIRECT_OFFICIAL",
      sourceLabel: expect.stringContaining("정부24 개발행위 준공검사"),
    });
  });

  it("uses a local official duration only when the selected city matches", () => {
    expect(
      durationFor("development-activity-completion-inspection", {
        province: "충청남도",
        city: "태안군",
      }),
    ).toMatchObject({
      minimum: 5,
      typical: 5,
      upperBound: 5,
      unit: "BUSINESS_DAY",
      planningBasis: "LOCAL_OFFICIAL_REFERENCE",
      sourceLabel: expect.stringContaining("태안군 공식 민원 처리기준"),
      endToEndMissingComponents: ["신청인 준비", "관계기관 협의"],
    });
    expect(
      durationFor("development-activity-completion-inspection", {
        province: "충청남도",
        city: "천안시",
      }),
    ).toMatchObject({
      minimum: 7,
      typical: 7,
      unit: "BUSINESS_DAY",
      planningBasis: "DIRECT_OFFICIAL",
    });

    expect(
      durationFor("public-sewer-drainage-facility-completion-inspection", {
        province: "경기도",
        city: "파주시",
      }),
    ).toMatchObject({
      minimum: 5,
      typical: 5,
      upperBound: 5,
      unit: "BUSINESS_DAY",
      sourceLabel: expect.stringContaining("파주시 공식 민원 처리기준"),
    });
    expect(
      durationFor("public-sewer-drainage-facility-completion-inspection", {
        province: "서울특별시",
        city: "동대문구",
      }),
    ).toMatchObject({
      minimum: 7,
      typical: 7,
      upperBound: 7,
      unit: "BUSINESS_DAY",
      sourceLabel: expect.stringContaining("동대문구 공식 민원 처리기준"),
    });
    expect(
      durationFor("public-sewer-drainage-facility-completion-inspection", {
        province: "경상남도",
        city: "의령군",
      }),
    ).toMatchObject({
      minimum: 14,
      typical: 14,
      upperBound: 14,
      unit: "BUSINESS_DAY",
      sourceLabel: expect.stringContaining("의령군 공식 민원 처리기준"),
    });
  });

  it("keeps the national-heritage simplified diagnosis as an unquantified statutory process", () => {
    const simplified = durationFor("national-heritage-simplified-diagnosis");
    expect(simplified).toMatchObject({
      minimum: null,
      typical: null,
      upperBound: null,
      unit: null,
      evidenceType: "STATUTE",
      planningBasis: "MILESTONE_ONLY",
      sourceLabel: expect.stringContaining("전국 공통 고정기한은 두지 않음"),
    });
    expect(simplified?.referencePeriods).toEqual([
      expect.objectContaining({
        id: "ref-national-heritage-simplified-statutory-process",
        range: null,
        startsWhen: expect.stringContaining("약식영향진단 절차를 개시"),
      }),
    ]);
  });

  it("keeps nationwide caps distinct from local committee standards", () => {
    expect(durationFor("power-grid-impact-assessment")).toMatchObject({
      minimum: null,
      typical: null,
      upperBound: null,
      unit: null,
      planningBasis: "OFFICIAL_CAP_ONLY",
    });
    expect(
      durationFor("landscape-review", {
        province: "경상남도",
        city: "거제시",
      }),
    ).toMatchObject({
      minimum: 30,
      typical: 30,
      upperBound: 30,
      unit: "BUSINESS_DAY",
      planningBasis: "LOCAL_OFFICIAL_REFERENCE",
    });
    expect(
      durationFor("building-committee-review", {
        province: "충청북도",
        city: "청주시",
      }),
    ).toMatchObject({
      minimum: 30,
      typical: 30,
      upperBound: 30,
      unit: "BUSINESS_DAY",
      planningBasis: "LOCAL_OFFICIAL_REFERENCE",
    });
  });

  it("carries exact local committee standards into the dated timeline", () => {
    const geoje = evaluateProject(answers({
      province: "경상남도",
      city: "거제시",
      landscapeReviewRequired: true,
    })).schedules.TYPICAL.projectTimeline;
    expect(geoje?.nodes.find((node) => node.procedureId === "landscape-review")).toMatchObject({
      processingDuration: 30,
      processingUnit: "BUSINESS_DAY",
      durationPlanningBasis: "LOCAL_OFFICIAL_REFERENCE",
    });

    const cheongju = evaluateProject(answers({
      province: "충청북도",
      city: "청주시",
      buildingCommitteeReviewRequired: true,
    })).schedules.TYPICAL.projectTimeline;
    expect(cheongju?.nodes.find((node) => node.procedureId === "building-committee-review")).toMatchObject({
      processingDuration: 30,
      processingUnit: "BUSINESS_DAY",
      durationPlanningBasis: "LOCAL_OFFICIAL_REFERENCE",
    });
  });

  it("keeps an immediate service standard as a three-working-hour milestone, not zero days", () => {
    const immediate = durationFor("air-facility-operation-start-report");
    expect(
      durationFor("air-facility-operation-start-report")
        ?.endToEndMissingComponents,
    ).toContain("기관 처리");
    expect(
      durationFor("air-facility-operation-start-report")
        ?.endToEndMissingComponents,
    ).toContain("전체 경과");
    expect(
      immediate?.referencePeriods,
    ).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "ref-air-facility-operation-start-report-immediate-processing-standard",
        range: null,
        note: expect.stringContaining("3근무시간 이내"),
      }),
    ]));
    expect(formatTimelineProcessingDuration({
      processingDuration: immediate?.typical ?? null,
      processingUpperBound: immediate?.upperBound ?? null,
      processingUnit: immediate?.unit ?? null,
      completedCheckpoint: null,
      durationReferencePeriods: immediate?.referencePeriods ?? [],
      durationSourceLabel: immediate?.sourceLabel ?? null,
    })).toBe("법정·공식 즉시 · 3근무시간 이내 (0일 아님)");
  });

  it.each([
    ["NONE", 7],
    ["LOCAL_ONLY", 14],
    ["OTHER_LT_20", 20],
    ["OTHER_GTE_20", 30],
  ])(
    "resolves the factory-establishment route for coordination=%s",
    (permitCoordination, expectedDays) => {
      expect(
        durationFor("factory-establishment-approval", {
          permitCoordination,
        }),
      ).toMatchObject({
        minimum: expectedDays,
        typical: expectedDays,
        unit: "BUSINESS_DAY",
      });
    },
  );

  it.each([
    [999, 7, 7],
    [1_000, 7, 14],
    [5_000, 10, 14],
    [30_000, 15, 25],
  ])(
    "resolves the building-permit route for total area %i m2",
    (totalAreaM2, expectedMinimum, expectedTypical) => {
      expect(durationFor("building-permit", {
        totalAreaM2,
        buildingCommitteeReviewRequired: false,
      })).toMatchObject({
        minimum: expectedMinimum,
        typical: expectedTypical,
        unit: "BUSINESS_DAY",
      });
    },
  );

  it.each([
    ["DISASTER_IMPACT", 45],
    ["DISASTER_IMPACT_REVIEW", 30],
  ] as const)(
    "shows the disaster consultation statutory cap for %s without using it as an exact schedule",
    (disasterImpactAssessmentType, expectedDays) => {
      expect(
        durationFor("disaster-impact-assessment-consultation", {
          disasterImpactAssessmentType,
        }),
      ).toMatchObject({
        minimum: null,
        typical: null,
        upperBound: null,
        unit: null,
        planningBasis: "UNRESOLVED_OFFICIAL_BRANCH",
      });
      expect(
        durationFor("disaster-impact-assessment-consultation", {
          disasterImpactAssessmentType,
        })?.referencePeriods,
      ).toEqual(expect.arrayContaining([
        expect.objectContaining({
          range: expect.objectContaining({ max: expectedDays }),
        }),
      ]));
    },
  );

  it("uses the reviewed generic disaster route while the subtype is unknown", () => {
    expect(
      durationFor("disaster-impact-assessment-consultation", {
        disasterImpactAssessmentType: null,
      }),
    ).toMatchObject({
      minimum: null,
      typical: null,
      upperBound: null,
      unit: null,
      planningBasis: "UNRESOLVED_OFFICIAL_BRANCH",
    });
  });

  it("does not insert an arbitrary official branch before the deciding fact is known", () => {
    for (const procedureId of [
      "farmland-conversion-permit",
      "road-occupation-permit",
      "private-electrical-facility-construction-plan",
      "high-pressure-gas-manufacture-storage-permit-report",
      "high-pressure-gas-technical-review",
      "groundwater-development-use-permit-report",
      "water-discharge-installation-permit",
      "hazardous-materials-facility-installation-permit",
      "river-occupation-permit",
      "public-water-implementation-plan-approval-report",
      "chemical-registration-notification",
    ]) {
      expect(durationFor(procedureId), procedureId).toMatchObject({
        minimum: null,
        typical: null,
        planningBasis: "UNRESOLVED_OFFICIAL_BRANCH",
      });
    }
  });

  it("keeps building-permit duration unresolved while a separate committee route applies", () => {
    expect(
      durationFor("building-permit", {
        totalAreaM2: 30_000,
        buildingCommitteeReviewRequired: true,
      }),
    ).toMatchObject({
      minimum: null,
      typical: null,
      upperBound: 70,
      unit: "BUSINESS_DAY",
      planningBasis: "UNRESOLVED_OFFICIAL_BRANCH",
    });
  });

  it("releases completion inspections only after construction finishes", () => {
    expect(durationFor("building-use-approval")).toMatchObject({
      overlapPolicy: "PRE_OPERATION",
      releasePolicy: "CONSTRUCTION_FINISH",
    });
    expect(durationFor("fire-facility-completion-inspection")).toMatchObject({
      overlapPolicy: "PRE_OPERATION",
      releasePolicy: "CONSTRUCTION_FINISH",
    });
  });

  it("uses only confirmed past event dates as zero-day special-law milestones", () => {
    expect(
      durationFor("advanced-strategic-industry-fast-track-request", {
        assessmentDate: "2026-08-21",
        advancedStrategicIndustryFastTrackConfirmed: true,
        advancedStrategicIndustryApplicantRoleConfirmed: true,
        advancedStrategicIndustryDelayRiskConfirmed: true,
        advancedStrategicIndustryCommitteeResolved: true,
        advancedStrategicIndustryMinisterRequestDate: "2026-08-15",
        advancedStrategicIndustryFastTrackPermitIds: ["building-permit"],
      }),
    ).toMatchObject({
      minimum: 0,
      typical: 0,
      unit: "CALENDAR_DAY",
      endToEndMissingComponents: [],
      sourceLabel: expect.stringContaining("2026-08-15"),
      completedCheckpoint: {
        label: "산업통상부장관 신속처리 요청",
        completedDate: "2026-08-15",
        confirmedAsOfDate: "2026-08-21",
      },
    });
    expect(
      durationFor("advanced-strategic-industry-fast-track-request", {
        assessmentDate: "2026-08-21",
        advancedStrategicIndustryFastTrackConfirmed: true,
        advancedStrategicIndustryApplicantRoleConfirmed: true,
        advancedStrategicIndustryDelayRiskConfirmed: true,
        advancedStrategicIndustryCommitteeResolved: true,
        advancedStrategicIndustryMinisterRequestDate: "2023-06-30",
        advancedStrategicIndustryFastTrackPermitIds: ["building-permit"],
      }),
    ).toMatchObject({
      minimum: null,
      typical: null,
      upperBound: 21,
      unit: "BUSINESS_DAY",
      planningBasis: "OFFICIAL_CAP_ONLY",
      completedCheckpoint: null,
    });

    expect(
      durationFor("industrial-complex-plan-approval", {
        assessmentDate: "2026-08-21",
        industrialComplexPlanSpecialCaseConfirmed: true,
        industrialComplexPlanDocumentsIncluded: true,
        industrialComplexPlanConsultationCompleted: true,
        industrialComplexPlanApprovalPublished: true,
        industrialComplexPlanApprovalPublishedDate: "2026-08-20",
        industrialComplexPlanApprovalNoticeReference: "충청남도고시 제2026-100호",
        industrialComplexPlanIncludedPermitIds: ["building-permit"],
      }),
    ).toMatchObject({
      minimum: 0,
      typical: 0,
      unit: "CALENDAR_DAY",
      endToEndMissingComponents: [],
      sourceLabel: expect.stringContaining("2026-08-20"),
      completedCheckpoint: {
        label: "계획 승인·고시 완료",
        completedDate: "2026-08-20",
        confirmedAsOfDate: "2026-08-21",
      },
    });
  });

  it("keeps completed AI one-stop permits visible as completed history instead of future work", () => {
    const overrides: Partial<ScenarioAnswers> = {
      assessmentDate: "2027-04-01",
      industryCategory: "AI_DATA_CENTER",
      aiDataCenterActFacilityConfirmed: true,
      appliedSpecialLawIds: ["AIDC_ONE_STOP"],
      aiDataCenterOneStopStatus: "COMPLETED",
      province: "전라남도",
      city: "나주시",
    };

    for (const procedureId of [
      "energy-use-plan-consultation",
      "traffic-impact-assessment",
      "landscape-review",
      "building-committee-review",
      "building-permit",
      "fire-building-permit-consent",
    ]) {
      expect(durationFor(procedureId, overrides), procedureId).toMatchObject({
        minimum: 0,
        typical: 0,
        upperBound: 0,
        unit: "CALENDAR_DAY",
        planningBasis: "MILESTONE_ONLY",
        completedCheckpoint: {
          label: "AI 데이터센터 일괄처리 관계기관 처리결과 확인",
          completedDate: null,
          confirmedAsOfDate: "2027-04-01",
        },
      });
    }
  });

  it("keeps a completed industrial-complex occupancy contract as a visible zero-remaining checkpoint", () => {
    expect(
      durationFor("industrial-complex-occupancy-contract", {
        assessmentDate: "2026-08-21",
        insideIndustrialComplex: true,
        industrialComplexOccupancyContractStatus: "COMPLETED",
      }),
    ).toMatchObject({
      minimum: 0,
      typical: 0,
      unit: "CALENDAR_DAY",
      endToEndMissingComponents: [],
      completedCheckpoint: {
        label: "산업단지 입주계약 체결 완료",
        completedDate: null,
        confirmedAsOfDate: "2026-08-21",
      },
    });
    expect(
      durationFor("industrial-complex-occupancy-contract", {
        insideIndustrialComplex: true,
        industrialComplexOccupancyContractStatus: "IN_PROGRESS",
      }),
    ).toMatchObject({
      minimum: null,
      typical: null,
      upperBound: 10,
      unit: "BUSINESS_DAY",
      evidenceType: "STATUTE",
      confidence: "LOW",
      planningBasis: "OFFICIAL_CAP_ONLY",
    });
  });

  it("uses the reviewed statutory decision periods for industrial and port entry contracts", () => {
    expect(
      durationFor("industrial-complex-occupancy-contract", {
        insideIndustrialComplex: true,
        industrialComplexOccupancyContractStatus: "PLANNED",
      }),
    ).toMatchObject({
      minimum: null,
      typical: null,
      upperBound: 10,
      unit: "BUSINESS_DAY",
      evidenceType: "STATUTE",
      sourceLabel: expect.stringContaining("5일 이내"),
      planningBasis: "OFFICIAL_CAP_ONLY",
    });
    expect(durationFor("port-hinterland-entry-contract")).toMatchObject({
      minimum: null,
      typical: null,
      upperBound: 7,
      unit: "BUSINESS_DAY",
      evidenceType: "STATUTE",
      sourceLabel: expect.stringContaining("7일 이내"),
      planningBasis: "OFFICIAL_CAP_ONLY",
    });
  });

  it("labels a zero-remaining completed event as a checkpoint rather than an instant procedure", () => {
    expect(
      formatTimelineProcessingDuration({
        processingDuration: 0,
        processingUnit: "CALENDAR_DAY",
        completedCheckpoint: {
          label: "산업단지 입주계약 체결 완료",
          completedDate: null,
          confirmedAsOfDate: "2026-08-21",
        },
      }),
    ).toBe("산업단지 입주계약 체결 완료 · 2026-08-21 기준일 현재 완료 · 잔여 처리기간 0일");
  });

  it("shows both the formal power-review cap and the pilot end-to-end cap", () => {
    const power = durationFor("power-grid-impact-assessment");
    expect(
      formatTimelineProcessingDuration({
        processingDuration: power?.typical ?? null,
        processingUpperBound: power?.upperBound ?? null,
        processingUnit: power?.unit ?? null,
        completedCheckpoint: null,
        durationReferencePeriods: power?.referencePeriods ?? [],
      }),
    ).toContain("개선필요사항등 조건부 통보 상한 3개월");
    expect(
      formatTimelineProcessingDuration({
        processingDuration: power?.typical ?? null,
        processingUpperBound: power?.upperBound ?? null,
        processingUnit: power?.unit ?? null,
        completedCheckpoint: null,
        durationReferencePeriods: power?.referencePeriods ?? [],
      }),
    ).toContain("현행 시범운영 순차 계획 상한 150일");
  });

  it("shows quantified statutory components without presenting them as a total", () => {
    const fastTrack = durationFor("advanced-strategic-industry-fast-track-result-check");
    expect(fastTrack).toMatchObject({
      minimum: null,
      typical: null,
      upperBound: null,
      unit: null,
      evidenceType: "STATUTE",
      planningBasis: "MILESTONE_ONLY",
    });
    expect(fastTrack?.referencePeriods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ref-advanced-strategic-industry-fast-track-result-check-plan-reply-basic-deadline",
          range: expect.objectContaining({ max: 15, unit: "CALENDAR_DAY" }),
        }),
        expect.objectContaining({
          id: "ref-advanced-strategic-industry-fast-track-result-check-conditional-deemed-completion",
          range: expect.objectContaining({ max: 60, unit: "CALENDAR_DAY" }),
          note: expect.stringContaining("허가 승인으로 단정하지 않습니다"),
        }),
      ]),
    );

    const label = formatTimelineProcessingDuration({
      processingDuration: fastTrack?.typical ?? null,
      processingUpperBound: fastTrack?.upperBound ?? null,
      processingUnit: fastTrack?.unit ?? null,
      completedCheckpoint: null,
      durationReferencePeriods: fastTrack?.referencePeriods ?? [],
      durationSourceLabel: fastTrack?.sourceLabel ?? null,
    });
    expect(label).toContain("법정·공식 총기간 미확인");
    expect(label).toContain("조건부 처리완료 시점 60일");
    expect(label).not.toMatch(/^60일$/);
  });

  it("shows the statutory explanation when an unquantified milestone has no numeric total", () => {
    const simplified = durationFor("national-heritage-simplified-diagnosis");
    expect(
      formatTimelineProcessingDuration({
        processingDuration: simplified?.typical ?? null,
        processingUpperBound: simplified?.upperBound ?? null,
        processingUnit: simplified?.unit ?? null,
        completedCheckpoint: null,
        durationReferencePeriods: simplified?.referencePeriods ?? [],
        durationSourceLabel: simplified?.sourceLabel ?? null,
      }),
    ).toContain("법정·공식 총기간 미규정 · 법 제18조는 약식영향진단 결정·통보를 요구");
  });

  it("keeps industrial-complex plan consultation milestones inside the plan cap", () => {
    const application = durationFor("industrial-complex-plan-application");
    expect(application).toMatchObject({
      minimum: null,
      typical: null,
      upperBound: null,
      unit: null,
      evidenceType: "STATUTE",
      planningBasis: "MILESTONE_ONLY",
    });
    expect(application?.referencePeriods).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "ref-industrial-complex-plan-public-notice-deadline",
        range: expect.objectContaining({ max: 3, unit: "BUSINESS_DAY" }),
      }),
      expect.objectContaining({
        id: "ref-industrial-complex-plan-public-inspection-window",
        range: expect.objectContaining({ min: 20, max: null }),
      }),
      expect.objectContaining({
        id: "ref-industrial-complex-plan-eia-request-deadline",
        range: expect.objectContaining({ max: 4, unit: "MONTH" }),
      }),
    ]));

    const consultation = durationFor("industrial-complex-plan-consultation");
    expect(consultation).toMatchObject({
      minimum: null,
      typical: null,
      upperBound: null,
      unit: null,
      evidenceType: "STATUTE",
      planningBasis: "MILESTONE_ONLY",
    });
    expect(consultation?.referencePeriods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ref-industrial-complex-plan-general-consultation-deadline",
          range: expect.objectContaining({
            max: 10,
            unit: "BUSINESS_DAY",
          }),
          startsWhen: expect.stringContaining("협의를 요청한 날"),
        }),
        expect.objectContaining({
          id: "ref-industrial-complex-plan-military-consultation-deadline",
          range: expect.objectContaining({
            max: 15,
            unit: "BUSINESS_DAY",
          }),
        }),
        expect.objectContaining({
          id: "ref-industrial-complex-plan-public-water-consultation-deadline",
          range: expect.objectContaining({ max: 20, unit: "BUSINESS_DAY" }),
        }),
        expect.objectContaining({
          id: "ref-industrial-complex-plan-strategic-eia-consultation-deadline",
          range: expect.objectContaining({ max: 30, unit: "CALENDAR_DAY" }),
        }),
        expect.objectContaining({
          id: "ref-industrial-complex-plan-eia-consultation-deadline",
          range: expect.objectContaining({ max: 45, unit: "CALENDAR_DAY" }),
        }),
      ]),
    );

    const approval = durationFor("industrial-complex-plan-approval");
    expect(approval).toMatchObject({
      minimum: null,
      typical: null,
      upperBound: null,
      unit: null,
      planningBasis: "OFFICIAL_CAP_ONLY",
    });
    expect(approval?.referencePeriods?.[0]).toMatchObject({
      id: "ref-industrial-complex-plan-private-approval-cap",
      range: { min: null, base: null, max: 6, unit: "MONTH" },
      startsWhen: expect.stringContaining("민간기업등의 산업단지계획 승인신청을 접수한 날"),
    });
  });

  it("shows the regional special-zone 90-day decision cap and one 45-day extension", () => {
    expect(
      catalog.legalSources.find(
        (source) => source.id === "src-regional-special-zone-decree-current",
      ),
    ).toMatchObject({
      lawId: "009762",
      proclamationDate: "2026-06-30",
      proclamationNumber: "36479",
      effectiveDate: "2026-07-01",
    });
    const approval = durationFor("regional-special-zone-plan-approval");
    expect(approval).toMatchObject({
      minimum: null,
      typical: null,
      upperBound: null,
      unit: null,
      evidenceType: "STATUTE",
      planningBasis: "OFFICIAL_CAP_ONLY",
    });
    expect(approval?.referencePeriods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ref-regional-special-zone-plan-decision-cap",
          range: expect.objectContaining({ max: 90, unit: "CALENDAR_DAY" }),
        }),
        expect.objectContaining({
          id: "ref-regional-special-zone-plan-extended-cap",
          range: expect.objectContaining({ max: 135, unit: "CALENDAR_DAY" }),
        }),
      ]),
    );

    const application = durationFor("regional-special-zone-plan-application");
    expect(application).toMatchObject({
      minimum: null,
      typical: null,
      upperBound: null,
      planningBasis: "MILESTONE_ONLY",
    });
    expect(application?.referencePeriods).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "ref-regional-special-zone-private-proposal-review",
        range: expect.objectContaining({ max: 60 }),
      }),
      expect.objectContaining({
        id: "ref-regional-special-zone-plan-public-notice",
        range: expect.objectContaining({ min: 20, max: null }),
      }),
      expect.objectContaining({
        id: "ref-regional-special-zone-governor-opinion",
        range: expect.objectContaining({ max: 30 }),
      }),
    ]));

    const consultation = durationFor("regional-special-zone-plan-consultation");
    expect(consultation).toMatchObject({
      minimum: null,
      typical: null,
      upperBound: null,
      planningBasis: "MILESTONE_ONLY",
    });
    expect(consultation?.referencePeriods).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "ref-regional-special-zone-consultation-basic-cap",
        range: expect.objectContaining({ max: 20 }),
      }),
      expect.objectContaining({
        id: "ref-regional-special-zone-consultation-extended-cap",
        range: expect.objectContaining({ max: 30 }),
      }),
    ]));
  });

  it("keeps all AI data-center one-stop branches visible without inventing a total", () => {
    const application = durationFor("ai-data-center-one-stop-application");
    expect(application).toMatchObject({
      minimum: null,
      typical: null,
      upperBound: null,
      unit: null,
      evidenceType: "STATUTE",
      planningBasis: "MILESTONE_ONLY",
    });
    expect(application?.referencePeriods).toEqual(expect.arrayContaining([
      expect.objectContaining({ range: expect.objectContaining({ max: 150 }) }),
      expect.objectContaining({ range: expect.objectContaining({ max: 90 }) }),
      expect.objectContaining({ range: expect.objectContaining({ max: 40 }) }),
      expect.objectContaining({ range: expect.objectContaining({ max: 180 }) }),
      expect.objectContaining({ range: expect.objectContaining({ max: 120 }) }),
      expect.objectContaining({ range: expect.objectContaining({ max: 70 }) }),
    ]));
  });

  it("uses an AI one-stop completion checkpoint only after the Act and exact qualification", () => {
    const completed = {
      assessmentDate: "2027-04-01",
      industryCategory: "AI_DATA_CENTER",
      aiDataCenterActFacilityConfirmed: true,
      aiDataCenterOneStopStatus: "COMPLETED" as const,
      appliedSpecialLawIds: ["AIDC_ONE_STOP"] as ScenarioAnswers["appliedSpecialLawIds"],
    };
    expect(durationFor("ai-data-center-one-stop-result", completed)).toMatchObject({
      minimum: 0,
      typical: 0,
      unit: "CALENDAR_DAY",
      endToEndMissingComponents: [],
      completedCheckpoint: {
        label: "AI 데이터센터 일괄처리 결과통지 완료",
        completedDate: null,
        confirmedAsOfDate: "2027-04-01",
      },
    });
    expect(
      durationFor("ai-data-center-one-stop-result", {
        ...completed,
        assessmentDate: "2027-03-09",
      }),
    ).toMatchObject({ minimum: null, typical: null, unit: null });
    expect(
      durationFor("ai-data-center-one-stop-result", {
        ...completed,
        aiDataCenterOneStopStatus: "IN_PROGRESS",
      }),
    ).toMatchObject({ minimum: null, typical: null, unit: null });
  });

  it("does not accept a plan approval checkpoint without every confirmation and a named permit", () => {
    const confirmedPlan: Partial<ScenarioAnswers> = {
      assessmentDate: "2026-08-21",
      industrialComplexPlanSpecialCaseConfirmed: true,
      industrialComplexPlanDocumentsIncluded: true,
      industrialComplexPlanConsultationCompleted: true,
      industrialComplexPlanApprovalPublished: true,
      industrialComplexPlanApprovalPublishedDate: "2026-08-20",
      industrialComplexPlanApprovalNoticeReference: "충청남도고시 제2026-100호",
      industrialComplexPlanIncludedPermitIds: ["building-permit"],
    };
    expect(
      durationFor("industrial-complex-plan-approval", {
        ...confirmedPlan,
        industrialComplexPlanIncludedPermitIds: [],
      }),
    ).toMatchObject({
      minimum: null,
      typical: null,
      upperBound: null,
      unit: null,
      planningBasis: "OFFICIAL_CAP_ONLY",
    });
    expect(
      durationFor("industrial-complex-plan-approval", {
        ...confirmedPlan,
        industrialComplexPlanApprovalPublishedDate: "2026-08-22",
      }),
    ).toMatchObject({
      minimum: null,
      typical: null,
      upperBound: null,
      unit: null,
      planningBasis: "OFFICIAL_CAP_ONLY",
    });
  });
});
