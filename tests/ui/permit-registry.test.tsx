import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PermitRegistry } from "@/app/components/dashboard/PermitRegistry";
import { compareProcedures } from "@/app/components/dashboard/constants";
import { catalog } from "@/lib/data/catalog";

function renderRegistry(assessmentDate?: string) {
  const onSelectProcedure = vi.fn();
  render(
    <PermitRegistry
      onSelectProcedure={onSelectProcedure}
      assessmentDate={assessmentDate}
    />,
  );
  return onSelectProcedure;
}

describe("permit registry", () => {
  it("exposes every catalog procedure through an accessible result list", () => {
    renderRegistry();

    expect(screen.getByRole("heading", { name: "인허가 통합검색" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      `전체 ${catalog.procedures.length}개 중 ${catalog.procedures.length}개 절차`,
    );
    expect(screen.getByRole("list", {
      name: new RegExp(`전체 ${catalog.procedures.length}개 중 ${catalog.procedures.length}개 절차`),
    }))
      .toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /상세 보기$/ })).toHaveLength(
      catalog.procedures.length,
    );
  });

  it("sorts the encyclopedia by name, roadmap stage, or practical priority without changing its entries", () => {
    renderRegistry();
    const resultNames = () => screen.getAllByRole("button", { name: /상세 보기$/ })
      .map((button) => button.getAttribute("aria-label")!.replace(/ 상세 보기$/, ""));
    const expectedNames = (mode: "NAME" | "STAGE" | "PRIORITY") => [...catalog.procedures]
      .sort((left, right) => compareProcedures(left, right, mode))
      .map((procedure) => procedure.name);
    const sort = screen.getByRole("combobox", { name: "전체 인허가 정렬" });

    expect(sort).toHaveValue("NAME");
    expect(resultNames()).toEqual(expectedNames("NAME"));
    expect(screen.getByRole("status")).toHaveTextContent("가나다순");

    fireEvent.change(sort, { target: { value: "STAGE" } });
    expect(resultNames()).toEqual(expectedNames("STAGE"));
    expect(screen.getByRole("status")).toHaveTextContent("일정 단계순");

    fireEvent.change(sort, { target: { value: "PRIORITY" } });
    expect(resultNames()).toEqual(expectedNames("PRIORITY"));
    expect(screen.getByRole("status")).toHaveTextContent("실무 중요도순");

    fireEvent.change(screen.getByRole("searchbox", { name: "법령·기관·서류 통합검색" }), {
      target: { value: "교통영향평가" },
    });
    fireEvent.click(screen.getByRole("button", { name: "필터 초기화" }));
    expect(sort).toHaveValue("PRIORITY");
    expect(resultNames()).toEqual(expectedNames("PRIORITY"));
  });

  it("labels practical priority as a scheduling aid rather than a legal hierarchy", () => {
    renderRegistry();

    expect(screen.getByText(/법적 효력이나 적용 여부의 우열을 뜻하지 않습니다/))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "공장설립·증설·업종변경 승인 상세 보기" }))
      .toHaveTextContent("P0 · 핵심 게이트");
  });

  it("searches aliases, law titles, authorities, submissions and outcomes", () => {
    renderRegistry();
    const search = screen.getByRole("searchbox", { name: "법령·기관·서류 통합검색" });

    fireEvent.change(search, { target: { value: "도시교통정비 촉진법 교통개선대책" } });
    expect(screen.getByRole("button", { name: "교통영향평가 상세 보기" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1개 절차");

    fireEvent.change(search, { target: { value: "계통영향평가" } });
    expect(screen.getByRole("button", { name: "전력계통영향평가 상세 보기" })).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "건축허가서 관할 허가권자" } });
    expect(screen.getByRole("button", { name: "건축허가·신고 경로 확인 상세 보기" }))
      .toBeInTheDocument();
  });

  it("combines domain, verification and official-duration filters without inventing a period", () => {
    renderRegistry();

    fireEvent.change(screen.getByRole("combobox", { name: "기간 상태" }), {
      target: { value: "NO_NATIONWIDE_TOTAL" },
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      `전체 ${catalog.procedures.length}개 중 40개 절차`,
    );
    expect(screen.queryByRole("button", { name: "AI 데이터센터 인허가 일괄처리 결과 상세 보기" }))
      .not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "기간 상태" }), {
      target: { value: "FUTURE_EFFECTIVE" },
    });
    expect(screen.getByRole("button", { name: "AI 데이터센터 인허가 일괄처리 결과 상세 보기" }))
      .toHaveTextContent("시행 예정 2027-03-10 · 기준일 현재 미적용");
    expect(screen.getByRole("button", { name: "AI 데이터센터 인허가 일괄처리 결과 상세 보기" }))
      .toHaveTextContent("인공지능 데이터센터 산업 진흥에 관한 특별법 (시행 예정 2027-03-10 · 기준일 현재 미적용)");

    fireEvent.change(screen.getByRole("combobox", { name: "분야" }), {
      target: { value: "AI 데이터센터" },
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      `전체 ${catalog.procedures.length}개 중 3개 절차`,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "자료 검토 상태" }), {
      target: { value: "INTERNAL_REVIEWED" },
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      `전체 ${catalog.procedures.length}개 중 3개 절차`,
    );
  });

  it("treats the AI data center Act period as current only on and after its effective date", () => {
    renderRegistry("2027-03-10");

    fireEvent.change(screen.getByRole("combobox", { name: "기간 상태" }), {
      target: { value: "NO_NATIONWIDE_TOTAL" },
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      `전체 ${catalog.procedures.length}개 중 43개 절차`,
    );
    const result = screen.getByRole("button", {
      name: "AI 데이터센터 인허가 일괄처리 결과 상세 보기",
    });
    expect(result).toHaveTextContent("전국 공통 법정 총기간 미규정");
    expect(result).not.toHaveTextContent("기준일 현재 미적용");
  });

  it("calls the result callback and supports keyboard-friendly clearing", () => {
    const onSelectProcedure = renderRegistry();
    const search = screen.getByRole("searchbox", { name: "법령·기관·서류 통합검색" });
    fireEvent.change(search, { target: { value: "교통영향평가" } });

    fireEvent.click(screen.getByRole("button", { name: "교통영향평가 상세 보기" }));
    expect(onSelectProcedure).toHaveBeenCalledWith("traffic-impact-assessment");

    fireEvent.keyDown(search, { key: "Escape" });
    expect(search).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent(
      `전체 ${catalog.procedures.length}개 중 ${catalog.procedures.length}개 절차`,
    );

    const clearButton = screen.getByRole("button", { name: "검색어 지우기" });
    expect(clearButton).toBeDisabled();
    expect(within(screen.getByRole("search", { name: "전체 인허가 검색" }))
      .getByText(/여러 단어를 입력하면/)).toBeInTheDocument();
  });
});
