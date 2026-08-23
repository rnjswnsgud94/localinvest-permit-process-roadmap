"use client";

import { useEffect, useRef, useState } from "react";

import { buildPermitReportModel } from "@/app/components/dashboard/pdf/permit-report-model";
import type { ScenarioAnswers } from "@/lib/data/catalog";
import type { evaluateProject } from "@/lib/engine/pipeline";
import type { DurationScenario } from "@/lib/engine/schedule";

type PdfReportButtonProps = {
  answers: ScenarioAnswers;
  evaluation: ReturnType<typeof evaluateProject>;
  durationScenario: DurationScenario;
  includeConditional: boolean;
  includePractical: boolean;
};

export function PdfReportButton({
  answers,
  evaluation,
  durationScenario,
  includeConditional,
  includePractical,
}: PdfReportButtonProps) {
  const [status, setStatus] = useState<"IDLE" | "GENERATING" | "SUCCESS" | "ERROR">("IDLE");
  const [message, setMessage] = useState("");
  const resetTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
  }, []);

  async function downloadReport() {
    if (status === "GENERATING") return;
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    setStatus("GENERATING");
    setMessage("결과보고서를 만드는 중입니다.");
    try {
      const report = buildPermitReportModel({
        answers,
        evaluation,
        durationScenario,
        includeConditional,
        includePractical,
        generatedAt: new Date(),
      });
      const { generatePermitReportPdf } = await import(
        "@/app/components/dashboard/pdf/generate-permit-report-pdf"
      );
      const bytes = await generatePermitReportPdf(report);
      const blob = new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = report.metadata.filename;
      anchor.setAttribute("aria-hidden", "true");
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setStatus("SUCCESS");
      setMessage("현재 입력과 판정결과를 담은 PDF 보고서를 다운로드했습니다.");
      resetTimer.current = window.setTimeout(() => {
        setStatus("IDLE");
        setMessage("");
      }, 4_500);
    } catch (error) {
      console.error("PDF report generation failed", error);
      setStatus("ERROR");
      setMessage("PDF 보고서를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }

  return (
    <span className="pdf-report-action">
      <button
        type="button"
        className="pdf-report-button"
        disabled={status === "GENERATING"}
        aria-describedby={message ? "pdf-report-help pdf-report-status" : "pdf-report-help"}
        onClick={downloadReport}
      >
        <span aria-hidden="true">PDF</span>
        {status === "GENERATING" ? "보고서 생성 중" : "결과보고서 다운로드"}
      </button>
      <span id="pdf-report-help" className="sr-only">
        현재 입력값, 판정결과, 공식 처리기간, 일정, 핵심 병목, 특별법, 지역 조례와 법령 근거를 A4 세로 본문과 A3 가로 전체 순서도로 구성한 PDF로 다운로드합니다.
      </span>
      {message ? (
        <span
          id="pdf-report-status"
          className="pdf-report-status is-visible"
          role={status === "ERROR" ? "alert" : "status"}
          aria-live={status === "ERROR" ? "assertive" : "polite"}
        >
          {message}
        </span>
      ) : null}
    </span>
  );
}
