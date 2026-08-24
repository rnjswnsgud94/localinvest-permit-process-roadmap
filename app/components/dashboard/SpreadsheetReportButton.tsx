"use client";

import { useEffect, useRef, useState } from "react";

import { buildPermitReportModel } from "@/app/components/dashboard/pdf/permit-report-model";
import type { ScenarioAnswers } from "@/lib/data/catalog";
import type { evaluateProject } from "@/lib/engine/pipeline";
import type { DurationScenario } from "@/lib/engine/schedule";

type SpreadsheetReportButtonProps = {
  answers: ScenarioAnswers;
  evaluation: ReturnType<typeof evaluateProject>;
  durationScenario: DurationScenario;
  includeConditional: boolean;
  includePractical: boolean;
};

export function SpreadsheetReportButton({
  answers,
  evaluation,
  durationScenario,
  includeConditional,
  includePractical,
}: SpreadsheetReportButtonProps) {
  const [status, setStatus] = useState<"IDLE" | "GENERATING" | "SUCCESS" | "ERROR">("IDLE");
  const [message, setMessage] = useState("");
  const resetTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
  }, []);

  async function downloadSpreadsheet() {
    if (status === "GENERATING") return;
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    setStatus("GENERATING");
    setMessage("실무 관리용 스프레드시트를 만드는 중입니다.");

    try {
      const report = buildPermitReportModel({
        answers,
        evaluation,
        durationScenario,
        includeConditional,
        includePractical,
        generatedAt: new Date(),
      });
      const {
        generatePermitReportWorkbook,
        spreadsheetFilename,
      } = await import(
        "@/app/components/dashboard/spreadsheet/generate-permit-report-workbook"
      );
      const bytes = await generatePermitReportWorkbook(report);
      const blob = new Blob([Uint8Array.from(bytes)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = spreadsheetFilename(report);
      anchor.setAttribute("aria-hidden", "true");
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setStatus("SUCCESS");
      setMessage("현재 입력과 판정결과를 담은 XLSX 실무 관리표를 다운로드했습니다.");
      resetTimer.current = window.setTimeout(() => {
        setStatus("IDLE");
        setMessage("");
      }, 4_500);
    } catch (error) {
      console.error("Spreadsheet report generation failed", error);
      setStatus("ERROR");
      setMessage("스프레드시트를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }

  return (
    <span className="spreadsheet-report-action">
      <button
        type="button"
        className="spreadsheet-report-button"
        disabled={status === "GENERATING"}
        aria-describedby={message ? "spreadsheet-report-help spreadsheet-report-status" : "spreadsheet-report-help"}
        onClick={downloadSpreadsheet}
      >
        <span aria-hidden="true">XLSX</span>
        {status === "GENERATING" ? "관리표 생성 중" : "스프레드시트 다운로드"}
      </button>
      <span id="spreadsheet-report-help" className="sr-only">
        현재 입력값과 판정결과를 진행상태·담당자·내부 목표일을 직접 관리할 수 있는 실무 관리표, 사업조건, 선후행 관계, 특별법·지역 조례와 공식 근거 시트로 구성한 XLSX 파일로 다운로드합니다.
      </span>
      {message ? (
        <span
          id="spreadsheet-report-status"
          className="spreadsheet-report-status is-visible"
          role={status === "ERROR" ? "alert" : "status"}
          aria-live={status === "ERROR" ? "assertive" : "polite"}
        >
          {message}
        </span>
      ) : null}
    </span>
  );
}
