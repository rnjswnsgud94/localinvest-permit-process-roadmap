import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildPermitReportModel } from "@/app/components/dashboard/pdf/permit-report-model";
import {
  calculateCardRowSeparatorOffset,
  calculateFlowOverviewCardLayout,
  generatePermitReportPdf,
  REPORT_OUTLINE,
  renderPermitReportPdf,
} from "@/app/components/dashboard/pdf/generate-permit-report-pdf";
import {
  catalog,
  scenarioAnswerSchema,
  type ScenarioAnswers,
} from "@/lib/data/catalog";
import { supplementalPermitTargetIds } from "@/lib/data/supplemental-permit-targets";
import { evaluateProject } from "@/lib/engine/pipeline";

function allTargetsAnswers(): ScenarioAnswers {
  const baseScenario = catalog.scenarios.find(
    (scenario) => scenario.id === "insufficient-inputs",
  );
  if (!baseScenario) throw new Error("insufficient-inputs scenario is required");
  const candidate = structuredClone(
    baseScenario.answers,
  ) as Record<string, unknown>;
  const nullableNonBooleanKeys = new Set([
    "landCategory",
    "environmentalAssessmentType",
    "disasterImpactAssessmentType",
    "undergroundSafetyAssessmentType",
    "nationalHeritageAssessmentType",
    "permitCoordination",
    "increaseAreaM2",
    "totalAreaM2",
    "siteDevelopmentAreaM2",
    "powerIncreaseMw",
    "waterDemandM3Day",
    "wastewaterM3Day",
  ]);

  for (const [key, value] of Object.entries(candidate)) {
    if (value === null && !key.endsWith("Date") && !nullableNonBooleanKeys.has(key)) {
      candidate[key] = true;
    }
  }

  Object.assign(candidate, {
    assessmentDate: "2027-04-01",
    plannedConstructionStartDate: "2027-04-01",
    plannedConstructionEndDate: "2030-04-01",
    equipmentInstallationCompletionDate: "2029-01-01",
    commissioningStartDate: "2029-07-01",
    insideIndustrialComplex: true,
    industryCategory: "SEMICONDUCTOR_ELECTRONICS",
    landCategory: "FARMLAND",
    environmentalAssessmentType: "ENVIRONMENTAL",
    disasterImpactAssessmentType: "DISASTER_IMPACT",
    undergroundSafetyAssessmentType: "UNDERGROUND_SAFETY",
    nationalHeritageAssessmentType: "IMPACT_DIAGNOSIS",
    permitCoordination: "OTHER_GTE_20",
    increaseAreaM2: 100_000,
    totalAreaM2: 100_000,
    siteDevelopmentAreaM2: 500_000,
    powerIncreaseMw: 500,
    waterDemandM3Day: 10_000,
    wastewaterM3Day: 5_000,
    supplementalPermitReviewedIds: [...supplementalPermitTargetIds],
    supplementalPermitTargetIds: supplementalPermitTargetIds.filter(
      (procedureId) =>
        procedureId !== "information-communication-pre-use-inspection" &&
        procedureId !== "marine-use-consultation",
    ),
    chemicalsHandled: true,
    hazardousChemicalBusiness: true,
    psmCovered: true,
    psmCoversSameHazardPreventionScope: true,
  });

  return scenarioAnswerSchema.parse(candidate);
}

