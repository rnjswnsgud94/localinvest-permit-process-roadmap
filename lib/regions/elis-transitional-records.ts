import type { OfficialOrdinanceRecord } from "@/lib/regions/ordinance-resolution";
import {
  buildElisOrdinanceDetailUrl,
  getElisTransitionalJurisdictionTargets,
} from "@/lib/regions/local-ordinances";

type TransitionalSeed = {
  predecessor: "종전 광주광역시" | "종전 전라남도";
  name: string;
  alrNo: string;
  histNo: string;
};

const seeds: readonly TransitionalSeed[] = [
  { predecessor: "종전 광주광역시", name: "광주광역시 대기환경보전 조례", alrNo: "29000010001061", histNo: "005" },
  { predecessor: "종전 광주광역시", name: "광주광역시 공공폐수처리시설 운영 및 비용부담 조례", alrNo: "29000010006019", histNo: "004" },
  { predecessor: "종전 광주광역시", name: "광주광역시 하수도 사용 조례", alrNo: "29000010006018", histNo: "018" },
  { predecessor: "종전 광주광역시", name: "광주광역시 하수도 사용 조례 시행규칙", alrNo: "29000010006026", histNo: "012" },
  { predecessor: "종전 광주광역시", name: "광주광역시 도시계획 조례", alrNo: "29000011001061", histNo: "040" },
  { predecessor: "종전 광주광역시", name: "광주광역시 도시계획 조례 시행규칙", alrNo: "29000011001059", histNo: "016" },
  { predecessor: "종전 광주광역시", name: "광주광역시 건축 조례", alrNo: "29000011009017", histNo: "030" },
  { predecessor: "종전 광주광역시", name: "광주광역시 경관 조례", alrNo: "29000011009002", histNo: "008" },
  { predecessor: "종전 광주광역시", name: "광주광역시 주차장 조례", alrNo: "29000012004104", histNo: "026" },
  { predecessor: "종전 광주광역시", name: "광주광역시 상수도 원인자부담금 조례", alrNo: "29000016000067", histNo: "004" },
  { predecessor: "종전 광주광역시", name: "광주광역시 수도급수 조례", alrNo: "29000016000076", histNo: "023" },
  { predecessor: "종전 광주광역시", name: "광주광역시 상수도 원인자부담금 조례 시행규칙", alrNo: "29000016000056", histNo: "002" },
  { predecessor: "종전 광주광역시", name: "광주광역시 수도급수 조례 시행규칙", alrNo: "29000016000070", histNo: "017" },
  { predecessor: "종전 광주광역시", name: "광주광역시 문화유산 보존 및 활용에 관한 조례", alrNo: "29000005010038", histNo: "009" },
  { predecessor: "종전 전라남도", name: "전라남도 도시계획 조례", alrNo: "46000013001063", histNo: "019" },
  { predecessor: "종전 전라남도", name: "전라남도 교통영향분석·개선대책 심의위원회 운영규정", alrNo: "46000013008018", histNo: "005" },
  { predecessor: "종전 전라남도", name: "전라남도 건축 조례", alrNo: "46000013006091", histNo: "013" },
  { predecessor: "종전 전라남도", name: "전라남도 문화유산 보존 및 활용에 관한 조례", alrNo: "46000033002026", histNo: "008" },
  { predecessor: "종전 전라남도", name: "전라남도 자연유산의 보존 및 활용에 관한 조례", alrNo: "46000033002028", histNo: "001" },
  { predecessor: "종전 전라남도", name: "전라남도 문화재보호 조례 시행규칙", alrNo: "46000033002003", histNo: "004" },
  { predecessor: "종전 전라남도", name: "전라남도 경관 조례", alrNo: "46000033003010", histNo: "012" },
  { predecessor: "종전 전라남도", name: "전라남도 경관 조례 시행규칙", alrNo: "46000033003011", histNo: "006" },
] as const;

export function getTransitionalElisOrdinanceRecords(
  provinceName: string,
  municipalityName = "",
): OfficialOrdinanceRecord[] {
  const transition = getElisTransitionalJurisdictionTargets(
    provinceName,
    municipalityName,
  )[0];
  if (!transition) return [];

  return seeds
    .filter((seed) => seed.predecessor === transition.name)
    .map((seed) => ({
      name: seed.name,
      level: "PROVINCE" as const,
      jurisdictionName: transition.name,
      amendmentDate: null,
      url: buildElisOrdinanceDetailUrl(seed.name, seed.alrNo, seed.histNo),
      transitionNotice: transition.notice,
      transitionBasisUrl: transition.legalBasisUrl,
    }));
}
