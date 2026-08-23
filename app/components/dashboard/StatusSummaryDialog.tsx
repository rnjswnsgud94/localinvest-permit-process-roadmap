"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  inputLabel,
  procedureCategorySummaries,
  stageLabels,
  type ProcedureCategory,
} from "@/app/components/dashboard/constants";
import type { ProcedureDecision } from "@/lib/engine/rule-engine";

export function StatusSummaryDialog({
  category,
  decisions,
  onClose,
  onSelect,
}: {
  category: ProcedureCategory;
  decisions: ProcedureDecision[];
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [search, setSearch] = useState("");
  const summary = procedureCategorySummaries[category];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
    headingRef.current?.focus();
    return () => {
      if (typeof dialog.close === "function" && dialog.open) dialog.close();
    };
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return decisions;
    return decisions.filter((decision) =>
      `${decision.procedure.name} ${decision.procedure.receivingAuthority} ${decision.procedure.domain}`
        .toLowerCase()
        .includes(query),
    );
  }, [decisions, search]);

  const groups = Object.entries(stageLabels)
    .map(([stage, label]) => ({
      stage,
      label,
      items: filtered.filter((decision) => decision.procedure.stage === stage),
    }))
    .filter((group) => group.items.length);

  return (
    <dialog
      ref={dialogRef}
      id="status-summary-dialog"
      className="status-summary-dialog"
      aria-modal="true"
      aria-labelledby="status-dialog-title"
      aria-describedby="status-dialog-description"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="status-dialog-panel">
        <header>
          <div>
            <span>{summary.label}</span>
            <h2 id="status-dialog-title" ref={headingRef} tabIndex={-1}>
              {summary.label} {decisions.length}개
            </h2>
            <p id="status-dialog-description">{summary.description}</p>
          </div>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="목록 닫기">×</button>
        </header>
        <label className="status-dialog-search">
          <span className="sr-only">목록에서 절차 또는 기관 검색</span>
          <input
            type="search"
            placeholder="절차·기관 검색"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <p className="status-dialog-count" aria-live="polite">{filtered.length}개 표시</p>
        <div className="status-dialog-list">
          {groups.map((group) => (
            <section key={group.stage}>
              <h3>{group.label} <small>{group.items.length}</small></h3>
              <ul>
                {group.items.map((decision) => (
                  <li key={decision.procedure.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(decision.procedure.id);
                        onClose();
                      }}
                    >
                      <strong>{decision.procedure.name}</strong>
                      <span>{decision.procedure.domain} · {decision.procedure.receivingAuthority}</span>
                      <p>{decision.reason}</p>
                      {decision.missingInputs.length ? (
                        <small>추가 입력: {decision.missingInputs.map(inputLabel).join(", ")}</small>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {!groups.length ? <div className="empty-state">{search ? "검색 결과가 없습니다." : summary.empty}</div> : null}
        </div>
      </div>
    </dialog>
  );
}
