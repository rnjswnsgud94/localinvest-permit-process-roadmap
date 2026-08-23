import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  PDFHexString,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";

import type { PermitReportModel } from "@/app/components/dashboard/pdf/permit-report-model";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const A3_LANDSCAPE_WIDTH = 1190.55;
const A3_LANDSCAPE_HEIGHT = 841.89;
const MARGIN_X = 42;
const PAGE_TOP = 794;
const PAGE_BOTTOM = 55;
const CONTENT_WIDTH = A4_WIDTH - MARGIN_X * 2;

export const REPORT_OUTLINE = [
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
] as const;

const FLOW_OVERVIEW_MAX_CARDS = 18;

export function calculateFlowOverviewCardLayout(
  requiredCount: number,
  cardAreaHeight: number,
) {
  const normalizedCount = Math.max(0, Math.floor(requiredCount));
  const visibleProcedureCount = normalizedCount > FLOW_OVERVIEW_MAX_CARDS
    ? FLOW_OVERVIEW_MAX_CARDS - 1
    : normalizedCount;
  const omittedCount = normalizedCount - visibleProcedureCount;
  const cardCount = visibleProcedureCount + (omittedCount > 0 ? 1 : 0);
  const columnCount = cardCount > 16 ? 3 : cardCount > 8 ? 2 : 1;
  const rowCount = cardCount ? Math.ceil(cardCount / columnCount) : 0;
  const cardGap = columnCount === 3 ? 3 : 4;
  const cardHeight = rowCount
    ? Math.min(31, (cardAreaHeight - cardGap * (rowCount - 1)) / rowCount)
    : 0;

  return {
    visibleProcedureCount,
    omittedCount,
    cardCount,
    columnCount,
    rowCount,
    cardGap,
    cardHeight,
    usedHeight: rowCount ? rowCount * cardHeight + (rowCount - 1) * cardGap : 0,
  };
}

export function calculateCardRowSeparatorOffset(rowFontSize: number) {
  return rowFontSize + 2;
}

const palette = {
  ink: rgb(0.09, 0.15, 0.24),
  body: rgb(0.2, 0.27, 0.36),
  muted: rgb(0.43, 0.49, 0.58),
  line: rgb(0.84, 0.87, 0.91),
  panel: rgb(0.965, 0.973, 0.985),
  blue: rgb(0.08, 0.29, 0.58),
  blueSoft: rgb(0.91, 0.95, 1),
  teal: rgb(0.02, 0.47, 0.43),
  tealSoft: rgb(0.9, 0.98, 0.96),
  amber: rgb(0.72, 0.39, 0.03),
  amberSoft: rgb(1, 0.96, 0.86),
  red: rgb(0.68, 0.17, 0.2),
  redSoft: rgb(1, 0.93, 0.93),
  white: rgb(1, 1, 1),
};

type FontSet = {
  regular: PDFFont;
  bold: PDFFont;
};

type TextOptions = {
  font?: PDFFont;
  size?: number;
  color?: RGB;
  lineHeight?: number;
  width?: number;
  indent?: number;
};

type CardRow = {
  label: string;
  value: string;
  tone?: "normal" | "warning" | "accent";
};

function cleanText(value: unknown) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[\u{1F000}-\u{1FAFF}]/gu, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[\t\r]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}

function truncate(value: string, maximum = 1_100) {
  const text = cleanText(value);
  return text.length > maximum ? `${text.slice(0, maximum - 1)}…` : text;
}

const characterWidthCache = new WeakMap<PDFFont, Map<string, number>>();

