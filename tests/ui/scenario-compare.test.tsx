import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScenarioCompare } from "@/app/components/dashboard/ScenarioCompare";
import {
  isInputMatchedRoadmapInclusion,
  procedureCategoryForDecision,
  type ProcedureCategory,
} from "@/app/components/dashboard/constants";
import { catalog } from "@/lib/data/catalog";
import { evaluateProject } from "@/lib/engine/pipeline";
import { hasQuantifiedOfficialPeriod } from "@/lib/format-duration";

const durationById = new Map(
  catalog.durations.map((duration) => [duration.id, duration]),
);

function categoryCount(
  evaluation: ReturnType<typeof evaluateProject>,
  category: ProcedureCategory,
) {
  return evaluation.decisions.filter(
    (decision) => procedureCategoryForDecision(decision) === category,
  ).length;
}

function officialDurationUnknownCount(
  evaluation: ReturnType<typeof evaluateProject>,
) {
  return evaluation.decisions.filter((decision) => {
    const category = procedureCategoryForDecision(decision);
    const duration = decision.procedure.durationId
      ? durationById.get(decision.procedure.durationId)
      : null;
    return (
      category !== "NOT_REQUIRED" &&
      !decision.isDeemed &&
      !hasQuantifiedOfficialPeriod(duration)
    );
  }).length;
}

function comparisonRegion() {
  return screen.getByRole("region", {
    name: "현재 입력과 기준 시나리오 비교",
  });
}

function metricValue(label: string, index = 0) {
  const row = within(comparisonRegion()).getByRole("row", {
    name: new RegExp(`^${label}`),
  });
  return within(row).getAllByRole("cell")[index];
}

