/**
 * Represents a named, ordered collection of questions.
 *
 * Question sets are created from imported question IDs and allow the
 * application to keep a stable grouping of questions independent of
 * the questions themselves.
 */
export interface QuestionSet {
  id: string;
  name: string;
  imported_at: string;
  question_ids: string[];
  count: number;
}