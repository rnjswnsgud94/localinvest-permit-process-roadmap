import { describe, expect, it } from "vitest";

import type { NormalizedLawDocument } from "@/lib/law-api/types";
import {
  matchOrdinancesToCategories,
  resolveOfficialOrdinanceRecords,
} from "@/lib/regions/ordinance-resolution";

function ordinance(
  title: string,
  jurisdictionName: string | null = "충청남도 아산시",
): NormalizedLawDocument {
  return {
    target: "ordin",
    id: null,
    mst: null,
    title,
    promulgationDate: "20260818",
    proclamationNumber: null,
    effectiveDate: null,
    jurisdictionName,
    publicUrl: `https://www.law.go.kr/${encodeURIComponent("자치법규")}/${encodeURIComponent(title.replace(/\s+/g, ""))}`,
  };
}

describe("official local-ordinance resolver", () => {
  it("keeps only the selected jurisdiction and exposes a credential-free title URL", () => {
    const records = resolveOfficialOrdinanceRecords(
      [
        ordinance("아산시 도시계획 조례"),
        ordinance("천안시 도시계획 조례", "충청남도 천안시"),
      ],
      { name: "아산시", provinceName: "충청남도", level: "MUNICIPALITY" },
    );

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      name: "아산시 도시계획 조례",
      jurisdictionName: "아산시",
      amendmentDate: "2026-08-18",
    });
    expect(records[0].url).toContain("law.go.kr");
    expect(decodeURIComponent(records[0].url)).toContain("아산시도시계획조례");
    expect(records[0].url).not.toContain("OC=");
  });

  it("does not guess among same-named districts when agency metadata is absent", () => {
    const records = resolveOfficialOrdinanceRecords(
      [ordinance("중구 도시계획 조례", null)],
      { name: "중구", provinceName: "부산광역시", level: "MUNICIPALITY" },
    );
    expect(records).toEqual([]);
  });

  it("does not misclassify a municipality returned by a province-name search", () => {
    const records = resolveOfficialOrdinanceRecords(
      [
        ordinance("아산시 도시계획 조례"),
        ordinance("충청남도 도시계획 조례", "충청남도"),
      ],
      { name: "충청남도", provinceName: "충청남도", level: "PROVINCE" },
    );

    expect(records.map((record) => record.name)).toEqual([
      "충청남도 도시계획 조례",
    ]);
  });

  it("matches actual ordinance titles to only their relevant review categories", () => {
    const records = resolveOfficialOrdinanceRecords(
      [
        ordinance("아산시 도시계획 조례"),
        ordinance("아산시 건축 조례"),
        ordinance("아산시 소셜미디어 관리 및 운영에 관한 조례"),
      ],
      { name: "아산시", provinceName: "충청남도", level: "MUNICIPALITY" },
    );
    const matches = new Map(
      matchOrdinancesToCategories(records).map((item) => [
        item.categoryId,
        item.ordinances.map((item) => item.name),
      ]),
    );

    expect(matches.get("urban-planning-development")).toEqual([
      "아산시 도시계획 조례",
    ]);
    expect(matches.get("building-review-design")).toEqual([
      "아산시 건축 조례",
    ]);
    expect([...matches.values()].flat()).not.toContain(
      "아산시 소셜미디어 관리 및 운영에 관한 조례",
    );
  });

  it("matches separately titled sewerage originator-charge ordinances", () => {
    const matches = new Map(
      matchOrdinancesToCategories([
        {
          name: "가상군 하수도 원인자부담금 산정·징수 조례",
          level: "MUNICIPALITY",
          jurisdictionName: "가상군",
          amendmentDate: "2026-08-21",
          url: "https://www.elis.go.kr/alrpop/alrDtlsPop?alrNo=52730111111111&histNo=001",
        },
      ]).map((item) => [item.categoryId, item.ordinances]),
    );

    expect(matches.get("sewerage-wastewater-cost")).toContainEqual(
      expect.objectContaining({
        name: "가상군 하수도 원인자부담금 산정·징수 조례",
      }),
    );
  });

  it("does not hide reviewed ELIS detail links when a category has more than five matches", () => {
    const records = resolveOfficialOrdinanceRecords(
      Array.from({ length: 7 }, (_, index) =>
        ordinance(`아산시 제${index + 1}호 향토문화유산 보호 조례`),
      ),
      { name: "아산시", provinceName: "충청남도", level: "MUNICIPALITY" },
    );
    const heritage = matchOrdinancesToCategories(records).find(
      (item) => item.categoryId === "heritage-local-assets",
    );
    expect(heritage?.ordinances).toHaveLength(7);
  });

  it("rejects subject-specific parking, livestock odor, amendment-bill and repeal titles", () => {
    const names = [
      "영동군 주차장 운영 조례",
      "울산광역시 동구 이륜자동차 주차장 설치 및 관리 조례",
      "김해시 축사 악취 배출허용기준 및 가축분뇨 처리 지원 조례",
      "일본식 한자어 정비를 위한 진도군 향토문화유산 보호 조례 일부개정규칙안",
      "가상군 도시계획 조례 폐지조례안",
    ];
    const lookups = matchOrdinancesToCategories(
      names.map((name) => ({
        name,
        level: "MUNICIPALITY" as const,
        jurisdictionName: "검증지역",
        amendmentDate: "2026-08-23",
        url: "https://www.elis.go.kr/alrpop/alrDtlsPop?alrNo=52730111111111&histNo=001",
      })),
    );
    const matchedNames = lookups.flatMap((lookup) =>
      lookup.ordinances.map((ordinance) => ordinance.name),
    );

    expect(matchedNames).toContain("영동군 주차장 운영 조례");
    expect(matchedNames).not.toContain(names[1]);
    expect(matchedNames).not.toContain(names[2]);
    expect(matchedNames).not.toContain(names[3]);
    expect(matchedNames).not.toContain(names[4]);
  });
});
