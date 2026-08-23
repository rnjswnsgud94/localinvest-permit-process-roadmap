"use client";

import { useId, useMemo, useState } from "react";

import {
  isInputMatchedRoadmapInclusion,
  procedureCategoryForDecision,
  statusLabels,
  type ProcedureCategory,
} from "@/app/components/dashboard/constants";
import { catalog, type ScenarioAnswers } from "@/lib/data/catalog";
import {
  evaluateProject,
  type EvaluationOptions,
} from "@/lib/engine/pipeline";
import type { ProcedureDecision } from "@/lib/engine/rule-engine";
import { hasQuantifiedOfficialPeriod } from "@/lib/format-duration";

const MAX_REFERENCE_SCENARIOS = 2;

const durationById = new Map(
  catalog.durations.map((duration) => [duration.id, duration]),
);

type ProjectEvaluation = ReturnType<typeof evaluateProject>;

type ScenarioMetrics = {
  required: number;
  confirm: number;
  excluded: number;
  deemed: number;
  officialDurationUnknown: number;
  permitLead: string;
};

type ProcedureChange = {
  id: string;
  name: string;
  from: ProcedureCategory;
  to: ProcedureCategory;
  fromLabel: string;
  toLabel: string;
};

type ScenarioDiff = {
  added: ProcedureChange[];
  removed: ProcedureChange[];
  changed: ProcedureChange[];
};

function categorizedCount(
  decisions: ProcedureDecision[],
  category: ProcedureCategory,
) {
  return decisions.filter(
    (decision) => procedureCategoryForDecision(decision) === category,
  ).length;
}

function hasOfficialPeriod(decision: ProcedureDecision) {
  const duration = decision.procedure.durationId
    ? durationById.get(decision.procedure.durationId)
    : null;
  return hasQuantifiedOfficialPeriod(duration);
}

function comparisonStatusLabel(decision: ProcedureDecision) {
  if (decision.isDeemed) return "의제 처리";
  if (decision.status === "APPLIES") return "확정 필수 절차";
  if (isInputMatchedRoadmapInclusion(decision)) {
    return "로드맵 포함";
  }
  return statusLabels[decision.status];
}

function scenarioMetrics(evaluation: ProjectEvaluation): ScenarioMetrics {
  const timeline = evaluation.schedules.TYPICAL.projectTimeline;
  const officialDurationUnknown = evaluation.decisions.filter((decision) => {
    const category = procedureCategoryForDecision(decision);
    // An individually deemed procedure does not run its own processing clock.
    return category !== "NOT_REQUIRED" && !decision.isDeemed && !hasOfficialPeriod(decision);
  }).length;

  return {
    required: categorizedCount(evaluation.decisions, "REQUIRED"),
    confirm: categorizedCount(evaluation.decisions, "CONFIRM"),
    excluded: categorizedCount(evaluation.decisions, "NOT_REQUIRED"),
    deemed: evaluation.decisions.filter((decision) => decision.isDeemed).length,
    officialDurationUnknown,
    permitLead: !timeline
      ? "공사일정 미입력"
      : timeline.permitLeadCalendarDays === null
        ? "산정 불가"
        : `${timeline.permitLeadCalendarDays.toLocaleString("ko-KR")}일`,
  };
}

