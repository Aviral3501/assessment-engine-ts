import { useState } from "react";
import { Store } from "@/services/store";
import { Modal } from "@/components/Primitives";

type ResetKey = "attempts" | "spaced" | "topics" | "bookmarks" | "all";

interface ResetDef {
  key: ResetKey;
  label: string;
  desc: string;
}

const RESETS: ResetDef[] = [
  { key: "attempts", label: "Reset attempt history", desc: "Deletes all recorded quiz attempts. Questions and topics are kept." },
  { key: "spaced", label: "Reset spaced repetition", desc: "Clears review scheduling and mastery scores back to new." },
  { key: "topics", label: "Reset topic progress", desc: "Sets every topic back to Not Started." },
  { key: "bookmarks", label: "Reset bookmarks & flags", desc: "Clears all bookmarks and flagged questions." },
  { key: "all", label: "Reset all application data", desc: "Deletes everything — questions, attempts, learning history. This cannot be undone." },
];

export function SettingsPage({ onDataChanged }: { onDataChanged: () => void }) {
  const [confirmAction, setConfirmAction] = useState<ResetDef | null>(null);
  const [msg, setMsg] = useState("");

  async function runReset(action: ResetKey) {
    if (action === "attempts") await Store.resetAttempts();
    if (action === "spaced") await Store.resetSpacedRepetition();
    if (action === "topics") await Store.resetTopicProgress();
    if (action === "bookmarks") await Store.resetBookmarks();
    if (action === "all") await Store.resetAll();
    setConfirmAction(null);
    setMsg("Done.");
    onDataChanged();
  }

  return (
    <div className="fade-in max-w-xl flex flex-col gap-4.5">
      <div className="text-lg font-bold">Settings</div>

      <div className="card p-4">
        <div className="text-[13px] font-bold mb-1">About</div>
        <div className="text-[12.5px] text-textMuted">Assessment Engine v1.0 — local-first, browser-only. No data leaves this device.</div>
      </div>

      <div className="card p-4">
        <div className="text-[13px] font-bold mb-2.5" style={{ color: "#E2685A" }}>
          Reset Controls
        </div>
        {RESETS.map((r) => (
          <div key={r.key} className="flex justify-between items-center py-2.5 border-b border-borderSoft last:border-b-0">
            <div>
              <div className="text-[13px] font-semibold">{r.label}</div>
              <div className="text-[11.5px] text-textDim">{r.desc}</div>
            </div>
            <button className="btn btn-sm btn-danger" onClick={() => setConfirmAction(r)}>
              Reset
            </button>
          </div>
        ))}
        {msg && (
          <div className="text-xs mt-2.5" style={{ color: "#4FB07C" }}>
            {msg}
          </div>
        )}
      </div>

      {confirmAction && (
        <Modal title={`Confirm: ${confirmAction.label}`} onClose={() => setConfirmAction(null)}>
          <div className="text-[13px] mb-4">{confirmAction.desc} This action requires confirmation and cannot be undone.</div>
          <div className="flex gap-2">
            <button className="btn" onClick={() => setConfirmAction(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={() => runReset(confirmAction.key)}>
              Confirm Reset
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
