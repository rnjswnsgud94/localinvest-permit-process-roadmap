export const nonCapitalRegions = [
  "부산광역시",
  "대구광역시",
  "전남광주통합특별시",
  "대전광역시",
  "울산광역시",
  "세종특별자치시",
  "강원특별자치도",
  "충청북도",
  "충청남도",
  "전북특별자치도",
  "경상북도",
  "경상남도",
  "제주특별자치도",
] as const;

export const capitalRegions = [
  "서울특별시",
  "인천광역시",
  "경기도",
] as const;

export const supportedRegions = [
  ...capitalRegions,
  ...nonCapitalRegions,
] as const;

export function isCapitalRegionProvince(value: string) {
  return (capitalRegions as readonly string[]).includes(value);
}

export function isSupportedProvince(value: string) {
  return (supportedRegions as readonly string[]).includes(value);
}

export function isSupportedNonCapitalProvince(value: string) {
  return (nonCapitalRegions as readonly string[]).includes(value);
}
