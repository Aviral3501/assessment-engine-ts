import type { QuestionSet } from "@/types/questionSet";

/**
 * Builds a QuestionSet record from a name and an ordered list of question
 * ids. Falls back to a dated default name when the given name is blank —
 * a set should never end up unnamed/unfindable.
 */
export function buildQuestionSet(name: string, questionIds: string[], id: string, importedAt: string): QuestionSet {
  const trimmed = name.trim();
  return {
    id,
    name: trimmed || `Import ${new Date(importedAt).toLocaleDateString()}`,
    imported_at: importedAt,
    question_ids: questionIds,
    count: questionIds.length,
  };
}
