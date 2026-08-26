import { useEffect, useMemo, useState } from "react";
import type { Question } from "@/types/question";
import { DIFFICULTIES, DIFFICULTY_LABEL, QUESTION_TYPES } from "@/types/question";
import type { LearningState } from "@/types/learning";
import { Store } from "@/services/store";
import { db } from "@/db/db";
import { EmptyState, Modal } from "@/components/Primitives";
import { TypeBadge, DifficultyBadge, ResultBadge } from "@/components/Badges";
import { CodeBlock } from "@/components/CodeBlock";
import type { Attempt } from "@/types/attempt";

const PAGE_SIZE = 25;

export function QuestionBankPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [learningStates, setLearningStates] = useState<Record<string, LearningState>>({});
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ category: "", difficulty: "", type: "", bookmarked: false });
  const [sortBy, setSortBy] = useState<"newest" | "difficulty" | "mastery" | "attempts">("newest");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Question | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [qs, ls, bm] = await Promise.all([Store.allQuestions(), Store.allLearningStates(), Store.allBookmarks()]);
    const lsMap: Record<string, LearningState> = {};
    ls.forEach((l) => (lsMap[l.question_id] = l));
    setQuestions(qs);
    setLearningStates(lsMap);
    setBookmarks(new Set(bm.map((b) => b.question_id)));
  }

  const categories = useMemo(() => [...new Set(questions.map((q) => q.category))], [questions]);

  const filtered = useMemo(() => {
    let list = questions.filter((q) => {
      if (filters.category && q.category !== filters.category) return false;
      if (filters.difficulty && String(q.difficulty) !== filters.difficulty) return false;
      if (filters.type && q.question_type !== filters.type) return false;
      if (filters.bookmarked && !bookmarks.has(q.id)) return false;
      if (query) {
        const hay = [q.id, q.category, q.subcategory, q.topic, (q.tags ?? []).join(" "), q.question.text].join(" ").toLowerCase();
        if (!hay.includes(query.toLowerCase())) return false;
      }
      return true;
    });
    list = list.slice().sort((a, b) => {
      const la = learningStates[a.id];
      const lb = learningStates[b.id];
      if (sortBy === "difficulty") return a.difficulty - b.difficulty;
      if (sortBy === "mastery") return (lb?.mastery_score ?? 0) - (la?.mastery_score ?? 0);
      if (sortBy === "attempts") return (lb?.times_answered ?? 0) - (la?.times_answered ?? 0);
      return String(b.id).localeCompare(String(a.id));
    });
    return list;
  }, [questions, filters, query, sortBy, learningStates, bookmarks]);

  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  async function toggleBookmark(id: string) {
    await Store.toggleBookmark(id);
    const bm = await Store.allBookmarks();
    setBookmarks(new Set(bm.map((b) => b.question_id)));
  }

  if (questions.length === 0) {
    return <EmptyState title="No questions imported yet." body="Import a JSON question bank to begin." />;
  }

  return (
    <div className="fade-in">
      <div className="text-lg font-bold mb-3.5">Question Bank</div>

      <div className="flex gap-2 mb-3.5 flex-wrap">
        <input
          className="input max-w-[260px]"
          placeholder="Search questions…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
        <select
          className="input max-w-[170px]"
          value={filters.category}
          onChange={(e) => {
            setFilters({ ...filters, category: e.target.value });
            setPage(0);
          }}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className="input max-w-[140px]"
          value={filters.difficulty}
          onChange={(e) => {
            setFilters({ ...filters, difficulty: e.target.value });
            setPage(0);
          }}
        >
          <option value="">All Difficulty</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABEL[d]}
            </option>
          ))}
        </select>
        <select
          className="input max-w-[170px]"
          value={filters.type}
          onChange={(e) => {
            setFilters({ ...filters, type: e.target.value });
            setPage(0);
          }}
        >
          <option value="">All Types</option>
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[13px]">
          <input type="checkbox" checked={filters.bookmarked} onChange={(e) => setFilters({ ...filters, bookmarked: e.target.checked })} />
          Bookmarked
        </label>
        <select className="input max-w-[150px] ml-auto" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
          <option value="newest">Newest</option>
          <option value="difficulty">Difficulty</option>
          <option value="mastery">Mastery</option>
          <option value="attempts">Attempts</option>
        </select>
      </div>

      <div className="text-xs text-textDim mb-2">{filtered.length} question(s)</div>

      <div className="card">
        <table>
          <thead>
            <tr>
              {["", "ID", "Category / Topic", "Type", "Difficulty", "Mastery", "Attempts", ""].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageItems.map((q) => {
              const ls = learningStates[q.id];
              return (
                <tr key={q.id} className="cursor-pointer" onClick={() => setDetail(q)}>
                  <td>
                    <button
                      className="btn btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBookmark(q.id);
                      }}
                    >
                      {bookmarks.has(q.id) ? "★" : "☆"}
                    </button>
                  </td>
                  <td className="mono text-textMuted">{q.id}</td>
                  <td>
                    {q.category} / {q.topic}
                  </td>
                  <td>
                    <TypeBadge type={q.question_type} />
                  </td>
                  <td>
                    <DifficultyBadge difficulty={q.difficulty} />
                  </td>
                  <td>{ls ? `${ls.mastery_score}%` : "—"}</td>
                  <td>{ls ? ls.times_answered : 0}</td>
                  <td className="text-accent">View →</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="flex gap-2 mt-3 items-center">
          <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            ← Prev
          </button>
          <span className="text-xs text-textMuted">
            Page {page + 1} of {Math.ceil(filtered.length / PAGE_SIZE)}
          </span>
          <button className="btn btn-sm" disabled={(page + 1) * PAGE_SIZE >= filtered.length} onClick={() => setPage((p) => p + 1)}>
            Next →
          </button>
        </div>
      )}

      {detail && (
        <Modal title={detail.id} onClose={() => setDetail(null)} width={640}>
          <QuestionHistoryDetail question={detail} />
        </Modal>
      )}
    </div>
  );
}

