import type {
  DurationEstimate,
} from "@/lib/domain/schemas";
import type {
  PlanningDuration,
  ProjectTimelineNode,
  ScheduleCompletedCheckpoint,
} from "@/lib/engine/schedule";

const DAY_MS = 86_400_000;

function parse(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

/** 시작일과 완료일을 모두 포함한 실제 달력 기간을 년·개월·일로 표시합니다. */
export function formatCalendarPeriod(startDate: string, completionDate: string) {
  const start = parse(startDate);
  const endExclusive = new Date(parse(completionDate).getTime() + DAY_MS);
  let months =
    (endExclusive.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    endExclusive.getUTCMonth() -
    start.getUTCMonth();
  let anchor = new Date(Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth() + months,
    start.getUTCDate(),
  ));
  if (anchor > endExclusive) {
    months -= 1;
    anchor = new Date(Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth() + months,
      start.getUTCDate(),
    ));
  }
  const days = Math.max(0, Math.round((endExclusive.getTime() - anchor.getTime()) / DAY_MS));
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const parts = [
    years ? `${years}년` : "",
    remainingMonths ? `${remainingMonths}개월` : "",
    days ? `${days}일` : "",
  ].filter(Boolean);
  return parts.join(" ") || "0일";
}

export function formatProcessingDuration(
  value: number | null,
  unit: "BUSINESS_DAY" | "CALENDAR_DAY" | "MONTH" | null,
) {
  if (value === null || unit === null) return "처리기간 확인 필요";
  if (value === 0) return "즉시";
  if (unit === "BUSINESS_DAY") return `${value}업무일`;
  if (unit === "CALENDAR_DAY") return `${value}일`;
  return `${value}개월`;
}

const quantifiedOfficialReferenceKinds = new Set([
  "NATIONWIDE_STATUTORY",
  "NATIONWIDE_OFFICIAL_STANDARD",
  "OFFICIAL_OPERATION_CAP",
  "LEGAL_DEADLINE",
  "PROCESS_MILESTONE",
]);

function quantifiedOfficialReferences(
  periods: DurationEstimate["referencePeriods"] | undefined,
) {
  return (periods ?? []).filter(
    (period) =>
      quantifiedOfficialReferenceKinds.has(period.kind) &&
      period.range !== null &&
      [period.range.min, period.range.base, period.range.max].some(
        (value) => value !== null,
      ),
  );
}

function compactDurationValues(
  periods: NonNullable<DurationEstimate["referencePeriods"]>,
) {
  const groups = new Map<NonNullable<DurationEstimate["elapsed"]>["unit"], Set<number>>();
  for (const period of periods) {
    if (!period.range) continue;
    const values = groups.get(period.range.unit) ?? new Set<number>();
    for (const value of [period.range.min, period.range.base, period.range.max]) {
      if (value !== null) values.add(value);
    }
    groups.set(period.range.unit, values);
  }
  return [...groups.entries()].map(([unit, values]) => {
    const ordered = [...values].sort((left, right) => left - right);
    const suffix = unit === "BUSINESS_DAY" ? "업무일" : unit === "CALENDAR_DAY" ? "일" : "개월";
    return `${ordered.join("·")}${suffix}`;
  }).join(" / ");
}

function compactRange(range: NonNullable<DurationEstimate["elapsed"]>) {
  const values = [range.min, range.base, range.max]
    .filter((value): value is number => value !== null);
  const unique = [...new Set(values)].sort((left, right) => left - right);
  const suffix = range.unit === "BUSINESS_DAY" ? "업무일" : range.unit === "CALENDAR_DAY" ? "일" : "개월";
  if (!unique.length) return "";
  if (unique.length === 1) return `${unique[0]}${suffix}`;
  return `${unique.join("·")}${suffix}`;
}

function rangeIsRepresentedByReferences(
  range: NonNullable<DurationEstimate["elapsed"]>,
  periods: NonNullable<DurationEstimate["referencePeriods"]>,
) {
  const primaryValues = new Set(
    [range.min, range.base, range.max].filter(
      (value): value is number => value !== null,
    ),
  );
  if (!primaryValues.size) return true;

  const referenceValues = new Set(
    periods
      .filter((period) => period.range?.unit === range.unit)
      .flatMap((period) => period.range
        ? [period.range.min, period.range.base, period.range.max]
        : [])
      .filter((value): value is number => value !== null),
  );
  return [...primaryValues].every((value) => referenceValues.has(value));
}

function formatPrimaryOfficialRange(
  duration: Pick<DurationEstimate, "authorityProcessing" | "elapsed" | "planningBasis">,
  range: NonNullable<DurationEstimate["elapsed"]>,
) {
  const compact = compactRange(range);
  if (duration.planningBasis === "OFFICIAL_CAP_ONLY") {
    return `법정·공식 상한 ${compact} · 실제 평균 아님`;
  }
  if (duration.elapsed === null) {
    return `기관 공식 처리 ${compact} · 전체 경과는 별도`;
  }
  const hasSeveralBranches = new Set(
    [range.min, range.base, range.max].filter(
      (value): value is number => value !== null,
    ),
  ).size > 1;
  return hasSeveralBranches
    ? `공식 처리분기 ${compact} · 세부요건별 선택`
    : `법정·공식 처리 ${compact}`;
}

