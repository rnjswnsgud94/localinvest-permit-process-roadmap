import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { DashboardClient } from "@/app/components/dashboard/DashboardClient";
import { InputCodeDialog } from "@/app/components/dashboard/InputCodeDialog";
import { stageLabels } from "@/app/components/dashboard/constants";
import { catalog } from "@/lib/data/catalog";
import { constructionEnvironmentSupplementalPermitTargetIds } from "@/lib/data/supplemental-permit-targets";
import { encodeInputCode, encodeShareState, INPUT_CODE_PREFIX, MAX_INPUT_CODE_LENGTH } from "@/lib/share-state";

const originalShowModal = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "showModal",
);
const originalClose = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "close",
);

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
});

afterAll(() => {
  if (originalShowModal) {
    Object.defineProperty(
      HTMLDialogElement.prototype,
      "showModal",
      originalShowModal,
    );
  } else {
    delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  }
  if (originalClose) {
    Object.defineProperty(HTMLDialogElement.prototype, "close", originalClose);
  } else {
    delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
  }
});

afterEach(() => {
  window.history.replaceState(null, "", "/");
  delete (document as unknown as { execCommand?: Document["execCommand"] }).execCommand;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("dashboard UI", () => {
  it("renders the project-input summary without validation presets", () => {
    render(<DashboardClient />);

    expect(screen.getByRole("heading", { name: "지역투자 인허가 로드맵" })).toBeInTheDocument();
    const feedbackNotice = screen.getByRole("note", { name: "AI 활용 안내" });
    expect(feedbackNotice).toHaveTextContent(
      /AI를 활용한 인허가 로드맵 툴입니다.*오류 등 피드백 시 산업부.*사무관.*으로 연락 주세요/,
    );
    expect(
      within(feedbackNotice).getByRole("link", { name: /이메일 보내기/ }).getAttribute("href"),
    ).toMatch(/^mailto:[^@\s]+@korea\.kr$/);
    const footer = document.querySelector(".dashboard-footer");
    expect(footer).not.toBeNull();
    expect(footer).toContainElement(feedbackNotice);
    expect(within(footer as HTMLElement).getByText(/이 화면은 공식 자료를 바탕으로 만든 사전 검토자료입니다/)).toBeInTheDocument();
    expect(screen.getByText("사업 조건에 맞는 절차, 적용 특례와 예상 일정을 확인합니다.")).toBeInTheDocument();
    expect(document.querySelector(".scope-card")).toBeNull();
    expect(screen.getByRole("heading", { name: "현재 사업조건" })).toBeInTheDocument();
    expect(screen.queryByText(/검증 시나리오|사용자 설정|조건 조정됨/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("시·도")).toHaveValue("");
    expect(screen.queryByText("청주시")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /사업 일정 산정 불가 계산 경로 열기/ })).toHaveTextContent("산정 불가");
    expect(screen.getByRole("button", {
      name: /확인된 제외 절차 \d+개 목록 열기/,
    })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "결과보고서 다운로드" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "스프레드시트 다운로드" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "화면 인쇄" })).toBeInTheDocument();
  });

  it("copies a portable input code and safely restores another project's inputs", async () => {
    const clipboard = vi.spyOn(window.navigator.clipboard, "writeText").mockResolvedValue();
    render(<DashboardClient />);

    const trigger = screen.getByRole("button", { name: "입력 코드 저장·불러오기" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "입력 코드 가져오기·내보내기" });
    const textarea = within(dialog).getByRole("textbox", { name: "입력 코드" });
    expect((textarea as HTMLTextAreaElement).value.startsWith(INPUT_CODE_PREFIX)).toBe(true);
    expect(textarea).toHaveAttribute("aria-invalid", "false");
    expect(within(dialog).getByText(/81,000자/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "코드 복사" }));
    await waitFor(() => expect(clipboard).toHaveBeenCalledWith((textarea as HTMLTextAreaElement).value));
    await waitFor(() => expect(within(dialog).getByRole("status")).toHaveTextContent("클립보드에 복사"));

    fireEvent.change(textarea, { target: { value: "손상된 코드" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "입력값 불러오기" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("지원하지 않는 입력 코드");
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(textarea).toHaveAttribute("aria-errormessage", "input-code-error");
    expect(screen.getByLabelText("시·도")).toHaveValue("");

    const importedAnswers = {
      ...catalog.scenarios[1].answers,
      userDurationOverrides: {
        "building-permit": { value: 2, unit: "MONTH" as const },
      },
    };
    fireEvent.change(textarea, {
      target: { value: encodeInputCode(importedAnswers) },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "입력값 불러오기" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "입력 코드 가져오기·내보내기" })).not.toBeInTheDocument());
    expect(screen.getByLabelText("시·도")).toHaveValue("충청남도");
    expect(screen.getByLabelText("시·군·구")).toHaveValue("천안시");
    expect(screen.getByRole("status")).toHaveTextContent("실무 예상기간 1건");
    expect(within(screen.getByLabelText("소요기간 기준")).getByRole(
      "button",
      { name: "내 예상 1" },
    )).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("2개월 · 수정")).toBeInTheDocument();
    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get("ud")).toContain(
        "building-permit~2~m",
      );
    });
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("restores shared card durations as the active user-expected schedule", async () => {
    const sharedAnswers = {
      ...catalog.scenarios[0].answers,
      userDurationOverrides: {
        "building-permit": { value: 45, unit: "CALENDAR_DAY" as const },
      },
    };
    window.history.replaceState(
      null,
      "",
      `/?${encodeShareState(sharedAnswers, "SWIMLANE")}`,
    );

    render(<DashboardClient />);

    const scenarioSwitch = screen.getByLabelText("소요기간 기준");
    await waitFor(() => expect(within(scenarioSwitch).getByRole(
      "button",
      { name: "내 예상 1" },
    )).toHaveAttribute("aria-pressed", "true"));
    expect(await screen.findByText("45일 · 수정")).toBeInTheDocument();
  });

  it("keeps the current project unchanged when an input-code import fails", async () => {
    render(<DashboardClient />);
    await waitFor(() => expect(window.location.search).toContain("v=15"));
    fireEvent.change(screen.getByLabelText("시·도"), {
      target: { value: "부산광역시" },
    });
    fireEvent.change(screen.getByLabelText("시·군·구"), {
      target: { value: "강서구" },
    });
    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      expect(params.get("pr")).toBe("부산광역시");
      expect(params.get("ct")).toBe("강서구");
    });
    const locationBeforeImport = window.location.search;

    const trigger = screen.getByRole("button", {
      name: "입력 코드 저장·불러오기",
    });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", {
      name: "입력 코드 가져오기·내보내기",
    });
    fireEvent.change(
      within(dialog).getByRole("textbox", { name: "입력 코드" }),
      { target: { value: "손상된 코드" } },
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "입력값 불러오기" }),
    );

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "지원하지 않는 입력 코드",
    );
    expect(screen.getByLabelText("시·도")).toHaveValue("부산광역시");
    expect(screen.getByLabelText("시·군·구")).toHaveValue("강서구");
    expect(window.location.search).toBe(locationBeforeImport);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("exposes dialog semantics and restores trigger focus after cancel", async () => {
    render(<DashboardClient />);
    const trigger = screen.getByRole("button", {
      name: "입력 코드 저장·불러오기",
    });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", {
      name: "입력 코드 가져오기·내보내기",
    });

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute(
      "aria-describedby",
      "input-code-dialog-description",
    );
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => {
      expect(
        within(dialog).getByRole("heading", {
          name: "입력 코드 가져오기·내보내기",
        }),
      ).toHaveFocus();
    });

    fireEvent(
      dialog,
      new Event("cancel", { bubbles: false, cancelable: true }),
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", {
          name: "입력 코드 가져오기·내보내기",
        }),
      ).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps import available when the current project cannot be exported", async () => {
    const onClose = vi.fn();
    const onImport = vi.fn(() => null);
    render(
      <InputCodeDialog
        initialCode=""
        initialError="현재 입력은 코드로 내보낼 수 없습니다."
        onClose={onClose}
        onImport={onImport}
      />,
    );
    const dialog = await screen.findByRole("dialog", {
      name: "입력 코드 가져오기·내보내기",
    });
    const textarea = within(dialog).getByRole("textbox", {
      name: "입력 코드",
    });

    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "현재 입력은 코드로 내보낼 수 없습니다.",
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "입력값 불러오기" }),
    );
    expect(onImport).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "불러올 입력 코드를 붙여 넣어 주세요.",
    );

    fireEvent.change(textarea, { target: { value: "FPR1.test" } });
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "입력값 불러오기" }),
    );
    expect(onImport).toHaveBeenCalledWith("FPR1.test");
  });

  it("selects the portable code when clipboard access fails", async () => {
    vi.spyOn(window.navigator.clipboard, "writeText").mockRejectedValue(new Error("blocked"));
    render(<DashboardClient />);

    fireEvent.click(screen.getByRole("button", { name: "입력 코드 저장·불러오기" }));
    const dialog = await screen.findByRole("dialog", { name: "입력 코드 가져오기·내보내기" });
    const textarea = within(dialog).getByRole("textbox", { name: "입력 코드" }) as HTMLTextAreaElement;
    fireEvent.click(within(dialog).getByRole("button", { name: "코드 복사" }));

    await waitFor(() => expect(within(dialog).getByRole("status")).toHaveTextContent("코드를 선택"));
    expect(textarea).toHaveFocus();
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(textarea.value.length);
  });

  it("uses the legacy copy command when the Clipboard API is blocked", async () => {
    vi.spyOn(window.navigator.clipboard, "writeText").mockRejectedValue(new Error("blocked"));
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });
    render(<DashboardClient />);

    fireEvent.click(screen.getByRole("button", { name: "입력 코드 저장·불러오기" }));
    const dialog = await screen.findByRole("dialog", { name: "입력 코드 가져오기·내보내기" });
    fireEvent.click(within(dialog).getByRole("button", { name: "코드 복사" }));

    await waitFor(() => expect(execCommand).toHaveBeenCalledWith("copy"));
    expect(within(dialog).getByRole("status")).toHaveTextContent("클립보드에 복사");
  });

  it("bounds oversized pasted codes and exposes the error to assistive technology", async () => {
    render(<DashboardClient />);

    fireEvent.click(screen.getByRole("button", { name: "입력 코드 저장·불러오기" }));
    const dialog = await screen.findByRole("dialog", { name: "입력 코드 가져오기·내보내기" });
    const textarea = within(dialog).getByRole("textbox", { name: "입력 코드" }) as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: { value: "A".repeat(MAX_INPUT_CODE_LENGTH + 100) },
    });

    expect(textarea.value).toHaveLength(MAX_INPUT_CODE_LENGTH + 1);
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(within(dialog).getByRole("alert")).toHaveTextContent("허용 길이를 초과");
  });

  it("removes a stale share query after importing a code too large for a URL", async () => {
    const permitIds = Array.from(
      { length: 120 },
      (_, index) => `permit-${String(index).padStart(3, "0")}-${"x".repeat(32)}`,
    );
    const answers = {
      ...catalog.scenarios[1].answers,
      advancedStrategicIndustryFastTrackPermitIds: permitIds,
      semiconductorClusterFastTrackPermitIds: permitIds,
      semiconductorClusterPlanIncludedPermitIds: permitIds,
      industrialComplexPlanIncludedPermitIds: permitIds,
      regionalSpecialZonePlanIncludedPermitIds: permitIds,
    };
    const code = encodeInputCode(answers);
    render(<DashboardClient />);
    await waitFor(() => expect(window.location.search).toContain("v=15"));

    fireEvent.click(screen.getByRole("button", { name: "입력 코드 저장·불러오기" }));
    const dialog = await screen.findByRole("dialog", { name: "입력 코드 가져오기·내보내기" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "입력 코드" }), {
      target: { value: code },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "입력값 불러오기" }));

    await waitFor(() => expect(window.location.search).toBe(""));
    expect(screen.getByLabelText("시·도")).toHaveValue("충청남도");
  });

  it("keeps each result-summary description on its own full-width row", () => {
    render(<DashboardClient />);

    const statusCards = [...document.querySelectorAll<HTMLElement>(".summary-action")];
    expect(statusCards).toHaveLength(3);
    for (const card of statusCards) {
      expect(card.querySelector(":scope > .summary-card-heading")).not.toBeNull();
      const description = card.querySelector<HTMLElement>(":scope > .summary-card-description");
      expect(description).not.toBeNull();
      expect(card).toHaveAttribute("aria-describedby", description!.id);
      expect(card.querySelector(":scope > .summary-card-link")).not.toBeNull();
    }
    const durationTrigger = document.querySelector<HTMLElement>(".duration-summary-trigger");
    expect(durationTrigger).toHaveAttribute(
      "aria-describedby",
      "duration-summary-description duration-summary-detail",
    );
    expect(document.querySelector(".duration-summary-result")).not.toBeNull();
  });

  it("uses a compact step header and resets the input scroll position on navigation", () => {
    render(<DashboardClient />);

    const wizard = screen.getByLabelText("사업조건 입력");
    const body = wizard.querySelector<HTMLElement>(".wizard-body");
    const stepNavigation = screen.getByRole("navigation", { name: "입력 단계" });
    const firstStep = within(stepNavigation).getByRole("button", { name: /^1 사업 기본/ });
    const secondStep = within(stepNavigation).getByRole("button", { name: /^2 시설 규모/ });
    expect(body).not.toBeNull();
    expect(firstStep).toHaveAttribute("aria-current", "step");
    expect(wizard.querySelector(".wizard-heading h2")).toHaveTextContent("사업 기본");
    expect(screen.queryByText("핵심 질문부터 입력하고, 필요한 상세항목만 펼치세요.")).not.toBeInTheDocument();
    expect(screen.queryByText("눌러서 확인")).not.toBeInTheDocument();
    expect(screen.queryByText("해당 시 입력")).not.toBeInTheDocument();

    body!.scrollTop = 120;
    fireEvent.click(secondStep);

    expect(body).toHaveProperty("scrollTop", 0);
    expect(secondStep).toHaveAttribute("aria-current", "step");
    expect(wizard.querySelector(".wizard-heading h2")).toHaveTextContent("시설 규모");
  });

  it("moves a mobile user to the new step heading after pressing Next", async () => {
    const scrollIntoView = vi.fn();
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      matches: query === "(max-width: 820px)" || query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    render(<DashboardClient />);

    const wizard = screen.getByLabelText("사업조건 입력");
    Object.defineProperty(wizard, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    const body = wizard.querySelector<HTMLElement>(".wizard-body");
    body!.scrollTop = 120;
    fireEvent.click(within(wizard).getByRole("button", { name: "다음" }));

    const heading = within(wizard).getByRole("heading", { name: "시설 규모" });
    expect(body).toHaveProperty("scrollTop", 0);
    await waitFor(() => expect(document.activeElement).toBe(heading));
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      behavior: "auto",
    }));
  });

  it("sorts only the full-procedure table by roadmap stage or Korean name", () => {
    render(<DashboardClient />);
    fireEvent.click(screen.getByRole("tab", { name: "전체 절차" }));

    const sort = screen.getByRole("combobox", { name: "전체 절차 정렬" });
    const table = document.querySelector<HTMLTableElement>(".procedure-table");
    const rowNames = () => [...table!.querySelectorAll<HTMLTableRowElement>("tbody tr")]
      .map((row) => row.querySelector("td:nth-child(2) strong")!.textContent!);
    const rowStages = () => [...table!.querySelectorAll<HTMLTableRowElement>("tbody tr")]
      .map((row) => row.querySelector("td:nth-child(3)")!.textContent!);

    expect(sort).toHaveValue("STAGE");
    const orderedStageLabels = Object.values(stageLabels) as string[];
    const stageIndexes = rowStages().map((stage) => orderedStageLabels.indexOf(stage));
    expect(stageIndexes).toEqual([...stageIndexes].sort((left, right) => left - right));

    fireEvent.change(sort, { target: { value: "NAME" } });
    expect(rowNames()).toEqual([...rowNames()].sort((left, right) => left.localeCompare(right, "ko-KR")));
  });

  it("keeps core and common review inputs visible while revealing dependent follow-ups only when relevant", () => {
    render(<DashboardClient />);

    for (const label of [
      "도로명·지번 주소",
      "용도지역·용도지구",
      "확인된 입지규제",
      "KSIC 코드",
      "생산품·서비스",
      "핵심 공정·설비",
      "기존 허가·신고 식별자",
    ]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }

    fireEvent.click(within(screen.getByRole("navigation", { name: "입력 단계" })).getByRole("button", { name: /^2 시설 규모/ }));
    expect(screen.getByText("사업 후 총 연면적", { selector: "legend" })).toBeInTheDocument();
    expect(screen.queryByText("기존", { selector: "span" })).not.toBeInTheDocument();
    expect(screen.queryByText("증가분", { selector: "span" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("건축 전문검토").tagName).toBe("SECTION");
    const siteDetails = screen.getByText("부지·건축 추가 확인").closest("details");
    expect(siteDetails).not.toHaveAttribute("open");

    fireEvent.click(within(screen.getByRole("navigation", { name: "입력 단계" })).getByRole("button", { name: /^3 환경·안전/ }));
    expect(screen.queryByText("화학물질·혼합물 직접 제조·수입 여부", { selector: "legend" })).not.toBeInTheDocument();
    expect(screen.queryByText("위험물 탱크 설치 여부", { selector: "legend" })).not.toBeInTheDocument();

    const chemicals = screen.getByText("화학물질 취급 여부", { selector: "legend" }).closest("fieldset");
    fireEvent.click(within(chemicals!).getByRole("button", { name: "있음" }));
    expect(screen.getByText("화학물질·혼합물 직접 제조·수입 여부", { selector: "legend" })).toBeInTheDocument();

    const hazardousMaterials = screen.getByText("지정수량 이상 위험물 취급 여부", { selector: "legend" }).closest("fieldset");
    fireEvent.click(within(hazardousMaterials!).getByRole("button", { name: "있음" }));
    expect(screen.getByText("위험물 탱크 설치 여부", { selector: "legend" })).toBeInTheDocument();
    const gasSafetyDetails = screen.getByText("가스·PSM·안전관리 전문검토").closest("details");
    expect(gasSafetyDetails).not.toHaveAttribute("open");

    expect(screen.getByLabelText("환경평가·통합허가").tagName).toBe("SECTION");
    fireEvent.click(screen.getByText("공사·환경 법정 임계값 정밀검토"));
    const reviewGroup = screen.getByRole("group", {
      name: "공사·환경 법정 임계값 검토 결과",
    });
    expect(
      within(reviewGroup).getAllByRole("group", { name: /대상 여부$/ }),
    ).toHaveLength(constructionEnvironmentSupplementalPermitTargetIds.length);
    const roadOccupation = within(reviewGroup).getByRole("group", {
      name: "도로점용허가 대상 여부",
    });
    expect(
      within(roadOccupation).getByRole("button", { name: "미확인" }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(
      within(roadOccupation).getByRole("button", { name: "대상" }),
    );
    expect(screen.getByText(`1/${constructionEnvironmentSupplementalPermitTargetIds.length} 검토 · 1개 대상`)).toBeInTheDocument();

    const nonpointSource = within(reviewGroup).getByRole("group", {
      name: "비점오염원 설치신고 대상 여부",
    });
    fireEvent.click(
      within(nonpointSource).getByRole("button", { name: "비대상" }),
    );
    expect(screen.getByText(`2/${constructionEnvironmentSupplementalPermitTargetIds.length} 검토 · 1개 대상`)).toBeInTheDocument();
  });

  it("asks and clears the PSM same-equipment scope only when both parent targets apply", () => {
    render(<DashboardClient />);

    fireEvent.click(within(screen.getByRole("navigation", { name: "입력 단계" })).getByRole("button", { name: /^3 환경·안전/ }));
    expect(
      screen.queryByText("PSM이 동일 유해·위험설비를 포함하는지", {
        selector: "legend",
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("공사·환경 법정 임계값 정밀검토"));
    const reviewGroup = screen.getByRole("group", {
      name: "공사·환경 법정 임계값 검토 결과",
    });
    const hazardPlan = within(reviewGroup).getByRole("group", {
      name: /유해위험방지계획서 제출·심사 대상 여부$/,
    });
    fireEvent.click(within(hazardPlan).getByRole("button", { name: "대상" }));

    fireEvent.click(screen.getByText("가스·PSM·안전관리 전문검토"));
    const psm = screen.getByText("PSM 대상 설비 여부", { selector: "legend" })
      .closest("fieldset");
    fireEvent.click(within(psm!).getByRole("button", { name: "대상" }));

    const sameScopeLegend = screen.getByText(
      "PSM이 동일 유해·위험설비를 포함하는지",
      { selector: "legend" },
    );
    const sameScope = sameScopeLegend.closest("fieldset");
    fireEvent.click(
      within(sameScope!).getByRole("button", { name: "동일 설비 포함" }),
    );

    fireEvent.click(within(psm!).getByRole("button", { name: "비대상" }));
    expect(
      screen.queryByText("PSM이 동일 유해·위험설비를 포함하는지", {
        selector: "legend",
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(within(psm!).getByRole("button", { name: "대상" }));
    const restoredScope = screen.getByText(
      "PSM이 동일 유해·위험설비를 포함하는지",
      { selector: "legend" },
    ).closest("fieldset");
    expect(
      within(restoredScope!).getByRole("button", { name: "미확인" }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(
      within(restoredScope!).getByRole("button", { name: "동일 설비 포함" }),
    );
    fireEvent.click(within(hazardPlan).getByRole("button", { name: "비대상" }));
    expect(
      screen.queryByText("PSM이 동일 유해·위험설비를 포함하는지", {
        selector: "legend",
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(within(hazardPlan).getByRole("button", { name: "대상" }));
    const scopeAfterRetarget = screen.getByText(
      "PSM이 동일 유해·위험설비를 포함하는지",
      { selector: "legend" },
    ).closest("fieldset");
    expect(
      within(scopeAfterRetarget!).getByRole("button", { name: "미확인" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("reflects every edited Project Input value directly in the summary", () => {
    render(<DashboardClient />);

    fireEvent.click(screen.getByRole("button", { name: "증설" }));
    const province = screen.getByLabelText("시·도") as HTMLSelectElement;
    fireEvent.change(province, { target: { value: "부산광역시" } });
    fireEvent.change(screen.getByLabelText("시·군·구"), { target: { value: "강서구" } });

    const summary = screen.getByRole("heading", { name: "현재 사업조건" }).closest("section");
    expect(summary).not.toBeNull();
    expect(within(summary!).getByText("증설")).toBeInTheDocument();
    expect(within(summary!).getByText("부산광역시")).toBeInTheDocument();
    expect(within(summary!).getByText("강서구")).toBeInTheDocument();
  });

  it("keeps the legal assessment date valid and reports a cleared required value", () => {
    render(<DashboardClient />);
    const assessmentDate = screen.getByLabelText("평가 기준일");
    const original = (assessmentDate as HTMLInputElement).value;

    expect(assessmentDate).toBeRequired();
    fireEvent.change(assessmentDate, { target: { value: "" } });

    expect(screen.getByRole("alert")).toHaveTextContent("평가 기준일은 비워둘 수 없습니다.");
    expect(assessmentDate).toHaveValue(original);
  });

  it("labels an incomplete duration as a known lower bound and names the missing components", () => {
    render(<DashboardClient />);
    fireEvent.click(screen.getByRole("button", { name: /공사 일정/ }));

    const start = screen.getByLabelText("착공 예정일");
    const end = screen.getByLabelText("준공 예정일");
    expect(start).toHaveAttribute("min", "2025-01-01");
    fireEvent.change(start, { target: { value: "2027-06-15" } });
    fireEvent.change(end, { target: { value: "2030-05-20" } });

    const scheduleCard = screen.getByRole("button", { name: /확인된 일정 하한 .* 계산 경로 열기/ });
    expect(scheduleCard).not.toBeNull();
    expect(scheduleCard).toHaveTextContent(/(?:년|개월|일)/);
    expect(scheduleCard).toHaveTextContent("총 소요기간");
    expect(scheduleCard).toHaveAccessibleName(/확인된 일정 하한/);
    expect(scheduleCard).toHaveTextContent("확인된 일정 하한");
    expect(scheduleCard).toHaveTextContent("총 소요기간이 아닙니다");
    expect(scheduleCard).toHaveTextContent(/누락 구성요소 · 처리기간 미확인 인허가 \d+개/);
    expect(screen.getByText(/공사 [\d,]+일/)).toBeInTheDocument();
  });

  it("keeps official scenarios and offers a separately labelled user-expected scenario", () => {
    render(<DashboardClient />);
    const range = screen.getByLabelText("소요기간 기준");
    const minimum = within(range).getByRole("button", { name: "최소기간" });
    const typical = within(range).getByRole("button", { name: "공식 기준" });
    const user = within(range).getByRole("button", { name: "내 예상" });

    expect(within(range).getAllByRole("button")).toEqual([minimum, typical, user]);
    expect(range.closest(".summary-schedule")).not.toBeNull();
    expect(document.querySelector(".tab-row .scenario-switch")).toBeNull();
    expect(typical).toHaveAttribute("aria-pressed", "true");
    expect(minimum).toHaveAttribute("aria-pressed", "false");
    expect(user).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(minimum);
    expect(minimum).toHaveAttribute("aria-pressed", "true");
    expect(typical).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: /공사 일정/ }));
    expect(screen.getByLabelText("착공 예정일")).toBeInTheDocument();
    expect(screen.getByLabelText("준공 예정일")).toBeInTheDocument();
    expect(screen.queryByLabelText(/계획기간/)).not.toBeInTheDocument();
    expect(screen.queryByText("일정 가정")).not.toBeInTheDocument();
  });

  it("applies a card-level user expected duration to the total and shared state", async () => {
    render(<DashboardClient />);
    const editorToggle = screen.getAllByRole("button", {
      name: /내 예상.*기간 입력/,
    })[0];
    const card = editorToggle.closest(".procedure-card") as HTMLElement;
    fireEvent.click(editorToggle);
    fireEvent.change(within(card).getByRole("spinbutton"), {
      target: { value: "30" },
    });
    fireEvent.change(within(card).getByRole("combobox"), {
      target: { value: "CALENDAR_DAY" },
    });
    fireEvent.click(within(card).getByRole("button", { name: "반영" }));

    const range = screen.getByLabelText("소요기간 기준");
    expect(within(range).getByRole("button", { name: "내 예상 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(card).toHaveTextContent("30일 · 수정");
    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get("ud")).toContain("~30~c");
    });

    fireEvent.click(screen.getByRole("button", { name: /공사 일정/ }));
    fireEvent.change(screen.getByLabelText("착공 예정일"), {
      target: { value: "2027-01-01" },
    });
    fireEvent.change(screen.getByLabelText("준공 예정일"), {
      target: { value: "2028-12-31" },
    });
    await waitFor(() => {
      expect(screen.getByText(/사용자 예상 1건 반영/)).toBeInTheDocument();
    });

    const updatedCard = screen.getByRole("button", { name: /내 예상.*수정/ })
      .closest(".procedure-card") as HTMLElement;
    fireEvent.click(within(updatedCard).getByRole("button", { name: /내 예상.*수정/ }));
    fireEvent.click(within(updatedCard).getByRole("button", { name: "공식 기준으로 되돌리기" }));
    expect(within(screen.getByLabelText("소요기간 기준")).getByRole(
      "button",
      { name: "공식 기준" },
    )).toHaveAttribute("aria-pressed", "true");

    const resetToggle = screen.getAllByRole("button", {
      name: /내 예상.*기간 입력/,
    })[0];
    const resetCard = resetToggle.closest(".procedure-card") as HTMLElement;
    fireEvent.click(resetToggle);
    fireEvent.change(within(resetCard).getByRole("spinbutton"), {
      target: { value: "30" },
    });
    fireEvent.click(within(resetCard).getByRole("button", { name: "반영" }));

    fireEvent.click(screen.getByRole("button", { name: "예상값 전체 삭제" }));
    expect(within(screen.getByLabelText("소요기간 기준")).getByRole(
      "button",
      { name: "공식 기준" },
    )).toHaveAttribute("aria-pressed", "true");
  }, 20_000);

  it("opens the total-duration result as a simplified six-stage graphic and restores focus", async () => {
    render(<DashboardClient />);
    await waitFor(() => expect(window.location.search).toContain("v=15"));
    fireEvent.click(screen.getByRole("button", { name: /공사 일정/ }));
    fireEvent.change(screen.getByLabelText("착공 예정일"), { target: { value: "2027-01-01" } });
    fireEvent.change(screen.getByLabelText("준공 예정일"), { target: { value: "2028-12-31" } });

    const trigger = screen.getByRole("button", { name: /확인된 일정 하한 .* 계산 경로 열기/ });
    await waitFor(() => expect(trigger).not.toHaveTextContent("산정 불가"));
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-controls", "total-duration-dialog");
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "확인된 일정 하한 계산 경로" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(within(dialog).getByRole("region", { name: "확인된 일정 하한 주요 구간" })).toBeInTheDocument();
    const graphic = within(dialog).getByRole("list", { name: "전체 절차 6단계 그래픽" });
    expect(within(graphic).getAllByRole("listitem")).toHaveLength(6);
    expect(within(dialog).getByText("건설공사")).toBeInTheDocument();
    const procedureIds = [...dialog.querySelectorAll("[data-procedure-id]")].map(
      (element) => element.getAttribute("data-procedure-id"),
    );
    expect(procedureIds.length).toBeGreaterThan(0);
    expect(new Set(procedureIds).size).toBe(procedureIds.length);

    fireEvent.click(within(dialog).getByRole("button", { name: "확인된 일정 하한 닫기" }));
    expect(screen.queryByRole("dialog", { name: "확인된 일정 하한 계산 경로" })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("explains the missing dates inside the total-duration dialog", async () => {
    render(<DashboardClient />);
    const trigger = screen.getByRole("button", { name: /사업 일정 산정 불가 계산 경로 열기/ });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "총 소요기간 계산 경로" });
    expect(within(dialog).getByText("공사 시작일과 준공일을 입력해 주세요.")).toBeInTheDocument();
  });

  it("opens each beginner-friendly status card as a dialog with the complete status list", async () => {
    render(<DashboardClient />);
    const summary = screen.getByLabelText("판정 요약");
    const labels = [
      "로드맵 포함 절차",
      "추가 확인 필요 절차",
      "확인된 제외 절차",
    ];

    for (const label of labels) {
      const trigger = within(summary).getByRole("button", {
        name: new RegExp(`^${label} \\d+개 목록 열기$`),
      });
      expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
      expect(trigger).toHaveAttribute("aria-controls", "status-summary-dialog");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    }

    const trigger = within(summary).getByRole("button", {
      name: /^추가 확인 필요 절차 \d+개 목록 열기$/,
    });
    const expectedCount = Number(
      trigger.getAttribute("aria-label")?.match(/(\d+)개/)?.[1],
    );
    expect(expectedCount).toBeGreaterThan(0);

    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", {
      name: new RegExp(`추가 확인 필요 절차 ${expectedCount}개`),
    });

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(expectedCount);
    expect(within(dialog).getByText(`${expectedCount}개 표시`)).toBeInTheDocument();
  });

  it("searches and closes a status-list dialog", async () => {
    render(<DashboardClient />);
    const trigger = screen.getByRole("button", {
      name: /^추가 확인 필요 절차 \d+개 목록 열기$/,
    });
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", {
      name: /추가 확인 필요 절차 \d+개/,
    });
    const search = within(dialog).getByRole("searchbox", {
      name: "목록에서 절차 또는 기관 검색",
    });

    fireEvent.change(search, { target: { value: "존재하지않는절차명" } });
    expect(within(dialog).getByText("0개 표시")).toBeInTheDocument();
    expect(within(dialog).getByText("검색 결과가 없습니다.")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "목록 닫기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("restores edited inputs from the share URL without a scenario id", async () => {
    const first = render(<DashboardClient />);
    await waitFor(() => expect(window.location.search).toContain("v=15"));
    fireEvent.click(screen.getByRole("button", { name: "증설" }));

    await waitFor(() => {
      expect(window.location.search).toContain("it=EXPANSION");
      expect(window.location.search).toContain("v=15");
      expect(new URLSearchParams(window.location.search).has("sc")).toBe(false);
    });
    first.unmount();

    render(<DashboardClient />);
    const summary = screen.getByRole("heading", { name: "현재 사업조건" }).closest("section");
    await waitFor(() => {
      expect(within(summary!).getByText("증설")).toBeInTheDocument();
    });
  });

  it("opens details and exposes an official source link", () => {
    render(<DashboardClient />);
    const card = screen.getByRole("button", { name: /건축허가·신고 경로 확인/ });
    fireEvent.click(card);
    const drawer = screen.getByRole("dialog", { name: /건축허가·신고 경로 확인 상세정보/ });
    expect(drawer).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /원문 열기/ })[0]).toHaveAttribute("href", expect.stringMatching(/^https:\/\//));
    const korea100Link = within(drawer).getByRole("link", {
      name: /건축허가 \| 대한민국 제도 지도/,
    });
    expect(korea100Link).toHaveAttribute(
      "href",
      "https://hosungseo.github.io/korea100/model/building-permit/",
    );
    expect(korea100Link).toHaveAttribute("target", "_blank");
    expect(korea100Link).toHaveAttribute("rel", "noopener noreferrer");
    expect(drawer).toHaveTextContent("공식 법령 근거와 별도의 참고자료입니다.");
    expect(drawer).toHaveTextContent("업무일");
    expect(drawer).toHaveTextContent("법정·공식 기간과 실무 참고값");
    expect(drawer).toHaveTextContent("전국 공신력 있는 평균·중앙값 자료가 없어");
    expect(drawer).not.toHaveTextContent("통상 14");
    expect(drawer).not.toHaveTextContent(/\b(?:HIGH|MEDIUM|LOW|UNVERIFIED|BUSINESS_DAY|MVP)\b/);
  });

  it("offers every supported province and updates the editable locality", () => {
    render(<DashboardClient />);
    const province = screen.getByLabelText("시·도") as HTMLSelectElement;
    expect(province.options).toHaveLength(17);
    expect(province.options[0]).toHaveTextContent("시·도 선택");
    expect([...province.options].map((option) => option.value)).toEqual(
      expect.arrayContaining(["서울특별시", "인천광역시", "경기도", "부산광역시"]),
    );
    fireEvent.change(province, { target: { value: "경기도" } });
    expect(screen.getByLabelText("시·군·구")).toHaveValue("");
    expect(screen.getByText("수도권 공장입지 추가 확인")).toBeInTheDocument();
    expect(
      [...(screen.getByLabelText("시·군·구") as HTMLSelectElement).options]
        .map((option) => option.value),
    ).toContain("고양시");
    fireEvent.change(province, { target: { value: "부산광역시" } });
    expect(screen.getByLabelText("시·군·구")).toHaveValue("");
    expect(screen.getAllByRole("link", { name: "부산광역시" })[0]).toHaveAttribute("href", expect.stringContaining("elis.go.kr"));
    expect(screen.getByText("시·군·구 미선택")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("시·군·구"), { target: { value: "강서구" } });
    expect(screen.getAllByRole("link", { name: "강서구" })[0]).toHaveAttribute("href", expect.stringContaining("ctpvCd=26"));
    expect(screen.getByRole("heading", { name: "광역·기초 자치법규 확인" })).toBeInTheDocument();
  }, 20_000);

  it("links a matched local review category to the actual ordinance detail", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        checkedAt: "2026-08-21T00:00:00.000Z",
        source: "행정안전부 자치법규정보시스템(ELIS)",
        mode: "LIVE",
        categories: [
          {
            categoryId: "urban-planning-development",
            ordinances: [
              {
                name: "아산시 도시계획 조례",
                level: "MUNICIPALITY",
                jurisdictionName: "아산시",
                amendmentDate: "2026-08-18",
                url: "https://www.elis.go.kr/alrpop/alrDtlsPop?alrNo=44200123456789&histNo=003",
              },
            ],
          },
        ],
      }),
    } as Response);

    render(<DashboardClient />);
    fireEvent.change(screen.getByLabelText("시·도"), { target: { value: "충청남도" } });
    fireEvent.change(screen.getByLabelText("시·군·구"), { target: { value: "아산시" } });

    const detailLink = await screen.findByRole("link", { name: /아산시 도시계획 조례/ });
    expect(detailLink).toHaveAttribute("href", expect.stringContaining("elis.go.kr/alrpop/alrDtlsPop"));
    expect(detailLink).toHaveAttribute("href", expect.stringContaining("alrNo=44200123456789"));
    expect(detailLink).toHaveAttribute("href", expect.stringContaining("histNo=003"));
    expect(detailLink).not.toHaveAttribute("href", expect.stringContaining("/locgovAlrPopup"));
    expect(detailLink).not.toHaveAttribute("href", expect.stringContaining("OC="));
  });

  it("rejects a non-detail ELIS match and offers only clearly labelled jurisdiction-list fallbacks", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        checkedAt: "2026-08-21T00:00:00.000Z",
        source: "행정안전부 자치법규정보시스템(ELIS)",
        mode: "LIVE",
        categories: [
          {
            categoryId: "urban-planning-development",
            ordinances: [
              {
                name: "전남광주통합특별시 자치법규 전체 목록",
                level: "PROVINCE",
                jurisdictionName: "전남광주통합특별시",
                url: "https://www.elis.go.kr/alrpop/locgovAlrPopup?ctpvCd=12&sggCd=000",
              },
            ],
          },
        ],
      }),
    } as Response);

    render(<DashboardClient />);
    fireEvent.change(screen.getByLabelText("시·도"), { target: { value: "전남광주통합특별시" } });

    const urbanCard = screen
      .getByRole("heading", { name: "도시계획·개발행위 기준" })
      .closest("article");
    expect(urbanCard).not.toBeNull();
    await waitFor(() => {
      expect(
        within(urbanCard!).queryByRole("link", {
          name: /전남광주통합특별시 자치법규 전체 목록/,
        }),
      ).not.toBeInTheDocument();
      expect(
        within(urbanCard!).getByText(/현행 조례 원문을 확인하지 못했습니다/),
      ).toBeInTheDocument();
      const fallback = within(urbanCard!).getByRole("link", {
        name: /전남광주통합특별시 ELIS 목록에서 직접 찾기/,
      });
      expect(fallback).toHaveClass("local-ordinance-fallback-link");
      expect(fallback).toHaveAttribute(
        "href",
        expect.stringContaining("/alrpop/locgovAlrPopup"),
      );
    });
  });

  it("falls back to exact reviewed links without presenting a broad list as a match", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("live ordinance lookup unavailable"),
    );

    render(<DashboardClient />);
    await waitFor(() => expect(window.location.search).toContain("v=15"));
    fireEvent.change(screen.getByLabelText("시·도"), {
      target: { value: "충청남도" },
    });
    fireEvent.change(screen.getByLabelText("시·군·구"), {
      target: { value: "아산시" },
    });

    const urbanCard = screen
      .getByRole("heading", { name: "도시계획·개발행위 기준" })
      .closest("article");
    expect(urbanCard).not.toBeNull();
    const exactUrbanLink = await within(urbanCard!).findByRole("link", {
      name: /아산시 도시계획 조례/,
    });
    expect(exactUrbanLink).toHaveAttribute(
      "href",
      expect.stringContaining("/alrpop/alrDtlsPop?"),
    );

    expect(screen.getAllByRole("link", { name: "충청남도" })[0]).toHaveAttribute(
      "href",
      expect.stringContaining("ctpvCd=44&sggCd=000"),
    );
    expect(screen.getAllByRole("link", { name: "아산시" })[0]).toHaveAttribute(
      "href",
      expect.stringContaining("ctpvCd=44&sggCd=200"),
    );

    const trafficCard = screen
      .getByRole("heading", { name: "교통영향평가 지역기준" })
      .closest("article");
    expect(trafficCard).not.toBeNull();
    for (const link of within(trafficCard!).queryAllByRole("link")) {
      const href = link.getAttribute("href") ?? "";
      expect(
        href.includes("/alrpop/alrDtlsPop?") ||
          (link.classList.contains("local-ordinance-fallback-link") &&
            href.includes("/alrpop/locgovAlrPopup?")),
      ).toBe(true);
    }

    await waitFor(() =>
      expect(
        screen.getByText(/ELIS 실시간 조회 실패 .* 검증 저장본 표시/),
      ).toBeInTheDocument(),
    );
  });

  it("uses the reviewed Muju ELIS detail snapshot when the static site has no API route", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("GitHub Pages has no API route"),
    );

    render(<DashboardClient />);
    await waitFor(() => expect(window.location.search).toContain("v=15"));
    fireEvent.change(screen.getByLabelText("시·도"), {
      target: { value: "전북특별자치도" },
    });
    fireEvent.change(screen.getByLabelText("시·군·구"), {
      target: { value: "무주군" },
    });

    const sewerCard = screen
      .getByRole("heading", { name: "하수도 연결·원인자부담금" })
      .closest("article");
    expect(sewerCard).not.toBeNull();
    const detailLink = await within(sewerCard!).findByRole("link", {
      name: /^무주군 하수도 사용 조례 ↗/,
    });
    expect(detailLink).toHaveAttribute(
      "href",
      "https://www.elis.go.kr/alrpop/alrDtlsPop?alrNo=52730129348001&histNo=006",
    );
    expect(detailLink).not.toHaveAttribute(
      "href",
      expect.stringContaining("locgovAlrPopup"),
    );
    await waitFor(() =>
      expect(
        screen.getByText(/ELIS 실시간 조회 실패 .* 검증 저장본 표시/),
      ).toBeInTheDocument(),
    );
  });

  it("shows Daejeon province and Jung-gu exact links immediately from the reviewed snapshot", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise<Response>(() => undefined),
    );

    render(<DashboardClient />);
    await waitFor(() => expect(window.location.search).toContain("v=15"));
    fireEvent.change(screen.getByLabelText("시·도"), {
      target: { value: "대전광역시" },
    });
    fireEvent.change(screen.getByLabelText("시·군·구"), {
      target: { value: "중구" },
    });

    expect(
      await screen.findByRole("link", { name: /대전광역시 중구 도시계획 조례/ }),
    ).toHaveAttribute(
      "href",
      "https://www.elis.go.kr/alrpop/alrDtlsPop?alrNo=30140113255015&histNo=008",
    );
    expect(screen.getByText(/검증 저장본 먼저 표시/)).toBeInTheDocument();
  });

  it("uses the industry profile only as a review guide and excludes chemical follow-ups when handling is disabled", async () => {
    render(<DashboardClient />);
    fireEvent.change(screen.getByLabelText("업종·주요 공정"), {
      target: { value: "CHEMICAL_PRODUCTS" },
    });

    expect(document.querySelector('[data-input-key="industryCategory"]')).toHaveTextContent("화학물질·화학제품");
    expect(document.querySelector('[data-input-key="chemicalsHandled"]')).toHaveTextContent("미확인");
    expect(screen.getByText(/업종만으로 환경·안전 인허가를 자동 확정하지 않습니다/)).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("navigation", { name: "입력 단계" })).getByRole("button", { name: /^3 환경·안전/ }));
    const chemicalQuestion = screen.getByText("화학물질 취급 여부", { selector: "legend" }).closest("fieldset");
    expect(chemicalQuestion).not.toBeNull();
    fireEvent.click(within(chemicalQuestion!).getByRole("button", { name: "없음" }));
    expect(document.querySelector('[data-input-key="chemicalsHandled"]')).toHaveTextContent("아니오");

    const confirmTrigger = screen.getByRole("button", {
      name: /^추가 확인 필요 절차 \d+개 목록 열기$/,
    });
    fireEvent.click(confirmTrigger);
    const confirmDialog = await screen.findByRole("dialog", {
      name: /추가 확인 필요 절차 \d+개/,
    });
    await waitFor(() => {
      expect(within(confirmDialog).queryByText("유해화학물질 영업허가")).not.toBeInTheDocument();
      expect(within(confirmDialog).queryByText("유해화학물질 취급시설 설치검사")).not.toBeInTheDocument();
    });
    fireEvent.click(within(confirmDialog).getByRole("button", { name: "목록 닫기" }));

    const excludedTrigger = screen.getByRole("button", {
      name: /^확인된 제외 절차 \d+개 목록 열기$/,
    });
    fireEvent.click(excludedTrigger);
    const excludedDialog = await screen.findByRole("dialog", {
      name: /확인된 제외 절차 \d+개/,
    });
    expect(within(excludedDialog).getByText("유해화학물질 영업허가")).toBeInTheDocument();
    expect(within(excludedDialog).getByText("유해화학물질 취급시설 설치검사")).toBeInTheDocument();
  });

  it("automatically surfaces other special-law candidates and activates only a confirmed route", async () => {
    render(<DashboardClient />);
    await waitFor(() => expect(window.location.search).toContain("v=15"));
    fireEvent.change(screen.getByLabelText("시·도"), {
      target: { value: "충청남도" },
    });
    fireEvent.click(screen.getByRole("button", { name: "산단 안" }));
    fireEvent.change(screen.getByLabelText("업종·주요 공정"), {
      target: { value: "SEMICONDUCTOR_ELECTRONICS" },
    });

    const candidateList = document.querySelector<HTMLElement>(".special-law-candidate-list");
    expect(candidateList).not.toBeNull();
    expect(within(candidateList!).getByText("국가첨단전략산업 신속처리")).toBeInTheDocument();
    expect(within(candidateList!).getByText("산업단지계획 통합승인·의제")).toBeInTheDocument();
    expect(within(candidateList!).getByText("지역특화발전특구계획 의제")).toBeInTheDocument();
    const semiconductorCandidate = within(candidateList!)
      .getByText("반도체클러스터 신속처리")
      .closest<HTMLElement>("article");
    expect(semiconductorCandidate).not.toBeNull();
    fireEvent.click(within(semiconductorCandidate!).getByRole("button", {
      name: "법정요건 확인",
    }));
    const roleEvidence = within(semiconductorCandidate!).getByText("법정 사업시행자·신청자 지위").closest("label");
    const delayEvidence = within(semiconductorCandidate!).getByText("인허가 지연·현저한 지장 우려").closest("label");
    const committeeEvidence = within(semiconductorCandidate!).getByText("위원회 심의·의결 완료").closest("label");
    fireEvent.click(within(roleEvidence!).getAllByRole("button")[0]);
    fireEvent.click(within(delayEvidence!).getAllByRole("button")[0]);
    fireEvent.click(within(committeeEvidence!).getAllByRole("button")[0]);
    fireEvent.change(within(semiconductorCandidate!).getByLabelText("산업통상부장관의 인허가권자 요청일"), {
      target: { value: "2026-08-15" },
    });
    fireEvent.click(within(semiconductorCandidate!).getByRole("checkbox", { name: "건축허가·신고 경로 확인" }));

    const summary = screen
      .getByRole("heading", { name: "특별법 간소화·면제 점검" })
      .closest<HTMLElement>("section");
    const activeCard = within(summary!).getByRole("heading", {
      name: "반도체클러스터 신속처리",
    }).closest<HTMLElement>("article");
    expect(activeCard).toHaveTextContent("요건 확인");
    expect(activeCard).toHaveTextContent("요청목록에 포함되지 않은 개별 인허가에는 적용되지 않습니다");
    expect(document.querySelector('[data-input-key="semiconductorClusterFastTrackConfirmed"]')).toHaveTextContent("예");
    await waitFor(() => expect(window.location.search).toContain("scf=1"));
    expect(window.location.search).toContain("scpi=building-permit");
  });

  it("adds AI data centers and carries selected special-law treatment into the result", async () => {
    render(<DashboardClient />);
    await waitFor(() => expect(window.location.search).toContain("v=15"));
    fireEvent.change(screen.getByLabelText("업종·주요 공정"), {
      target: { value: "AI_DATA_CENTER" },
    });

    expect(screen.getAllByRole("option", { name: "AI 데이터센터" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "특별법 간소화·면제 점검" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "요건 확인" }));
    const oneStop = screen.getByRole("checkbox", { name: /인허가 일괄처리/ });
    fireEvent.click(oneStop);
    fireEvent.change(screen.getByLabelText("평가 기준일"), {
      target: { value: "2027-04-01" },
    });

    expect(oneStop).toBeChecked();
    expect(screen.getByText("선택 반영")).toBeInTheDocument();
    expect(screen.getByText(/일괄처리는 면제가 아니며/)).toBeInTheDocument();
    expect(screen.getByText(/이 화면이 해당 문서의 원본·발행기관·의제목록 진위를 대신 검증하지 않습니다/)).toBeInTheDocument();
    expect(screen.getAllByText(/기한 종료 다음 날/).length).toBeGreaterThan(0);
    expect(screen.getByText(/시설 규모 산정 특례 또는 입지 특례/)).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.search).toContain("v=15");
      expect(window.location.search).toContain("sl=AIDC_ONE_STOP");
      expect(window.location.search).toContain("aic=1");
      expect(window.location.search).toContain("aos=PLANNED");
    });
  });

  it("clears hidden AI-only special-law values when switching to another industry", async () => {
    render(<DashboardClient />);
    await waitFor(() => expect(window.location.search).toContain("v=15"));
    fireEvent.change(screen.getByLabelText("업종·주요 공정"), {
      target: { value: "AI_DATA_CENTER" },
    });

    fireEvent.click(screen.getByRole("button", { name: "요건 확인" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /인허가 일괄처리/ }));
    fireEvent.change(screen.getByLabelText("인허가 일괄처리 진행상태"), {
      target: { value: "COMPLETED" },
    });
    expect(screen.getByRole("heading", { name: "특별법 간소화·면제 점검" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("업종·주요 공정"), {
      target: { value: "SEMICONDUCTOR_ELECTRONICS" },
    });

    expect(screen.queryByRole("checkbox", { name: /인허가 일괄처리/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "인허가 일괄처리" })).not.toBeInTheDocument();
    expect(document.querySelector('[data-input-key="appliedSpecialLawIds"]')).toBeNull();
    expect(document.querySelector('[data-input-key="aiDataCenterOneStopStatus"]')).toBeNull();
    await waitFor(() => {
      expect(window.location.search).toContain("ind=SEMICONDUCTOR_ELECTRONICS");
      expect(window.location.search).toContain("aic=u");
      expect(window.location.search).toContain("aos=NOT_APPLIED");
      expect(window.location.search).toContain("sl=");
      expect(window.location.search).not.toContain("sl=AIDC_ONE_STOP");
    });
  });

  it("uses named flow phases instead of numbered progress bundles", () => {
    render(<DashboardClient />);
    expect(screen.queryByText(/진행 묶음/)).not.toBeInTheDocument();
    const phaseRoute = screen.getByRole("list", { name: "사업 단계" });
    expect(within(phaseRoute).getAllByRole("listitem")).toHaveLength(6);
    expect(within(phaseRoute).getByText("입지 사전검토")).toBeInTheDocument();
    expect(within(phaseRoute).getByText("계획 승인·입주")).toBeInTheDocument();
    expect(within(phaseRoute).getByText("착공 준비")).toBeInTheDocument();
    expect(within(phaseRoute).getByText("공사 중")).toBeInTheDocument();
    expect(within(phaseRoute).getByText("준공·가동 준비")).toBeInTheDocument();
    expect(within(phaseRoute).getByText("가동 이후")).toBeInTheDocument();
  });

  it("switches to the action, procedure, law, schedule, and review tabs", () => {
    render(<DashboardClient />);
    fireEvent.click(screen.getByRole("tab", { name: /실행 계획/ }));
    expect(screen.getByRole("heading", { name: "다음 행동과 담당·접수 순서" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "실행계획 근거 완성도" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CSV 내보내기" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /전체 절차/ }));
    expect(screen.getByRole("table")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /법령 근거/ }));
    expect(screen.getAllByRole("link", { name: /공식 원문/ }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^(?:ACT|ENFORCEMENT_DECREE|ENFORCEMENT_RULE|AUTHORITATIVE|STALE|UNVERIFIED)$/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /사업 일정/ }));
    expect(screen.getByText(/공사 시작일과 준공일을 입력/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /확인 필요/ }));
    expect(screen.getByRole("heading", { name: "현재 데이터에 포함되지 않은 항목" })).toBeInTheDocument();
  });

  it("uses one dedicated entry-contract editor and resets an invalid AI free-trade-zone choice", async () => {
    render(<DashboardClient />);

    fireEvent.change(screen.getByLabelText("업종·주요 공정"), {
      target: { value: "GENERAL_MANUFACTURING" },
    });
    await waitFor(() => {
      expect(screen.getByLabelText("업종·주요 공정")).toHaveValue(
        "GENERAL_MANUFACTURING",
      );
    });
    fireEvent.change(screen.getByLabelText("입주계약 적용 법률"), {
      target: { value: "FREE_TRADE_ZONE_ACT" },
    });
    await waitFor(() => {
      expect(screen.getByLabelText("입주계약 적용 법률")).toHaveValue(
        "FREE_TRADE_ZONE_ACT",
      );
    });
    fireEvent.click(await screen.findByText("자격 확인", { selector: "button" }));
    fireEvent.change(screen.getByLabelText("입주계약 진행상태"), {
      target: { value: "COMPLETED" },
    });
    fireEvent.change(screen.getByLabelText("구역명"), {
      target: { value: "부산항 자유무역지역" },
    });
    fireEvent.change(screen.getByLabelText("관리권자·관리기관"), {
      target: { value: "부산항만공사" },
    });
    fireEvent.change(screen.getByLabelText("계약 증빙"), {
      target: { value: "입주계약 제2026-100호" },
    });

    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      expect(params.get("ecr")).toBe("FREE_TRADE_ZONE_ACT");
      expect(params.get("eec")).toBe("1");
      expect(params.get("ecs")).toBe("COMPLETED");
    });
    expect(
      screen.queryByText("자유무역지역 입주계약·변경계약", {
        selector: ".supplemental-permit-decision-row strong",
      }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("업종·주요 공정"), {
      target: { value: "AI_DATA_CENTER" },
    });
    await waitFor(() => {
      expect(screen.getByLabelText("입주계약 적용 법률")).toHaveValue("NONE");
    });
    expect(
      within(screen.getByLabelText("입주계약 적용 법률")).queryByRole(
        "option",
        { name: "자유무역지역법상 입주계약" },
      ),
    ).not.toBeInTheDocument();
  });

  it("opens the permit registry, verification ledger, and scenario comparison tools", async () => {
    render(<DashboardClient />);

    const registryTrigger = screen.getByRole("button", { name: /전체 인허가 백과/ });
    const verificationTrigger = screen.getByRole("button", { name: /근거 검증 대장/ });
    const compareTrigger = screen.getByRole("button", { name: /사업조건 비교/ });
    expect(registryTrigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(verificationTrigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(compareTrigger).toHaveAttribute("aria-haspopup", "dialog");

    fireEvent.click(registryTrigger);
    const registryDialog = await screen.findByRole("dialog", { name: "전체 인허가 백과" });
    expect(within(registryDialog).getByRole("status")).toHaveTextContent(
      `전체 ${catalog.procedures.length}개 중 ${catalog.procedures.length}개 절차`,
    );
    fireEvent.click(within(registryDialog).getAllByRole("button", { name: /상세 보기/ })[0]);
    const detailDialog = await screen.findByRole("dialog", { name: /상세정보/ });
    expect(within(detailDialog).getByRole("heading", { level: 2 })).toHaveFocus();
    fireEvent.click(within(detailDialog).getByRole("button", { name: "상세정보 닫기" }));
    const restoredRegistryDialog = await screen.findByRole("dialog", { name: "전체 인허가 백과" });
    expect(within(restoredRegistryDialog).getByRole("heading", { name: "전체 인허가 백과" })).toHaveFocus();
    fireEvent.click(within(restoredRegistryDialog).getByRole("button", { name: "전체 인허가 백과 닫기" }));
    await waitFor(() => expect(registryTrigger).toHaveFocus());

    fireEvent.click(verificationTrigger);
    const verificationDialog = await screen.findByRole("dialog", { name: "인허가 근거 검증 대장" });
    expect(within(verificationDialog).getByLabelText("검증 대장 현황")).toHaveTextContent(
      `검증 차원${catalog.procedures.length * 6}건`,
    );
    fireEvent.click(within(verificationDialog).getByRole("button", { name: "인허가 근거 검증 대장 닫기" }));
    await waitFor(() => expect(verificationTrigger).toHaveFocus());

    fireEvent.click(compareTrigger);
    const compareDialog = await screen.findByRole("dialog", { name: "사업조건 비교" });
    expect(within(compareDialog).getByRole("group", { name: "비교할 기준 시나리오 선택" })).toBeInTheDocument();
    expect(within(compareDialog).getByRole("status")).toHaveTextContent("최대 2개");
  });
});
