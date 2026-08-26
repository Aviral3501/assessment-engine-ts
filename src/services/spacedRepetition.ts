import type { Question } from "@/types/question";
import type { LearningState } from "@/types/learning";
import type { ResultState } from "@/types/attempt";
import { nowISO } from "@/utils/id";

export function defaultLearningState(question_id: string, q: Pick<Question, "category" | "subcategory" | "topic">): LearningState {
  return {
    question_id,
    category: q.category,
    subcategory: q.subcategory ?? "",
    topic: q.topic,
    times_seen: 0,
    times_answered: 0,
    times_correct: 0,
    times_incorrect: 0,
    times_partial: 0,
    last_seen: null,
    last_answered: null,
    last_correct: null,
    current_streak: 0,
    best_streak: 0,
    mastery_score: 0,
    ease_factor: 2.5,
    interval: 0,
    repetitions: 0,
    next_review: nowISO(),
    last_review: null,
    average_time: 0,
    total_time: 0,
    state: "new",
  };
}

/**
 * Updates a LearningState in place (and returns it) using an SM-2 derived
 * algorithm. Quality is mapped from the discrete result state:
 *   correct -> 5, partial -> 3, incorrect -> 0
 * This is a deliberate simplification of SM-2's 0-5 quality scale, chosen
 * because our result states are discrete rather than self-rated.
 */
export function updateLearningState(ls: LearningState, result: ResultState, timeTakenSec: number): LearningState {
  const t = nowISO();
  ls.times_seen++;
  ls.times_answered++;
  ls.last_seen = t;
  ls.last_answered = t;
  ls.total_time = (ls.total_time || 0) + (timeTakenSec || 0);
  ls.average_time = ls.total_time / ls.times_answered;

  if (result === "correct") {
    ls.times_correct++;
    ls.current_streak++;
    ls.last_correct = t;
  } else if (result === "partial") {
    ls.times_partial++;
    ls.current_streak = 0;
  } else if (result === "incorrect") {
    ls.times_incorrect++;
    ls.current_streak = 0;
  }
  ls.best_streak = Math.max(ls.best_streak, ls.current_streak);

  const quality = result === "correct" ? 5 : result === "partial" ? 3 : 0;
  if (quality < 3) {
    ls.repetitions = 0;
    ls.interval = 1;
  } else {
    ls.repetitions += 1;
    if (ls.repetitions === 1) ls.interval = 1;
    else if (ls.repetitions === 2) ls.interval = 6;
    else ls.interval = Math.round(ls.interval * ls.ease_factor);
  }
  ls.ease_factor = Math.max(1.3, ls.ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  ls.last_review = t;
  const next = new Date();
  next.setDate(next.getDate() + Math.max(1, ls.interval));
  ls.next_review = next.toISOString();

  const accuracy = ls.times_answered ? (ls.times_correct + ls.times_partial * 0.5) / ls.times_answered : 0;
  ls.mastery_score = Math.round(
    Math.min(
      100,
      Math.max(
        0,
        accuracy * 100 * 0.6 + (Math.min(ls.current_streak, 5) / 5) * 100 * 0.2 + (Math.min(ls.repetitions, 10) / 10) * 100 * 0.2
      )
    )
  );

  const dueNow = new Date(ls.next_review) <= new Date();
  const failRate = ls.times_answered >= 3 ? ls.times_incorrect / ls.times_answered : 0;
  if (ls.times_answered === 0) ls.state = "new";
  else if (failRate > 0.4 && ls.times_answered >= 3) ls.state = "difficult";
  else if (ls.mastery_score >= 90 && ls.repetitions >= 4) ls.state = "mastered";
  else if (dueNow) ls.state = "due";
  else if (ls.repetitions >= 2) ls.state = "review";
  else ls.state = "learning";

  return ls;
}
