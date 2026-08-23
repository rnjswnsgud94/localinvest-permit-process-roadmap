import { expect, test, type Page } from "@playwright/test";

async function gotoHydratedDashboard(page: Page) {
  await page.goto("/");
  // The dashboard is server-rendered first. Its first share-state URL update is
  // a stable signal that React event handlers and client effects are ready.
  await expect(page).toHaveURL(/[?&]v=13(?:&|$)/);
}

test("desktop result summary uses the available width without cramped copy", async ({ page }) => {
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
      panelBottom: panel.bottom,
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
  expect(geometry!.footerBottom).toBeLessThanOrEqual(geometry!.viewportHeight + 1);
  expect(geometry!.bodyScrollHeight).toBeGreaterThan(geometry!.bodyClientHeight);
  expect(geometry!.remainingPageHeight).toBeGreaterThan(500);

  await body.hover();
  await page.mouse.wheel(0, 420);
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(geometry!.windowScrollY);

  await nextButton.click();
  await expect(wizard.getByText("2 / 5", { exact: true })).toBeVisible();
  await expect(nextButton).toBeInViewport();
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

test("wizard changes the route and detail links are official", async ({ page }) => {
  await gotoHydratedDashboard(page);
  await expect(page.getByRole("heading", { name: "지역투자 인허가 로드맵" })).toBeVisible();
  await page.getByRole("button", { name: "개별입지", exact: true }).click();
  await expect(page.getByText(/지역 미입력 · 개별입지/)).toBeVisible();
  await page.getByRole("button", { name: /공장설립·증설·업종변경 승인/ }).click();
  await expect(page.getByRole("dialog", { name: /공장설립·증설·업종변경 승인 상세정보/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /원문 열기/ }).first()).toHaveAttribute("href", /^https:\/\//);
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
  await expect(page.getByRole("heading", { name: "판정에 필요한 추가 정보" })).toBeVisible();
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