function characterWidth(font: PDFFont, character: string, size: number) {
  let cache = characterWidthCache.get(font);
  if (!cache) {
    cache = new Map();
    characterWidthCache.set(font, cache);
  }
  const key = `${size}:${character}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const width = font.widthOfTextAtSize(character, size);
  cache.set(key, width);
  return width;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of cleanText(text).split("\n")) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    let current = "";
    let currentWidth = 0;
    let lastBreak = -1;
    for (const character of Array.from(paragraph)) {
      const nextCharacterWidth = characterWidth(font, character, size);
      if (currentWidth + nextCharacterWidth <= maxWidth || !current) {
        current += character;
        currentWidth += nextCharacterWidth;
        if (/\s|[·,.;:()/]/.test(character)) lastBreak = current.length;
        continue;
      }
      if (lastBreak > 0) {
        lines.push(current.slice(0, lastBreak).trimEnd());
        current = `${current.slice(lastBreak).trimStart()}${character}`;
        currentWidth = font.widthOfTextAtSize(current, size);
      } else {
        lines.push(current);
        current = character;
        currentWidth = nextCharacterWidth;
      }
      lastBreak = -1;
      for (let index = 0; index < current.length; index += 1) {
        if (/\s|[·,.;:()/]/.test(current[index])) lastBreak = index + 1;
      }
    }
    if (current) lines.push(current.trimEnd());
  }
  return lines.length ? lines : [""];
}

function singleLineText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const value = cleanText(text);
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  const characters = Array.from(value);
  let lower = 0;
  let upper = characters.length;
  while (lower < upper) {
    const middle = Math.ceil((lower + upper) / 2);
    const candidate = `${characters.slice(0, middle).join("")}…`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) lower = middle;
    else upper = middle - 1;
  }
  return `${characters.slice(0, lower).join("")}…`;
}

function limitedLines(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  maximumLines: number,
) {
  const lines = wrapText(text, font, size, maxWidth);
  if (lines.length <= maximumLines) return lines;
  const visible = lines.slice(0, maximumLines);
  visible[maximumLines - 1] = singleLineText(
    `${visible[maximumLines - 1]}…`,
    font,
    size,
    maxWidth,
  );
  return visible;
}

class PermitPdfWriter {
  private page!: PDFPage;
  private y = PAGE_TOP;
  private sectionLabel = "보고서 요약";
  private tocPage: PDFPage | null = null;
  private readonly tocEntries: Array<{ title: string; pageIndex: number }> = [];

  constructor(
    private readonly document: PDFDocument,
    private readonly fonts: FontSet,
    private readonly model: PermitReportModel,
  ) {
    this.addPage("보고서 요약");
  }

  private addPage(
    sectionLabel = this.sectionLabel,
    size: readonly [number, number] = [A4_WIDTH, A4_HEIGHT],
  ) {
    this.sectionLabel = sectionLabel;
    this.page = this.document.addPage([size[0], size[1]]);
    const pageWidth = this.page.getWidth();
    const pageHeight = this.page.getHeight();
    this.y = pageHeight - 48;
    this.page.drawRectangle({
      x: 0,
      y: pageHeight - 12,
      width: pageWidth,
      height: 12,
      color: palette.blue,
    });
    const sectionWidth = this.fonts.regular.widthOfTextAtSize(sectionLabel, 8.2);
    const headerTitle = singleLineText(
      this.model.metadata.title,
      this.fonts.bold,
      8.5,
      Math.max(120, pageWidth - MARGIN_X * 2 - sectionWidth - 22),
    );
    this.page.drawText(headerTitle, {
      x: MARGIN_X,
      y: pageHeight - 33,
      font: this.fonts.bold,
      size: 8.5,
      color: palette.blue,
    });
    this.page.drawText(sectionLabel, {
      x: pageWidth - MARGIN_X - sectionWidth,
      y: pageHeight - 33,
      font: this.fonts.regular,
      size: 8.2,
      color: palette.muted,
    });
  }

  private ensureSpace(height: number, nextSectionLabel = this.sectionLabel) {
    if (this.y - height >= PAGE_BOTTOM) return false;
    this.addPage(nextSectionLabel);
    return true;
  }

  paragraph(text: string, options: TextOptions = {}) {
    const font = options.font ?? this.fonts.regular;
    const size = options.size ?? 9;
    const lineHeight = options.lineHeight ?? 13.2;
    const color = options.color ?? palette.body;
    const width = options.width ?? CONTENT_WIDTH;
    const indent = options.indent ?? 0;
    const lines = wrapText(truncate(text), font, size, width - indent);
    for (const line of lines) {
      this.ensureSpace(lineHeight);
      this.page.drawText(line || " ", {
        x: MARGIN_X + indent,
        y: this.y - size,
        font,
        size,
        color,
      });
      this.y -= lineHeight;
    }
    return lines.length * lineHeight;
  }

  space(height: number) {
    this.ensureSpace(height);
    this.y -= height;
  }

  section(title: string, description?: string) {
    this.ensureSpace(260, title);
    this.sectionLabel = title;
    this.tocEntries.push({
      title,
      pageIndex: this.document.getPageCount() - 1,
    });
    this.space(10);
    this.page.drawRectangle({
      x: MARGIN_X,
      y: this.y - 25,
      width: 4,
      height: 25,
      color: palette.blue,
    });
    this.page.drawText(title, {
      x: MARGIN_X + 13,
      y: this.y - 18,
      font: this.fonts.bold,
      size: 15,
      color: palette.ink,
    });
    this.y -= 33;
    if (description) {
      this.paragraph(description, {
        size: 8.5,
        lineHeight: 12.5,
        color: palette.muted,
      });
      this.space(5);
    }
  }

  stageHeading(title: string) {
    this.ensureSpace(120, REPORT_OUTLINE[5]);
    this.paragraph(title, {
      font: this.fonts.bold,
      size: 11,
      lineHeight: 18,
      color: palette.blue,
    });
    this.space(2);
  }

  cover() {
    this.space(23);
    this.page.drawText("PERMIT RESULT REPORT", {
      x: MARGIN_X,
      y: this.y - 9,
      font: this.fonts.bold,
      size: 8.5,
      color: palette.teal,
    });
    this.y -= 35;
    const titleLines = wrapText(this.model.metadata.title, this.fonts.bold, 25, CONTENT_WIDTH);
    for (const line of titleLines) {
      this.page.drawText(line, {
        x: MARGIN_X,
        y: this.y - 25,
        font: this.fonts.bold,
        size: 25,
        color: palette.ink,
      });
      this.y -= 35;
    }
    this.space(4);
    this.paragraph(this.model.project.descriptor, {
      font: this.fonts.bold,
      size: 12,
      lineHeight: 18,
      color: palette.blue,
    });
    this.space(18);

    const info = [
      ["검토 기준일", this.model.metadata.assessmentDate],
      ["보고서 생성", this.model.metadata.generatedAtLabel],
      ["기간 시나리오", this.model.metadata.durationScenario],
      ["법령 검토 기준", this.model.metadata.lastLegalReviewAt],
    ];
    const cellWidth = (CONTENT_WIDTH - 10) / 2;
    info.forEach(([label, value], index) => {
      const row = Math.floor(index / 2);
      const column = index % 2;
      const x = MARGIN_X + column * (cellWidth + 10);
      const top = this.y - row * 54;
      this.page.drawRectangle({
        x,
        y: top - 46,
        width: cellWidth,
        height: 46,
        color: palette.panel,
        borderColor: palette.line,
        borderWidth: 0.6,
      });
      this.page.drawText(label, {
        x: x + 12,
        y: top - 16,
        font: this.fonts.regular,
        size: 7.7,
        color: palette.muted,
      });
      this.page.drawText(value, {
        x: x + 12,
        y: top - 34,
        font: this.fonts.bold,
        size: 10,
        color: palette.ink,
      });
    });
    this.y -= 118;

    const duration = this.model.summary.duration;
    const durationColor = duration.isTotal ? palette.blue : palette.amber;
    const durationSoft = duration.isTotal ? palette.blueSoft : palette.amberSoft;
    this.page.drawRectangle({
      x: MARGIN_X,
      y: this.y - 86,
      width: CONTENT_WIDTH,
      height: 86,
      color: durationSoft,
      borderColor: durationColor,
      borderWidth: 0.8,
    });
    this.page.drawText(duration.label, {
      x: MARGIN_X + 15,
      y: this.y - 22,
      font: this.fonts.bold,
      size: 9,
      color: durationColor,
    });
    this.page.drawText(duration.value, {
      x: MARGIN_X + 15,
      y: this.y - 49,
      font: this.fonts.bold,
      size: 20,
      color: palette.ink,
    });
    const durationDetail = wrapText(duration.detail, this.fonts.regular, 8, 270);
    durationDetail.slice(0, 3).forEach((line, index) => {
      this.page.drawText(line, {
        x: MARGIN_X + 225,
        y: this.y - 27 - index * 12,
        font: this.fonts.regular,
        size: 8,
        color: palette.body,
      });
    });
    this.y -= 103;

    const counts = [
      [
        "로드맵 포함",
        this.model.summary.counts.REQUIRED,
        palette.blue,
        palette.blueSoft,
        `확정 ${this.model.summary.roadmapBreakdown.confirmed} · 확인 전 포함 ${this.model.summary.roadmapBreakdown.scopeCheck} · 의제 ${this.model.summary.roadmapBreakdown.deemed}`,
      ],
      ["추가 확인", this.model.summary.counts.CONFIRM, palette.amber, palette.amberSoft, null],
      ["확인된 제외", this.model.summary.counts.NOT_REQUIRED, palette.teal, palette.tealSoft, null],
    ] as const;
    const countWidth = (CONTENT_WIDTH - 16) / 3;
    counts.forEach(([label, value, color, background, detail], index) => {
      const x = MARGIN_X + index * (countWidth + 8);
      this.page.drawRectangle({
        x,
        y: this.y - 55,
        width: countWidth,
        height: 55,
        color: background,
      });
      this.page.drawText(String(value), {
        x: x + 12,
        y: this.y - 31,
        font: this.fonts.bold,
        size: 18,
        color,
      });
      this.page.drawText(label, {
        x: x + 48,
        y: this.y - 28,
        font: this.fonts.bold,
        size: 8.4,
        color: palette.ink,
      });
      if (detail) {
        this.page.drawText(detail, {
          x: x + 12,
          y: this.y - 42,
          font: this.fonts.regular,
          size: 6.6,
          color: palette.body,
        });
      }
    });
    this.y -= 72;

    this.page.drawRectangle({
      x: MARGIN_X,
      y: this.y - 66,
      width: CONTENT_WIDTH,
      height: 66,
      color: palette.redSoft,
      borderColor: palette.red,
      borderWidth: 0.5,
    });
    this.y -= 12;
    const caution = "중요: 이 보고서는 입력값에 따른 사전 검토자료입니다. ‘확인된 일정 하한’은 총 소요기간이 아니며, 면제·의제·일괄처리는 각 법률의 요건과 시행일을 충족한 경우에만 적용됩니다.";
    const cautionLines = wrapText(caution, this.fonts.bold, 8.4, CONTENT_WIDTH - 24);
    cautionLines.slice(0, 4).forEach((line) => {
      this.page.drawText(line, {
        x: MARGIN_X + 12,
        y: this.y - 8,
        font: this.fonts.bold,
        size: 8.4,
        color: palette.red,
      });
      this.y -= 13;
    });
    this.y -= 16;
  }

  tableOfContents() {
    this.addPage("목차·활용 가이드");
    this.tocPage = this.page;
    this.page.drawText("목차", {
      x: MARGIN_X,
      y: 742,
      font: this.fonts.bold,
      size: 24,
      color: palette.ink,
    });
    this.page.drawText("결론부터 확인하고, 필요한 경우에만 상세 절차와 법령 근거로 내려가도록 구성했습니다.", {
      x: MARGIN_X,
      y: 714,
      font: this.fonts.regular,
      size: 9,
      color: palette.muted,
    });

    const guideTop = 216;
    const guideWidth = (CONTENT_WIDTH - 12) / 2;
    [
      {
        x: MARGIN_X,
        title: "빠르게 검토할 때",
        body: "1 전체 흐름 → 2 사업조건 → 3 우선 확인 → 4 일정 순서로 읽으면 판정 전제와 핵심 조치, 사업 영향 일정을 차례로 파악할 수 있습니다.",
        color: palette.blue,
        background: palette.blueSoft,
      },
      {
        x: MARGIN_X + guideWidth + 12,
        title: "근거까지 확인할 때",
        body: "2·5·6장에서 입력조건, 특례와 절차별 판정을 확인한 뒤 부록 A의 공식 법령 원문을 함께 검토합니다.",
        color: palette.teal,
        background: palette.tealSoft,
      },
    ].forEach((guide) => {
      this.page.drawRectangle({
        x: guide.x,
        y: guideTop - 110,
        width: guideWidth,
        height: 110,
        color: guide.background,
        borderColor: guide.color,
        borderWidth: 0.5,
      });
      this.page.drawText(guide.title, {
        x: guide.x + 14,
        y: guideTop - 25,
        font: this.fonts.bold,
        size: 10,
        color: guide.color,
      });
      limitedLines(guide.body, this.fonts.regular, 8.2, guideWidth - 28, 5)
        .forEach((line, index) => this.page.drawText(line, {
          x: guide.x + 14,
          y: guideTop - 48 - index * 12,
          font: this.fonts.regular,
          size: 8.2,
          color: palette.body,
        }));
    });
    this.y = PAGE_BOTTOM;
  }

  processFlowOverview() {
    const title = REPORT_OUTLINE[0];
    this.addPage(title, [A3_LANDSCAPE_WIDTH, A3_LANDSCAPE_HEIGHT]);
    this.tocEntries.push({
      title,
      pageIndex: this.document.getPageCount() - 1,
    });
    const page = this.page;
    const margin = 36;
    const contentWidth = A3_LANDSCAPE_WIDTH - margin * 2;

    page.drawText(title, {
      x: margin,
      y: 754,
      font: this.fonts.bold,
      size: 22,
      color: palette.ink,
    });
    page.drawText(this.model.project.descriptor, {
      x: margin,
      y: 731,
      font: this.fonts.bold,
      size: 9.5,
      color: palette.blue,
    });

    const duration = this.model.summary.duration;
    const durationWidth = 300;
    page.drawRectangle({
      x: A3_LANDSCAPE_WIDTH - margin - durationWidth,
      y: 714,
      width: durationWidth,
      height: 51,
      color: duration.isTotal ? palette.blueSoft : palette.amberSoft,
      borderColor: duration.isTotal ? palette.blue : palette.amber,
      borderWidth: 0.7,
    });
    page.drawText(duration.label, {
      x: A3_LANDSCAPE_WIDTH - margin - durationWidth + 13,
      y: 747,
      font: this.fonts.bold,
      size: 7.5,
      color: duration.isTotal ? palette.blue : palette.amber,
    });
    page.drawText(singleLineText(duration.value, this.fonts.bold, 13, durationWidth - 26), {
      x: A3_LANDSCAPE_WIDTH - margin - durationWidth + 13,
      y: 727,
      font: this.fonts.bold,
      size: 13,
      color: palette.ink,
    });

    const legendY = 688;
    [
      ["로드맵 포함", palette.blue, palette.blueSoft],
      ["추가 확인(건수)", palette.amber, palette.amberSoft],
      ["의제 반영", palette.teal, palette.tealSoft],
      ["W = 선행관계 진행군", palette.muted, palette.panel],
    ].forEach(([label, color, background], index) => {
      const x = margin + index * 146;
      page.drawRectangle({
        x,
        y: legendY - 16,
        width: 136,
        height: 18,
        color: background as RGB,
        borderColor: color as RGB,
        borderWidth: 0.45,
      });
      page.drawText(String(label), {
        x: x + 8,
        y: legendY - 10,
        font: this.fonts.bold,
        size: 6.8,
        color: color as RGB,
      });
    });

    const panelGapX = 14;
    const panelGapY = 14;
    const panelWidth = (contentWidth - panelGapX * 2) / 3;
    const panelHeight = 235;
    const panelTop = 646;
    const panelPositions = this.model.flow.stages.map((stage, index) => ({
      stage,
      index,
      row: Math.floor(index / 3),
      column: index < 3 ? index : 2 - (index % 3),
    }));

    const drawArrow = (fromX: number, fromY: number, toX: number, toY: number) => {
      page.drawLine({
        start: { x: fromX, y: fromY },
        end: { x: toX, y: toY },
        thickness: 1.4,
        color: palette.blue,
      });
      const deltaX = toX - fromX;
      const deltaY = toY - fromY;
      const length = Math.hypot(deltaX, deltaY) || 1;
      const unitX = deltaX / length;
      const unitY = deltaY / length;
      const perpendicularX = -unitY;
      const perpendicularY = unitX;
      page.drawLine({
        start: { x: toX, y: toY },
        end: {
          x: toX - unitX * 7 + perpendicularX * 4,
          y: toY - unitY * 7 + perpendicularY * 4,
        },
        thickness: 1.4,
        color: palette.blue,
      });
      page.drawLine({
        start: { x: toX, y: toY },
        end: {
          x: toX - unitX * 7 - perpendicularX * 4,
          y: toY - unitY * 7 - perpendicularY * 4,
        },
        thickness: 1.4,
        color: palette.blue,
      });
    };

    panelPositions.forEach(({ stage, index, column, row }) => {
      const x = margin + column * (panelWidth + panelGapX);
      const top = panelTop - row * (panelHeight + panelGapY);
      const panelY = top - panelHeight;
      const postOperation = stage.id === "POST_OPERATION";
      page.drawRectangle({
        x,
        y: panelY,
        width: panelWidth,
        height: panelHeight,
        color: postOperation ? palette.tealSoft : palette.panel,
        borderColor: postOperation ? palette.teal : palette.line,
        borderWidth: 0.7,
      });
      page.drawRectangle({
        x,
        y: top - 34,
        width: panelWidth,
        height: 34,
        color: postOperation ? palette.teal : palette.blue,
      });
      page.drawText(String(index + 1).padStart(2, "0"), {
        x: x + 12,
        y: top - 22,
        font: this.fonts.bold,
        size: 10,
        color: palette.white,
      });
      page.drawText(stage.title, {
        x: x + 42,
        y: top - 22,
        font: this.fonts.bold,
        size: 10,
        color: palette.white,
      });
      if (postOperation) {
        const note = "가동준비일 산정 밖";
        page.drawText(note, {
          x: x + panelWidth - 12 - this.fonts.bold.widthOfTextAtSize(note, 6.4),
          y: top - 21,
          font: this.fonts.bold,
          size: 6.4,
          color: palette.white,
        });
      }

      const required = stage.items.filter((item) => item.category === "REQUIRED");
      const confirm = stage.items.filter((item) => item.category === "CONFIRM");
      const cardTop = top - 44;
      const cardBottom = panelY + 34;
      const cardAreaHeight = cardTop - cardBottom;
      const layout = calculateFlowOverviewCardLayout(required.length, cardAreaHeight);
      const {
        visibleProcedureCount,
        omittedCount,
        columnCount,
        rowCount,
        cardGap,
        cardHeight,
      } = layout;
      const displayCards: Array<
        | { kind: "PROCEDURE"; item: (typeof required)[number] }
        | { kind: "OVERFLOW"; count: number }
      > = required
        .slice(0, visibleProcedureCount)
        .map((item) => ({ kind: "PROCEDURE" as const, item }));
      if (omittedCount > 0) {
        displayCards.push({ kind: "OVERFLOW", count: omittedCount });
      }
      const innerWidth = panelWidth - 20;
      const cardWidth = (innerWidth - cardGap * (columnCount - 1)) / columnCount;
      const nameSize = cardHeight < 23 ? 6.6 : 7.2;
      const showTiming = cardHeight >= 30;
      const nameLines = showTiming ? 1 : cardHeight < 25 ? 1 : 2;

      if (!required.length) {
        page.drawText("로드맵 포함 절차 없음", {
          x: x + 14,
          y: cardTop - 26,
          font: this.fonts.regular,
          size: 7.5,
          color: palette.muted,
        });
      }
      displayCards.forEach((card, itemIndex) => {
        const itemColumn = Math.floor(itemIndex / rowCount);
        const itemRow = itemIndex % rowCount;
        const cardX = x + 10 + itemColumn * (cardWidth + cardGap);
        const topY = cardTop - itemRow * (cardHeight + cardGap);
        const overflow = card.kind === "OVERFLOW";
        const item = card.kind === "PROCEDURE" ? card.item : null;
        const accent = overflow ? palette.amber : item?.isDeemed ? palette.teal : palette.blue;
        page.drawRectangle({
          x: cardX,
          y: topY - cardHeight,
          width: cardWidth,
          height: cardHeight,
          color: overflow ? palette.amberSoft : palette.white,
          borderColor: overflow ? palette.amber : palette.line,
          borderWidth: 0.4,
        });
        page.drawRectangle({
          x: cardX,
          y: topY - cardHeight,
          width: 3,
          height: cardHeight,
          color: accent,
        });
        if (overflow) {
          page.drawText("목록 계속", {
            x: cardX + 7,
            y: topY - 9,
            font: this.fonts.bold,
            size: 5.8,
            color: palette.amber,
          });
          page.drawText(singleLineText(`외 ${card.count}건 · 6장 참조`, this.fonts.bold, nameSize, cardWidth - 14), {
            x: cardX + 7,
            y: topY - 18,
            font: this.fonts.bold,
            size: nameSize,
            color: palette.ink,
          });
          return;
        }
        if (!item) return;
        const wave = item.wave === null ? "W-" : `W${String(item.wave + 1).padStart(2, "0")}`;
        page.drawText(`${wave}${item.isDeemed ? " · 의제" : ""}`, {
          x: cardX + 7,
          y: topY - 9,
          font: this.fonts.bold,
          size: 5.8,
          color: accent,
        });
        limitedLines(item.name, this.fonts.bold, nameSize, cardWidth - 14, nameLines)
          .forEach((line, lineIndex) => page.drawText(line, {
            x: cardX + 7,
            y: topY - 18 - lineIndex * 8.2,
            font: this.fonts.bold,
            size: nameSize,
            color: palette.ink,
          }));
        if (showTiming) {
          const source = item.timingSource === "USER_EXPECTED"
            ? "사용자예상 기반"
            : item.timingSource === "OFFICIAL"
              ? "공식기간 기반"
              : "공식 처리기간";
          const timing = `${source} · ${item.timing}`;
          page.drawText(singleLineText(timing, this.fonts.regular, 6.2, cardWidth - 14), {
            x: cardX + 7,
            y: topY - cardHeight + 6,
            font: this.fonts.regular,
            size: 6.2,
            color: palette.muted,
          });
        }
      });

      const confirmText = confirm.length
        ? `추가 확인 ${confirm.length}건 · 단계별 세부절차에서 확인`
        : "추가 확인 절차 없음";
      page.drawRectangle({
        x: x + 10,
        y: panelY + 9,
        width: panelWidth - 20,
        height: 19,
        color: confirm.length ? palette.amberSoft : palette.white,
        borderColor: confirm.length ? palette.amber : palette.line,
        borderWidth: 0.4,
      });
      page.drawText(singleLineText(confirmText, this.fonts.bold, 6.5, panelWidth - 34), {
        x: x + 17,
        y: panelY + 16,
        font: this.fonts.bold,
        size: 6.5,
        color: confirm.length ? palette.amber : palette.muted,
      });
    });

    const firstRowY = panelTop - panelHeight / 2;
    drawArrow(margin + panelWidth + 3, firstRowY, margin + panelWidth + panelGapX - 3, firstRowY);
    drawArrow(
      margin + (panelWidth + panelGapX) * 2 - panelGapX + 3,
      firstRowY,
      margin + (panelWidth + panelGapX) * 2 - 3,
      firstRowY,
    );
    const turnX = A3_LANDSCAPE_WIDTH - margin - 3;
    drawArrow(turnX, panelTop - panelHeight - 4, turnX, panelTop - panelHeight - panelGapY + 4);
    const secondRowY = panelTop - panelHeight - panelGapY - panelHeight / 2;
    drawArrow(
      margin + (panelWidth + panelGapX) * 2 - 3,
      secondRowY,
      margin + (panelWidth + panelGapX) * 2 - panelGapX + 3,
      secondRowY,
    );
    drawArrow(margin + panelWidth + panelGapX - 3, secondRowY, margin + panelWidth + 3, secondRowY);

    const relationTop = 152;
    page.drawRectangle({
      x: margin,
      y: 82,
      width: contentWidth,
      height: relationTop - 82,
      color: palette.white,
      borderColor: palette.line,
      borderWidth: 0.6,
    });
    page.drawText("핵심 선후행·병목 관계", {
      x: margin + 12,
      y: relationTop - 15,
      font: this.fonts.bold,
      size: 8.5,
      color: palette.ink,
    });
    page.drawText("현재 입력과 일정에서 활성화된 법정·실무 관계 중 핵심 10건 이내", {
      x: margin + 138,
      y: relationTop - 15,
      font: this.fonts.regular,
      size: 6.5,
      color: palette.muted,
    });
    const relationColumnGap = 18;
    const relationColumnWidth = (contentWidth - 24 - relationColumnGap) / 2;
    if (!this.model.flow.coreRelations.length) {
      page.drawText("표시할 활성 핵심 관계가 없습니다.", {
        x: margin + 12,
        y: relationTop - 38,
        font: this.fonts.regular,
        size: 7,
        color: palette.muted,
      });
    }
    this.model.flow.coreRelations.forEach((relation, index) => {
      const column = Math.floor(index / 5);
      const row = index % 5;
      const x = margin + 12 + column * (relationColumnWidth + relationColumnGap);
      const y = relationTop - 31 - row * 10.4;
      const badge = relation.bottleneck
        ? "병목"
        : relation.evidence.startsWith("법")
          ? "법정"
          : relation.evidence.startsWith("실무")
            ? "실무"
            : "관계";
      const accent = relation.bottleneck
        ? palette.red
        : badge === "법정"
          ? palette.blue
          : palette.amber;
      page.drawText(badge, {
        x,
        y,
        font: this.fonts.bold,
        size: 5.8,
        color: accent,
      });
      page.drawText(
        singleLineText(
          `${relation.from} → ${relation.to} · ${relation.relation}`,
          this.fonts.regular,
          7,
          relationColumnWidth - 34,
        ),
        {
          x: x + 29,
          y,
          font: this.fonts.regular,
          size: 7,
          color: palette.body,
        },
      );
    });

    const note = "읽는 방향: 위 행 01→02→03, 아래 행 04→05→06(오른쪽→왼쪽). 큰 화살표는 보고서 탐색 방향이고, 핵심 관계 표의 화살표가 실제 법정·실무 선후행입니다. ‘병목’은 현재 일정의 착수를 구속하는 후보이며 실제 보완·협의기간에 따라 달라질 수 있습니다. W는 선행관계를 반영한 진행군입니다. ‘외 N건’과 전체 판정 근거는 6장 세부절차를 확인하십시오.";
    limitedLines(note, this.fonts.regular, 6.8, contentWidth, 3)
      .forEach((line, index) => page.drawText(line, {
        x: margin,
        y: 70 - index * 9.6,
        font: this.fonts.regular,
        size: 6.8,
        color: palette.muted,
      }));
    this.y = PAGE_BOTTOM;
  }

  milestoneTable() {
    const columns = Math.min(4, Math.max(1, this.model.summary.milestones.length));
    const rows = Math.ceil(this.model.summary.milestones.length / columns);
    const width = CONTENT_WIDTH / columns;
    const cellHeight = 50;
    const height = rows * cellHeight;
    this.ensureSpace(height + 8);
    this.model.summary.milestones.forEach((milestone, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const x = MARGIN_X + column * width;
      const top = this.y - row * cellHeight;
      this.page.drawRectangle({
        x,
        y: top - cellHeight,
        width,
        height: cellHeight,
        color: index % 2 ? palette.white : palette.panel,
        borderColor: palette.line,
        borderWidth: 0.4,
      });
      this.page.drawText(singleLineText(milestone.label, this.fonts.regular, 7, width - 14), {
        x: x + 7,
        y: top - 15,
        font: this.fonts.regular,
        size: 7,
        color: palette.muted,
      });
      this.page.drawText(singleLineText(milestone.value, this.fonts.bold, 8.5, width - 14), {
        x: x + 7,
        y: top - 35,
        font: this.fonts.bold,
        size: 8.5,
        color: palette.ink,
      });
    });
    this.y -= height + 8;
  }

  keyValueGroup(title: string, items: Array<{ label: string; value: string; unknown?: boolean }>) {
    this.ensureSpace(145, REPORT_OUTLINE[1]);
    this.page.drawText(title, {
      x: MARGIN_X,
      y: this.y - 13,
      font: this.fonts.bold,
      size: 10.5,
      color: palette.blue,
    });
    this.y -= 24;
    items.forEach((item, index) => {
      const labelLines = wrapText(item.label, this.fonts.bold, 7.5, 142);
      const valueLines = wrapText(truncate(item.value, 600), this.fonts.regular, 8.3, CONTENT_WIDTH - 172);
      const rowHeight = Math.max(27, Math.max(labelLines.length * 11.5, valueLines.length * 12.2) + 10);
      this.ensureSpace(rowHeight, REPORT_OUTLINE[1]);
      if (index % 2 === 0) {
        this.page.drawRectangle({
          x: MARGIN_X,
          y: this.y - rowHeight,
          width: CONTENT_WIDTH,
          height: rowHeight,
          color: palette.panel,
        });
      }
      labelLines.forEach((line, lineIndex) => {
        this.page.drawText(line, {
          x: MARGIN_X + 8,
          y: this.y - 10 - lineIndex * 11.5,
          font: this.fonts.bold,
          size: 7.5,
          color: palette.muted,
        });
      });
      valueLines.forEach((line, lineIndex) => {
        this.page.drawText(line, {
          x: MARGIN_X + 166,
          y: this.y - 10 - lineIndex * 12.2,
          font: item.unknown ? this.fonts.bold : this.fonts.regular,
          size: 8.3,
          color: item.unknown ? palette.amber : palette.ink,
        });
      });
      this.y -= rowHeight;
    });
    this.space(12);
  }

  card({
    title,
    badge,
    rows,
    accent = palette.blue,
    background = palette.panel,
    link,
  }: {
    title: string;
    badge?: string;
    rows: CardRow[];
    accent?: RGB;
    background?: RGB;
    link?: { label: string; url: string };
  }) {
    const innerWidth = CONTENT_WIDTH - 32;
    const valueOffset = 88;
    const rowFontSize = 8.3;
    const rowLineHeight = 12.2;
    const titleWidth = badge ? innerWidth - 125 : innerWidth;
    const titleLines = wrapText(truncate(title, 180), this.fonts.bold, 11, titleWidth);
    const preparedRows = rows
      .filter((row) => cleanText(row.value))
      .map((row) => ({
        ...row,
        lines: wrapText(
          truncate(row.value),
          this.fonts.regular,
          rowFontSize,
          innerWidth - valueOffset,
        ),
      }));
    const height = Math.max(
      58,
      21 + titleLines.length * 15 + preparedRows.reduce(
        (sum, row) => sum + Math.max(20, row.lines.length * rowLineHeight + 6),
        0,
      ) + (link ? 24 : 8),
    );
    this.ensureSpace(height + 8);
    const cardTop = this.y;
    this.page.drawRectangle({
      x: MARGIN_X,
      y: cardTop - height,
      width: CONTENT_WIDTH,
      height,
      color: background,
      borderColor: palette.line,
      borderWidth: 0.55,
    });
    this.page.drawRectangle({
      x: MARGIN_X,
      y: cardTop - height,
      width: 4,
      height,
      color: accent,
    });
    let cursor = cardTop - 16;
    titleLines.forEach((line) => {
      this.page.drawText(line, {
        x: MARGIN_X + 16,
        y: cursor,
        font: this.fonts.bold,
        size: 11,
        color: palette.ink,
      });
      cursor -= 15;
    });
    if (badge) {
      const badgeText = truncate(badge, 36);
      const badgeWidth = Math.min(116, this.fonts.bold.widthOfTextAtSize(badgeText, 7.2) + 16);
      this.page.drawRectangle({
        x: A4_WIDTH - MARGIN_X - badgeWidth - 10,
        y: cardTop - 27,
        width: badgeWidth,
        height: 18,
        color: palette.white,
        borderColor: accent,
        borderWidth: 0.6,
      });
      this.page.drawText(badgeText, {
        x: A4_WIDTH - MARGIN_X - badgeWidth - 2,
        y: cardTop - 21,
        font: this.fonts.bold,
        size: 7.2,
        color: accent,
      });
    }
    cursor -= 5;
    preparedRows.forEach((row, rowIndex) => {
      const toneColor = row.tone === "warning"
        ? palette.amber
        : row.tone === "accent"
          ? palette.blue
          : palette.muted;
      if (rowIndex > 0) {
        this.page.drawLine({
          start: {
            x: MARGIN_X + 16,
            y: cursor + calculateCardRowSeparatorOffset(rowFontSize),
          },
          end: {
            x: MARGIN_X + CONTENT_WIDTH - 16,
            y: cursor + calculateCardRowSeparatorOffset(rowFontSize),
          },
          thickness: 0.35,
          color: palette.line,
        });
      }
      this.page.drawText(row.label, {
        x: MARGIN_X + 16,
        y: cursor,
        font: this.fonts.bold,
        size: 7.5,
        color: toneColor,
      });
      row.lines.forEach((line, index) => {
        this.page.drawText(line, {
          x: MARGIN_X + 16 + valueOffset,
          y: cursor - index * rowLineHeight,
          font: this.fonts.regular,
          size: rowFontSize,
          color: row.tone === "warning" ? palette.amber : palette.body,
        });
      });
      cursor -= Math.max(20, row.lines.length * rowLineHeight + 6);
    });
    if (link) {
      const label = cleanText(link.label);
      const textY = cardTop - height + 12;
      this.page.drawText(label, {
        x: MARGIN_X + 16,
        y: textY,
        font: this.fonts.bold,
        size: 7.5,
        color: palette.blue,
      });
      const width = this.fonts.bold.widthOfTextAtSize(label, 7.5);
      this.addLink(this.page, MARGIN_X + 16, textY - 2, width, 11, link.url);
    }
    this.y = cardTop - height - 8;
  }

  private addLink(page: PDFPage, x: number, y: number, width: number, height: number, url: string) {
    if (!/^https:\/\//i.test(url)) return;
    const annotation = this.document.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [x, y, x + width, y + height],
      Border: [0, 0, 0],
      A: {
        Type: "Action",
        S: "URI",
        URI: PDFHexString.fromText(url),
      },
    });
    page.node.addAnnot(this.document.context.register(annotation));
  }

  warningList(warnings: string[]) {
    if (!warnings.length) {
      this.paragraph("현재 입력에서 별도로 수록할 경고가 없습니다.", { color: palette.muted });
      return;
    }
    warnings.forEach((warning, index) => {
      const lines = wrapText(truncate(warning), this.fonts.regular, 8.2, CONTENT_WIDTH - 32);
      const rowHeight = Math.max(28, lines.length * 12 + 8);
      this.ensureSpace(rowHeight, REPORT_OUTLINE[2]);
      this.page.drawText(String(index + 1).padStart(2, "0"), {
        x: MARGIN_X,
        y: this.y - 10,
        font: this.fonts.bold,
        size: 8,
        color: palette.amber,
      });
      lines.forEach((line, lineIndex) => {
        this.page.drawText(line, {
          x: MARGIN_X + 30,
          y: this.y - 10 - lineIndex * 12,
          font: this.fonts.regular,
          size: 8.2,
          color: palette.body,
        });
      });
      this.y -= rowHeight;
    });
  }

  compactRows(
    rows: Array<{ primary: string; secondary: string; detail: string }>,
    sectionLabel: string,
  ) {
    const primaryWidth = 162;
    const secondaryWidth = 92;
    const detailWidth = CONTENT_WIDTH - primaryWidth - secondaryWidth - 28;
    const drawHeader = () => {
      this.ensureSpace(28, sectionLabel);
      this.page.drawRectangle({
        x: MARGIN_X,
        y: this.y - 24,
        width: CONTENT_WIDTH,
        height: 24,
        color: palette.blue,
      });
      [
        ["절차", MARGIN_X + 7],
        ["단계", MARGIN_X + primaryWidth],
        ["판정 사유", MARGIN_X + primaryWidth + secondaryWidth],
      ].forEach(([label, x]) => this.page.drawText(String(label), {
        x: Number(x),
        y: this.y - 15,
        font: this.fonts.bold,
        size: 7.3,
        color: palette.white,
      }));
      this.y -= 24;
    };
    drawHeader();
    rows.forEach((row, index) => {
      const primaryLines = wrapText(truncate(row.primary, 220), this.fonts.bold, 7.7, primaryWidth - 12);
      const secondaryLines = wrapText(truncate(row.secondary, 120), this.fonts.regular, 7.2, secondaryWidth - 10);
      const detailLines = wrapText(truncate(row.detail, 420), this.fonts.regular, 7.4, detailWidth);
      const rowHeight = Math.max(
        26,
        Math.max(primaryLines.length, secondaryLines.length, detailLines.length) * 11.2 + 10,
      );
      if (this.ensureSpace(rowHeight, sectionLabel)) drawHeader();
      if (index % 2 === 0) {
        this.page.drawRectangle({
          x: MARGIN_X,
          y: this.y - rowHeight,
          width: CONTENT_WIDTH,
          height: rowHeight,
          color: palette.panel,
        });
      }
      primaryLines.forEach((line, lineIndex) => this.page.drawText(line, {
        x: MARGIN_X + 7,
        y: this.y - 10 - lineIndex * 11.2,
        font: this.fonts.bold,
        size: 7.7,
        color: palette.ink,
      }));
      secondaryLines.forEach((line, lineIndex) => this.page.drawText(line, {
        x: MARGIN_X + primaryWidth,
        y: this.y - 10 - lineIndex * 11.2,
        font: this.fonts.regular,
        size: 7.2,
        color: palette.teal,
      }));
      detailLines.forEach((line, lineIndex) => this.page.drawText(line, {
        x: MARGIN_X + primaryWidth + secondaryWidth,
        y: this.y - 10 - lineIndex * 11.2,
        font: this.fonts.regular,
        size: 7.4,
        color: palette.body,
      }));
      this.y -= rowHeight;
    });
  }

  localOrdinanceCategory(
    category: PermitReportModel["localOrdinances"]["categories"][number],
  ) {
    const rows = [
      ...category.ordinances.map((ordinance) => ({
        name: ordinance.name,
        jurisdiction: `${ordinance.jurisdictionName} · ${ordinance.transitionNotice
          ? "종전 권역"
          : ordinance.level === "PROVINCE"
            ? "광역"
            : "기초"}`,
        date: ordinance.amendmentDate ?? "날짜 미수록",
        url: ordinance.url,
        fallback: false,
      })),
      ...category.fallbackLinks.map((link) => ({
        name: link.name,
        jurisdiction: "범주 미일치 · 직접 확인",
        date: "관할 목록",
        url: link.url,
        fallback: true,
      })),
    ];
    const nameWidth = 250;
    const jurisdictionWidth = 145;
    const dateWidth = 72;
    const linkWidth = CONTENT_WIDTH - nameWidth - jurisdictionWidth - dateWidth;
    const drawHeading = (continued = false) => {
      this.ensureSpace(82, REPORT_OUTLINE[6]);
      this.page.drawText(`${category.title}${continued ? " (계속)" : ""}`, {
        x: MARGIN_X,
        y: this.y - 11,
        font: this.fonts.bold,
        size: 10,
        color: palette.blue,
      });
      this.y -= 20;
      limitedLines(
        `영향 · ${category.affects} / 확인 · ${category.reviewPoint}`,
        this.fonts.regular,
        7.2,
        CONTENT_WIDTH,
        2,
      )
        .forEach((line, index) => this.page.drawText(line, {
          x: MARGIN_X,
          y: this.y - 7 - index * 9.5,
          font: this.fonts.regular,
          size: 7.2,
          color: palette.muted,
        }));
      this.y -= 25;
      this.page.drawRectangle({
        x: MARGIN_X,
        y: this.y - 20,
        width: CONTENT_WIDTH,
        height: 20,
        color: palette.blue,
      });
      [
        ["조례·목록", MARGIN_X + 6],
        ["관할·구분", MARGIN_X + nameWidth],
        ["개정일", MARGIN_X + nameWidth + jurisdictionWidth],
        ["링크", MARGIN_X + nameWidth + jurisdictionWidth + dateWidth],
      ].forEach(([label, x]) => this.page.drawText(String(label), {
        x: Number(x),
        y: this.y - 13,
        font: this.fonts.bold,
        size: 6.8,
        color: palette.white,
      }));
      this.y -= 20;
    };

    drawHeading();
    if (!rows.length) {
      this.paragraph("연결된 상세 조례 또는 관할 목록이 없습니다.", {
        size: 7.5,
        color: palette.muted,
      });
    }
    rows.forEach((row, index) => {
      const nameLines = limitedLines(row.name, this.fonts.bold, 7.2, nameWidth - 12, 2);
      const jurisdictionLines = limitedLines(
        row.jurisdiction,
        this.fonts.regular,
        6.8,
        jurisdictionWidth - 10,
        2,
      );
      const rowHeight = Math.max(24, Math.max(nameLines.length, jurisdictionLines.length) * 10.2 + 7);
      if (this.ensureSpace(rowHeight + 18, REPORT_OUTLINE[6])) drawHeading(true);
      if (index % 2 === 0) {
        this.page.drawRectangle({
          x: MARGIN_X,
          y: this.y - rowHeight,
          width: CONTENT_WIDTH,
          height: rowHeight,
          color: row.fallback ? palette.amberSoft : palette.panel,
        });
      }
      nameLines.forEach((line, lineIndex) => this.page.drawText(line, {
        x: MARGIN_X + 6,
        y: this.y - 10 - lineIndex * 10.2,
        font: this.fonts.bold,
        size: 7.2,
        color: row.fallback ? palette.amber : palette.ink,
      }));
      jurisdictionLines.forEach((line, lineIndex) => this.page.drawText(line, {
        x: MARGIN_X + nameWidth,
        y: this.y - 10 - lineIndex * 10.2,
        font: this.fonts.regular,
        size: 6.8,
        color: row.fallback ? palette.amber : palette.teal,
      }));
      this.page.drawText(singleLineText(row.date, this.fonts.regular, 6.7, dateWidth - 8), {
        x: MARGIN_X + nameWidth + jurisdictionWidth,
        y: this.y - 10,
        font: this.fonts.regular,
        size: 6.7,
        color: palette.body,
      });
      const linkLabel = "원문 ↗";
      const linkX = MARGIN_X + nameWidth + jurisdictionWidth + dateWidth;
      this.page.drawText(linkLabel, {
        x: linkX,
        y: this.y - 10,
        font: this.fonts.bold,
        size: 6.8,
        color: palette.blue,
      });
      this.addLink(
        this.page,
        linkX,
        this.y - 13,
        Math.min(linkWidth, this.fonts.bold.widthOfTextAtSize(linkLabel, 6.8)),
        10,
        row.url,
      );
      this.y -= rowHeight;
    });
    this.paragraph(`적용 한계 · ${category.limitation}`, {
      size: 6.8,
      lineHeight: 9.5,
      color: palette.muted,
    });
    this.space(7);
  }

  namesOnlyTable(names: string[], sectionLabel: string) {
    if (!names.length) {
      this.paragraph("현재 입력값에서 확인된 제외 절차가 없습니다.", {
        color: palette.muted,
      });
      return;
    }
    const numberWidth = 32;
    const halfWidth = CONTENT_WIDTH / 2;
    const nameWidth = halfWidth - numberWidth - 14;
    const drawHeader = () => {
      this.ensureSpace(28, sectionLabel);
      this.page.drawRectangle({
        x: MARGIN_X,
        y: this.y - 24,
        width: CONTENT_WIDTH,
        height: 24,
        color: palette.blue,
      });
      [0, 1].forEach((column) => {
        const x = MARGIN_X + column * halfWidth;
        this.page.drawText("번호", {
          x: x + 7,
          y: this.y - 15,
          font: this.fonts.bold,
          size: 7.2,
          color: palette.white,
        });
        this.page.drawText("절차명", {
          x: x + numberWidth,
          y: this.y - 15,
          font: this.fonts.bold,
          size: 7.2,
          color: palette.white,
        });
      });
      this.y -= 24;
    };

    drawHeader();
    for (let index = 0; index < names.length; index += 2) {
      const pair = names.slice(index, index + 2);
      const lineSets = pair.map((name) => wrapText(name, this.fonts.regular, 8, nameWidth));
      const rowHeight = Math.max(25, ...lineSets.map((lines) => lines.length * 11 + 9));
      if (this.ensureSpace(rowHeight, sectionLabel)) drawHeader();
      if ((index / 2) % 2 === 0) {
        this.page.drawRectangle({
          x: MARGIN_X,
          y: this.y - rowHeight,
          width: CONTENT_WIDTH,
          height: rowHeight,
          color: palette.panel,
        });
      }
      pair.forEach((name, column) => {
        const x = MARGIN_X + column * halfWidth;
        this.page.drawText(String(index + column + 1).padStart(2, "0"), {
          x: x + 7,
          y: this.y - 15,
          font: this.fonts.bold,
          size: 7.3,
          color: palette.teal,
        });
        lineSets[column].forEach((line, lineIndex) => this.page.drawText(line, {
          x: x + numberWidth,
          y: this.y - 14 - lineIndex * 11,
          font: this.fonts.regular,
          size: 8,
          color: palette.ink,
        }));
        if (column === 0) {
          this.page.drawLine({
            start: { x: x + halfWidth, y: this.y },
            end: { x: x + halfWidth, y: this.y - rowHeight },
            thickness: 0.35,
            color: palette.line,
          });
        }
      });
      this.y -= rowHeight;
    }
  }

  finish() {
    if (this.tocPage) {
      this.tocEntries.forEach((entry, index) => {
        const y = 666 - index * 43;
        const number = String(index + 1).padStart(2, "0");
        const pageNumber = String(entry.pageIndex + 1);
        this.tocPage?.drawText(number, {
          x: MARGIN_X,
          y,
          font: this.fonts.bold,
          size: 8,
          color: palette.blue,
        });
        this.tocPage?.drawText(entry.title, {
          x: MARGIN_X + 31,
          y: y - 1,
          font: this.fonts.bold,
          size: 9.3,
          color: palette.ink,
        });
        const pageNumberWidth = this.fonts.bold.widthOfTextAtSize(pageNumber, 8.5);
        this.tocPage?.drawText(pageNumber, {
          x: A4_WIDTH - MARGIN_X - pageNumberWidth,
          y,
          font: this.fonts.bold,
          size: 8.5,
          color: palette.blue,
        });
        this.tocPage?.drawLine({
          start: { x: MARGIN_X + 31, y: y - 11 },
          end: { x: A4_WIDTH - MARGIN_X, y: y - 11 },
          thickness: 0.35,
          color: palette.line,
        });
      });
    }

    const pages = this.document.getPages();
    pages.forEach((page, index) => {
      const pageWidth = page.getWidth();
      page.drawLine({
        start: { x: MARGIN_X, y: 37 },
        end: { x: pageWidth - MARGIN_X, y: 37 },
        thickness: 0.45,
        color: palette.line,
      });
      page.drawText(`카탈로그 ${this.model.metadata.catalogVersion} · 검토 기준일 ${this.model.metadata.assessmentDate}`, {
        x: MARGIN_X,
        y: 22,
        font: this.fonts.regular,
        size: 6.8,
        color: palette.muted,
      });
      const pageLabel = `${index + 1} / ${pages.length}`;
      page.drawText(pageLabel, {
        x: pageWidth - MARGIN_X - this.fonts.bold.widthOfTextAtSize(pageLabel, 7),
        y: 22,
        font: this.fonts.bold,
        size: 7,
        color: palette.ink,
      });
      if (pageWidth > A4_WIDTH + 1) {
        const formatLabel = "A3 가로 순서도";
        const right = pageWidth - MARGIN_X - this.fonts.bold.widthOfTextAtSize(pageLabel, 7) - 16;
        page.drawText(formatLabel, {
          x: right - this.fonts.regular.widthOfTextAtSize(formatLabel, 6.8),
          y: 22,
          font: this.fonts.regular,
          size: 6.8,
          color: palette.muted,
        });
      }
    });
  }
}

export async function renderPermitReportPdf(
  model: PermitReportModel,
  fonts: { regular: Uint8Array; bold: Uint8Array },
) {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const regular = await document.embedFont(Uint8Array.from(fonts.regular), { subset: true });
  const bold = await document.embedFont(Uint8Array.from(fonts.bold), { subset: true });
  document.setTitle(model.metadata.title);
  document.setSubject(`${model.project.descriptor} 인허가 판정·일정·법령 근거`);
  document.setAuthor("국내 공장 인허가 대시보드");
  document.setCreator("factory-permit-dashboard");
  document.setProducer("pdf-lib");
  document.setCreationDate(new Date(model.metadata.generatedAt));
  document.setModificationDate(new Date(model.metadata.generatedAt));

  const writer = new PermitPdfWriter(document, { regular, bold }, model);
  writer.cover();
  writer.tableOfContents();
  writer.processFlowOverview();

  writer.section(
    REPORT_OUTLINE[1],
    "화면에서 실제 판정에 사용한 현재 입력값입니다. ‘미확인’ 항목은 3장 우선 확인·조치사항과 연결됩니다.",
  );
  model.project.sections.forEach((section) => writer.keyValueGroup(section.title, section.items));

  writer.section(
    REPORT_OUTLINE[2],
    "미입력값과 경고 중 실제 판정·일정에 영향을 주는 항목을 앞에 배치했습니다. 영향 절차 수가 많은 항목부터 확인하십시오.",
  );
  if (!model.gaps.length) {
    writer.paragraph("현재 로드맵 포함·확인 절차에 연결된 미입력값이 없습니다.", {
      color: palette.teal,
      font: bold,
    });
  }
  model.gaps.forEach((gap) => writer.card({
    title: gap.input,
    badge: `${gap.affectedProcedures.length}개 절차 영향`,
    accent: palette.amber,
    background: palette.amberSoft,
    rows: [{ label: "영향 절차", value: gap.affectedProcedures.join(" · ") }],
  }));
  writer.warningList(model.warnings);

  writer.section(
    REPORT_OUTLINE[3],
    "공식 처리기간과 입력한 공사일을 결합한 결과입니다. 사용자 예상값은 공식값과 구분하고, 누락된 기간이 있으면 일정 하한으로만 표시합니다.",
  );
  writer.milestoneTable();
  writer.paragraph(model.summary.duration.detail, {
    font: bold,
    color: model.summary.duration.isTotal ? palette.blue : palette.amber,
  });
  writer.paragraph(`일정 포함범위 · ${model.metadata.scheduleScope}`, {
    size: 8.2,
    color: palette.muted,
  });

  writer.section(
    REPORT_OUTLINE[4],
    "면제, 의제, 일괄처리와 신속처리는 서로 다른 제도입니다. 시행일과 개별 요건을 충족한 상태만 현재 판정에 반영합니다.",
  );
  if (!model.specialLaws.length) {
    writer.paragraph("현재 입력에서 선택되거나 자동 확인된 특별법 특례가 없습니다.", {
      color: palette.muted,
    });
  }
  model.specialLaws.forEach((law) => {
    writer.card({
      title: law.title,
      badge: `${law.effect} · ${law.status}`,
      accent: law.isActive ? palette.teal : palette.amber,
      background: law.isActive ? palette.tealSoft : palette.amberSoft,
      rows: [
        { label: "법령", value: `${law.law} ${law.article}` },
        { label: "판정", value: law.note, tone: law.isActive ? "accent" : "warning" },
      ],
      link: { label: "공식 법령 원문 열기", url: law.officialUrl },
    });
  });

  writer.section(
    REPORT_OUTLINE[5],
    "로드맵 포함 절차와 추가 확인 절차를 단계·선행관계 순으로 정리했습니다. 법정·공식 기간과 프로젝트 일정 반영값은 별도 행으로 표시하며, 정확한 적용대상·관할·구비서류는 접수 전 관계기관에 확인해야 합니다.",
  );
  let currentStage = "";
  model.procedures.forEach((procedure) => {
    if (procedure.stage !== currentStage) {
      currentStage = procedure.stage;
      writer.stageHeading(currentStage);
    }
    const requiresConfirmation = procedure.category === "CONFIRM";
    writer.card({
      title: procedure.name,
      badge: procedure.categoryLabel,
      accent: requiresConfirmation ? palette.amber : palette.blue,
      background: requiresConfirmation ? palette.amberSoft : palette.panel,
      rows: [
        { label: "판정", value: `${procedure.status} · ${procedure.reason}`, tone: requiresConfirmation ? "warning" : "accent" },
        { label: "공식 기간", value: procedure.officialDuration, tone: "accent" },
        { label: "프로젝트 일정", value: `${procedure.schedule} · ${procedure.scheduleNote}` },
        { label: "접수/결정", value: `${procedure.authority} / ${procedure.decisionMaker}` },
        { label: "결과물", value: procedure.outcome },
        { label: "주요 서류", value: procedure.submissions },
        { label: "후속 의무", value: procedure.followUp },
        ...(procedure.missingInputs.length
          ? [{ label: "확인 입력", value: procedure.missingInputs.join(" · "), tone: "warning" as const }]
          : []),
        ...(procedure.specialLawEffects.length
          ? [{ label: "특례 영향", value: procedure.specialLawEffects.join(" / "), tone: "accent" as const }]
          : []),
        ...(procedure.legalReviewNote
          ? [{ label: "실무 확인", value: procedure.legalReviewNote, tone: "warning" as const }]
          : []),
        { label: "주요 근거", value: procedure.sourceSummaries.join(" · ") || "상세 근거 추가 확인" },
      ],
    });
  });

  writer.section(
    REPORT_OUTLINE[6],
    `선택 지역의 ELIS 검증 저장본(${model.localOrdinances.checkedAt.slice(0, 10)})과 관할 목록을 기준으로 확인할 조례를 정리했습니다. 상세 링크가 없는 범주는 관할 전체 목록 링크를 제공하며, 해당 조례가 존재하거나 사업에 적용된다는 뜻은 아닙니다.`,
  );
  if (!model.localOrdinances.categories.length) {
    writer.paragraph(model.localOrdinances.notice ?? "지역을 입력해야 조례 링크를 구성할 수 있습니다.", {
      color: palette.amber,
      font: bold,
    });
  }
  model.localOrdinances.transitionBasisLinks.forEach((basis) => writer.card({
    title: basis.name,
    badge: "권역별 경과 적용 확인",
    accent: palette.amber,
    background: palette.amberSoft,
    rows: [{ label: "주의", value: basis.note, tone: "warning" }],
    link: { label: "통합특별시 설치 특별법 경과조치 열기", url: basis.url },
  }));
  model.localOrdinances.categories.forEach((category) =>
    writer.localOrdinanceCategory(category),
  );

  writer.section(
    REPORT_OUTLINE[7],
    "보고서에 포함된 절차의 공식 근거입니다. 시행 예정 근거는 기준일 현재 미적용으로 별도 표시합니다.",
  );
  model.legalSources.forEach((source) => writer.card({
    title: `${source.title} ${source.locator}`,
    badge: source.effectiveStatus,
    accent: source.effectiveStatus.includes("미적용") ? palette.amber : palette.blue,
    rows: [
      { label: "발령기관", value: source.authority },
      { label: "시행일", value: source.effectiveDate ?? "수록 정보 없음" },
      { label: "근거 요약", value: source.summary },
    ],
    link: { label: "국가법령정보 등 공식 원문 열기", url: source.officialUrl },
  }));

  writer.section(
    REPORT_OUTLINE[8],
    "현재 입력에서 적용조건 불충족 또는 검토된 제외근거가 확인된 절차명만 간략히 수록합니다. 사업조건이 바뀌면 다시 판정해야 합니다.",
  );
  writer.namesOnlyTable(model.excluded, REPORT_OUTLINE[8]);

  writer.section(REPORT_OUTLINE[9]);
  writer.card({
    title: "보고서 사용 전 확인",
    accent: palette.red,
    background: palette.redSoft,
    rows: [{ label: "면책·범위", value: model.disclaimer, tone: "warning" }],
  });

  writer.finish();
  return document.save({ useObjectStreams: false });
}

let fontBytesPromise: Promise<{ regular: Uint8Array; bold: Uint8Array }> | null = null;

function reportAssetUrl(path: string) {
  const base = typeof document === "undefined" ? "http://localhost/" : document.baseURI;
  return new URL(path.replace(/^\//, ""), base).toString();
}

async function fetchFont(path: string) {
  const response = await fetch(reportAssetUrl(path));
  if (!response.ok) throw new Error(`보고서 글꼴을 불러오지 못했습니다. (${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}

async function loadReportFonts() {
  fontBytesPromise ??= Promise.all([
    fetchFont("fonts/nanum-gothic-coding/NanumGothicCoding-Regular.ttf"),
    fetchFont("fonts/nanum-gothic-coding/NanumGothicCoding-Bold.ttf"),
  ])
    .then(([regular, bold]) => ({ regular, bold }))
    .catch((error) => {
      fontBytesPromise = null;
      throw error;
    });
  return fontBytesPromise;
}

export async function generatePermitReportPdf(model: PermitReportModel) {
  return renderPermitReportPdf(model, await loadReportFonts());
}
