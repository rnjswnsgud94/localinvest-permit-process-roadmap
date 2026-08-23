import type {
  ApplicabilityRule,
  ApplicabilityStatus,
  Condition,
  Procedure,
  ProjectInput,
  RuleTrace,
} from "@/lib/domain/schemas";
import type { SpecialLawImpact } from "@/lib/data/special-laws";

type TruthValue = "TRUE" | "FALSE" | "UNKNOWN";

type ConditionTrace = {
  truth: TruthValue;
  usedInputs: Record<string, unknown>;
  missingInputs: string[];
  passedConditions: string[];
  failedConditions: string[];
};

type FactResolution = {
  state: "KNOWN" | "UNKNOWN" | "NOT_APPLICABLE";
  value?: unknown;
};

export type ProcedureDecision = {
  procedure: Procedure;
  status: ApplicabilityStatus;
  reason: string;
  /** Legal-content maturity is disclosed separately from the deterministic applicability result. */
  needsLegalReview: boolean;
  legalReviewReasons: string[];
  missingInputs: string[];
  traces: RuleTrace[];
  matchedRuleIds: string[];
  conflictRuleIds: string[];
  /** Direction of the strongest matched rule; used to avoid scheduling a draft exclusion as work to perform. */
  provisionalEffect: "INCLUDE" | "EXCLUDE" | null;
  isDeemed: boolean;
  dataVersion: string;
  specialLawImpacts?: SpecialLawImpact[];
};

function stableUnique(values: string[]) {
  return [...new Set(values)].sort();
}

