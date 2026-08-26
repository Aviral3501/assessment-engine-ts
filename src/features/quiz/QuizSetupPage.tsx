import { useEffect, useMemo, useState } from "react";
import type { Question } from "@/types/question";
import { DIFFICULTIES, DIFFICULTY_LABEL, QUESTION_TYPES } from "@/types/question";
import type { AnswerRevealMode, QuizMode } from "@/types/attempt";
import { Store } from "@/services/store";
import { buildAnalytics, weaknessEngine } from "@/services/analytics";
import { shuffle } from "@/utils/id";
import type { QuizSetup } from "./QuizRunner";

interface ModeDef {
  key: QuizMode;
  label: string;
  desc: string;
}
const QUIZ_MODES: ModeDef[] = [
  { key: "quick", label: "Quick Quiz", desc: "Choose a question count and go." },
  { key: "topic", label: "Topic Quiz", desc: "Practice one specific topic." },
  { key: "custom", label: "Custom Quiz", desc: "Filter by any combination of criteria." },
  { key: "daily", label: "Daily Quiz", desc: "Adaptive selection from covered topics." },
  { key: "mistakes", label: "Mistake Quiz", desc: "Previously incorrect or partial questions." },
  { key: "due", label: "Due Today", desc: "Questions due for spaced-repetition review." },
  { key: "unattempted", label: "Unattempted", desc: "Questions you haven't tried yet." },
  { key: "bookmarked", label: "Bookmarked", desc: "Your saved questions." },
  { key: "random", label: "Random", desc: "Pure random from the full bank." },
  { key: "weak", label: "Weak Areas", desc: "Auto-generated from your weakest topics." },
];

export function QuizSetupPage({ onStart }: { onStart: (setup: QuizSetup) => void }) {
  const [mode, setMode] = useState<QuizMode>("quick");
  const [count, setCount] = useState(20);
  const [category, setCategory] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [qtype, setQtype] = useState("");
  const [revealMode, setRevealMode] = useState<AnswerRevealMode>("immediate");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Store.allQuestions().then(setQuestions);
  }, []);

  const categories = useMemo(() => [...new Set(questions.map((q) => q.category))], [questions]);
  const topicOptions = useMemo(
    () => [...new Set(questions.filter((q) => !category || q.category === category).map((q) => q.topic))],
    [questions, category]
  );

  async function start() {
    setBusy(true);
    let selected: Question[] = [];
    const [attempts, learningStates, bookmarks] = await Promise.all([Store.allAttempts(), Store.allLearningStates(), Store.allBookmarks()]);
    const lsMap = new Map(learningStates.map((l) => [l.question_id, l]));
    const bookmarkIds = new Set(bookmarks.map((b) => b.question_id));
    const attemptedIds = new Set(attempts.map((a) => a.question_id));
    const incorrectIds = new Set(attempts.filter((a) => a.result === "incorrect" || a.result === "partial").map((a) => a.question_id));

    if (mode === "quick" || mode === "random") {
      selected = shuffle(questions).slice(0, count);
    } else if (mode === "topic") {
      selected = shuffle(questions.filter((q) => (!category || q.category === category) && (!topic || q.topic === topic))).slice(0, count);
    } else if (mode === "custom") {
      selected = shuffle(
        questions.filter(
          (q) =>
            (!category || q.category === category) &&
            (!topic || q.topic === topic) &&
            (!difficulty || String(q.difficulty) === difficulty) &&
            (!qtype || q.question_type === qtype)
        )
      ).slice(0, count);
    } else if (mode === "daily") {
      selected = await Store.buildDailyQuiz(count);
    } else if (mode === "mistakes") {
      selected = shuffle(questions.filter((q) => incorrectIds.has(q.id))).slice(0, count);
    } else if (mode === "due") {
      selected = shuffle(questions.filter((q) => lsMap.get(q.id)?.state === "due")).slice(0, count);
    } else if (mode === "unattempted") {
      selected = shuffle(questions.filter((q) => !attemptedIds.has(q.id))).slice(0, count);
    } else if (mode === "bookmarked") {
      selected = shuffle(questions.filter((q) => bookmarkIds.has(q.id))).slice(0, count);
    } else if (mode === "weak") {
      const analytics = buildAnalytics(attempts, learningStates, questions);
      const weakTopics = weaknessEngine(analytics.byTopic);
      selected = shuffle(questions.filter((q) => weakTopics.some((t) => t.key === `${q.category} / ${q.topic}`))).slice(0, count);
      if (!selected.length) selected = shuffle(questions).slice(0, count);
    }

    setBusy(false);
    if (!selected.length) {
      window.alert("No questions matched this configuration.");
      return;
    }
    onStart({ mode, questions: selected, revealMode });
  }

  return (
    <div className="fade-in max-w-3xl">
      <div className="text-lg font-bold mb-3.5">Start a Quiz</div>

      <div className="grid grid-cols-2 gap-2.5 mb-5">
        {QUIZ_MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className="card text-left p-3.5 cursor-pointer"
            style={{ borderColor: mode === m.key ? "#4FA3E3" : "#202A31", background: mode === m.key ? "#1C242B" : "#161C21" }}
          >
            <div className="text-[13.5px] font-bold mb-0.5">{m.label}</div>
            <div className="text-[11.5px] text-textMuted">{m.desc}</div>
          </button>
        ))}
      </div>

      <div className="card p-4 mb-4">
        <div className="text-[13px] font-bold mb-3">Configuration</div>
        <div className="grid grid-cols-3 gap-2.5">
          {mode !== "daily" && (
            <div>
              <div className="label mb-1">Question Count</div>
              <select className="input" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[5, 10, 20, 30, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          )}
          {mode === "daily" && (
            <div>
              <div className="label mb-1">Daily Question Count</div>
              <select className="input" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[10, 20, 30, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          )}
          {(mode === "topic" || mode === "custom") && (
            <div>
              <div className="label mb-1">Category</div>
              <select
                className="input"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setTopic("");
                }}
              >
                <option value="">Any</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
          {(mode === "topic" || mode === "custom") && (
            <div>
              <div className="label mb-1">Topic</div>
              <select className="input" value={topic} onChange={(e) => setTopic(e.target.value)}>
                <option value="">Any</option>
                {topicOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}
          {mode === "custom" && (
            <div>
              <div className="label mb-1">Difficulty</div>
              <select className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="">Any</option>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_LABEL[d]}
                  </option>
                ))}
              </select>
            </div>
          )}
          {mode === "custom" && (
            <div>
              <div className="label mb-1">Question Type</div>
              <select className="input" value={qtype} onChange={(e) => setQtype(e.target.value)}>
                <option value="">Any</option>
                {QUESTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <div className="label mb-1">Answer Reveal</div>
            <select className="input" value={revealMode} onChange={(e) => setRevealMode(e.target.value as AnswerRevealMode)}>
              <option value="immediate">Immediate feedback</option>
              <option value="end">End of quiz</option>
            </select>
          </div>
        </div>
      </div>

      <button className="btn btn-primary px-5.5 py-2.5" disabled={busy} onClick={start}>
        {busy ? "Building…" : "Start Quiz →"}
      </button>
    </div>
  );
}
