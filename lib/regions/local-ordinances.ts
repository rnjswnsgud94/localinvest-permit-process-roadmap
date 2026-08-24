/**
 * Official local-ordinance directory for the nationwide dashboard.
 *
 * ELIS (the Ministry of the Interior and Safety's Local Laws and Regulations
 * Information System) keeps its own jurisdiction codes in public URLs.  They
 * are deliberately stored here instead of being derived from a road-address
 * code.  In particular, ELIS still uses `42` for Gangwon in this endpoint.
 *
 * This module links to the current ordinance *list* for a jurisdiction.  It
 * does not assert that a named ordinance exists, or that a local threshold is
 * applicable, until the actual text has been reviewed.
 */

const ELIS_JURISDICTION_LIST_URL =
  "https://www.elis.go.kr/alrpop/locgovAlrPopup";

export type OrdinanceGovernmentLevel = "PROVINCE" | "MUNICIPALITY";
export type OrdinanceReviewScope =
  | OrdinanceGovernmentLevel
  | "PROVINCE_AND_MUNICIPALITY";

export interface OfficialOrdinanceLink {
  name: string;
  level: OrdinanceGovernmentLevel;
  url: string;
  source: "행정안전부 자치법규정보시스템";
}

export interface LocalOrdinanceLinkResult {
  province: OfficialOrdinanceLink | null;
  municipality: OfficialOrdinanceLink | null;
  notice: string | null;
}

export interface LocalOrdinanceLegalBasis {
  title: string;
  provisions: string;
  officialUrl: string;
}

export interface LocalOrdinanceReviewCategory {
  id: string;
  title: string;
  scope: OrdinanceReviewScope;
  searchTerms: readonly string[];
  /** Title fragments used to resolve current official ordinance records. */
  ordinanceNamePatterns: readonly string[];
  affects: string;
  reviewPoint: string;
  legalBasis: readonly LocalOrdinanceLegalBasis[];
  limitation: string;
}

export interface ElisJurisdictionTarget {
  name: string;
  level: OrdinanceGovernmentLevel;
  listUrl: string;
}

export interface ElisTransitionalJurisdictionTarget
  extends ElisJurisdictionTarget {
  notice: string;
  legalBasisUrl: string;
}

/**
 * Reject ordinance-list titles that are not a current, generally applicable
 * ordinance for the dashboard's factory-site review categories.
 */
