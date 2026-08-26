import type { Difficulty, QuestionResponse, QuestionType } from "./question";

export const RESULT_STATES = ["correct", "incorrect", "partial", "unanswered"] as const;
export type ResultState = (typeof RESULT_STATES)[number];

export interface Attempt {
  /** Auto-incremented by Dexie. Absent before the record is persisted. */
  attempt_id?: number;
  question_id: string;
  quiz_session_id: string;
  timestamp: string; // ISO
  selected_answers: QuestionResponse;
  correct_answers: unknown;
  result: ResultState;
  score: number; // 0..1
  time_taken: number; // seconds
  difficulty_at_attempt: Difficulty;
  question_type: QuestionType;
  category: string;
  subcategory: string;
  topic: string;
}

export type QuizMode =
  | "quick"
  | "topic"
  | "custom"
  | "daily"
  | "mistakes"
  | "due"
  | "unattempted"
  | "bookmarked"
  | "random"
  | "weak";

export interface QuizSession {
  quiz_session_id: string;
  started_at: string;
  completed_at?: string;
  mode: QuizMode;
  question_ids: string[];
  total_questions: number;
  answered_questions: number;
  correct_questions: number;
  partial_questions: number;
  incorrect_questions: number;
  score: number; // 0..1
  duration: number; // seconds
}

export type AnswerRevealMode = "immediate" | "end";
