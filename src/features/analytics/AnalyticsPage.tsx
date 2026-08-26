import { useEffect, useMemo, useState } from "react";
import { Store } from "@/services/store";
import { aggregateBy, buildAnalytics, type Analytics, type Bucket } from "@/services/analytics";
import type { Attempt } from "@/types/attempt";
import { DIFFICULTY_LABEL } from "@/types/question";
import { Bar, EmptyState, Pct, StatBlock, pctColor } from "@/components/Primitives";

export function BreakdownTable({ title, rows, labelFn }: { title: string; rows: Bucket[]; labelFn?: (key: string) => string }) {
  const sorted = rows.slice().sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0));
  return (
    <div className="card p-4">
      <div className="text-[13px] font-bold mb-3">{title}</div>
      {sorted.length === 0 ? (
        <div className="text-xs text-textDim">Insufficient data</div>
      ) : (
        sorted.map((r) => (
          <div key={r.key} className="mb-2.5">
            <div className="flex justify-between text-[12.5px] mb-1">
              <span>{labelFn ? labelFn(r.key) : r.key}</span>
              <span>
                {!r.sufficientSample && <span className="text-textDim mr-1.5 text-[11px]">n={r.total}</span>}
                <Pct value={r.accuracy} />
              </span>
            </div>
            <Bar value={r.accuracy} color={r.sufficientSample ? pctColor(r.accuracy) : "#5C6C77"} />
          </div>
        ))
      )}
    </div>
  );
}

export function AnalyticsPage({ refreshKey }: { refreshKey: number }) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [range, setRange] = useState<"7" | "30" | "all">("all");
  const [rawAttempts, setRawAttempts] = useState<Attempt[]>([]);

  useEffect(() => {
    load();
  }, [refreshKey]);

  async function load() {
    const [attempts, learningStates, questions] = await Promise.all([Store.allAttempts(), Store.allLearningStates(), Store.allQuestions()]);
    setRawAttempts(attempts);
    setAnalytics(buildAnalytics(attempts, learningStates, questions));
  }

  const filteredAttempts = useMemo(() => {
    if (range === "all") return rawAttempts;
    const days = range === "7" ? 7 : 30;
    const cutoff = Date.now() - days * 86400000;
    return rawAttempts.filter((a) => new Date(a.timestamp).getTime() >= cutoff);
  }, [rawAttempts, range]);

  const rangeAnalytics = useMemo(() => {
    if (!analytics) return null;
    if (range === "all") return analytics;
    return {
      ...analytics,
      byCategory: aggregateBy(filteredAttempts, (a) => a.category),
      byTopic: aggregateBy(filteredAttempts, (a) => `${a.category} / ${a.topic}`),
      byDifficulty: aggregateBy(filteredAttempts, (a) => String(a.difficulty_at_attempt)),
      byType: aggregateBy(filteredAttempts, (a) => a.question_type),
    };
  }, [analytics, filteredAttempts, range]);

  if (!analytics || !rangeAnalytics) return null;
  if (analytics.overall.total_attempts === 0) {
    return <EmptyState title="No quiz history yet." body="Take your first quiz to start building analytics." />;
  }

  const o = analytics.overall;

  return (
    <div className="fade-in">
      <div className="flex justify-between items-center mb-3.5">
        <div className="text-lg font-bold">Analytics</div>
        <div className="flex gap-1.5">
          {(["7", "30", "all"] as const).map((k) => (
            <button
              key={k}
              className="btn btn-sm"
              onClick={() => setRange(k)}
              style={{ background: range === k ? "#4FA3E3" : "#1C242B", color: range === k ? "#08141C" : "#E7EDF1" }}
            >
              {k === "7" ? "7 days" : k === "30" ? "30 days" : "All time"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2.5 mb-5">
        <StatBlock label="Total Attempts" value={o.total_attempts} />
        <StatBlock label="Attempted" value={`${o.total_attempted}/${o.total_questions}`} />
        <StatBlock label="Accuracy" value={o.overall_accuracy === null ? "—" : `${Math.round(o.overall_accuracy * 100)}%`} />
        <StatBlock label="Avg. Mastery" value={o.avg_mastery === null ? "—" : `${Math.round(o.avg_mastery)}%`} />
        <StatBlock label="Due" value={o.due_count} accent={o.due_count ? "#C97FE0" : undefined} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <BreakdownTable title="By Category" rows={rangeAnalytics.byCategory} />
        <BreakdownTable title="By Question Type" rows={rangeAnalytics.byType} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <BreakdownTable title="By Difficulty" rows={rangeAnalytics.byDifficulty} labelFn={(k) => DIFFICULTY_LABEL[Number(k) as 1 | 2 | 3 | 4 | 5] ?? k} />
        <BreakdownTable title="By Topic" rows={rangeAnalytics.byTopic} />
      </div>
    </div>
  );
}
