import { describe, expect, it } from "vitest";

import { procedureCategoryForDecision } from "@/app/components/dashboard/constants";
import { buildPermitReportModel } from "@/app/components/dashboard/pdf/permit-report-model";
import { catalog, scenarioAnswerSchema } from "@/lib/data/catalog";
import { buildInputConsistencyWarnings } from "@/lib/data/input-consistency";
import { evaluateProject } from "@/lib/engine/pipeline";

const complexProjectAnswers = scenarioAnswerSchema.parse({
  ...catalog.scenarios[0].answers,
  assessmentDate: "2026-09-01",
  plannedConstructionStartDate: "2027-05-01",
  plannedConstructionEndDate: "2029-05-31",
  equipmentInstallationCompletionDate: "2029-03-31",
  commissioningStartDate: "2029-03-01",
  province: "대전광역시",
  city: "유성구",
  insideIndustrialComplex: true,
  industrialComplexOccupancyContractStatus: "COMPLETED",
  industrialComplexName: "",
  industrialComplexIdentifier: "",
  industrialComplexManagingAuthority: "",
  siteAddress: "",
  existingApprovalIds: "",
  ksicCode: "",
  products: "",
  coreProcesses: "",
  buildingAction: "NEW_BUILD",
  totalAreaM2: 12_345,
  increaseAreaM2: 12_345,
  landCategory: "OTHER",
  demolitionRequired: true,
  environmentalAssessmentType: "ENVIRONMENTAL",
  chemicalsHandled: false,
  hazardousMaterials: true,
  highPressureGas: true,
  psmCovered: false,
  safetyManagerRequired: false,
  publicSewerConnection: true,
  privateSewageTreatmentFacility: true,
  energyUsePlanRequired: false,
  fireFacilityWork: true,
  firstFireSelfInspectionTarget: false,
  powerIncreaseMw: 1_234,
  waterDemandM3Day: 12_345,
  supplementalPermitReviewedIds: [
    "building-energy-saving-plan-review",
    "construction-waste-plan-report",
    "nonpoint-source-installation-report",
    "hazard-prevention-plan",
    "chemical-emission-reduction-plan-review",
    "marine-use-impact-assessment",
    "pasture-conversion-permit",
    "road-occupation-permit",
  ],
  supplementalPermitTargetIds: [
    "chemical-emission-reduction-plan-review",
    "marine-use-impact-assessment",
    "pasture-conversion-permit",
    "road-occupation-permit",
  ],
});

describe("complex project report regression", () => {
  it("keeps cross-field risks visible in the report", () => {
    const evaluation = evaluateProject(complexProjectAnswers);
    const report = buildPermitReportModel({
      answers: complexProjectAnswers,
      evaluation,
      durationScenario: "TYPICAL",
      generatedAt: new Date("2026-09-01T03:00:00.000Z"),
    });
    const categoryCounts = evaluation.decisions.reduce(
      (counts, decision) => {
        counts[procedureCategoryForDecision(decision)] += 1;
        return counts;
      },
      { REQUIRED: 0, CONFIRM: 0, NOT_REQUIRED: 0 },
    );

    expect(report.summary.counts).toEqual(categoryCounts);
    expect(Object.values(categoryCounts).reduce((sum, count) => sum + count, 0))
      .toBe(evaluation.decisions.length);
    expect(report.metadata).toMatchObject({
      title: "대전광역시 유성구 · 기타·세부 업종 미정 · 신설·신축 인허가 결과보고서",
    });

    const warningText = report.warnings.join(" ");
    for (const phrase of [
      "화학물질 취급은 ‘아니오’",
      "내륙 지역 사업에 해양이용 절차",
      "공공하수도 연결과 개인하수처리시설",
      "초지법상 조성초지",
      "전력 증가량 1,234MW",
      "용수 수요 12,345㎥/일",
      "에너지사용계획은 비대상",
      "건축물 에너지절약계획서는 비대상",
      "건설폐기물 처리계획 신고는 비대상",
      "비점오염원 설치신고는 비대상",
      "완공 후 최초 자체점검은 비대상",
      "PSM·유해위험방지계획·안전관리자는 모두 비대상",
      "산업단지 입주계약 완료",
      "개발·입지 단계 절차가 함께 선택",
      "시운전 시작일이 전체 공사 종료일보다 빠릅니다",
    ]) {
      expect(warningText).toContain(phrase);
    }

    const serialized = JSON.stringify(report);
    expect(serialized).not.toMatch(
      /rule-|판정규칙 법률 검토 필요|AI 보조 초안|근거 추가 검토 필요|의제 반영 · 확인된 제외/,
    );
  });

  it("clears the warnings after the conflicting fields are resolved", () => {
    expect(buildInputConsistencyWarnings({
      ...complexProjectAnswers,
      chemicalsHandled: true,
      publicSewerConnection: true,
      privateSewageTreatmentFacility: false,
      powerIncreaseMw: 3.9,
      waterDemandM3Day: 500,
      energyUsePlanRequired: true,
      supplementalPermitTargetIds: [
        "building-energy-saving-plan-review",
        "construction-waste-plan-report",
        "nonpoint-source-installation-report",
        "hazard-prevention-plan",
      ],
      firstFireSelfInspectionTarget: true,
      psmCovered: true,
      safetyManagerRequired: true,
      industrialComplexName: "검증산업단지",
      industrialComplexIdentifier: "TEST-001",
      industrialComplexManagingAuthority: "검증 관리기관",
      siteAddress: "대전광역시 유성구 검증로 1",
      existingApprovalIds: "입주계약 TEST-2026-001",
      ksicCode: "29299",
      products: "검증용 기계부품",
      coreProcesses: "조립·검사",
      commissioningStartDate: "2029-06-01",
    })).toEqual([]);
  });

  it("warns only for inland districts of the integrated province when marine procedures are selected", () => {
    const marineTarget = "marine-use-impact-assessment" as const;
    const base = {
      ...complexProjectAnswers,
      supplementalPermitReviewedIds: [marineTarget],
      supplementalPermitTargetIds: [marineTarget],
    };
    const inlandWarnings = buildInputConsistencyWarnings({
      ...base,
      province: "전남광주통합특별시",
      city: "광산구",
    }).join(" ");
    const coastalWarnings = buildInputConsistencyWarnings({
      ...base,
      province: "전남광주통합특별시",
      city: "목포시",
    }).join(" ");

    expect(inlandWarnings).toContain("내륙 지역 사업에 해양이용 절차");
    expect(coastalWarnings).not.toContain("내륙 지역 사업에 해양이용 절차");
  });
});
