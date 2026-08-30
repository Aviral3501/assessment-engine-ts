import type {
  Question,
  QuestionResponse,
} from "./question";
import type {
  AnswerRevealMode,
  QuizMode,
} from "./attempt";

export type QuizBehavior =
  | "learn"
  | "feedback"
  | "assessment";

export interface QuizProgress {
  /** Unique ID for this in-progress quiz. */
  quiz_session_id: string;

  /** When the quiz was originally started. ISO timestamp. */
  started_at: string;

  /** When progress was last saved. ISO timestamp. */
  updated_at: string;

  /** Current question index in the quiz queue. */
  current_index: number;

  /** The exact questions/order/options used by this quiz. */
  questions: Question[];

  /** Answers currently selected by the learner. */
  responses: Record<
    string,
    QuestionResponse
  >;

  /** Questions for which feedback has already been revealed. */
  revealed: Record<string, boolean>;

  /** Attempts already recorded during this in-progress quiz. */
  attempt_ids: number[];

  /** Current quiz behavior. */
  quiz_behavior: QuizBehavior;

  /** Whether explanations are currently enabled. */
  show_explanation: boolean;

  /** Original answer-reveal setting from quiz setup. */
  reveal_mode: AnswerRevealMode;

  /** Original quiz mode. */
  mode: QuizMode;

  /** Timestamp when the current question was entered. */
  question_started_at: string;

  /** Total elapsed active quiz time in seconds before the current question. */
  elapsed_seconds: number;

  /** Whether this record represents a manually paused quiz. */
  paused: boolean;
}