import type { ScenarioAnswers } from "@/lib/data/catalog";
import type { SupplementalPermitTargetId } from "@/lib/data/supplemental-permit-targets";

const INLAND_PROVINCES = new Set([
  "충청북도",
  "대전광역시",
  "세종특별자치시",
  "광주광역시",
  "대구광역시",
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
    INLAND_PROVINCES.has(answers.province) &&
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
    answers.fireFacilityWork === true &&
    answers.firstFireSelfInspectionTarget === false
  ) {
    warnings.push(
      "소방시설공사는 대상이지만 완공 후 최초 자체점검은 비대상으로 입력했습니다. 완공 시점 특정소방대상물의 용도·규모와 종합점검·작동점검 분기를 관할 소방서와 확인하십시오.",
    );
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
      answers.environmentalAssessmentType === "ENVIRONMENTAL" ? "환경영향평가" : null,
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