function compareProcedures(
  current: ProjectEvaluation,
  reference: ProjectEvaluation,
): ScenarioDiff {
  const currentById = new Map(
    current.decisions.map((decision) => [decision.procedure.id, decision]),
  );
  const changes: ScenarioDiff = { added: [], removed: [], changed: [] };

  for (const referenceDecision of reference.decisions) {
    const currentDecision = currentById.get(referenceDecision.procedure.id);
    if (!currentDecision) continue;
    const from = procedureCategoryForDecision(currentDecision);
    const to = procedureCategoryForDecision(referenceDecision);
    const fromLabel = comparisonStatusLabel(currentDecision);
    const toLabel = comparisonStatusLabel(referenceDecision);
    if (from === to && fromLabel === toLabel) continue;

    const change = {
      id: referenceDecision.procedure.id,
      name: referenceDecision.procedure.name,
      from,
      to,
      fromLabel,
      toLabel,
    };
    if (from !== "REQUIRED" && to === "REQUIRED") {
      changes.added.push(change);
    } else if (from === "REQUIRED" && to !== "REQUIRED") {
      changes.removed.push(change);
    } else {
      changes.changed.push(change);
    }
  }

  for (const values of Object.values(changes)) {
    values.sort(
      (left, right) =>
        left.name.localeCompare(right.name, "ko-KR") ||
        left.id.localeCompare(right.id),
    );
  }
  return changes;
}

