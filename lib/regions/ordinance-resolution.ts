import type { NormalizedLawDocument } from "@/lib/law-api/types";
import {
  isOrdinanceReviewTitleCandidate,
  localOrdinanceReviewCategories,
  type OrdinanceGovernmentLevel,
} from "@/lib/regions/local-ordinances";

export interface OfficialOrdinanceRecord {
  name: string;
  level: OrdinanceGovernmentLevel;
  jurisdictionName: string;
  amendmentDate: string | null;
  url: string;
  transitionNotice?: string;
  transitionBasisUrl?: string;
}

export interface LocalOrdinanceCategoryLookup {
  categoryId: string;
  ordinances: OfficialOrdinanceRecord[];
}

export interface OrdinanceJurisdictionContext {
  name: string;
  provinceName: string;
  level: OrdinanceGovernmentLevel;
}

const duplicatedMunicipalityNames = new Set([
  "중구",
  "서구",
  "동구",
  "남구",
  "북구",
  "강서구",
  "고성군",
]);

function normalized(value: string): string {
  return value.replace(/[\s·ㆍ.,()「」『』-]/g, "").toLowerCase();
}

function displayDate(value: string | null): string | null {
  if (!value) return null;
  const compact = value.replaceAll("-", "");
  if (!/^\d{8}$/.test(compact)) return value;
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

function belongsToJurisdiction(
  document: NormalizedLawDocument,
  context: OrdinanceJurisdictionContext,
): boolean {
  const agency = normalized(document.jurisdictionName ?? "");
  const name = normalized(context.name);
  const provinceName = normalized(context.provinceName);
  if (agency) {
    if (context.level === "PROVINCE") {
      // A province-name search can also return municipalities whose agency
      // contains the province name. Only the province itself is a province law.
      return agency === provinceName || agency === `${provinceName}본청`;
    }
    return (
      agency.includes(name) &&
      agency.includes(provinceName)
    );
  }

  const title = normalized(document.title);
  if (!title.includes(name)) return false;
  if (
    context.level === "MUNICIPALITY" &&
    duplicatedMunicipalityNames.has(context.name)
  ) {
    // A bare `중구` or `고성군` title cannot be assigned safely without an
    // agency field or a province-qualified title.
    return title.includes(provinceName);
  }
  return true;
}

/**
 * Convert only jurisdiction-confirmed `target=ordin` search results into
 * public, credential-free National Law Information Center links.
 */
export function resolveOfficialOrdinanceRecords(
  documents: readonly NormalizedLawDocument[],
  context: OrdinanceJurisdictionContext,
): OfficialOrdinanceRecord[] {
  return documents
    .filter(
      (document) =>
        document.target === "ordin" && belongsToJurisdiction(document, context),
    )
    .map((document) => ({
      name: document.title,
      level: context.level,
      jurisdictionName: context.name,
      amendmentDate: displayDate(
        document.promulgationDate ?? document.effectiveDate,
      ),
      url: document.publicUrl,
    }))
    .filter(
      (record, index, list) =>
        list.findIndex((candidate) => candidate.name === record.name) === index,
    );
}

export function matchOrdinancesToCategories(
  records: readonly OfficialOrdinanceRecord[],
): LocalOrdinanceCategoryLookup[] {
  return localOrdinanceReviewCategories.map((category) => {
    const allowedLevels =
      category.scope === "PROVINCE"
        ? new Set<OrdinanceGovernmentLevel>(["PROVINCE"])
        : category.scope === "MUNICIPALITY"
          ? new Set<OrdinanceGovernmentLevel>(["MUNICIPALITY"])
          : new Set<OrdinanceGovernmentLevel>([
              "PROVINCE",
              "MUNICIPALITY",
            ]);
    const patterns = category.ordinanceNamePatterns.map(normalized);
    const ordinances = records
      .filter(
        (record) =>
          allowedLevels.has(record.level) &&
          isOrdinanceReviewTitleCandidate(record.name),
      )
      .map((record) => {
        const title = normalized(record.name);
        return {
          record,
          patternRank: patterns.findIndex((pattern) => title.includes(pattern)),
        };
      })
      .filter((item) => item.patternRank >= 0)
      .sort(
        (left, right) =>
          left.patternRank - right.patternRank ||
          (left.record.level === "MUNICIPALITY" ? -1 : 1) -
            (right.record.level === "MUNICIPALITY" ? -1 : 1) ||
          left.record.name.length - right.record.name.length ||
          left.record.name.localeCompare(right.record.name, "ko"),
      )
      .map((item) => item.record)
      .filter(
        (record, index, list) =>
          list.findIndex(
            (candidate) =>
              candidate.name === record.name &&
            candidate.level === record.level,
          ) === index,
      );
    return { categoryId: category.id, ordinances };
  });
}
