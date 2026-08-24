import {
  type Cell,
  type Row,
  Workbook,
  type Worksheet,
  writeWorkbookBuffer,
} from "@alosha/xlsx";

import type { PermitReportModel } from "@/app/components/dashboard/pdf/permit-report-model";

const palette = {
  navy: "FF173A5E",
  navyDark: "FF102D4C",
  teal: "FF16877F",
  tealSoft: "FFE8F4F2",
  blueSoft: "FFEAF1F7",
  amber: "FFC88620",
  amberSoft: "FFFFF3D9",
  redSoft: "FFFBEAEC",
  ink: "FF243447",
  muted: "FF66788A",
  line: "FFCCD8E3",
  paper: "FFFFFFFF",
  slateSoft: "FFF5F7F9",
} as const;

const thinBorder = {
  top: { style: "thin" as const, color: { argb: palette.line } },
  left: { style: "thin" as const, color: { argb: palette.line } },
  bottom: { style: "thin" as const, color: { argb: palette.line } },
  right: { style: "thin" as const, color: { argb: palette.line } },
};

const trackingStatusOptions = [
  "미착수",
  "준비 중",
  "접수",
  "보완",
  "협의 중",
  "완료",
  "보류",
  "해당 없음",
];

// @alosha/xlsx exposes the ExcelJS-style value "middle" in its TypeScript
// surface, but serializes it verbatim. SpreadsheetML requires "center" for
// vertical centering; using the schema value prevents Excel from repairing the
// generated styles.xml when the workbook opens.
const ooxmlVerticalCenter = "center" as "middle";

function dateCellValue(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value ?? null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function setWorkbookMetadata(workbook: Workbook, report: PermitReportModel) {
  const generatedAt = new Date(report.metadata.generatedAt);
  workbook.creator = "지역투자 인허가 로드맵";
  workbook.lastModifiedBy = "지역투자 인허가 로드맵";
  workbook.created = Number.isNaN(generatedAt.getTime()) ? new Date() : generatedAt;
  workbook.modified = workbook.created;
  workbook.subject = "사업조건별 인허가 사전검토 및 실무 관리표";
  workbook.title = report.metadata.title;
  workbook.description = report.disclaimer;
  workbook.company = "산업통상자원부";
}

function addSheetHeading(
  sheet: Worksheet,
  title: string,
  subtitle: string,
  lastColumn: number,
) {
  sheet.mergeCells(1, 1, 1, lastColumn);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { name: "맑은 고딕", size: 16, bold: true, color: { argb: palette.paper } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.navyDark } };
  titleCell.alignment = { vertical: ooxmlVerticalCenter, horizontal: "left" };
  sheet.getRow(1).height = 32;

  sheet.mergeCells(2, 1, 2, lastColumn);
  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value = subtitle;
  subtitleCell.font = { name: "맑은 고딕", size: 9, color: { argb: palette.muted } };
  subtitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.slateSoft } };
  subtitleCell.alignment = { vertical: ooxmlVerticalCenter, wrapText: true };
  sheet.getRow(2).height = 28;
}

function styleHeaderRow(row: Row) {
  row.height = 28;
  row.eachCell((cell) => {
    cell.font = { name: "맑은 고딕", size: 9, bold: true, color: { argb: palette.paper } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.navy } };
    cell.alignment = { vertical: ooxmlVerticalCenter, horizontal: "center", wrapText: true };
    cell.border = thinBorder;
  });
}

function styleDataRows(sheet: Worksheet, headerRowNumber: number, lastColumn: number) {
  for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    row.height = 38;
    for (let column = 1; column <= lastColumn; column += 1) {
      const cell = row.getCell(column);
      const hyperlink = typeof cell.value === "object" && cell.value !== null && "hyperlink" in cell.value;
      cell.font = hyperlink
        ? { name: "맑은 고딕", size: 9, color: { argb: "FF0B6A66" }, underline: true }
        : { name: "맑은 고딕", size: 9, color: { argb: palette.ink } };
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = thinBorder;
      if (cell.value instanceof Date) cell.numFmt = "yyyy-mm-dd";
      if (rowNumber % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      }
    }
  }
}