function resolveFact(input: ProjectInput, path: string): FactResolution {
  let cursor: unknown = input;
  for (const segment of path.split(".")) {
    if (!cursor || typeof cursor !== "object" || !(segment in cursor)) {
      return { state: "UNKNOWN" };
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }

  if (
    cursor &&
    typeof cursor === "object" &&
    "status" in cursor &&
    typeof (cursor as { status?: unknown }).status === "string"
  ) {
    const fact = cursor as { status: FactResolution["state"]; value?: unknown };
    if (fact.status === "KNOWN") return { state: "KNOWN", value: fact.value };
    if (fact.status === "NOT_APPLICABLE") return { state: "NOT_APPLICABLE" };
    return { state: "UNKNOWN" };
  }

  if (cursor === undefined) return { state: "UNKNOWN" };
  return { state: "KNOWN", value: cursor };
}

function leafResult(
  path: string,
  predicate: (value: unknown) => boolean,
  label: string,
  input: ProjectInput,
): ConditionTrace {
  const fact = resolveFact(input, path);
  const usedInputs = {
    [path]: fact.state === "KNOWN" ? fact.value : fact.state,
  };
  if (fact.state === "UNKNOWN") {
    return {
      truth: "UNKNOWN",
      usedInputs,
      missingInputs: [path],
      passedConditions: [],
      failedConditions: [],
    };
  }
  if (fact.state === "NOT_APPLICABLE") {
    return {
      truth: "FALSE",
      usedInputs,
      missingInputs: [],
      passedConditions: [],
      failedConditions: [`${label} — 해당 없음`],
    };
  }
  const passed = predicate(fact.value);
  return {
    truth: passed ? "TRUE" : "FALSE",
    usedInputs,
    missingInputs: [],
    passedConditions: passed ? [label] : [],
    failedConditions: passed ? [] : [label],
  };
}

function mergeTraces(traces: ConditionTrace[]): Omit<ConditionTrace, "truth"> {
  return {
    usedInputs: Object.assign({}, ...traces.map((trace) => trace.usedInputs)),
    missingInputs: stableUnique(traces.flatMap((trace) => trace.missingInputs)),
    passedConditions: traces.flatMap((trace) => trace.passedConditions),
    failedConditions: traces.flatMap((trace) => trace.failedConditions),
  };
}

export function evaluateCondition(
  condition: Condition,
  input: ProjectInput,
): ConditionTrace {
  if ("all" in condition) {
    const children = condition.all.map((child) => evaluateCondition(child, input));
    const truth: TruthValue = children.some((child) => child.truth === "FALSE")
      ? "FALSE"
      : children.some((child) => child.truth === "UNKNOWN")
        ? "UNKNOWN"
        : "TRUE";
    return { truth, ...mergeTraces(children) };
  }
  if ("any" in condition) {
    const children = condition.any.map((child) => evaluateCondition(child, input));
    const truth: TruthValue = children.some((child) => child.truth === "TRUE")
      ? "TRUE"
      : children.some((child) => child.truth === "UNKNOWN")
        ? "UNKNOWN"
        : "FALSE";
    return { truth, ...mergeTraces(children) };
  }
  if ("not" in condition) {
    const child = evaluateCondition(condition.not, input);
    return {
      ...child,
      truth:
        child.truth === "UNKNOWN"
          ? "UNKNOWN"
          : child.truth === "TRUE"
            ? "FALSE"
            : "TRUE",
      passedConditions: child.failedConditions,
      failedConditions: child.passedConditions,
    };
  }
  if ("eq" in condition) {
    const { path, value } = condition.eq;
    return leafResult(path, (actual) => actual === value, `${path} = ${String(value)}`, input);
  }
  if ("in" in condition) {
    const { path, values } = condition.in;
    return leafResult(
      path,
      (actual) => values.some((value) => value === actual),
      `${path} ∈ [${values.map(String).join(", ")}]`,
      input,
    );
  }
  if ("intersects" in condition) {
    const { path, values } = condition.intersects;
    return leafResult(
      path,
      (actual) =>
        Array.isArray(actual) && actual.some((value) => values.includes(value as never)),
      `${path}가 지정 집합과 교차`,
      input,
    );
  }
  if ("gt" in condition) {
    const { path, value } = condition.gt;
    return leafResult(path, (actual) => typeof actual === "number" && actual > value, `${path} > ${value}`, input);
  }
  if ("gte" in condition) {
    const { path, value } = condition.gte;
    return leafResult(path, (actual) => typeof actual === "number" && actual >= value, `${path} ≥ ${value}`, input);
  }
  if ("lt" in condition) {
    const { path, value } = condition.lt;
    return leafResult(path, (actual) => typeof actual === "number" && actual < value, `${path} < ${value}`, input);
  }
  if ("lte" in condition) {
    const { path, value } = condition.lte;
    return leafResult(path, (actual) => typeof actual === "number" && actual <= value, `${path} ≤ ${value}`, input);
  }
  if ("between" in condition) {
    const { path, min, max } = condition.between;
    return leafResult(
      path,
      (actual) => typeof actual === "number" && actual >= min && actual <= max,
      `${min} ≤ ${path} ≤ ${max}`,
      input,
    );
  }
  const { path } = condition.exists;
  return leafResult(path, (actual) => actual !== undefined && actual !== null, `${path} 값 존재`, input);
}

function isRuleActive(
  rule: ApplicabilityRule,
  input: ProjectInput,
  ignoreIndustryScope = false,
) {
  if (rule.status === "RETIRED") return false;
  if (input.assessmentDate < rule.effectiveFrom) return false;
  if (rule.effectiveTo && input.assessmentDate > rule.effectiveTo) return false;
  if (!ignoreIndustryScope && rule.industryScope?.length) {
    const industry = resolveFact(input, "industry.category");
    if (
      industry.state === "NOT_APPLICABLE" ||
      (industry.state === "KNOWN" &&
        !rule.industryScope.includes(String(industry.value)))
    ) {
      return false;
    }
  }
  if (rule.jurisdiction.nationwide) return true;

  const province = resolveFact(input, "location.province");
  const city = resolveFact(input, "location.city");
  const complexId = resolveFact(input, "industrialComplex.identifier");
  return (
    (province.state === "KNOWN" &&
      rule.jurisdiction.provinces.includes(String(province.value))) ||
    (city.state === "KNOWN" && rule.jurisdiction.cities.includes(String(city.value))) ||
    (complexId.state === "KNOWN" &&
      rule.jurisdiction.industrialComplexIds.includes(String(complexId.value)))
  );
}

function traceRule(rule: ApplicabilityRule, input: ProjectInput): RuleTrace {
  const trace = evaluateCondition(rule.condition, input);
  const missingInputs = stableUnique([
    ...trace.missingInputs,
    ...rule.requiredInputs.filter(
      (path) => resolveFact(input, path).state === "UNKNOWN",
    ),
  ]);
  const missingFactsAreNonMatch =
    missingInputs.length > 0 && rule.missingPolicy === "NON_MATCH";
  const status: ApplicabilityStatus =
    missingFactsAreNonMatch
      ? "DOES_NOT_APPLY"
      : trace.truth === "TRUE"
      ? missingInputs.length
        ? "NEEDS_MORE_INFO"
        : "APPLIES"
      : trace.truth === "FALSE"
        ? "DOES_NOT_APPLY"
        : "NEEDS_MORE_INFO";
  return {
    ruleId: rule.id,
    ruleVersion: rule.version,
    procedureId: rule.procedureId,
    status,
    usedInputs: trace.usedInputs,
    missingInputs: missingFactsAreNonMatch ? [] : missingInputs,
    passedConditions: trace.passedConditions,
    failedConditions: trace.failedConditions,
    citationIds: rule.citationIds,
    explanation: rule.explanationTemplate,
    conflictWith: [],
  };
}

function getLegalReviewDisclosure(
  procedure: Procedure,
  rules: ApplicabilityRule[],
) {
  const draftRuleIds = stableUnique(
    rules
      .filter((rule) => rule.status === "DRAFT")
      .map((rule) => rule.id),
  );
  const legalReviewReasons: string[] = [];

  if (draftRuleIds.length) {
    legalReviewReasons.push(
      `판정규칙 법률 검토 필요: ${draftRuleIds.join(", ")}`,
    );
  }
  if (procedure.verificationStatus === "AI_ASSISTED_DRAFT") {
    legalReviewReasons.push(
      "절차 설명·제출자료·관할 정보가 AI 보조 초안 상태입니다.",
    );
  }
  if (procedure.verificationStatus === "TODO_LEGAL_REVIEW") {
    legalReviewReasons.push(
      "절차 설명·제출자료·관할 정보의 법률 검토가 필요합니다.",
    );
  }

  return {
    needsLegalReview: legalReviewReasons.length > 0,
    legalReviewReasons,
  };
}

export function resolveProcedure(
  procedure: Procedure,
  rules: ApplicabilityRule[],
  input: ProjectInput,
  dataVersion: string,
): ProcedureDecision {
  const procedureRules = rules.filter(
    (rule) =>
      rule.procedureId === procedure.id && rule.status !== "RETIRED",
  );
  const activeBeforeIndustryScope = rules
    .filter(
      (rule) =>
        rule.procedureId === procedure.id &&
        isRuleActive(rule, input, true),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  const industry = resolveFact(input, "industry.category");
  const outsideExclusiveIndustryScope =
    industry.state === "KNOWN" &&
    procedureRules.length > 0 &&
    procedureRules.every((rule) => rule.industryScope?.length) &&
    procedureRules.every(
      (rule) =>
        !rule.industryScope?.includes(String(industry.value)),
    );

  if (outsideExclusiveIndustryScope) {
    const traces = activeBeforeIndustryScope.map((rule) => traceRule(rule, input));
    const disclosure = getLegalReviewDisclosure(
      procedure,
      activeBeforeIndustryScope,
    );
    return {
      procedure,
      status: disclosure.needsLegalReview
        ? "POSSIBLY_APPLIES"
        : "DOES_NOT_APPLY",
      reason: disclosure.needsLegalReview
        ? `현재 업종(${String(industry.value)})은 이 업종 전용 절차의 적용범위 밖이지만 범위 규칙의 세부 법률검토 상태는 상세에서 확인해야 합니다.`
        : `현재 업종(${String(industry.value)})은 이 업종 전용 절차의 적용범위에 포함되지 않습니다.`,
      ...disclosure,
      missingInputs: [],
      traces,
      matchedRuleIds: [],
      conflictRuleIds: [],
      provisionalEffect: "EXCLUDE",
      isDeemed: false,
      dataVersion,
    };
  }

  const activeRules = rules
    .filter((rule) => rule.procedureId === procedure.id && isRuleActive(rule, input))
    .sort((a, b) => a.id.localeCompare(b.id));

  if (!activeRules.length) {
    return {
      procedure,
      status: "POSSIBLY_APPLIES",
      reason: "평가일과 관할범위에 유효한 판정규칙이 없어 전문검토가 필요합니다.",
      ...getLegalReviewDisclosure(procedure, []),
      missingInputs: [],
      traces: [],
      matchedRuleIds: [],
      conflictRuleIds: [],
      provisionalEffect: null,
      isDeemed: false,
      dataVersion,
    };
  }

  const traces = activeRules.map((rule) => traceRule(rule, input));
  const trueRules = activeRules.filter(
    (rule) => traces.find((trace) => trace.ruleId === rule.id)?.status === "APPLIES",
  );
  const unknownTraces = traces.filter((trace) => trace.status === "NEEDS_MORE_INFO");
  const includeRules = trueRules.filter((rule) =>
    ["INCLUDE", "SPECIAL_CASE", "REPLACE"].includes(rule.effect),
  );
  const excludeRules = trueRules.filter((rule) => rule.effect === "EXCLUDE");

  const highestInclude = Math.max(-Infinity, ...includeRules.map((rule) => rule.priority));
  const highestExclude = Math.max(-Infinity, ...excludeRules.map((rule) => rule.priority));

  if (includeRules.length && excludeRules.length && highestInclude === highestExclude) {
    const conflicts = stableUnique(trueRules.map((rule) => rule.id));
    return {
      procedure,
      status: "POSSIBLY_APPLIES",
      reason: "포함·제외 규칙의 근거가 충돌하여 양쪽 근거를 함께 검토해야 합니다.",
      ...getLegalReviewDisclosure(procedure, trueRules),
      missingInputs: stableUnique(unknownTraces.flatMap((trace) => trace.missingInputs)),
      traces: traces.map((trace) => ({ ...trace, conflictWith: conflicts.filter((id) => id !== trace.ruleId) })),
      matchedRuleIds: conflicts,
      conflictRuleIds: conflicts,
      provisionalEffect: null,
      isDeemed: false,
      dataVersion,
    };
  }

  if (excludeRules.length && highestExclude > highestInclude) {
    const winner = excludeRules.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))[0];
    const disclosure = getLegalReviewDisclosure(procedure, [winner]);
    const exclusionRuleIsReviewed =
      winner.status === "INTERNAL_REVIEWED" || winner.status === "EXPERT_REVIEWED";
    return {
      procedure,
      status: exclusionRuleIsReviewed ? "DOES_NOT_APPLY" : "POSSIBLY_APPLIES",
      reason: exclusionRuleIsReviewed
        ? disclosure.needsLegalReview
          ? `${winner.explanationTemplate} 제외 판정근거는 검토됐으며, 절차 설명·제출자료의 검토상태는 상세에서 별도로 확인해야 합니다.`
          : winner.explanationTemplate
        : `${winner.explanationTemplate} 제외 근거의 세부 법률검토 상태는 상세에서 확인해야 합니다.`,
      ...disclosure,
      missingInputs: stableUnique(unknownTraces.flatMap((trace) => trace.missingInputs)),
      traces,
      matchedRuleIds: [winner.id],
      conflictRuleIds: [],
      provisionalEffect: "EXCLUDE",
      isDeemed: false,
      dataVersion,
    };
  }

  if (includeRules.length) {
    const winner = includeRules.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))[0];
    const disclosure = getLegalReviewDisclosure(procedure, [winner]);
    return {
      procedure,
      status: disclosure.needsLegalReview ? "POSSIBLY_APPLIES" : "APPLIES",
      reason: disclosure.needsLegalReview
        ? `${winner.explanationTemplate} 계획경로에는 포함하되 근거의 세부 법률검토 상태는 상세에서 확인해야 합니다.`
        : winner.explanationTemplate,
      ...disclosure,
      missingInputs: stableUnique(unknownTraces.flatMap((trace) => trace.missingInputs)),
      traces,
      matchedRuleIds: includeRules.map((rule) => rule.id).sort(),
      conflictRuleIds: [],
      provisionalEffect: "INCLUDE",
      isDeemed: false,
      dataVersion,
    };
  }

  if (unknownTraces.length) {
    return {
      procedure,
      status: "NEEDS_MORE_INFO",
      reason: `판정에 필요한 입력이 부족합니다: ${stableUnique(unknownTraces.flatMap((trace) => trace.missingInputs)).join(", ")}`,
      ...getLegalReviewDisclosure(procedure, activeRules),
      missingInputs: stableUnique(unknownTraces.flatMap((trace) => trace.missingInputs)),
      traces,
      matchedRuleIds: [],
      conflictRuleIds: [],
      provisionalEffect: null,
      isDeemed: false,
      dataVersion,
    };
  }

  if (activeRules.every((rule) => rule.effect === "EXCLUDE")) {
    return {
      procedure,
      status: "POSSIBLY_APPLIES",
      reason: "현재 제외규칙에는 해당하지 않지만, 평가일에 유효한 포함기준이 없어 적용 여부를 별도로 확인해야 합니다.",
      ...getLegalReviewDisclosure(procedure, activeRules),
      missingInputs: [],
      traces,
      matchedRuleIds: [],
      conflictRuleIds: [],
      provisionalEffect: null,
      isDeemed: false,
      dataVersion,
    };
  }

  return {
    procedure,
    status: "DOES_NOT_APPLY",
    reason: "현재 입력값이 이 절차의 적용조건을 충족하지 않습니다.",
    ...getLegalReviewDisclosure(procedure, activeRules),
    missingInputs: [],
    traces,
    matchedRuleIds: [],
    conflictRuleIds: [],
    provisionalEffect: "EXCLUDE",
    isDeemed: false,
    dataVersion,
  };
}

