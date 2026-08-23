import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { VerificationLedger } from "@/app/components/dashboard/VerificationLedger";
import { catalog } from "@/lib/data/catalog";
import {
  buildVerificationLedger,
  verificationDimensions,
  verificationItemId,
  verificationLedgerSummary,
} from "@/lib/data/verification-ledger";

const ledger = buildVerificationLedger();

describe("verification ledger data", () => {
  it("creates one stable item per verification dimension for every procedure", () => {
    const secondBuild = buildVerificationLedger();
    const expectedCount = catalog.procedures.length * verificationDimensions.length;

    expect(ledger).toHaveLength(expectedCount);
    expect(new Set(ledger.map((item) => item.id))).toHaveProperty("size", expectedCount);
    expect(secondBuild.map((item) => item.id)).toEqual(ledger.map((item) => item.id));

    const buildingItems = ledger.filter((item) => item.procedureId === "building-permit");
    expect(buildingItems.map((item) => item.dimension)).toEqual(verificationDimensions);
    expect(buildingItems.map((item) => item.id)).toContain(
      verificationItemId("building-permit", "DURATION"),
    );
  });

  it("keeps evidence dimensions separate instead of treating one citation as full verification", () => {
    const buildingItems = ledger.filter((item) => item.procedureId === "building-permit");
    const byDimension = new Map(buildingItems.map((item) => [item.dimension, item]));

    expect(byDimension.get("DURATION")).toMatchObject({
      status: "VERIFIED",
      evidence: expect.arrayContaining([expect.objectContaining({ role: "DURATION" })]),
    });
    expect(byDimension.get("APPLICABILITY")?.status).toBe("NEEDS_CONFIRMATION");
    expect(byDimension.get("AUTHORITY")?.status).toBe("NEEDS_CONFIRMATION");
    expect(byDimension.get("SUBMISSIONS")?.status).toBe("NEEDS_CONFIRMATION");
  });

  it("explains that an unregistered dimension is not a legal non-applicability finding", () => {
    const unregistered = ledger.find((item) => item.status === "NOT_APPLICABLE");

    expect(unregistered).toBeDefined();
    expect(unregistered?.summary).toMatch(/법적 관계가 없다는 결론|법적으로 불필요하다는 결론/);
    const summary = verificationLedgerSummary(ledger);
    expect(summary.total).toBe(ledger.length);
    expect(
      summary.verified +
      summary.futureEffective +
      summary.needsConfirmation +
      summary.notApplicable,
    ).toBe(summary.total);
  });

  it("keeps the AI data center Act out of current verification before 2027-03-10", () => {
    const beforeEffective = buildVerificationLedger(catalog, "2026-08-22");
    const afterEffective = buildVerificationLedger(catalog, "2027-03-10");
    const itemId = verificationItemId("ai-data-center-business-report", "DURATION");
    const beforeDuration = beforeEffective.find((item) => item.id === itemId);
    const afterDuration = afterEffective.find((item) => item.id === itemId);

    expect(beforeDuration).toMatchObject({
      status: "FUTURE_EFFECTIVE",
      evidence: expect.arrayContaining([
        expect.objectContaining({
          effectiveDate: "2027-03-10",
          isFutureEffective: true,
        }),
      ]),
    });
    expect(verificationLedgerSummary(beforeEffective).futureEffective).toBeGreaterThan(0);
    expect(afterDuration).toMatchObject({
      status: "VERIFIED",
      evidence: expect.arrayContaining([
        expect.objectContaining({
          effectiveDate: "2027-03-10",
          isFutureEffective: false,
        }),
      ]),
    });
  });
});

describe("verification ledger UI", () => {
  const focusedItems = ledger.filter((item) =>
    ["building-permit", "ai-data-center-business-report"].includes(item.procedureId),
  );

  it("supports accessible search and filters without losing the status distinctions", () => {
    render(<VerificationLedger items={focusedItems} />);

    expect(
      screen.getByRole("heading", { name: "인허가별 확인 근거와 다음 검토사항" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("검증 대장 현황")).toHaveTextContent("수록 절차2개");

    fireEvent.change(screen.getByLabelText("검증 상태 필터"), {
      target: { value: "VERIFIED" },
    });
    const verifiedCount = focusedItems.filter((item) => item.status === "VERIFIED").length;
    expect(screen.getByText(new RegExp(`검색 결과 ${verifiedCount}건`))).toBeInTheDocument();
    expect(screen.queryByText("추가 확인 필요", { selector: "em" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("검증 차원 필터"), {
      target: { value: "DURATION" },
    });
    fireEvent.change(screen.getByRole("searchbox", { name: "검증 대장 검색" }), {
      target: { value: "building-permit-verification-duration" },
    });

    expect(screen.getByText(/검색 결과 1건/)).toBeInTheDocument();
    const card = screen.getByRole("article", { name: "건축허가·신고 경로 확인" });
    expect(within(card).getByText("공식 근거 연결")).toBeInTheDocument();
    const officialLink = within(card).getByRole("link", { name: /기간/ });
    expect(officialLink).toHaveAttribute("href", expect.stringMatching(/^https:\/\//));
    expect(officialLink).toHaveAttribute("target", "_blank");
  });

  it("shows and filters future-effective evidence as currently inapplicable", () => {
    render(
      <VerificationLedger
        assessmentDate="2026-08-22"
        procedureIds={["ai-data-center-business-report"]}
      />,
    );

    fireEvent.change(screen.getByLabelText("검증 상태 필터"), {
      target: { value: "FUTURE_EFFECTIVE" },
    });
    fireEvent.change(screen.getByLabelText("검증 차원 필터"), {
      target: { value: "DURATION" },
    });

    const card = screen.getByRole("article", { name: "AI 데이터센터 입지·운영 신고" });
    expect(within(card).getByText("시행 예정 · 현재 미적용")).toBeInTheDocument();
    expect(within(card).getByRole("link", {
      name: /시행 예정 2027-03-10 · 기준일 현재 미적용/,
    })).toBeInTheDocument();
    expect(screen.getByLabelText("검증 대장 현황")).toHaveTextContent(
      "시행 예정3현재 검증 제외",
    );
  });

  it("calls back with the stable procedure id from a filtered result", () => {
    const onSelectProcedure = vi.fn();
    render(
      <VerificationLedger
        items={focusedItems}
        procedureIds={["ai-data-center-business-report"]}
        onSelectProcedure={onSelectProcedure}
      />,
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "검증 대장 검색" }), {
      target: { value: "ai-data-center-business-report-verification-submissions" },
    });
    expect(screen.getByText(/검색 결과 1건/)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "AI 데이터센터 입지·운영 신고 절차 상세 보기" }),
    );
    expect(onSelectProcedure).toHaveBeenCalledWith("ai-data-center-business-report");
    expect(onSelectProcedure).toHaveBeenCalledTimes(1);
  });
});
