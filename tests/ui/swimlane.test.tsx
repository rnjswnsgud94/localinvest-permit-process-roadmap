import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  denseProcedureColumnThreshold,
  orthogonalConnectorPath,
  Swimlane,
} from "@/app/components/dashboard/Swimlane";
import { createObstacleAvoidingConnectorRouter } from "@/app/components/dashboard/connector-routing";
import { catalog } from "@/lib/data/catalog";
import { evaluateProject } from "@/lib/engine/pipeline";
import type { ProcedureDecision } from "@/lib/engine/rule-engine";
import type { ScheduleResult } from "@/lib/engine/schedule";

function denseFixture(count: number): {
  decisions: ProcedureDecision[];
  schedule: ScheduleResult;
} {
  const evaluated = evaluateProject(catalog.scenarios[0].answers);
  const source = evaluated.decisions.slice(0, count);
  const fixtureLanes = [
    "CITY_COUNTY_DISTRICT",
    "ENVIRONMENT_SAFETY_FIRE_UTILITY",
  ] as const;
  const decisions = source.map((decision, index) => ({
    ...decision,
    procedure: { ...decision.procedure, lane: fixtureLanes[index % 2] },
  }));
  const ids = decisions.map((decision) => decision.procedure.id);
  return {
    decisions,
    schedule: {
      scenario: "TYPICAL",
      unit: "BUSINESS_DAY",
      total: count,
      complete: true,
      nodes: ids.map((procedureId, index) => ({
        procedureId,
        earliestStart: 0,
        earliestFinish: index + 1,
        latestStart: 0,
        latestFinish: index + 1,
        slack: 0,
        duration: 1,
        critical: false,
        wave: 0,
        parallel: true,
      })),
      topologicalOrder: ids,
      activeEdgeIds: [],
      criticalEdgeIds: [],
      criticalProcedureIds: [],
      unknownDurationProcedureIds: [],
      completedCheckpoints: [],
      planningDurations: [],
      warnings: [],
      projectTimeline: null,
    },
  };
}

function svgPathPoints(path: string) {
  const tokens = path.split(/\s+/);
  const points: Array<{ x: number; y: number }> = [];
  let x = 0;
  let y = 0;
  for (let index = 0; index < tokens.length;) {
    const command = tokens[index];
    if (command === "M") {
      x = Number(tokens[index + 1]);
      y = Number(tokens[index + 2]);
      index += 3;
    } else if (command === "H") {
      x = Number(tokens[index + 1]);
      index += 2;
    } else if (command === "V") {
      y = Number(tokens[index + 1]);
      index += 2;
    } else {
      throw new Error(`지원하지 않는 SVG 경로 명령: ${command}`);
    }
    points.push({ x, y });
  }
  return points;
}

function crossesRect(
  from: { x: number; y: number },
  to: { x: number; y: number },
  rect: { top: number; right: number; bottom: number; left: number },
) {
  if (from.y === to.y) {
    return from.y > rect.top && from.y < rect.bottom
      && Math.min(from.x, to.x) < rect.right
      && Math.max(from.x, to.x) > rect.left;
  }
  return from.x > rect.left && from.x < rect.right
    && Math.min(from.y, to.y) < rect.bottom
    && Math.max(from.y, to.y) > rect.top;
}

function collinearOverlapLength(
  left: ReturnType<typeof svgPathPoints>,
  right: ReturnType<typeof svgPathPoints>,
) {
  let overlap = 0;
  for (let leftIndex = 1; leftIndex < left.length; leftIndex += 1) {
    const leftFrom = left[leftIndex - 1];
    const leftTo = left[leftIndex];
    for (let rightIndex = 1; rightIndex < right.length; rightIndex += 1) {
      const rightFrom = right[rightIndex - 1];
      const rightTo = right[rightIndex];
      if (leftFrom.y === leftTo.y && rightFrom.y === rightTo.y && leftFrom.y === rightFrom.y) {
        overlap += Math.max(
          0,
          Math.min(Math.max(leftFrom.x, leftTo.x), Math.max(rightFrom.x, rightTo.x))
            - Math.max(Math.min(leftFrom.x, leftTo.x), Math.min(rightFrom.x, rightTo.x)),
        );
      }
      if (leftFrom.x === leftTo.x && rightFrom.x === rightTo.x && leftFrom.x === rightFrom.x) {
        overlap += Math.max(
          0,
          Math.min(Math.max(leftFrom.y, leftTo.y), Math.max(rightFrom.y, rightTo.y))
            - Math.max(Math.min(leftFrom.y, leftTo.y), Math.min(rightFrom.y, rightTo.y)),
        );
      }
    }
  }
  return overlap;
}