function ChangeList({
  label,
  emptyLabel,
  changes,
}: {
  label: string;
  emptyLabel: string;
  changes: ProcedureChange[];
}) {
  return (
    <details className="scenario-diff-group">
      <summary>
        {label} <strong>{changes.length}</strong>
      </summary>
      {changes.length ? (
        <ul>
          {changes.map((change) => (
            <li key={change.id}>
              <strong>{change.name}</strong>
              <span>
                {change.fromLabel} → {change.toLabel}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>{emptyLabel}</p>
      )}
    </details>
  );
}

export function ScenarioCompare({
  answers,
  includeConditional = true,
  includePractical = true,
}: {
  answers: ScenarioAnswers;
  includeConditional?: EvaluationOptions["includeConditional"];
  includePractical?: EvaluationOptions["includePractical"];
}) {
  const descriptionId = useId();
  const selectionStatusId = useId();
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([]);
  const evaluationOptions = useMemo(
    () => ({ includeConditional, includePractical }),
    [includeConditional, includePractical],
  );
  const currentEvaluation = useMemo(
    () => evaluateProject(answers, evaluationOptions),
    [answers, evaluationOptions],
  );
  const selectedScenarios = useMemo(
    () =>
      selectedScenarioIds.flatMap((scenarioId) => {
        const scenario = catalog.scenarios.find((item) => item.id === scenarioId);
        return scenario ? [scenario] : [];
      }),
    [selectedScenarioIds],
  );
  const comparisons = useMemo(
    () =>
      selectedScenarios.map((scenario) => {
        const evaluation = evaluateProject(scenario.answers, evaluationOptions);
        return {
          scenario,
          evaluation,
          metrics: scenarioMetrics(evaluation),
          diff: compareProcedures(currentEvaluation, evaluation),
        };
      }),
    [currentEvaluation, evaluationOptions, selectedScenarios],
  );
  const columns = [
    {
      id: "current-input",
      name: "현재 입력",
      description: "현재 화면에 입력한 사업조건",
      metrics: scenarioMetrics(currentEvaluation),
    },
    ...comparisons.map(({ scenario, metrics }) => ({
      id: scenario.id,
      name: scenario.name,
      description: scenario.description,
      metrics,
    })),
  ];
  const maximumSelected = selectedScenarioIds.length >= MAX_REFERENCE_SCENARIOS;

  const toggleScenario = (scenarioId: string, checked: boolean) => {
    setSelectedScenarioIds((current) => {
      if (!checked) return current.filter((id) => id !== scenarioId);
      if (current.includes(scenarioId) || current.length >= MAX_REFERENCE_SCENARIOS) {
        return current;
      }
      return [...current, scenarioId];
    });
  };

  const metricRows: Array<{
    label: string;
    value: (metrics: ScenarioMetrics) => string;
  }> = [
    { label: "로드맵 포함", value: (metrics) => `${metrics.required}개` },
    { label: "확인 필요", value: (metrics) => `${metrics.confirm}개` },
    { label: "확인된 제외", value: (metrics) => `${metrics.excluded}개` },
    { label: "의제 처리", value: (metrics) => `${metrics.deemed}개` },
    {
      label: "공식기간 미확인",
      value: (metrics) => `${metrics.officialDurationUnknown}개`,
    },
    { label: "착공 전 인허가 리드", value: (metrics) => metrics.permitLead },
  ];

  return (
    <section className="scenario-compare" aria-labelledby="scenario-compare-title">
      <header className="scenario-compare-heading">
        <div>
          <span>사업조건 비교</span>
          <h2 id="scenario-compare-title">현재 입력과 기준 시나리오 비교</h2>
          <p id={descriptionId}>
            카탈로그의 검토용 기준 사례를 최대 2개 골라 적용판정과 공식 일정의 차이를 확인합니다.
            비교값은 현재 판정 엔진을 그대로 사용하며, 기간 근거가 없으면 산정하지 않습니다.
          </p>
        </div>
        {selectedScenarioIds.length ? (
          <button
            type="button"
            className="text-button"
            onClick={() => setSelectedScenarioIds([])}
          >
            비교 선택 해제
          </button>
        ) : null}
      </header>

      <fieldset
        className="scenario-compare-picker"
        aria-describedby={`${descriptionId} ${selectionStatusId}`}
      >
        <legend>비교할 기준 시나리오 선택</legend>
        <div>
          {catalog.scenarios.map((scenario) => {
            const checked = selectedScenarioIds.includes(scenario.id);
            return (
              <label key={scenario.id}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!checked && maximumSelected}
                  onChange={(event) =>
                    toggleScenario(scenario.id, event.currentTarget.checked)
                  }
                />
                <span>
                  <strong>{scenario.name}</strong>
                  <small>{scenario.description}</small>
                </span>
              </label>
            );
          })}
        </div>
        <p id={selectionStatusId} role="status" aria-live="polite">
          {selectedScenarioIds.length}개 선택됨 · 최대 {MAX_REFERENCE_SCENARIOS}개
          {maximumSelected ? " · 다른 시나리오를 선택하려면 하나를 해제하세요." : ""}
        </p>
      </fieldset>

      <div className="table-shell scenario-compare-table-shell">
        <table className="procedure-table scenario-compare-table">
          <caption>현재 입력과 선택한 기준 시나리오의 판정·공식 일정 비교</caption>
          <thead>
            <tr>
              <th scope="col">비교 항목</th>
              {columns.map((column) => (
                <th scope="col" key={column.id}>
                  <strong>{column.name}</strong>
                  <small>{column.description}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metricRows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {columns.map((column) => (
                  <td key={column.id}>{row.value(column.metrics)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="panel-footnote">
        공식기간 미확인은 로드맵 포함·확인 필요 절차 가운데 의제 처리 절차를 제외하고,
        정량화된 법정·공식 기간이 없는 건입니다. 착공 전 리드가 산정 불가로 표시되면
        미확인 기간이 남아 있다는 뜻이며 임의값으로 보충하지 않습니다.
      </p>

      {comparisons.length ? (
        <section className="scenario-diff-list" aria-label="선택 시나리오별 절차 변화">
          {comparisons.map(({ scenario, diff }) => (
            <article key={scenario.id} aria-label={`${scenario.name} 절차 변화`}>
              <header>
                <span>현재 입력 대비</span>
                <h3>{scenario.name}</h3>
              </header>
              <div className="scenario-diff-grid">
                <ChangeList
                  label="추가되는 절차"
                  emptyLabel="추가되는 절차가 없습니다."
                  changes={diff.added}
                />
                <ChangeList
                  label="로드맵 포함에서 빠지는 절차"
                  emptyLabel="로드맵 포함에서 빠지는 절차가 없습니다."
                  changes={diff.removed}
                />
                <ChangeList
                  label="상태가 바뀌는 절차"
                  emptyLabel="그 밖의 상태 변경이 없습니다."
                  changes={diff.changed}
                />
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className="empty-state scenario-compare-empty">
          기준 시나리오를 선택하면 현재 입력 대비 추가·삭제·상태변경 절차가 표시됩니다.
        </div>
      )}
    </section>
  );
}
