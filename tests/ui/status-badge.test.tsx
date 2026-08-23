import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "@/app/components/dashboard/StatusBadge";

describe("StatusBadge", () => {
  it("uses a generic deeming label instead of calling every parent an one-stop process", () => {
    render(<StatusBadge status="DOES_NOT_APPLY" isDeemed />);

    expect(screen.getByText("상위 절차에서 의제 처리")).toBeInTheDocument();
    expect(screen.queryByText("일괄처리로 충족")).not.toBeInTheDocument();
  });

  it("separates an input-matched roadmap inclusion from a real information gap", () => {
    const { rerender } = render(
      <StatusBadge
        status="POSSIBLY_APPLIES"
        provisionalEffect="INCLUDE"
        missingInputs={[]}
        conflictRuleIds={[]}
        needsLegalReview
      />,
    );

    expect(screen.getByText("로드맵 포함")).toBeInTheDocument();
    expect(screen.queryByText(/근거 검토/)).not.toBeInTheDocument();
    expect(screen.queryByText("대상 여부 확인 필요")).not.toBeInTheDocument();

    rerender(
      <StatusBadge
        status="NEEDS_MORE_INFO"
        provisionalEffect={null}
        missingInputs={["site.landCategory"]}
        conflictRuleIds={[]}
        needsLegalReview
      />,
    );
    expect(screen.getByText("추가 입력 필요")).toBeInTheDocument();
  });

  it("keeps a draft exclusion visibly provisional", () => {
    render(
      <StatusBadge
        status="POSSIBLY_APPLIES"
        provisionalEffect="EXCLUDE"
        missingInputs={[]}
        conflictRuleIds={[]}
        needsLegalReview
      />,
    );

    expect(screen.getByText("잠정 제외 · 근거 확인")).toBeInTheDocument();
  });
});