function configureTableSheet(
  sheet: Worksheet,
  headerRowNumber: number,
  lastColumn: number,
  frozenColumns = 0,
) {
  styleHeaderRow(sheet.getRow(headerRowNumber));
  styleDataRows(sheet, headerRowNumber, lastColumn);
  if (sheet.rowCount >= headerRowNumber) {
    sheet.autoFilter = `A${headerRowNumber}:${sheet.getColumn(lastColumn).letter}${Math.max(headerRowNumber, sheet.rowCount)}`;
  }
  sheet.views = [{
    state: "frozen",
    xSplit: frozenColumns,
    ySplit: headerRowNumber,
    topLeftCell: `${sheet.getColumn(frozenColumns + 1).letter}${headerRowNumber + 1}`,
    activeCell: `${sheet.getColumn(frozenColumns + 1).letter}${headerRowNumber + 1}`,
    showGridLines: false,
  }];
  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
    margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    printTitlesRow: `${headerRowNumber}:${headerRowNumber}`,
  };
}

function setColumns(sheet: Worksheet, columns: Array<{ width: number }>) {
  sheet.columns = columns.map(({ width }) => ({ width }));
}

function setLink(cell: Cell, text: string, url: string) {
  cell.value = { text, hyperlink: url, tooltip: url };
  cell.font = {
    name: "맑은 고딕",
    size: 9,
    color: { argb: "FF0B6A66" },
    underline: true,
  };
  cell.alignment = { vertical: "top", wrapText: true };
}

function addPracticalSheet(workbook: Workbook, report: PermitReportModel) {
  const sheet = workbook.addWorksheet("실무 관리표", { properties: { tabColor: { argb: palette.teal } } });
  const headers = [
    "순번", "진행상태", "담당자", "내부 목표일", "내부 메모",
    "단계", "판정", "절차", "판정 이유", "계획 일정", "일정 메모",
    "법정·공식 처리기간", "접수기관", "법정 결정권자", "결과물",
    "주요 제출자료", "후속 의무", "추가 확인 입력", "특례 반영", "근거·검토 메모",
  ];
  addSheetHeading(
    sheet,
    "인허가 실무 관리표",
    "노란색 4개 열은 프로젝트 관리용으로 자유롭게 입력하십시오. 판정·기간·기관 정보는 다운로드 시점의 사전검토 결과이며 최종 처분이나 법률자문이 아닙니다.",
    headers.length,
  );
  sheet.addRow([]);
  sheet.addRow(headers);
  report.procedures.forEach((procedure, index) => {
    sheet.addRow([
      index + 1,
      "미착수",
      null,
      null,
      null,
      procedure.stage,
      procedure.categoryLabel,
      procedure.name,
      procedure.reason,
      procedure.schedule,
      procedure.scheduleNote,
      procedure.officialDuration,
      procedure.authority,
      procedure.decisionMaker,
      procedure.outcome,
      procedure.submissions,
      procedure.followUp,
      procedure.missingInputs.join(" · ") || "없음",
      procedure.specialLawEffects.join(" · ") || "없음",
      [procedure.legalReviewNote, ...procedure.sourceSummaries].filter(Boolean).join(" · ") || "관계기관 협의 필요",
    ]);
  });
  setColumns(sheet, [
    { width: 7 }, { width: 12 }, { width: 13 }, { width: 13 }, { width: 22 },
    { width: 14 }, { width: 14 }, { width: 28 }, { width: 38 }, { width: 22 },
    { width: 34 }, { width: 32 }, { width: 27 }, { width: 27 }, { width: 24 },
    { width: 42 }, { width: 34 }, { width: 28 }, { width: 38 }, { width: 44 },
  ]);
  configureTableSheet(sheet, 4, headers.length, 5);

  for (let rowNumber = 5; rowNumber <= sheet.rowCount; rowNumber += 1) {
    for (let column = 2; column <= 5; column += 1) {
      const cell = sheet.getCell(rowNumber, column);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.amberSoft } };
    }
    sheet.getCell(rowNumber, 2).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [`"${trackingStatusOptions.join(",")}"`],
      showErrorMessage: true,
      errorTitle: "진행상태 확인",
      error: "목록에서 진행상태를 선택해 주세요.",
    };
    sheet.getCell(rowNumber, 4).numFmt = "yyyy-mm-dd";
    const category = report.procedures[rowNumber - 5]?.category;
    if (category === "CONFIRM") {
      sheet.getCell(rowNumber, 7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.amberSoft } };
    } else {
      sheet.getCell(rowNumber, 7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.tealSoft } };
    }
  }
}

