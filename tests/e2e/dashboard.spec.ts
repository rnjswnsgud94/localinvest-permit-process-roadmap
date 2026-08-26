import { readFile } from "node:fs/promises";

import { readWorkbookBuffer } from "@alosha/xlsx";
import { expect, test, type Page } from "@playwright/test";

async function gotoHydratedDashboard(page: Page) {
  await page.goto("/");
  // The dashboard is server-rendered first. Its first share-state URL update is
  // a stable signal that React event handlers and client effects are ready.
  await expect(page).toHaveURL(/[?&]v=15(?:&|$)/, { timeout: 30_000 });
}

test("desktop result summary uses the available width without cramped copy", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1450, height: 900 });
  await gotoHydratedDashboard(page);

  const summary = page.getByLabel("판정 요약");
  const durationCard = summary.locator(".summary-schedule");
  const statusCards = summary.locator(".summary-action");
  await expect(durationCard).toBeVisible();
  await expect(statusCards).toHaveCount(3);

  const geometry = await summary.evaluate((element) => {
    const summaryRect = element.getBoundingClientRect();
    const duration = element.querySelector<HTMLElement>(".summary-schedule");
    const cards = [...element.querySelectorAll<HTMLElement>(".summary-action")];
    const descriptions = [
      ...element.querySelectorAll<HTMLElement>(".summary-card-description"),
    ];
    if (!duration || cards.length !== 3 || descriptions.length !== 3) return null;

    return {
      summaryWidth: summaryRect.width,
      durationWidth: duration.getBoundingClientRect().width,
      cardTops: cards.map((card) => card.getBoundingClientRect().top),
      descriptionWidthRatios: descriptions.map((description, index) =>
        description.getBoundingClientRect().width /
        cards[index].getBoundingClientRect().width,
      ),
      descriptionLineHeights: descriptions.map((description) =>
        Number.parseFloat(getComputedStyle(description).lineHeight),
      ),
      hasHorizontalOverflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

  expect(geometry).not.toBeNull();
  expect(geometry!.durationWidth / geometry!.summaryWidth).toBeGreaterThan(0.95);
  expect(Math.max(...geometry!.cardTops) - Math.min(...geometry!.cardTops)).toBeLessThan(2);
  expect(Math.min(...geometry!.descriptionWidthRatios)).toBeGreaterThan(0.78);
  expect(Math.min(...geometry!.descriptionLineHeights)).toBeGreaterThanOrEqual(19);
  expect(geometry!.hasHorizontalOverflow).toBe(false);

  await expect(page.locator(".dependency-connector-layer marker").first()).toHaveAttribute(
    "markerUnits",
    "userSpaceOnUse",
  );
  const flowGeometry = await page.locator(".swimlane-grid").evaluate((element) => {
    const marker = element.querySelector("marker");
    return {
      columnGap: Number.parseFloat(getComputedStyle(element).columnGap),
      markerUnits: marker?.getAttribute("markerUnits"),
      markerWidth: marker?.getAttribute("markerWidth"),
      markerViewBox: marker?.getAttribute("viewBox"),
    };
  });
  expect(flowGeometry.columnGap).toBeGreaterThanOrEqual(20);
  expect(flowGeometry).toMatchObject({
    markerUnits: "userSpaceOnUse",
    markerWidth: "12",
    markerViewBox: "-1 -5 12 10",
  });

  const flowGrid = page.locator(".swimlane-grid");
  await expect(flowGrid).toHaveAttribute("data-connector-mode", "CORE");
  const flowColumns = await flowGrid.evaluate((element) => {
    const titles = [...element.querySelectorAll<HTMLElement>(".stage-header strong")]
      .map((header) => header.textContent?.trim() ?? "");
    return {
      count: Number(element.getAttribute("data-flow-column-count")),
      renderedCount: titles.length,
      uniqueCount: new Set(titles).size,
    };
  });
  expect(flowColumns.count).toBeGreaterThan(0);
  expect(flowColumns.count).toBeLessThanOrEqual(6);
  expect(flowColumns.renderedCount).toBe(flowColumns.count);
  expect(flowColumns.uniqueCount).toBe(flowColumns.count);

  const decisionNotice = page.getByRole("note", {
    name: "AI 활용 비공식 사전검토",
  });
  await expect(decisionNotice).toBeVisible();
  await expect(decisionNotice).toContainText("실제 신청 전");
  const noticeReadability = await decisionNotice.evaluate((element) => {
    const copy = element.querySelector<HTMLElement>("p");
    if (!copy) return null;
    return {
      fontSize: Number.parseFloat(getComputedStyle(copy).fontSize),
      lineHeight: Number.parseFloat(getComputedStyle(copy).lineHeight),
      overflows: element.scrollWidth > element.clientWidth + 1,
      copyOverflows: copy.scrollWidth > copy.clientWidth + 1,
    };
  });
  expect(noticeReadability).toMatchObject({
    fontSize: 13,
    overflows: false,
    copyOverflows: false,
  });
  expect(noticeReadability!.lineHeight).toBeGreaterThanOrEqual(20);

  const initialConnectorBoundary = await flowGrid.evaluate((element) => {
    const gridRect = element.getBoundingClientRect();
    const firstLaneCell = element.querySelector<HTMLElement>(".lane-cell");
    const linePaths = [
      ...element.querySelectorAll<SVGPathElement>(".dependency-connector-line"),
    ];
    if (!firstLaneCell || linePaths.length === 0) return null;

    const yCoordinates: number[] = [];
    for (const linePath of linePaths) {
      const tokens = (linePath.getAttribute("d") ?? "").split(/\s+/);
      let y = 0;
      for (let index = 0; index < tokens.length;) {
        if (tokens[index] === "M") {
          y = Number(tokens[index + 2]);
          index += 3;
        } else if (tokens[index] === "H") {
          index += 2;
        } else if (tokens[index] === "V") {
          y = Number(tokens[index + 1]);
          index += 2;
        } else {
          throw new Error(`Unexpected connector command: ${tokens[index]}`);
        }
        yCoordinates.push(y);
      }
    }

    return {
      pathCount: linePaths.length,
      visibleCount: Number(element.getAttribute("data-visible-edge-count")),
      laneTop: firstLaneCell.getBoundingClientRect().top - gridRect.top,
      minimumPathY: Math.min(...yCoordinates),
    };
  });
  expect(initialConnectorBoundary).not.toBeNull();
  expect(initialConnectorBoundary!.pathCount).toBeGreaterThan(0);
  expect(initialConnectorBoundary!.pathCount).toBe(initialConnectorBoundary!.visibleCount);
  expect(
    initialConnectorBoundary!.minimumPathY - initialConnectorBoundary!.laneTop,
  ).toBeGreaterThanOrEqual(4);

  const readability = await page.locator(".workspace").evaluate((element) => {
    const fontSize = (selector: string) => {
      const target = element.querySelector<HTMLElement>(selector);
      if (!target) throw new Error(`Missing readability target: ${selector}`);
      return Number.parseFloat(getComputedStyle(target).fontSize);
    };
    const flowToolbar = element.querySelector<HTMLElement>(".flow-connector-toolbar");
    const practitionerTools = element.querySelector<HTMLElement>(".practitioner-tools");
    const toolDescription = element.querySelector<HTMLElement>(
      ".practitioner-tool-actions small",
    );
    if (!flowToolbar || !practitionerTools || !toolDescription) return null;

    return {
      flowHeading: fontSize(".flow-connector-heading > strong"),
      flowDescription: fontSize(".flow-connector-heading > small"),
      modeButton: fontSize(".connector-mode-switch button"),
      modeStatus: fontSize(".connector-mode-status"),
      focusHeading: fontSize(".bottleneck-focus > header span"),
      focusDescription: fontSize(".bottleneck-focus > header p"),
      focusItem: fontSize(".bottleneck-focus button > strong"),
      focusMetadata: fontSize(".bottleneck-focus button > small"),
      practitionerHeading: fontSize(".practitioner-tools > header h3"),
      practitionerDescription: fontSize(".practitioner-tools > header p"),
      toolTitle: fontSize(".practitioner-tool-actions strong"),
      toolDescription: fontSize(".practitioner-tool-actions small"),
      stageTitle: fontSize(".stage-header strong"),
      flowToolbarOverflows: flowToolbar.scrollWidth > flowToolbar.clientWidth + 1,
      practitionerToolsOverflow:
        practitionerTools.scrollWidth > practitionerTools.clientWidth + 1,
      toolDescriptionWhiteSpace: getComputedStyle(toolDescription).whiteSpace,
    };
  });
  expect(readability).not.toBeNull();
  expect(readability).toMatchObject({
    flowHeading: 15,
    flowDescription: 12,
    modeButton: 12,
    modeStatus: 11,
    focusHeading: 13,
    focusDescription: 11,
    focusItem: 12,
    focusMetadata: 11,
    practitionerHeading: 18,
    practitionerDescription: 12,
    toolTitle: 13,
    toolDescription: 11,
    stageTitle: 12,
    flowToolbarOverflows: false,
    practitionerToolsOverflow: false,
    toolDescriptionWhiteSpace: "normal",
  });

  await page.getByRole("button", { name: /법정 분류/ }).click();
  await expect(flowGrid).toHaveAttribute("data-connector-mode", "LEGAL");
  await page.getByRole("button", { name: /전체 연결/ }).click();
  await expect(flowGrid).toHaveAttribute("data-connector-mode", "ALL");
  const allEdgeCounts = await flowGrid.evaluate((element) => ({
    visible: element.getAttribute("data-visible-edge-count"),
    total: element.getAttribute("data-total-edge-count"),
  }));
  expect(allEdgeCounts.visible).toBe(allEdgeCounts.total);
  await page.getByRole("button", { name: /핵심 병목/ }).click();
  await expect(flowGrid).toHaveAttribute("data-connector-mode", "CORE");

  for (const lane of await page.locator(".lane-header").all()) await lane.click();
  await expect(page.locator('.lane-header[aria-expanded="false"]')).toHaveCount(
    await page.locator(".lane-header").count(),
  );
  const collapsedFlowGeometry = await page.locator(".swimlane-grid").evaluate((element) => {
    const connector = element.querySelector(".dependency-connector-layer");
    return {
      gridHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      connectorHeight: Number(connector?.getAttribute("height")),
    };
  });
  expect(Math.abs(
    collapsedFlowGeometry.connectorHeight - collapsedFlowGeometry.gridHeight,
  )).toBeLessThanOrEqual(1);
  expect(collapsedFlowGeometry.scrollHeight - collapsedFlowGeometry.gridHeight).toBeLessThanOrEqual(1);
});

test("all-edge routing limits positive-length collinear overlap", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop flow-density regression");
  test.setTimeout(60_000);
  await gotoHydratedDashboard(page);
  const flowGrid = page.locator(".swimlane-grid");
  await page.getByRole("button", { name: /전체 연결/ }).click();
  await expect(flowGrid).toHaveAttribute("data-connector-mode", "ALL");
  await expect(flowGrid).toHaveAttribute("data-connector-routing", "true");
  await expect(flowGrid).toHaveAttribute("data-connector-routing", "false", {
    timeout: 30_000,
  });

  const overlap = await flowGrid.evaluate((element) => {
    type Point = { x: number; y: number };
    type Segment = {
      orientation: "horizontal" | "vertical";
      fixed: number;
      start: number;
      end: number;
    };
    const pointsFor = (path: string) => {
      const tokens = path.split(/\s+/);
      const points: Point[] = [];
      let x = 0;
      let y = 0;
      for (let index = 0; index < tokens.length;) {
        if (tokens[index] === "M") {
          x = Number(tokens[index + 1]);
          y = Number(tokens[index + 2]);
          index += 3;
        } else if (tokens[index] === "H") {
          x = Number(tokens[index + 1]);
          index += 2;
        } else {
          y = Number(tokens[index + 1]);
          index += 2;
        }
        points.push({ x, y });
      }
      return points;
    };
    const segmentsFor = (path: string) => {
      const points = pointsFor(path);
      return points.slice(1).flatMap((point, index): Segment[] => {
        const previous = points[index];
        if (point.x === previous.x && point.y !== previous.y) {
          return [{
            orientation: "vertical",
            fixed: point.x,
            start: Math.min(point.y, previous.y),
            end: Math.max(point.y, previous.y),
          }];
        }
        if (point.y === previous.y && point.x !== previous.x) {
          return [{
            orientation: "horizontal",
            fixed: point.y,
            start: Math.min(point.x, previous.x),
            end: Math.max(point.x, previous.x),
          }];
        }
        return [];
      });
    };
    const paths = [...element.querySelectorAll<SVGGElement>("g[data-edge-id]")]
      .map((group) => ({
        id: group.dataset.edgeId ?? "unknown",
        from: group.dataset.from ?? "unknown",
        to: group.dataset.to ?? "unknown",
        path: group.querySelector<SVGPathElement>(".dependency-connector-line")
          ?.getAttribute("d") ?? "",
        segments: segmentsFor(
          group.querySelector<SVGPathElement>(".dependency-connector-line")
            ?.getAttribute("d") ?? "",
        ),
      }));
    let overlappingPairs = 0;
    let maximumOverlap = 0;
    const worstPairs: Array<{
      left: string;
      leftPath: string;
      right: string;
      rightPath: string;
      overlap: number;
    }> = [];
    for (let left = 0; left < paths.length; left += 1) {
      for (let right = left + 1; right < paths.length; right += 1) {
        let pairOverlap = 0;
        for (const leftSegment of paths[left].segments) {
          for (const rightSegment of paths[right].segments) {
            if (
              leftSegment.orientation !== rightSegment.orientation
              || leftSegment.fixed !== rightSegment.fixed
            ) continue;
            pairOverlap += Math.max(
              0,
              Math.min(leftSegment.end, rightSegment.end)
                - Math.max(leftSegment.start, rightSegment.start),
            );
          }
        }
        if (pairOverlap > 0) {
          overlappingPairs += 1;
          worstPairs.push({
            left: `${paths[left].id} (${paths[left].from} -> ${paths[left].to})`,
            leftPath: paths[left].path,
            right: `${paths[right].id} (${paths[right].from} -> ${paths[right].to})`,
            rightPath: paths[right].path,
            overlap: pairOverlap,
          });
        }
        maximumOverlap = Math.max(maximumOverlap, pairOverlap);
      }
    }
    worstPairs.sort((left, right) => right.overlap - left.overlap);
    return {
      maximumOverlap,
      overlappingPairs,
      pathCount: paths.length,
      pairCount: paths.length * (paths.length - 1) / 2,
      worstPairs: worstPairs.slice(0, 8),
    };
  });

  expect(overlap.pathCount).toBeGreaterThan(20);
  expect(overlap.maximumOverlap, JSON.stringify(overlap, null, 2)).toBeLessThanOrEqual(40);
  expect(
    overlap.overlappingPairs / overlap.pairCount,
    JSON.stringify(overlap, null, 2),
  ).toBeLessThan(0.05);
});

