import type { ReactNode } from "react";

export function Dialog({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <div className="modal-backdrop">
      <section
        className="form-modal station-form-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button
          type="button"
          className="modal-close"
          aria-label="Close"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}
