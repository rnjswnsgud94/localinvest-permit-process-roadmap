"use client";

import { useEffect, useMemo, useState } from "react";

import {
  procedureCategoryForDecision,
  procedureCategoryOrder,
  procedureCategorySummaries,
  tabLabels,
  type DashboardTab,
  type ProcedureCategory,
} from "@/app/components/dashboard/constants";
import { DashboardTabIcon } from "@/app/components/dashboard/DashboardTabIcon";
import { ActionPlanView, GapsView, LegalView, ProcedureList, ScheduleView } from "@/app/components/dashboard/DashboardViews";
import { InputCodeDialog } from "@/app/components/dashboard/InputCodeDialog";
import { LocalJurisdictionLinks, LocalOrdinancePanel } from "@/app/components/dashboard/LocalOrdinancePanel";
import { PermitRegistry } from "@/app/components/dashboard/PermitRegistry";
import { PdfReportButton } from "@/app/components/dashboard/PdfReportButton";
import { ProcedureDrawer } from "@/app/components/dashboard/ProcedureDrawer";
import { ScenarioCompare } from "@/app/components/dashboard/ScenarioCompare";
import { StatusSummaryDialog } from "@/app/components/dashboard/StatusSummaryDialog";
import { TotalDurationDialog } from "@/app/components/dashboard/TotalDurationDialog";
import { VerificationLedger } from "@/app/components/dashboard/VerificationLedger";
import { WorkspaceToolDialog } from "@/app/components/dashboard/WorkspaceToolDialog";
import { ProjectInputSummary } from "@/app/components/dashboard/ScenarioPicker";
import { SpecialLawSummary } from "@/app/components/dashboard/SpecialLawSummary";
import { Swimlane } from "@/app/components/dashboard/Swimlane";
import { Wizard } from "@/app/components/dashboard/Wizard";
import { catalog, type ScenarioAnswers } from "@/lib/data/catalog";
import { evaluateProject } from "@/lib/engine/pipeline";
import type { DurationScenario } from "@/lib/engine/schedule";
import { formatCalendarPeriod } from "@/lib/format-duration";
import {
  decodeInputCode,
  decodeShareState,
  encodeInputCode,
  encodeShareState,
  InputCodeError,
  ShareStateTooLongError,
} from "@/lib/share-state";