function addSummarySheet(workbook: Workbook, report: PermitReportModel) {
  const sheet = workbook.addWorksheet("요약", { properties: { tabColor: { argb: palette.navy } } });
  addSheetHeading(sheet, report.metadata.title, report.project.descriptor, 8);
  setColumns(sheet, [
    { width: 19 }, { width: 24 }, { width: 19 }, { width: 24 },
    { width: 19 }, { width: 24 }, { width: 19 }, { width: 28 },
  ]);

  const metadataRows = [
    ["생성 시각", report.metadata.generatedAtLabel, "검토 기준일", dateCellValue(report.metadata.assessmentDate), "데이터 버전", report.metadata.catalogVersion, "법령 검토 기준", dateCellValue(report.metadata.lastLegalReviewAt)],
    ["처리기간 기준", report.metadata.durationScenario, "일정 범위", report.metadata.scheduleScope, "기간 표시", report.summary.duration.label, "기간 결과", report.summary.duration.value],
  ];
  metadataRows.forEach((values) => sheet.addRow(values));
  for (let rowNumber = 3; rowNumber <= 4; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    row.height = 28;
    for (let column = 1; column <= 8; column += 1) {
      const cell = row.getCell(column);
      cell.border = thinBorder;
      cell.alignment = { vertical: ooxmlVerticalCenter, wrapText: true };
      if (cell.value instanceof Date) cell.numFmt = "yyyy-mm-dd";
      cell.font = { name: "맑은 고딕", size: 9, bold: column % 2 === 1, color: { argb: column % 2 === 1 ? palette.navy : palette.ink } };
      if (column % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.blueSoft } };
    }
  }

  sheet.addRow([]);
  sheet.addRow(["판정 요약", "건수", "로드맵 구성", "건수", "일정 요약", "내용", "기준", "주의"]);
  styleHeaderRow(sheet.getRow(6));
  const summaryRows = [
    ["로드맵 포함", report.summary.counts.REQUIRED, "확정 적용", report.summary.roadmapBreakdown.confirmed, report.summary.duration.label, report.summary.duration.value, report.metadata.durationScenario, report.summary.duration.isTotal ? "총 소요기간" : "총 소요기간 아님"],
    ["추가 확인", report.summary.counts.CONFIRM, "기준 확인 전 포함", report.summary.roadmapBreakdown.scopeCheck, "일정 설명", report.summary.duration.detail, report.metadata.scheduleScope, "실제 일정은 보완·협의·대기기간 확인 필요"],
    ["확인된 제외", report.summary.counts.NOT_REQUIRED, "의제 처리", report.summary.roadmapBreakdown.deemed, "지역 조례 확인일", report.localOrdinances.checkedAt, "공식 근거", `${report.legalSources.length}건 · 원문과 관할기관 최신 안내 재확인`],
  ];
  summaryRows.forEach((values) => sheet.addRow(values));
  styleDataRows(sheet, 6, 8);

  sheet.addRow([]);
  sheet.addRow(["주요 일정", "값"]);
  styleHeaderRow(sheet.getRow(11));
  report.summary.milestones.forEach((milestone) => sheet.addRow([milestone.label, dateCellValue(milestone.value)]));
  for (let rowNumber = 12; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    row.height = 24;
    row.getCell(1).font = { name: "맑은 고딕", size: 9, bold: true, color: { argb: palette.navy } };
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.blueSoft } };
    [1, 2].forEach((column) => {
      row.getCell(column).border = thinBorder;
      row.getCell(column).alignment = { vertical: ooxmlVerticalCenter, wrapText: true };
      if (row.getCell(column).value instanceof Date) row.getCell(column).numFmt = "yyyy-mm-dd";
    });
  }

  const noticeStart = sheet.rowCount + 2;
  sheet.mergeCells(noticeStart, 1, noticeStart, 8);
  sheet.getCell(noticeStart, 1).value = "사용 안내";
  sheet.getCell(noticeStart, 1).font = { name: "맑은 고딕", size: 10, bold: true, color: { argb: palette.paper } };
  sheet.getCell(noticeStart, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.teal } };
  sheet.getCell(noticeStart, 1).alignment = { vertical: ooxmlVerticalCenter };
  sheet.mergeCells(noticeStart + 1, 1, noticeStart + 2, 8);
  sheet.getCell(noticeStart + 1, 1).value = `첫 시트의 노란색 관리열에 진행상태·담당자·내부 목표일·메모를 입력해 실무 체크리스트로 사용하십시오.\n${report.disclaimer}`;
  sheet.getCell(noticeStart + 1, 1).font = { name: "맑은 고딕", size: 9, color: { argb: palette.ink } };
  sheet.getCell(noticeStart + 1, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.tealSoft } };
  sheet.getCell(noticeStart + 1, 1).alignment = { vertical: "top", wrapText: true };
  sheet.getCell(noticeStart + 1, 1).border = thinBorder;
  sheet.getRow(noticeStart + 1).height = 62;
  // @alosha/xlsx does not serialize a matching selection record for a
  // row-only frozen pane. Desktop Excel repairs that incomplete sheet view
  // when opening the workbook, so keep this short summary unfrozen instead.
  sheet.views = [{ showGridLines: false }];
  sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1, paperSize: 9 };
}

