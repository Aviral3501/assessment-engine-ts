import type { Attempt, QuizSession } from "@/types/attempt";
import { StatBlock } from "@/components/Primitives";
import type { PageKey } from "@/App";

export function SessionReportPage({
  sessionRecord,
  attempts,
  setPage,
}: {
  sessionRecord: QuizSession;
  attempts: Attempt[];
  setPage: (p: PageKey) => void;
}) {
  const weakest = attempts.filter((a) => a.result === "incorrect" || a.result === "partial");
  const topicsMissed = [...new Set(weakest.map((a) => a.topic))];

  return (
    <div className="fade-in max-w-2xl">
      <div className="text-lg font-bold mb-3.5">Quiz Complete</div>
      <div className="grid grid-cols-4 gap-2.5 mb-5">
        <StatBlock label="Score" value={`${Math.round((sessionRecord.score || 0) * 100)}%`} />
        <StatBlock label="Correct" value={sessionRecord.correct_questions} accent="#4FB07C" />
        <StatBlock label="Partial" value={sessionRecord.partial_questions} accent="#E0A63E" />
        <StatBlock label="Incorrect" value={sessionRecord.incorrect_questions} accent="#E2685A" />
      </div>
      <div className="flex gap-4 text-[12.5px] text-textMuted mb-5">
        <span>Duration: {sessionRecord.duration}s</span>
        <span>Avg / question: {attempts.length ? Math.round(sessionRecord.duration / attempts.length) : 0}s</span>
      </div>
      {topicsMissed.length > 0 && (
        <div className="card p-4 mb-4">
          <div className="text-[13px] font-bold mb-2.5">Topics Missed</div>
          {topicsMissed.map((t) => (
            <div key={t} className="text-[13px] py-1.5">
              {t}
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={() => setPage("quiz-setup")}>
          Start Another Quiz
        </button>
        <button className="btn" onClick={() => setPage("dashboard")}>
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
