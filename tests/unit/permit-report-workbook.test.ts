import { readWorkbookBuffer } from "@alosha/xlsx";
import { describe, expect, it } from "vitest";

import { buildPermitReportModel } from "@/app/components/dashboard/pdf/permit-report-model";
import {
  generatePermitReportWorkbook,
  spreadsheetFilename,
} from "@/app/components/dashboard/spreadsheet/generate-permit-report-workbook";
import { catalog } from "@/lib/data/catalog";
import { evaluateProject } from "@/lib/engine/pipeline";

function buildReport() {
  const answers = catalog.scenarios[0].answers;
  return buildPermitReportModel({
    answers,
    evaluation: evaluateProject(answers),
    durationScenario: "TYPICAL",
    includeConditional: true,
    includePractical: true,
    generatedAt: new Date("2026-08-24T04:05:06.000Z"),
  });
}

describe("permit report spreadsheet", () => {
  it("creates a practical, filterable workbook with auditable official links", async () => {
    const report = buildReport();
    const bytes = await generatePermitReportWorkbook(report);
    const workbook = readWorkbookBuffer(bytes);

    expect(bytes.slice(0, 2)).toEqual(Uint8Array.from([80, 75]));
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "실무 관리표",
      "요약",
      "사업조건",
      "선후행 관계",
      "특례·지역조례",
      "공식 근거",
      "확인·제외",
    ]);

    const practical = workbook.getWorksheet("실무 관리표")!;
    expect(practical.getRow(4).values).toEqual(expect.arrayContaining([
      "진행상태",
      "담당자",
      "내부 목표일",
      "절차",
      "법정·공식 처리기간",
    ]));
    expect(practical.actualRowCount).toBe(report.procedures.length + 3);
    expect(practical.autoFilter).toBeTruthy();
    expect(practical.views[0]).toMatchObject({ state: "frozen", xSplit: 5, ySplit: 4 });
    expect(practical.getCell("B5").value).toBe("미착수");
    expect(practical.getCell("B5").dataValidation).toMatchObject({ type: "list" });
    expect(practical.getCell("D5").numFmt).toBe("yyyy-mm-dd");

    const projectInputs = workbook.getWorksheet("사업조건")!;
    expect(projectInputs.getRow(4).values).toEqual(expect.arrayContaining([
      "구분",
      "항목",
      "입력값",
      "입력상태",
    ]));

    const legalSources = workbook.getWorksheet("공식 근거")!;
    expect(legalSources.actualRowCount).toBe(report.legalSources.length + 3);
    const officialLink = legalSources.getCell("H5").value;
    expect(officialLink).toMatchObject({
      text: report.legalSources[0].officialUrl,
      hyperlink: report.legalSources[0].officialUrl,
    });

    const summary = workbook.getWorksheet("요약")!;
    const summaryText = summary.getSheetValues().flat().join(" ");
    expect(summaryText).toContain("노란색 관리열");
    expect(summaryText).toContain("최종 판단이나 법률자문");

    const allCellText = workbook.worksheets.flatMap((sheet) =>
      sheet.getSheetValues().flat().map((value) => String(value ?? "")),
    ).join(" ");
    expect(allCellText).not.toMatch(/LAW_API_OC|confirmation\.|rule-/);
    expect(spreadsheetFilename(report)).toMatch(
      /^인허가-실무관리표_.+_20260824-130506\.xlsx$/,
    );
  });

  it("keeps formula-looking project text as plain text", async () => {
    const report = buildReport();
    report.procedures[0].reason = "=HYPERLINK(\"https://example.com\",\"열기\")";
    const bytes = await generatePermitReportWorkbook(report);
    const workbook = readWorkbookBuffer(bytes);

    expect(workbook.getWorksheet("실무 관리표")!.getCell("I5").value).toBe(
      "=HYPERLINK(\"https://example.com\",\"열기\")",
    );
  });
});