export function isOrdinanceReviewTitleCandidate(title: string): boolean {
  const candidate = title
    .normalize("NFKC")
    .replace(/[\s·ㆍ・,.'’‘"“”()（）\-_/]/g, "")
    .toLowerCase();
  if (/(?:일부|전부)개정(?:조례|규칙)(?:안)?|폐지(?:조례|규칙)(?:안)?/.test(candidate)) {
    return false;
  }
  if (candidate.includes("이륜자동차")) return false;
  if (/축사.*악취|악취.*축사/.test(candidate)) return false;
  return true;
}

interface MunicipalityDirectoryEntry {
  name: string;
  elisMunicipalityCode: string | null;
  aliases?: readonly string[];
  noIndependentOrdinanceReason?: string;
}

interface ProvinceDirectoryEntry {
  name: string;
  aliases?: readonly string[];
  elisProvinceCode: string;
  /** `000` for an ordinary province; Sejong is a single-tier exception. */
  elisProvinceListCode: string;
  municipalities: readonly MunicipalityDirectoryEntry[];
}

function municipality(
  name: string,
  elisMunicipalityCode: string,
  aliases: readonly string[] = [],
): MunicipalityDirectoryEntry {
  return { name, elisMunicipalityCode, aliases };
}

const provinceDirectory: readonly ProvinceDirectoryEntry[] = [
  {
    name: "서울특별시",
    elisProvinceCode: "11",
    elisProvinceListCode: "000",
    municipalities: [
      municipality("종로구", "110"), municipality("중구", "140"),
      municipality("용산구", "170"), municipality("성동구", "200"),
      municipality("광진구", "215"), municipality("동대문구", "230"),
      municipality("중랑구", "260"), municipality("성북구", "290"),
      municipality("강북구", "300"), municipality("도봉구", "320"),
      municipality("노원구", "350"), municipality("은평구", "380"),
      municipality("서대문구", "410"), municipality("마포구", "440"),
      municipality("양천구", "470"), municipality("강서구", "500"),
      municipality("구로구", "530"), municipality("금천구", "545"),
      municipality("영등포구", "560"), municipality("동작구", "590"),
      municipality("관악구", "620"), municipality("서초구", "650"),
      municipality("강남구", "680"), municipality("송파구", "710"),
      municipality("강동구", "740"),
    ],
  },
  {
    name: "인천광역시",
    elisProvinceCode: "28",
    elisProvinceListCode: "000",
    municipalities: [
      municipality("제물포구", "125"), municipality("영종구", "155"),
      municipality("미추홀구", "177"), municipality("연수구", "180"),
      municipality("남동구", "200"), municipality("부평구", "240"),
      municipality("계양구", "250"), municipality("서해구", "275"),
      municipality("검단구", "290"), municipality("강화군", "710"),
      municipality("옹진군", "720"),
    ],
  },
  {
    name: "경기도",
    elisProvinceCode: "41",
    elisProvinceListCode: "000",
    municipalities: [
      municipality("수원시", "110"), municipality("성남시", "130"),
      municipality("의정부시", "150"), municipality("안양시", "170"),
      municipality("부천시", "190"), municipality("광명시", "210"),
      municipality("평택시", "220"), municipality("동두천시", "250"),
      municipality("안산시", "270"), municipality("고양시", "470"),
      municipality("과천시", "290"), municipality("구리시", "310"),
      municipality("남양주시", "360"), municipality("오산시", "370"),
      municipality("시흥시", "390"), municipality("군포시", "410"),
      municipality("의왕시", "430"), municipality("하남시", "450"),
      municipality("용인시", "490"), municipality("파주시", "510"),
      municipality("이천시", "530"), municipality("안성시", "860"),
      municipality("김포시", "870"), municipality("화성시", "750"),
      municipality("광주시", "610"), municipality("양주시", "630"),
      municipality("포천시", "650"), municipality("여주시", "670"),
      municipality("연천군", "800"), municipality("가평군", "820"),
      municipality("양평군", "830"),
    ],
  },
  {
    name: "부산광역시",
    elisProvinceCode: "26",
    elisProvinceListCode: "000",
    municipalities: [
      municipality("중구", "110"), municipality("서구", "140"),
      municipality("동구", "170"), municipality("영도구", "200"),
      municipality("부산진구", "230"), municipality("동래구", "260"),
      municipality("남구", "290"), municipality("북구", "320"),
      municipality("해운대구", "350"), municipality("사하구", "380"),
      municipality("금정구", "410"), municipality("강서구", "440"),
      municipality("연제구", "470"), municipality("수영구", "500"),
      municipality("사상구", "530"), municipality("기장군", "710"),
    ],
  },
  {
    name: "대구광역시",
    elisProvinceCode: "27",
    elisProvinceListCode: "000",
    municipalities: [
      municipality("중구", "110"), municipality("동구", "140"),
      municipality("서구", "170"), municipality("남구", "200"),
      municipality("북구", "230"), municipality("수성구", "260"),
      municipality("달서구", "290"), municipality("달성군", "710"),
      municipality("군위군", "720"),
    ],
  },
  {
    name: "전남광주통합특별시",
    aliases: ["광주광역시", "전라남도"],
    elisProvinceCode: "12",
    elisProvinceListCode: "000",
    municipalities: [
      municipality("목포시", "110"), municipality("여수시", "130"),
      municipality("순천시", "150"), municipality("나주시", "170"),
      municipality("광양시", "190"), municipality("동구", "210"),
      municipality("서구", "240"), municipality("남구", "270"),
      municipality("북구", "300"), municipality("광산구", "330"),
      municipality("담양군", "710"), municipality("곡성군", "720"),
      municipality("구례군", "730"), municipality("고흥군", "740"),
      municipality("보성군", "750"), municipality("화순군", "760"),
      municipality("장흥군", "770"), municipality("강진군", "780"),
      municipality("해남군", "790"), municipality("영암군", "800"),
      municipality("무안군", "810"), municipality("함평군", "820"),
      municipality("영광군", "830"), municipality("장성군", "840"),
      municipality("완도군", "850"), municipality("진도군", "860"),
      municipality("신안군", "870"),
    ],
  },
  {
    name: "대전광역시",
    elisProvinceCode: "30",
    elisProvinceListCode: "000",
    municipalities: [
      municipality("동구", "110"), municipality("중구", "140"),
      municipality("서구", "170"), municipality("유성구", "200"),
      municipality("대덕구", "230"),
    ],
  },
  {
    name: "울산광역시",
    elisProvinceCode: "31",
    elisProvinceListCode: "000",
    municipalities: [
      municipality("중구", "110"), municipality("남구", "140"),
      municipality("동구", "170"), municipality("북구", "200"),
      municipality("울주군", "710"),
    ],
  },
  {
    name: "세종특별자치시",
    elisProvinceCode: "36",
    elisProvinceListCode: "110",
    municipalities: [],
  },
  {
    name: "강원특별자치도",
    // ELIS retains the former Gangwon prefix in its ordinance-list endpoint.
    elisProvinceCode: "42",
    elisProvinceListCode: "000",
    municipalities: [
      municipality("춘천시", "110"), municipality("원주시", "130"),
      municipality("강릉시", "150"), municipality("동해시", "170"),
      municipality("태백시", "190"), municipality("속초시", "210"),
      municipality("삼척시", "230"), municipality("홍천군", "720"),
      municipality("횡성군", "730"), municipality("영월군", "750"),
      municipality("평창군", "760"), municipality("정선군", "770"),
      municipality("철원군", "780"), municipality("화천군", "790"),
      municipality("양구군", "800"), municipality("인제군", "810"),
      municipality("고성군", "820"), municipality("양양군", "830"),
    ],
  },
  {
    name: "충청북도",
    elisProvinceCode: "43",
    elisProvinceListCode: "000",
    municipalities: [
      municipality("청주시", "110"), municipality("충주시", "130"),
      municipality("제천시", "150"), municipality("보은군", "720"),
      municipality("옥천군", "730"), municipality("영동군", "740"),
      municipality("증평군", "745"), municipality("진천군", "750"),
      municipality("괴산군", "760"), municipality("음성군", "770"),
      municipality("단양군", "800"),
    ],
  },
  {
    name: "충청남도",
    elisProvinceCode: "44",
    elisProvinceListCode: "000",
    municipalities: [
      municipality("천안시", "130"), municipality("공주시", "150"),
      municipality("보령시", "180"), municipality("아산시", "200"),
      municipality("서산시", "210"), municipality("논산시", "230"),
      municipality("계룡시", "250"), municipality("당진시", "270"),
      municipality("금산군", "710"), municipality("부여군", "760"),
      municipality("서천군", "770"), municipality("청양군", "790"),
      municipality("홍성군", "800"), municipality("예산군", "810"),
      municipality("태안군", "825"),
    ],
  },
  {
    name: "전북특별자치도",
    elisProvinceCode: "52",
    elisProvinceListCode: "000",
    municipalities: [
      municipality("전주시", "110"), municipality("군산시", "130"),
      municipality("익산시", "140"), municipality("정읍시", "180"),
      municipality("남원시", "190"), municipality("김제시", "210"),
      municipality("완주군", "710"), municipality("진안군", "720"),
      municipality("무주군", "730"), municipality("장수군", "740"),
      municipality("임실군", "750"), municipality("순창군", "770"),
      municipality("고창군", "790"), municipality("부안군", "800"),
    ],
  },
  {
    name: "경상북도",
    elisProvinceCode: "47",
    elisProvinceListCode: "000",
    municipalities: [
      municipality("포항시", "110"), municipality("경주시", "130"),
      municipality("김천시", "150"), municipality("안동시", "170"),
      municipality("구미시", "190"), municipality("영주시", "210"),
      municipality("영천시", "230"), municipality("상주시", "250"),
      municipality("문경시", "280"), municipality("경산시", "290"),
      municipality("의성군", "730"), municipality("청송군", "750"),
      municipality("영양군", "760"), municipality("영덕군", "770"),
      municipality("청도군", "820"), municipality("고령군", "830"),
      municipality("성주군", "840"), municipality("칠곡군", "850"),
      municipality("예천군", "900"), municipality("봉화군", "920"),
      municipality("울진군", "930"), municipality("울릉군", "940"),
    ],
  },
  {
    name: "경상남도",
    elisProvinceCode: "48",
    elisProvinceListCode: "000",
    municipalities: [
      municipality("창원시", "900"), municipality("진주시", "170"),
      municipality("통영시", "220"), municipality("사천시", "240"),
      municipality("김해시", "250"), municipality("밀양시", "270"),
      municipality("거제시", "310"), municipality("양산시", "330"),
      municipality("의령군", "720"), municipality("함안군", "730"),
      municipality("창녕군", "740"), municipality("고성군", "820"),
      municipality("남해군", "840"), municipality("하동군", "850"),
      municipality("산청군", "860"), municipality("함양군", "870"),
      municipality("거창군", "880"), municipality("합천군", "890"),
    ],
  },
  {
    name: "제주특별자치도",
    elisProvinceCode: "50",
    elisProvinceListCode: "000",
    municipalities: [
      {
        name: "제주시",
        elisMunicipalityCode: null,
        noIndependentOrdinanceReason:
          "제주특별법 제10조에 따른 지방자치단체가 아닌 행정시이므로 제주특별자치도 자치법규를 확인합니다.",
      },
      {
        name: "서귀포시",
        elisMunicipalityCode: null,
        noIndependentOrdinanceReason:
          "제주특별법 제10조에 따른 지방자치단체가 아닌 행정시이므로 제주특별자치도 자치법규를 확인합니다.",
      },
    ],
  },
] as const;

export const officialLocalOrdinanceDirectorySource = {
  title: "행정안전부 자치법규정보시스템 자치단체별 자치법규",
  url: "https://www.elis.go.kr/locgovalr/locgovClAlrList",
  guideUrl: "https://www.elis.go.kr/sysinfo/guide",
  reviewedAt: "2026-08-24",
  coverageNote:
    "관할 링크는 전체 현행 목록으로 이동하며, 대시보드의 지역기준 카드는 실제 관련 조례 상세 원문을 별도로 조회합니다.",
} as const;

export function buildElisJurisdictionListUrl(
  elisProvinceCode: string,
  elisMunicipalityCode: string,
): string {
  if (!/^\d{2}$/.test(elisProvinceCode) || !/^\d{3}$/.test(elisMunicipalityCode)) {
    throw new Error("ELIS 관할코드 형식이 올바르지 않습니다.");
  }
  const url = new URL(ELIS_JURISDICTION_LIST_URL);
  url.searchParams.set("ctpvCd", elisProvinceCode);
  url.searchParams.set("sggCd", elisMunicipalityCode);
  return url.toString();
}

function normalizeJurisdictionName(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

function findProvince(value: string): ProvinceDirectoryEntry | undefined {
  const normalized = normalizeJurisdictionName(value);
  return provinceDirectory.find(
    (entry) =>
      [entry.name, ...(entry.aliases ?? [])].some(
        (candidate) => normalizeJurisdictionName(candidate) === normalized,
      ),
  );
}

function findMunicipality(
  province: ProvinceDirectoryEntry,
  value: string,
): MunicipalityDirectoryEntry | undefined {
  const normalized = normalizeJurisdictionName(value).replace(
    normalizeJurisdictionName(province.name),
    "",
  );
  return province.municipalities.find((entry) =>
    [entry.name, ...(entry.aliases ?? [])].some(
      (candidate) => normalizeJurisdictionName(candidate) === normalized,
    ),
  );
}

export function listSupportedMunicipalities(province: string): readonly string[] {
  return findProvince(province)?.municipalities.map((entry) => entry.name) ?? [];
}

export function getOfficialLocalOrdinanceLinks(
  provinceName: string,
  municipalityName = "",
): LocalOrdinanceLinkResult {
  const province = findProvince(provinceName);
  if (!province) {
    return {
      province: null,
      municipality: null,
      notice: "지원하는 시·도를 선택하면 공식 자치법규 링크가 표시됩니다.",
    };
  }

  const provinceLink: OfficialOrdinanceLink = {
    name: province.name,
    level: "PROVINCE",
    url: buildElisJurisdictionListUrl(
      province.elisProvinceCode,
      province.elisProvinceListCode,
    ),
    source: "행정안전부 자치법규정보시스템",
  };

  if (!municipalityName.trim()) {
    return {
      province: provinceLink,
      municipality: null,
      notice:
        province.municipalities.length > 0
          ? "시·군·구를 선택하면 기초자치단체의 현행 자치법규 목록도 함께 표시됩니다."
          : null,
    };
  }

  const selectedMunicipality = findMunicipality(province, municipalityName);
  if (!selectedMunicipality) {
    return {
      province: provinceLink,
      municipality: null,
      notice:
        "입력한 시·군·구의 공식 관할코드를 확인하지 못했습니다. 광역 자치법규와 관할기관을 먼저 확인하세요.",
    };
  }

  if (!selectedMunicipality.elisMunicipalityCode) {
    return {
      province: provinceLink,
      municipality: null,
      notice: selectedMunicipality.noIndependentOrdinanceReason ?? null,
    };
  }

  return {
    province: provinceLink,
    municipality: {
      name: selectedMunicipality.name,
      level: "MUNICIPALITY",
      url: buildElisJurisdictionListUrl(
        province.elisProvinceCode,
        selectedMunicipality.elisMunicipalityCode,
      ),
      source: "행정안전부 자치법규정보시스템",
    },
    notice: null,
  };
}

export function getElisJurisdictionTargets(
  provinceName: string,
  municipalityName = "",
): readonly ElisJurisdictionTarget[] {
  const links = getOfficialLocalOrdinanceLinks(provinceName, municipalityName);
  return [links.province, links.municipality]
    .filter((link): link is OfficialOrdinanceLink => link !== null)
    .map((link) => ({ name: link.name, level: link.level, listUrl: link.url }));
}

const formerGwangjuDistricts = new Set([
  "동구",
  "서구",
  "남구",
  "북구",
  "광산구",
]);

/**
 * The 2026 integrated city keeps former Gwangju/Jeonnam ordinances in force
 * for their former territories until replacement ordinances are enacted.
 * These are deliberately returned as labelled list fallbacks, not as a claim
 * that any individual legacy ordinance applies to the selected parcel.
 */
export function getElisTransitionalJurisdictionTargets(
  provinceName: string,
  municipalityName = "",
): readonly ElisTransitionalJurisdictionTarget[] {
  const province = findProvince(provinceName);
  if (province?.name !== "전남광주통합특별시") return [];

  const selected = findMunicipality(province, municipalityName);
  const selectedName = selected?.name ?? "";
  if (!selectedName) return [];
  const legacyAreas = formerGwangjuDistricts.has(selectedName)
      ? (["GWANGJU"] as const)
      : (["JEONNAM"] as const);
  const legalBasisUrl =
    "https://www.law.go.kr/법령/전남광주통합특별시설치를위한특별법";

  return legacyAreas.map((area) => ({
    name: area === "GWANGJU" ? "종전 광주광역시" : "종전 전라남도",
    level: "PROVINCE" as const,
    listUrl: buildElisJurisdictionListUrl(
      area === "GWANGJU" ? "29" : "46",
      "000",
    ),
    notice:
      area === "GWANGJU"
        ? "통합 전 광주광역시 권역에 한해 종전 조례의 경과 적용 여부를 확인합니다."
        : "통합 전 전라남도 권역에 한해 종전 조례의 경과 적용 여부를 확인합니다.",
    legalBasisUrl,
  }));
}

export function buildElisOrdinanceDetailUrl(
  _ordinanceName: string,
  alrNo: string,
  histNo: string,
): string {
  if (!/^\d{14}$/.test(alrNo) || !/^\d{3}$/.test(histNo)) {
    throw new Error("ELIS 자치법규 식별자 형식이 올바르지 않습니다.");
  }
  const url = new URL("https://www.elis.go.kr/alrpop/alrDtlsPop");
  url.searchParams.set("alrNo", alrNo);
  url.searchParams.set("histNo", histNo);
  return url.toString();
}

export function isElisOrdinanceDetailUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const keys = [...url.searchParams.keys()];
    return (
      url.protocol === "https:" &&
      url.hostname === "www.elis.go.kr" &&
      url.port === "" &&
      url.username === "" &&
      url.password === "" &&
      url.pathname === "/alrpop/alrDtlsPop" &&
      url.hash === "" &&
      keys.length === 2 &&
      new Set(keys).size === 2 &&
      keys.every((key) => key === "alrNo" || key === "histNo") &&
      /^\d{14}$/.test(url.searchParams.get("alrNo") ?? "") &&
      /^\d{3}$/.test(url.searchParams.get("histNo") ?? "")
    );
  } catch {
    return false;
  }
}

/**
 * Cross-jurisdiction review taxonomy.
 *
 * These records say where local law can change a factory project's route,
 * threshold, design or cost.  They intentionally do not pre-fill a local
 * result: applicability must be established from the selected jurisdiction's
 * current ordinance, rule, annex and (where relevant) public notice.
 */
export const localOrdinanceReviewCategories: readonly LocalOrdinanceReviewCategory[] = [
  {
    id: "urban-planning-development",
    title: "도시계획·개발행위 기준",
    scope: "PROVINCE_AND_MUNICIPALITY",
    searchTerms: ["도시계획 조례", "개발행위", "공장", "경사도", "입목축적"],
    ordinanceNamePatterns: [
      "도시·군계획 조례",
      "도시계획 조례",
      "군계획 조례",
      "장흥군 관리계획 조례",
      "무안군 관리계획 조례",
    ],
    affects:
      "용도지역별 공장 건축 가능 여부와 개발행위허가의 경사도·표고·입목·도로 등 입지 심사기준",
    reviewPoint:
      "필지의 용도지역·지구, 공장 업종, 개발면적과 조례 별표의 건축제한 및 개발행위 기준을 대조합니다.",
    legalBasis: [
      {
        title: "국토의 계획 및 이용에 관한 법률 및 시행령",
        provisions: "법 제58조·제76조, 시행령 제56조 및 별표 1의2·별표 2부터 별표 22까지",
        officialUrl: "https://www.law.go.kr/법령/국토의계획및이용에관한법률",
      },
    ],
    limitation:
      "조례 외에도 도시·군관리계획, 지구단위계획과 개별 필지 규제를 확인해야 하므로 업종명만으로 확정하지 않습니다.",
  },
  {
    id: "building-review-design",
    title: "건축심의·대지 및 건축기준",
    scope: "PROVINCE_AND_MUNICIPALITY",
    searchTerms: ["건축 조례", "건축위원회", "대지안의 조경", "대지안의 공지"],
    ordinanceNamePatterns: ["건축 조례"],
    affects:
      "건축위원회 심의대상·제출시점, 조경, 대지 안의 공지와 일부 건축기준",
    reviewPoint:
      "공장 연면적·층수·구조·특수건축물 여부와 조례상 위원회 심의 및 설계기준을 확인합니다.",
    legalBasis: [
      {
        title: "건축법",
        provisions: "제4조·제4조의2 및 조례에 위임된 건축기준 조문",
        officialUrl: "https://www.law.go.kr/법령/건축법",
      },
    ],
    limitation:
      "건축조례는 전국 공통 건축허가를 대체하지 않으며, 지역별 추가 심의·설계사항만 확정 검토합니다.",
  },
  {
    id: "parking-installation",
    title: "부설주차장 설치기준",
    scope: "PROVINCE_AND_MUNICIPALITY",
    searchTerms: ["주차장 조례", "부설주차장", "공장", "시설면적"],
    ordinanceNamePatterns: [
      "주차장 조례",
      "주차장 설치 및 관리 조례",
      "부설주차장 설치비용",
      "영광군 주차장 설치 및 관리운영 조례",
      "영동군 주차장 운영 조례",
      "논산시 주차장 설치 및 사용료 징수 조례",
      "금산군 주차장 설치 및 사용료 징수 조례",
      "계룡시 주차장 설치 조례",
      "예산군 주차장 설치 조례",
      "청양군 주차장 설치 조례",
      "홍성군 주차장설치 조례",
    ],
    affects: "공장 면적에 따른 부설주차장 대수, 설치제한지역과 인근 설치 범위",
    reviewPoint:
      "건축물 용도와 시설면적을 조례 별표의 공장 설치기준에 적용합니다.",
    legalBasis: [
      {
        title: "주차장법",
        provisions: "제19조",
        officialUrl: "https://www.law.go.kr/법령/주차장법",
      },
    ],
    limitation:
      "주차대수는 조례 별표와 당시 건축물 용도분류를 확인한 뒤 계산하며 전국 단일계수로 대체하지 않습니다.",
  },
  {
    id: "traffic-impact",
    title: "교통영향평가 지역기준",
    scope: "PROVINCE",
    searchTerms: ["교통영향평가 조례", "공장", "건축물", "심의"],
    ordinanceNamePatterns: ["교통영향평가", "교통영향분석"],
    affects:
      "교통영향평가 대상 규모와 지역별 추가 대상, 교통영향평가심의위원회 심의범위",
    reviewPoint:
      "도시교통정비지역 여부, 공장 연면적과 시·도 조례의 대상사업·건축물 기준을 함께 확인합니다.",
    legalBasis: [
      {
        title: "도시교통정비 촉진법 및 시행령",
        provisions: "법 제15조, 시행령 제13조의2·제13조의4 및 별표 1",
        officialUrl: "https://www.law.go.kr/법령/도시교통정비촉진법시행령",
      },
    ],
    limitation:
      "시·도 조례와 도시교통정비지역 지정 여부를 확인하기 전에는 면적만으로 평가대상을 확정하지 않습니다.",
  },
  {
    id: "local-environmental-impact-assessment",
    title: "시·도 조례 환경영향평가",
    scope: "PROVINCE",
    searchTerms: ["환경영향평가 조례", "지역환경영향평가", "대상사업", "공장", "산업단지"],
    ordinanceNamePatterns: ["환경영향평가 조례", "환경영향평가조례"],
    affects:
      "국가 환경영향평가 대상 규모 미만 사업에 대한 시·도 추가 평가대상, 평가서 작성·주민의견 수렴과 협의 절차",
    reviewPoint:
      "사업유형·개발면적·건축 연면적·입지와 시·도 조례 별표의 대상·제외·중복평가 기준을 대조합니다.",
    legalBasis: [
      {
        title: "환경영향평가법",
        provisions: "제42조",
        officialUrl: "https://www.law.go.kr/법령/환경영향평가법/제42조",
      },
    ],
    limitation:
      "시·도별 조례 유무와 별표 기준이 다르므로 수도권 또는 면적만으로 자동 확정하지 않고, 현행 조례 상세 원문과 승인기관·협의기관을 확인합니다.",
  },
  {
    id: "landscape-review",
    title: "경관심의 기준",
    scope: "PROVINCE_AND_MUNICIPALITY",
    searchTerms: ["경관 조례", "경관심의", "건축물", "개발사업"],
    ordinanceNamePatterns: [
      "경관 조례",
      "경관관리 조례",
      "경관 및 공공디자인 조례",
    ],
    affects: "지역별 경관심의·자문 대상, 제출자료와 심의시점",
    reviewPoint:
      "경관계획·중점경관관리구역, 공장 규모·높이와 조례가 추가한 심의대상을 확인합니다.",
    legalBasis: [
      {
        title: "경관법",
        provisions: "제26조부터 제30조까지",
        officialUrl: "https://www.law.go.kr/법령/경관법",
      },
    ],
    limitation:
      "경관조례뿐 아니라 해당 지역 경관계획과 구역지정 도면이 필요할 수 있습니다.",
  },
  {
    id: "air-water-standards",
    title: "지역 대기·수질 기준·환경정책",
    scope: "PROVINCE_AND_MUNICIPALITY",
    searchTerms: ["대기환경 조례", "배출허용기준", "수질환경 조례", "엄격한 배출허용기준"],
    ordinanceNamePatterns: ["대기환경", "수질환경", "배출허용기준"],
    affects: "강화된 지역 배출기준이 있는지와 대기·수질 환경정책 조례가 추가하는 협의·지원·관리사항",
    reviewPoint:
      "배출물질·농도·시설종류와 시·도 또는 대도시 조례의 강화기준·적용지역을 대조합니다.",
    legalBasis: [
      {
        title: "대기환경보전법",
        provisions: "제16조제3항",
        officialUrl: "https://www.law.go.kr/법령/대기환경보전법",
      },
      {
        title: "물환경보전법",
        provisions: "제32조제3항·제4항",
        officialUrl: "https://www.law.go.kr/법령/물환경보전법",
      },
    ],
    limitation:
      "조례 제목에 대기·수질이 포함돼도 강화 배출기준을 뜻하지 않을 수 있습니다. 별표의 수치기준과 위임근거를 확인한 경우에만 지역 강화기준으로 적용합니다.",
  },
  {
    id: "sewerage-wastewater-cost",
    title: "하수도 연결·원인자부담금",
    scope: "PROVINCE_AND_MUNICIPALITY",
    searchTerms: ["하수도 조례", "배수설비", "원인자부담금", "공공하수도"],
    ordinanceNamePatterns: [
      "하수도 사용 조례",
      "하수도 사용조례",
      "하수도 원인자부담금",
      "하수도 조례",
      "하수도 설치 및 관리 조례",
      "공공폐수처리시설 운영",
      "공공폐수처리시설 비용부담",
      "폐수종말처리시설 운영",
    ],
    affects:
      "배수설비 신고·준공검사, 공공하수도 유입조건, 원인자부담금의 산정·부과시점과 단가",
    reviewPoint:
      "생활오수·공정폐수를 구분하고 증가 오수량, 처리구역, 연결 가능용량과 최신 단가 공고를 확인합니다.",
    legalBasis: [
      {
        title: "하수도법",
        provisions: "제27조·제61조(특히 제61조제3항의 조례 위임)",
        officialUrl: "https://www.law.go.kr/법령/하수도법",
      },
    ],
    limitation:
      "부담금 단가는 조례 외 별도 연도별 공고일 수 있으며, 산업단지 공공폐수처리시설 비용부담규정도 별도 확인합니다.",
  },
  {
    id: "water-supply",
    title: "상수도 급수공사·부담금",
    scope: "PROVINCE_AND_MUNICIPALITY",
    searchTerms: ["수도급수 조례", "급수공사", "시설분담금", "원인자부담금"],
    ordinanceNamePatterns: [
      "상수도 급수 조례",
      "수도급수 조례",
      "상수도 원인자부담금",
      "수도 원인자부담금",
      "수도시설 원인자부담금",
      "수도시설의 원인자부담금",
      "수도급수 및 상수도특별회계 설치 조례",
      "수도급수 및 상수도 특별회계 설치 조례",
      "상수도 조례",
    ],
    affects: "급수공사 승인·준공검사, 시설분담금·원인자부담금과 대규모 수요 협의",
    reviewPoint:
      "일 최대·평균 용수수요, 인입관경, 공급구역·가압 필요성과 조례상 비용·절차를 확인합니다.",
    legalBasis: [
      {
        title: "수도법",
        provisions: "제38조 및 제71조",
        officialUrl: "https://www.law.go.kr/법령/수도법",
      },
    ],
    limitation:
      "조례 확인만으로 공급용량이 보장되지 않으므로 수도정비기본계획과 수도사업자 기술검토가 필요합니다.",
  },
  {
    id: "heritage-local-assets",
    title: "지역유산·보호구역 기준",
    scope: "PROVINCE_AND_MUNICIPALITY",
    searchTerms: ["국가유산 조례", "문화유산 조례", "보호구역", "역사문화환경"],
    ordinanceNamePatterns: [
      "문화유산 보호 조례",
      "문화유산의 보존 및 활용에 관한 조례",
      "문화유산 보존 및 활용에 관한 조례",
      "문화유산 보존 및 활용 조례",
      "문화유산보호관리 조례",
      "국가유산 보호관리 조례",
      "문화유산 및 자연유산 보호 조례",
      "향토문화유산 보호 조례",
      "향토문화유산 보호",
      "향토유산 보호 조례",
      "향토유산 보호",
      "향토문화재 보호",
      "향토문화유적 보호",
      "향토유산 발굴 및 보호",
      "향토유산 보존 및 활용",
      "향토유산 조례",
      "문화재 보호 조례",
      "자연유산의 보존 및 활용에 관한 조례",
      "역사문화환경 보존",
    ],
    affects: "시·도 지정유산과 보호구역, 역사문화환경 보존지역의 지역 심의·허가 경로",
    reviewPoint:
      "필지와 국가·시도 지정유산의 거리, 보호구역 도면, 현상변경 허용기준과 위임사무를 확인합니다.",
    legalBasis: [
      {
        title: "문화유산의 보존 및 활용에 관한 법률",
        provisions: "제13조·제70조·제74조",
        officialUrl:
          "https://www.law.go.kr/법령/문화유산의보존및활용에관한법률",
      },
    ],
    limitation:
      "조례명 검색만으로 보호구역 해당 여부를 판정하지 않으며 문화유산 공간정보와 관할부서 확인이 필요합니다.",
  },
] as const;

export const localOrdinanceCoverageCaveat =
  "조례명이 표시된 링크는 행정안전부 ELIS의 현행 상세 원문입니다. 상세 링크가 없으면 선택 관할 목록에서 최신 조문·별표·시행규칙·공고를 직접 확인해야 합니다.";
