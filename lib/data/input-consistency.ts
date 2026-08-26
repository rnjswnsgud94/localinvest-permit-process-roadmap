import type { ScenarioAnswers } from "@/lib/data/catalog";
import type { SupplementalPermitTargetId } from "@/lib/data/supplemental-permit-targets";

const INLAND_PROVINCES = new Set([
  "서울특별시",
  "충청북도",
  "대전광역시",
  "세종특별자치시",
  "광주광역시",
  "대구광역시",
]);

const FORMER_GWANGJU_DISTRICTS = new Set([
  "동구",
  "서구",
  "남구",
  "북구",
  "광산구",
]);

function isSelected(answers: ScenarioAnswers, procedureId: SupplementalPermitTargetId) {
  return answers.supplementalPermitTargetIds.includes(procedureId);
}

function isReviewedButNotSelected(
  answers: ScenarioAnswers,
  procedureId: SupplementalPermitTargetId,
) {
  return (
    answers.supplementalPermitReviewedIds.includes(procedureId) &&
    !isSelected(answers, procedureId)
  );
}

/**
 * Flags cross-field combinations that can be schema-valid but still need a
 * practitioner to confirm scope, units, or separate facility systems.
 * These warnings do not change applicability or duration calculations.
 */
export function buildInputConsistencyWarnings(answers: ScenarioAnswers) {
  const warnings: string[] = [];

  if (
    answers.chemicalsHandled === false &&
    isSelected(answers, "chemical-emission-reduction-plan-review")
  ) {
    warnings.push(
      "화학물질 취급은 ‘아니오’인데 화학물질 배출저감계획 검토는 대상으로 선택했습니다. 동일 사업범위인지와 대상물질·업종·배출량 기준을 다시 확인하십시오.",
    );
  }

  if (
    (
      INLAND_PROVINCES.has(answers.province)
      || (
        answers.province === "전남광주통합특별시"
        && FORMER_GWANGJU_DISTRICTS.has(answers.city)
      )
    ) &&
    (
      isSelected(answers, "marine-use-consultation") ||
      isSelected(answers, "marine-use-impact-assessment")
    )
  ) {
    warnings.push(
      "내륙 지역 사업에 해양이용 절차를 선택했습니다. 별도의 해양 사업구역이 없다면 공유수면 절차와 혼동한 것은 아닌지 확인하십시오.",
    );
  }

  if (
    answers.publicSewerConnection === true &&
    answers.privateSewageTreatmentFacility === true
  ) {
    warnings.push(
      "공공하수도 연결과 개인하수처리시설 설치를 모두 선택했습니다. 오수 계통·시설 범위가 실제로 분리되는지 확인하십시오.",
    );
  }

  if (
    answers.landCategory === "OTHER" &&
    isSelected(answers, "pasture-conversion-permit")
  ) {
    warnings.push(
      "기타 토지 중 초지전용허가를 선택했습니다. 초지법상 조성초지 해당 여부와 대상 필지·면적 근거를 확인하십시오.",
    );
  }

  if ((answers.powerIncreaseMw ?? 0) >= 1_000) {
    warnings.push(
      `전력 증가량 ${answers.powerIncreaseMw?.toLocaleString("ko-KR")}MW는 대규모 값입니다. kW와 MW 단위, 단일 사업과 산업단지·클러스터 전체 수요의 범위를 다시 확인하십시오.`,
    );
  }

  if ((answers.waterDemandM3Day ?? 0) >= 10_000) {
    warnings.push(
      `용수 수요 ${answers.waterDemandM3Day?.toLocaleString("ko-KR")}㎥/일은 대규모 값입니다. 단일 건축물과 산업단지·클러스터 전체 수요의 범위, 일·월 단위를 다시 확인하십시오.`,
    );
  }

  if (
    answers.energyUsePlanRequired === false &&
    (answers.powerIncreaseMw ?? 0) >= 10
  ) {
    warnings.push(
      "전력설비 증가량이 10MW 이상인데 에너지사용계획은 비대상으로 입력했습니다. 설비용량(MW)만으로는 판정할 수 없으므로 공공·민간 구분과 연간 전력사용량(kWh)·연료사용량(toe)을 같은 사업범위로 환산해 확인하십시오.",
    );
  }

  if (
    answers.buildingAction === "NEW_BUILD" &&
    (answers.totalAreaM2 ?? 0) >= 500 &&
    isReviewedButNotSelected(answers, "building-energy-saving-plan-review")
  ) {
    warnings.push(
      "연면적 500㎡ 이상 신축인데 건축물 에너지절약계획서는 비대상으로 검토했습니다. 공장 용도별 예외, 냉난방 공간, 부속용도와 제출대상 연면적 산정근거를 건축허가 접수 전에 확인하십시오.",
    );
  }

  if (
    (answers.demolitionRequired === true || (answers.totalAreaM2 ?? 0) >= 500) &&
    isReviewedButNotSelected(answers, "construction-waste-plan-report")
  ) {
    warnings.push(
      "신축·해체공사가 있으나 건설폐기물 처리계획 신고는 비대상으로 검토했습니다. 전체 공사의 예상 건설폐기물이 5톤 미만인지와 실제 배출자·발주 범위를 산출서로 확인하십시오.",
    );
  }

  if (
    answers.environmentalAssessmentType === "ENVIRONMENTAL" &&
    isReviewedButNotSelected(answers, "nonpoint-source-installation-report")
  ) {
    warnings.push(
      "환경영향평가 대상으로 입력했지만 비점오염원 설치신고는 비대상으로 검토했습니다. 평가대상 개발사업과 입주기업 시설의 사업범위가 같은지, 물환경보전법상 사업유형·부지면적 기준을 다시 확인하십시오.",
    );
  }

  if (
    ["서울특별시", "경기도"].includes(answers.province) &&
    (answers.totalAreaM2 ?? 0) >= 100_000 &&
    answers.localEnvironmentalAssessmentRequired !== true
  ) {
    warnings.push(
      "서울·경기의 사업 후 총 연면적이 10만㎡ 이상인데 시·도 조례 환경영향평가는 미확인 또는 비대상으로 입력했습니다. 현행 조례의 건축물 대상·합산·연접사업·중복평가 제외기준을 확인하십시오.",
    );
  }

  if (
    answers.province === "인천광역시" &&
    answers.industryCategory !== "AI_DATA_CENTER" &&
    (answers.siteDevelopmentAreaM2 ?? 0) >= 75_000 &&
    (answers.siteDevelopmentAreaM2 ?? 0) < 150_000 &&
    answers.localEnvironmentalAssessmentRequired !== true
  ) {
    warnings.push(
      "인천의 공장설립 사업면적이 7만5천㎡ 이상 15만㎡ 미만인데 시 조례 환경영향평가는 미확인 또는 비대상으로 입력했습니다. 현행 인천광역시 환경영향평가 조례의 대상사업과 기존 평가 부지·중복평가 제외기준을 확인하십시오.",
    );
  }

  if (
    answers.localEnvironmentalAssessmentRequired === true &&
    answers.environmentalAssessmentType !== null &&
    answers.environmentalAssessmentType !== "NONE"
  ) {
    warnings.push(
      "국가 환경영향평가와 시·도 조례 환경영향평가를 모두 대상으로 입력했습니다. 서로 다른 사업범위에는 함께 적용될 수 있지만, 같은 사업범위라면 조례의 중복평가 제외·생략 규정과 승인기관 협의 결과를 확인하십시오.",
    );
  }

  if (
    isSelected(answers, "road-occupation-traffic-flow-plan-review") &&
    !isSelected(answers, "road-occupation-permit")
  ) {
    warnings.push(
      "도로점용공사장 교통소통대책은 대상으로 선택했지만 같은 공사구간의 도로점용허가가 확인되지 않았습니다. 점용·굴착 여부와 관할 도로관리청을 다시 확인하십시오.",
    );
  }

  if (
    answers.fireFacilityWork === true &&
    answers.firstFireSelfInspectionTarget === false
  ) {
    warnings.push(
      "소방시설공사는 대상이지만 완공 후 최초 자체점검은 비대상으로 입력했습니다. 완공 시점 특정소방대상물의 용도·규모와 종합점검·작동점검 분기를 관할 소방서와 확인하십시오.",
    );
  }

  if (
    ["PORT_ACT", "FREE_TRADE_ZONE_ACT"].includes(
      answers.entryContractRegime,
    ) &&
    answers.entryEligibilityConfirmed === false
  ) {
    warnings.push(
      "선택한 입주계약 법률의 입주자격을 충족하지 않는 것으로 입력했습니다. 해당 계약 경로는 적용하지 않으며, 실제 입지가 가능한지 관리기관 모집공고와 자격기준을 다시 확인하십시오.",
    );
  }

  if (
    answers.entryContractRegime === "FREE_TRADE_ZONE_ACT" &&
    answers.entryContractStatus === "COMPLETED" &&
    !answers.entryContractEvidence.trim()
  ) {
    warnings.push(
      "자유무역지역 입주계약은 완료로 입력했지만 계약번호·체결일 등 증빙이 없습니다. 증빙이 확인되기 전에는 공장설립승인 의제를 적용하지 않습니다.",
    );
  }

  if (
    answers.entryContractRegime === "PORT_ACT" &&
    answers.insideIndustrialComplex === true &&
    answers.entryEligibilityConfirmed === true
  ) {
    warnings.push(
      "산업단지와 1종 항만배후단지가 중첩된 부지에서 항만법상 입주계약을 선택했습니다. 항만 입주계약은 공장설립승인을 의제하지 않으며, 공장설립 완료신고·등록의 실제 접수기관은 항만 관리기관·산업단지 관리기관·관할 시군구에 확인하십시오.",
    );
  }

  if (
    ["PORT_ACT", "FREE_TRADE_ZONE_ACT"].includes(
      answers.entryContractRegime,
    ) &&
    answers.entryContractStatus === "COMPLETED"
  ) {
    const missingContractDetails = [
      !answers.entryZoneName.trim() ? "구역명" : null,
      !answers.entryManagingAuthority.trim() ? "관리권자·관리기관" : null,
    ].filter((value): value is string => Boolean(value));
    if (missingContractDetails.length) {
      warnings.push(
        `입주계약 완료로 입력했지만 ${missingContractDetails.join("·")}이 비어 있습니다. 계약서와 공식 고시를 기준으로 접수기관·구역을 보완하십시오.`,
      );
    }
  }

  if (
    (answers.hazardousMaterials === true || answers.highPressureGas === true) &&
    answers.psmCovered === false &&
    answers.safetyManagerRequired === false &&
    isReviewedButNotSelected(answers, "hazard-prevention-plan")
  ) {
    warnings.push(
      "위험물 또는 고압가스를 사용하지만 PSM·유해위험방지계획·안전관리자는 모두 비대상으로 입력했습니다. 물질별 최대보유량, 설비용량, 공정·업종과 상시근로자 수를 동일 사업장 기준으로 재확인하십시오.",
    );
  }

  if (
    answers.insideIndustrialComplex === true &&
    answers.industrialComplexOccupancyContractStatus === "COMPLETED"
  ) {
    const missing = [
      !answers.industrialComplexName.trim() ? "산업단지명" : null,
      !answers.industrialComplexIdentifier.trim() ? "산업단지 식별자" : null,
      !answers.industrialComplexManagingAuthority.trim() ? "관리기관" : null,
      !answers.siteAddress.trim() ? "부지주소" : null,
      !answers.existingApprovalIds.trim() ? "기존 승인 식별자" : null,
      !answers.ksicCode.trim() ? "KSIC 코드" : null,
      !answers.products.trim() ? "생산품" : null,
      !answers.coreProcesses.trim() ? "핵심공정" : null,
    ].filter((value): value is string => Boolean(value));
    if (missing.length) {
      warnings.push(
        `산업단지 입주계약 완료로 입력했지만 다음 항목이 비어 있습니다: ${missing.join("·")}. 입주기업 절차와 산업단지 개발사업자가 이미 완료한 절차를 구분할 자료를 보완하십시오.`,
      );
    }

    const developmentScopeProcedures = [
      answers.environmentalAssessmentType === "ENVIRONMENTAL"
        ? "환경영향평가"
        : answers.environmentalAssessmentType === "SMALL"
          ? "소규모 환경영향평가"
          : null,
      answers.localEnvironmentalAssessmentRequired === true
        ? "시·도 조례 환경영향평가"
        : null,
      answers.disasterImpactAssessmentType &&
      answers.disasterImpactAssessmentType !== "NONE"
        ? "재해영향평가"
        : null,
      answers.publicWaterOccupationRequired === true ? "공유수면 점용" : null,
      isSelected(answers, "road-occupation-permit") ? "도로점용" : null,
      isSelected(answers, "small-stream-occupation-permit") ? "소하천 점용" : null,
      isSelected(answers, "buried-heritage-excavation-permit") ? "매장유산 발굴" : null,
      isSelected(answers, "pasture-conversion-permit") ? "초지전용" : null,
      isSelected(answers, "land-transaction-contract-permit") ? "토지거래허가" : null,
      isSelected(answers, "marine-use-consultation") ? "해양이용협의" : null,
    ].filter((value): value is string => Boolean(value));

    if (!answers.existingApprovalIds.trim() && developmentScopeProcedures.length) {
      warnings.push(
        `입주계약 완료 사업에 ${developmentScopeProcedures.join("·")} 등 개발·입지 단계 절차가 함께 선택되었습니다. 산업단지 개발사업자가 완료한 승인·협의와 입주기업이 새로 수행할 공사 범위를 고시문·실시계획·기존 협의서로 대조하십시오.`,
      );
    }
  }

  if (
    answers.commissioningStartDate &&
    answers.plannedConstructionEndDate &&
    answers.commissioningStartDate < answers.plannedConstructionEndDate
  ) {
    warnings.push(
      "시운전 시작일이 전체 공사 종료일보다 빠릅니다. 단계준공·부분사용 승인과 설비별 사용전검사 범위를 확인하십시오.",
    );
  }

  return warnings;
}