test("compact desktop keeps the enlarged workbench copy inside its panels", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop responsive regression");
  await page.setViewportSize({ width: 1024, height: 900 });
  await gotoHydratedDashboard(page);

  const layout = await page.locator(".workspace").evaluate((element) => {
    const flowToolbar = element.querySelector<HTMLElement>(".flow-connector-toolbar");
    const focus = element.querySelector<HTMLElement>(".bottleneck-focus");
    const practitionerTools = element.querySelector<HTMLElement>(".practitioner-tools");
    const toolActions = element.querySelector<HTMLElement>(".practitioner-tool-actions");
    if (!flowToolbar || !focus || !practitionerTools || !toolActions) return null;

    return {
      flowColumns: getComputedStyle(flowToolbar).gridTemplateColumns
        .split(/\s+/)
        .filter(Boolean).length,
      focusColumns: getComputedStyle(focus).gridTemplateColumns
        .split(/\s+/)
        .filter(Boolean).length,
      practitionerColumns: getComputedStyle(practitionerTools).gridTemplateColumns
        .split(/\s+/)
        .filter(Boolean).length,
      flowOverflows: flowToolbar.scrollWidth > flowToolbar.clientWidth + 1,
      focusOverflows: focus.scrollWidth > focus.clientWidth + 1,
      practitionerOverflows:
        practitionerTools.scrollWidth > practitionerTools.clientWidth + 1,
      toolActionsOverflow: toolActions.scrollWidth > toolActions.clientWidth + 1,
      documentOverflows:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

  expect(layout).toMatchObject({
    flowColumns: 1,
    focusColumns: 1,
    practitionerColumns: 1,
    flowOverflows: false,
    focusOverflows: false,
    practitionerOverflows: false,
    toolActionsOverflow: false,
    documentOverflows: false,
  });
});

test("flow cards keep compact Korean labels intact and wrap copy by words", async ({ page }) => {
  await gotoHydratedDashboard(page);
  const parallelBadge = page.locator(".procedure-meta em", { hasText: "병렬" }).first();
  await expect(parallelBadge).toBeVisible();

  const typography = await page.locator(".swimlane-grid").evaluate((element) => {
    const badge = element.querySelector<HTMLElement>(".procedure-meta em");
    const title = element.querySelector<HTMLElement>(".procedure-card-title");
    const duration = element.querySelector<HTMLElement>(".procedure-official-duration");
    const durationLabel = duration?.querySelector<HTMLElement>("b");
    const durationValue = duration?.querySelector<HTMLElement>("span");
    const routeName = element.querySelector<HTMLElement>(".route-chip > span");
    const routeKind = element.querySelector<HTMLElement>(".route-chip > em");
    if (!badge || !title || !duration || !durationLabel || !durationValue || !routeName || !routeKind) {
      return null;
    }

    const badgeRange = document.createRange();
    badgeRange.selectNodeContents(badge);
    const durationLabelRect = durationLabel.getBoundingClientRect();
    const durationValueRect = durationValue.getBoundingClientRect();
    const cards = [...element.querySelectorAll<HTMLElement>(".procedure-card")];

    return {
      badgeLineCount: badgeRange.getClientRects().length,
      badgeWhiteSpace: getComputedStyle(badge).whiteSpace,
      badgeFlexShrink: getComputedStyle(badge).flexShrink,
      titleWordBreak: getComputedStyle(title).wordBreak,
      titleOverflowWrap: getComputedStyle(title).overflowWrap,
      durationColumnCount: getComputedStyle(duration).gridTemplateColumns
        .split(/\s+/)
        .filter(Boolean).length,
      durationIsStacked: durationValueRect.top >= durationLabelRect.bottom - 1,
      routeWordBreak: getComputedStyle(routeName).wordBreak,
      routeOverflowWrap: getComputedStyle(routeName).overflowWrap,
      routeKindWhiteSpace: getComputedStyle(routeKind).whiteSpace,
      overflowingCardCount: cards.filter((card) => card.scrollWidth > card.clientWidth + 1).length,
    };
  });

  expect(typography).toMatchObject({
    badgeLineCount: 1,
    badgeWhiteSpace: "nowrap",
    badgeFlexShrink: "0",
    titleWordBreak: "keep-all",
    titleOverflowWrap: "anywhere",
    durationColumnCount: 1,
    durationIsStacked: true,
    routeWordBreak: "keep-all",
    routeOverflowWrap: "anywhere",
    routeKindWhiteSpace: "nowrap",
    overflowingCardCount: 0,
  });
});

test("desktop wizard keeps its navigation visible and scrolls independently", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await gotoHydratedDashboard(page);

  const wizard = page.getByLabel("사업조건 입력");
  const body = wizard.locator(".wizard-body");
  const nextButton = wizard.getByRole("button", { name: "다음", exact: true });
  await expect(nextButton).toBeInViewport();

  const geometry = await wizard.evaluate((element) => {
    const panel = element.getBoundingClientRect();
    const bodyElement = element.querySelector<HTMLElement>(".wizard-body");
    const footer = element.querySelector<HTMLElement>(".wizard-footer");
    if (!bodyElement || !footer) return null;
    return {
      panelHeight: panel.height,
      panelBottom: panel.bottom,
      panelBottomGap: window.innerHeight - panel.bottom,
      footerBottom: footer.getBoundingClientRect().bottom,
      viewportHeight: window.innerHeight,
      bodyClientHeight: bodyElement.clientHeight,
      bodyScrollHeight: bodyElement.scrollHeight,
      windowScrollY: window.scrollY,
      remainingPageHeight:
        document.documentElement.scrollHeight - (window.scrollY + window.innerHeight),
    };
  });

  expect(geometry).not.toBeNull();
  expect(geometry!.panelBottom).toBeLessThanOrEqual(geometry!.viewportHeight + 1);
  expect(geometry!.panelBottomGap).toBeGreaterThanOrEqual(-1);
  expect(geometry!.panelBottomGap).toBeLessThanOrEqual(24);
  expect(geometry!.footerBottom).toBeLessThanOrEqual(geometry!.viewportHeight + 1);
  expect(geometry!.bodyClientHeight / geometry!.panelHeight).toBeGreaterThan(0.55);
  expect(geometry!.bodyScrollHeight).toBeGreaterThan(geometry!.bodyClientHeight);
  expect(geometry!.remainingPageHeight).toBeGreaterThan(500);

  await body.hover();
  await page.mouse.wheel(0, 420);
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(geometry!.windowScrollY);

  await nextButton.click();
  await expect(wizard.getByText("2 / 5", { exact: true })).toBeVisible();
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBe(0);
  await expect(nextButton).toBeInViewport();
});

test("mobile Next returns the page to the new wizard step heading", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "모바일 프로젝트에서만 실행합니다.");
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoHydratedDashboard(page);

  const wizard = page.getByLabel("사업조건 입력");
  const nextButton = wizard.getByRole("button", { name: "다음", exact: true });
  await nextButton.scrollIntoViewIfNeeded();
  const scrolledPosition = await page.evaluate(() => window.scrollY);
  expect(scrolledPosition).toBeGreaterThan(0);

  await nextButton.click();

  const heading = wizard.getByRole("heading", { name: "시설 규모" });
  await expect(wizard.getByText("2 / 5", { exact: true })).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(heading).toBeInViewport();
  await expect.poll(async () => wizard.evaluate((element) =>
    Math.abs(Math.round(element.getBoundingClientRect().top)),
  )).toBeLessThanOrEqual(16);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(scrolledPosition);
});

