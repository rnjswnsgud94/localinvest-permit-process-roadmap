import { describe, expect, it } from "vitest";

import { catalog } from "@/lib/data/catalog";
import {
  formatOfficialDurationSummary,
  hasQuantifiedOfficialPeriod,
} from "@/lib/format-duration";

describe("catalog integrity", () => {
  it("loads a cross-referenced acyclic catalog", () => {
    expect(catalog.procedures.length).toBeGreaterThanOrEqual(90);
    expect(catalog.rules.length).toBeGreaterThanOrEqual(catalog.procedures.length);
    expect(new Set(catalog.procedures.map((item) => item.id)).size).toBe(catalog.procedures.length);
    const procedureIds = new Set(catalog.procedures.map((item) => item.id));
    for (const edge of catalog.edges) {
      expect(procedureIds.has(edge.from), `${edge.id} from`).toBe(true);
      expect(procedureIds.has(edge.to), `${edge.id} to`).toBe(true);
    }
  });

  it("keeps curated Korea100 references canonical and separate from official sources", () => {
    const procedureIds = new Set(catalog.procedures.map((item) => item.id));
    const mappedProcedureIds = catalog.korea100References.map((item) => item.procedureId);
    const unmatchedProcedureIds = catalog.korea100UnmatchedProcedures.map(
      (item) => item.procedureId,
    );

    expect(catalog.korea100References.length).toBeGreaterThanOrEqual(100);
    expect(new Set(mappedProcedureIds).size).toBe(mappedProcedureIds.length);
    expect(new Set(unmatchedProcedureIds).size).toBe(unmatchedProcedureIds.length);
    expect(catalog.korea100References.length + catalog.korea100UnmatchedProcedures.length)
      .toBe(catalog.procedures.length);
    expect(new Set([...mappedProcedureIds, ...unmatchedProcedureIds]).size)
      .toBe(catalog.procedures.length);
    for (const reference of catalog.korea100References) {
      expect(procedureIds.has(reference.procedureId), reference.procedureId).toBe(true);
      expect(reference.url, reference.procedureId).toBe(
        `https://hosungseo.github.io/korea100/model/${reference.modelSlug}/`,
      );
      expect(reference.url, reference.procedureId).not.toMatch(/[?#]/);
    }

    expect(
      catalog.korea100References.find(
        (item) => item.procedureId === "environmental-impact-assessment",
      ),
    ).toMatchObject({
      modelName: "환경영향평가",
      matchType: "EXACT",
      url: "https://hosungseo.github.io/korea100/model/environmental-impact-assessment/",
    });
    expect(
      catalog.korea100References.find(
        (item) => item.procedureId === "construction-start-report",
      ),
    ).toMatchObject({ modelSlug: "building-permit", matchType: "INCLUDED" });
    expect(catalog.legalSources.some((source) =>
      source.officialUrl.includes("hosungseo.github.io/korea100"),
    )).toBe(false);
  });

  it("covers nationwide factory-investment domains including capital-region review", () => {
    const ids = new Set(catalog.procedures.map((item) => item.id));
    for (const id of [
      "development-activity-permit",
      "farmland-conversion-permit",
      "environmental-impact-assessment",
      "integrated-environmental-permit",
      "hazardous-chemical-business-permit",
      "hazardous-materials-facility-installation-permit",
      "high-pressure-gas-manufacture-storage-permit-report",
      "electrical-pre-use-inspection",
      "fire-facility-completion-inspection",
      "disaster-impact-assessment-consultation",
      "underground-safety-assessment",
      "national-heritage-impact-diagnosis",
      "national-heritage-simplified-diagnosis",
      "construction-safety-management-plan-approval",
      "building-demolition-start-report",
      "building-demolition-completion-report",
      "development-activity-completion-inspection",
      "public-sewer-drainage-facility-completion-inspection",
      "private-sewage-treatment-completion-inspection",
      "waste-treatment-facility-inspection",
      "chemical-registration-notification",
      "hazardous-chemical-manager-appointment-report",
      "fire-safety-manager-appointment-report",
      "hazardous-materials-tank-safety-performance-inspection",
      "electrical-safety-manager-appointment-report",
      "heat-use-equipment-installation-inspection",
      "workplace-safety-manager-appointment",
      "small-factory-registration",
      "lpg-specific-use-facility-completion-inspection",
      "city-gas-specific-use-facility-completion-inspection",
      "public-water-implementation-plan-approval-report",
      "public-water-completion-inspection-report",
      "mechanical-equipment-start-confirmation",
      "mechanical-equipment-pre-use-inspection",
      "middle-water-installation-report",
      "high-pressure-gas-business-start-report",
      "fire-work-supervisor-designation-report",
      "fire-facility-first-self-inspection-report",
      "forestland-restoration-design-approval",
      "forestland-restoration-completion-inspection",
      "capital-region-factory-restriction-review",
    ]) expect(ids.has(id), id).toBe(true);
    for (const id of [
      "utility-supply-consultation",
      "asbestos-survey",
      "air-environmental-technician-appointment",
      "water-environmental-technician-appointment",
      "local-investment-agreement",
      "local-investment-subsidy-application-review",
      "local-investment-subsidy-grant-payment",
      "local-investment-subsidy-settlement",
      "construction-quality-management-plan-approval",
      "construction-quality-test-plan",
    ]) expect(ids.has(id), id).toBe(false);
    expect(ids.has("industrial-complex-occupancy-contract")).toBe(true);
    expect(catalog.coverage.supported.regions.join(" ")).toContain("전국 16개 광역자치단체");
  });

  it("registers integrated-permit exclusions on base air and water procedures", () => {
    expect(catalog.procedures.find((item) => item.id === "air-emission-installation-permit")?.ruleIds).toContain("rule-exp-air-integrated-exclusion");
    expect(catalog.procedures.find((item) => item.id === "water-discharge-installation-permit")?.ruleIds).toContain("rule-exp-water-integrated-exclusion");
  });

  it("registers every reviewed AI data-center factory-path exclusion with an official citation", () => {
    const citationIds = new Set(catalog.citations.map((item) => item.id));
    const profileRuleIds = [
      "rule-aidc-exclude-factory-establishment-approval",
      "rule-aidc-exclude-factory-completion-report-complex",
      "rule-aidc-exclude-factory-completion-report-offsite",
      "rule-aidc-exclude-small-factory-registration",
    ];

    for (const ruleId of profileRuleIds) {
      const rule = catalog.rules.find((item) => item.id === ruleId);
      expect(rule, ruleId).toBeDefined();
      expect(rule?.industryScope, ruleId).toEqual(["AI_DATA_CENTER"]);
      expect(rule?.citationIds, ruleId).toEqual([
        "cit-indcluster-2-1-factory-definition",
      ]);
      expect(rule?.citationIds.every((id) => citationIds.has(id)), ruleId).toBe(true);
      expect(
        catalog.procedures.find((item) => item.id === rule?.procedureId)?.ruleIds,
        ruleId,
      ).toContain(ruleId);
    }

    expect(
      catalog.citations.find(
        (item) => item.id === "cit-indcluster-2-1-factory-definition",
      ),
    ).toMatchObject({
      sourceId: "src-industrial-cluster-act-20260701",
      article: "제2조",
      paragraph: "제1호",
      role: "APPLICABILITY",
    });
  });

  it("requires every confirmed catalog rule to carry at least one registered citation", () => {
    const citationIds = new Set(catalog.citations.map((item) => item.id));
    for (const rule of catalog.rules.filter(
      (item) => item.status === "INTERNAL_REVIEWED" || item.status === "EXPERT_REVIEWED",
    )) {
      expect(rule.citationIds.length, rule.id).toBeGreaterThan(0);
      expect(rule.citationIds.every((id) => citationIds.has(id)), rule.id).toBe(true);
    }
  });

  it("activates AI-special-law rules only inside the AI data-center industry scope", () => {
    const aidcRules = catalog.rules.filter((rule) =>
      rule.citationIds.some((citationId) => citationId.startsWith("cit-aidc-")),
    );
    expect(aidcRules.length).toBeGreaterThan(0);
    for (const rule of aidcRules) {
      expect(rule.industryScope, rule.id).toEqual(["AI_DATA_CENTER"]);
    }
  });

  it("links every procedure to direct citations and a duration record", () => {
    const durationIds = new Set(catalog.durations.map((item) => item.id));
    for (const procedure of catalog.procedures) {
      if (procedure.citationIds.length === 0) {
        expect(procedure.verificationStatus, procedure.id).toBe("TODO_LEGAL_REVIEW");
        expect(procedure.reviewNote, procedure.id).toContain("법정 인허가가 아닌");
      }
      expect(procedure.durationId, procedure.id).not.toBeNull();
      expect(durationIds.has(procedure.durationId!), procedure.id).toBe(true);
    }
  });

  it("links every duration record to an official duration citation, including no-deadline findings", () => {
    const citations = new Map(catalog.citations.map((item) => [item.id, item]));
    for (const duration of catalog.durations) {
      const citationIds = [
        ...duration.citationIds,
        ...(duration.referencePeriods ?? []).flatMap((period) => period.citationIds),
      ];
      expect(
        citationIds.some((citationId) => citations.get(citationId)?.role === "DURATION"),
        duration.procedureId,
      ).toBe(true);
      expect(duration.statutoryPeriod?.trim().length, duration.procedureId).toBeGreaterThan(0);
      expect(new Set(duration.citationIds).size, duration.procedureId).toBe(
        duration.citationIds.length,
      );
    }
  });

  it("gives every procedure a visible quantified period or an explicit no-total finding", () => {
    const quantified = catalog.durations.filter((duration) =>
      hasQuantifiedOfficialPeriod(duration),
    );
    expect(catalog.durations).toHaveLength(catalog.procedures.length);
    expect(quantified.length).toBeGreaterThanOrEqual(131);
    expect(catalog.durations.length - quantified.length).toBeGreaterThan(0);

    for (const duration of catalog.durations) {
      const summary = formatOfficialDurationSummary(duration);
      expect(summary, duration.procedureId).toMatch(/\d|미규정/);
      expect(summary, duration.procedureId).not.toMatch(/확인 필요|상세 기준 참조/);
    }
  });

  it("keeps the six parcel-and-facility review gates evidence-linked without inventing total durations", () => {
    const procedureIds = [
      "education-environment-protection-zone-review",
      "railway-protection-zone-action-report",
      "building-safety-impact-assessment",
      "fire-performance-based-design-review",
      "water-supply-factory-restriction-zone-review",
      "water-discharge-facility-restriction-zone-review",
    ] as const;
    const citationById = new Map(catalog.citations.map((item) => [item.id, item]));
    const sourceById = new Map(catalog.legalSources.map((item) => [item.id, item]));

    for (const procedureId of procedureIds) {
      const procedure = catalog.procedures.find((item) => item.id === procedureId);
      const duration = catalog.durations.find((item) => item.procedureId === procedureId);
      const durationCitation = duration?.citationIds
        .map((citationId) => citationById.get(citationId))
        .find((citation) => citation?.role === "DURATION");
      const source = durationCitation
        ? sourceById.get(durationCitation.sourceId)
        : undefined;

      expect(procedure, procedureId).toBeDefined();
      expect(duration, procedureId).toMatchObject({
        authorityProcessing: null,
        elapsed: null,
      });
      expect(duration?.statutoryPeriod, procedureId).toMatch(
        /미규정|없음|규정되지 않음/,
      );
      expect(durationCitation, procedureId).toBeDefined();
      expect(source?.officialUrl, procedureId).toMatch(/^https:\/\//);
      expect(formatOfficialDurationSummary(duration), procedureId).not.toMatch(
        /상세 기준 참조|확인 필요/,
      );
    }

    const railway = catalog.durations.find(
      (item) => item.procedureId === "railway-protection-zone-action-report",
    );
    expect(railway).toMatchObject({
      authorityProcessing: null,
      elapsed: null,
      planningBasis: "MILESTONE_ONLY",
      referencePeriods: expect.arrayContaining([
        expect.objectContaining({
          id: "ref-railway-protection-zone-safety-order-deadline",
          kind: "PROCESS_MILESTONE",
          range: { min: null, base: null, max: 30, unit: "CALENDAR_DAY" },
        }),
      ]),
    });
    const railwaySummary = formatOfficialDurationSummary(railway);
    expect(railwaySummary).toContain("법정 단계기한 30일");
    expect(railwaySummary).toContain("전국 공통 법정 총기간 미규정");
  });

  it("keeps the reverified air permit service period tied to the current official guide", () => {
    const duration = catalog.durations.find(
      (item) => item.procedureId === "air-emission-installation-permit",
    );
    const source = catalog.legalSources.find(
      (item) => item.id === "src-gov24-air-permit",
    );

    expect(duration).toMatchObject({
      authorityProcessing: { min: 10, base: 10, max: 10, unit: "BUSINESS_DAY" },
      elapsed: { min: 10, base: 10, max: 10, unit: "BUSINESS_DAY" },
      legalConfidence: "HIGH",
      verifiedAt: "2026-08-22",
    });
    expect(duration?.statutoryPeriod).toContain("법정 최소기간 아님");
    expect(source).toMatchObject({
      internallyVerifiedAt: "2026-08-22",
      status: "AUTHORITATIVE",
    });
    expect(source?.officialUrl).toContain("CappBizCD=14800000067");
  });

  it("labels the public-water permit guide separately from its follow-up plan service", () => {
    const duration = catalog.durations.find(
      (item) => item.procedureId === "public-water-occupation-use-permit",
    );
    const durationCitation = catalog.citations.find(
      (item) => item.id === "cit-exp-public-water-occupation-use-permit-official-duration",
    );
    const source = catalog.legalSources.find(
      (item) => item.id === durationCitation?.sourceId,
    );

    expect(duration?.statutoryPeriod).toContain("점용·사용허가 공식 분기");
    expect(duration?.assumptions.join(" ")).toContain("별도 실시계획 처리기간과 합산하지 않음");
    expect(source?.title).toBe("정부24 공유수면 점용·사용허가 민원안내");
    expect(source?.officialUrl).toContain("CappBizCD=15200000020");
  });

  it("uses HTTPS official links and keeps leading-zero identifiers as strings", () => {
    for (const source of catalog.legalSources) {
      expect(source.officialUrl.startsWith("https://")).toBe(true);
      if (source.lawId !== null) expect(typeof source.lawId).toBe("string");
      if (source.mst !== null) expect(typeof source.mst).toBe("string");
    }
  });

  it("does not invent numeric durations when evidence is insufficient", () => {
    for (const duration of catalog.durations.filter((item) => item.evidenceType === "INSUFFICIENT_DATA")) {
      expect(duration.elapsed).toBeNull();
      expect(duration.authorityProcessing).toBeNull();
    }
  });

  it("does not encode an immediate service standard as a zero-day procedure", () => {
    for (const duration of catalog.durations) {
      for (const range of [
        duration.applicantPreparation,
        duration.authorityProcessing,
        duration.interagencyConsultation,
        duration.elapsed,
        ...(duration.referencePeriods ?? []).map((period) => period.range),
      ]) {
        expect(
          range && range.min === 0 && range.base === 0 && range.max === 0,
          duration.procedureId,
        ).toBeFalsy();
      }
    }

    const immediate = catalog.durations.find(
      (duration) => duration.procedureId === "air-facility-operation-start-report",
    );
    expect(immediate).toMatchObject({
      authorityProcessing: null,
      elapsed: null,
      planningBasis: "MILESTONE_ONLY",
      statutoryPeriod: expect.stringContaining("3근무시간 이내"),
    });
    expect(immediate?.referencePeriods).toEqual(expect.arrayContaining([
      expect.objectContaining({
        range: null,
        note: expect.stringContaining("0일 완료를 뜻하지 않으며"),
      }),
    ]));
  });

  it("keeps official caps, local standards, and practical benchmarks auditable", () => {
    const citations = new Map(catalog.citations.map((item) => [item.id, item]));
    for (const duration of catalog.durations) {
      for (const period of duration.referencePeriods ?? []) {
        expect(period.citationIds.length, period.id).toBeGreaterThan(0);
        for (const citationId of period.citationIds) {
          expect(citations.get(citationId), `${period.id}:${citationId}`).toMatchObject({
            role: "DURATION",
          });
        }
        if (period.kind === "LOCAL_OFFICIAL_STANDARD") {
          expect(period.jurisdiction?.trim().length, period.id).toBeGreaterThan(0);
        }
        if (period.kind === "PLANNING_REFERENCE" || period.kind === "OBSERVED_PRACTICE") {
          expect(period.sampleSize, period.id).not.toBeNull();
          expect(period.note, period.id).toMatch(/평균|중앙값|참고|실적/);
        }
      }
    }

    const power = catalog.durations.find(
      (item) => item.procedureId === "power-grid-impact-assessment",
    );
    expect(power?.planningBasis).toBe("OFFICIAL_CAP_ONLY");
    expect(power?.referencePeriods?.map((period) => period.range?.max)).toEqual(
      expect.arrayContaining([3, 150]),
    );

    const landscape = catalog.durations
      .find((item) => item.procedureId === "landscape-review")
      ?.referencePeriods;
    expect(landscape?.some((period) => period.kind === "PLANNING_REFERENCE")).toBe(false);
    expect(landscape).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "ref-landscape-national-meeting-guideline",
        range: expect.objectContaining({ max: 30 }),
      }),
      expect.objectContaining({
        id: "ref-landscape-geoje-local-standard",
        jurisdiction: "거제시",
      }),
    ]));

    const electricalInspection = catalog.durations.find(
      (item) => item.procedureId === "electrical-pre-use-inspection",
    );
    expect(electricalInspection).toMatchObject({
      elapsed: null,
      authorityProcessing: null,
      evidenceType: "STATUTE",
      planningBasis: "MILESTONE_ONLY",
    });
    expect(electricalInspection?.referencePeriods).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "ref-electrical-pre-use-application-lead-time",
        range: { min: 7, base: null, max: null, unit: "CALENDAR_DAY" },
      }),
      expect.objectContaining({
        id: "ref-electrical-pre-use-certificate-deadline",
        range: { min: null, base: null, max: 5, unit: "CALENDAR_DAY" },
      }),
    ]));
  });

  it("uses corrected official service branches without padding them as practical averages", () => {
    const duration = (procedureId: string) =>
      catalog.durations.find((item) => item.procedureId === procedureId);

    expect(duration("development-activity-permit")?.elapsed).toMatchObject({ min: 15, base: 15, max: 15 });
    expect(duration("road-connection-permit")?.elapsed).toMatchObject({ min: 21, base: 21, max: 21 });
    expect(duration("fire-facility-completion-inspection")?.elapsed).toMatchObject({ min: 3, base: 3, max: 3 });
    expect(duration("hazardous-materials-facility-installation-permit")?.elapsed).toMatchObject({ min: 4, base: 5, max: 5 });
    expect(duration("hazardous-materials-facility-completion-inspection")?.elapsed).toMatchObject({ min: 5, base: 5, max: 5 });
    expect(duration("high-pressure-gas-manufacture-storage-permit-report")?.elapsed).toMatchObject({ min: 2, base: 5, max: 5 });
    expect(duration("river-occupation-permit")?.elapsed).toMatchObject({ min: 5, base: 20, max: 60 });
    expect(duration("river-occupation-permit")?.assumptions.join(" ")).toContain("상호배타적");
  });

  it("separates combined inspection paths and does not sum excluded fieldwork as elapsed time", () => {
    const duration = (procedureId: string) =>
      catalog.durations.find((item) => item.procedureId === procedureId);
    const ids = new Set(catalog.procedures.map((item) => item.id));

    for (const id of [
      "soil-contamination-test-application",
      "high-pressure-gas-technical-review",
      "high-pressure-gas-intermediate-inspection",
      "fire-supervision-result-report",
    ]) expect(ids.has(id), id).toBe(true);

    expect(duration("soil-contamination-facility-report")?.elapsed).toMatchObject({ min: 7, base: 7, max: 7, unit: "BUSINESS_DAY" });
    expect(duration("soil-contamination-test-application")).toMatchObject({
      authorityProcessing: { min: 7, base: 7, max: 7, unit: "BUSINESS_DAY" },
      elapsed: null,
      planningBasis: "INSUFFICIENT_DATA",
    });
    expect(duration("soil-contamination-test-application")?.statutoryPeriod).toContain("검사기간 제외");

    expect(duration("high-pressure-gas-technical-review")?.elapsed).toMatchObject({ min: 7, base: 10, max: 20, unit: "BUSINESS_DAY" });
    expect(duration("high-pressure-gas-intermediate-inspection")?.elapsed).toMatchObject({ min: 7, base: 7, max: 7, unit: "BUSINESS_DAY" });
    expect(duration("high-pressure-gas-facility-inspection")?.elapsed).toMatchObject({ min: 7, base: 7, max: 7, unit: "BUSINESS_DAY" });

    expect(duration("chemical-substance-confirmation")?.elapsed).toBeNull();
    expect(duration("chemical-substance-confirmation")?.referencePeriods?.[0]).toMatchObject({
      kind: "NATIONWIDE_OFFICIAL_STANDARD",
      range: { min: 3, base: 3, max: 3, unit: "BUSINESS_DAY" },
    });

    expect(duration("heat-use-equipment-installation-inspection")?.elapsed).toBeNull();
    expect(duration("heat-use-equipment-installation-inspection")?.referencePeriods).toHaveLength(2);
    expect(duration("heat-use-equipment-installation-inspection")?.referencePeriods?.every((period) => period.range?.max === 7)).toBe(true);
    expect(duration("heat-use-equipment-installation-inspection")?.referencePeriods?.every((period) => period.range?.unit === "CALENDAR_DAY")).toBe(true);

    expect(duration("hazardous-chemical-facility-inspection")?.referencePeriods).toEqual(expect.arrayContaining([
      expect.objectContaining({ range: expect.objectContaining({ max: 15, unit: "CALENDAR_DAY" }) }),
      expect.objectContaining({ range: expect.objectContaining({ max: 30, unit: "CALENDAR_DAY" }) }),
    ]));
    expect(duration("hazardous-chemical-regular-inspection")?.referencePeriods).toEqual(expect.arrayContaining([
      expect.objectContaining({ range: { min: 36, base: 36, max: 36, unit: "MONTH" } }),
      expect.objectContaining({ range: expect.objectContaining({ max: 15, unit: "CALENDAR_DAY" }) }),
      expect.objectContaining({ range: expect.objectContaining({ max: 30, unit: "CALENDAR_DAY" }) }),
      expect.objectContaining({
        id: "ref-hazardous-chemical-regular-cycle-conditional-longest",
        range: expect.objectContaining({ max: 60, unit: "MONTH" }),
      }),
      expect.objectContaining({
        id: "ref-hazardous-chemical-regular-extension-result-deadline",
        range: expect.objectContaining({ max: 14, unit: "CALENDAR_DAY" }),
      }),
      expect.objectContaining({
        id: "ref-hazardous-chemical-spot-inspection-deadline",
        range: expect.objectContaining({ max: 7, unit: "CALENDAR_DAY" }),
      }),
    ]));

    expect(duration("chemical-accident-prevention-plan")?.elapsed).toMatchObject({
      min: 30,
      base: 30,
      max: 30,
      unit: "BUSINESS_DAY",
    });
    expect(duration("chemical-accident-prevention-plan")?.referencePeriods).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "ref-chemical-accident-plan-initial-submission-lead-time",
        range: { min: 60, base: 60, max: 60, unit: "CALENDAR_DAY" },
      }),
      expect.objectContaining({
        id: "ref-chemical-accident-plan-supplement-deadlines",
        range: { min: 30, base: 60, max: 90, unit: "CALENDAR_DAY" },
      }),
      expect.objectContaining({
        id: "ref-chemical-accident-plan-unsuitable-resubmission-deadline",
        range: expect.objectContaining({ max: 3, unit: "MONTH" }),
      }),
    ]));

    expect(duration("hazardous-chemical-manager-appointment-report")?.elapsed).toMatchObject({
      min: 3,
      base: 3,
      max: 3,
      unit: "BUSINESS_DAY",
    });
    expect(duration("hazardous-chemical-manager-appointment-report")?.referencePeriods).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "ref-hazardous-chemical-manager-replacement-deadline",
        range: expect.objectContaining({ max: 30, unit: "CALENDAR_DAY" }),
      }),
      expect.objectContaining({
        id: "ref-hazardous-chemical-manager-replacement-extended-deadline",
        range: expect.objectContaining({ max: 60, unit: "CALENDAR_DAY" }),
      }),
    ]));

    expect(duration("fire-safety-manager-appointment-report")?.referencePeriods).toEqual(expect.arrayContaining([
      expect.objectContaining({ range: expect.objectContaining({ max: 14, unit: "CALENDAR_DAY" }) }),
      expect.objectContaining({ range: expect.objectContaining({ max: 30, unit: "CALENDAR_DAY" }) }),
    ]));
    expect(duration("electrical-safety-manager-appointment-report")?.referencePeriods).toEqual(expect.arrayContaining([
      expect.objectContaining({ range: { min: 3, base: 3, max: 3, unit: "BUSINESS_DAY" } }),
      expect.objectContaining({ range: expect.objectContaining({ max: 30, unit: "CALENDAR_DAY" }) }),
    ]));

    expect(duration("national-heritage-impact-diagnosis")?.referencePeriods?.every(
      (period) => period.range?.unit === "BUSINESS_DAY",
    )).toBe(true);

    expect(duration("groundwater-development-use-permit-report")?.elapsed).toMatchObject({ min: 7, base: 20, max: 30, unit: "BUSINESS_DAY" });
    expect(duration("water-discharge-installation-permit")?.elapsed).toMatchObject({ min: 10, base: 10, max: 60, unit: "BUSINESS_DAY" });
  });

  it("keeps 2026 branch deadlines and post-permit fieldwork separate from total processing time", () => {
    const duration = (procedureId: string) =>
      catalog.durations.find((item) => item.procedureId === procedureId);
    const procedure = (procedureId: string) =>
      catalog.procedures.find((item) => item.id === procedureId);

    expect(duration("gas-pipeline-excavation-confirmation")).toMatchObject({
      elapsed: null,
      planningBasis: "MILESTONE_ONLY",
    });
    expect(duration("gas-pipeline-excavation-confirmation")?.referencePeriods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ref-gas-pipeline-excavation-request-deadline",
          label: expect.stringContaining("24시간 전"),
          range: null,
        }),
        expect.objectContaining({
          id: "ref-gas-pipeline-presence-response-deadline",
          label: expect.stringContaining("24시간"),
          range: null,
        }),
        expect.objectContaining({
          id: "ref-gas-pipeline-no-pipe-start-notice-deadline",
          label: expect.stringContaining("24시간"),
          range: null,
        }),
        expect.objectContaining({
          id: "ref-gas-pipeline-marked-start-notice-deadline",
          label: expect.stringContaining("1시간"),
          range: null,
        }),
        expect.objectContaining({
          id: "ref-gas-pipeline-location-marking-validity",
          label: expect.stringContaining("15일"),
          range: null,
        }),
      ]),
    );
    const gasSummary = formatOfficialDurationSummary(
      duration("gas-pipeline-excavation-confirmation"),
    );
    expect(gasSummary).toContain("24시간");
    expect(gasSummary).toContain("1시간");
    expect(gasSummary).toContain("15일");

    expect(duration("information-communication-supervision-result-submission")).toMatchObject({
      elapsed: null,
      planningBasis: "MILESTONE_ONLY",
    });
    expect(duration("information-communication-supervision-result-submission")?.referencePeriods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ref-information-communication-supervision-result-notice-deadline",
          range: { min: null, base: null, max: 7, unit: "CALENDAR_DAY" },
        }),
      ]),
    );
    expect(formatOfficialDurationSummary(
      duration("information-communication-supervision-result-submission"),
    )).toContain("전국 공통 법정 총기간 미규정");

    const supervisorSummary = formatOfficialDurationSummary(
      duration("information-communication-supervisor-assignment-report"),
    );
    expect(supervisorSummary).toContain("7업무일");
    expect(supervisorSummary).toContain("30일");

    expect(duration("elevator-installation-report")?.referencePeriods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ref-elevator-installation-report-deadline",
          range: { min: null, base: null, max: 10, unit: "CALENDAR_DAY" },
          startsWhen: "승강기 설치공사업자가 승강기 설치를 끝낸 날",
        }),
      ]),
    );
    const elevatorReportSummary = formatOfficialDurationSummary(
      duration("elevator-installation-report"),
    );
    expect(elevatorReportSummary).toContain("7업무일");
    expect(elevatorReportSummary).toContain("10일");

    expect(duration("elevator-installation-inspection")).toMatchObject({
      elapsed: null,
      planningBasis: "MILESTONE_ONLY",
    });
    expect(duration("elevator-installation-inspection")?.referencePeriods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ref-elevator-installation-inspection-application-deadline",
          range: { min: null, base: null, max: 1, unit: "CALENDAR_DAY" },
        }),
        expect.objectContaining({
          id: "ref-elevator-installation-inspection-schedule-notice",
          range: { min: null, base: null, max: 7, unit: "CALENDAR_DAY" },
        }),
        expect.objectContaining({
          id: "ref-elevator-installation-inspection-failure-authority-notice",
          label: expect.stringContaining("당일"),
          range: null,
        }),
        expect.objectContaining({
          id: "ref-elevator-installation-inspection-supplement-cap",
          range: { min: null, base: null, max: 30, unit: "CALENDAR_DAY" },
        }),
      ]),
    );
    const elevatorInspectionSummary = formatOfficialDurationSummary(
      duration("elevator-installation-inspection"),
    );
    expect(elevatorInspectionSummary).toContain("1·3·5·7·30일");
    expect(elevatorInspectionSummary).toContain("불합격 당일");
    expect(elevatorInspectionSummary).toContain("전국 공통 법정 총기간 미규정");

    const roadWorkSummary = formatOfficialDurationSummary(
      duration("road-work-police-report"),
    );
    expect(roadWorkSummary).toContain("3근무시간");
    expect(roadWorkSummary).toContain("3일");

    expect(duration("water-tank-installation-report")?.referencePeriods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ref-water-tank-installation-report-immediate-standard",
          range: null,
        }),
        expect.objectContaining({
          id: "ref-water-tank-installation-report-deadline",
          startsWhen: "저수조를 실제 설치한 날",
          range: { min: null, base: null, max: 30, unit: "CALENDAR_DAY" },
        }),
      ]),
    );
    expect(procedure("water-tank-installation-report")?.stage).toBe(
      "DURING_CONSTRUCTION",
    );

    expect(duration("chemical-emission-reduction-plan-review")?.referencePeriods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ref-chemical-emission-reduction-plan-cycle",
          range: { min: 60, base: 60, max: 60, unit: "MONTH" },
        }),
      ]),
    );
    const chemicalSummary = formatOfficialDurationSummary(
      duration("chemical-emission-reduction-plan-review"),
    );
    expect(chemicalSummary).toContain("60업무일");
    expect(chemicalSummary).toContain("60개월");
    expect(procedure("chemical-emission-reduction-plan-review")?.stage).toBe(
      "POST_OPERATION",
    );

    expect(duration("buried-heritage-excavation-permit")?.elapsed).toMatchObject({
      min: 10,
      base: 10,
      max: 10,
      unit: "BUSINESS_DAY",
    });
    expect(duration("buried-heritage-excavation-permit")?.referencePeriods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ref-buried-heritage-excavation-permit-application-decision",
          range: { min: null, base: null, max: 10, unit: "CALENDAR_DAY" },
        }),
        expect.objectContaining({
          id: "ref-buried-heritage-excavation-permit-committee-decision",
          range: { min: null, base: null, max: 7, unit: "CALENDAR_DAY" },
        }),
      ]),
    );
    expect(duration("buried-heritage-excavation-investigation")).toMatchObject({
      elapsed: null,
      planningBasis: "MILESTONE_ONLY",
    });
    expect(duration("buried-heritage-excavation-investigation")?.referencePeriods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ref-buried-heritage-investigation-start-deadline",
          range: { min: null, base: null, max: 12, unit: "MONTH" },
        }),
        expect.objectContaining({
          id: "ref-buried-heritage-investigation-completion-report-deadline",
          range: { min: null, base: null, max: 20, unit: "CALENDAR_DAY" },
        }),
        expect.objectContaining({
          id: "ref-buried-heritage-investigation-final-report-deadline",
          range: { min: null, base: null, max: 24, unit: "MONTH" },
        }),
      ]),
    );
    expect(procedure("buried-heritage-excavation-investigation")?.citationIds).toEqual(
      expect.arrayContaining(["cit-exp-buried-heritage-excavation-investigation"]),
    );

    expect(duration("marine-use-consultation")).toMatchObject({
      authorityProcessing: { min: null, base: null, max: 60, unit: "BUSINESS_DAY" },
      planningBasis: "OFFICIAL_CAP_ONLY",
      stopClockRules: expect.arrayContaining([
        expect.stringContaining("보완·조정"),
        expect.stringContaining("토요일과 공휴일"),
      ]),
    });
    expect(duration("marine-use-impact-assessment")).toMatchObject({
      authorityProcessing: { min: null, base: null, max: 75, unit: "BUSINESS_DAY" },
      planningBasis: "OFFICIAL_CAP_ONLY",
      stopClockRules: expect.arrayContaining([
        expect.stringContaining("보완·조정"),
        expect.stringContaining("토요일과 공휴일"),
      ]),
    });

    expect(duration("odor-emission-facility-report")?.referencePeriods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ref-odor-report-specific-service-branch",
          range: { min: null, base: null, max: 10, unit: "BUSINESS_DAY" },
        }),
        expect.objectContaining({
          id: "ref-odor-existing-facility-report-deadline",
          range: { min: null, base: null, max: 6, unit: "MONTH" },
        }),
        expect.objectContaining({
          id: "ref-odor-existing-facility-control-deadline",
          range: { min: null, base: null, max: 12, unit: "MONTH" },
        }),
      ]),
    );
    const odorSummary = formatOfficialDurationSummary(
      duration("odor-emission-facility-report"),
    );
    expect(odorSummary).toContain("10업무일");
    expect(odorSummary).toContain("6·12개월");
    expect(odorSummary).toContain("전국 공통 법정 총기간 미규정");

    expect(duration("water-tank-installation-report")?.referencePeriods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ref-water-tank-installation-report-deadline",
          citationIds: ["cit-exp-water-tank-installation-report-deadline"],
        }),
      ]),
    );

    for (const edgeId of [
      "edge-exp-small-stream-to-start",
      "edge-exp-excavation-investigation-to-start",
      "edge-exp-road-police-report-to-start",
      "edge-exp-gas-excavation-to-start",
      "edge-exp-structure-report-to-start",
    ]) {
      expect(catalog.edges.find((edge) => edge.id === edgeId)).toMatchObject({
        strength: "PRACTICAL",
        note: expect.stringContaining("대리 이정표"),
      });
    }
  });

  it("places special-law form processing caps only on the correct procedure", () => {
    const duration = (procedureId: string) =>
      catalog.durations.find((item) => item.procedureId === procedureId);

    expect(duration("advanced-strategic-industry-fast-track-request")).toMatchObject({
      elapsed: { min: null, base: null, max: 21, unit: "BUSINESS_DAY" },
      planningBasis: "OFFICIAL_CAP_ONLY",
    });
    expect(duration("semiconductor-cluster-fast-track-request")).toMatchObject({
      elapsed: { min: null, base: null, max: 15, unit: "BUSINESS_DAY" },
      planningBasis: "OFFICIAL_CAP_ONLY",
    });
    expect(duration("semiconductor-cluster-plan-application")?.elapsed).toBeNull();
    expect(duration("semiconductor-cluster-plan-consultation")?.elapsed).toBeNull();
    expect(duration("semiconductor-cluster-plan-approval")).toMatchObject({
      elapsed: { min: null, base: null, max: 90, unit: "BUSINESS_DAY" },
      planningBasis: "OFFICIAL_CAP_ONLY",
    });
    expect(duration("semiconductor-cluster-plan-approval")?.assumptions.join(" ")).toContain(
      "민원인인 사업시행자",
    );
  });

  it("preserves every mutually exclusive official service branch", () => {
    const values = (procedureId: string) => [...new Set(
      catalog.durations
        .find((item) => item.procedureId === procedureId)
        ?.referencePeriods
        ?.flatMap((period) => period.range
          ? [period.range.min, period.range.base, period.range.max]
          : [])
        .filter((value): value is number => value !== null) ?? [],
    )].sort((left, right) => left - right);

    expect(values("factory-establishment-approval")).toEqual([7, 14, 20, 30]);
    expect(values("building-permit")).toEqual([2, 7, 10, 14, 15, 25, 40, 45, 70]);
    expect(values("road-occupation-permit")).toEqual([2, 4, 5, 7, 8, 10]);
    expect(values("high-pressure-gas-technical-review")).toEqual([7, 10, 15, 20]);
    expect(values("river-occupation-permit")).toEqual([5, 10, 12, 14, 20, 60]);
  });

  it("keeps the expanded construction and operation paths ordered and auditable", () => {
    const edges = new Map(catalog.edges.map((item) => [item.id, item]));
    expect(edges.get("edge-exp-building-to-safety-plan")?.to).toBe("construction-safety-management-plan-approval");
    expect(edges.get("edge-exp-safety-plan-to-start")?.to).toBe("construction-start-report");
    expect(edges.get("edge-exp-fire-work-to-construction-manager")?.relation).toBe("START_TO_START");
    expect(edges.get("edge-exp-tank-inspection-to-hazardous-completion")?.to).toBe("hazardous-materials-facility-completion-inspection");
    expect(edges.get("edge-exp-demolition-start-to-completion")?.to).toBe("building-demolition-completion-report");
    expect(edges.get("edge-exp-public-water-to-implementation-plan")?.to).toBe("public-water-implementation-plan-approval-report");
    expect(edges.get("edge-exp-fire-supervisor-to-start")?.to).toBe("fire-facility-work-start-report");
    expect(edges.get("edge-exp-gas-inspection-to-business-start")?.to).toBe("high-pressure-gas-business-start-report");
    expect(edges.get("edge-exp-restoration-design-to-completion-inspection")?.to).toBe("forestland-restoration-completion-inspection");
    expect(edges.get("edge-exp-use-to-first-fire-self-inspection")?.from).toBe("building-use-approval");
    expect(edges.get("edge-exp-middle-water-to-building")?.to).toBe("building-permit");
    expect(edges.get("edge-exp-middle-water-to-building")?.strength).toBe("LEGAL_HARD");
    expect(edges.has("edge-exp-start-to-middle-water-report")).toBe(false);
  });

  it("labels Government24 periods as official processing periods, not statutory minima", () => {
    for (const id of [
      "high-pressure-gas-business-start-report",
      "fire-work-supervisor-designation-report",
      "forestland-restoration-design-approval",
      "forestland-restoration-completion-inspection",
    ]) {
      const duration = catalog.durations.find((item) => item.procedureId === id);
      expect(duration?.evidenceType, id).toBe("OFFICIAL_SERVICE_STANDARD");
      expect(duration?.statutoryPeriod, id).toContain("법정 최소기간 아님");
      expect(duration?.assumptions.join(" "), id).toContain("법정 최소기간");
    }

    const middleWater = catalog.durations.find(
      (item) => item.procedureId === "middle-water-installation-report",
    );
    expect(middleWater?.evidenceType).toBe("OFFICIAL_SERVICE_STANDARD");
    expect(middleWater?.authorityProcessing?.unit).toBe("BUSINESS_DAY");
    expect(middleWater?.statutoryPeriod).toContain("제9조제4항");
    expect(middleWater?.statutoryPeriod).toContain("10일 이내");
    expect(middleWater?.assumptions.join(" ")).toContain("최소기간");

    const middleWaterProcedure = catalog.procedures.find(
      (item) => item.id === "middle-water-installation-report",
    );
    expect(middleWaterProcedure?.stage).toBe("PLAN_AND_OCCUPANCY");
    expect(middleWaterProcedure?.description).toContain("건축허가 신청 또는 건축신고 전에");

    const firstFireInspection = catalog.durations.find(
      (item) => item.procedureId === "fire-facility-first-self-inspection-report",
    );
    expect(firstFireInspection?.elapsed).toBeNull();
    expect(firstFireInspection?.statutoryPeriod).toContain("60일 이내");
    expect(firstFireInspection?.assumptions.join(" ")).toContain("행정기관 처리기간이 아님");
  });

  it("does not connect a later project stage back to an earlier stage", () => {
    const stageRank = {
      SITE_REVIEW: 0,
      PLAN_AND_OCCUPANCY: 1,
      PRE_CONSTRUCTION: 2,
      DURING_CONSTRUCTION: 3,
      PRE_OPERATION: 4,
      POST_OPERATION: 5,
    } as const;
    const procedures = new Map(catalog.procedures.map((item) => [item.id, item]));
    for (const edge of catalog.edges) {
      const from = procedures.get(edge.from)!;
      const to = procedures.get(edge.to)!;
      expect(
        stageRank[from.stage],
        `${edge.id}: ${from.name}(${from.stage}) → ${to.name}(${to.stage})`,
      ).toBeLessThanOrEqual(stageRank[to.stage]);
    }
  });
});
