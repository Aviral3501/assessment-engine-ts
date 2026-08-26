import type { QuestionType, Difficulty } from "@/types/question";
import { DIFFICULTY_LABEL } from "@/types/question";
import type { ResultState } from "@/types/attempt";

const TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: "Single Choice",
  multiple_choice: "Multiple Choice",
  true_false: "True / False",
  best_answer: "Best Answer",
  scenario: "Scenario",
  code_output: "Code Output",
  code_completion: "Code Completion",
  ordering: "Ordering",
  matching: "Matching",
  short_answer: "Short Answer",
  numerical: "Numerical",
};

export function TypeBadge({ type }: { type: QuestionType }) {
  return <span className="pill bg-surface2 text-textMuted border border-border">{TYPE_LABELS[type] || type}</span>;
}

const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  1: "#4FB07C",
  2: "#4FB07C",
  3: "#E0A63E",
  4: "#E2685A",
  5: "#E2685A",
};

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span className="pill bg-surface2 border border-border" style={{ color: DIFFICULTY_COLOR[difficulty] }}>
      {DIFFICULTY_LABEL[difficulty] || `L${difficulty}`}
    </span>
  );
}

const RESULT_STYLE: Record<ResultState, { c: string; bg: string; l: string }> = {
  correct: { c: "#4FB07C", bg: "#16261F", l: "Correct" },
  incorrect: { c: "#E2685A", bg: "#2A1917", l: "Incorrect" },
  partial: { c: "#E0A63E", bg: "#2A2216", l: "Partial" },
  unanswered: { c: "#5C6C77", bg: "#1C242B", l: "Unanswered" },
};

export function ResultBadge({ result }: { result: ResultState }) {
  const m = RESULT_STYLE[result] ?? RESULT_STYLE.unanswered;
  return (
    <span className="pill" style={{ background: m.bg, color: m.c }}>
      {m.l}
    </span>
  );
}
