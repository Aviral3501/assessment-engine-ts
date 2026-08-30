/**
 * Represents a folder used to organize question sets.
 *
 * Folders can be nested through parent_id.
 * A null parent_id means the folder lives directly
 * under the root.
 */
export interface QuestionSetFolder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

/**
 * Represents a named, ordered collection of questions.
 *
 * Question sets are created from imported question IDs and allow the
 * application to keep a stable grouping of questions independent of
 * the questions themselves.
 *
 * folder_id is optional for backwards compatibility.
 * null / undefined means the set lives in the root.
 */
export interface QuestionSet {
  id: string;
  name: string;
  imported_at: string;
  question_ids: string[];
  count: number;
  folder_id?: string | null;
}