function addProjectInputsSheet(workbook: Workbook, report: PermitReportModel) {
  const sheet = workbook.addWorksheet("사업조건", { properties: { tabColor: { argb: palette.navy } } });
  const headers = ["구분", "항목", "입력값", "입력상태"];
  addSheetHeading(sheet, "판정에 사용한 사업조건", report.project.descriptor, headers.length);
  sheet.addRow([]);
  sheet.addRow(headers);
  report.project.sections.forEach((section) => {
    section.items.forEach((item) => {
      sheet.addRow([section.title, item.label, item.value, item.unknown ? "미입력·확인 필요" : "입력 확인"]);
    });
  });
  setColumns(sheet, [{ width: 24 }, { width: 32 }, { width: 52 }, { width: 20 }]);
  configureTableSheet(sheet, 4, headers.length, 2);
  for (let rowNumber = 5; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const unknown = sheet.getCell(rowNumber, 4).value === "미입력·확인 필요";
    sheet.getCell(rowNumber, 4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: unknown ? palette.amberSoft : palette.tealSoft } };
  }
}

function addRelationsSheet(workbook: Workbook, report: PermitReportModel) {
  const sheet = workbook.addWorksheet("선후행 관계", { properties: { tabColor: { argb: palette.amber } } });
  const headers = ["순번", "선행 절차", "후행 절차", "관계", "근거 구분", "병목 후보", "현재 일정 구속", "실무 메모"];
  addSheetHeading(sheet, "핵심 선후행 관계", "전체 기간과 부분 인허가 임계경로를 혼동하지 않도록 병목 후보와 현재 일정 구속 여부를 분리해 표시합니다.", headers.length);
  sheet.addRow([]);
  sheet.addRow(headers);
  report.flow.coreRelations.forEach((relation, index) => {
    sheet.addRow([
      index + 1,
      relation.from,
      relation.to,
      relation.relation,
      relation.evidence,
      relation.bottleneck ? "예" : "아니오",
      relation.binding ? "예" : "아니오",
      relation.note,
    ]);
  });
  setColumns(sheet, [{ width: 7 }, { width: 30 }, { width: 30 }, { width: 14 }, { width: 28 }, { width: 13 }, { width: 16 }, { width: 44 }]);
  configureTableSheet(sheet, 4, headers.length, 3);
}

function addSpecialLawsSheet(workbook: Workbook, report: PermitReportModel) {
  const sheet = workbook.addWorksheet("특례·지역조례", { properties: { tabColor: { argb: palette.teal } } });
  const headers = ["구분", "검토영역", "적용·영향", "상태·관할", "명칭", "시행·개정일", "확인사항", "공식 URL"];
  addSheetHeading(sheet, "특례 및 지역 조례", `지역 조례 검토 기준 ${report.localOrdinances.checkedAt} · 일치 자료가 없으면 ELIS 관할 목록에서 최신 현행 여부를 확인하십시오.`, headers.length);
  sheet.addRow([]);
  sheet.addRow(headers);

  report.specialLaws.forEach((item) => {
    const row = sheet.addRow(["특별법", item.effect, item.note, item.status, `${item.title} · ${item.law} ${item.article}`, null, item.isActive ? "적용요건 확인" : "시행일·적용요건 확인", item.officialUrl]);
    setLink(row.getCell(8), item.officialUrl, item.officialUrl);
  });

  report.localOrdinances.transitionBasisLinks.forEach((item) => {
    const row = sheet.addRow(["경과조치 근거", "지역 조례", item.note, "관할 확인", item.name, null, item.note, item.url]);
    setLink(row.getCell(8), item.url, item.url);
  });

  report.localOrdinances.categories.forEach((category) => {
    category.ordinances.forEach((ordinance) => {
      const row = sheet.addRow([
        "지역 조례",
        category.title,
        category.affects,
        `${ordinance.level === "PROVINCE" ? "광역" : "기초"} · ${ordinance.jurisdictionName}`,
        ordinance.name,
        ordinance.amendmentDate ? dateCellValue(ordinance.amendmentDate) : "미확인",
        [category.reviewPoint, category.limitation, ordinance.transitionNotice].filter(Boolean).join(" · "),
        ordinance.url,
      ]);
      setLink(row.getCell(8), ordinance.url, ordinance.url);
    });
    category.fallbackLinks.forEach((link) => {
      const row = sheet.addRow(["ELIS 관할 목록", category.title, category.affects, "최신 현행 확인", link.name, null, `${category.reviewPoint} · ${category.limitation} · ${link.note}`, link.url]);
      setLink(row.getCell(8), link.url, link.url);
    });
  });

  if (report.localOrdinances.notice) {
    sheet.addRow(["지역 확인 안내", "관할 조례", null, "추가 확인", "관할 조례 안내", null, report.localOrdinances.notice, null]);
  }
  setColumns(sheet, [{ width: 18 }, { width: 26 }, { width: 34 }, { width: 24 }, { width: 38 }, { width: 16 }, { width: 52 }, { width: 44 }]);
  configureTableSheet(sheet, 4, headers.length, 2);
}

