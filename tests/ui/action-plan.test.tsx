import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActionPlanView } from "@/app/components/dashboard/DashboardViews";
import { catalog, type ScenarioAnswers } from "@/lib/data/catalog";
import { evaluateProject } from "@/lib/engine/pipeline";

function industrialComplexAnswers(): ScenarioAnswers {
  return {
    ...catalog.scenarios[0].answers,
    assessmentDate: "2026-08-21",
    province: "충청남도",
    city: "아산시",
    insideIndustrialComplex: true,
    industrialComplexName: "아산 검토산업단지",
    industrialComplexIdentifier: "TEST-ASAN-001",
    industrialComplexManagingAuthority: "아산시 산업단지 담당부서",
    industrialComplexOccupancyContractStatus: "IN_PROGRESS",
    industryCategory: "GENERAL_MANUFACTURING",
  };
}

function renderActionPlan(answers = industrialComplexAnswers()) {
  const evaluation = evaluateProject(answers);
  render(
    <ActionPlanView
      decisions={evaluation.decisions}
      schedule={evaluation.schedules.TYPICAL}
      answers={answers}
      onSelect={vi.fn()}
    />,
  );
  return evaluation;
}

function readBlob(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(blob);
  });
}

describe("action plan", () => {
  it("shows a validated completion checkpoint even when construction dates are missing", () => {
    const answers: ScenarioAnswers = {
      ...industrialComplexAnswers(),
      plannedConstructionStartDate: null,
      plannedConstructionEndDate: null,
      industrialComplexOccupancyContractStatus: "COMPLETED",
    };
    const evaluation = renderActionPlan(answers);

    expect(evaluation.schedules.TYPICAL.projectTimeline).toBeNull();
    expect(evaluation.schedules.TYPICAL.completedCheckpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          procedureId: "industrial-complex-occupancy-contract",
          confirmedAsOfDate: "2026-08-21",
        }),
      ]),
    );
    const contractTitle = screen.getByText("산업단지 입주계약·변경계약", {
      selector: ".action-plan-card > header > strong",
    });
    const contractCard = contractTitle.closest("article");
    expect(contractCard).not.toBeNull();
    expect(contractCard).toHaveTextContent("기준일 현재 완료");
    expect(contractCard).toHaveTextContent("완료 증빙을 보관");
    expect(contractCard).not.toHaveTextContent("접수용 구비서류를 확정");
  });

  it("keeps a fully matched draft include on the roadmap without exposing internal review copy", () => {
    renderActionPlan();

    const buildingTitle = screen.getByText("건축허가·신고 경로 확인", {
      selector: ".action-plan-card > header > strong",
    });
    const buildingCard = buildingTitle.closest("article");
    expect(buildingCard).not.toBeNull();
    expect(buildingCard).toHaveTextContent("로드맵 포함");
    expect(buildingCard).not.toHaveTextContent("근거 검토");
    expect(buildingCard).toHaveTextContent("적용근거와 실제 관할");
  });

  it("resolves standalone local-government labels before removing the jurisdiction prefix", () => {
    const answers = industrialComplexAnswers();
    const evaluation = evaluateProject(answers);
    const decisions = evaluation.decisions.map((decision) =>
      decision.procedure.id === "industrial-complex-occupancy-contract"
        ? {
            ...decision,
            procedure: {
              ...decision.procedure,
              receivingAuthority: "관할 시장",
              statutoryDecisionMaker: "관할 시청",
            },
          }
        : decision,
    );

    render(
      <ActionPlanView
        decisions={decisions}
        schedule={evaluation.schedules.TYPICAL}
        answers={answers}
        onSelect={vi.fn()}
      />,
    );

    const contractTitle = screen.getByText("산업단지 입주계약·변경계약", {
      selector: ".action-plan-card > header > strong",
    });
    const contractCard = contractTitle.closest("article");
    expect(contractCard).not.toBeNull();
    expect(contractCard).toHaveTextContent("아산시장");
    expect(contractCard).toHaveTextContent("아산시청");
    expect(contractCard).not.toHaveTextContent("접수기관시장");
  });

  it("separates authority roles and safely resolves jurisdiction inputs", () => {
    renderActionPlan();

    const evidence = screen.getByRole("region", { name: "실행계획 근거 완성도" });
    expect(within(evidence).getByText("기관명 구체화")).toBeInTheDocument();
    expect(within(evidence).getByText("권한 원문 연결")).toBeInTheDocument();

    const contractTitle = screen.getByText("산업단지 입주계약·변경계약", {
      selector: ".action-plan-card > header > strong",
    });
    const contractCard = contractTitle.closest("article");
    expect(contractCard).not.toBeNull();
    const card = within(contractCard!);

    expect(card.getByText("접수기관")).toBeInTheDocument();
    expect(card.getByText("법정 결정권자")).toBeInTheDocument();
    expect(card.getByText("협의기관")).toBeInTheDocument();
    expect(card.getAllByText("아산시 산업단지 담당부서")).toHaveLength(2);
    expect(card.getByText("아산시장(관리기관 보고 경로)")).toBeInTheDocument();
    expect(card.getByText(/실제 담당부서 확인/)).toBeInTheDocument();

    const buildingTitle = screen.getByText("건축허가·신고 경로 확인", {
      selector: ".action-plan-card > header > strong",
    });
    const buildingCard = buildingTitle.closest("article");
    expect(buildingCard).not.toBeNull();
    expect(buildingCard).toHaveTextContent("특별자치시장·특별자치도지사 또는 시장·군수·구청장 등");
    expect(buildingCard).toHaveTextContent("권한분기와 실제 기관·담당부서 확인");

    const wasteTitle = screen.getByText("건설폐기물 처리계획 신고", {
      selector: ".action-plan-card > header > strong",
    });
    const wasteCard = wasteTitle.closest("article");
    expect(wasteCard).not.toBeNull();
    expect(wasteCard).toHaveTextContent("아산시 환경부서");
    expect(wasteCard).toHaveTextContent("원문 표기: 관할 시·군·구 환경부서");
  });

  it("labels practical order separately and does not assert uncited legal edges", () => {
    renderActionPlan();

    const completionTitle = screen.getByText("공장설립 완료신고(산업단지)", {
      selector: ".action-plan-card > header > strong",
    });
    const completionCard = completionTitle.closest("article");
    expect(completionCard).not.toBeNull();
    const card = within(completionCard!);

    expect(card.getByText("선후행 조문 연결")).toBeInTheDocument();
    const practicalRow = card.getByText("실무 권장 선행").closest("div");
    expect(practicalRow).toHaveTextContent("산업단지 입주계약·변경계약");

    const unsupportedLabels = screen.queryAllByText("법정 분류·관계근거 보강");
    expect(unsupportedLabels.length).toBeGreaterThan(0);
    for (const label of unsupportedLabels) {
      const row = label.closest("div");
      expect(row).toHaveTextContent("법적 강제순서로 단정하지 않습니다");
    }
  });

  it("exports receiving, decision, consultation, and order fields to CSV", async () => {
    const createDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
    let exportedBlob: Blob | null = null;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((blob: Blob) => {
        exportedBlob = blob;
        return "blob:action-plan-test";
      }),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    try {
      renderActionPlan();
      fireEvent.click(screen.getByRole("button", { name: "CSV 내보내기" }));

      expect(click).toHaveBeenCalledOnce();
      expect(exportedBlob).not.toBeNull();
      const csv = await readBlob(exportedBlob!);
      expect(csv).toContain('"접수기관"');
      expect(csv).toContain('"법정 결정권자"');
      expect(csv).toContain('"협의기관"');
      expect(csv).toContain('"권한근거 상태"');
      expect(csv).toContain('"선후행 조문 연결"');
      expect(csv).toContain('"실무 권장 선행"');
      expect(csv).toContain('"법정 분류·관계근거 보강"');
      expect(csv).toContain("아산시 산업단지 담당부서");
      expect(csv).toContain("아산시장(관리기관 보고 경로)");
    } finally {
      if (createDescriptor) Object.defineProperty(URL, "createObjectURL", createDescriptor);
      else delete (URL as Partial<typeof URL>).createObjectURL;
      if (revokeDescriptor) Object.defineProperty(URL, "revokeObjectURL", revokeDescriptor);
      else delete (URL as Partial<typeof URL>).revokeObjectURL;
    }
  });
});
