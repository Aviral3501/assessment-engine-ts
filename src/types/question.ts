/**
 * Canonical Question schema — this is a CONTRACT with the user's
 * Question Generation Standard. Do not rename fields. Do not add
 * required fields that imported JSON won't have.
 */

export const QUESTION_TYPES = [
  "single_choice",
  "multiple_choice",
  "true_false",
  "best_answer",
  "scenario",
  "code_output",
  "code_completion",
  "ordering",
  "matching",
  "short_answer",
  "numerical",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const DIFFICULTIES = [1, 2, 3, 4, 5] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  1: "Very Easy",
  2: "Easy",
  3: "Medium",
  4: "Hard",
  5: "Very Hard",
};

export interface QuestionOption {
  id: string;
  text: string;
  is_correct: boolean;
  explanation?: string;
  /** Used only by ordering questions to define the correct sequence. */
  correct_position?: number;
}

export interface QuestionBody {
  text: string;
  code?: string | null;
}

export interface LearningMetadata {
  summary?: string;
  key_concept?: string;
  common_trap?: string;
  exam_tip?: string;
  misconception?: string;
}

export interface Relevance {
  snowflake_certification?: boolean;
  ibm_assessment?: boolean;
  general_data_engineering?: boolean;
}

export interface Source {
  type?: string;
  reference?: string;
}

export interface MatchingPair {
  left: string;
  right: string;
  options?: string[];
}

export interface Question {
  id: string;
  category: string;
  subcategory?: string;
  topic: string;
  tags?: string[];
  question_type: QuestionType;
  difficulty: Difficulty;
  question: QuestionBody;
  options?: QuestionOption[];
  learning?: LearningMetadata;
  relevance?: Relevance;
  source?: Source;

  // Extended, optional fields for specific question types.
  matching_pairs?: MatchingPair[];
  accepted_answers?: string[];
  numerical_answer?: number;
  tolerance?: number;
}

/** A response the learner can give — varies by question type. */
export type QuestionResponse =
  | string // single_choice / best_answer / true_false / short_answer option-id-or-text
  | number // numerical
  | string[] // multiple_choice / ordering (array of option ids)
  | Record<string, string> // matching (left -> right)
  | null
  | undefined;
