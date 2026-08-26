export const LEARNING_STATES = ["new", "learning", "review", "due", "mastered", "difficult"] as const;
export type LearningStateName = (typeof LEARNING_STATES)[number];

export interface LearningState {
  question_id: string;
  category: string;
  subcategory: string;
  topic: string;

  times_seen: number;
  times_answered: number;
  times_correct: number;
  times_incorrect: number;
  times_partial: number;

  last_seen: string | null;
  last_answered: string | null;
  last_correct: string | null;

  current_streak: number;
  best_streak: number;

  mastery_score: number; // 0..100

  ease_factor: number;
  interval: number; // days
  repetitions: number;

  next_review: string; // ISO
  last_review: string | null;

  average_time: number;
  total_time: number;

  state: LearningStateName;
}
