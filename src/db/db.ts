import Dexie, { type Table } from "dexie";

import type { Question } from "@/types/question";
import type { Attempt, QuizSession } from "@/types/attempt";
import type { LearningState } from "@/types/learning";
import type {
  Topic,
  Bookmark,
  Flag,
  UserSettingRow,
} from "@/types/topic";
import type { QuestionSet } from "@/types/questionSet";

export class QuizAssessmentDB extends Dexie {
  questions!: Table<Question, string>;
  attempts!: Table<Attempt, number>;
  quiz_sessions!: Table<QuizSession, string>;
  learning_states!: Table<LearningState, string>;
  topics!: Table<Topic, string>;
  bookmarks!: Table<Bookmark, string>;
  flags!: Table<Flag, number>;
  user_settings!: Table<UserSettingRow, string>;
  question_sets!: Table<QuestionSet, string>;

  constructor() {
    super("QuizAssessmentDB");

    this.version(1).stores({
      questions:
        "id, category, subcategory, topic, question_type, difficulty, *tags, [category+subcategory], [category+subcategory+topic]",

      attempts:
        "++attempt_id, question_id, quiz_session_id, timestamp, result",

      quiz_sessions:
        "quiz_session_id, started_at, mode, completed_at",

      learning_states:
        "question_id, next_review, state, category, topic",

      topics:
        "topicKey, category, subcategory, status",

      bookmarks:
        "question_id",

      flags:
        "++id, question_id",

      user_settings:
        "key",
    });

    this.version(2).stores({
      question_sets: "id, imported_at",
    });
  }
}

export const db = new QuizAssessmentDB();