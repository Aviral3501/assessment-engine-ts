import { useEffect, useMemo, useState } from "react";
import type { Question } from "@/types/question";
import type { LearningState } from "@/types/learning";
import type { Topic, TopicStatus } from "@/types/topic";
import { TOPIC_STATUS } from "@/types/topic";
import type { Attempt } from "@/types/attempt";
import { Store } from "@/services/store";
import { safeAccuracy } from "@/services/analytics";
import { topicKeyOf } from "@/utils/id";
import { EmptyState, Pct } from "@/components/Primitives";

const STATUS_COLOR: Record<TopicStatus, string> = {
  "Not Started": "#5C6C77",
  Studying: "#E0A63E",
  Covered: "#4FA3E3",
  Mastered: "#8B6FE0",
};

export function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [learningStates, setLearningStates] = useState<LearningState[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [t, a, l, q] = await Promise.all([Store.allTopics(), Store.allAttempts(), Store.allLearningStates(), Store.allQuestions()]);
    setTopics(t);
    setAttempts(a);
    setLearningStates(l);
    setQuestions(q);
  }

  const byCategory = useMemo(() => {
    const map = new Map<string, Topic[]>();
    topics.forEach((t) => {
      if (!map.has(t.category)) map.set(t.category, []);
      map.get(t.category)!.push(t);
    });
    return map;
  }, [topics]);

  async function setStatus(topicKey: string, status: TopicStatus) {
    await Store.setTopicStatus(topicKey, status);
    load();
  }

  if (topics.length === 0) {
    return <EmptyState title="No topics yet." body="Topics are derived automatically from imported questions." />;
  }

  return (
    <div className="fade-in">
      <div className="text-lg font-bold mb-3.5">Topics</div>
      {[...byCategory.entries()].map(([cat, ts]) => (
        <div key={cat} className="card p-4 mb-3.5">
          <div className="text-[14px] font-bold mb-2.5">{cat}</div>
          {ts.map((t) => {
            const qIds = new Set(questions.filter((q) => topicKeyOf(q) === t.topicKey).map((q) => q.id));
            const tAttempts = attempts.filter((a) => qIds.has(a.question_id));
            const attemptedIds = new Set(tAttempts.map((a) => a.question_id));
            const correct = tAttempts.filter((a) => a.result === "correct").length;
            const partial = tAttempts.filter((a) => a.result === "partial").length;
            const acc = safeAccuracy(correct, partial, tAttempts.length);
            const ls = learningStates.filter((l) => qIds.has(l.question_id));
            const mastery = ls.length ? ls.reduce((s, l) => s + l.mastery_score, 0) / ls.length : null;
            const due = ls.filter((l) => l.state === "due").length;

            return (
              <div key={t.topicKey} className="py-2.5 border-b border-borderSoft last:border-b-0">
                <div className="flex justify-between items-center mb-1.5">
                  <div>
                    <span className="text-[13.5px] font-semibold">{t.topic}</span>
                    {t.subcategory && <span className="text-[11.5px] text-textDim ml-2">{t.subcategory}</span>}
                  </div>
                  <select
                    className="input w-[140px] text-xs py-1 px-2"
                    style={{ color: STATUS_COLOR[t.status] }}
                    value={t.status}
                    onChange={(e) => setStatus(t.topicKey, e.target.value as TopicStatus)}
                  >
                    {TOPIC_STATUS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-4.5 text-[11.5px] text-textMuted">
                  <span>{qIds.size} questions</span>
                  <span>{attemptedIds.size} attempted</span>
                  <span>
                    Accuracy: <Pct value={acc} />
                  </span>
                  <span>Mastery: {mastery === null ? "—" : `${Math.round(mastery)}%`}</span>
                  {due > 0 && <span style={{ color: "#C97FE0" }}>{due} due</span>}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
