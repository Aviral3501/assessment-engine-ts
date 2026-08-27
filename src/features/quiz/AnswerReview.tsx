import { useState } from "react";
import type {
  Question,
  LearningMetadata,
} from "@/types/question";
import type { Attempt } from "@/types/attempt";
import { ResultBadge } from "@/components/Badges";

export function LearningPanel({
  learning,
}: {
  learning: LearningMetadata;
}) {
  const [open, setOpen] = useState(true);

  const rows: [
    string,
    string | undefined
  ][] = (
    [
      ["Key Concept", learning.key_concept],
      ["Common Trap", learning.common_trap],
      ["Exam Tip", learning.exam_tip],
      ["Misconception", learning.misconception],
    ] satisfies [
      string,
      string | undefined
    ][]
  ).filter(([, v]) => v !== undefined);

  return (
    <div
      className="card p-3.5"
      style={{ background: "#1C242B" }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="bg-transparent border-none text-accent text-[13px] font-bold cursor-pointer p-0"
      >
        {open ? "▾ " : "▸ "}Why?
      </button>

      {open && (
        <div className="mt-2.5">
          {learning.summary && (
            <div className="text-[13px] mb-2.5 text-textMuted">
              {learning.summary}
            </div>
          )}

          {rows.map(([label, val]) => (
            <div
              key={label}
              className="mb-2"
            >
              <div className="label mb-0.5">
                {label}
              </div>
              <div className="text-[13px]">
                {val}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AnswerReview({
  question,
  attempt,
  showExplanation = true,
}: {
  question: Question;
  attempt: Attempt;
  showExplanation?: boolean;
}) {
  const opts = question.options ?? [];

  const selectedArr = Array.isArray(
    attempt.selected_answers
  )
    ? attempt.selected_answers
    : [attempt.selected_answers];

  const selected = new Set(
    (
      selectedArr as (
        | string
        | number
        | null
        | undefined
      )[]
    ).map(String)
  );

  return (
    <div className="mt-4.5 border-t border-border pt-4">
      <div className="flex items-center gap-2.5 mb-3">
        <ResultBadge
          result={attempt.result}
        />

        <span className="text-xs text-textDim">
          {attempt.time_taken}s
        </span>
      </div>

      {opts.length > 0 && (
        <div className="mb-3.5">
          {opts.map((o) => {
            const wasSelected =
              selected.has(
                String(o.id)
              );

            const border =
              o.is_correct
                ? "#4FB07C"
                : wasSelected
                  ? "#E2685A"
                  : "#202A31";

            const bg =
              o.is_correct
                ? "#16261F"
                : wasSelected
                  ? "#2A1917"
                  : "transparent";

            return (
              <div
                key={o.id}
                className="px-3 py-2.5 mb-1.5 rounded-md border"
                style={{
                  borderColor: border,
                  background: bg,
                }}
              >
                <div className="flex justify-between text-[13.5px]">
                  <span>
                    {o.text}
                  </span>

                  <span className="text-[11px] text-textDim">
                    {wasSelected
                      ? "Your answer"
                      : o.is_correct
                        ? "Correct answer"
                        : ""}
                  </span>
                </div>

                {showExplanation &&
                  o.explanation && (
                    <div className="text-xs text-textMuted mt-1">
                      {o.explanation}
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      )}

      {!opts.length && (
        <div className="text-[13px] mb-3.5">
          Correct answer:{" "}
          {JSON.stringify(
            attempt.correct_answers
          )}
        </div>
      )}

      {showExplanation &&
        question.learning && (
          <LearningPanel
            learning={
              question.learning
            }
          />
        )}
    </div>
  );
}