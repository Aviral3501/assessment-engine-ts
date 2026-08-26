import type { Question, QuestionResponse } from "@/types/question";
import type { ResultState } from "@/types/attempt";

export interface ScoredResult {
  result: ResultState;
  score: number; // 0..1
  correct_answers: unknown;
}

function isEmptyResponse(response: QuestionResponse): boolean {
  if (response === undefined || response === null) return true;
  if (Array.isArray(response)) return response.length === 0;
  if (typeof response === "string") return response.trim() === "";
  return false;
}

export function correctAnswerSummary(question: Question): unknown {
  if (Array.isArray(question.options)) {
    return question.options.filter((o) => o.is_correct).map((o) => o.id);
  }
  if (question.accepted_answers) return question.accepted_answers;
  if (question.numerical_answer !== undefined) return [question.numerical_answer];
  return [];
}

export function scoreAttempt(question: Question, response: QuestionResponse): ScoredResult {
  const type = question.question_type;
  const correct_answers = correctAnswerSummary(question);

  if (isEmptyResponse(response)) {
    return { result: "unanswered", score: 0, correct_answers };
  }

  if (type === "single_choice" || type === "best_answer" || type === "true_false") {
    const correctOpt = question.options?.find((o) => o.is_correct);
    const isCorrect = !!correctOpt && String(response) === String(correctOpt.id);
    return { result: isCorrect ? "correct" : "incorrect", score: isCorrect ? 1 : 0, correct_answers };
  }

  if (type === "multiple_choice") {
    const correctIds = new Set((question.options ?? []).filter((o) => o.is_correct).map((o) => String(o.id)));
    const selectedArr = Array.isArray(response) ? response : [response as string];
    const selected = new Set(selectedArr.map(String));
    let correctSelected = 0;
    let incorrectSelected = 0;
    selected.forEach((s) => (correctIds.has(s) ? correctSelected++ : incorrectSelected++));
    const fraction = correctIds.size ? Math.max(0, (correctSelected - incorrectSelected) / correctIds.size) : 0;

    let result: ResultState;
    if (correctSelected === correctIds.size && incorrectSelected === 0) result = "correct";
    else if (correctSelected > 0 && fraction > 0) result = "partial";
    else result = "incorrect";

    return { result, score: Math.min(1, fraction), correct_answers };
  }

  if (type === "ordering") {
    const correctOrder = (question.options ?? [])
      .slice()
      .sort((a, b) => (a.correct_position ?? 0) - (b.correct_position ?? 0))
      .map((o) => String(o.id));
    const given = (Array.isArray(response) ? response : []).map(String);
    let matches = 0;
    correctOrder.forEach((id, i) => {
      if (given[i] === id) matches++;
    });
    const fraction = correctOrder.length ? matches / correctOrder.length : 0;
    return {
      result: fraction === 1 ? "correct" : fraction > 0 ? "partial" : "incorrect",
      score: fraction,
      correct_answers,
    };
  }

  if (type === "matching") {
    const pairs = question.matching_pairs ?? [];
    const given = (response ?? {}) as Record<string, string>;
    let matches = 0;
    pairs.forEach((p) => {
      if (String(given[p.left]) === String(p.right)) matches++;
    });
    const fraction = pairs.length ? matches / pairs.length : 0;
    return {
      result: fraction === 1 ? "correct" : fraction > 0 ? "partial" : "incorrect",
      score: fraction,
      correct_answers,
    };
  }

  if (type === "short_answer") {
    const accepted = (
      question.accepted_answers && question.accepted_answers.length
        ? question.accepted_answers
        : (question.options ?? []).filter((o) => o.is_correct).map((o) => o.text)
    ).map((s) => s.trim().toLowerCase());
    const given = String(response).trim().toLowerCase();
    const isCorrect = accepted.includes(given);
    return { result: isCorrect ? "correct" : "incorrect", score: isCorrect ? 1 : 0, correct_answers };
  }

  if (type === "numerical") {
    const target =
      question.numerical_answer !== undefined
        ? question.numerical_answer
        : Number(question.options?.find((o) => o.is_correct)?.text);
    const tolerance = question.tolerance ?? 0;
    const given = Number(response);
    const isCorrect = !Number.isNaN(given) && !Number.isNaN(target) && Math.abs(given - target) <= tolerance;
    return { result: isCorrect ? "correct" : "incorrect", score: isCorrect ? 1 : 0, correct_answers };
  }

  // scenario / code_output / code_completion: default to option-based single-answer scoring
  if (question.options && question.options.length) {
    const correctOpt = question.options.find((o) => o.is_correct);
    const isCorrect = !!correctOpt && String(response) === String(correctOpt.id);
    return { result: isCorrect ? "correct" : "incorrect", score: isCorrect ? 1 : 0, correct_answers };
  }

  return { result: "unanswered", score: 0, correct_answers };
}