function detailedReferenceRange(
  range: NonNullable<NonNullable<DurationEstimate["referencePeriods"]>[number]["range"]>,
) {
  const suffix = range.unit === "BUSINESS_DAY" ? "업무일" : range.unit === "CALENDAR_DAY" ? "일" : "개월";
  if (range.min !== null && range.base === null && range.max === null) {
    return `최소 ${range.min}${suffix}`;
  }
  if (range.min === null && range.base === null && range.max !== null) {
    return `${range.max}${suffix}`;
  }
  return compactRange(range);
}

function hasImmediateOfficialStandard(
  duration: Pick<DurationEstimate, "referencePeriods" | "statutoryPeriod">,
) {
  return /3근무시간 이내/.test(duration.statutoryPeriod ?? "") ||
    (duration.referencePeriods ?? []).some((period) =>
      /3근무시간 이내/.test(`${period.label} ${period.note}`),
    );
}

function hasNoNationalTotalWording(value: string) {
  return /없음|두지 않|미규정|규정되지 않|정하지 않|정해져 있지 않|정해지지 않|희망일/.test(value);
}

function compactInlineTimeValues(value: string) {
  const matches = value.matchAll(/\d+(?:\.\d+)?\s*(?:근무시간|시간|업무일|일|개월|년)/g);
  return [...new Set([...matches].map((match) => match[0].replace(/\s+/g, "")))];
}

function compactQualitativeReferenceMilestones(
  periods: DurationEstimate["referencePeriods"] | undefined,
) {
  return [...new Set((periods ?? [])
    .filter((period) => period.range === null)
    .flatMap((period) => {
      if (/불합격.*당일/.test(period.label)) return ["불합격 당일"];
      return period.label.includes("당일") ? ["당일"] : [];
    }))];
}

export function hasQuantifiedOfficialPeriod(
  duration: Pick<
    DurationEstimate,
    "authorityProcessing" | "elapsed" | "referencePeriods" | "statutoryPeriod"
  > | null | undefined,
) {
  if (!duration) return false;
  if (hasImmediateOfficialStandard(duration)) return true;
  return [duration.elapsed, duration.authorityProcessing].some(
    (range) => range && [range.min, range.base, range.max].some((value) => value !== null),
  ) || quantifiedOfficialReferences(duration.referencePeriods).length > 0;
}

/**
 * 일정 계산 가능 여부와 무관하게 카드에서 먼저 보여 줄 법정·공식 기간 요약입니다.
 * 상한·단계기한은 실제 총 소요기간으로 오인되지 않도록 명시적으로 구분합니다.
 */
export function formatOfficialDurationSummary(
  duration: Pick<
    DurationEstimate,
    | "authorityProcessing"
    | "elapsed"
    | "planningBasis"
    | "referencePeriods"
    | "statutoryPeriod"
  > | null | undefined,
) {
  if (!duration) return "수록된 법정·공식 기간 없음";

  const statutoryPeriod = duration.statutoryPeriod ?? "";
  const isImmediate = hasImmediateOfficialStandard(duration);
  const primaryRange = duration.elapsed ?? duration.authorityProcessing;

  const references = quantifiedOfficialReferences(duration.referencePeriods);
  if (references.length) {
    const values = compactDurationValues(references);
    const onlyMilestones = references.every(
      (period) => period.kind === "LEGAL_DEADLINE" || period.kind === "PROCESS_MILESTONE",
    );
    const hasTotalCap = references.some(
      (period) =>
        period.kind === "NATIONWIDE_STATUTORY" ||
        period.kind === "NATIONWIDE_OFFICIAL_STANDARD" ||
        period.kind === "OFFICIAL_OPERATION_CAP",
    );
    const parts = isImmediate ? ["즉시(3근무시간 이내)"] : [];
    if (primaryRange && !rangeIsRepresentedByReferences(primaryRange, references)) {
      parts.push(formatPrimaryOfficialRange(duration, primaryRange));
    }
    const qualitativeMilestones = compactQualitativeReferenceMilestones(
      duration.referencePeriods,
    );
    if (qualitativeMilestones.length) {
      parts.push(`별도 법정 이정표 ${qualitativeMilestones.join("·")}`);
    }
    const noNationalTotalSuffix = !primaryRange && hasNoNationalTotalWording(statutoryPeriod)
      ? " · 전국 공통 법정 총기간 미규정"
      : "";
    if (duration.planningBasis === "OFFICIAL_CAP_ONLY" || hasTotalCap) {
      parts.push(`법정·공식 상한·분기 ${values} · 실제 총 경과는 별도`);
      return `${parts.join(" · ")}${noNationalTotalSuffix}`;
    }
    if (onlyMilestones) {
      parts.push(`법정 단계기한 ${values} · 단계별 기산점 적용`);
      return `${parts.join(" · ")}${noNationalTotalSuffix}`;
    }
    parts.push(`법정·공식 기간 ${values}`);
    return `${parts.join(" · ")}${noNationalTotalSuffix}`;
  }

  if (isImmediate) {
    return "즉시 · 3근무시간 이내";
  }

  if (primaryRange) {
    return formatPrimaryOfficialRange(duration, primaryRange);
  }

  if (hasNoNationalTotalWording(statutoryPeriod)) {
    const inlineValues = compactInlineTimeValues(statutoryPeriod);
    if (inlineValues.length) {
      return `법정 단계기한 ${inlineValues.join("·")} · 단계별 기산점 적용 · 전국 공통 법정 총기간 미규정`;
    }
    return "전국 공통 법정 총기간 미규정";
  }
  return statutoryPeriod ? "법정 기간은 상세 기준 참조" : "법정·공식 기간 확인 필요";
}

