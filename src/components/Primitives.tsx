import React from "react";

export function Bar({ value, color }: { value: number | null; color: string }) {
  return (
    <div className="bar-track">
      {value !== null && <div className="bar-fill" style={{ width: `${Math.round(value * 100)}%`, background: color }} />}
    </div>
  );
}

export function Pct({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className="text-textDim">—</span>;
  }
  return <span>{Math.round(value * 100)}%</span>;
}

export function pctColor(v: number | null | undefined): string {
  if (v === null || v === undefined) return "var(--text-dim, #5C6C77)";
  if (v >= 0.85) return "#4FB07C";
  if (v >= 0.65) return "#E0A63E";
  return "#E2685A";
}

export function StatBlock({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: string }) {
  return (
    <div className="card p-3.5 px-4">
      <div className="label">{label}</div>
      <div className="font-mono text-[26px] font-semibold mt-1.5" style={{ color: accent || "var(--text, #E7EDF1)" }}>
        {value}
      </div>
      {sub && <div className="text-xs text-textMuted mt-1">{sub}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="card fade-in p-10 px-6 text-center">
      <div className="text-[15px] font-semibold mb-1.5">{title}</div>
      <div className="text-[13px] text-textMuted mb-4">{body}</div>
      {action}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  width,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="card fade-in p-5 overflow-auto"
        style={{ width: width || 480, maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3.5">
          <div className="text-[15px] font-bold">{title}</div>
          <button className="btn btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
