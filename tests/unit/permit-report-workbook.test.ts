import { readWorkbookBuffer } from "@alosha/xlsx";
import { strFromU8, unzipSync } from "fflate";
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
    const workbookArchive = unzipSync(bytes);
    const stylesXml = strFromU8(workbookArchive["xl/styles.xml"]);
    const summaryWorksheetXml = strFromU8(workbookArchive["xl/worksheets/sheet2.xml"]);
    const frozenPanes = Object.entries(workbookArchive)
      .filter(([path]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path))
      .flatMap(([, xml]) => strFromU8(xml).match(/<pane[^>]*state="frozen"\/>/g) ?? []);

    expect(bytes.slice(0, 2)).toEqual(Uint8Array.from([80, 75]));
    expect(stylesXml).toContain('vertical="center"');
    expect(stylesXml).not.toContain('vertical="middle"');
    expect(stylesXml).not.toMatch(/rgb="[0-9A-Fa-f]{6}"/);
    expect(summaryWorksheetXml).not.toContain("<pane");
    expect(frozenPanes).toHaveLength(6);
    frozenPanes.forEach((pane) => {
      expect(pane).toContain("topLeftCell=");
    });
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
      "실무 우선순위",
      "우선순위 근거",
      "절차",
      "법정·공식 처리기간",
    ]));
    expect(practical.actualRowCount).toBe(report.procedures.length + 3);
    expect(practical.autoFilter).toBeTruthy();
    expect(practical.views[0]).toMatchObject({ state: "frozen", xSplit: 5, ySplit: 4 });
    expect(practical.getCell("B5").value).toBe("미착수");
    expect(practical.getCell("B5").dataValidation).toMatchObject({ type: "list" });
    expect(practical.getCell("D5").numFmt).toBe("yyyy-mm-dd");
    expect(practical.getCell("F5").value).toBe(
      `${report.procedures[0].practicalPriority} · ${report.procedures[0].practicalPriorityLabel}`,
    );
    expect(practical.getCell("G5").value).toBe(
      report.procedures[0].practicalPriorityReasons.join(" · "),
    );
    expect(String(practical.getCell("A1").alignment?.vertical)).toBe("center");

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
    expect(summaryText).toContain("법적 효력·처분 우열·법정 중요도를 뜻하지 않습니다");
    expect(summaryText).toContain("최종 판단이나 법률자문");
    expect(summary.getCell("I9").value).toBeNull();

    const allCellText = workbook.worksheets.flatMap((sheet) =>
      sheet.getSheetValues().flat().map((value) => String(value ?? "")),
    ).join(" ");
    expect(allCellText).toContain("공업용수 공급계획 반영 협의(국가·관할 수도정비계획)");
    expect(allCellText).toContain("국가수도기본계획 부분변경");
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

    expect(workbook.getWorksheet("실무 관리표")!.getCell("K5").value).toBe(
      "=HYPERLINK(\"https://example.com\",\"열기\")",
    );
  });
});
