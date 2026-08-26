import { describe, expect, it } from "vitest";

import { catalog, scenarioAnswerSchema, type ScenarioAnswers } from "@/lib/data/catalog";
import {
  decodeInputCode,
  decodeShareState,
  encodeInputCode,
  encodeShareState,
  INPUT_CODE_PREFIX,
  InputCodeError,
  MAX_INPUT_CODE_LENGTH,
  MAX_SHARE_STATE_LENGTH,
  SHARE_STATE_FIELDS,
  ShareStateTooLongError,
} from "@/lib/share-state";

function decodeInputCodePayload(code: string) {
  const [, payload] = code.slice(INPUT_CODE_PREFIX.length).split(".");
  return Buffer.from(payload, "base64url").toString("utf8");
}

function inputCodeChecksum(value: string) {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(value)) {
    hash = Math.imul(hash ^ byte, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function encodeInputCodePayload(payload: string) {
  return `${INPUT_CODE_PREFIX}${inputCodeChecksum(payload)}.${Buffer.from(payload, "utf8").toString("base64url")}`;
}

describe("versioned share state", () => {
  it("exports and imports every golden input as a deterministic portable code", () => {
    for (const scenario of catalog.scenarios) {
      const first = encodeInputCode(scenario.answers);
      const second = encodeInputCode(scenario.answers);
      expect(first).toBe(second);
      expect(first.startsWith(INPUT_CODE_PREFIX)).toBe(true);
      expect(first).toMatch(/^FPR1\.[0-9a-f]{8}\.[A-Za-z0-9_-]+$/);
      expect(first.length).toBeLessThanOrEqual(MAX_INPUT_CODE_LENGTH);
      expect(decodeInputCode(first, catalog.scenarios[0].answers)).toEqual(scenario.answers);
    }
  });

  it("keeps the portable-code whitelist aligned with every project input", () => {
    const schemaFields = Object.keys(scenarioAnswerSchema.shape).sort();
    const exportedFields = [...SHARE_STATE_FIELDS].sort();

    expect(exportedFields).toEqual(schemaFields);
    expect(new Set(SHARE_STATE_FIELDS).size).toBe(SHARE_STATE_FIELDS.length);
  });

  it("rejects unsupported, malformed, changed, and oversized input codes", () => {
    const fallback = catalog.scenarios[0].answers;
    const valid = encodeInputCode(catalog.scenarios[1].answers);
    const changed = `${valid.slice(0, -1)}${valid.endsWith("A") ? "B" : "A"}`;

    expect(() => decodeInputCode("FPR0.invalid", fallback)).toThrow(InputCodeError);
    expect(() => decodeInputCode(`${INPUT_CODE_PREFIX}%%%`, fallback)).toThrow("형식이 올바르지");
    expect(() => decodeInputCode(changed, fallback)).toThrow(InputCodeError);
    expect(() => decodeInputCode(
      `${INPUT_CODE_PREFIX}${"A".repeat(MAX_INPUT_CODE_LENGTH)}`,
      fallback,
    )).toThrow("허용 길이를 초과");
    expect(() => decodeInputCode(
      `${" ".repeat(MAX_INPUT_CODE_LENGTH + 1)}${valid}`,
      fallback,
    )).toThrow("허용 길이를 초과");

    const payload = decodeInputCodePayload(valid);
    const [validChecksum, validBase64] = valid.slice(INPUT_CODE_PREFIX.length).split(".");
    const changedWithStaleChecksum = `${INPUT_CODE_PREFIX}${validChecksum}.${validBase64.slice(0, -1)}${validBase64.endsWith("A") ? "B" : "A"}`;
    expect(() => decodeInputCode(changedWithStaleChecksum, fallback)).toThrow("변경되었거나");
    expect(() => decodeInputCode(
      encodeInputCodePayload(`${payload}&unexpected=1`),
      fallback,
    )).toThrow("변경되었거나");
    expect(() => decodeInputCode(
      encodeInputCodePayload(`${payload}&pr=강원특별자치도`),
      fallback,
    )).toThrow("변경되었거나");
  });

  it("round-trips escaped array items and still accepts legacy array payloads", () => {
    const fallback = catalog.scenarios[0].answers;
    const answers: ScenarioAnswers = {
      ...fallback,
      advancedStrategicIndustryFastTrackPermitIds: [
        "permit.v1",
        "percent%id",
        "",
        "%2E",
      ],
    };

    const shared = encodeShareState(answers, "SWIMLANE");
    expect(new URLSearchParams(shared).get("ac")).toBe("1");
    expect(decodeShareState(shared, fallback).answers).toEqual(answers);
    expect(decodeInputCode(encodeInputCode(answers), fallback)).toEqual(answers);

    const legacyAnswers: ScenarioAnswers = {
      ...fallback,
      advancedStrategicIndustryFastTrackPermitIds: [
        "permit",
        "v1",
        "percent%id",
      ],
    };
    const legacyState = new URLSearchParams(
      encodeShareState(legacyAnswers, "SWIMLANE"),
    );
    legacyState.delete("ac");
    legacyState.set(
      "aspi",
      legacyAnswers.advancedStrategicIndustryFastTrackPermitIds.join("."),
    );
    const legacyPayload = legacyState.toString();

    expect(decodeShareState(legacyPayload, fallback).answers).toEqual(
      legacyAnswers,
    );
    expect(
      decodeInputCode(encodeInputCodePayload(legacyPayload), fallback),
    ).toEqual(legacyAnswers);
  });

  it("rejects oversized array selections before exporting a non-restorable code", () => {
    const fallback = catalog.scenarios[0].answers;
    const answers: ScenarioAnswers = {
      ...fallback,
      advancedStrategicIndustryFastTrackPermitIds: Array.from(
        { length: 251 },
        (_, index) => `permit-${index}`,
      ),
    };

    expect(() => encodeInputCode(answers)).toThrow("항목별 250개 이하");
  });

  it("uses input codes for valid states that are too large for a share URL", () => {
    const fallback = catalog.scenarios[0].answers;
    const longPermitIds = Array.from(
      { length: 120 },
      (_, index) => `permit-${String(index).padStart(3, "0")}-${"x".repeat(32)}`,
    );
    const answers: ScenarioAnswers = {
      ...fallback,
      advancedStrategicIndustryFastTrackPermitIds: longPermitIds,
      semiconductorClusterFastTrackPermitIds: longPermitIds,
      semiconductorClusterPlanIncludedPermitIds: longPermitIds,
      industrialComplexPlanIncludedPermitIds: longPermitIds,
      regionalSpecialZonePlanIncludedPermitIds: longPermitIds,
    };

    expect(() => encodeShareState(answers, "SWIMLANE")).toThrow(ShareStateTooLongError);
    const code = encodeInputCode(answers);
    expect(decodeInputCodePayload(code).length).toBeGreaterThan(MAX_SHARE_STATE_LENGTH);
    expect(code.length).toBeLessThanOrEqual(MAX_INPUT_CODE_LENGTH);
    expect(decodeInputCode(code, fallback)).toEqual(answers);
  });

  it("preserves a literal u in text fields and never serializes server secret names", () => {
    const fallback = catalog.scenarios[0].answers;
    const answers: ScenarioAnswers = {
      ...fallback,
      siteAddress: "u",
      products: "u",
      coreProcesses: "u",
    };
    const code = encodeInputCode(answers);
    const payload = decodeInputCodePayload(code);

    expect(decodeInputCode(code, fallback)).toEqual(answers);
    expect(payload).not.toContain("LAW_API_OC");
    expect(payload).not.toContain("NEXT_PUBLIC");
  });

  it("round-trips the whitelisted non-sensitive fields deterministically", () => {
    const answers = catalog.scenarios[2].answers;
    const first = encodeShareState(answers, "SCHEDULE");
    const second = encodeShareState(answers, "SCHEDULE");
    expect(first).toBe(second);
    expect(first).toContain("v=15");
    expect(decodeShareState(first, catalog.scenarios[0].answers)).toEqual({ answers, tab: "SCHEDULE" });
    expect(first).not.toContain("address");
  });

  it("preserves expanded free-text inputs beyond the former 80-character decoder limit", () => {
    const fallback = catalog.scenarios[0].answers;
    const answers: ScenarioAnswers = {
      ...fallback,
      siteAddress: `충청남도 아산시 ${"검토필지".repeat(18)}`,
      siteRestrictedFactors: "농지·산지·진입도로 검토, ".repeat(12),
      products: "메모리반도체·첨단패키징 부품, ".repeat(10),
      coreProcesses: "웨이퍼 가공·조립·검사, ".repeat(10),
      existingApprovalIds: "기존 승인문서 2026-01, ".repeat(10),
    };
    const encoded = encodeShareState(answers, "ACTION");

    expect(encoded.length).toBeLessThanOrEqual(MAX_SHARE_STATE_LENGTH);
    expect(decodeShareState(encoded, fallback)).toEqual({ answers, tab: "ACTION" });
  });

  it("round-trips a valid expanded state above the former 3,000-character limit", () => {
    const fallback = catalog.scenarios[0].answers;
    const permitIds = catalog.procedures.slice(0, 20).map((item) => item.id);
    const answers: ScenarioAnswers = {
      ...fallback,
      industrialComplexPlanIncludedPermitIds: permitIds,
      regionalSpecialZonePlanIncludedPermitIds: permitIds,
      semiconductorClusterPlanIncludedPermitIds: permitIds,
      advancedStrategicIndustryFastTrackPermitIds: permitIds,
      semiconductorClusterFastTrackPermitIds: permitIds,
    };
    const encoded = encodeShareState(answers, "LEGAL");

    expect(encoded.length).toBeGreaterThan(3_000);
    expect(encoded.length).toBeLessThanOrEqual(MAX_SHARE_STATE_LENGTH);
    expect(decodeShareState(encoded, fallback)).toEqual({ answers, tab: "LEGAL" });
    expect(decodeShareState(`?${encoded}`, fallback)).toEqual({ answers, tab: "LEGAL" });
  });

  it("migrates legacy links with newly added facts left unknown", () => {
    const fallback = catalog.scenarios[0].answers;
    const params = new URLSearchParams(encodeShareState(catalog.scenarios[2].answers, "SWIMLANE"));
    params.set("v", "1");
    for (const key of ["land", "demo", "road", "tia", "eia", "iep", "cmi", "hcb", "haz", "hpg", "shg", "fire", "pef", "eup", "gw"]) params.delete(key);

    const restored = decodeShareState(params.toString(), fallback);
    expect(restored.answers.integratedEnvironmentalPermitTarget).toBeNull();
    expect(restored.answers.privateElectricalFacilityWork).toBeNull();
    expect(restored.warning).toContain("신규 조건은 미확인");
  });

  it("round-trips AI data-center qualification, one-stop status, and selected special laws in v9", () => {
    const fallback = catalog.scenarios[0].answers;
    const answers: ScenarioAnswers = {
      ...fallback,
      industryCategory: "AI_DATA_CENTER",
      landscapeReviewRequired: true,
      buildingCommitteeReviewRequired: true,
      gridImpactAssessmentRequired: true,
      aiDataCenterActFacilityConfirmed: true,
      aiDataCenterOneStopStatus: "COMPLETED",
      appliedSpecialLawIds: ["AIDC_ONE_STOP", "AIDC_GRID_IMPACT_EXEMPTION"],
    };
    const encoded = encodeShareState(answers, "LEGAL");

    expect(decodeShareState(encoded, fallback)).toEqual({ answers, tab: "LEGAL" });
    expect(encoded).toContain("aic=1");
    expect(encoded).toContain("aos=COMPLETED");
    expect(encoded).toContain("sl=AIDC_ONE_STOP.AIDC_GRID_IMPACT_EXEMPTION");
  });

  it("round-trips automatic special-law qualification facts only in v9", () => {
    const fallback = catalog.scenarios[0].answers;
    const answers: ScenarioAnswers = {
      ...fallback,
      industryCategory: "SEMICONDUCTOR_ELECTRONICS",
      insideIndustrialComplex: true,
      advancedStrategicIndustryFastTrackConfirmed: true,
      semiconductorClusterFastTrackConfirmed: true,
      industrialComplexPlanSpecialCaseConfirmed: false,
      regionalSpecialZonePlanDeemingConfirmed: true,
    };
    const encoded = encodeShareState(answers, "LEGAL");

    expect(decodeShareState(encoded, fallback)).toEqual({ answers, tab: "LEGAL" });
    expect(encoded).toContain("asf=1");
    expect(encoded).toContain("scf=1");
    expect(encoded).toContain("icp=0");
    expect(encoded).toContain("rsz=1");

    const legacy = new URLSearchParams(encoded);
    legacy.set("v", "8");
    const restored = decodeShareState(legacy.toString(), fallback);
    expect(restored.answers.advancedStrategicIndustryFastTrackConfirmed).toBeNull();
    expect(restored.answers.semiconductorClusterFastTrackConfirmed).toBeNull();
    expect(restored.answers.industrialComplexPlanSpecialCaseConfirmed).toBeNull();
    expect(restored.answers.regionalSpecialZonePlanDeemingConfirmed).toBeNull();
    expect(restored.warning).toContain("업종·지역·산업단지 특별법 확인값");
  });

  it("preserves plan approval and gazette evidence introduced in v11", () => {
    const fallback = catalog.scenarios[0].answers;
    const answers: ScenarioAnswers = {
      ...fallback,
      industrialComplexPlanSpecialCaseConfirmed: true,
      industrialComplexPlanDocumentsIncluded: true,
      industrialComplexPlanConsultationCompleted: true,
      industrialComplexPlanApprovalPublished: true,
      industrialComplexPlanApprovalPublishedDate: "2026-08-20",
      industrialComplexPlanApprovalNoticeReference: "충청남도고시 제2026-100호",
      industrialComplexPlanIncludedPermitIds: ["building-permit"],
    };
    const encoded = encodeShareState(answers, "LEGAL");

    expect(encoded).toContain("v=15");
    expect(encoded).toContain("ipa=1");
    expect(encoded).toContain("ipad=2026-08-20");
    expect(decodeShareState(encoded, fallback)).toEqual({ answers, tab: "LEGAL" });

    const legacy = new URLSearchParams(encoded);
    legacy.set("v", "10");
    const restored = decodeShareState(legacy.toString(), fallback);
    expect(restored.answers.industrialComplexPlanApprovalPublished).toBeNull();
    expect(restored.answers.industrialComplexPlanApprovalPublishedDate).toBeNull();
    expect(restored.answers.industrialComplexPlanApprovalNoticeReference).toBe("");
    expect(restored.warning).toContain("승인·고시 완료 증거");
  });

  it("round-trips the noise-vibration facility answer only in v12", () => {
    const fallback = catalog.scenarios[0].answers;
    const answers: ScenarioAnswers = {
      ...fallback,
      noiseVibrationFacility: true,
    };
    const encoded = encodeShareState(answers, "SWIMLANE");

    expect(encoded).toContain("v=15");
    expect(encoded).toContain("noi=1");
    expect(decodeShareState(encoded, fallback)).toEqual({ answers, tab: "SWIMLANE" });

    const legacy = new URLSearchParams(encoded);
    legacy.set("v", "11");
    const restored = decodeShareState(legacy.toString(), fallback);
    expect(restored.answers.noiseVibrationFacility).toBeNull();
    expect(restored.warning).toContain("소음·진동배출시설 확인값");
  });

  it("round-trips sorted per-procedure user duration overrides only in v13", () => {
    const fallback = catalog.scenarios[0].answers;
    const answers: ScenarioAnswers = {
      ...fallback,
      userDurationOverrides: {
        "landscape-review": { value: 0, unit: "BUSINESS_DAY" },
        "building-permit": { value: 45, unit: "CALENDAR_DAY" },
        "factory-establishment-approval": { value: 3_650, unit: "MONTH" },
      },
    };
    const encoded = encodeShareState(answers, "SCHEDULE");
    const params = new URLSearchParams(encoded);

    expect(params.get("v")).toBe("15");
    expect(params.get("ud")).toBe(
      "building-permit~45~c.factory-establishment-approval~3650~m.landscape-review~0~b",
    );
    expect(decodeShareState(encoded, fallback)).toEqual({
      answers,
      tab: "SCHEDULE",
    });
    expect(decodeInputCode(encodeInputCode(answers), fallback)).toEqual(answers);

    params.set("v", "12");
    params.delete("ud");
    const restored = decodeShareState(params.toString(), {
      ...fallback,
      userDurationOverrides: {
        "building-permit": { value: 99, unit: "CALENDAR_DAY" },
      },
    });
    expect(restored.answers.userDurationOverrides).toEqual({});
    expect(restored.warning).toContain("사용자 예상 처리기간");
  });

  it("round-trips the unified entry-contract facts only in v15", () => {
    const fallback = catalog.scenarios[0].answers;
    const answers: ScenarioAnswers = {
      ...fallback,
      insideIndustrialComplex: true,
      entryContractRegime: "FREE_TRADE_ZONE_ACT",
      entryEligibilityConfirmed: true,
      entryContractStatus: "COMPLETED",
      entryZoneName: "부산항 자유무역지역",
      entryManagingAuthority: "부산항만공사",
      entryContractEvidence: "입주계약 2026-100호 · 2026-08-20",
    };
    const encoded = encodeShareState(answers, "LEGAL");

    expect(new URLSearchParams(encoded).get("v")).toBe("15");
    expect(decodeShareState(encoded, fallback)).toEqual({
      answers,
      tab: "LEGAL",
    });
    expect(decodeInputCode(encodeInputCode(answers), fallback)).toEqual(
      answers,
    );
  });

  it("migrates v14 industrial, port, and legacy local-EIA facts conservatively", () => {
    const fallback = catalog.scenarios[0].answers;
    const industrial = new URLSearchParams(
      encodeShareState(
        {
          ...fallback,
          insideIndustrialComplex: true,
          industrialComplexName: "아산테크노밸리",
          industrialComplexManagingAuthority: "아산시",
          industrialComplexOccupancyContractStatus: "COMPLETED",
        },
        "SWIMLANE",
      ),
    );
    industrial.set("v", "14");
    for (const key of ["ecr", "eec", "ecs", "ezn", "ema", "ece"]) {
      industrial.delete(key);
    }
    industrial.set("eia", "LOCAL");

    const restoredIndustrial = decodeShareState(
      industrial.toString(),
      fallback,
    );
    expect(restoredIndustrial.answers).toMatchObject({
      environmentalAssessmentType: "NONE",
      localEnvironmentalAssessmentRequired: true,
      entryContractRegime: "INDUSTRIAL_COMPLEX_ACT",
      entryContractStatus: "COMPLETED",
      entryZoneName: "아산테크노밸리",
      entryManagingAuthority: "아산시",
      entryContractEvidence: "",
    });

    const legacyPort = new URLSearchParams(industrial);
    legacyPort.set("ic", "0");
    legacyPort.set("ocs", "NOT_APPLIED");
    legacyPort.set("spr", "port-hinterland-entry-contract");
    legacyPort.set("spt", "port-hinterland-entry-contract");
    const restoredPort = decodeShareState(legacyPort.toString(), fallback);
    expect(restoredPort.answers).toMatchObject({
      entryContractRegime: "PORT_ACT",
      entryEligibilityConfirmed: true,
      entryContractStatus: "NOT_APPLIED",
      supplementalPermitReviewedIds: [],
      supplementalPermitTargetIds: [],
    });
    expect(restoredPort.warning).toContain("단일 적용 법률 입력으로 변환");
  });

  it("imports a checksummed v12 portable code and migrates it to empty user estimates", () => {
    const fallback = catalog.scenarios[0].answers;
    const legacyParams = new URLSearchParams(
      decodeInputCodePayload(encodeInputCode(fallback)),
    );
    legacyParams.set("v", "12");
    legacyParams.delete("ud");
    legacyParams.sort();

    expect(
      decodeInputCode(encodeInputCodePayload(legacyParams.toString()), fallback),
    ).toEqual({
      ...fallback,
      entryContractRegime: "INDUSTRIAL_COMPLEX_ACT",
      userDurationOverrides: {},
    });
  });

  it("preserves the compact supplemental threshold review and selected targets", () => {
    const fallback = catalog.scenarios[0].answers;
    const answers: ScenarioAnswers = {
      ...fallback,
      supplementalPermitReviewedIds: [
        "road-occupation-permit",
        "hazard-prevention-plan",
        "industrial-water-master-plan-reflection-consultation",
      ],
      supplementalPermitTargetIds: [
        "road-occupation-permit",
        "hazard-prevention-plan",
        "industrial-water-master-plan-reflection-consultation",
      ],
      psmCovered: true,
      psmCoversSameHazardPreventionScope: true,
    };
    const encoded = encodeShareState(answers, "SWIMLANE");

    expect(encoded).toContain(
      "spr=road-occupation-permit.hazard-prevention-plan.industrial-water-master-plan-reflection-consultation",
    );
    expect(encoded).toContain(
      "spt=road-occupation-permit.hazard-prevention-plan.industrial-water-master-plan-reflection-consultation",
    );
    expect(encoded).toContain("psm=1");
    expect(encoded).toContain("pss=1");
    expect(decodeShareState(encoded, fallback)).toEqual({
      answers,
      tab: "SWIMLANE",
    });
    expect(decodeInputCode(encodeInputCode(answers), fallback)).toEqual(answers);
  });

  it("rejects a stale industrial-water plan selection when additional demand is zero", () => {
    const fallback = catalog.scenarios[0].answers;
    const inconsistent: ScenarioAnswers = {
      ...fallback,
      waterDemandM3Day: 0,
      supplementalPermitReviewedIds: [
        ...fallback.supplementalPermitReviewedIds,
        "industrial-water-master-plan-reflection-consultation",
      ],
      supplementalPermitTargetIds: [
        ...fallback.supplementalPermitTargetIds,
        "industrial-water-master-plan-reflection-consultation",
      ],
    };

    expect(scenarioAnswerSchema.safeParse(inconsistent).success).toBe(false);
    expect(() => encodeInputCode(inconsistent)).toThrow("추가 용수수요가 0");

    const restored = decodeShareState(
      encodeShareState(inconsistent, "SWIMLANE"),
      fallback,
    );
    expect(restored.answers.waterDemandM3Day).toBe(0);
    expect(restored.answers.supplementalPermitReviewedIds).not.toContain(
      "industrial-water-master-plan-reflection-consultation",
    );
    expect(restored.answers.supplementalPermitTargetIds).not.toContain(
      "industrial-water-master-plan-reflection-consultation",
    );
    expect(restored.warning).toContain("추가 용수수요가 0인 입력과 충돌");
  });

  it("clears a stale PSM pre-operation selection from shared URLs", () => {
    const fallback = catalog.scenarios[0].answers;
    const procedureId = "psm-pre-operation-confirmation";
    const inconsistent: ScenarioAnswers = {
      ...fallback,
      psmCovered: false,
      supplementalPermitReviewedIds: [
        ...fallback.supplementalPermitReviewedIds,
        procedureId,
      ],
      supplementalPermitTargetIds: [
        ...fallback.supplementalPermitTargetIds,
        procedureId,
      ],
    };

    expect(scenarioAnswerSchema.safeParse(inconsistent).success).toBe(false);
    expect(() => encodeInputCode(inconsistent)).toThrow("PSM 대상이 확인된 사업");

    const restored = decodeShareState(
      encodeShareState(inconsistent, "SWIMLANE"),
      fallback,
    );
    expect(restored.answers.supplementalPermitReviewedIds).toContain(procedureId);
    expect(restored.answers.supplementalPermitTargetIds).not.toContain(procedureId);
    expect(restored.answers.psmCovered).toBe(false);
    expect(restored.warning).toContain("PSM 대상이 확인되지 않은 입력과 충돌");
  });

  it("rejects a supplemental target that was not individually reviewed", () => {
    const fallback = catalog.scenarios[0].answers;
    const inconsistent: ScenarioAnswers = {
      ...fallback,
      supplementalPermitReviewedIds: [],
      supplementalPermitTargetIds: ["road-occupation-permit"],
    };
    const payload = encodeShareState(inconsistent, "SWIMLANE");
    const externallyBuiltCode = encodeInputCodePayload(payload);

    expect(scenarioAnswerSchema.safeParse(inconsistent).success).toBe(false);
    expect(() => encodeInputCode(inconsistent)).toThrow("검토 완료 절차에 포함");
    expect(() => decodeInputCode(externallyBuiltCode, fallback)).toThrow(
      "입력 코드를 적용할 수 없습니다",
    );
  });

  it("rejects an orphaned PSM same-equipment answer in schemas and portable codes", () => {
    const fallback = catalog.scenarios[0].answers;
    const inconsistent: ScenarioAnswers = {
      ...fallback,
      psmCovered: false,
      psmCoversSameHazardPreventionScope: true,
    };
    const payload = encodeShareState(inconsistent, "SWIMLANE");
    const externallyBuiltCode = encodeInputCodePayload(payload);

    expect(scenarioAnswerSchema.safeParse(inconsistent).success).toBe(false);
    expect(() => encodeInputCode(inconsistent)).toThrow(
      "PSM과 유해위험방지계획서가 모두 대상",
    );
    expect(() => decodeInputCode(externallyBuiltCode, fallback)).toThrow(
      "입력 코드를 적용할 수 없습니다",
    );
    const restored = decodeShareState(payload, fallback);
    expect(restored.answers.psmCovered).toBe(false);
    expect(restored.answers.psmCoversSameHazardPreventionScope).toBeNull();
    expect(restored.warning).toContain("동일설비 범위 선택을 해제");
  });

  it("requires a confirmed PSM target before selecting pre-operation confirmation", () => {
    const fallback = catalog.scenarios[0].answers;
    const procedureId = "psm-pre-operation-confirmation";
    const inconsistent: ScenarioAnswers = {
      ...fallback,
      psmCovered: null,
      supplementalPermitReviewedIds: [
        ...fallback.supplementalPermitReviewedIds,
        procedureId,
      ],
      supplementalPermitTargetIds: [
        ...fallback.supplementalPermitTargetIds,
        procedureId,
      ],
    };

    expect(scenarioAnswerSchema.safeParse(inconsistent).success).toBe(false);
    expect(() => encodeInputCode(inconsistent)).toThrow("PSM 대상이 확인된 사업");
    const restored = decodeShareState(
      encodeShareState(inconsistent, "SWIMLANE"),
      fallback,
    );
    expect(restored.answers.psmCovered).toBeNull();
    expect(restored.answers.supplementalPermitReviewedIds).toContain(procedureId);
    expect(restored.answers.supplementalPermitTargetIds).not.toContain(procedureId);
    expect(restored.warning).toContain("PSM 대상이 확인되지 않은 입력과 충돌");
  });

  it("clears hidden positive follow-up answers without discarding the shared project", () => {
    const fallback = catalog.scenarios[0].answers;
    const inconsistent: ScenarioAnswers = {
      ...fallback,
      province: "서울특별시",
      city: "구로구",
      airEmissionFacility: false,
      airTotalManagementBusinessTarget: true,
      chemicalsHandled: false,
      chemicalManufactureOrImport: true,
      hazardousChemicalBusiness: true,
      chemicalRegistrationRequired: true,
      restrictedOrToxicChemicalImport: true,
      hazardousMaterials: false,
      hazardousMaterialsTank: true,
      hazardousMaterialsPreventionRulesRequired: true,
      highPressureGas: false,
      highPressureGasBusinessStartTarget: true,
      fireFacilityWork: false,
      fireWorkSupervisionTarget: true,
      firstFireSelfInspectionTarget: true,
    };

    expect(scenarioAnswerSchema.safeParse(inconsistent).success).toBe(false);
    expect(() => encodeInputCode(inconsistent)).toThrow("상위 대상 조건과 충돌");
    const payload = encodeShareState(inconsistent, "SWIMLANE");
    const restored = decodeShareState(payload, fallback);
    expect(restored.answers).toMatchObject({
      province: "서울특별시",
      city: "구로구",
      airEmissionFacility: false,
      airTotalManagementBusinessTarget: null,
      chemicalsHandled: false,
      chemicalManufactureOrImport: null,
      hazardousChemicalBusiness: null,
      chemicalRegistrationRequired: null,
      restrictedOrToxicChemicalImport: null,
      hazardousMaterials: false,
      hazardousMaterialsTank: null,
      hazardousMaterialsPreventionRulesRequired: null,
      highPressureGas: false,
      highPressureGasBusinessStartTarget: null,
      fireFacilityWork: false,
      fireWorkSupervisionTarget: null,
      firstFireSelfInspectionTarget: null,
    });
    expect(restored.warning).toContain("후속 대상 선택을 해제");
    expect(() => decodeInputCode(encodeInputCodePayload(payload), fallback)).toThrow(
      "입력 코드를 적용할 수 없습니다",
    );
  });

  it("ignores injected v8-only special-law fields in a legacy-version URL", () => {
    const fallback = catalog.scenarios[0].answers;
    const params = new URLSearchParams(encodeShareState(fallback, "SWIMLANE"));
    params.set("v", "7");
    params.set("aic", "1");
    params.set("aos", "COMPLETED");
    params.set("gia", "1");
    params.set("sl", "AIDC_GRID_IMPACT_EXEMPTION");

    const restored = decodeShareState(params.toString(), fallback);
    expect(restored.answers.aiDataCenterActFacilityConfirmed).toBeNull();
    expect(restored.answers.aiDataCenterOneStopStatus).toBe("NOT_APPLIED");
    expect(restored.answers.gridImpactAssessmentRequired).toBeNull();
    expect(restored.answers.appliedSpecialLawIds).toEqual([]);
    expect(restored.warning).toContain("AI 데이터센터 특례 조건");
  });

  it("round-trips a capital-region location", () => {
    const fallback = catalog.scenarios[0].answers;
    const params = new URLSearchParams(encodeShareState(catalog.scenarios[2].answers, "SWIMLANE"));
    params.set("pr", "경기도");
    params.set("ct", "수원시");

    const restored = decodeShareState(params.toString(), fallback);
    expect(restored.answers.province).toBe("경기도");
    expect(restored.answers.city).toBe("수원시");
    expect(restored.warning).toBeUndefined();
  });

  it.each([
    ["광주광역시", "광산구"],
    ["전라남도", "광양시"],
  ])("migrates a former %s share location without losing its municipality", (province, city) => {
    const fallback = catalog.scenarios[0].answers;
    const legacyAnswers: ScenarioAnswers = {
      ...fallback,
      province,
      city,
    };
    const shared = encodeShareState(legacyAnswers, "SWIMLANE");
    const restored = decodeShareState(shared, fallback);

    expect(restored.answers.province).toBe("전남광주통합특별시");
    expect(restored.answers.city).toBe(city);
    expect(restored.warning).toContain(`종전 ${province} 공유 지역`);
    expect(restored.warning).not.toContain("지원 범위 밖 지역");
    expect(decodeInputCode(encodeInputCode(legacyAnswers), fallback)).toMatchObject({
      province: "전남광주통합특별시",
      city,
    });
  });

  it.each([
    ["인천광역시", "중구"],
    ["서울특별시", "해운대구"],
  ])("clears a stale %s/%s municipality and keeps the rest of the project", (province, city) => {
    const fallback = catalog.scenarios[0].answers;
    const staleAnswers: ScenarioAnswers = {
      ...fallback,
      province,
      city,
      products: "관할 복원 검증 제품",
    };
    const shared = encodeShareState(staleAnswers, "SWIMLANE");
    const restored = decodeShareState(shared, fallback);

    expect(restored.answers).toMatchObject({
      province,
      city: "",
      products: "관할 복원 검증 제품",
    });
    expect(restored.warning).toContain("현행 관할 목록에 없어");
    expect(decodeInputCode(encodeInputCode(staleAnswers), fallback)).toMatchObject({
      province,
      city: "",
      products: "관할 복원 검증 제품",
    });
  });

  it("falls back safely when a shared region is outside the nationwide scope", () => {
    const fallback = catalog.scenarios[0].answers;
    const params = new URLSearchParams(encodeShareState(catalog.scenarios[2].answers, "SWIMLANE"));
    params.set("pr", "가상도");
    params.set("ct", "가상시");

    const restored = decodeShareState(params.toString(), fallback);
    expect(restored.answers.province).toBe(fallback.province);
    expect(restored.answers.city).toBe(fallback.city);
    expect(restored.warning).toContain("지원 범위 밖 지역");
  });

  it("preserves an intentionally unselected province", () => {
    const fallback = catalog.scenarios[0].answers;
    const answers = { ...fallback, province: "", city: "" };
    expect(decodeShareState(encodeShareState(answers, "SWIMLANE"), fallback)).toEqual({ answers, tab: "SWIMLANE" });
  });

  it("ignores unknown parameters and rejects oversized state", () => {
    const fallback = catalog.scenarios[0].answers;
    const encoded = `${encodeShareState(fallback, "SWIMLANE")}&unexpected=%3Cscript%3E`;
    expect(decodeShareState(encoded, fallback).answers).toEqual(fallback);
    expect(decodeShareState(`v=1&x=${"a".repeat(MAX_SHARE_STATE_LENGTH)}`, fallback).warning).toContain("너무 길어");
  });

  it("refuses to create a link that the decoder would reject", () => {
    const fallback = catalog.scenarios[0].answers;
    const answers: ScenarioAnswers = {
      ...fallback,
      siteAddress: "가".repeat(200),
      siteZoning: "나".repeat(120),
      siteRestrictedFactors: "다".repeat(500),
      industrialComplexName: "라".repeat(120),
      industrialComplexManagingAuthority: "마".repeat(120),
      products: "바".repeat(500),
      coreProcesses: "사".repeat(500),
      existingApprovalIds: "아".repeat(500),
    };

    expect(() => encodeShareState(answers, "ACTION")).toThrow(ShareStateTooLongError);
  });

  it("stores daily construction dates without retired phase-wide planning assumptions", () => {
    const answers = {
      ...catalog.scenarios[2].answers,
      investmentType: "EXPANSION",
      plannedConstructionStartDate: "2028-01-15",
      plannedConstructionEndDate: "2030-06-20",
    };
    const encoded = encodeShareState(answers, "SWIMLANE");

    expect(decodeShareState(encoded, catalog.scenarios[0].answers)).toEqual({ answers, tab: "SWIMLANE" });
    expect(encoded).toContain("cs=2028-01-15");
    expect(encoded).toContain("ce=2030-06-20");
    for (const removedKey of ["ppn", "ppb", "ppx", "dpn", "dpb", "dpx", "opn", "opb", "opx", "pon", "pob", "pox"]) {
      expect(encoded).not.toContain(`${removedKey}=`);
    }
    expect(new URLSearchParams(encoded).has("sc")).toBe(false);
  });

  it("migrates v5 monthly construction values to exact month boundaries", () => {
    const fallback = catalog.scenarios[0].answers;
    const params = new URLSearchParams(encodeShareState(fallback, "SCHEDULE"));
    params.set("v", "5");
    params.set("cs", "2028-01");
    params.set("ce", "2030-06");

    const restored = decodeShareState(params.toString(), fallback);
    expect(restored.answers.plannedConstructionStartDate).toBe("2028-01-01");
    expect(restored.answers.plannedConstructionEndDate).toBe("2030-06-30");
    expect(restored.warning).toContain("월 단위 공사 일정");
  });

  it("accepts old links while ignoring retired planning assumptions", () => {
    const fallback = catalog.scenarios[0].answers;
    const params = new URLSearchParams(encodeShareState(fallback, "SCHEDULE"));
    params.set("v", "4");
    params.set("ppb", "9");
    params.set("opx", "12");

    const restored = decodeShareState(params.toString(), fallback);
    expect(restored.answers).toEqual({
      ...fallback,
      entryContractRegime: "INDUSTRIAL_COMPLEX_ACT",
      noiseVibrationFacility: null,
    });
    expect(restored.warning).toContain("소음·진동배출시설 확인값");
    expect("preConstructionPlanningBaseMonths" in restored.answers).toBe(false);
  });

  it("rejects impossible assessment dates instead of evaluating the wrong law version", () => {
    expect(scenarioAnswerSchema.safeParse({ ...catalog.scenarios[0].answers, assessmentDate: "2028-02-29" }).success).toBe(true);
    expect(scenarioAnswerSchema.safeParse({ ...catalog.scenarios[0].answers, assessmentDate: "2027-02-29" }).success).toBe(false);

    const fallback = catalog.scenarios[0].answers;
    const params = new URLSearchParams(encodeShareState(fallback, "SWIMLANE"));
    params.set("d", "2027-02-29");
    const restored = decodeShareState(params.toString(), fallback);
    expect(restored.answers).toEqual(fallback);
    expect(restored.warning).toContain("올바르지 않아 기본값");
  });
});