export const defaultAnswers: ScenarioAnswers = {
  assessmentDate: catalog.coverage.assessmentDefault,
  plannedConstructionStartDate: null,
  plannedConstructionEndDate: null,
  equipmentInstallationCompletionDate: null,
  commissioningStartDate: null,
  investmentType: "UNKNOWN",
  province: "",
  city: "",
  siteAddress: "",
  siteZoning: "",
  siteRestrictedFactors: "",
  insideIndustrialComplex: null,
  industrialComplexName: "",
  industrialComplexIdentifier: "",
  industrialComplexManagingAuthority: "",
  industrialComplexOccupancyContractStatus: "NOT_APPLIED",
  industryCategory: "UNKNOWN",
  ksicCode: "",
  products: "",
  coreProcesses: "",
  existingApprovalIds: "",
  buildingAction: "UNKNOWN",
  mechanicalEquipmentActTarget: null,
  existingAreaM2: null,
  increaseAreaM2: null,
  totalAreaM2: null,
  landCategory: null,
  demolitionRequired: null,
  roadConnectionRequired: null,
  trafficImpactAssessmentRequired: null,
  landscapeReviewRequired: null,
  buildingCommitteeReviewRequired: null,
  gridImpactAssessmentRequired: null,
  aiDataCenterActFacilityConfirmed: null,
  aiDataCenterOneStopStatus: "NOT_APPLIED",
  appliedSpecialLawIds: [],
  advancedStrategicIndustryFastTrackConfirmed: null,
  advancedStrategicIndustryApplicantRoleConfirmed: null,
  advancedStrategicIndustryDelayRiskConfirmed: null,
  advancedStrategicIndustryCommitteeResolved: null,
  advancedStrategicIndustryMinisterRequestDate: null,
  advancedStrategicIndustryFastTrackPermitIds: [],
  semiconductorClusterFastTrackConfirmed: null,
  semiconductorClusterApplicantRoleConfirmed: null,
  semiconductorClusterDelayRiskConfirmed: null,
  semiconductorClusterCommitteeResolved: null,
  semiconductorClusterMinisterRequestDate: null,
  semiconductorClusterFastTrackPermitIds: [],
  semiconductorClusterPlanDeemingConfirmed: null,
  semiconductorClusterPlanDocumentsIncluded: null,
  semiconductorClusterPlanConsultationCompleted: null,
  semiconductorClusterPlanApprovalPublished: null,
  semiconductorClusterPlanApprovalPublishedDate: null,
  semiconductorClusterPlanApprovalNoticeReference: "",
  semiconductorClusterPlanIncludedPermitIds: [],
  industrialComplexPlanSpecialCaseConfirmed: null,
  industrialComplexPlanDocumentsIncluded: null,
  industrialComplexPlanConsultationCompleted: null,
  industrialComplexPlanApprovalPublished: null,
  industrialComplexPlanApprovalPublishedDate: null,
  industrialComplexPlanApprovalNoticeReference: "",
  industrialComplexPlanIncludedPermitIds: [],
  regionalSpecialZonePlanDeemingConfirmed: null,
  regionalSpecialZonePlanDocumentsIncluded: null,
  regionalSpecialZonePlanConsultationCompleted: null,
  regionalSpecialZonePlanApprovalPublished: null,
  regionalSpecialZonePlanApprovalPublishedDate: null,
  regionalSpecialZonePlanApprovalNoticeReference: "",
  regionalSpecialZonePlanIncludedPermitIds: [],
  permitCoordination: null,
  airEmissionFacility: null,
  airTotalManagementBusinessTarget: null,
  supplementalPermitReviewedIds: [],
  supplementalPermitTargetIds: [],
  waterDischargeFacility: null,
  noiseVibrationFacility: null,
  environmentalAssessmentType: null,
  integratedEnvironmentalPermitTarget: null,
  chemicalsHandled: null,
  chemicalManufactureOrImport: null,
  hazardousChemicalBusiness: null,
  hazardousMaterials: null,
  highPressureGas: null,
  highPressureGasBusinessStartTarget: null,
  specificHighPressureGasUse: null,
  lpgSpecificUseFacility: null,
  cityGasSpecificUseFacility: null,
  psmCovered: null,
  psmCoversSameHazardPreventionScope: null,
  fireFacilityWork: null,
  fireWorkSupervisionTarget: null,
  firstFireSelfInspectionTarget: null,
  privateElectricalFacilityWork: null,
  energyUsePlanRequired: null,
  groundwaterDevelopment: null,
  disasterImpactAssessmentType: null,
  undergroundSafetyAssessmentType: null,
  nationalHeritageAssessmentType: null,
  militaryProtectionConsultationRequired: null,
  riverOccupationRequired: null,
  publicWaterOccupationRequired: null,
  waterSourceProtectionZone: null,
  safetyManagementPlanRequired: null,
  specificWorkReportRequired: null,
  asbestosPresent: null,
  publicSewerConnection: null,
  privateSewageTreatmentFacility: null,
  wasteFacility: null,
  chemicalRegistrationRequired: null,
  restrictedOrToxicChemicalImport: null,
  fireSafetyManagerRequired: null,
  hazardousMaterialsTank: null,
  hazardousMaterialsPreventionRulesRequired: null,
  heatUseEquipment: null,
  hazardousMachineryInspectionRequired: null,
  safetyManagerRequired: null,
  healthManagerRequired: null,
  forestRestorationObligation: null,
  powerIncreaseMw: null,
  waterDemandM3Day: null,
  wastewaterM3Day: null,
  userDurationOverrides: {},
};
const validTabs = new Set(Object.keys(tabLabels));
const summaryClass: Record<ProcedureCategory, string> = {
  REQUIRED: "applies",
  CONFIRM: "possibly_applies",
  NOT_REQUIRED: "does_not_apply",
};

type WorkspaceTool = "REGISTRY" | "VERIFICATION" | "COMPARE";

const workspaceToolTriggerIds: Record<WorkspaceTool, string> = {
  REGISTRY: "permit-registry-trigger",
  VERIFICATION: "verification-ledger-trigger",
  COMPARE: "scenario-compare-trigger",
};

function OrdinanceDisclosure({ answers }: { answers: ScenarioAnswers }) {
  const [isOpen, setIsOpen] = useState(Boolean(answers.province));
  return (
    <details
      className="ordinance-disclosure"
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary>지역 자치법규 확인</summary>
      <LocalOrdinancePanel answers={answers} />
    </details>
  );
}

