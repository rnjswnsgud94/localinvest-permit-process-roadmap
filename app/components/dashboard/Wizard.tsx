"use client";

import { useState } from "react";

import { catalog, type ScenarioAnswers } from "@/lib/data/catalog";
import {
  getIndustryProfile,
  industryProfileGroups,
  industryProfiles,
  industryReviewFieldLabels,
} from "@/lib/data/industry-profiles";
import {
  AI_DATA_CENTER_INDUSTRY_ID,
  AI_DATA_CENTER_SPECIAL_ACT_EFFECTIVE_DATE,
  getAiDataCenterSpecialLawDefinitions,
  getAutomaticSpecialLawDefinitions,
  type AiDataCenterSpecialLawId,
  type AutomaticSpecialLawQualificationKey,
} from "@/lib/data/special-laws";
import {
  getFastTrackTargetProcedureIds,
  industrialComplexPlanDeemedProcedureIds,
  regionalSpecialZoneDeemedProcedureIds,
  semiconductorClusterPlanDeemedProcedureIds,
} from "@/lib/data/special-law-processes";
import {
  supplementalPermitTargetDescriptions,
  supplementalPermitTargetIds,
  type SupplementalPermitTargetId,
} from "@/lib/data/supplemental-permit-targets";
import { nonCapitalRegions } from "@/lib/regions";
import { listSupportedMunicipalities } from "@/lib/regions/local-ordinances";

type Props = {
  answers: ScenarioAnswers;
  activeStep: number;
  onStepChange: (step: number) => void;
  onChange: <K extends keyof ScenarioAnswers>(key: K, value: ScenarioAnswers[K]) => void;
};

const steps = [
  { title: "사업 기본", hint: "유형·지역·입지" },
  { title: "시설 규모", hint: "건축·면적·의제" },
  { title: "환경·안전", hint: "배출시설·PSM" },
  { title: "인프라", hint: "전력·용수·폐수" },
  { title: "공사 일정", hint: "착공·준공 예정일" },
];

const procedureNameById = new Map(
  catalog.procedures.map((procedure) => [procedure.id, procedure.name]),
);
const sortedFastTrackTargetProcedureIds = {
  ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK: getFastTrackTargetProcedureIds(
    "ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK",
    catalog.procedures,
  ),
  SEMICONDUCTOR_CLUSTER_FAST_TRACK: getFastTrackTargetProcedureIds(
    "SEMICONDUCTOR_CLUSTER_FAST_TRACK",
    catalog.procedures,
  ),
} as const;
for (const procedureIds of Object.values(sortedFastTrackTargetProcedureIds)) {
  procedureIds.sort((left, right) =>
    (procedureNameById.get(left) ?? left).localeCompare(
      procedureNameById.get(right) ?? right,
      "ko",
    ),
  );
}

function calendarDayDistance(start: string, end: string) {
  const startDay = Date.parse(`${start}T00:00:00.000Z`);
  const endDay = Date.parse(`${end}T00:00:00.000Z`);
  if (!Number.isFinite(startDay) || !Number.isFinite(endDay)) return 0;
  return Math.floor((endDay - startDay) / 86_400_000) + 1;
}

function koreanDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

function isValidAssessmentDate(value: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function answeredCount(values: unknown[]) {
  return values.filter((value) => (
    value !== null
    && value !== ""
    && value !== "UNKNOWN"
    && (!Array.isArray(value) || value.length > 0)
  )).length;
}

function progressiveStatus(count: number) {
  return count ? `${count}개 입력됨` : "필요할 때 펼치기";
}

function Question({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="wizard-question">
      <legend>{label}</legend>
      {hint ? <p className="question-hint">{hint}</p> : null}
      {children}
    </fieldset>
  );
}

function ChoiceGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string; note?: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="choice-grid">
      {options.map((option) => (
        <button
          type="button"
          className={`choice-button ${value === option.value ? "is-selected" : ""}`}
          aria-pressed={value === option.value}
          key={option.value}
          onClick={() => onChange(option.value)}
        >
          <span>{option.label}</span>
          {option.note ? <small>{option.note}</small> : null}
        </button>
      ))}
    </div>
  );
}