function QuestionHistoryDetail({ question }: { question: Question }) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [ls, setLs] = useState<LearningState | undefined>(undefined);

  useEffect(() => {
    db.attempts.where("question_id").equals(question.id).toArray().then(setAttempts);
    Store.getLearningState(question.id).then(setLs);
  }, [question.id]);

  return (
    <div>
      <div className="text-[14px] mb-2.5">{question.question.text}</div>
      {question.question.code && <CodeBlock code={question.question.code} language="sql" />}
      <div className="flex gap-4 text-[12.5px] text-textMuted my-3">
        <span>Attempts: {attempts.length}</span>
        <span>Correct: {attempts.filter((a) => a.result === "correct").length}</span>
        <span>Incorrect: {attempts.filter((a) => a.result === "incorrect").length}</span>
        {ls && <span>Next Review: {new Date(ls.next_review).toLocaleDateString()}</span>}
      </div>
      <div className="label mb-1.5">Options</div>
      {(question.options ?? []).map((o) => (
        <div
          key={o.id}
          className="px-2.5 py-2 mb-1.5 rounded-md border"
          style={{ borderColor: o.is_correct ? "#4FB07C" : "#202A31", background: o.is_correct ? "#16261F" : "transparent" }}
        >
          <div className="text-[13px]">{o.text}</div>
          {o.explanation && <div className="text-xs text-textMuted mt-0.5">{o.explanation}</div>}
        </div>
      ))}
      <div className="label my-1.5 mt-3">Attempt Timeline</div>
      {attempts.length === 0 ? (
        <div className="text-xs text-textDim">No attempts yet.</div>
      ) : (
        attempts
          .slice()
          .reverse()
          .map((a, i) => (
            <div key={i} className="flex justify-between text-xs py-1.5 border-b border-borderSoft">
              <span>{new Date(a.timestamp).toLocaleString()}</span>
              <ResultBadge result={a.result} />
            </div>
          ))
      )}
    </div>
  );
}