test("procedure lists expose stage and Korean-name sorting", async ({ page }) => {
  await gotoHydratedDashboard(page);

  await page.getByRole("button", { name: /전체 인허가 백과/ }).click();
  const registry = page.getByRole("dialog", { name: "전체 인허가 백과" });
  const registrySort = registry.getByRole("combobox", { name: "전체 인허가 정렬" });
  await expect(registrySort).toHaveValue("NAME");
  await registrySort.selectOption("STAGE");
  await expect(registry.getByRole("status")).toContainText("일정 단계순");
  await registry.getByRole("button", { name: "전체 인허가 백과 닫기" }).click();

  await page.getByRole("tab", { name: "전체 절차" }).click();
  const listSort = page.getByRole("combobox", { name: "전체 절차 정렬" });
  await expect(listSort).toHaveValue("STAGE");
  await listSort.selectOption("NAME");
  await expect(listSort).toHaveValue("NAME");
});

test("a card user estimate updates the scenario and survives reload", async ({ page }) => {
  await gotoHydratedDashboard(page);
  const card = page.locator(".procedure-card").filter({
    has: page.getByRole("button", {
      name: "품질관리·품질시험계획 수립·승인 상세 보기",
    }),
  });
  await card.getByRole("button", { name: /내 예상.*기간 입력/ }).click();
  await card.getByRole("spinbutton").fill("30");
  await card.getByRole("combobox").selectOption("CALENDAR_DAY");
  await card.getByRole("button", { name: "반영" }).click();

  await expect(page.getByRole("button", { name: "내 예상 1" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(card).toContainText("30일 · 수정");
  await expect(page).toHaveURL(/ud=.*30/);

  await page.reload();
  await expect(card).toContainText("30일 · 수정");
  await expect(page.getByRole("button", { name: "내 예상 1" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("secondary permit questions start collapsed without discarding answers", async ({ page }) => {
  await gotoHydratedDashboard(page);
  await page.getByRole("navigation", { name: "입력 단계" }).getByRole(
    "button",
    { name: /^2 시설 규모/ },
  ).click();

  const siteDetails = page.locator("details", {
    hasText: "부지·건축 추가 확인",
  }).first();
  await expect(siteDetails).toBeVisible();
  await expect(siteDetails).not.toHaveAttribute("open", "");
  await siteDetails.getByText("부지·건축 추가 확인").click();
  await siteDetails.getByRole("button", { name: "필요" }).first().click();
  await expect(siteDetails).toContainText("1개 입력됨");
  await siteDetails.getByText("부지·건축 추가 확인").click();
  await expect(page).toHaveURL(/road=1/);
});

test("industrial-water plan confirmation survives sharing and clears with zero demand", async ({ page }) => {
  await gotoHydratedDashboard(page);
  const infrastructureStep = page.getByRole("navigation", { name: "입력 단계" })
    .getByRole("button", { name: /^4 인프라/ });
  await infrastructureStep.click();

  await page.getByRole("spinbutton", { name: /용수 수요/ }).fill("1500");
  const planReview = page.getByRole("group", {
    name: "국가수도기본계획·수도정비계획 반영 필요 여부",
  });
  await planReview.getByRole("button", { name: "계획 반영·변경 필요" }).click();
  await expect(page).toHaveURL(/spr=.*industrial-water-master-plan-reflection-consultation/);
  await expect(page).toHaveURL(/spt=.*industrial-water-master-plan-reflection-consultation/);

  await page.reload();
  await page.waitForLoadState("networkidle");
  await infrastructureStep.click();
  await expect(page.getByRole("heading", { name: "인프라" })).toBeVisible();
  await expect(planReview.getByRole("button", { name: "계획 반영·변경 필요" }))
    .toHaveAttribute("aria-pressed", "true");

  await page.getByRole("spinbutton", { name: /용수 수요/ }).fill("0");
  await expect(page.getByText("추가 용수수요 없음")).toBeVisible();
  await expect(page).not.toHaveURL(/industrial-water-master-plan-reflection-consultation/);
});

test("wizard separates official detail sources from external references", async ({ page }) => {
  await gotoHydratedDashboard(page);
  await expect(page.getByRole("heading", { name: "지역투자 인허가 로드맵" })).toBeVisible();
  await page.getByRole("button", { name: "개별입지", exact: true }).click();
  await expect(page.getByText(/지역 미입력 · 개별입지/)).toBeVisible();
  await page.getByRole("button", { name: /공장설립·증설·업종변경 승인/ }).click();
  await expect(page.getByRole("dialog", { name: /공장설립·증설·업종변경 승인 상세정보/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /원문 열기/ }).first()).toHaveAttribute("href", /^https:\/\//);
  const korea100Link = page.getByRole("link", {
    name: /공장설립승인 \| 대한민국 제도 지도/,
  });
  await expect(korea100Link).toHaveAttribute(
    "href",
    "https://hosungseo.github.io/korea100/model/factory-establishment/",
  );
  await expect(korea100Link).toHaveAttribute("target", "_blank");
  await expect(korea100Link).toHaveAttribute("rel", "noopener noreferrer");
});

test("capital-region location survives sharing and exposes the extra factory review", async ({ page }) => {
  await gotoHydratedDashboard(page);
  const provinceSelect = page.locator('select:has(option[value="경기도"])');
  await provinceSelect.selectOption("경기도");
  const citySelect = page.locator('select:has(option[value="고양시"])');
  await citySelect.selectOption("고양시");

  await expect(page.getByText("수도권 공장입지 추가 확인")).toBeVisible();
  await expect(page.getByRole("button", {
    name: /수도권 공장입지 제한·예외·총량 확인 상세 보기/,
  })).toBeVisible();
  await expect(page.getByRole("link", { name: "고양시" }).first()).toHaveAttribute(
    "href",
    /ctpvCd=41&sggCd=470/,
  );
  await expect(page).toHaveURL(/pr=%EA%B2%BD%EA%B8%B0%EB%8F%84/);
  await expect(page).toHaveURL(/ct=%EA%B3%A0%EC%96%91%EC%8B%9C/);

  await page.reload();
  await expect(provinceSelect).toHaveValue("경기도");
  await expect(citySelect).toHaveValue("고양시");
});

test("AI data-center special-law selection is reflected in the result and share URL", async ({ page }) => {
  await gotoHydratedDashboard(page);
  await page.getByLabel("업종·주요 공정").selectOption("AI_DATA_CENTER");
  await expect(page.getByRole("heading", { name: "특별법 간소화·면제 점검" })).toBeVisible();

  await page.getByRole("button", { name: "요건 확인", exact: true }).click();
  await page.getByRole("checkbox", { name: /인허가 일괄처리/ }).check();
  await page.getByLabel("평가 기준일").fill("2027-04-01");

  await expect(page.getByText("선택 반영", { exact: true })).toBeVisible();
  await expect(page.getByText(/일괄처리는 면제가 아니며/)).toBeVisible();
  await expect(page).toHaveURL(/ind=AI_DATA_CENTER/);
  await expect(page).toHaveURL(/sl=AIDC_ONE_STOP/);
  await expect(page).toHaveURL(/aic=1/);
  await expect(page).toHaveURL(/aos=PLANNED/);
});

test("share URL restores state and tabs", async ({ page }) => {
  await gotoHydratedDashboard(page);
  await page.getByRole("button", { name: "증설", exact: true }).click();
  await page.getByRole("tab", { name: /확인 필요/ }).click();
  await expect(page).toHaveURL(/tab=GAPS/);
  const url = page.url();
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "판정에 필요한 추가 정보" }))
    .toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "증설", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("downloads the current result report with its A3 overview", async ({ page }) => {
  await gotoHydratedDashboard(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "결과보고서 다운로드" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(
    /^인허가-결과보고서_.+_\d{8}-\d{6}\.pdf$/u,
  );
  expect(await download.failure()).toBeNull();
  await expect(page.locator("#pdf-report-status")).toContainText("다운로드했습니다");
});

test("downloads a usable XLSX practical workbook", async ({ page }) => {
  test.setTimeout(60_000);
  await gotoHydratedDashboard(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "스프레드시트 다운로드" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(
    /^인허가-실무관리표_.+_\d{8}-\d{6}\.xlsx$/u,
  );
  expect(await download.failure()).toBeNull();
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const file = await readFile(downloadPath!);
  const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  const workbook = readWorkbookBuffer(new Uint8Array(buffer));
  expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
    "실무 관리표",
    "요약",
    "사업조건",
    "선후행 관계",
    "특례·지역조례",
    "공식 근거",
    "확인·제외",
  ]);
  expect(workbook.getWorksheet("실무 관리표")!.getCell("B5").value).toBe("미착수");
  expect(workbook.getWorksheet("공식 근거")!.getCell("H5").value).toMatchObject({
    hyperlink: expect.stringMatching(/^https:\/\//),
  });
  await expect(page.locator("#spreadsheet-report-status")).toContainText("다운로드했습니다");
});
