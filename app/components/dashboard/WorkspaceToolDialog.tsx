"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function WorkspaceToolDialog({
  id,
  eyebrow,
  title,
  description,
  onClose,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
    headingRef.current?.focus();
    return () => {
      if (typeof dialog.close === "function" && dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      id={id}
      className="workspace-tool-dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="workspace-tool-panel">
        <header>
          <div>
            <span>{eyebrow}</span>
            <h2 id={`${id}-title`} ref={headingRef} tabIndex={-1}>{title}</h2>
            <p id={`${id}-description`}>{description}</p>
          </div>
          <button type="button" className="dialog-close" onClick={onClose} aria-label={`${title} 닫기`}>×</button>
        </header>
        <div className="workspace-tool-body">{children}</div>
      </div>
    </dialog>
  );
}
