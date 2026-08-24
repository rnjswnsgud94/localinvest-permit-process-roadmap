import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SpreadsheetReportButton } from "@/app/components/dashboard/SpreadsheetReportButton";
import { catalog } from "@/lib/data/catalog";
import { evaluateProject } from "@/lib/engine/pipeline";

const spreadsheetMocks = vi.hoisted(() => ({
  generatePermitReportWorkbook: vi.fn(),
  spreadsheetFilename: vi.fn(() => "인허가-실무관리표_테스트_20260824-130506.xlsx"),
}));

vi.mock("@/app/components/dashboard/spreadsheet/generate-permit-report-workbook", () => ({
  generatePermitReportWorkbook: spreadsheetMocks.generatePermitReportWorkbook,
  spreadsheetFilename: spreadsheetMocks.spreadsheetFilename,
}));

const originalCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const originalRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");

beforeEach(() => {
  spreadsheetMocks.generatePermitReportWorkbook.mockReset();
  spreadsheetMocks.spreadsheetFilename.mockClear();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:permit-spreadsheet"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
});

afterEach(() => {
  if (originalCreateObjectUrl) Object.defineProperty(URL, "createObjectURL", originalCreateObjectUrl);
  else delete (URL as Partial<typeof URL>).createObjectURL;
  if (originalRevokeObjectUrl) Object.defineProperty(URL, "revokeObjectURL", originalRevokeObjectUrl);
  else delete (URL as Partial<typeof URL>).revokeObjectURL;
  vi.restoreAllMocks();
});

describe("spreadsheet report download", () => {
  it("downloads the current evaluation as an XLSX practical workbook", async () => {
    spreadsheetMocks.generatePermitReportWorkbook.mockResolvedValue(
      new Uint8Array([80, 75, 3, 4]),
    );
    const answers = catalog.scenarios[0].answers;
    render(
      <SpreadsheetReportButton
        answers={answers}
        evaluation={evaluateProject(answers)}
        durationScenario="TYPICAL"
        includeConditional
        includePractical
      />,
    );

    const button = screen.getByRole("button", { name: "스프레드시트 다운로드" });
    expect(button).toHaveAccessibleDescription(/진행상태.*담당자.*사업조건.*공식 근거.*XLSX/);
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("만드는 중");

    await waitFor(() => expect(spreadsheetMocks.generatePermitReportWorkbook).toHaveBeenCalledTimes(1));
    const report = spreadsheetMocks.generatePermitReportWorkbook.mock.calls[0][0];
    expect(report.project.descriptor).toContain("충청북도 청주시");
    expect(report.procedures.length).toBeGreaterThan(0);
    expect(spreadsheetMocks.spreadsheetFilename).toHaveBeenCalledWith(report);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("다운로드했습니다"));

    const clickedAnchor = (HTMLAnchorElement.prototype.click as ReturnType<typeof vi.fn>).mock.instances[0] as HTMLAnchorElement;
    expect(clickedAnchor.download).toBe("인허가-실무관리표_테스트_20260824-130506.xlsx");
    expect(clickedAnchor.href).toBe("blob:permit-spreadsheet");
    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  });

  it("announces a generation failure without starting a download", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    spreadsheetMocks.generatePermitReportWorkbook.mockRejectedValue(new Error("workbook unavailable"));
    const answers = catalog.scenarios[3].answers;
    render(
      <SpreadsheetReportButton
        answers={answers}
        evaluation={evaluateProject(answers)}
        durationScenario="TYPICAL"
        includeConditional
        includePractical
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "스프레드시트 다운로드" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("스프레드시트를 만들지 못했습니다");
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });
});