function addLegalSourcesSheet(workbook: Workbook, report: PermitReportModel) {
  const sheet = workbook.addWorksheet("공식 근거", { properties: { tabColor: { argb: palette.navy } } });
  const headers = ["순번", "법령·공식자료", "발령기관", "조문·위치", "시행상태", "시행일", "근거 요약", "공식 원문 URL"];
  addSheetHeading(sheet, "공식 법령·자료 근거", "다운로드 시점에 판정에 연결된 공식 근거입니다. 시행 예정 근거는 검토 기준일 현재 미적용 상태로 구분합니다.", headers.length);
  sheet.addRow([]);
  sheet.addRow(headers);
  report.legalSources.forEach((source, index) => {
    const row = sheet.addRow([
      index + 1,
      source.title,
      source.authority,
      source.locator,
      source.effectiveStatus,
      dateCellValue(source.effectiveDate),
      source.summary,
      source.officialUrl,
    ]);
    setLink(row.getCell(8), source.officialUrl, source.officialUrl);
  });
  setColumns(sheet, [{ width: 7 }, { width: 38 }, { width: 24 }, { width: 30 }, { width: 27 }, { width: 15 }, { width: 58 }, { width: 46 }]);
  configureTableSheet(sheet, 4, headers.length, 2);
}

function addReviewSheet(workbook: Workbook, report: PermitReportModel) {
  const sheet = workbook.addWorksheet("확인·제외", { properties: { tabColor: { argb: palette.amber } } });
  const headers = ["구분", "항목", "영향 절차·내용", "실무 조치"];
  addSheetHeading(sheet, "추가 확인 및 제외 절차", "미입력 조건, 일정·근거 경고와 현재 사업조건에서 제외된 절차를 한곳에서 점검합니다.", headers.length);
  sheet.addRow([]);
  sheet.addRow(headers);
  report.gaps.forEach((gap) => sheet.addRow(["추가 입력", gap.input, gap.affectedProcedures.join(" · "), "입력값을 확인한 뒤 판정과 일정을 다시 내려받기"]));
  report.warnings.forEach((warning) => sheet.addRow(["주의", "일정·근거 확인", warning, "관할기관·분야별 전문가에게 확인"]));
  report.excluded.forEach((name) => sheet.addRow(["확인된 제외", name, "현재 입력조건에서 로드맵 제외", "사업조건이 바뀌면 다시 판정"]));
  sheet.addRow(["면책", "사전 검토자료", report.disclaimer, "실제 신청 전 관할기관과 분야별 전문가에게 확인"]);
  setColumns(sheet, [{ width: 18 }, { width: 32 }, { width: 70 }, { width: 42 }]);
  configureTableSheet(sheet, 4, headers.length, 1);
  for (let rowNumber = 5; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const category = String(sheet.getCell(rowNumber, 1).value ?? "");
    const color = category === "주의" || category === "추가 입력"
      ? palette.amberSoft
      : category === "면책"
        ? palette.redSoft
        : palette.slateSoft;
    sheet.getCell(rowNumber, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
  }
}

export function spreadsheetFilename(report: PermitReportModel) {
  return report.metadata.filename
    .replace(/^인허가-결과보고서_/, "인허가-실무관리표_")
    .replace(/\.pdf$/i, ".xlsx");
}

export async function generatePermitReportWorkbook(report: PermitReportModel) {
  const workbook = new Workbook();
  setWorkbookMetadata(workbook, report);
  addPracticalSheet(workbook, report);
  addSummarySheet(workbook, report);
  addProjectInputsSheet(workbook, report);
  addRelationsSheet(workbook, report);
  addSpecialLawsSheet(workbook, report);
  addLegalSourcesSheet(workbook, report);
  addReviewSheet(workbook, report);
  return writeWorkbookBuffer(workbook, { useStyles: true, useSharedStrings: true });
}
