import type {
  LegalCitation,
  LegalSource,
  ProcedureEdge,
} from "@/lib/domain/schemas";

function isSourceEffectiveOn(source: LegalSource, assessmentDate: string) {
  if (source.status !== "AUTHORITATIVE") return false;
  if (source.effectiveDate && source.effectiveDate > assessmentDate) return false;
  if (source.repealDate && source.repealDate <= assessmentDate) return false;
  return true;
}

export function verifiedSequenceCitationIds({
  citations,
  sources,
  assessmentDate,
}: {
  citations: LegalCitation[];
  sources: LegalSource[];
  assessmentDate: string;
}) {
  const effectiveSourceIds = new Set(
    sources
      .filter((source) => isSourceEffectiveOn(source, assessmentDate))
      .map((source) => source.id),
  );
  return new Set(
    citations
      .filter(
        (citation) =>
          citation.role === "SEQUENCE" &&
          effectiveSourceIds.has(citation.sourceId),
      )
      .map((citation) => citation.id),
  );
}

export function isVerifiedLegalSequence(
  edge: ProcedureEdge,
  sequenceCitationIds: ReadonlySet<string>,
) {
  return edge.strength === "LEGAL_HARD" && edge.citationIds.some(
    (citationId) => sequenceCitationIds.has(citationId),
  );
}
