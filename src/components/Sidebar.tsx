import type { PageKey } from "@/App";

const NAV: { key: PageKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "quiz-setup", label: "Quiz" },
  { key: "bank", label: "Question Bank" },
  { key: "topics", label: "Topics" },
  { key: "analytics", label: "Analytics" },
  { key: "report", label: "Final Report" },
  { key: "import", label: "Import / Export" },
  { key: "settings", label: "Settings" },
];

export function Sidebar({
  page,
  setPage,
  counts,
}: {
  page: PageKey;
  setPage: (p: PageKey) => void;
  counts: { questionCount: number; due: number };
}) {
  return (
    <div className="w-[210px] border-r border-borderSoft py-4.5 px-3 flex flex-col gap-0.5 shrink-0">
      <div className="px-2.5 pb-4.5 text-sm font-bold tracking-tight">
        <div>Assessment</div>
        <div className="text-accent">Engine</div>
      </div>
      {NAV.map((item) => (
        <button
          key={item.key}
          onClick={() => setPage(item.key)}
          className="text-left px-2.5 py-2 rounded-md text-[13px] font-medium border-none cursor-pointer flex justify-between items-center"
          style={{ background: page === item.key ? "#1C242B" : "transparent", color: page === item.key ? "#E7EDF1" : "#8FA0AB" }}
        >
          {item.label}
          {item.key === "dashboard" && counts.due > 0 && (
            <span className="pill" style={{ background: "#C97FE0", color: "#1B0E22", fontSize: 10 }}>
              {counts.due}
            </span>
          )}
        </button>
      ))}
      <div className="mt-auto p-2.5 text-[11px] text-textDim">{counts.questionCount} questions · local only</div>
    </div>
  );
}
