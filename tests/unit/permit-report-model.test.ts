import { describe, expect, it } from "vitest";

import {
  inputLabel,
  procedureCategoryForDecision,
} from "@/app/components/dashboard/constants";
import { buildPermitReportModel } from "@/app/components/dashboard/pdf/permit-report-model";
import { formatProjectInputValue } from "@/app/components/dashboard/ScenarioPicker";
import { catalog, type ScenarioAnswers } from "@/lib/data/catalog";
import { evaluateProject } from "@/lib/engine/pipeline";

function reportFor(
  answers: ScenarioAnswers,
  durationScenario: "MIN" | "TYPICAL" | "USER" = "TYPICAL",
) {
  const evaluation = evaluateProject(answers, {
    includeConditional: true,
    includePractical: true,
  });
  return {
    evaluation,
    report: buildPermitReportModel({
      answers,
      evaluation,
      durationScenario,
      generatedAt: new Date("2026-08-23T03:04:05.000Z"),
    }),
  };
}

describe("permit PDF report model", () => {
  it("keeps the report counts and visible project inputs aligned with the evaluation", () => {
    const answers = catalog.scenarios[0].answers;
    const { evaluation, report } = reportFor(answers);
    const expectedCounts = evaluation.decisions.reduce(
      (counts, decision) => {
        counts[procedureCategoryForDecision(decision)] += 1;
        return counts;
      },
      { REQUIRED: 0, CONFIRM: 0, NOT_REQUIRED: 0 },
    );

    expect(report.summary.counts).toEqual(expectedCounts);
    expect(report.project.sections.flatMap((section) => section.items)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "시·도", value: answers.province }),
        expect.objectContaining({
          label: "업종·공정 유형",
          value: formatProjectInputValue("industryCategory", answers.industryCategory),
        }),
      ]),
    );
    expect(report.metadata).toMatchObject({
      generatedAt: "2026-08-23T03:04:05.000Z",
      title: "충청북도 청주시 · 기타·세부 업종 미정 · 신설·신축 인허가 결과보고서",
      filename: "인허가-결과보고서_충청북도-청주시_기타-세부-업종-미정_신설_신축_20260823-120405.pdf",
    });
    expect(new TextEncoder().encode(report.metadata.filename).byteLength).toBeLessThanOrEqual(220);
  });

  it("builds a complete stage flow and keeps excluded procedures names-only", () => {
    const { evaluation, report } = reportFor(catalog.scenarios[0].answers);
    const flowIds = report.flow.stages.flatMap((stage) => stage.items.map((item) => item.id));
    const procedureIds = report.procedures.map((procedure) => procedure.id);
    const expectedExcludedNames = evaluation.decisions
      .filter((decision) => procedureCategoryForDecision(decision) === "NOT_REQUIRED")
      .map((decision) => decision.procedure.name);

    expect(flowIds).toEqual(procedureIds);
    expect(new Set(flowIds).size).toBe(flowIds.length);
    expect(report.flow.stages.map((stage) => stage.title)).toEqual([
      "입지 사전검토",
      "계획 승인·입주",
      "착공 준비",
      "공사 중",
      "준공·가동 준비",
      "가동 이후",
    ]);
    expect(report.excluded.every((name) => typeof name === "string")).toBe(true);
    expect([...report.excluded].sort((left, right) => left.localeCompare(right, "ko"))).toEqual(
      [...expectedExcludedNames].sort((left, right) => left.localeCompare(right, "ko")),
    );
  });

  it("includes descriptive project inputs that identify the reviewed site and process", () => {
    const answers: ScenarioAnswers = {
      ...catalog.scenarios[0].answers,
      siteAddress: "충청북도 청주시 테스트로 10",
      siteZoning: "일반공업지역",
      industrialComplexName: "테스트산업단지",
      ksicCode: "26111",
      products: "반도체 부품",
      coreProcesses: "조립·검사",
    };
    const { report } = reportFor(answers);
    const detail = report.project.sections.find((section) => section.id === "project-details");

    expect(detail?.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "사업 부지 주소", value: answers.siteAddress }),
      expect.objectContaining({ label: "용도지역·지구", value: answers.siteZoning }),
      expect.objectContaining({ label: "산업단지명", value: answers.industrialComplexName }),
      expect.objectContaining({ label: "한국표준산업분류(KSIC)", value: answers.ksicCode }),
      expect.objectContaining({ label: "생산품·서비스", value: answers.products }),
      expect.objectContaining({ label: "핵심 공정·설비", value: answers.coreProcesses }),
    ]));
  });

  it("keeps project-specific titles and filenames safe and bounded", () => {
    const baseAnswers = catalog.scenarios[0].answers;
    const evaluation = evaluateProject(baseAnswers);
    const answers: ScenarioAnswers = {
      ...baseAnswers,
      city: `청주/../테스트\u202E${"시".repeat(60)}`,
    };
    const report = buildPermitReportModel({
      answers,
      evaluation,
      durationScenario: "TYPICAL",
      generatedAt: new Date("2026-08-23T03:04:05.000Z"),
    });

    expect(report.metadata.title).not.toMatch(/[\u202A-\u202E\u2066-\u2069]/);
    expect(report.metadata.filename).not.toMatch(/[\\/:*?"<>|\u202A-\u202E\u2066-\u2069]/);
    expect(report.metadata.filename).not.toContain("..");
    expect(report.metadata.filename).toMatch(/_20260823-120405\.pdf$/);
    expect(new TextEncoder().encode(report.metadata.filename).byteLength).toBeLessThanOrEqual(220);
  });

  it("turns internal special-law process paths into practitioner labels", () => {
    expect(inputLabel(
      "confirmation.specialLawProcessTokens.INDUSTRIAL_COMPLEX_PLAN_INTEGRATED_APPROVAL",
    )).toBe("산업단지계획 통합승인·의제 요건");
    expect(inputLabel(
      "confirmation.specialLawProcessTokens.SEMICONDUCTOR_CLUSTER_FAST_TRACK",
    )).toBe("반도체클러스터 신속처리 요건");
  });

  it("does not expose internal input paths in procedure reasons", () => {
    const { report } = reportFor(catalog.scenarios[0].answers);
    const procedure = report.procedures.find((item) => item.missingInputs.length > 0);

    expect(procedure).toBeDefined();
    expect(procedure?.reason).toContain("사업조건 입력이 부족합니다");
    expect(procedure?.reason).not.toMatch(/confirmation\.|building\.|environment\.|safety\./);
  });

  it("moves industry-specific special-law procedures into the excluded table for a wood project", () => {
    const answers: ScenarioAnswers = {
      ...catalog.scenarios[0].answers,
      industryCategory: "WOOD_PAPER_PRINTING",
      advancedStrategicIndustryFastTrackConfirmed: null,
      semiconductorClusterFastTrackConfirmed: null,
      semiconductorClusterPlanDeemingConfirmed: null,
      industrialComplexPlanSpecialCaseConfirmed: false,
      regionalSpecialZonePlanDeemingConfirmed: false,
    };
    const { report } = reportFor(answers);
    const industrySpecificProcedureIds = [
      "advanced-strategic-industry-fast-track-request",
      "advanced-strategic-industry-fast-track-result-check",
      "semiconductor-cluster-fast-track-request",
      "semiconductor-cluster-fast-track-result-check",
      "semiconductor-cluster-plan-application",
      "semiconductor-cluster-plan-consultation",
      "semiconductor-cluster-plan-approval",
    ];
    const excludedNames = industrySpecificProcedureIds.map((procedureId) => {
      const procedure = catalog.procedures.find((item) => item.id === procedureId);
      expect(procedure, procedureId).toBeDefined();
      return procedure!.name;
    });

    expect(report.procedures.map((procedure) => procedure.id)).not.toEqual(
      expect.arrayContaining(industrySpecificProcedureIds),
    );
    expect(report.gaps.flatMap((gap) => gap.affectedProcedures)).not.toEqual(
      expect.arrayContaining(excludedNames),
    );
    expect(report.excluded).toEqual(expect.arrayContaining(excludedNames));
  });

  it("never labels a missing or partial schedule as a total duration", () => {
    const missingDates = reportFor(catalog.scenarios[3].answers).report;
    expect(missingDates.summary.duration).toMatchObject({
      label: "산정 불가",
      value: "산정 불가",
      isTotal: false,
    });

    const partialAnswers: ScenarioAnswers = {
      ...catalog.scenarios[0].answers,
      chemicalsHandled: true,
      hazardousChemicalBusiness: true,
    };
    const partial = reportFor(partialAnswers).report;
    if (partial.summary.duration.label === "확인된 일정 하한") {
      expect(partial.summary.duration.isTotal).toBe(false);
      expect(partial.summary.duration.detail).toContain("총 소요기간 아님");
    } else {
      expect(partial.summary.duration.label).not.toBe("확인된 일정 하한");
    }
  });

  it("separates user-entered schedule values from the official duration", () => {
    const answers: ScenarioAnswers = {
      ...catalog.scenarios[0].answers,
      userDurationOverrides: {
        ...catalog.scenarios[0].answers.userDurationOverrides,
        "building-permit": { value: 45, unit: "CALENDAR_DAY" },
      },
    };
    const { report } = reportFor(answers, "USER");
    const buildingPermit = report.procedures.find(
      (procedure) => procedure.id === "building-permit",
    );

    expect(report.metadata.durationScenario).toBe("사용자 예상");
    expect(buildingPermit?.scheduleNote).toContain("사용자 예상 45일");
    expect(buildingPermit?.officialDuration).toMatch(/법정|공식|처리기간/);
  });

  it("marks the AI data-center special act as future before 2027-03-10", () => {
    const answers: ScenarioAnswers = {
      ...catalog.scenarios[0].answers,
      assessmentDate: "2026-08-23",
      industryCategory: "AI_DATA_CENTER",
      aiDataCenterActFacilityConfirmed: true,
      aiDataCenterOneStopStatus: "COMPLETED",
      appliedSpecialLawIds: ["AIDC_ONE_STOP"],
    };
    const { evaluation, report } = reportFor(answers);
    const oneStop = report.specialLaws.find((law) => law.title.includes("일괄처리"));

    expect(oneStop?.status).toContain("시행 전");
    expect(evaluation.decisions.find((decision) =>
      decision.procedure.id === "ai-data-center-business-report",
    )?.isDeemed).toBe(false);
    expect(report.legalSources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        effectiveDate: "2027-03-10",
        effectiveStatus: expect.stringContaining("기준일 현재 미적용"),
      }),
    ]));
    const selectedActSources = report.legalSources.filter((source) =>
      source.title.includes("인공지능 데이터센터 산업 진흥에 관한 특별법"),
    );
    expect(selectedActSources.map((source) => source.locator).join(" · ")).toContain("제18조");
    expect(selectedActSources.map((source) => source.locator).join(" · ")).not.toMatch(
      /제19조|제21조|제22조|제23조/,
    );
  });

  it("exposes official links without leaking internal law API identifiers", () => {
    const { report } = reportFor(catalog.scenarios[0].answers);
    const serialized = JSON.stringify(report);

    expect(report.legalSources.length).toBeGreaterThan(0);
    expect(report.legalSources.every((source) => /^https:\/\//.test(source.officialUrl))).toBe(true);
    expect(serialized).not.toContain("LAW_API_OC");
    expect(serialized).not.toMatch(/\"(?:mst|lawId|apiRetrievedAt)\"/);
    expect(serialized).not.toMatch(/rule-|판정규칙 법률 검토 필요|AI 보조 초안|근거 추가 검토 필요/);
  });
});