function TriState({
  value,
  onChange,
  yesLabel = "있음",
  noLabel = "없음",
  unknownLabel = "모름",
  ariaLabel,
}: {
  value: boolean | null;
  onChange: (value: boolean | null) => void;
  yesLabel?: string;
  noLabel?: string;
  unknownLabel?: string;
  ariaLabel?: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {[
        { value: true, label: yesLabel },
        { value: false, label: noLabel },
        { value: null, label: unknownLabel },
      ].map((option) => (
        <button
          type="button"
          key={String(option.value)}
          aria-pressed={value === option.value}
          className={value === option.value ? "is-selected" : ""}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function NumberInput({
  label,
  value,
  unit,
  onChange,
}: {
  label: string;
  value: number | null;
  unit: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <span className="input-with-unit">
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          placeholder="미확인"
          value={value ?? ""}
          onChange={(event) => {
            const next = event.target.value;
            onChange(next === "" ? null : Math.max(0, Number(next)));
          }}
        />
        <em>{unit}</em>
      </span>
    </label>
  );
}

export function Wizard({ answers, activeStep, onStepChange, onChange }: Props) {
  const [assessmentDateError, setAssessmentDateError] = useState("");
  const assessmentDateIsValid = isValidAssessmentDate(answers.assessmentDate);
  const selectedIndustryProfile = getIndustryProfile(answers.industryCategory);
  const municipalities = listSupportedMunicipalities(answers.province);
  const aiDataCenterSpecialLaws = getAiDataCenterSpecialLawDefinitions();
  const automaticSpecialLawCandidates = getAutomaticSpecialLawDefinitions(answers);
  const confirmedAutomaticSpecialLawCount = automaticSpecialLawCandidates.filter(
    (law) => law.qualificationKey && answers[law.qualificationKey] === true,
  ).length;
  const visibleAssessmentDateError = assessmentDateIsValid
    ? assessmentDateError
    : "평가 기준일을 올바른 날짜로 입력해 주세요.";
  const siteDetailAnsweredCount = answeredCount([
    answers.demolitionRequired,
    answers.asbestosPresent,
    answers.roadConnectionRequired,
    answers.trafficImpactAssessmentRequired,
    answers.permitCoordination,
    answers.disasterImpactAssessmentType,
    answers.undergroundSafetyAssessmentType,
    answers.nationalHeritageAssessmentType,
    answers.militaryProtectionConsultationRequired,
    answers.riverOccupationRequired,
    answers.publicWaterOccupationRequired,
    answers.waterSourceProtectionZone,
  ]);
  const environmentalDetailAnsweredCount = answeredCount([
    answers.wasteFacility,
    answers.environmentalAssessmentType,
    answers.integratedEnvironmentalPermitTarget,
    answers.supplementalPermitReviewedIds,
  ]);
  const infrastructureDetailAnsweredCount = answeredCount([
    answers.fireFacilityWork,
    answers.fireWorkSupervisionTarget,
    answers.firstFireSelfInspectionTarget,
    answers.privateElectricalFacilityWork,
    answers.energyUsePlanRequired,
    answers.gridImpactAssessmentRequired,
    answers.groundwaterDevelopment,
    answers.publicSewerConnection,
    answers.privateSewageTreatmentFacility,
  ]);
  const constructionDetailAnsweredCount = answeredCount([
    answers.safetyManagementPlanRequired,
    answers.specificWorkReportRequired,
  ]);

  function changeIndustry(industryCategory: string) {
    onChange("industryCategory", industryCategory);
    if (industryCategory !== AI_DATA_CENTER_INDUSTRY_ID) {
      if (answers.aiDataCenterActFacilityConfirmed !== null) {
        onChange("aiDataCenterActFacilityConfirmed", null);
      }
      if (answers.aiDataCenterOneStopStatus !== "NOT_APPLIED") {
        onChange("aiDataCenterOneStopStatus", "NOT_APPLIED");
      }
      if (answers.appliedSpecialLawIds.length) {
        onChange("appliedSpecialLawIds", []);
      }
    }
    if (!["SEMICONDUCTOR_ELECTRONICS", "SECONDARY_BATTERY_CHEMICAL", "PHARMACEUTICAL_BIO"].includes(industryCategory)) {
      onChange("advancedStrategicIndustryFastTrackConfirmed", null);
      onChange("advancedStrategicIndustryApplicantRoleConfirmed", null);
      onChange("advancedStrategicIndustryDelayRiskConfirmed", null);
      onChange("advancedStrategicIndustryCommitteeResolved", null);
      onChange("advancedStrategicIndustryMinisterRequestDate", null);
      onChange("advancedStrategicIndustryFastTrackPermitIds", []);
    }
    if (industryCategory !== "SEMICONDUCTOR_ELECTRONICS") {
      onChange("semiconductorClusterFastTrackConfirmed", null);
      onChange("semiconductorClusterApplicantRoleConfirmed", null);
      onChange("semiconductorClusterDelayRiskConfirmed", null);
      onChange("semiconductorClusterCommitteeResolved", null);
      onChange("semiconductorClusterMinisterRequestDate", null);
      onChange("semiconductorClusterFastTrackPermitIds", []);
      onChange("semiconductorClusterPlanDeemingConfirmed", null);
      onChange("semiconductorClusterPlanDocumentsIncluded", null);
      onChange("semiconductorClusterPlanConsultationCompleted", null);
      onChange("semiconductorClusterPlanApprovalPublished", null);
      onChange("semiconductorClusterPlanApprovalPublishedDate", null);
      onChange("semiconductorClusterPlanApprovalNoticeReference", "");
      onChange("semiconductorClusterPlanIncludedPermitIds", []);
    }
  }

  function toggleSpecialLaw(id: AiDataCenterSpecialLawId) {
    const selected = answers.appliedSpecialLawIds.includes(id);
    onChange(
      "appliedSpecialLawIds",
      selected
        ? answers.appliedSpecialLawIds.filter((item) => item !== id)
        : [...answers.appliedSpecialLawIds, id],
    );
    if (id === "AIDC_ONE_STOP") {
      onChange(
        "aiDataCenterOneStopStatus",
        selected ? "NOT_APPLIED" : "PLANNED",
      );
    }
  }

  function toggleDeemedPermit(
    key:
      | "industrialComplexPlanIncludedPermitIds"
      | "semiconductorClusterPlanIncludedPermitIds"
      | "regionalSpecialZonePlanIncludedPermitIds"
      | "advancedStrategicIndustryFastTrackPermitIds"
      | "semiconductorClusterFastTrackPermitIds",
    procedureId: string,
  ) {
    const selected = answers[key];
    onChange(
      key,
      selected.includes(procedureId)
        ? selected.filter((item) => item !== procedureId)
        : [...selected, procedureId],
    );
  }

  function supplementalPermitDecision(
    procedureId: SupplementalPermitTargetId,
  ) {
    if (answers.supplementalPermitTargetIds.includes(procedureId)) return true;
    if (answers.supplementalPermitReviewedIds.includes(procedureId)) return false;
    return null;
  }

  function setSupplementalPermitDecision(
    procedureId: SupplementalPermitTargetId,
    value: boolean | null,
  ) {
    const mutuallyExclusiveTarget: Partial<
      Record<SupplementalPermitTargetId, SupplementalPermitTargetId>
    > = {
      "information-communication-supervisor-assignment-report":
        "information-communication-pre-use-inspection",
      "information-communication-pre-use-inspection":
        "information-communication-supervisor-assignment-report",
      "marine-use-consultation": "marine-use-impact-assessment",
      "marine-use-impact-assessment": "marine-use-consultation",
    };
    const excludedTarget = value === true
      ? mutuallyExclusiveTarget[procedureId]
      : undefined;
    const reviewed = answers.supplementalPermitReviewedIds.filter(
      (item) => item !== procedureId,
    );
    const selected = answers.supplementalPermitTargetIds.filter(
      (item) => item !== procedureId && item !== excludedTarget,
    );
    onChange(
      "supplementalPermitReviewedIds",
      value === null
        ? reviewed
        : [...new Set([
            ...reviewed,
            procedureId,
            ...(excludedTarget ? [excludedTarget] : []),
          ])],
    );
    onChange(
      "supplementalPermitTargetIds",
      value === true ? [...selected, procedureId] : selected,
    );
    if (procedureId === "hazard-prevention-plan" && value !== true) {
      onChange("psmCoversSameHazardPreventionScope", null);
    }
  }

  return (
    <aside className="wizard-panel" aria-label="사업조건 입력">
      <div className="wizard-heading">
        <div>
          <span className="eyebrow">사업 정보 입력</span>
          <h2>사업조건 설정</h2>
          <p>핵심 질문부터 입력하고, 필요한 상세항목만 펼치세요.</p>
        </div>
        <span className="step-count">{activeStep + 1} / {steps.length}</span>
      </div>

      <nav className="wizard-steps" aria-label="입력 단계">
        {steps.map((step, index) => (
          <button
            type="button"
            key={step.title}
            className={index === activeStep ? "is-active" : ""}
            aria-current={index === activeStep ? "step" : undefined}
            onClick={() => onStepChange(index)}
          >
            <span>{index + 1}</span>
            <strong>{step.title}</strong>
            <small>{step.hint}</small>
          </button>
        ))}
      </nav>

      <div className="wizard-body">
        {activeStep === 0 ? (
          <>
            <Question label="투자 유형">
              <ChoiceGroup
                value={answers.investmentType}
                onChange={(value) => onChange("investmentType", value)}
                options={[
                  { value: "NEW", label: "신설" },
                  { value: "EXPANSION", label: "증설" },
                  { value: "RELOCATION", label: "이전" },
                  { value: "PROCESS_CHANGE", label: "공정변경" },
                  { value: "INDUSTRY_CHANGE", label: "업종변경" },
                ]}
              />
            </Question>
            <Question label="평가 기준일" hint="이 날짜에 시행 중인 법령 경로를 기준으로 봅니다.">
              <input
                className="text-input"
                type="date"
                aria-label="평가 기준일"
                aria-describedby={visibleAssessmentDateError ? "assessment-date-error" : undefined}
                aria-invalid={visibleAssessmentDateError ? true : undefined}
                required
                value={answers.assessmentDate}
                onChange={(event) => {
                  const next = event.target.value;
                  if (!isValidAssessmentDate(next)) {
                    setAssessmentDateError("평가 기준일은 비워둘 수 없습니다.");
                    onChange("assessmentDate", answers.assessmentDate);
                    return;
                  }
                  setAssessmentDateError("");
                  onChange("assessmentDate", next);
                }}
              />
              {visibleAssessmentDateError ? (
                <p id="assessment-date-error" className="question-error" role="alert">
                  {visibleAssessmentDateError}
                </p>
              ) : null}
            </Question>
            <Question label="투자 지역" hint="비수도권 13개 광역자치단체와 시·군·구를 선택하면 해당 관할의 현행 자치법규 상세 원문을 결과에 연결합니다.">
              <div className="two-column-fields">
                <label>
                  <span>시·도</span>
                  <select
                    value={answers.province}
                    onChange={(event) => {
                      onChange("province", event.target.value);
                      onChange("city", "");
                      onChange("regionalSpecialZonePlanDeemingConfirmed", null);
                      onChange("regionalSpecialZonePlanDocumentsIncluded", null);
                      onChange("regionalSpecialZonePlanConsultationCompleted", null);
                      onChange("regionalSpecialZonePlanApprovalPublished", null);
                      onChange("regionalSpecialZonePlanApprovalPublishedDate", null);
                      onChange("regionalSpecialZonePlanApprovalNoticeReference", "");
                      onChange("regionalSpecialZonePlanIncludedPermitIds", []);
                    }}
                  >
                    <option value="">시·도 선택</option>
                    {nonCapitalRegions.map((province) => (
                      <option key={province} value={province}>{province}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>시·군·구</span>
                  <select
                    value={answers.city}
                    onChange={(event) => onChange("city", event.target.value)}
                    disabled={!answers.province || municipalities.length === 0}
                  >
                    <option value="">{answers.province ? municipalities.length ? "시·군·구 선택" : "광역 단층제" : "시·도 먼저 선택"}</option>
                    {municipalities.map((municipality) => (
                      <option value={municipality} key={municipality}>{municipality}</option>
                    ))}
                  </select>
                </label>
              </div>
            </Question>
            <Question label="산업단지 안에 있습니까?">
              <TriState
                value={answers.insideIndustrialComplex}
                yesLabel="산단 안"
                noLabel="개별입지"
                onChange={(value) => {
                  onChange("insideIndustrialComplex", value);
                  if (value !== true) {
                    onChange("industrialComplexName", "");
                    onChange("industrialComplexIdentifier", "");
                    onChange("industrialComplexManagingAuthority", "");
                    onChange("industrialComplexOccupancyContractStatus", "NOT_APPLIED");
                  }
                }}
              />
            </Question>
            {answers.insideIndustrialComplex === true ? (
              <Question label="산업단지 입주계약 상태" hint="산업단지 소재만으로 공장설립승인이 의제되지 않습니다. 입주계약·변경계약의 실제 진행상태만 선택하세요.">
                <select value={answers.industrialComplexOccupancyContractStatus} onChange={(event) => onChange("industrialComplexOccupancyContractStatus", event.target.value as ScenarioAnswers["industrialComplexOccupancyContractStatus"])}>
                  <option value="NOT_APPLIED">미신청</option>
                  <option value="PLANNED">신청 예정</option>
                  <option value="IN_PROGRESS">협의·심사 중</option>
                  <option value="COMPLETED">계약 체결 완료</option>
                </select>
                <div className="inline-notice warning"><strong>의제 범위</strong><span>실제 계약이 체결된 경우에만 공장설립승인을 받은 것으로 봅니다. 환경·건축·안전 인허가가 함께 면제되는 것은 아닙니다.</span></div>
              </Question>
            ) : null}
            <Question
              label="업종·주요 공정"
              hint="제조업 분류와 AI 데이터센터를 투자 검토용으로 묶었습니다. 업종 선택은 확인할 항목을 추천할 뿐 개별 인허가를 자동 확정하지 않습니다."
            >
              <select
                aria-label="업종·주요 공정"
                value={answers.industryCategory}
                onChange={(event) => changeIndustry(event.target.value)}
              >
                <option value="UNKNOWN">업종을 선택해 주세요</option>
                {industryProfileGroups.map((group) => (
                  <optgroup label={group} key={group}>
                    {industryProfiles
                      .filter((profile) => profile.group === group)
                      .map((profile) => (
                        <option value={profile.id} key={profile.id}>
                          {profile.label}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              {selectedIndustryProfile ? (
                <div className="inline-notice info">
                  <strong>업종별 우선 확인 안내</strong>
                  <span>
                    업종만으로 환경·안전 인허가를 자동 확정하지 않습니다. 실제 설비·물질·규모를 확인해 필요한 항목만 입력하세요.
                    {` 우선 확인: ${selectedIndustryProfile.reviewKeys
                      .map((key) => industryReviewFieldLabels[key])
                      .join(" · ")}`}
                  </span>
                </div>
              ) : null}
            </Question>
            {answers.industryCategory === AI_DATA_CENTER_INDUSTRY_ID ? (
              <>
                <Question
                  label="특별법상 AI 데이터센터 인정요건"
                  hint="대통령령에서 정할 시설·운영 기준을 충족하는지 확인한 결과입니다. 하위법령 공포 전이거나 판단 근거가 없으면 미확인으로 두세요."
                >
                  <TriState
                    value={answers.aiDataCenterActFacilityConfirmed}
                    yesLabel="요건 확인"
                    noLabel="미해당"
                    onChange={(value) => onChange("aiDataCenterActFacilityConfirmed", value)}
                  />
                </Question>
                <Question
                  label="적용 확인한 AI 데이터센터 특례"
                  hint="특별법상 시설 인정요건과 개별 특례요건을 관계기관·전문가에게 확인한 경우에만 선택하세요. 결과에는 면제, 일괄처리, 시설 규모 산정 특례 또는 입지 특례를 구분해 표시합니다."
                >
                  <div className="special-law-picker">
                    {aiDataCenterSpecialLaws.map((law) => {
                      const lawId = law.id as AiDataCenterSpecialLawId;
                      const selected = answers.appliedSpecialLawIds.includes(lawId);
                      return (
                        <label className={selected ? "is-selected" : ""} key={law.id}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleSpecialLaw(lawId)}
                          />
                          <span>
                            <strong>{law.shortLabel}</strong>
                            <small>{law.article} · {law.conditionNote}</small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {answers.appliedSpecialLawIds.includes("AIDC_ONE_STOP") ? (
                    <label className="special-law-status-field">
                      <span>일괄처리 진행상태</span>
                      <select
                        aria-label="인허가 일괄처리 진행상태"
                        value={answers.aiDataCenterOneStopStatus}
                        onChange={(event) => onChange(
                          "aiDataCenterOneStopStatus",
                          event.target.value as ScenarioAnswers["aiDataCenterOneStopStatus"],
                        )}
                      >
                        <option value="PLANNED">신청 예정</option>
                        <option value="IN_PROGRESS">심사 중</option>
                        <option value="COMPLETED">일괄처리 완료</option>
                      </select>
                      <small>신고 의제는 신청 시점이 아니라 일괄처리를 받은 경우에만 반영됩니다.</small>
                    </label>
                  ) : null}
                  <div className={`inline-notice ${answers.assessmentDate < AI_DATA_CENTER_SPECIAL_ACT_EFFECTIVE_DATE || answers.aiDataCenterActFacilityConfirmed !== true ? "warning" : "info"}`}>
                    <strong>{answers.assessmentDate < AI_DATA_CENTER_SPECIAL_ACT_EFFECTIVE_DATE ? "시행 전" : answers.aiDataCenterActFacilityConfirmed === true ? "시행일 이후·요건 확인" : "시설요건 확인 필요"}</strong>
                    <span>
                      특별법 시행일은 {AI_DATA_CENTER_SPECIAL_ACT_EFFECTIVE_DATE}입니다. 현재 하위법령이 없어 AI 데이터센터 인정기준, 전력계통영향평가 면제용량과 시설 규모의 별도 산정기준은 확정되지 않았습니다.
                    </span>
                  </div>
                </Question>
              </>
            ) : null}
            {automaticSpecialLawCandidates.length ? (
              <Question
                label="자동 점검된 기타 특별법 후보"
                hint="현재 업종·지역·산업단지 입력으로 검토할 법률만 자동 표시합니다. 단순 소재·업종만으로는 특례를 확정하지 않으며, 아래 법정요건을 확인한 경우에만 관련 절차에 표시합니다."
              >
                <details className="wizard-optional-section special-law-candidates-details">
                  <summary>
                    <strong>특별법 후보 {automaticSpecialLawCandidates.length}건</strong>
                    <span>{confirmedAutomaticSpecialLawCount ? `요건 확인 ${confirmedAutomaticSpecialLawCount}건` : "눌러서 확인"}</span>
                  </summary>
                  <div className="special-law-candidate-list">
                  {automaticSpecialLawCandidates.map((law) => {
                    const qualificationKey = law.qualificationKey;
                    if (!qualificationKey) return null;
                    const typedKey = qualificationKey as AutomaticSpecialLawQualificationKey;
                    const isIndustrialPlan = law.id === "INDUSTRIAL_COMPLEX_PLAN_INTEGRATED_APPROVAL";
                    const isRegionalPlan = law.id === "REGIONAL_SPECIAL_ZONE_PLAN_DEEMING";
                    const isSemiconductorPlan = law.id === "SEMICONDUCTOR_CLUSTER_PLAN_DEEMING";
                    const isAdvancedFastTrack = law.id === "ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK";
                    const isSemiconductorFastTrack = law.id === "SEMICONDUCTOR_CLUSTER_FAST_TRACK";
                    const fastTrackPermitIds = isAdvancedFastTrack
                      ? sortedFastTrackTargetProcedureIds.ADVANCED_STRATEGIC_INDUSTRY_FAST_TRACK
                      : sortedFastTrackTargetProcedureIds.SEMICONDUCTOR_CLUSTER_FAST_TRACK;
                    const deemedPermitIds = isIndustrialPlan
                      ? industrialComplexPlanDeemedProcedureIds
                      : isSemiconductorPlan
                        ? semiconductorClusterPlanDeemedProcedureIds
                      : isRegionalPlan
                        ? regionalSpecialZoneDeemedProcedureIds
                        : [];
                    const selectedPermitKey = isIndustrialPlan
                      ? "industrialComplexPlanIncludedPermitIds" as const
                      : isSemiconductorPlan
                        ? "semiconductorClusterPlanIncludedPermitIds" as const
                      : "regionalSpecialZonePlanIncludedPermitIds" as const;
                    const planApprovalPublishedKey = isIndustrialPlan
                      ? "industrialComplexPlanApprovalPublished" as const
                      : isSemiconductorPlan
                        ? "semiconductorClusterPlanApprovalPublished" as const
                        : "regionalSpecialZonePlanApprovalPublished" as const;
                    const planApprovalPublishedDateKey = isIndustrialPlan
                      ? "industrialComplexPlanApprovalPublishedDate" as const
                      : isSemiconductorPlan
                        ? "semiconductorClusterPlanApprovalPublishedDate" as const
                        : "regionalSpecialZonePlanApprovalPublishedDate" as const;
                    const planApprovalNoticeReferenceKey = isIndustrialPlan
                      ? "industrialComplexPlanApprovalNoticeReference" as const
                      : isSemiconductorPlan
                        ? "semiconductorClusterPlanApprovalNoticeReference" as const
                        : "regionalSpecialZonePlanApprovalNoticeReference" as const;
                    const planDocumentsIncluded = isIndustrialPlan
                      ? answers.industrialComplexPlanDocumentsIncluded
                      : isSemiconductorPlan
                        ? answers.semiconductorClusterPlanDocumentsIncluded
                        : answers.regionalSpecialZonePlanDocumentsIncluded;
                    const planConsultationCompleted = isIndustrialPlan
                      ? answers.industrialComplexPlanConsultationCompleted
                      : isSemiconductorPlan
                        ? answers.semiconductorClusterPlanConsultationCompleted
                        : answers.regionalSpecialZonePlanConsultationCompleted;
                    return (
                      <article className="special-law-candidate" key={law.id}>
                        <header>
                          <div>
                            <span>{law.scopeLabel}</span>
                            <strong>{law.shortLabel}</strong>
                          </div>
                          <a href={law.officialUrl} target="_blank" rel="noreferrer">
                            공식 법령 ↗
                          </a>
                        </header>
                        <p>{law.conditionNote}</p>
                        <TriState
                          value={answers[typedKey]}
                          yesLabel="법정요건 확인"
                          noLabel="미해당"
                          onChange={(value) => {
                            onChange(typedKey, value);
                            if (isIndustrialPlan && value !== true) {
                              onChange("industrialComplexPlanDocumentsIncluded", null);
                              onChange("industrialComplexPlanConsultationCompleted", null);
                              onChange("industrialComplexPlanApprovalPublished", null);
                              onChange("industrialComplexPlanApprovalPublishedDate", null);
                              onChange("industrialComplexPlanApprovalNoticeReference", "");
                              onChange("industrialComplexPlanIncludedPermitIds", []);
                            }
                            if (isRegionalPlan && value !== true) {
                              onChange("regionalSpecialZonePlanDocumentsIncluded", null);
                              onChange("regionalSpecialZonePlanConsultationCompleted", null);
                              onChange("regionalSpecialZonePlanApprovalPublished", null);
                              onChange("regionalSpecialZonePlanApprovalPublishedDate", null);
                              onChange("regionalSpecialZonePlanApprovalNoticeReference", "");
                              onChange("regionalSpecialZonePlanIncludedPermitIds", []);
                            }
                            if (isSemiconductorPlan && value !== true) {
                              onChange("semiconductorClusterPlanDocumentsIncluded", null);
                              onChange("semiconductorClusterPlanConsultationCompleted", null);
                              onChange("semiconductorClusterPlanApprovalPublished", null);
                              onChange("semiconductorClusterPlanApprovalPublishedDate", null);
                              onChange("semiconductorClusterPlanApprovalNoticeReference", "");
                              onChange("semiconductorClusterPlanIncludedPermitIds", []);
                            }
                            if (isAdvancedFastTrack && value !== true) {
                              onChange("advancedStrategicIndustryApplicantRoleConfirmed", null);
                              onChange("advancedStrategicIndustryDelayRiskConfirmed", null);
                              onChange("advancedStrategicIndustryCommitteeResolved", null);
                              onChange("advancedStrategicIndustryMinisterRequestDate", null);
                              onChange("advancedStrategicIndustryFastTrackPermitIds", []);
                            }
                            if (isSemiconductorFastTrack && value !== true) {
                              onChange("semiconductorClusterApplicantRoleConfirmed", null);
                              onChange("semiconductorClusterDelayRiskConfirmed", null);
                              onChange("semiconductorClusterCommitteeResolved", null);
                              onChange("semiconductorClusterMinisterRequestDate", null);
                              onChange("semiconductorClusterFastTrackPermitIds", []);
                            }
                          }}
                        />
                        {(isAdvancedFastTrack || isSemiconductorFastTrack) && answers[typedKey] === true ? (
                          <div className="deeming-evidence-checklist fast-track-evidence-checklist">
                            <strong>신속처리 법정 이벤트 확인</strong>
                            <p>아래에는 각 법이 열거·인용한 범위에 속하는 인허가만 표시합니다. 증빙이 모두 있어야 신속처리 경로를 활성화하며, 60일은 일반 접수일부터의 자동승인 기한이 아닙니다.</p>
                            <div className="stacked-fields compact-tristates">
                              <label><span>법정 사업시행자·신청자 지위</span><TriState value={isAdvancedFastTrack ? answers.advancedStrategicIndustryApplicantRoleConfirmed : answers.semiconductorClusterApplicantRoleConfirmed} yesLabel="확인" noLabel="미해당" onChange={(value) => isAdvancedFastTrack ? onChange("advancedStrategicIndustryApplicantRoleConfirmed", value) : onChange("semiconductorClusterApplicantRoleConfirmed", value)} /></label>
                              <label><span>인허가 지연·현저한 지장 우려</span><TriState value={isAdvancedFastTrack ? answers.advancedStrategicIndustryDelayRiskConfirmed : answers.semiconductorClusterDelayRiskConfirmed} yesLabel="증빙 있음" noLabel="미충족" onChange={(value) => isAdvancedFastTrack ? onChange("advancedStrategicIndustryDelayRiskConfirmed", value) : onChange("semiconductorClusterDelayRiskConfirmed", value)} /></label>
                              <label><span>위원회 심의·의결 완료</span><TriState value={isAdvancedFastTrack ? answers.advancedStrategicIndustryCommitteeResolved : answers.semiconductorClusterCommitteeResolved} yesLabel="완료" noLabel="미완료" onChange={(value) => isAdvancedFastTrack ? onChange("advancedStrategicIndustryCommitteeResolved", value) : onChange("semiconductorClusterCommitteeResolved", value)} /></label>
                              <label>
                                <span>산업통상부장관의 인허가권자 요청일</span>
                                <input className="text-input" type="date" min={law.effectiveFrom} max={answers.assessmentDate} value={(isAdvancedFastTrack ? answers.advancedStrategicIndustryMinisterRequestDate : answers.semiconductorClusterMinisterRequestDate) ?? ""} onChange={(event) => isAdvancedFastTrack ? onChange("advancedStrategicIndustryMinisterRequestDate", event.target.value || null) : onChange("semiconductorClusterMinisterRequestDate", event.target.value || null)} />
                              </label>
                            </div>
                            <div className="deemed-permit-picker" role="group" aria-label={`${law.shortLabel} 실제 요청대상 인허가`}>
                              {fastTrackPermitIds.map((procedureId) => {
                                const key = isAdvancedFastTrack
                                  ? "advancedStrategicIndustryFastTrackPermitIds" as const
                                  : "semiconductorClusterFastTrackPermitIds" as const;
                                return (
                                  <label key={procedureId}>
                                    <input
                                      type="checkbox"
                                      checked={answers[key].includes(procedureId)}
                                      onChange={() => toggleDeemedPermit(key, procedureId)}
                                    />
                                    <span>{procedureNameById.get(procedureId) ?? procedureId}</span>
                                  </label>
                                );
                              })}
                            </div>
                            <small>신청서·위원회 의결·장관 요청 공문과 위에서 선택한 실제 요청대상 목록을 함께 보관하세요. 선택하지 않은 인허가에는 신속처리를 표시하지 않습니다. 법정 효과는 ‘허가 승인’이 아니라 조건 충족 시 ‘처리 완료로 봄’입니다.</small>
                          </div>
                        ) : null}
                        {(isIndustrialPlan || isSemiconductorPlan || isRegionalPlan) && answers[typedKey] === true ? (
                          <div className="deeming-evidence-checklist">
                            <strong>의제 증빙 체크</strong>
                            <p>법정서류 포함, 관계기관 협의, 승인·고시 완료 증거와 실제 포함 인허가를 모두 확인해야 해당 항목만 별도신청 대신 의제로 표시합니다.</p>
                            <div className="stacked-fields compact-tristates">
                              <label>
                                <span>인허가별 법정서류가 상위 계획에 포함됨</span>
                                <TriState
                                  value={planDocumentsIncluded}
                                  yesLabel="확인"
                                  noLabel="미포함"
                                  onChange={(value) => isIndustrialPlan ? onChange("industrialComplexPlanDocumentsIncluded", value) : isSemiconductorPlan ? onChange("semiconductorClusterPlanDocumentsIncluded", value) : onChange("regionalSpecialZonePlanDocumentsIncluded", value)}
                                />
                              </label>
                              <label>
                                <span>해당 인허가 관계기관 협의·승인 완료</span>
                                <TriState
                                  value={planConsultationCompleted}
                                  yesLabel="완료"
                                  noLabel="미완료"
                                  onChange={(value) => isIndustrialPlan ? onChange("industrialComplexPlanConsultationCompleted", value) : isSemiconductorPlan ? onChange("semiconductorClusterPlanConsultationCompleted", value) : onChange("regionalSpecialZonePlanConsultationCompleted", value)}
                                />
                              </label>
                              {planDocumentsIncluded === true && planConsultationCompleted === true ? (
                                <label>
                                  <span>상위 계획 승인·고시 완료</span>
                                  <TriState
                                    value={answers[planApprovalPublishedKey]}
                                    yesLabel="완료"
                                    noLabel="미완료"
                                    onChange={(value) => {
                                      onChange(planApprovalPublishedKey, value);
                                      if (value !== true) {
                                        onChange(planApprovalPublishedDateKey, null);
                                        onChange(planApprovalNoticeReferenceKey, "");
                                      }
                                    }}
                                  />
                                </label>
                              ) : null}
                            </div>
                            {answers[planApprovalPublishedKey] === true ? (
                              <div className="stacked-fields">
                                <label>
                                  <span>승인·고시일</span>
                                  <input
                                    className="text-input"
                                    type="date"
                                    min={law.effectiveFrom}
                                    max={answers.assessmentDate}
                                    value={answers[planApprovalPublishedDateKey] ?? ""}
                                    onChange={(event) => onChange(planApprovalPublishedDateKey, event.target.value || null)}
                                  />
                                </label>
                                <label>
                                  <span>고시문 번호 또는 공식 URL</span>
                                  <input
                                    className="text-input"
                                    type="text"
                                    maxLength={300}
                                    placeholder="예: 국토교통부고시 제0000-000호 또는 공식 고시 URL"
                                    value={answers[planApprovalNoticeReferenceKey]}
                                    onChange={(event) => onChange(planApprovalNoticeReferenceKey, event.target.value)}
                                  />
                                </label>
                              </div>
                            ) : null}
                            <div className="deemed-permit-picker" role="group" aria-label={`${law.shortLabel} 실제 의제대상 인허가`}>
                              {deemedPermitIds.map((procedureId) => (
                                <label key={procedureId}>
                                  <input
                                    type="checkbox"
                                    checked={answers[selectedPermitKey].includes(procedureId)}
                                    onChange={() => toggleDeemedPermit(selectedPermitKey, procedureId)}
                                  />
                                  <span>{procedureNameById.get(procedureId) ?? procedureId}</span>
                                </label>
                              ))}
                            </div>
                            {isIndustrialPlan ? <small>6개월 기한은 일반 입주기업의 인허가 전체기간이 아니라 민간기업등이 산업단지 지정·개발 주체로서 제출한 산업단지계획 승인신청에 한정됩니다.</small> : null}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                  </div>
                  <div className="inline-notice warning">
                    <strong>면제와 의제는 다릅니다</strong>
                    <span>
                      신속처리는 요청·법정기한 경과 후의 처리완료 의제이고, 계획승인 의제는 서류 포함·관계기관 협의와 실제 승인·고시 완료 증거를 전제로 합니다. 확인값을 선택해도 총 소요기간을 자동으로 줄이지 않습니다.
                    </span>
                  </div>
                </details>
              </Question>
            ) : null}
          </>
        ) : null}

        {activeStep === 1 ? (
          <>
            <Question label="건축행위">
              <ChoiceGroup
                value={answers.buildingAction}
                onChange={(value) => onChange("buildingAction", value)}
                options={[
                  { value: "NEW_BUILD", label: "신축" },
                  { value: "EXTENSION", label: "증축" },
                  { value: "MAJOR_REPAIR", label: "대수선" },
                  { value: "CHANGE_OF_USE", label: "용도변경" },
                  { value: "NONE", label: "건축 없음", note: "설비투자" },
                ]}
              />
            </Question>
            <details className="wizard-optional-section">
              <summary>
                <strong>건축 전문검토 항목</strong>
                <span>해당 시 입력</span>
              </summary>
              <div className="wizard-optional-body">
                <Question label="건축위원회 심의 대상 여부" hint="건축물 규모·용도와 관할 건축조례상 심의대상을 확인한 결과를 입력합니다.">
                  <TriState
                    value={answers.buildingCommitteeReviewRequired}
                    yesLabel="대상"
                    noLabel="비대상"
                    onChange={(value) => onChange("buildingCommitteeReviewRequired", value)}
                  />
                </Question>
                <Question label="경관심의 대상 여부" hint="경관법, 경관계획과 관할 경관조례상 개발사업·건축물 심의대상을 확인한 결과를 입력합니다.">
                  <TriState
                    value={answers.landscapeReviewRequired}
                    yesLabel="대상"
                    noLabel="비대상"
                    onChange={(value) => onChange("landscapeReviewRequired", value)}
                  />
                </Question>
                <Question
                  label="기계설비법 착공 전 확인·사용 전 검사 대상 여부"
                  hint="건축물 용도·연면적과 냉난방·환기·급배수 등 기계설비 공사 범위를 검토한 결과를 입력합니다."
                >
                  <TriState
                    value={answers.mechanicalEquipmentActTarget}
                    yesLabel="대상"
                    noLabel="비대상"
                    onChange={(value) => onChange("mechanicalEquipmentActTarget", value)}
                  />
                </Question>
              </div>
            </details>
            <Question label="사업 후 총 연면적" hint="사업 완료 후 건축물 전체 연면적을 입력합니다.">
              <NumberInput label="총 연면적" unit="㎡" value={answers.totalAreaM2} onChange={(value) => onChange("totalAreaM2", value)} />
              {answers.totalAreaM2 !== null ? (
                <p className={`threshold-note ${answers.totalAreaM2 >= 500 ? "is-over" : ""}`}>
                  500㎡ 기준 {answers.totalAreaM2 < 500 ? "미만" : answers.totalAreaM2 === 500 ? "동일" : "초과"} · 현재 {answers.totalAreaM2.toLocaleString("ko-KR")}㎡
                </p>
              ) : null}
            </Question>
            <Question label="부지 현황" hint="개별입지는 지목뿐 아니라 실제 농지·산지 여부를 함께 확인해야 합니다.">
              <select
                value={answers.landCategory ?? "UNKNOWN"}
                onChange={(event) => onChange("landCategory", event.target.value === "UNKNOWN" ? null : event.target.value as ScenarioAnswers["landCategory"])}
              >
                <option value="OTHER">기타 토지(농지·산지 외 · 초지 별도 확인)</option>
                <option value="FARMLAND">농지</option>
                <option value="FOREST">산지</option>
                <option value="UNKNOWN">미확인</option>
              </select>
            </Question>
            {answers.landCategory === "FOREST" ? (
              <Question label="산지 복구의무 확인" hint="산지전용 허가조건에서 복구의무·면제와 복구설계 승인 제외 여부를 확인한 결과입니다.">
                <TriState value={answers.forestRestorationObligation} yesLabel="복구의무 있음" noLabel="면제·제외 확인" onChange={(value) => onChange("forestRestorationObligation", value)} />
              </Question>
            ) : null}
            <details className={`wizard-optional-section wizard-progressive-section${siteDetailAnsweredCount ? " has-values" : ""}`}>
              <summary>
                <strong>부지·건축 추가 확인</strong>
                <span>{progressiveStatus(siteDetailAnsweredCount)}</span>
              </summary>
              <div className="wizard-optional-body">
                <p className="progressive-section-intro">해체, 진입도로, 영향평가 또는 필지별 규제가 있는 사업만 입력하세요. 접어도 이미 입력한 값은 유지됩니다.</p>
                <Question label="기존 건축물 해체 여부">
                  <TriState
                    value={answers.demolitionRequired}
                    onChange={(value) => {
                      onChange("demolitionRequired", value);
                      if (value !== true) onChange("asbestosPresent", null);
                    }}
                  />
                </Question>
                {answers.demolitionRequired === true ? (
                  <Question label="석면 함유 자재 확인 여부" hint="해체·철거 전 석면조사 결과를 입력합니다.">
                    <TriState value={answers.asbestosPresent} yesLabel="석면 있음" noLabel="석면 없음" onChange={(value) => onChange("asbestosPresent", value)} />
                  </Question>
                ) : null}
                <Question label="도로 직접 연결허가 필요 여부">
                  <TriState value={answers.roadConnectionRequired} yesLabel="필요" noLabel="불필요" onChange={(value) => onChange("roadConnectionRequired", value)} />
                </Question>
                <Question label="교통영향평가 대상 여부" hint="공장 연면적·도시교통정비지역·조례 기준을 검토한 결과를 입력합니다.">
                  <TriState value={answers.trafficImpactAssessmentRequired} yesLabel="대상" noLabel="비대상" onChange={(value) => onChange("trafficImpactAssessmentRequired", value)} />
                </Question>
                {answers.insideIndustrialComplex !== true ? (
                  <Question label="공장설립 승인 시 의제협의 범위" hint="정부24 처리기간 유형 선택에만 사용하며 자동 의제를 의미하지 않습니다.">
                    <select
                      value={answers.permitCoordination ?? "UNKNOWN"}
                      onChange={(event) => onChange("permitCoordination", event.target.value === "UNKNOWN" ? null : event.target.value)}
                    >
                      <option value="NONE">의제 인허가 없음</option>
                      <option value="LOCAL_ONLY">시·군·구 권한만 포함</option>
                      <option value="OTHER_LT_20">타 기관 20일 미만 인허가 포함</option>
                      <option value="OTHER_GTE_20">타 기관 20일 이상 인허가 포함</option>
                      <option value="UNKNOWN">미확인</option>
                    </select>
                  </Question>
                ) : (
                  <div className="inline-notice success">
                    <strong>산단 경로</strong>
                    <span>입주계약 체결 시 별도 공장설립 승인은 의제되어 중복 제거됩니다.</span>
                  </div>
                )}
                <Question label="재해영향평가등 협의 검토 결과">
                  <select
                    value={answers.disasterImpactAssessmentType ?? "UNKNOWN"}
                    onChange={(event) => onChange("disasterImpactAssessmentType", event.target.value === "UNKNOWN" ? null : event.target.value as ScenarioAnswers["disasterImpactAssessmentType"])}
                  >
                    <option value="NONE">비대상</option>
                    <option value="DISASTER_IMPACT">재해영향평가 대상</option>
                    <option value="DISASTER_IMPACT_REVIEW">재해영향성검토 대상</option>
                    <option value="UNKNOWN">미확인</option>
                  </select>
                </Question>
                <Question label="지하안전평가 검토 결과" hint="굴착깊이와 굴착면적을 기준으로 검토한 값을 입력합니다.">
                  <select
                    value={answers.undergroundSafetyAssessmentType ?? "UNKNOWN"}
                    onChange={(event) => onChange("undergroundSafetyAssessmentType", event.target.value === "UNKNOWN" ? null : event.target.value as ScenarioAnswers["undergroundSafetyAssessmentType"])}
                  >
                    <option value="NONE">비대상</option>
                    <option value="UNDERGROUND_SAFETY">지하안전평가 대상</option>
                    <option value="SMALL_UNDERGROUND_SAFETY">소규모 지하안전평가 대상</option>
                    <option value="UNKNOWN">미확인</option>
                  </select>
                </Question>
                <Question label="국가유산 영향 검토 결과" hint="매장유산 유존지역·보존영향 검토 결과를 입력합니다.">
                  <select
                    value={answers.nationalHeritageAssessmentType ?? "UNKNOWN"}
                    onChange={(event) => onChange("nationalHeritageAssessmentType", event.target.value === "UNKNOWN" ? null : event.target.value as ScenarioAnswers["nationalHeritageAssessmentType"])}
                  >
                    <option value="NONE">비대상</option>
                    <option value="PRELIMINARY_CONSULTATION">사전협의 대상</option>
                    <option value="IMPACT_DIAGNOSIS">영향진단 대상</option>
                    <option value="SIMPLIFIED_DIAGNOSIS">약식영향진단 대상</option>
                    <option value="UNKNOWN">미확인</option>
                  </select>
                </Question>
                <Question label="필지별 입지규제 검토" hint="토지이용규제정보와 관할기관 사전검토 결과를 항목별로 입력합니다.">
                  <div className="stacked-fields compact-tristates">
                    <label><span>군사시설 보호구역 협의</span><TriState value={answers.militaryProtectionConsultationRequired} yesLabel="필요" noLabel="불필요" onChange={(value) => onChange("militaryProtectionConsultationRequired", value)} /></label>
                    <label><span>하천점용허가</span><TriState value={answers.riverOccupationRequired} yesLabel="필요" noLabel="불필요" onChange={(value) => onChange("riverOccupationRequired", value)} /></label>
                    <label><span>공유수면 점용·사용허가</span><TriState value={answers.publicWaterOccupationRequired} yesLabel="필요" noLabel="불필요" onChange={(value) => onChange("publicWaterOccupationRequired", value)} /></label>
                    <label><span>상수원보호구역 해당</span><TriState value={answers.waterSourceProtectionZone} yesLabel="해당" noLabel="비해당" onChange={(value) => onChange("waterSourceProtectionZone", value)} /></label>
                  </div>
                </Question>
              </div>
            </details>
          </>
        ) : null}

        {activeStep === 2 ? (
          <>
            <Question label="대기배출시설 해당 여부" hint="시설 종류·규모를 관계 법령의 배출시설 분류표와 대조한 결과를 입력하세요.">
              <TriState
                value={answers.airEmissionFacility}
                onChange={(value) => {
                  onChange("airEmissionFacility", value);
                  if (value !== true) onChange("airTotalManagementBusinessTarget", null);
                }}
              />
            </Question>
            {answers.airEmissionFacility === true ? (
              <Question
                label="대기 총량관리사업장 설치허가 대상 여부"
                hint="사업지가 법정 대기관리권역 안에 있고, 질소산화물·황산화물·먼지의 연간 배출량이 시행령 기준 이상인지 검토한 결과를 입력합니다."
              >
                <TriState
                  value={answers.airTotalManagementBusinessTarget}
                  yesLabel="대상"
                  noLabel="비대상"
                  onChange={(value) => onChange("airTotalManagementBusinessTarget", value)}
                />
              </Question>
            ) : null}
            <Question label="폐수배출시설 해당 여부">
              <TriState value={answers.waterDischargeFacility} onChange={(value) => onChange("waterDischargeFacility", value)} />
            </Question>
            <Question label="소음·진동배출시설 해당 여부" hint="기계·기구의 종류·출력과 입지를 관계 법령의 배출시설 분류표와 대조한 결과를 입력하세요.">
              <TriState value={answers.noiseVibrationFacility} onChange={(value) => onChange("noiseVibrationFacility", value)} />
            </Question>
            <details className={`wizard-optional-section wizard-progressive-section${environmentalDetailAnsweredCount ? " has-values" : ""}`}>
              <summary>
                <strong>환경평가·기타 신고</strong>
                <span>{progressiveStatus(environmentalDetailAnsweredCount)}</span>
              </summary>
              <div className="wizard-optional-body">
                <p className="progressive-section-intro">환경평가, 통합환경허가 또는 개별 법정 임계값을 검토한 경우에만 입력하세요.</p>
                <Question label="폐기물처리시설 설치 여부">
                  <TriState value={answers.wasteFacility} onChange={(value) => onChange("wasteFacility", value)} />
                </Question>
                <Question label="환경영향평가 검토 결과" hint="사업유형·용도지역·개발면적을 기준으로 본안/소규모 여부를 구분합니다.">
                  <select
                    value={answers.environmentalAssessmentType ?? "UNKNOWN"}
                    onChange={(event) => onChange("environmentalAssessmentType", event.target.value === "UNKNOWN" ? null : event.target.value as ScenarioAnswers["environmentalAssessmentType"])}
                  >
                    <option value="NONE">비대상</option>
                    <option value="ENVIRONMENTAL">환경영향평가 대상</option>
                    <option value="SMALL">소규모 환경영향평가 대상</option>
                    <option value="UNKNOWN">미확인</option>
                  </select>
                </Question>
                <Question label="통합환경허가 대상 여부" hint="대상 업종과 대기·수질 1·2종 등 규모를 검토한 결과를 입력합니다.">
                  <TriState value={answers.integratedEnvironmentalPermitTarget} yesLabel="대상" noLabel="비대상" onChange={(value) => onChange("integratedEnvironmentalPermitTarget", value)} />
                </Question>
                <details className="wizard-optional-section supplemental-permit-review">
                  <summary>
                    <strong>공사·환경 법정 임계값 정밀검토</strong>
                    <span>{answers.supplementalPermitReviewedIds.length}/{supplementalPermitTargetIds.length} 검토 · {answers.supplementalPermitTargetIds.length}개 대상</span>
                  </summary>
                  <div className="wizard-optional-body">
                    <p className="supplemental-permit-intro">단순 업종·신축·전력·용수만으로 확정할 수 없는 절차입니다. 법정 시설·수량·공사기준을 대조한 항목만 대상 또는 비대상으로 표시하고, 아직 보지 않은 항목은 미확인으로 남겨 주세요.</p>
                    <div
                      className="supplemental-permit-decision-list"
                      role="group"
                      aria-label="공사·환경 법정 임계값 검토 결과"
                    >
                      {supplementalPermitTargetIds.map((procedureId) => {
                        const procedureName = procedureNameById.get(procedureId) ?? procedureId;
                        return (
                          <div className="supplemental-permit-decision-row" key={procedureId}>
                            <span>
                              <strong>{procedureName}</strong>
                              <small>{supplementalPermitTargetDescriptions[procedureId]}</small>
                            </span>
                            <TriState
                              value={supplementalPermitDecision(procedureId)}
                              yesLabel="대상"
                              noLabel="비대상"
                              unknownLabel="미확인"
                              ariaLabel={`${procedureName} 대상 여부`}
                              onChange={(value) => setSupplementalPermitDecision(procedureId, value)}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <small>검토서·산출표·관할기관 회신을 보관하고 사업조건이 바뀌면 다시 확인하세요.</small>
                  </div>
                </details>
              </div>
            </details>
            <Question label="화학물질 취급 여부">
              <TriState
                value={answers.chemicalsHandled}
                onChange={(value) => {
                  onChange("chemicalsHandled", value);
                  if (value !== true) {
                    onChange("chemicalManufactureOrImport", null);
                    onChange("hazardousChemicalBusiness", null);
                    onChange("chemicalRegistrationRequired", null);
                    onChange("restrictedOrToxicChemicalImport", null);
                  }
                }}
              />
            </Question>
            {answers.chemicalsHandled === true ? (
              <>
                <Question label="화학물질·혼합물 직접 제조·수입 여부" hint="국내에서 구매해 사용만 하는 경우와 구분합니다.">
                  <TriState value={answers.chemicalManufactureOrImport} yesLabel="제조·수입" noLabel="국내 구매·사용" onChange={(value) => onChange("chemicalManufactureOrImport", value)} />
                </Question>
                <Question label="유해화학물질 영업허가 대상 여부">
                  <TriState value={answers.hazardousChemicalBusiness} yesLabel="대상" noLabel="비대상" onChange={(value) => onChange("hazardousChemicalBusiness", value)} />
                </Question>
                <Question label="화학물질 등록·신고 대상 여부" hint="신규·기존화학물질의 제조·수입량과 면제 여부를 검토한 값을 입력합니다.">
                  <TriState value={answers.chemicalRegistrationRequired} yesLabel="대상" noLabel="비대상" onChange={(value) => onChange("chemicalRegistrationRequired", value)} />
                </Question>
                <Question label="제한·금지·유독물질 수입허가·신고 대상 여부">
                  <TriState value={answers.restrictedOrToxicChemicalImport} yesLabel="대상" noLabel="비대상" onChange={(value) => onChange("restrictedOrToxicChemicalImport", value)} />
                </Question>
              </>
            ) : null}
            <Question label="지정수량 이상 위험물 취급 여부">
              <TriState
                value={answers.hazardousMaterials}
                onChange={(value) => {
                  onChange("hazardousMaterials", value);
                  if (value !== true) {
                    onChange("hazardousMaterialsTank", null);
                    onChange("hazardousMaterialsPreventionRulesRequired", null);
                  }
                }}
              />
            </Question>
            {answers.hazardousMaterials === true ? (
              <>
                <Question label="위험물 탱크 설치 여부"><TriState value={answers.hazardousMaterialsTank} onChange={(value) => onChange("hazardousMaterialsTank", value)} /></Question>
                <Question label="위험물 예방규정 작성 대상 여부"><TriState value={answers.hazardousMaterialsPreventionRulesRequired} yesLabel="대상" noLabel="비대상" onChange={(value) => onChange("hazardousMaterialsPreventionRulesRequired", value)} /></Question>
              </>
            ) : null}
            <Question label="허가·신고 대상 고압가스 여부">
              <TriState
                value={answers.highPressureGas}
                onChange={(value) => {
                  onChange("highPressureGas", value);
                  if (value !== true) onChange("highPressureGasBusinessStartTarget", null);
                }}
              />
            </Question>
            {answers.highPressureGas === true ? (
              <Question label="고압가스 사업·저장소 개시신고 대상 확인" hint="단순 특정고압가스 사용경로와 구분해, 고압가스 사업자·저장소 경로의 개시신고 대상인지 관할기관에 확인한 값을 입력합니다.">
                <TriState value={answers.highPressureGasBusinessStartTarget} yesLabel="대상" noLabel="비대상" onChange={(value) => onChange("highPressureGasBusinessStartTarget", value)} />
              </Question>
            ) : null}
            <details className="wizard-optional-section">
              <summary>
                <strong>가스·산업안전 추가 확인</strong>
                <span>해당 시 입력</span>
              </summary>
              <div className="wizard-optional-body">
                <Question label="특정고압가스 사용신고 대상 여부" hint="가스 종류와 저장·사용 규모를 검토한 결과를 입력합니다.">
                  <TriState value={answers.specificHighPressureGasUse} yesLabel="대상" noLabel="비대상" onChange={(value) => onChange("specificHighPressureGasUse", value)} />
                </Question>
                <Question label="LPG 특정사용시설 여부" hint="산업용 LPG 저장능력·사용량과 시설종류를 기준으로 완성검사 대상을 선택합니다.">
                  <TriState value={answers.lpgSpecificUseFacility} yesLabel="검사 대상" noLabel="비대상" onChange={(value) => onChange("lpgSpecificUseFacility", value)} />
                </Question>
                <Question label="도시가스 특정사용시설 여부" hint="월 사용예정량과 배관 설치형태를 기준으로 완성검사 대상을 선택합니다.">
                  <TriState value={answers.cityGasSpecificUseFacility} yesLabel="검사 대상" noLabel="비대상" onChange={(value) => onChange("cityGasSpecificUseFacility", value)} />
                </Question>
                <Question label="PSM 대상 설비 여부" hint="업종·유해위험물질·규정량을 전문검토한 결과를 입력합니다.">
                  <TriState
                    value={answers.psmCovered}
                    yesLabel="대상"
                    noLabel="비대상"
                    onChange={(value) => {
                      onChange("psmCovered", value);
                      if (value !== true) {
                        onChange("psmCoversSameHazardPreventionScope", null);
                      }
                    }}
                  />
                </Question>
                {answers.psmCovered === true
                  && answers.supplementalPermitTargetIds.includes("hazard-prevention-plan") ? (
                    <Question
                      label="PSM이 동일 유해·위험설비를 포함하는지"
                      hint="공정안전보고서 제출범위와 유해위험방지계획서 대상 설비를 대조한 결과를 입력합니다. 산업안전보건법 제42조제3항의 의제는 같은 유해·위험설비에만 적용됩니다."
                    >
                      <TriState
                        value={answers.psmCoversSameHazardPreventionScope}
                        yesLabel="동일 설비 포함"
                        noLabel="별도 설비·범위"
                        unknownLabel="미확인"
                        onChange={(value) => onChange("psmCoversSameHazardPreventionScope", value)}
                      />
                    </Question>
                  ) : null}
                <Question label="소방안전관리자 선임 대상 여부"><TriState value={answers.fireSafetyManagerRequired} yesLabel="대상" noLabel="비대상" onChange={(value) => onChange("fireSafetyManagerRequired", value)} /></Question>
                <Question label="검사대상 열사용기자재 설치 여부"><TriState value={answers.heatUseEquipment} onChange={(value) => onChange("heatUseEquipment", value)} /></Question>
                <Question label="유해·위험기계 기구 안전검사 대상 여부"><TriState value={answers.hazardousMachineryInspectionRequired} yesLabel="대상" noLabel="비대상" onChange={(value) => onChange("hazardousMachineryInspectionRequired", value)} /></Question>
                <Question label="안전·보건관리자 선임 대상 여부" hint="업종, 상시근로자 수, 공사금액·규모를 검토한 결과를 입력합니다.">
                  <div className="stacked-fields compact-tristates">
                    <label><span>안전관리자</span><TriState value={answers.safetyManagerRequired} yesLabel="대상" noLabel="비대상" onChange={(value) => onChange("safetyManagerRequired", value)} /></label>
                    <label><span>보건관리자</span><TriState value={answers.healthManagerRequired} yesLabel="대상" noLabel="비대상" onChange={(value) => onChange("healthManagerRequired", value)} /></label>
                  </div>
                </Question>
                <div className="inline-notice warning"><strong>별표 임계값</strong><span>물질명·CAS·최대보유량·지정수량 배수와 시설분류는 관계기관 또는 전문가 검토값을 입력하세요.</span></div>
              </div>
            </details>
          </>
        ) : null}

        {activeStep === 3 ? (
          <>
            <Question label="추가 인프라 수요" hint="0은 추가 수요 없음, 빈칸은 미확인으로 판정합니다.">
              <div className="stacked-fields">
                <NumberInput label="전력 증가분" unit="MW" value={answers.powerIncreaseMw} onChange={(value) => onChange("powerIncreaseMw", value)} />
                <NumberInput label="용수 수요" unit="㎥/일" value={answers.waterDemandM3Day} onChange={(value) => onChange("waterDemandM3Day", value)} />
                <NumberInput label="폐수 발생" unit="㎥/일" value={answers.wastewaterM3Day} onChange={(value) => onChange("wastewaterM3Day", value)} />
              </div>
            </Question>
            <details className={`wizard-optional-section wizard-progressive-section${infrastructureDetailAnsweredCount ? " has-values" : ""}`}>
              <summary>
                <strong>설비·공급 인허가 상세 확인</strong>
                <span>{progressiveStatus(infrastructureDetailAnsweredCount)}</span>
              </summary>
              <div className="wizard-optional-body">
                <p className="progressive-section-intro">소방, 전기, 에너지, 지하수 또는 하수도 조건을 확인한 경우에만 입력하세요.</p>
                <Question label="소방시설공사 대상 여부">
                  <TriState
                    value={answers.fireFacilityWork}
                    yesLabel="대상"
                    noLabel="비대상"
                    onChange={(value) => {
                      onChange("fireFacilityWork", value);
                      if (value !== true) {
                        onChange("fireWorkSupervisionTarget", null);
                        onChange("firstFireSelfInspectionTarget", null);
                      }
                    }}
                  />
                </Question>
                {answers.fireFacilityWork === true ? (
                  <Question label="소방공사 후속절차 확인" hint="소방시설 종류·공사범위와 대상물 규모를 관할 소방기관에 확인한 결과를 입력합니다.">
                    <div className="stacked-fields compact-tristates">
                      <label><span>소방공사 감리자 지정신고 대상</span><TriState value={answers.fireWorkSupervisionTarget} yesLabel="대상" noLabel="비대상" onChange={(value) => onChange("fireWorkSupervisionTarget", value)} /></label>
                      <label><span>최초 자체점검·결과보고 대상</span><TriState value={answers.firstFireSelfInspectionTarget} yesLabel="대상" noLabel="비대상" onChange={(value) => onChange("firstFireSelfInspectionTarget", value)} /></label>
                    </div>
                  </Question>
                ) : null}
                <Question label="자가용전기설비 공사·사용전검사 대상 여부" hint="수전전압·설비용량·공사종류를 검토한 결과를 입력합니다.">
                  <TriState value={answers.privateElectricalFacilityWork} yesLabel="대상" noLabel="비대상" onChange={(value) => onChange("privateElectricalFacilityWork", value)} />
                </Question>
                <Question label="에너지사용계획 협의 대상 여부">
                  <TriState value={answers.energyUsePlanRequired} yesLabel="대상" noLabel="비대상" onChange={(value) => onChange("energyUsePlanRequired", value)} />
                </Question>
                <Question label="전력계통영향평가 대상 여부" hint="대상지역, 신규 전력수요와 시행령상 제외사업을 검토한 결과를 입력합니다. AI 데이터센터 특별법의 면제는 위 특례 선택과 시행일을 함께 확인합니다.">
                  <TriState value={answers.gridImpactAssessmentRequired} yesLabel="대상" noLabel="비대상" onChange={(value) => onChange("gridImpactAssessmentRequired", value)} />
                </Question>
                <Question label="지하수 개발·이용 여부">
                  <TriState value={answers.groundwaterDevelopment} yesLabel="개발" noLabel="없음" onChange={(value) => onChange("groundwaterDevelopment", value)} />
                </Question>
                <Question label="오·폐수 처리 경로" hint="공공하수도 연결과 개인하수처리시설 설치 여부를 각각 입력합니다.">
                  <div className="stacked-fields compact-tristates">
                    <label><span>공공하수도 연결</span><TriState value={answers.publicSewerConnection} yesLabel="연결" noLabel="미연결" onChange={(value) => onChange("publicSewerConnection", value)} /></label>
                    <label><span>개인하수처리시설 설치</span><TriState value={answers.privateSewageTreatmentFacility} yesLabel="설치" noLabel="미설치" onChange={(value) => onChange("privateSewageTreatmentFacility", value)} /></label>
                  </div>
                </Question>
              </div>
            </details>
            <div className="inline-notice info">
              <strong>공급 일정 확인</strong>
              <span>전력·용수·폐수 인입은 공급기관의 용량 검토와 외부 공사 범위에 따라 달라집니다. 협의 결과가 나오면 공사 일정과 함께 갱신하세요.</span>
            </div>
          </>
        ) : null}

        {activeStep === 4 ? (
          <>
            <Question
              label="예상 공사 일정"
              hint="2025년 1월 1일부터 착공·준공 예정일을 입력하면 절차별 처리기간과 공사기간을 일 단위로 합쳐 계산합니다."
            >
              <div className="two-column-fields construction-date-fields">
                <label>
                  <span>착공 예정일</span>
                  <input
                    className="text-input"
                    type="date"
                    min="2025-01-01"
                    max="2040-12-31"
                    value={answers.plannedConstructionStartDate ?? ""}
                    onChange={(event) => onChange(
                      "plannedConstructionStartDate",
                      event.target.value || null,
                    )}
                  />
                </label>
                <label>
                  <span>준공 예정일</span>
                  <input
                    className="text-input"
                    type="date"
                    min={answers.plannedConstructionStartDate ?? "2025-01-01"}
                    max="2040-12-31"
                    value={answers.plannedConstructionEndDate ?? ""}
                    onChange={(event) => onChange(
                      "plannedConstructionEndDate",
                      event.target.value || null,
                    )}
                  />
                </label>
              </div>
              <details className="wizard-optional-section">
                <summary>
                  <strong>설비 설치·시운전 목표일</strong>
                  <span>선택 입력</span>
                </summary>
                <div className="two-column-fields construction-date-fields milestone-date-fields">
                  <label>
                    <span>주요 설비 설치완료 예정일</span>
                    <input className="text-input" type="date" min={answers.plannedConstructionStartDate ?? "2025-01-01"} max={answers.plannedConstructionEndDate ?? "2040-12-31"} value={answers.equipmentInstallationCompletionDate ?? ""} onChange={(event) => onChange("equipmentInstallationCompletionDate", event.target.value || null)} />
                  </label>
                  <label>
                    <span>시운전 시작 예정일</span>
                    <input className="text-input" type="date" min={answers.equipmentInstallationCompletionDate ?? answers.plannedConstructionStartDate ?? "2025-01-01"} max="2040-12-31" value={answers.commissioningStartDate ?? ""} onChange={(event) => onChange("commissioningStartDate", event.target.value || null)} />
                  </label>
                </div>
                <p className="question-hint">사용전검사·가동개시 절차의 목표일 관리에만 사용하며 총 소요기간에는 임의로 합산하지 않습니다.</p>
              </details>
              {answers.plannedConstructionStartDate && answers.plannedConstructionEndDate ? (
                calendarDayDistance(
                  answers.plannedConstructionStartDate,
                  answers.plannedConstructionEndDate,
                ) > 0 ? (
                  <p className="threshold-note is-over">
                    {koreanDate(answers.plannedConstructionStartDate)}부터 {koreanDate(answers.plannedConstructionEndDate)}까지 · 공사 {calendarDayDistance(answers.plannedConstructionStartDate, answers.plannedConstructionEndDate).toLocaleString("ko-KR")}일
                  </p>
                ) : (
                  <p className="threshold-note schedule-date-error">
                    준공 예정일은 착공 예정일보다 빠를 수 없습니다.
                  </p>
                )
              ) : (
                <p className="question-hint">두 값을 모두 입력하면 공식 최단 경로와 공식 기준 경로를 자동으로 비교할 수 있습니다.</p>
              )}
            </Question>
            <div className="inline-notice info">
              <strong>자동 일정 계산</strong>
              <span>법령·정부24에서 확인한 원 단위 처리기간을 사용합니다. 병행 가능한 절차는 겹쳐 배치하고, 착공이나 가동을 막는 경로만 총기간을 늘립니다.</span>
            </div>
            <details className={`wizard-optional-section wizard-progressive-section${constructionDetailAnsweredCount ? " has-values" : ""}`}>
              <summary>
                <strong>건설공사 안전 신고</strong>
                <span>{progressiveStatus(constructionDetailAnsweredCount)}</span>
              </summary>
              <div className="wizard-optional-body">
                <Question label="건설공사 사전계획·신고 대상 여부" hint="공사 종류·규모·공사금액을 검토한 결과를 입력합니다.">
                  <div className="stacked-fields compact-tristates">
                    <label><span>안전관리계획 수립·검토</span><TriState value={answers.safetyManagementPlanRequired} yesLabel="대상" noLabel="비대상" onChange={(value) => onChange("safetyManagementPlanRequired", value)} /></label>
                    <label><span>유해·위험 작업 신고</span><TriState value={answers.specificWorkReportRequired} yesLabel="대상" noLabel="비대상" onChange={(value) => onChange("specificWorkReportRequired", value)} /></label>
                  </div>
                </Question>
              </div>
            </details>
          </>
        ) : null}
      </div>

      <div className="wizard-footer">
        <button type="button" disabled={activeStep === 0} onClick={() => onStepChange(Math.max(0, activeStep - 1))}>이전</button>
        <button type="button" className="primary-button" disabled={activeStep === steps.length - 1} onClick={() => onStepChange(Math.min(steps.length - 1, activeStep + 1))}>다음</button>
      </div>
    </aside>
  );
}
