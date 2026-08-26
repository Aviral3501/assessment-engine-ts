import { useEffect, useState } from "react";
import { Store } from "@/services/store";
import { buildAnalytics, weaknessEngine, type Analytics, type Bucket } from "@/services/analytics";
import { Bar, EmptyState, Pct, StatBlock, pctColor } from "@/components/Primitives";
import type { PageKey } from "@/App";

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning." : h < 18 ? "Good afternoon." : "Good evening.";
}

interface DashboardData {
  questionCount: number;
  due: number;
  analytics: Analytics;
  weak: Bucket[];
  recentTopics: string[];
  streak: number;
}

export function Dashboard({ setPage, refreshKey }: { setPage: (p: PageKey) => void; refreshKey: number }) {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    load();
  }, [refreshKey]);

  async function load() {
    const [questions, attempts, learningStates] = await Promise.all([Store.allQuestions(), Store.allAttempts(), Store.allLearningStates()]);
    const due = learningStates.filter((l) => l.state === "due").length;
    const analytics = buildAnalytics(attempts, learningStates, questions);
    const weak = weaknessEngine(analytics.byTopic);
    const recent = attempts.slice(-20).reverse();
    const recentTopics = [...new Set(recent.map((a) => a.topic))].slice(0, 5);

    let streak = 0;
    const days = new Set(attempts.map((a) => a.timestamp.slice(0, 10)));
    const cursor = new Date();
    while (days.has(cursor.toISOString().slice(0, 10))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    setData({ questionCount: questions.length, due, analytics, weak, recentTopics, streak });
  }

  if (!data) return null;

  if (data.questionCount === 0) {
    return (
      <EmptyState
        title="No questions imported yet."
        body="Import a JSON question bank to begin studying."
        action={
          <button className="btn btn-primary" onClick={() => setPage("import")}>
            Import Questions
          </button>
        }
      />
    );
  }

  return (
    <div className="fade-in flex flex-col gap-5">
      <div>
        <div className="text-xl font-bold">{greeting()}</div>
        <div className="text-textMuted text-[13px] mt-0.5">Here's where things stand today.</div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatBlock label="Due Today" value={data.due} accent={data.due ? "#C97FE0" : undefined} />
        <StatBlock label="Weak Topics" value={data.weak.length} />
        <StatBlock label="Current Streak" value={`${data.streak}d`} />
        <StatBlock
          label="Overall Accuracy"
          value={data.analytics.overall.overall_accuracy === null ? "—" : `${Math.round(data.analytics.overall.overall_accuracy * 100)}%`}
        />
      </div>

      <button className="btn btn-primary self-start px-5 py-2.5" onClick={() => setPage("quiz-setup")}>
        Start Daily Quiz →
      </button>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="text-[13px] font-bold mb-2.5">Weak Areas</div>
          {data.weak.length === 0 ? (
            <div className="text-xs text-textDim">Not enough attempt history yet.</div>
          ) : (
            data.weak.slice(0, 6).map((t) => (
              <div key={t.key} className="mb-2.5">
                <div className="flex justify-between text-[12.5px] mb-1">
                  <span>{t.key}</span>
                  <Pct value={t.accuracy} />
                </div>
                <Bar value={t.accuracy} color={pctColor(t.accuracy)} />
              </div>
            ))
          )}
        </div>
        <div className="card p-4">
          <div className="text-[13px] font-bold mb-2.5">Recently Studied</div>
          {data.recentTopics.length === 0 ? (
            <div className="text-xs text-textDim">No recent activity.</div>
          ) : (
            data.recentTopics.map((t) => (
              <div key={t} className="text-[12.5px] py-1.5 border-b border-borderSoft last:border-b-0">
                {t}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
