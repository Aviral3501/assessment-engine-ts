import { useEffect, useState } from "react";
import { Store } from "@/services/store";
import { aggregateBy, buildAnalytics, safeAccuracy, strengthEngine, weaknessEngine, type Analytics, type Bucket } from "@/services/analytics";
import { DIFFICULTY_LABEL } from "@/types/question";
import { EmptyState, pctColor } from "@/components/Primitives";
import { BreakdownTable } from "./AnalyticsPage";

interface RelevanceScore {
  total: number;
  accuracy: number | null;
  byCategory: Bucket[];
}

export function FinalReportPage({ refreshKey }: { refreshKey: number }) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [strong, setStrong] = useState<Bucket[]>([]);
  const [weak, setWeak] = useState<Bucket[]>([]);
  const [relevanceScores, setRelevanceScores] = useState<Record<string, RelevanceScore>>({});
  const [recommendations, setRecommendations] = useState<string[]>([]);

  useEffect(() => {
    load();
  }, [refreshKey]);

  async function load() {
    const [attempts, learningStates, questions] = await Promise.all([Store.allAttempts(), Store.allLearningStates(), Store.allQuestions()]);
    const a = buildAnalytics(attempts, learningStates, questions);
    setAnalytics(a);
    setStrong(strengthEngine(a.byTopic));
    setWeak(weaknessEngine(a.byTopic));

    const scores: Record<string, RelevanceScore> = {};
    (["snowflake_certification", "ibm_assessment", "general_data_engineering"] as const).forEach((key) => {
      const relQIds = new Set(questions.filter((q) => q.relevance?.[key]).map((q) => q.id));
      const relAttempts = attempts.filter((att) => relQIds.has(att.question_id));
      const correct = relAttempts.filter((att) => att.result === "correct").length;
      const partial = relAttempts.filter((att) => att.result === "partial").length;
      scores[key] = { total: relAttempts.length, accuracy: safeAccuracy(correct, partial, relAttempts.length), byCategory: aggregateBy(relAttempts, (att) => att.category) };
    });
    setRelevanceScores(scores);

    const recs: string[] = [];
    const weakTopics = weaknessEngine(a.byTopic);
    weakTopics.slice(0, 3).forEach((t) => recs.push(`Review ${t.key} — accuracy ${Math.round((t.accuracy || 0) * 100)}% over ${t.total} attempts.`));
    const dueCount = learningStates.filter((l) => l.state === "due").length;
    if (dueCount) recs.push(`Complete ${dueCount} question(s) currently due for spaced-repetition review.`);
    const weakType = a.byType.filter((t) => t.sufficientSample).sort((x, y) => (x.accuracy ?? 1) - (y.accuracy ?? 1))[0];
    if (weakType) recs.push(`Practice more ${weakType.key.replace(/_/g, " ")} questions — currently your weakest question type.`);
    setRecommendations(recs);
  }

  if (!analytics) return null;
  if (analytics.overall.total_attempts === 0) {
    return <EmptyState title="Not enough data for a report." body="Take a few quizzes first — the report is built entirely from your real attempt history." />;
  }

  return (
    <div className="fade-in max-w-4xl">
      <div className="text-lg font-bold mb-1">Final Readiness Report</div>
      <div className="text-[12.5px] text-textMuted mb-5">A readiness estimate, not a certification pass probability — based entirely on your stored history.</div>

      <div className="grid grid-cols-3 gap-3.5 mb-5">
        {Object.entries(relevanceScores).map(([key, v]) => (
          <div key={key} className="card p-4">
            <div className="label mb-2">{key.replace(/_/g, " ")}</div>
            <div className="font-mono text-2xl font-semibold" style={{ color: pctColor(v.accuracy) }}>
              {v.accuracy === null ? "—" : `${Math.round(v.accuracy * 100)}%`}
            </div>
            <div className="text-[11.5px] text-textDim mt-1">{v.total} attempts</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <BreakdownTable title="Strong Areas" rows={strong} />
        <BreakdownTable title="Needs Improvement" rows={weak} />
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <BreakdownTable title="Question Type Performance" rows={analytics.byType} />
        <BreakdownTable title="Difficulty Performance" rows={analytics.byDifficulty} labelFn={(k) => DIFFICULTY_LABEL[Number(k) as 1 | 2 | 3 | 4 | 5] ?? k} />
      </div>

      <div className="card p-4">
        <div className="text-[13px] font-bold mb-2.5">Recommended Revision</div>
        {recommendations.length === 0 ? (
          <div className="text-xs text-textDim">No recommendations yet — keep practicing to build history.</div>
        ) : (
          recommendations.map((r, i) => (
            <div key={i} className="text-[13px] py-1.5 flex gap-2">
              <span className="text-accent">{i + 1}.</span>
              {r}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
