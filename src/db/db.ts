import Dexie, { type Table } from "dexie";

import type { Question } from "@/types/question";
import type {
  Attempt,
  QuizSession,
} from "@/types/attempt";
import type { LearningState } from "@/types/learning";
import type {
  Topic,
  Bookmark,
  Flag,
  UserSettingRow,
} from "@/types/topic";
import type {
  QuestionSet,
  QuestionSetFolder,
} from "@/types/questionSet";
import type { QuizProgress } from "@/types/quizProgress";

export class QuizAssessmentDB extends Dexie {
  questions!: Table<Question, string>;

  attempts!: Table<Attempt, number>;

  quiz_sessions!: Table<
    QuizSession,
    string
  >;

  learning_states!: Table<
    LearningState,
    string
  >;

  topics!: Table<Topic, string>;

  bookmarks!: Table<Bookmark, string>;

  flags!: Table<Flag, number>;

  user_settings!: Table<
    UserSettingRow,
    string
  >;

  question_sets!: Table<
    QuestionSet,
    string
  >;

  quiz_progress!: Table<
    QuizProgress,
    string
  >;

  question_set_folders!: Table<
    QuestionSetFolder,
    string
  >;

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
      question_sets:
        "id, imported_at",
    });

    this.version(3).stores({
      quiz_progress:
        "quiz_session_id, updated_at, paused",
    });

    /*
     * Version 4:
     * Adds nested folders for Question Sets.
     *
     * Existing question sets are untouched.
     * Existing sets without folder_id are treated
     * as belonging to the root.
     */
this.version(4).stores({
  question_sets:
    "id, imported_at, folder_id",

  question_set_folders:
    "id, parent_id, created_at",
});
  }
}

export const db =
  new QuizAssessmentDB();