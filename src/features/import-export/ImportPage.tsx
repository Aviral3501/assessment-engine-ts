import { useRef, useState } from "react";
import { analyzeImportFile, type ImportAnalysis } from "@/services/validation";
import { Store, type DuplicateStrategy, type ImportResult } from "@/services/store";
import { db } from "@/db/db";
import { StatBlock } from "@/components/Primitives";

interface Preview extends ImportAnalysis {
  parseError?: string;
  existingIds: string[];
  cats: Record<string, number>;
  raw: unknown[];
}

function downloadJSON(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportPage({ onImported }: { onImported: () => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [importing, setImporting] = useState(false);
  const [strategy, setStrategy] = useState<DuplicateStrategy>("skip");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [restoreMsg, setRestoreMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      setPreview({ parseError: String((err as Error).message || err), valid: [], invalid: [], dupInFile: [], existingIds: [], cats: {}, raw: [] });
      return;
    }
    if (!Array.isArray(parsed)) {
      setPreview({
        parseError: "Top-level JSON must be an array of question objects.",
        valid: [],
        invalid: [],
        dupInFile: [],
        existingIds: [],
        cats: {},
        raw: [],
      });
      return;
    }
    const { valid, invalid, dupInFile } = analyzeImportFile(parsed);
    const existing = await db.questions
      .where("id")
      .anyOf(valid.map((q) => q.id).concat(dupInFile.map((d) => d.id)))
      .toArray();
    const existingIds = new Set(existing.map((q) => q.id));
    const cats: Record<string, number> = {};
    valid.forEach((q) => {
      cats[q.category] = (cats[q.category] || 0) + 1;
    });
    setPreview({ valid, invalid, dupInFile, existingIds: [...existingIds], cats, raw: parsed });
  }

  async function commitImport() {
    if (!preview || !preview.valid.length) return;
    setImporting(true);
    const existingIds = new Set(preview.existingIds);
    const res = await Store.importQuestions(preview.valid, strategy, existingIds);
    setResult(res);
    setImporting(false);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
    onImported();
  }

  async function exportQuestions() {
    const qs = await Store.allQuestions();
    downloadJSON(qs, "question-bank-export.json");
  }
  async function exportProgress() {
    const backup = await Store.fullBackup();
    const { questions: _questions, ...rest } = backup;
    downloadJSON(rest, "progress-export.json");
  }
  async function exportFullBackup() {
    const backup = await Store.fullBackup();
    downloadJSON(backup, `full-backup-${new Date().toISOString().slice(0, 10)}.json`);
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      await Store.restoreBackup(backup);
      setRestoreMsg("Backup restored successfully.");
      onImported();
    } catch (err) {
      setRestoreMsg("Restore failed: " + ((err as Error).message || err));
    }
    if (restoreRef.current) restoreRef.current.value = "";
  }

  return (
    <div className="fade-in flex flex-col gap-6 max-w-3xl">
      <div>
        <div className="text-lg font-bold">Import Questions</div>
        <div className="text-[13px] text-textMuted mt-0.5">Upload a JSON array conforming to the Question Generation Standard.</div>
      </div>

      {!preview && (
        <div className="card p-6 text-center" style={{ border: "1px dashed #29333B" }}>
          <input ref={fileRef} type="file" accept=".json" onChange={handleFile} className="hidden" id="file-input" />
          <div className="text-[13px] text-textMuted mb-3">Select a .json question bank file</div>
          <label htmlFor="file-input" className="btn btn-primary">
            Choose File
          </label>
        </div>
      )}

      {result && (
        <div className="card p-4" style={{ borderColor: "#4FB07C" }}>
          <div className="text-[13px] font-bold" style={{ color: "#4FB07C" }}>
            Import complete
          </div>
          <div className="text-[12.5px] mt-1.5 text-textMuted">
            {result.inserted} new · {result.replaced} replaced · {result.skipped} skipped
          </div>
        </div>
      )}

      {preview?.parseError && (
        <div className="card p-4" style={{ borderColor: "#E2685A" }}>
          <div className="text-[13px] font-bold" style={{ color: "#E2685A" }}>
            Could not import file
          </div>
          <div className="text-[12.5px] mt-1.5">{preview.parseError}</div>
        </div>
      )}

      {preview && !preview.parseError && (
        <div className="card p-4">
          <div className="text-[14px] font-bold mb-3">Import Preview</div>
          <div className="grid grid-cols-4 gap-2.5 mb-3.5">
            <StatBlock label="Found" value={preview.raw.length} />
            <StatBlock label="New" value={preview.valid.filter((q) => !preview.existingIds.includes(q.id)).length} accent="#4FB07C" />
            <StatBlock
              label="Duplicates"
              value={preview.valid.filter((q) => preview.existingIds.includes(q.id)).length + preview.dupInFile.length}
              accent="#E0A63E"
            />
            <StatBlock label="Invalid" value={preview.invalid.length} accent={preview.invalid.length ? "#E2685A" : undefined} />
          </div>

          <div className="text-[12.5px] mb-3">
            <div className="label mb-1.5">Categories</div>
            {Object.entries(preview.cats).map(([c, n]) => (
              <div key={c} className="flex justify-between py-0.5">
                <span>{c}</span>
                <span className="mono">{n}</span>
              </div>
            ))}
          </div>

          {preview.existingIds.length > 0 && (
            <div className="mb-3.5">
              <div className="label mb-1.5">Duplicate handling</div>
              <div className="flex gap-2">
                {(["skip", "replace", "keep"] as DuplicateStrategy[]).map((s) => (
                  <button
                    key={s}
                    className="btn btn-sm"
                    onClick={() => setStrategy(s)}
                    style={{
                      background: strategy === s ? "#4FA3E3" : "#1C242B",
                      color: strategy === s ? "#08141C" : "#E7EDF1",
                      borderColor: strategy === s ? "#4FA3E3" : "#29333B",
                    }}
                  >
                    {s[0].toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {preview.invalid.length > 0 && (
            <div className="mb-3.5 max-h-56 overflow-auto">
              <div className="label mb-1.5" style={{ color: "#E2685A" }}>
                {preview.invalid.length} question(s) failed validation
              </div>
              <table>
                <thead>
                  <tr>
                    {["Question ID", "Field", "Reason"].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.invalid.flatMap((item, i) =>
                    item.errors.map((err, j) => (
                      <tr key={`${i}-${j}`}>
                        <td className="mono">{err.id}</td>
                        <td>{err.field}</td>
                        <td className="text-textMuted">{err.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-2">
            <button
              className="btn"
              onClick={() => {
                setPreview(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              Cancel
            </button>
            <button className="btn btn-primary" disabled={importing || !preview.valid.length} onClick={commitImport}>
              {importing ? "Importing…" : `Import ${preview.valid.length} Questions`}
            </button>
          </div>
        </div>
      )}

      <div className="card p-4">
        <div className="text-[14px] font-bold mb-1">Export</div>
        <div className="text-[12.5px] text-textMuted mb-3">Browser storage can be cleared unexpectedly — export regularly.</div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn" onClick={exportQuestions}>
            Export Question Bank
          </button>
          <button className="btn" onClick={exportProgress}>
            Export Progress
          </button>
          <button className="btn btn-primary" onClick={exportFullBackup}>
            Full Backup
          </button>
        </div>
      </div>

      <div className="card p-4">
        <div className="text-[14px] font-bold mb-1">Restore</div>
        <div className="text-[12.5px] text-textMuted mb-3">Restore a full backup exported from this application.</div>
        <input ref={restoreRef} type="file" accept=".json" onChange={handleRestore} className="hidden" id="restore-input" />
        <label htmlFor="restore-input" className="btn">
          Choose Backup File
        </label>
        {restoreMsg && (
          <div className="text-[12.5px] mt-2.5" style={{ color: "#4FB07C" }}>
            {restoreMsg}
          </div>
        )}
      </div>
    </div>
  );
}
