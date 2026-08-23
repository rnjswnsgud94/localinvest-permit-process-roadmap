import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PdfReportButton } from "@/app/components/dashboard/PdfReportButton";
import { catalog } from "@/lib/data/catalog";
import { evaluateProject } from "@/lib/engine/pipeline";

const pdfMocks = vi.hoisted(() => ({
  generatePermitReportPdf: vi.fn(),
}));

vi.mock("@/app/components/dashboard/pdf/generate-permit-report-pdf", () => ({
  generatePermitReportPdf: pdfMocks.generatePermitReportPdf,
}));

const originalCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const originalRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");

beforeEach(() => {
  pdfMocks.generatePermitReportPdf.mockReset();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:permit-report"),
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

describe("PDF report download", () => {
  it("downloads the current evaluation as a dated result report", async () => {
    pdfMocks.generatePermitReportPdf.mockResolvedValue(
      new Uint8Array([37, 80, 68, 70, 45]),
    );
    const answers = catalog.scenarios[0].answers;
    const evaluation = evaluateProject(answers);
    render(
      <PdfReportButton
        answers={answers}
        evaluation={evaluation}
        durationScenario="TYPICAL"
        includeConditional
        includePractical
      />,
    );

    const button = screen.getByRole("button", { name: "결과보고서 다운로드" });
    expect(button).toHaveAccessibleDescription(/현재 입력값.*공식 처리기간.*A4 세로 본문.*A3 가로 전체 순서도/);
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("만드는 중");

    await waitFor(() => expect(pdfMocks.generatePermitReportPdf).toHaveBeenCalledTimes(1));
    const report = pdfMocks.generatePermitReportPdf.mock.calls[0][0];
    expect(report.project.descriptor).toContain("충청북도 청주시");
    expect(report.summary.counts.REQUIRED).toBeGreaterThan(0);
    expect(report.metadata.durationScenario).toBe("공식 기준");
    expect(report.metadata.scheduleScope).toBe("대상 확인 절차 포함 · 실무 선행관계 포함");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("다운로드했습니다"));

    const clickedAnchor = (HTMLAnchorElement.prototype.click as ReturnType<typeof vi.fn>).mock.instances[0] as HTMLAnchorElement;
    expect(clickedAnchor.download).toMatch(/^지방투자기업-인허가-검토보고서-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(clickedAnchor.href).toBe("blob:permit-report");
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  });

  it("announces a generation failure without starting a download", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    pdfMocks.generatePermitReportPdf.mockRejectedValue(new Error("font unavailable"));
    const answers = catalog.scenarios[3].answers;
    render(
      <PdfReportButton
        answers={answers}
        evaluation={evaluateProject(answers)}
        durationScenario="TYPICAL"
        includeConditional
        includePractical
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "결과보고서 다운로드" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("PDF 보고서를 만들지 못했습니다");
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });
});