describe("swimlane dense procedure columns", () => {
  it("edits a card-level user duration without nesting form controls in the detail button", () => {
    const fixture = denseFixture(1);
    const onOverride = vi.fn();
    const view = render(
      <Swimlane
        decisions={fixture.decisions}
        schedule={fixture.schedule}
        selectedId={null}
        userDurationOverrides={{}}
        onSelect={vi.fn()}
        onUserDurationOverrideChange={onOverride}
      />,
    );
    const procedure = fixture.decisions[0].procedure;
    const card = view.container.querySelector(".procedure-card") as HTMLElement;

    expect(card.querySelector("button button")).toBeNull();
    expect(card).toHaveTextContent("법정·공식 기간");
    expect(card).not.toHaveTextContent("일정 제외");
    fireEvent.click(within(card).getByRole("button", { name: /내 예상.*기간 입력/ }));
    fireEvent.change(
      within(card).getByLabelText(`${procedure.name} 사용자 예상 처리기간`),
      { target: { value: "30" } },
    );
    fireEvent.change(
      within(card).getByLabelText(`${procedure.name} 사용자 예상 처리기간 단위`),
      { target: { value: "CALENDAR_DAY" } },
    );
    fireEvent.click(within(card).getByRole("button", { name: "반영" }));

    expect(onOverride).toHaveBeenCalledWith(procedure.id, {
      value: 30,
      unit: "CALENDAR_DAY",
    });
  });

  it("switches every lane cell when the whole flow column reaches ten procedures", () => {
    expect(denseProcedureColumnThreshold).toBe(10);
    const onSelect = vi.fn();
    const nine = denseFixture(9);
    const view = render(
      <Swimlane
        decisions={nine.decisions}
        schedule={nine.schedule}
        selectedId={null}
        onSelect={onSelect}
      />,
    );

    const nineCells = view.container.querySelectorAll(
      '.lane-cell[data-column-item-count="9"]',
    );
    expect(nineCells).toHaveLength(2);
    expect([...nineCells].map((cell) => cell.getAttribute("data-item-count"))).toEqual(["5", "4"]);
    for (const cell of nineCells) expect(cell).not.toHaveClass("is-dense");
    expect(
      (view.container.querySelector(".swimlane-grid") as HTMLElement).style
        .gridTemplateColumns,
    ).toContain("minmax(220px, 1fr)");

    const ten = denseFixture(10);
    view.rerender(
      <Swimlane
        decisions={ten.decisions}
        schedule={ten.schedule}
        selectedId={null}
        onSelect={onSelect}
      />,
    );
    const tenCells = view.container.querySelectorAll(
      '.lane-cell[data-column-item-count="10"]',
    );
    expect(tenCells).toHaveLength(2);
    for (const cell of tenCells) {
      expect(cell).toHaveClass("is-dense");
      expect(cell).toHaveAttribute("data-item-count", "5");
      expect(cell.querySelectorAll(".procedure-card-main")).toHaveLength(5);
    }
    expect(
      (view.container.querySelector(".swimlane-grid") as HTMLElement).style
        .gridTemplateColumns,
    ).toContain("minmax(440px, 2fr)");

    const clickedCard = view.container.querySelectorAll<HTMLButtonElement>(".procedure-card-main")[4];
    const clickedName = clickedCard
      .getAttribute("aria-label")
      ?.replace(/ 상세 보기$/, "");
    const clickedDecision = ten.decisions.find(
      (decision) => decision.procedure.name === clickedName,
    );
    expect(clickedDecision).toBeDefined();
    fireEvent.click(clickedCard);
    expect(onSelect).toHaveBeenCalledWith(clickedDecision!.procedure.id);
  });

  it("routes forward dependencies orthogonally and rejects unmeasured cards", () => {
    expect(orthogonalConnectorPath(
      { top: 100, right: 260, bottom: 160, left: 180, width: 80, height: 60 },
      { top: 210, right: 480, bottom: 270, left: 400, width: 80, height: 60 },
    )).toBe("M 260 130 H 330 V 240 H 396");
    expect(orthogonalConnectorPath(
      { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 },
      { top: 210, right: 480, bottom: 270, left: 400, width: 80, height: 60 },
    )).toBeNull();
  });

  it("reserves a straight runway for the arrowhead before an adjacent target card", () => {
    const target = { top: 210, right: 380, bottom: 270, left: 300, width: 80, height: 60 };
    const path = orthogonalConnectorPath(
      { top: 100, right: 260, bottom: 160, left: 180, width: 80, height: 60 },
      target,
    );
    const points = svgPathPoints(path!);
    const beforeTarget = points.at(-2)!;
    const endpoint = points.at(-1)!;

    expect(path).not.toBeNull();
    expect(endpoint).toEqual({ x: target.left - 4, y: 240 });
    expect(beforeTarget.y).toBe(endpoint.y);
    expect(Math.abs(endpoint.x - beforeTarget.x)).toBeGreaterThanOrEqual(12);
  });

  it("assigns parallel tracks to sequential fan-out connectors", () => {
    const cards = new Map([
      ["source", { top: 100, right: 260, bottom: 160, left: 180, width: 80, height: 60 }],
      ["target-a", { top: 70, right: 480, bottom: 130, left: 400, width: 80, height: 60 }],
      ["target-b", { top: 150, right: 480, bottom: 210, left: 400, width: 80, height: 60 }],
      ["target-c", { top: 230, right: 480, bottom: 290, left: 400, width: 80, height: 60 }],
    ]);
    const route = createObstacleAvoidingConnectorRouter(
      cards,
      { top: 0, left: 0 },
      { width: 660, height: 380 },
    );
    const paths = ["target-a", "target-b", "target-c"].map((target) =>
      route("source", target),
    );

    expect(paths.every((path) => path !== null)).toBe(true);
    for (let left = 0; left < paths.length; left += 1) {
      for (let right = left + 1; right < paths.length; right += 1) {
        expect(collinearOverlapLength(
          svgPathPoints(paths[left]!),
          svgPathPoints(paths[right]!),
        )).toBe(0);
      }
    }
  });

  it("detours around intervening cards without lifting the line over their content", () => {
    const cases = [
      {
        source: { top: 100, right: 260, bottom: 160, left: 180, width: 80, height: 60 },
        target: { top: 100, right: 480, bottom: 160, left: 400, width: 80, height: 60 },
        blockers: [{ top: 80, right: 370, bottom: 180, left: 290, width: 80, height: 100 }],
      },
      {
        source: { top: 100, right: 260, bottom: 160, left: 180, width: 80, height: 60 },
        target: { top: 100, right: 480, bottom: 160, left: 400, width: 80, height: 60 },
        blockers: [{ top: 100, right: 346, bottom: 160, left: 266, width: 80, height: 60 }],
      },
      {
        source: { top: 100, right: 260, bottom: 160, left: 180, width: 80, height: 60 },
        target: { top: 240, right: 260, bottom: 300, left: 180, width: 80, height: 60 },
        blockers: [{ top: 170, right: 260, bottom: 230, left: 180, width: 80, height: 60 }],
      },
      {
        source: { top: 100, right: 480, bottom: 160, left: 400, width: 80, height: 60 },
        target: { top: 100, right: 260, bottom: 160, left: 180, width: 80, height: 60 },
        blockers: [{ top: 80, right: 370, bottom: 180, left: 290, width: 80, height: 100 }],
      },
    ];

    for (const { source, target, blockers } of cases) {
      const path = orthogonalConnectorPath(
        source,
        target,
        { top: 0, left: 0 },
        blockers,
        { width: 660, height: 380 },
      );
      expect(path).not.toBeNull();
      expect(orthogonalConnectorPath(
        source,
        target,
        { top: 0, left: 0 },
        blockers,
        { width: 660, height: 380 },
      )).toBe(path);

      const points = svgPathPoints(path!);
      for (let index = 1; index < points.length; index += 1) {
        expect(
          points[index - 1].x === points[index].x
            || points[index - 1].y === points[index].y,
        ).toBe(true);
        for (const blocker of blockers) {
          expect(crossesRect(points[index - 1], points[index], blocker)).toBe(false);
        }
      }
    }
  });

  it("shows verified sequences and calculated bottleneck candidates with expandable modes", () => {
    const evaluation = evaluateProject(catalog.scenarios[0].answers);
    const schedule = evaluation.schedules.TYPICAL;
    const onSelect = vi.fn();
    const view = render(
      <Swimlane
        decisions={evaluation.decisions}
        schedule={schedule}
        assessmentDate={catalog.scenarios[0].answers.assessmentDate}
        selectedId={null}
        onSelect={onSelect}
      />,
    );
    const grid = view.container.querySelector(".swimlane-grid");
    expect(grid).toHaveAttribute("data-connector-mode", "CORE");
    expect(Number(grid?.getAttribute("data-evidence-edge-count"))).toBeGreaterThan(0);
    expect(Number(grid?.getAttribute("data-bottleneck-edge-count"))).toBeGreaterThan(0);
    expect(Number(grid?.getAttribute("data-visible-edge-count"))).toBeGreaterThan(
      Number(grid?.getAttribute("data-evidence-edge-count")),
    );
    expect(grid).toHaveAttribute("data-context-edge-count", "0");
    expect(
      screen.getByRole("list", { name: "현재 표시된 선후행 연결" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /법정 분류/ }));
    expect(view.container.querySelector(".swimlane-grid")).toHaveAttribute(
      "data-connector-mode",
      "LEGAL",
    );

    fireEvent.click(screen.getByRole("button", { name: /전체 연결/ }));
    const allGrid = view.container.querySelector(".swimlane-grid");
    expect(allGrid).toHaveAttribute("data-connector-mode", "ALL");
    expect(allGrid?.getAttribute("data-visible-edge-count")).toBe(
      allGrid?.getAttribute("data-total-edge-count"),
    );

    fireEvent.click(screen.getByRole("button", { name: /핵심 병목/ }));

    view.rerender(
      <Swimlane
        decisions={evaluation.decisions}
        schedule={schedule}
        assessmentDate={catalog.scenarios[0].answers.assessmentDate}
        selectedId="building-permit"
        onSelect={onSelect}
      />,
    );
    expect(Number(
      view.container.querySelector(".swimlane-grid")?.getAttribute("data-context-edge-count"),
    )).toBeGreaterThan(0);
  });

  it("uses the rendered grid height instead of stale connector overflow", async () => {
    const fixture = denseFixture(10);
    const view = render(
      <Swimlane
        decisions={fixture.decisions}
        schedule={fixture.schedule}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const grid = view.container.querySelector(".swimlane-grid") as HTMLElement;
    Object.defineProperties(grid, {
      scrollWidth: { configurable: true, value: 1_600 },
      scrollHeight: { configurable: true, value: 2_400 },
      clientHeight: { configurable: true, value: 420 },
    });

    fireEvent(window, new Event("resize"));

    await waitFor(() => {
      expect(view.container.querySelector(".dependency-connector-layer")).toHaveAttribute(
        "height",
        "420",
      );
    });
    expect(
      view.container.querySelector(".dependency-connector-layer"),
    ).toHaveAttribute("width", "1600");
  });
});
