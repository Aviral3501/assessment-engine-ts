import { db } from "@/db/db";
import type { Question, QuestionResponse } from "@/types/question";
import type { Attempt } from "@/types/attempt";
import type { Topic, TopicStatus, FlagReason } from "@/types/topic";
import { scoreAttempt } from "./scoring";
import {
  defaultLearningState,
  updateLearningState,
} from "./spacedRepetition";
import { selectDailyQuiz } from "./dailyQuiz";
import { buildQuestionSet } from "./questionSet";
import { nowISO, topicKeyOf, uid } from "@/utils/id";
import type { QuizProgress } from "@/types/quizProgress";
import type {
  QuestionSet,
  QuestionSetFolder,
} from "@/types/questionSet";

export type DuplicateStrategy = "skip" | "replace" | "keep";

export interface ImportResult {
  inserted: number;
  replaced: number;
  skipped: number;
}

export interface FullBackup {
  version: number;
  exported_at: string;
  questions: Question[];
  attempts: Attempt[];
  quiz_sessions: unknown[];
  learning_states: unknown[];
  topics: Topic[];
  bookmarks: unknown[];
  flags: unknown[];
  user_settings: unknown[];
  question_sets: QuestionSet[];
}

const IMPORT_CHUNK_SIZE = 200;

export const Store = {
  async allQuestions(): Promise<Question[]> {
    return db.questions.toArray();
  },

  async questionCount(): Promise<number> {
    return db.questions.count();
  },

  async getQuestion(id: string): Promise<Question | undefined> {
    return db.questions.get(id);
  },

  async getLearningState(id: string) {
    return db.learning_states.get(id);
  },

  async allLearningStates() {
    return db.learning_states.toArray();
  },

  async allAttempts(): Promise<Attempt[]> {
    return db.attempts.toArray();
  },

  async allTopics(): Promise<Topic[]> {
    return db.topics.toArray();
  },

  async allBookmarks() {
    return db.bookmarks.toArray();
  },

  async allFlags() {
    return db.flags.toArray();
  },

    /**
   * Returns all Question Set folders, ordered by creation time.
   */
  async allQuestionSetFolders(): Promise<
    QuestionSetFolder[]
  > {
    const folders =
      await db.question_set_folders.toArray();

    return folders.sort((a, b) =>
      a.created_at.localeCompare(
        b.created_at
      )
    );
  },

  /**
   * Gets a single folder by ID.
   */
  async getQuestionSetFolder(
    id: string
  ): Promise<QuestionSetFolder | undefined> {
    return db.question_set_folders.get(id);
  },

  /**
   * Creates a folder.
   *
   * parent_id === null means the folder is
   * directly under the root.
   */
  async createQuestionSetFolder(
    name: string,
    parentId: string | null = null
  ): Promise<QuestionSetFolder> {
    const trimmed = name.trim();

    if (!trimmed) {
      throw new Error(
        "Folder name cannot be empty."
      );
    }

    if (parentId) {
      const parent =
        await db.question_set_folders.get(
          parentId
        );

      if (!parent) {
        throw new Error(
          "Parent folder does not exist."
        );
      }
    }

    const folder: QuestionSetFolder = {
      id: uid("folder"),
      name: trimmed,
      parent_id: parentId,
      created_at: nowISO(),
    };

    await db.question_set_folders.put(
      folder
    );

    return folder;
  },

  /**
   * Renames an existing folder.
   */
  async renameQuestionSetFolder(
    id: string,
    name: string
  ): Promise<void> {
    const trimmed = name.trim();

    if (!trimmed) {
      throw new Error(
        "Folder name cannot be empty."
      );
    }

    const folder =
      await db.question_set_folders.get(id);

    if (!folder) {
      throw new Error(
        "Folder does not exist."
      );
    }

    folder.name = trimmed;

    await db.question_set_folders.put(
      folder
    );
  },

  /**
   * Moves a folder to another folder.
   *
   * parentId === null means Root.
   *
   * Prevents moving a folder into itself or
   * into one of its own descendants.
   */
  async moveQuestionSetFolder(
    id: string,
    parentId: string | null
  ): Promise<void> {
    const folder =
      await db.question_set_folders.get(id);

    if (!folder) {
      throw new Error(
        "Folder does not exist."
      );
    }

    if (parentId === id) {
      throw new Error(
        "A folder cannot be moved into itself."
      );
    }

    if (parentId) {
      const parent =
        await db.question_set_folders.get(
          parentId
        );

      if (!parent) {
        throw new Error(
          "Destination folder does not exist."
        );
      }

      let currentId: string | null =
        parentId;

      while (currentId) {
        if (currentId === id) {
          throw new Error(
            "A folder cannot be moved into one of its descendants."
          );
        }

const current: QuestionSetFolder | undefined =
  await db.question_set_folders.get(
    currentId
  );

currentId =
  current?.parent_id ?? null;
      }
    }

    folder.parent_id = parentId;

    await db.question_set_folders.put(
      folder
    );
  },

  /**
   * Moves a Question Set to a folder.
   *
   * folderId === null means Root.
   */
  async moveQuestionSetToFolder(
    setId: string,
    folderId: string | null
  ): Promise<void> {
    const set =
      await db.question_sets.get(setId);

    if (!set) {
      throw new Error(
        "Question set does not exist."
      );
    }

    if (folderId) {
      const folder =
        await db.question_set_folders.get(
          folderId
        );

      if (!folder) {
        throw new Error(
          "Destination folder does not exist."
        );
      }
    }

    set.folder_id = folderId;

    await db.question_sets.put(set);
  },

  /**
   * Deletes a folder without deleting any sets.
   *
   * All sets directly in the folder are moved
   * to Root.
   *
   * Child folders are also moved to Root so no
   * folder becomes orphaned.
   */
  async deleteQuestionSetFolder(
    id: string
  ): Promise<void> {
    const folder =
      await db.question_set_folders.get(id);

    if (!folder) {
      return;
    }

    await db.transaction(
      "rw",
      db.question_set_folders,
      db.question_sets,
      async () => {
        const [sets, children] =
          await Promise.all([
            db.question_sets
              .where("folder_id")
              .equals(id)
              .toArray(),

            db.question_set_folders
              .where("parent_id")
              .equals(id)
              .toArray(),
          ]);

        await Promise.all(
          sets.map((set) =>
            db.question_sets.put({
              ...set,
              folder_id: null,
            })
          )
        );

        await Promise.all(
          children.map((child) =>
            db.question_set_folders.put({
              ...child,
              parent_id: null,
            })
          )
        );

        await db.question_set_folders.delete(
          id
        );
      }
    );
  },

    /**
   * Saves the current in-progress quiz state.
   *
   * This only stores/resaves the quiz progress record.
   * It does not modify questions, attempts, learning states,
   * question sets, or any other existing data.
   */
  async saveQuizProgress(
    progress: QuizProgress
  ): Promise<void> {
    await db.quiz_progress.put(progress);
  },

  /**
   * Gets a specific in-progress quiz.
   */
  async getQuizProgress(
    quiz_session_id: string
  ): Promise<QuizProgress | undefined> {
    return db.quiz_progress.get(
      quiz_session_id
    );
  },

  /**
   * Returns all in-progress quizzes, newest first.
   */
  async allQuizProgress(): Promise<QuizProgress[]> {
    const progress =
      await db.quiz_progress.toArray();

    return progress.sort((a, b) =>
      b.updated_at.localeCompare(
        a.updated_at
      )
    );
  },

  /**
   * Returns the most recently updated in-progress
   * quiz, if one exists.
   */
  async getActiveQuizProgress(): Promise<
    QuizProgress | undefined
  > {
    const progress =
      await this.allQuizProgress();

    return progress[0];
  },

  /**
   * Deletes one saved in-progress quiz.
   */
  async deleteQuizProgress(
    quiz_session_id: string
  ): Promise<void> {
    await db.quiz_progress.delete(
      quiz_session_id
    );
  },

  /**
   * Deletes all saved in-progress quizzes.
   */
  async clearAllQuizProgress(): Promise<void> {
    await db.quiz_progress.clear();
  },

  async createQuestionSet(
    name: string,
    questionIds: string[]
  ): Promise<QuestionSet> {
    const set = buildQuestionSet(
      name,
      questionIds,
      uid("set"),
      nowISO()
    );

    await db.question_sets.put(set);

    return set;
  },

  async allQuestionSets(): Promise<QuestionSet[]> {
    const sets = await db.question_sets.toArray();

    return sets.sort((a, b) =>
      b.imported_at.localeCompare(a.imported_at)
    );
  },

  async getQuestionSet(
    id: string
  ): Promise<QuestionSet | undefined> {
    return db.question_sets.get(id);
  },

  async deleteQuestionSet(id: string): Promise<void> {
    await db.question_sets.delete(id);
  },

  /**
   * Resolves a set's question_ids to actual Question records,
   * preserving the set's original order and skipping any since-deleted
   * questions.
   */
  async getQuestionsForSet(id: string): Promise<Question[]> {
    const set = await db.question_sets.get(id);

    if (!set) return [];

    const qs = await db.questions.bulkGet(set.question_ids);

    return qs.filter(
      (q): q is Question => !!q
    );
  },

  /**
   * Chunked, transactional import. Never silently overwrites — the caller
   * must choose a DuplicateStrategy explicitly (spec §41, §43, §63).
   */
  async importQuestions(
    validQuestions: Question[],
    strategy: DuplicateStrategy,
    existingIds: Set<string>
  ): Promise<ImportResult> {
    let inserted = 0;
    let replaced = 0;
    let skipped = 0;

    for (
      let i = 0;
      i < validQuestions.length;
      i += IMPORT_CHUNK_SIZE
    ) {
      const chunk = validQuestions.slice(
        i,
        i + IMPORT_CHUNK_SIZE
      );

      await db.transaction(
        "rw",
        db.questions,
        db.learning_states,
        db.topics,
        async () => {
          for (const q of chunk) {
            const exists = existingIds.has(q.id);

            if (
              exists &&
              (strategy === "skip" || strategy === "keep")
            ) {
              skipped++;
              continue;
            }

            await db.questions.put(q);

            if (exists) {
              replaced++;
            } else {
              inserted++;
            }

            if (!exists) {
              await db.learning_states.put(
                defaultLearningState(q.id, q)
              );
            }

            const tKey = topicKeyOf(q);
            const existingTopic =
              await db.topics.get(tKey);

            if (!existingTopic) {
              await db.topics.put({
                topicKey: tKey,
                category: q.category,
                subcategory: q.subcategory ?? "",
                topic: q.topic,
                status: "Not Started",
              });
            }
          }
        }
      );
    }

    return {
      inserted,
      replaced,
      skipped,
    };
  },

  /**
   * Records an attempt and updates the associated learning state in a
   * single transaction. Attempt history and question data are kept
   * strictly separate (spec §11).
   */
  async recordAttempt(params: {
    question: Question;
    quiz_session_id: string;
    selected_answers: QuestionResponse;
    timeTakenSec: number;
  }): Promise<Attempt> {
    const {
      question,
      quiz_session_id,
      selected_answers,
      timeTakenSec,
    } = params;

    const scored = scoreAttempt(
      question,
      selected_answers
    );

    const attempt: Attempt = {
      question_id: question.id,
      quiz_session_id,
      timestamp: nowISO(),
      selected_answers,
      correct_answers: scored.correct_answers,
      result: scored.result,
      score: scored.score,
      time_taken: timeTakenSec || 0,
      difficulty_at_attempt: question.difficulty,
      question_type: question.question_type,
      category: question.category,
      subcategory: question.subcategory ?? "",
      topic: question.topic,
    };

    await db.transaction(
      "rw",
      db.attempts,
      db.learning_states,
      async () => {
        const newId =
          await db.attempts.add(attempt);

        attempt.attempt_id = newId as number;

        let ls =
          await db.learning_states.get(
            question.id
          );

        if (!ls) {
          ls = defaultLearningState(
            question.id,
            question
          );
        }

        updateLearningState(
          ls,
          scored.result,
          timeTakenSec || 0
        );

        await db.learning_states.put(ls);
      }
    );

    return attempt;
  },

  async setTopicStatus(
    topicKey: string,
    status: TopicStatus
  ): Promise<void> {
    const t = await db.topics.get(topicKey);

    if (t) {
      t.status = status;
      await db.topics.put(t);
    }
  },

  async toggleBookmark(
    question_id: string
  ): Promise<boolean> {
    const existing =
      await db.bookmarks.get(question_id);

    if (existing) {
      await db.bookmarks.delete(question_id);
      return false;
    }

    await db.bookmarks.put({
      question_id,
      created_at: nowISO(),
    });

    return true;
  },

  async addFlag(
    question_id: string,
    reason: FlagReason,
    note?: string
  ): Promise<void> {
    await db.flags.add({
      question_id,
      reason,
      note: note ?? "",
      created_at: nowISO(),
    });
  },

  /** Builds today's daily quiz by reading current state and delegating to the pure selection algorithm. */
  async buildDailyQuiz(
    size: number
  ): Promise<Question[]> {
    const [
      questions,
      learningStates,
      topics,
    ] = await Promise.all([
      db.questions.toArray(),
      db.learning_states.toArray(),
      db.topics.toArray(),
    ]);

    return selectDailyQuiz(
      questions,
      learningStates,
      topics,
      size
    );
  },

  async resetAttempts(): Promise<void> {
    await db.attempts.clear();
  },

  async resetSpacedRepetition(): Promise<void> {
    const qs =
      await db.questions.toArray();

    await db.learning_states.clear();

    await db.learning_states.bulkPut(
      qs.map((q) =>
        defaultLearningState(q.id, q)
      )
    );
  },

  async resetTopicProgress(): Promise<void> {
    const ts =
      await db.topics.toArray();

    await db.topics.bulkPut(
      ts.map((t) => ({
        ...t,
        status:
          "Not Started" as TopicStatus,
      }))
    );
  },

  async resetBookmarks(): Promise<void> {
    await db.bookmarks.clear();
    await db.flags.clear();
  },

  async resetAll(): Promise<void> {
    await db.transaction(
      "rw",
      [
        db.questions,
        db.attempts,
        db.quiz_sessions,
        db.learning_states,
        db.topics,
        db.bookmarks,
        db.flags,
        db.user_settings,
        db.question_sets,
        db.quiz_progress,
      ],
      async () => {
        await Promise.all([
          db.questions.clear(),
          db.attempts.clear(),
          db.quiz_sessions.clear(),
          db.learning_states.clear(),
          db.topics.clear(),
          db.bookmarks.clear(),
          db.flags.clear(),
          db.user_settings.clear(),
          db.question_sets.clear(),
          db.quiz_progress.clear(),
        ]);
      }
    );
  },

  async fullBackup(): Promise<FullBackup> {
    const [
      questions,
      attempts,
      quiz_sessions,
      learning_states,
      topics,
      bookmarks,
      flags,
      user_settings,
      question_sets,
    ] = await Promise.all([
      db.questions.toArray(),
      db.attempts.toArray(),
      db.quiz_sessions.toArray(),
      db.learning_states.toArray(),
      db.topics.toArray(),
      db.bookmarks.toArray(),
      db.flags.toArray(),
      db.user_settings.toArray(),
      db.question_sets.toArray(),
    ]);

    return {
      version: 1,
      exported_at: nowISO(),
      questions,
      attempts,
      quiz_sessions,
      learning_states,
      topics,
      bookmarks,
      flags,
      user_settings,
      question_sets,
    };
  },

  async restoreBackup(
    backup: Partial<FullBackup>
  ): Promise<void> {
    await db.transaction(
      "rw",
      [
        db.questions,
        db.attempts,
        db.quiz_sessions,
        db.learning_states,
        db.topics,
        db.bookmarks,
        db.flags,
        db.user_settings,
        db.question_sets,
      ],
      async () => {
        if (backup.questions) {
          await db.questions.bulkPut(
            backup.questions
          );
        }

        if (backup.attempts) {
          await db.attempts.bulkPut(
            backup.attempts.map((a) => ({
              ...a,
              attempt_id: undefined,
            }))
          );
        }

        if (backup.quiz_sessions) {
          await db.quiz_sessions.bulkPut(
            backup.quiz_sessions as any
          );
        }

        if (backup.learning_states) {
          await db.learning_states.bulkPut(
            backup.learning_states as any
          );
        }

        if (backup.topics) {
          await db.topics.bulkPut(
            backup.topics
          );
        }

        if (backup.bookmarks) {
          await db.bookmarks.bulkPut(
            backup.bookmarks as any
          );
        }

        if (backup.flags) {
          await db.flags.bulkPut(
            (backup.flags as any[]).map(
              (f) => ({
                ...f,
                id: undefined,
              })
            )
          );
        }

        if (backup.user_settings) {
          await db.user_settings.bulkPut(
            backup.user_settings as any
          );
        }

        if (backup.question_sets) {
          await db.question_sets.bulkPut(
            backup.question_sets
          );
        }
      }
    );
  },
};