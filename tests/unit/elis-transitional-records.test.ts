import { describe, expect, it } from "vitest";

import { getTransitionalElisOrdinanceRecords } from "@/lib/regions/elis-transitional-records";
import { matchOrdinancesToCategories } from "@/lib/regions/ordinance-resolution";

describe("integrated-city transitional ELIS records", () => {
  it("uses former Gwangju exact links only for the five former Gwangju districts", () => {
    const records = getTransitionalElisOrdinanceRecords(
      "전남광주통합특별시",
      "광산구",
    );
    expect(records.some((record) => record.name === "광주광역시 도시계획 조례")).toBe(true);
    expect(records.every((record) => record.jurisdictionName === "종전 광주광역시")).toBe(true);
    expect(records.every((record) => record.transitionNotice?.includes("광주광역시 권역"))).toBe(true);
    expect(records[0].url).toMatch(/elis\.go\.kr\/alrpop\/alrDtlsPop\?alrNo=\d{14}&histNo=\d{3}/);
  });

  it("uses former Jeonnam exact links for its former cities and counties", () => {
    const categories = new Map(
      matchOrdinancesToCategories(
        getTransitionalElisOrdinanceRecords(
          "전남광주통합특별시",
          "목포시",
        ),
      ).map((item) => [item.categoryId, item.ordinances]),
    );
    expect(categories.get("urban-planning-development")?.map((item) => item.name)).toContain(
      "전라남도 도시계획 조례",
    );
    expect(categories.get("building-review-design")?.map((item) => item.name)).toContain(
      "전라남도 건축 조례",
    );
    expect(categories.get("heritage-local-assets")?.length).toBeGreaterThan(0);
  });

  it("does not add predecessor laws without a selected territory or outside the integrated city", () => {
    expect(getTransitionalElisOrdinanceRecords("전남광주통합특별시")).toEqual([]);
    expect(getTransitionalElisOrdinanceRecords("충청남도", "아산시")).toEqual([]);
  });
});