/** 입력 조건이나 선택 관할로 하나의 공식 분기가 확정된 경우 그 값을 우선 표시합니다. */
export function formatResolvedOfficialDurationSummary(
  duration: Parameters<typeof formatOfficialDurationSummary>[0],
  planning: Pick<
    PlanningDuration,
    | "minimum"
    | "typical"
    | "upperBound"
    | "unit"
    | "planningBasis"
    | "completedCheckpoint"
  > | null | undefined,
) {
  if (
    !planning ||
    planning.completedCheckpoint ||
    !planning.unit ||
    !["INPUT_RESOLVED_OFFICIAL", "LOCAL_OFFICIAL_REFERENCE"].includes(
      planning.planningBasis ?? "",
    )
  ) {
    return formatOfficialDurationSummary(duration);
  }
  const range = {
    min: planning.minimum,
    base: planning.typical,
    max: planning.upperBound ?? null,
    unit: planning.unit,
  };
  if (![range.min, range.base, range.max].some((value) => value !== null)) {
    return formatOfficialDurationSummary(duration);
  }
  const label = planning.planningBasis === "LOCAL_OFFICIAL_REFERENCE"
    ? "선택 관할 공식 처리"
    : "입력조건 공식 처리";
  return `${label} ${compactRange(range)}`;
}

export function formatTimelineProcessingDuration(
  node: Pick<
    ProjectTimelineNode,
    "processingDuration" | "processingUnit" | "completedCheckpoint"
  > & Partial<Pick<
    ProjectTimelineNode,
    "processingUpperBound" | "durationReferencePeriods" | "durationSourceLabel" |
    "durationSource" | "durationPlanningBasis" | "officialProcessingDuration" |
    "officialProcessingUnit"
  >>,
) {
  const checkpoint = node.completedCheckpoint;
  if (!checkpoint) {
    if (node.durationSource === "USER_EXPECTED" && node.processingDuration !== null) {
      const expected = `사용자 예상 ${formatProcessingDuration(node.processingDuration, node.processingUnit)}`;
      return node.officialProcessingDuration !== null && node.officialProcessingDuration !== undefined
        ? `${expected} · 공식 기준 ${formatProcessingDuration(node.officialProcessingDuration, node.officialProcessingUnit ?? null)}`
        : `${expected} · 공식 총기간 미확인`;
    }
    if (node.processingDuration === null) {
      const sourceLabel = node.durationSourceLabel ?? "";
      const references = quantifiedOfficialReferences(
        node.durationReferencePeriods ?? [],
      );
      const immediate = /3근무시간 이내/.test(sourceLabel) ||
        (node.durationReferencePeriods ?? []).some((period) =>
          /3근무시간 이내/.test(`${period.label} ${period.note}`),
        );
      const referenceDetails = references.map((period) =>
        `${period.label} ${detailedReferenceRange(period.range!)}`,
      );
      if (immediate && !referenceDetails.length) {
        return "법정·공식 즉시 · 3근무시간 이내 (0일 아님)";
      }
      if (referenceDetails.length) {
        return [
          immediate ? "법정·공식 즉시 · 3근무시간 이내 (0일 아님)" : "법정·공식 총기간 미확인",
          ...referenceDetails,
        ].join(" · ");
      }
      if (sourceLabel) {
        const noNationalTotal = hasNoNationalTotalWording(sourceLabel);
        return `법정·공식 총기간 ${noNationalTotal ? "미규정" : "미확인"} · ${sourceLabel}`;
      }
      return "법정·공식 기간 확인 필요";
    }
    return `법정·공식 ${formatProcessingDuration(
      node.processingDuration,
      node.processingUnit,
    )}`;
  }
  return formatCompletedCheckpoint(checkpoint);
}

export function formatCompletedCheckpoint(
  checkpoint: Pick<
    ScheduleCompletedCheckpoint,
    "label" | "completedDate" | "confirmedAsOfDate"
  >,
) {
  return checkpoint.completedDate
    ? `${checkpoint.label} · ${checkpoint.completedDate} 완료 · 잔여 처리기간 0일`
    : `${checkpoint.label} · ${checkpoint.confirmedAsOfDate} 기준일 현재 완료 · 잔여 처리기간 0일`;
}