export function DashboardClient() {
  const [answers, setAnswers] = useState<ScenarioAnswers>(defaultAnswers);
  const [activeStep, setActiveStep] = useState(0);
  const [activeTab, setActiveTab] = useState<DashboardTab>("SWIMLANE");
  const [durationScenario, setDurationScenario] = useState<DurationScenario>("TYPICAL");
  const [isDurationDialogOpen, setIsDurationDialogOpen] = useState(false);
  const [selectedSummaryCategory, setSelectedSummaryCategory] = useState<ProcedureCategory | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("ALL");
  const [showExcluded, setShowExcluded] = useState(false);
  const [requiredOnly, setRequiredOnly] = useState(false);
  const [includeConditional, setIncludeConditional] = useState(true);
  const [includePractical, setIncludePractical] = useState(true);
  const [shareMessage, setShareMessage] = useState("");
  const [inputCode, setInputCode] = useState<string | null>(null);
  const [inputCodeError, setInputCodeError] = useState("");
  const [activeWorkspaceTool, setActiveWorkspaceTool] = useState<WorkspaceTool | null>(null);
  const [drawerReturnTool, setDrawerReturnTool] = useState<WorkspaceTool | null>(null);

  useEffect(() => {
    const initialSearch = window.location.search;
    if (!new URLSearchParams(initialSearch).has("v")) return;
    const timeout = window.setTimeout(() => {
      const restored = decodeShareState(initialSearch, defaultAnswers);
      setAnswers(restored.answers);
      setDurationScenario(
        Object.keys(restored.answers.userDurationOverrides).length
          ? "USER"
          : "TYPICAL",
      );
      if (restored.tab && validTabs.has(restored.tab)) setActiveTab(restored.tab as DashboardTab);
      if (restored.warning) setShareMessage(restored.warning);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const query = encodeShareState(answers, activeTab);
        window.history.replaceState(null, "", `${window.location.pathname}?${query}`);
      } catch (error) {
        if (!(error instanceof ShareStateTooLongError)) throw error;
        // Never leave a previous project's query string attached to a newer,
        // larger input-code state that cannot be represented safely in a URL.
        window.history.replaceState(null, "", window.location.pathname);
      }
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [answers, activeTab]);

  const evaluation = useMemo(() => evaluateProject(answers, { includeConditional, includePractical }), [answers, includeConditional, includePractical]);
  const schedule = evaluation.schedules[durationScenario];
  const timeline = schedule.projectTimeline;
  const userDurationOverrideCount = Object.keys(answers.userDurationOverrides).length;
  const unknownOperationReadyDurationCount = timeline
    ? timeline.unknownPlanningDurationProcedureIds.filter(
        (id) => !timeline.postOperationProcedureIds.includes(id),
      ).length
    : 0;
  const omittedOperationReadyProcedureCount = timeline
    ? timeline.omittedConditionalProcedureIds.filter(
        (id) => !timeline.postOperationProcedureIds.includes(id),
      ).length
    : 0;
  const incompleteDurationComponentCount = timeline
    ? timeline.incompleteDurationComponentProcedureIds.filter(
        (id) => !timeline.postOperationProcedureIds.includes(id),
      ).length
    : 0;
  const minimumOnlyMissingComponents = [
    unknownOperationReadyDurationCount
      ? `처리기간 미확인 인허가 ${unknownOperationReadyDurationCount}개`
      : null,
    omittedOperationReadyProcedureCount
      ? `일정에서 제외한 대상확인 절차 ${omittedOperationReadyProcedureCount}개`
      : null,
    incompleteDurationComponentCount
      ? `신청준비·심사·협의 기간 구성 미확인 ${incompleteDurationComponentCount}개`
      : null,
  ].filter((item): item is string => item !== null);
  const durationSummary = !timeline
    ? {
        value: "산정 불가",
        detail: "착공 예정일·준공 예정일 미입력",
        description: "공사 일정과 공식 처리기간을 함께 계산합니다.",
        isMinimumOnly: false,
      }
    : timeline.durationStatus === "MINIMUM_ONLY"
      ? {
          value: formatCalendarPeriod(timeline.projectStartDate, timeline.minimumKnownCompletionDate),
          detail: `누락 구성요소 · ${minimumOnlyMissingComponents.join(" · ") || "일정 구조 검증 항목"}${durationScenario === "USER" ? ` · 사용자 예상 ${timeline.userDurationOverrideProcedureIds.length}건 반영` : ""}`,
          description: durationScenario === "USER"
            ? "사용자 예상값과 확인된 공식 처리기간만 합산한 일정 하한입니다."
            : "공식 처리기간이 확인된 절차만 합산한 값으로, 총 소요기간이 아닙니다.",
          isMinimumOnly: true,
        }
      : {
          value: formatCalendarPeriod(timeline.projectStartDate, timeline.operationReadyDate ?? timeline.minimumKnownCompletionDate),
          detail: durationScenario === "MIN"
            ? "공식 최단 처리경로"
            : durationScenario === "USER"
              ? `사용자 예상 ${timeline.userDurationOverrideProcedureIds.length}건 반영`
              : "공식 기준 처리경로",
          description: durationScenario === "MIN"
            ? "가장 빠른 공식 처리경로를 기준으로 산정합니다."
            : durationScenario === "USER"
              ? "카드에 입력한 실무 예상값을 우선 적용하며, 없는 절차는 공식 기준값을 사용합니다."
              : "확인된 공식 처리분기와 관할 기준을 적용하며 실제 평균을 뜻하지 않습니다.",
          isMinimumOnly: false,
        };
  const durationHeading = !timeline
    ? "사업 일정"
    : durationSummary.isMinimumOnly
      ? "확인된 일정 하한"
      : "총 소요기간";
  const domains = useMemo(() => [...new Set(evaluation.decisions.map((decision) => decision.procedure.domain))].sort(), [evaluation.decisions]);
  const decisionsByCategory = useMemo(
    () => Object.fromEntries(
      procedureCategoryOrder.map((category) => [
        category,
        evaluation.decisions.filter(
          (decision) => procedureCategoryForDecision(decision) === category,
        ),
      ]),
    ) as Record<ProcedureCategory, typeof evaluation.decisions>,
    [evaluation],
  );
  const filteredDecisions = evaluation.decisions.filter((decision) => {
    const category = procedureCategoryForDecision(decision);
    if (!showExcluded && category === "NOT_REQUIRED") return false;
    if (requiredOnly && category !== "REQUIRED") return false;
    if (domain !== "ALL" && decision.procedure.domain !== domain) return false;
    const legalText = decision.procedure.citationIds.map((citationId) => {
      const citation = catalog.citations.find((item) => item.id === citationId);
      const source = catalog.legalSources.find((item) => item.id === citation?.sourceId);
      return `${source?.title ?? ""} ${citation?.article ?? ""} ${citation?.summary ?? ""}`;
    }).join(" ");
    const haystack = `${decision.procedure.name} ${decision.procedure.aliases.join(" ")} ${decision.procedure.receivingAuthority} ${legalText}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });
  const selectedDecision = evaluation.decisions.find((decision) => decision.procedure.id === selectedId) ?? null;

  function changeAnswer<K extends keyof ScenarioAnswers>(key: K, value: ScenarioAnswers[K]) {
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  function changeUserDurationOverride(
    procedureId: string,
    value: ScenarioAnswers["userDurationOverrides"][string] | null,
  ) {
    const hadOverride = Object.hasOwn(
      answers.userDurationOverrides,
      procedureId,
    );
    const nextOverrideCount = value === null
      ? userDurationOverrideCount - (hadOverride ? 1 : 0)
      : userDurationOverrideCount + (hadOverride ? 0 : 1);
    setAnswers((current) => {
      const next = { ...current.userDurationOverrides };
      if (value === null) delete next[procedureId];
      else next[procedureId] = value;
      return { ...current, userDurationOverrides: next };
    });
    setDurationScenario(nextOverrideCount > 0 ? "USER" : "TYPICAL");
  }

  async function copyShareLink() {
    let link: string;
    try {
      link = `${window.location.origin}${window.location.pathname}?${encodeShareState(answers, activeTab)}`;
    } catch (error) {
      if (!(error instanceof ShareStateTooLongError)) throw error;
      setShareMessage("입력 내용이 많아 공유 링크를 만들 수 없습니다. 긴 설명이나 선택 항목을 줄여 주세요.");
      window.setTimeout(() => setShareMessage(""), 3600);
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setShareMessage(
        userDurationOverrideCount
          ? `카드별 실무 예상기간 ${userDurationOverrideCount}건을 포함한 공유 링크를 복사했습니다.`
          : "현재 조건의 공유 링크를 복사했습니다.",
      );
    } catch {
      setShareMessage("주소창의 링크를 복사해 공유해 주세요.");
    }
    window.setTimeout(() => setShareMessage(""), 2600);
  }

  function openInputCodeDialog() {
    try {
      setInputCodeError("");
      setInputCode(encodeInputCode(answers));
    } catch (error) {
      if (!(error instanceof ShareStateTooLongError) && !(error instanceof InputCodeError)) throw error;
      // Import remains available even if the current state is too large to
      // export. The dialog explains why no initial code could be generated.
      setInputCodeError(error.message);
      setInputCode("");
    }
  }

  function closeInputCodeDialog() {
    setInputCode(null);
    setInputCodeError("");
    window.setTimeout(() => document.getElementById("input-code-trigger")?.focus(), 0);
  }

  function importInputCode(code: string) {
    try {
      const restoredAnswers = decodeInputCode(code, defaultAnswers);
      setAnswers(restoredAnswers);
      setDurationScenario(
        Object.keys(restoredAnswers.userDurationOverrides).length
          ? "USER"
          : "TYPICAL",
      );
      setActiveStep(0);
      setIsDurationDialogOpen(false);
      setSelectedSummaryCategory(null);
      setSelectedId(null);
      closeInputCodeDialog();
      const restoredDurationCount = Object.keys(
        restoredAnswers.userDurationOverrides,
      ).length;
      setShareMessage(
        restoredDurationCount
          ? `입력값과 카드별 실무 예상기간 ${restoredDurationCount}건을 코드에서 복원했습니다.`
          : "입력값을 코드에서 복원했습니다.",
      );
      window.setTimeout(() => setShareMessage(""), 3000);
      return null;
    } catch (error) {
      if (error instanceof InputCodeError) return error.message;
      throw error;
    }
  }

  function resetDashboard() {
    setAnswers(defaultAnswers);
    setActiveStep(0);
    setActiveTab("SWIMLANE");
    setDurationScenario("TYPICAL");
    setIsDurationDialogOpen(false);
    setSelectedSummaryCategory(null);
    setSelectedId(null);
    setSearch("");
    setDomain("ALL");
    setShowExcluded(false);
    setRequiredOnly(false);
    setIncludeConditional(true);
    setIncludePractical(true);
    setInputCode(null);
    setInputCodeError("");
    setActiveWorkspaceTool(null);
    setDrawerReturnTool(null);
  }

  function closeStatusDialog() {
    const previous = selectedSummaryCategory;
    setSelectedSummaryCategory(null);
    window.setTimeout(() => {
      if (previous) document.getElementById(`summary-${previous}`)?.focus();
    }, 0);
  }

  function closeDurationDialog() {
    setIsDurationDialogOpen(false);
    window.setTimeout(() => {
      document.getElementById("duration-summary-trigger")?.focus();
    }, 0);
  }

  function closeWorkspaceTool() {
    const previous = activeWorkspaceTool;
    setActiveWorkspaceTool(null);
    window.setTimeout(() => {
      if (previous) document.getElementById(workspaceToolTriggerIds[previous])?.focus();
    }, 0);
  }

  function selectProcedureFromWorkspaceTool(procedureId: string) {
    setDrawerReturnTool(activeWorkspaceTool);
    setActiveWorkspaceTool(null);
    setSelectedId(procedureId);
  }

  function closeProcedureDrawer() {
    setSelectedId(null);
    if (drawerReturnTool) setActiveWorkspaceTool(drawerReturnTool);
    setDrawerReturnTool(null);
  }

  return (
    <main className="dashboard-page">
      <header className="topbar">
        <a className="brand" href="#main-dashboard" aria-label="지역투자 인허가 입력으로 이동">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span><h1>지역투자 인허가 로드맵</h1><small>비수도권 사업 검토</small></span>
        </a>
        <div className="topbar-meta">
          <span className="data-health"><i /> 법령 검토 기준 · {catalog.coverage.lastLegalReviewAt}</span>
          <button id="input-code-trigger" type="button" className="input-code-button" aria-label="입력 코드 저장·불러오기" aria-haspopup="dialog" aria-controls="input-code-dialog" aria-expanded={inputCode !== null} onClick={openInputCodeDialog}>저장·불러오기</button>
          <button type="button" className="share-button" onClick={copyShareLink}>공유 링크 복사</button>
        </div>
      </header>

      <aside className="ai-feedback-notice" role="note" aria-labelledby="ai-feedback-notice-title">
        <span className="ai-feedback-notice-mark" aria-hidden="true">AI</span>
        <div>
          <strong id="ai-feedback-notice-title">AI 활용 안내</strong>
          <p>AI를 활용한 인허가 로드맵 툴입니다. 오류 등 피드백 시 산업부 권준형 사무관(<a href="mailto:jnhnkn15@korea.kr" aria-label="권준형 사무관에게 이메일 보내기">jnhnkn15@korea.kr</a>)으로 연락 주세요.</p>
        </div>
      </aside>

      <div id="main-dashboard" className="dashboard-grid">
        <Wizard answers={answers} activeStep={activeStep} onStepChange={setActiveStep} onChange={changeAnswer} />
        <section className="workspace" aria-label="판정 결과">
          <div className="workspace-toolbar">
            <div className="workspace-title"><h2 id="dashboard-title">사업 검토 결과</h2><p>사업 조건에 맞는 절차, 적용 특례와 예상 일정을 확인합니다.</p></div>
            <div className="scenario-caption"><strong><LocalJurisdictionLinks answers={answers} /> · {answers.insideIndustrialComplex === null ? "입지 미확인" : answers.insideIndustrialComplex ? "산업단지" : "개별입지"}</strong><span>{answers.totalAreaM2 === null ? "면적 미확인" : `${answers.totalAreaM2.toLocaleString("ko-KR")}㎡`} · 검토 기준일 {answers.assessmentDate}</span><em>지역명은 전체 목록, 아래 지역기준 카드는 관련 조례 상세 원문으로 연결됩니다.</em></div>
            <div className="utility-actions">
              <PdfReportButton
                answers={answers}
                evaluation={evaluation}
                durationScenario={durationScenario}
                includeConditional={includeConditional}
                includePractical={includePractical}
              />
              <button type="button" onClick={resetDashboard}>초기화</button>
              <button type="button" onClick={() => window.print()}>화면 인쇄</button>
            </div>
          </div>
          <div className="summary-strip" aria-label="판정 요약">
            <div className="summary-card summary-schedule">
              <button
                id="duration-summary-trigger"
                type="button"
                className="duration-summary-trigger"
                aria-haspopup="dialog"
                aria-controls="total-duration-dialog"
                aria-expanded={isDurationDialogOpen}
                aria-label={`${durationHeading} ${durationSummary.value} 계산 경로 열기`}
                aria-describedby="duration-summary-description duration-summary-detail"
                onClick={() => setIsDurationDialogOpen(true)}
              >
                <span className="summary-card-copy">
                  <span className="duration-summary-title">
                    <b>{durationHeading}</b>
                    {durationSummary.isMinimumOnly ? <span className="duration-summary-badge">총 소요기간 아님</span> : null}
                  </span>
                  <small id="duration-summary-description">{durationSummary.description}</small>
                </span>
                <span className={`duration-summary-result${durationSummary.isMinimumOnly ? " is-minimum-only" : ""}`}>
                  <strong>{durationSummary.value}</strong>
                  <small id="duration-summary-detail">{durationSummary.detail}</small>
                </span>
                <span className="summary-card-link">계산 경로 보기 <span aria-hidden="true">→</span></span>
              </button>
              <div className="summary-scenario-row">
                <span>소요기간 기준</span>
                <div className="scenario-switch" aria-label="소요기간 기준">
                  {(["MIN", "TYPICAL", "USER"] as DurationScenario[]).map((scenario) => <button type="button" key={scenario} aria-pressed={durationScenario === scenario} className={durationScenario === scenario ? "is-selected" : ""} onClick={() => setDurationScenario(scenario)}>{scenario === "MIN" ? "최소기간" : scenario === "USER" ? `내 예상${userDurationOverrideCount ? ` ${userDurationOverrideCount}` : ""}` : "공식 기준"}</button>)}
                </div>
                {userDurationOverrideCount ? <button type="button" className="clear-user-durations" onClick={() => { changeAnswer("userDurationOverrides", {}); setDurationScenario("TYPICAL"); }}>예상값 전체 삭제</button> : null}
              </div>
            </div>
            {procedureCategoryOrder.map((category) => (
              <button
                id={`summary-${category}`}
                type="button"
                className={`summary-card summary-action summary-${summaryClass[category]}`}
                key={category}
                aria-haspopup="dialog"
                aria-controls="status-summary-dialog"
                aria-expanded={selectedSummaryCategory === category}
                aria-label={`${procedureCategorySummaries[category].label} ${decisionsByCategory[category].length}개 목록 열기`}
                aria-describedby={`summary-${category}-description`}
                onClick={() => setSelectedSummaryCategory(category)}
              >
                <span className="summary-card-heading">
                  <b>{procedureCategorySummaries[category].label}</b>
                  <span className="summary-count"><strong>{decisionsByCategory[category].length}</strong><small>개</small></span>
                </span>
                <small id={`summary-${category}-description`} className="summary-card-description">{procedureCategorySummaries[category].description}</small>
                <span className="summary-card-link">목록 보기 <span aria-hidden="true">→</span></span>
              </button>
            ))}
          </div>
          <SpecialLawSummary industryCategory={answers.industryCategory} evaluations={evaluation.specialLawEvaluations} />
          <ProjectInputSummary answers={answers} />
          <div className="decision-banner" role="note"><span className="decision-icon" aria-hidden="true">i</span><p><strong>화면의 결과는 사전 검토용입니다.</strong> 신청 전에는 필지·시설 규모·물질 수량과 최신 관할기준을 담당기관에 확인해야 합니다.</p></div>
          <OrdinanceDisclosure
            key={`${answers.province}:${answers.city}`}
            answers={answers}
          />

          <section className="practitioner-tools" aria-labelledby="practitioner-tools-title">
            <header>
              <span>PRACTITIONER TOOLS</span>
              <h3 id="practitioner-tools-title">기업 인허가 실무 도구</h3>
              <p>현재 프로젝트 결과와 별개로 전체 제도를 탐색하고, 근거 공백과 조건 차이를 비교합니다.</p>
            </header>
            <div className="practitioner-tool-actions">
              <button
                id={workspaceToolTriggerIds.REGISTRY}
                type="button"
                aria-haspopup="dialog"
                aria-controls="permit-registry-dialog"
                aria-expanded={activeWorkspaceTool === "REGISTRY"}
                onClick={() => setActiveWorkspaceTool("REGISTRY")}
              >
                <i aria-hidden="true">백</i>
                <span><strong>전체 인허가 백과</strong><small>{catalog.procedures.length}개 절차·법령·기관·서류 검색</small></span>
                <em aria-hidden="true">→</em>
              </button>
              <button
                id={workspaceToolTriggerIds.VERIFICATION}
                type="button"
                aria-haspopup="dialog"
                aria-controls="verification-ledger-dialog"
                aria-expanded={activeWorkspaceTool === "VERIFICATION"}
                onClick={() => setActiveWorkspaceTool("VERIFICATION")}
              >
                <i aria-hidden="true">검</i>
                <span><strong>근거 검증 대장</strong><small>적용·기관·기간·서류·관계·지역 확인</small></span>
                <em aria-hidden="true">→</em>
              </button>
              <button
                id={workspaceToolTriggerIds.COMPARE}
                type="button"
                aria-haspopup="dialog"
                aria-controls="scenario-compare-dialog"
                aria-expanded={activeWorkspaceTool === "COMPARE"}
                onClick={() => setActiveWorkspaceTool("COMPARE")}
              >
                <i aria-hidden="true">비</i>
                <span><strong>사업조건 비교</strong><small>현재 입력과 기준 사례 최대 3개 비교</small></span>
                <em aria-hidden="true">→</em>
              </button>
            </div>
          </section>

          <div className="tab-row">
            <nav className="dashboard-tabs" aria-label="결과 보기" role="tablist">
              {(Object.keys(tabLabels) as DashboardTab[]).map((tab) => <button id={`tab-${tab}`} aria-controls="dashboard-result-panel" key={tab} type="button" className={activeTab === tab ? "is-active" : ""} aria-selected={activeTab === tab} role="tab" onClick={() => setActiveTab(tab)}><DashboardTabIcon tab={tab} />{tabLabels[tab]}</button>)}
            </nav>
          </div>

          {activeTab === "SWIMLANE" || activeTab === "LIST" ? (
            <div className="filterbar">
              <label className="search-field"><span className="sr-only">절차 검색</span><i aria-hidden="true" /><input type="search" placeholder="절차·기관 검색" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
              <label><span className="sr-only">분야 필터</span><select value={domain} onChange={(event) => setDomain(event.target.value)}><option value="ALL">모든 분야</option>{domains.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="check-control"><input type="checkbox" checked={includeConditional} onChange={(event) => setIncludeConditional(event.target.checked)} /><span>추가 확인 절차 일정 포함</span></label>
              <label className="check-control"><input type="checkbox" checked={requiredOnly} onChange={(event) => setRequiredOnly(event.target.checked)} /><span>로드맵 포함만 보기</span></label>
              <label className="check-control"><input type="checkbox" checked={includePractical} onChange={(event) => setIncludePractical(event.target.checked)} /><span>실무 선행 포함</span></label>
              <label className="check-control"><input type="checkbox" checked={showExcluded} onChange={(event) => setShowExcluded(event.target.checked)} /><span>거칠 필요 없는 절차 표시</span></label>
            </div>
          ) : null}

          <div id="dashboard-result-panel" className="view-panel" role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
            {activeTab === "SWIMLANE" ? <Swimlane decisions={filteredDecisions} schedule={schedule} assessmentDate={answers.assessmentDate} selectedId={selectedId} userDurationOverrides={answers.userDurationOverrides} onSelect={setSelectedId} onUserDurationOverrideChange={changeUserDurationOverride} /> : null}
            {activeTab === "ACTION" ? <ActionPlanView decisions={evaluation.decisions} schedule={schedule} answers={answers} onSelect={setSelectedId} /> : null}
            {activeTab === "LIST" ? <ProcedureList decisions={filteredDecisions} schedule={schedule} onSelect={setSelectedId} /> : null}
            {activeTab === "SCHEDULE" ? <ScheduleView schedule={schedule} answers={answers} /> : null}
            {activeTab === "LEGAL" ? <LegalView decisions={evaluation.decisions.filter((decision) => procedureCategoryForDecision(decision) !== "NOT_REQUIRED" || decision.specialLawImpacts?.length)} onSelect={setSelectedId} /> : null}
            {activeTab === "GAPS" ? <GapsView decisions={evaluation.decisions} /> : null}
          </div>
        </section>
      </div>

      <footer className="dashboard-footer"><p>{catalog.coverage.disclaimer}</p><span>데이터 버전 {catalog.coverage.catalogVersion} · 출처 {catalog.coverage.sourceAttribution}</span></footer>
      {selectedSummaryCategory ? (
        <StatusSummaryDialog
          category={selectedSummaryCategory}
          decisions={decisionsByCategory[selectedSummaryCategory]}
          onClose={closeStatusDialog}
          onSelect={setSelectedId}
        />
      ) : null}
      {isDurationDialogOpen ? <TotalDurationDialog schedule={schedule} onClose={closeDurationDialog} /> : null}
      {inputCode !== null ? <InputCodeDialog initialCode={inputCode} initialError={inputCodeError} includedUserDurationCount={userDurationOverrideCount} onClose={closeInputCodeDialog} onImport={importInputCode} /> : null}
      {activeWorkspaceTool === "REGISTRY" ? (
        <WorkspaceToolDialog
          id="permit-registry-dialog"
          eyebrow="PERMIT REGISTRY"
          title="전체 인허가 백과"
          description="프로젝트 판정 여부와 관계없이 전체 인허가를 법령·기관·제출서류·결과물·기간 상태로 검색합니다. 항목을 열면 현재 사업조건에 대한 한 장 상세를 확인할 수 있습니다."
          onClose={closeWorkspaceTool}
        >
          <PermitRegistry
            assessmentDate={answers.assessmentDate}
            onSelectProcedure={selectProcedureFromWorkspaceTool}
          />
        </WorkspaceToolDialog>
      ) : null}
      {activeWorkspaceTool === "VERIFICATION" ? (
        <WorkspaceToolDialog
          id="verification-ledger-dialog"
          eyebrow="EVIDENCE LEDGER"
          title="인허가 근거 검증 대장"
          description="조문 존재 확인과 실제 적용 타당성을 구분하고, 기간·기관·제출서류·의제·지역기준 중 추가 확인이 필요한 항목을 숨기지 않습니다."
          onClose={closeWorkspaceTool}
        >
          <VerificationLedger
            assessmentDate={answers.assessmentDate}
            onSelectProcedure={selectProcedureFromWorkspaceTool}
          />
        </WorkspaceToolDialog>
      ) : null}
      {activeWorkspaceTool === "COMPARE" ? (
        <WorkspaceToolDialog
          id="scenario-compare-dialog"
          eyebrow="SCENARIO DIFF"
          title="사업조건 비교"
          description="현재 입력과 검토용 기준 사례를 나란히 놓고 필요·확인·제외 절차, 의제 효과와 공식기간 공백을 비교합니다."
          onClose={closeWorkspaceTool}
        >
          <ScenarioCompare
            answers={answers}
            includeConditional={includeConditional}
            includePractical={includePractical}
          />
        </WorkspaceToolDialog>
      ) : null}
      <ProcedureDrawer decision={selectedDecision} schedule={schedule} assessmentDate={answers.assessmentDate} onClose={closeProcedureDrawer} />
      {shareMessage ? <div className="toast" role="status">{shareMessage}</div> : null}
    </main>
  );
}