describe("scenario compare", () => {
  it("shows the current evaluation with explicit official-duration and lead rules", () => {
    const answers = catalog.scenarios[0].answers;
    const evaluation = evaluateProject(answers);
    render(<ScenarioCompare answers={answers} />);

    const region = comparisonRegion();
    expect(
      within(region).getByRole("group", {
        name: "비교할 기준 시나리오 선택",
      }),
    ).toBeInTheDocument();
    expect(
      within(region).getByRole("table", {
        name: "현재 입력과 선택한 기준 시나리오의 판정·공식 일정 비교",
      }),
    ).toBeInTheDocument();
    expect(metricValue("로드맵 포함")).toHaveTextContent(
      `${categoryCount(evaluation, "REQUIRED")}개`,
    );
    expect(metricValue("확인 필요")).toHaveTextContent(
      `${categoryCount(evaluation, "CONFIRM")}개`,
    );
    expect(metricValue("확인된 제외")).toHaveTextContent(
      `${categoryCount(evaluation, "NOT_REQUIRED")}개`,
    );
    expect(metricValue("의제 처리")).toHaveTextContent(
      `${evaluation.decisions.filter((decision) => decision.isDeemed).length}개`,
    );
    expect(metricValue("공식기간 미확인")).toHaveTextContent(
      `${officialDurationUnknownCount(evaluation)}개`,
    );

    const permitLead = evaluation.schedules.TYPICAL.projectTimeline
      ?.permitLeadCalendarDays;
    expect(metricValue("착공 전 인허가 리드")).toHaveTextContent(
      permitLead === null || permitLead === undefined
        ? permitLead === undefined
          ? "공사일정 미입력"
          : "산정 불가"
        : `${permitLead.toLocaleString("ko-KR")}일`,
    );
    expect(region).toHaveTextContent("임의값으로 보충하지 않습니다");
  });

  it("limits reference selection to two scenarios and exposes the limit accessibly", () => {
    render(<ScenarioCompare answers={catalog.scenarios[0].answers} />);
    const region = comparisonRegion();
    const first = within(region).getByRole("checkbox", {
      name: /산단 내 일반 제조업 신설/,
    });
    const second = within(region).getByRole("checkbox", {
      name: /산단 내 반도체 공장 증설/,
    });
    const third = within(region).getByRole("checkbox", {
      name: /비산단 이차전지 공장 신설/,
    });

    fireEvent.click(first);
    fireEvent.click(second);

    expect(first).toBeChecked();
    expect(second).toBeChecked();
    expect(third).toBeDisabled();
    expect(within(region).getByRole("status")).toHaveTextContent(
      "2개 선택됨 · 최대 2개",
    );
    expect(within(region).getAllByRole("columnheader")).toHaveLength(4);
    expect(
      within(region).getByRole("article", {
        name: "산단 내 일반 제조업 신설 절차 변화",
      }),
    ).toBeInTheDocument();
    expect(
      within(region).getByRole("article", {
        name: "산단 내 반도체 공장 증설 절차 변화",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(region).getByRole("button", { name: "비교 선택 해제" }),
    );
    expect(first).not.toBeChecked();
    expect(second).not.toBeChecked();
    expect(third).not.toBeDisabled();
    expect(within(region).getByRole("status")).toHaveTextContent(
      "0개 선택됨 · 최대 2개",
    );
  });

  it("separates added, roadmap-exit, and other status changes relative to current input", () => {
    const currentScenario = catalog.scenarios[0];
    const referenceScenario = catalog.scenarios[2];
    const current = evaluateProject(currentScenario.answers);
    const reference = evaluateProject(referenceScenario.answers);
    const expected = { added: 0, removed: 0, changed: 0 };

    for (const referenceDecision of reference.decisions) {
      const currentDecision = current.decisions.find(
        (decision) => decision.procedure.id === referenceDecision.procedure.id,
      );
      if (!currentDecision) continue;
      const from = procedureCategoryForDecision(currentDecision);
      const to = procedureCategoryForDecision(referenceDecision);
      const inputMatchedReviewChanged =
        isInputMatchedRoadmapInclusion(currentDecision) &&
        isInputMatchedRoadmapInclusion(referenceDecision) &&
        currentDecision.needsLegalReview !== referenceDecision.needsLegalReview;
      const comparisonStatusChanged =
        currentDecision.status !== referenceDecision.status ||
        currentDecision.isDeemed !== referenceDecision.isDeemed ||
        inputMatchedReviewChanged;
      if (from === to && !comparisonStatusChanged) continue;
      if (from !== "REQUIRED" && to === "REQUIRED") expected.added += 1;
      else if (from === "REQUIRED" && to !== "REQUIRED") expected.removed += 1;
      else expected.changed += 1;
    }

    render(<ScenarioCompare answers={currentScenario.answers} />);
    const region = comparisonRegion();
    fireEvent.click(
      within(region).getByRole("checkbox", {
        name: /비산단 이차전지 공장 신설/,
      }),
    );
    const article = within(region).getByRole("article", {
      name: "비산단 이차전지 공장 신설 절차 변화",
    });

    expect(within(article).getByText("추가되는 절차").closest("summary")).toHaveTextContent(
      String(expected.added),
    );
    expect(within(article).getByText("로드맵 포함에서 빠지는 절차").closest("summary")).toHaveTextContent(
      String(expected.removed),
    );
    expect(within(article).getByText("상태가 바뀌는 절차").closest("summary")).toHaveTextContent(
      String(expected.changed),
    );
    expect(expected.added + expected.removed + expected.changed).toBeGreaterThan(0);
  });

  it("does not fabricate a permit lead when construction dates are absent", () => {
    const noScheduleScenario = catalog.scenarios[3];
    render(<ScenarioCompare answers={noScheduleScenario.answers} />);

    expect(metricValue("착공 전 인허가 리드")).toHaveTextContent(
      "공사일정 미입력",
    );
    fireEvent.click(
      within(comparisonRegion()).getByRole("checkbox", {
        name: /자료 미확인 시나리오/,
      }),
    );
    expect(metricValue("착공 전 인허가 리드", 1)).toHaveTextContent(
      "공사일정 미입력",
    );
  });
});