export function resolveAllProcedures(
  procedures: Procedure[],
  rules: ApplicabilityRule[],
  input: ProjectInput,
  dataVersion: string,
) {
  const decisions = procedures.map((procedure) =>
    resolveProcedure(procedure, rules, input, dataVersion),
  );
  const decisionsByProcedureId = new Map(
    decisions.map((decision) => [decision.procedure.id, decision]),
  );
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));

  const matchedExplicitExclusions = (decision: ProcedureDecision) =>
    decision.matchedRuleIds
      .map((ruleId) => rulesById.get(ruleId))
      .filter(
        (rule): rule is ApplicabilityRule => rule?.effect === "EXCLUDE",
      );

  const isConfirmedDeemingParent = (decision: ProcedureDecision) =>
    decision.status === "APPLIES" &&
    decision.provisionalEffect === "INCLUDE" &&
    !decision.needsLegalReview &&
    decision.missingInputs.length === 0 &&
    decision.conflictRuleIds.length === 0;

  return decisions
    .map((decision) => {
      const deemedByProcedureIds = stableUnique([
        ...decision.procedure.deemedByProcedureIds,
        ...decisions
          .filter((candidate) =>
            candidate.procedure.deemedProcedureIds.includes(
              decision.procedure.id,
            ),
          )
          .map((candidate) => candidate.procedure.id),
      ]);
      const isDeemed =
        decision.status === "DOES_NOT_APPLY" &&
        deemedByProcedureIds.some((procedureId) => {
          const deemedByDecision = decisionsByProcedureId.get(procedureId);
          if (!deemedByDecision || !isConfirmedDeemingParent(deemedByDecision)) {
            return false;
          }

          const parentCitationIds = new Set(
            deemedByDecision.procedure.citationIds,
          );
          return matchedExplicitExclusions(decision).some((rule) =>
            rule.citationIds.some((citationId) =>
              parentCitationIds.has(citationId),
            ),
          );
        });
      return isDeemed === decision.isDeemed
        ? decision
        : { ...decision, isDeemed };
    })
    .sort((a, b) => a.procedure.id.localeCompare(b.procedure.id));
}
