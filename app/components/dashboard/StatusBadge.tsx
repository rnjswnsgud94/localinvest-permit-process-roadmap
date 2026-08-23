import type { ApplicabilityStatus } from "@/lib/domain/schemas";
import {
  isInputMatchedRoadmapInclusion,
  statusLabels,
} from "@/app/components/dashboard/constants";

const statusSymbols: Record<ApplicabilityStatus, string> = {
  APPLIES: "✓",
  DOES_NOT_APPLY: "—",
  POSSIBLY_APPLIES: "△",
  NEEDS_MORE_INFO: "?",
};

export function StatusBadge({
  status,
  compact = false,
  isDeemed = false,
  provisionalEffect = null,
  missingInputs = [],
  conflictRuleIds = [],
}: {
  status: ApplicabilityStatus;
  compact?: boolean;
  isDeemed?: boolean;
  provisionalEffect?: "INCLUDE" | "EXCLUDE" | null;
  missingInputs?: readonly string[];
  conflictRuleIds?: readonly string[];
  needsLegalReview?: boolean;
}) {
  const inputMatchedInclusion = isInputMatchedRoadmapInclusion({
    status,
    provisionalEffect,
    missingInputs,
    conflictRuleIds,
    isDeemed,
  });
  const provisionalExclusion =
    status === "POSSIBLY_APPLIES" &&
    provisionalEffect === "EXCLUDE" &&
    missingInputs.length === 0 &&
    conflictRuleIds.length === 0;
  const label = isDeemed
    ? "상위 절차에서 의제 처리"
    : inputMatchedInclusion
      ? "로드맵 포함"
      : provisionalExclusion
        ? "잠정 제외 · 근거 확인"
        : statusLabels[status];
  const tone = isDeemed
    ? "deemed"
    : inputMatchedInclusion
      ? "roadmap_included"
      : provisionalExclusion
        ? "provisional_exclude"
        : status.toLowerCase();
  const symbol = isDeemed
    ? "✓"
    : inputMatchedInclusion
      ? "△"
      : provisionalExclusion
        ? "—"
        : statusSymbols[status];
  return (
    <span className={`status-badge status-${tone}`}>
      <span aria-hidden="true">{symbol}</span>
      {compact ? <span className="sr-only">{label}</span> : label}
    </span>
  );
}
