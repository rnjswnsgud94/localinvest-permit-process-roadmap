import { describe, expect, it } from "vitest";

import { supportedRegions } from "@/lib/regions";
import {
  buildElisJurisdictionListUrl,
  buildElisOrdinanceDetailUrl,
  getOfficialLocalOrdinanceLinks,
  getElisTransitionalJurisdictionTargets,
  isElisOrdinanceDetailUrl,
  listSupportedMunicipalities,
  localOrdinanceReviewCategories,
} from "@/lib/regions/local-ordinances";

describe("official local-ordinance directory", () => {
  it("builds a stable official ELIS jurisdiction-list URL", () => {
    expect(buildElisJurisdictionListUrl("44", "200")).toBe(
      "https://www.elis.go.kr/alrpop/locgovAlrPopup?ctpvCd=44&sggCd=200",
    );
  });

  it("builds an exact ELIS detail URL only from reviewed identifiers", () => {
    expect(
      buildElisOrdinanceDetailUrl(
        "무주군 하수도 사용 조례",
        "52730129348001",
        "006",
      ),
    ).toBe(
      "https://www.elis.go.kr/alrpop/alrDtlsPop?alrNo=52730129348001&histNo=006",
    );
  });

  it("recognizes only exact ELIS ordinance-detail URLs", () => {
    expect(
      isElisOrdinanceDetailUrl(
        "https://www.elis.go.kr/alrpop/alrDtlsPop?alrNo=52730129348001&histNo=006",
      ),
    ).toBe(true);
    expect(
      isElisOrdinanceDetailUrl(
        "https://www.elis.go.kr/alrpop/locgovAlrPopup?ctpvCd=52&sggCd=730",
      ),
    ).toBe(false);
    expect(
      isElisOrdinanceDetailUrl(
        "https://www.elis.go.kr/alrpop/alrDtlsPop?alrNo=52730129348001&histNo=006&next=https://example.com",
      ),
    ).toBe(false);
    expect(
      isElisOrdinanceDetailUrl(
        "https://www.elis.go.kr.evil.example/alrpop/alrDtlsPop?alrNo=52730129348001&histNo=006",
      ),
    ).toBe(false);
  });

  it("rejects malformed ELIS jurisdiction and ordinance identifiers", () => {
    expect(() => buildElisJurisdictionListUrl("52", "../730")).toThrow(
      "ELIS 관할코드 형식",
    );
    expect(() =>
      buildElisOrdinanceDetailUrl("무주군 하수도 사용 조례", "not-an-id", "006"),
    ).toThrow("ELIS 자치법규 식별자 형식");
    expect(() =>
      buildElisOrdinanceDetailUrl("무주군 하수도 사용 조례", "52730129348001", "6"),
    ).toThrow("ELIS 자치법규 식별자 형식");
  });

  it("covers every province used by the nationwide dashboard", () => {
    for (const province of supportedRegions) {
      const links = getOfficialLocalOrdinanceLinks(province);
      expect(links.province?.name).toBe(province);
      expect(links.province?.url).toMatch(/^https:\/\/www\.elis\.go\.kr\//);
    }
  });

  it("resolves every listed autonomous municipality without cross-region guessing", () => {
    for (const province of supportedRegions) {
      for (const municipality of listSupportedMunicipalities(province)) {
        const links = getOfficialLocalOrdinanceLinks(province, municipality);
        if (province === "제주특별자치도") {
          expect(links.municipality).toBeNull();
          expect(links.notice).toContain("행정시");
        } else {
          expect(links.municipality?.name).toBe(municipality);
          expect(links.municipality?.url).toMatch(
            /^https:\/\/www\.elis\.go\.kr\/alrpop\/locgovAlrPopup\?ctpvCd=\d{2}&sggCd=\d{3}$/,
          );
        }
      }
    }
  });

  it("resolves separate official province and municipality lists", () => {
    const links = getOfficialLocalOrdinanceLinks("충청남도", "아산시");

    expect(links.province?.url).toContain("ctpvCd=44&sggCd=000");
    expect(links.municipality).toEqual(
      expect.objectContaining({
        name: "아산시",
        level: "MUNICIPALITY",
        url: "https://www.elis.go.kr/alrpop/locgovAlrPopup?ctpvCd=44&sggCd=200",
      }),
    );
    expect(links.notice).toBeNull();
  });

  it("accepts a province-prefixed municipality label", () => {
    expect(
      getOfficialLocalOrdinanceLinks("충청남도", "충청남도 아산시")
        .municipality?.name,
    ).toBe("아산시");
  });

  it("resolves same-named districts inside the selected province", () => {
    const seoul = getOfficialLocalOrdinanceLinks("서울특별시", "중구");
    const busan = getOfficialLocalOrdinanceLinks("부산광역시", "중구");
    const daegu = getOfficialLocalOrdinanceLinks("대구광역시", "중구");

    expect(seoul.municipality?.url).toContain("ctpvCd=11&sggCd=140");
    expect(busan.municipality?.url).toContain("ctpvCd=26&sggCd=110");
    expect(daegu.municipality?.url).toContain("ctpvCd=27&sggCd=110");
  });

  it("uses the current ELIS codes for reorganized Incheon and Gyeonggi cities", () => {
    expect(listSupportedMunicipalities("인천광역시")).toEqual(
      expect.arrayContaining(["제물포구", "영종구", "서해구", "검단구"]),
    );
    expect(listSupportedMunicipalities("인천광역시")).not.toEqual(
      expect.arrayContaining(["중구", "동구", "서구"]),
    );
    expect(
      getOfficialLocalOrdinanceLinks("인천광역시", "검단구").municipality?.url,
    ).toContain("ctpvCd=28&sggCd=290");
    expect(
      getOfficialLocalOrdinanceLinks("경기도", "고양시").municipality?.url,
    ).toContain("ctpvCd=41&sggCd=470");
    expect(
      getOfficialLocalOrdinanceLinks("경기도", "용인시").municipality?.url,
    ).toContain("ctpvCd=41&sggCd=490");
    expect(
      getOfficialLocalOrdinanceLinks("경기도", "화성시").municipality?.url,
    ).toContain("ctpvCd=41&sggCd=750");
  });

  it("uses the ELIS-preserved Gangwon code and current Jeonbuk code", () => {
    expect(
      getOfficialLocalOrdinanceLinks("강원특별자치도", "춘천시").municipality
        ?.url,
    ).toContain("ctpvCd=42&sggCd=110");
    expect(
      getOfficialLocalOrdinanceLinks("전북특별자치도", "전주시").municipality
        ?.url,
    ).toContain("ctpvCd=52&sggCd=110");
  });

  it("uses the current integrated Jeonnam-Gwangju and Changwon codes", () => {
    expect(
      getOfficialLocalOrdinanceLinks("전남광주통합특별시", "광산구")
        .municipality?.url,
    ).toContain("ctpvCd=12&sggCd=330");
    expect(
      getOfficialLocalOrdinanceLinks("전남광주통합특별시", "무안군")
        .municipality?.url,
    ).toContain("ctpvCd=12&sggCd=810");
    expect(
      getOfficialLocalOrdinanceLinks("경상남도", "창원시").municipality?.url,
    ).toContain("ctpvCd=48&sggCd=900");
  });

  it("uses the single-tier Sejong list", () => {
    const links = getOfficialLocalOrdinanceLinks("세종특별자치시");
    expect(links.province?.url).toContain("ctpvCd=36&sggCd=110");
    expect(listSupportedMunicipalities("세종특별자치시")).toEqual([]);
  });

  it("does not invent a basic ordinance link for Jeju administrative cities", () => {
    const links = getOfficialLocalOrdinanceLinks("제주특별자치도", "제주시");
    expect(links.province?.url).toContain("ctpvCd=50&sggCd=000");
    expect(links.municipality).toBeNull();
    expect(links.notice).toContain("지방자치단체가 아닌 행정시");
  });

  it("routes the integrated city's legacy ordinance lists only to their former territories", () => {
    expect(
      getElisTransitionalJurisdictionTargets(
        "전남광주통합특별시",
        "광산구",
      ).map((target) => target.listUrl),
    ).toEqual([
      "https://www.elis.go.kr/alrpop/locgovAlrPopup?ctpvCd=29&sggCd=000",
    ]);
    expect(
      getElisTransitionalJurisdictionTargets(
        "전남광주통합특별시",
        "목포시",
      ).map((target) => target.listUrl),
    ).toEqual([
      "https://www.elis.go.kr/alrpop/locgovAlrPopup?ctpvCd=46&sggCd=000",
    ]);
    expect(
      getElisTransitionalJurisdictionTargets("전남광주통합특별시"),
    ).toEqual([]);
    expect(
      getElisTransitionalJurisdictionTargets("충청남도", "아산시"),
    ).toEqual([]);
  });

  it("keeps an unverified free-text municipality visibly unresolved", () => {
    const links = getOfficialLocalOrdinanceLinks("충청남도", "가상시");
    expect(links.province).not.toBeNull();
    expect(links.municipality).toBeNull();
    expect(links.notice).toContain("공식 관할코드");
  });

  it("separates review categories from jurisdiction-specific conclusions", () => {
    expect(localOrdinanceReviewCategories.length).toBeGreaterThanOrEqual(9);
    expect(localOrdinanceReviewCategories.map((category) => category.id)).not.toContain(
      "investment-support-tax",
    );
    for (const category of localOrdinanceReviewCategories) {
      expect(category.searchTerms.length).toBeGreaterThan(0);
      expect(category.legalBasis.length).toBeGreaterThan(0);
      expect(category.limitation).not.toHaveLength(0);
      for (const basis of category.legalBasis) {
        expect(basis.officialUrl).toMatch(/^https:\/\/www\.law\.go\.kr\//);
      }
    }
  });
});