describe("permit PDF renderer", () => {
  afterEach(() => vi.restoreAllMocks());

  it("caps dense A3 stage cards inside the available panel height", () => {
    [25, 36, 37, 100].forEach((requiredCount) => {
      const layout = calculateFlowOverviewCardLayout(requiredCount, 157);

      expect(layout.cardCount).toBeLessThanOrEqual(18);
      expect(layout.rowCount).toBeLessThanOrEqual(6);
      expect(layout.usedHeight).toBeLessThanOrEqual(157);
      expect(layout.omittedCount).toBe(requiredCount - 17);
      expect(layout.cardHeight).toBeGreaterThanOrEqual(23);
    });

    const exactFit = calculateFlowOverviewCardLayout(18, 157);
    expect(exactFit.omittedCount).toBe(0);
    expect(exactFit.cardCount).toBe(18);
    expect(exactFit.columnCount).toBe(3);
    expect(exactFit.rowCount).toBe(6);
    expect(exactFit.cardHeight).toBeGreaterThanOrEqual(23);
    expect(exactFit.usedHeight).toBeLessThanOrEqual(157);
  });

  it("keeps card dividers above the following row text", () => {
    const rowFontSize = 8.3;

    expect(calculateCardRowSeparatorOffset(rowFontSize)).toBeGreaterThan(rowFontSize);
    expect(calculateCardRowSeparatorOffset(rowFontSize) - rowFontSize).toBeGreaterThanOrEqual(2);
  });

  it("keeps a dense all-targets model within the A3 card cap", () => {
    const answers = allTargetsAnswers();
    const evaluation = evaluateProject(answers);
    const model = buildPermitReportModel({
      answers,
      evaluation,
      durationScenario: "TYPICAL",
      generatedAt: new Date("2027-04-01T00:00:00.000Z"),
    });
    const requiredCounts = model.flow.stages.map((stage) =>
      stage.items.filter((item) => item.category === "REQUIRED").length,
    );

    expect(requiredCounts).toEqual([19, 18, 45, 4, 40, 5]);
    expect(model.flow.coreRelations.length).toBeGreaterThan(0);
    expect(model.flow.coreRelations.length).toBeLessThanOrEqual(10);
    expect(model.localOrdinances.categories.length).toBeGreaterThan(0);
    requiredCounts.forEach((requiredCount) => {
      const layout = calculateFlowOverviewCardLayout(requiredCount, 157);
      expect(layout.usedHeight).toBeLessThanOrEqual(157);
      expect(layout.cardCount).toBeLessThanOrEqual(24);
    });
  });

  it("creates A4 report pages with one landscape A3 overview", async () => {
    const answers = catalog.scenarios[0].answers;
    const evaluation = evaluateProject(answers);
    const completeModel = buildPermitReportModel({
      answers,
      evaluation,
      durationScenario: "TYPICAL",
      generatedAt: new Date("2026-08-23T03:04:05.000Z"),
    });
    const model = {
      ...completeModel,
      project: {
        ...completeModel.project,
        sections: completeModel.project.sections.slice(0, 1).map((section) => ({
          ...section,
          items: section.items.slice(0, 5),
        })),
      },
      procedures: completeModel.procedures.slice(0, 2),
      gaps: completeModel.gaps.slice(0, 1),
      excluded: completeModel.excluded.slice(0, 2),
      legalSources: completeModel.legalSources.slice(0, 2),
      warnings: completeModel.warnings.slice(0, 2),
    };
    const [regular, bold] = await Promise.all([
      readFile(resolve("public/fonts/nanum-gothic-coding/NanumGothicCoding-Regular.ttf")),
      readFile(resolve("public/fonts/nanum-gothic-coding/NanumGothicCoding-Bold.ttf")),
    ]);

    const bytes = await renderPermitReportPdf(model, { regular, bold });
    expect(new TextDecoder("latin1").decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(50_000);

    const document = await PDFDocument.load(bytes);
    expect(document.getTitle()).toBe(model.metadata.title);
    expect(document.getTitle()).toContain("충청북도 청주시");
    expect(document.getSubject()).toContain("인허가 판정·일정·법령 근거");
    expect(document.getPageCount()).toBeGreaterThan(3);
    expect(
      document.getPages().reduce(
        (count, page) => count + (page.node.Annots()?.size() ?? 0),
        0,
      ),
    ).toBeGreaterThan(0);
    const pageSizes = document.getPages().map((page, index) => ({
      index,
      width: page.getWidth(),
      height: page.getHeight(),
    }));
    const a3Pages = pageSizes.filter((page) => Math.abs(page.width - 1190.55) < 0.2);
    expect(a3Pages).toHaveLength(1);
    expect(a3Pages[0].index).toBe(2);
    expect(a3Pages[0].height).toBeCloseTo(841.89, 1);
    pageSizes.filter((page) => page.index !== 2).forEach((page) => {
      expect(page.width).toBeCloseTo(595.28, 1);
      expect(page.height).toBeCloseTo(841.89, 1);
    });
    expect(REPORT_OUTLINE).toEqual([
      "1. 전체 절차 순서도",
      "2. 판정에 사용한 사업조건",
      "3. 우선 확인·조치사항",
      "4. 일정 및 주요 마일스톤",
      "5. 특별법·특례 적용결과",
      "6. 단계별 인허가 세부절차",
      "7. 지역 조례 확인",
      "부록 A. 공식 법령 근거",
      "부록 B. 확인된 제외 절차",
      "부록 C. 이용상 주의",
    ]);
  }, 20_000);

  it("retries font loading after a transient download failure", async () => {
    const answers = catalog.scenarios[3].answers;
    const evaluation = evaluateProject(answers);
    const completeModel = buildPermitReportModel({
      answers,
      evaluation,
      durationScenario: "TYPICAL",
      generatedAt: new Date("2026-08-23T03:04:05.000Z"),
    });
    const model = {
      ...completeModel,
      project: { ...completeModel.project, sections: [] },
      procedures: [],
      gaps: [],
      excluded: [],
      legalSources: [],
      warnings: [],
    };
    const [regular, bold] = await Promise.all([
      readFile(resolve("public/fonts/nanum-gothic-coding/NanumGothicCoding-Regular.ttf")),
      readFile(resolve("public/fonts/nanum-gothic-coding/NanumGothicCoding-Bold.ttf")),
    ]);
    const successResponse = (bytes: Uint8Array) => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ),
    });
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("temporary network error"))
      .mockRejectedValueOnce(new Error("temporary network error"))
      .mockResolvedValueOnce(successResponse(regular) as Response)
      .mockResolvedValueOnce(successResponse(bold) as Response);

    await expect(generatePermitReportPdf(model)).rejects.toThrow("temporary network error");
    const bytes = await generatePermitReportPdf(model);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(new TextDecoder("latin1").decode(bytes.slice(0, 5))).toBe("%PDF-");
  }, 20_000);
});
