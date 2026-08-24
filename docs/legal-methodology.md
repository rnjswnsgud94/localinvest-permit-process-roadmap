# Legal research and review methodology

## Source hierarchy

1. Current statute, enforcement decree and enforcement rule from the National Law Information Center.
2. Official administrative rule, notice and local ordinance.
3. Official industrial-complex management/development plan and delegated-authority material.
4. Official civil-service processing guide such as Government24.
5. Official agency operating material.
6. Observed cases or expert estimates, clearly labeled and never substituted for law.

Search-engine summaries, blogs and generative text are not legal evidence.

## Temporal method

The assessment date selects rules whose `effectiveFrom <= date <= effectiveTo`. Current and scheduled versions are not combined. A scheduled amendment expected before a project milestone is a separate warning until the planned start/completion date model is complete.

## Jurisdiction method

Nationwide rules are evaluated first for the 16 supported provinces and metropolitan cities, including Seoul, Incheon and Gyeonggi. Province, city and industrial-complex rules require an exact named source. A selectable region means the nationwide common layer can be evaluated there; it does not claim local-ordinance completeness. For capital-region factories, the exact statutory zone, permitted exceptions and current factory-construction allocation remain unresolved until the parcel, business facts and latest official notices are checked; the model never treats capital-region location alone as an automatic rejection.

## Thresholds and facts

- The factory-establishment 500㎡ boundary uses post-project factory-building area in the current catalog scope.
- Existing, increment and total area remain separate facts.
- Environmental, chemical and safety procedures require facility, material, quantity and location facts or a user/professional coverage determination; industry name alone is insufficient.
- Unknown facts create `NEEDS_MORE_INFO`, not a false negative.

Integrated environmental permitting suppresses overlapping individual air, water and noise procedures only when the user has confirmed the integrated-permit target fact. Chemical procedures preserve the accident-plan → facility-inspection → business-permit sequence while leaving substance and quantity thresholds for final competent-agency review.

## Deeming

A deemed permit relation is recorded in both directions and linked to a citation. The dashboard says “의제 가능/의제됨” only in the context of the matched route. Application forms, required attachments and consultation with the competent agency remain prerequisites. Deeming is not automatic approval and does not remove substantive standards.

## Duration method

Official service standards and statutory periods are kept separate from observed or expert estimates. Business days, calendar days and months are never automatically converted. Stop-clock events and document supplements remain caveats. The schedule engine reports only the covered administrative path.

## Review states

- `AI_ASSISTED_DRAFT`: official material was cross-checked but a qualified reviewer has not approved the structured interpretation.
- `INTERNAL_REVIEWED`: reviewed under the owning organization’s process.
- `EXPERT_REVIEWED`: reviewed by a qualified legal/technical expert.
- `TODO_LEGAL_REVIEW`: source/version/jurisdiction remains incomplete; a matching route is downgraded to possible.

Change detection creates a checklist and impacted IDs. Only a human review may edit citations/rules, add tests and promote status.
