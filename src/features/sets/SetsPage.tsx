import { useEffect, useState } from "react";
import type { QuestionSet } from "@/types/questionSet";
import { Store } from "@/services/store";
import { safeAccuracy } from "@/services/analytics";
import { EmptyState, Pct } from "@/components/Primitives";
import type { QuizSetup } from "@/features/quiz/QuizRunner";

export function SetsPage({
  onSolve,
}: {
  onSolve: (setup: QuizSetup) => void;
}) {
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [stats, setStats] = useState<
    Record<
      string,
      {
        attempted: number;
        accuracy: number | null;
      }
    >
  >({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    const [allSets, attempts] = await Promise.all([
      Store.allQuestionSets(),
      Store.allAttempts(),
    ]);

    setSets(allSets);

    const s: Record<
      string,
      {
        attempted: number;
        accuracy: number | null;
      }
    > = {};

    allSets.forEach((set) => {
      const idSet = new Set(set.question_ids);

      const relevant = attempts.filter((a) =>
        idSet.has(a.question_id)
      );

      const attemptedIds = new Set(
        relevant.map((a) => a.question_id)
      );

      const correct = relevant.filter(
        (a) => a.result === "correct"
      ).length;

      const partial = relevant.filter(
        (a) => a.result === "partial"
      ).length;

      s[set.id] = {
        attempted: attemptedIds.size,
        accuracy: safeAccuracy(
          correct,
          partial,
          relevant.length
        ),
      };
    });

    setStats(s);
    setLoading(false);
  }

  async function solveSet(set: QuestionSet) {
    const questions =
      await Store.getQuestionsForSet(set.id);

    if (!questions.length) {
      window.alert(
        "This set's questions are no longer in the question bank."
      );
      return;
    }

    onSolve({
      mode: "set",
      questions,
      revealMode: "immediate",
    });
  }

  async function removeSet(set: QuestionSet) {
    if (
      !window.confirm(
        `Remove the set "${set.name}"? The questions themselves stay in your question bank — only this set grouping is deleted.`
      )
    ) {
      return;
    }

    await Store.deleteQuestionSet(set.id);
    load();
  }

  if (loading) return null;

  if (sets.length === 0) {
    return (
      <EmptyState
        title="No sets yet."
        body="Every batch you import is saved here automatically, in upload order, as its own solvable queue."
      />
    );
  }

  return (
    <div className="fade-in">
      <div className="text-lg font-bold mb-1">
        Sets
      </div>

      <div className="text-[12.5px] text-textMuted mb-4">
        Each uploaded batch, kept in its original order —
        solve it start to finish or jump around freely.
      </div>

      <div className="flex flex-col gap-3">
        {sets.map((set) => {
          const st = stats[set.id];

          return (
            <div
              key={set.id}
              className="card p-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="text-[14px] font-semibold truncate">
                  {set.name}
                </div>

                <div className="flex gap-4 text-[11.5px] text-textMuted mt-1">
                  <span>
                    {set.count} questions
                  </span>

                  <span>
                    Uploaded{" "}
                    {new Date(
                      set.imported_at
                    ).toLocaleDateString()}
                  </span>

                  <span>
                    {st
                      ? `${st.attempted}/${set.count} attempted`
                      : "—"}
                  </span>

                  <span>
                    Accuracy:{" "}
                    <Pct
                      value={
                        st?.accuracy ?? null
                      }
                    />
                  </span>
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() =>
                    removeSet(set)
                  }
                >
                  Remove
                </button>

                <button
                  className="btn btn-primary btn-sm"
                  onClick={() =>
                    solveSet(set)
                  }
                >
                  Solve Set →
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}