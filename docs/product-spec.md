# Product specification

## Problem

Factory investment teams currently assemble permit paths from statutes, civil-service pages, local rules and agency consultations. A single checklist hides jurisdiction, conditionality, deeming and parallel work, so teams can mistake a generic item for a legally required step or add all durations sequentially.

## Product outcome

Given explicit project facts and an assessment date, the dashboard returns:

- a four-state decision for every catalog procedure;
- an institution-by-stage swimlane with excluded procedures available on demand;
- a decision explanation, missing facts and direct official citations;
- separate minimum, base and maximum partial schedules;
- coverage, snapshot health, assumptions and unverified items.

The output is a review aid, not a filing, administrative disposition or legal opinion.

## Intended users

- central and local government investment-support officers;
- industrial-complex management agencies;
- factory investment, engineering, EHS and legal teams;
- advisers preparing permit roadmaps.

## Input flow

1. Project: investment type, assessment date, one of 16 supported provinces/metropolitan cities, city/county/district, industrial-complex status and industry family. A qualifying capital-region factory also receives a separate zone, statutory-exception and factory-construction-total review step.
2. Facility: land category, development/demolition/road/traffic facts, building action and existing/incremental/post-project factory-building area.
3. Environment and safety: assessment class, integrated-permit target, air/water facilities, chemicals, PSM, hazardous materials, high-pressure gas and fire-work facts.
4. Infrastructure: incremental power, water and wastewater demand plus energy-plan and groundwater facts.

Unknown facts remain unknown. “No” and “not applicable” are not substitutes for missing information.

## Output behavior

- `APPLIES`: a reviewed include/special-case rule matches.
- `DOES_NOT_APPLY`: no include rule matches or a higher-priority explicit exclusion wins.
- `POSSIBLY_APPLIES`: rules conflict, active rules are absent, or a matching procedure still requires legal review.
- `NEEDS_MORE_INFO`: a required fact is unknown and the truth value cannot be resolved.

Status is conveyed through label, symbol, border and pattern—not color alone. The UI supports search, required-only, conditional inclusion, practical dependencies, excluded procedures, lane collapse, scenario presets, URL sharing, reset and print.

## Success criteria

- identical input, date and catalog version produce identical output;
- 499/500/501㎡ boundaries and industrial-complex deeming are regression-tested;
- every confirmed threshold, institution and duration links to official evidence;
- unverified legal or duration claims are visibly downgraded;
- no cycles or missing references enter the procedure graph;
- desktop, mobile, keyboard and print states remain usable.

## Non-goals

The dashboard does not file applications, make final legal determinations, optimize staffing, infer a parcel's capital-region control zone from a city/county name, or automatically resolve every local ordinance, annual factory-total notice, parcel restriction and subordinate-table threshold. Expanded procedures remain decision-support candidates until the competent agency confirms the project-specific facts.
