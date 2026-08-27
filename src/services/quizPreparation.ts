import type { Question } from "@/types/question";
import { shuffle } from "@/utils/id";

/**
 * Prepares questions for a quiz session without mutating the
 * original Question objects stored in IndexedDB.
 *
 * Rules:
 * - Single-correct questions: move the correct option to a
 *   random valid visual position.
 * - Multiple-choice questions: shuffle all options.
 * - Ordering/matching: leave untouched because option order
 *   can carry meaning.
 * - Original option IDs and is_correct values are preserved.
 */
export function randomizeQuestionOptions(
  questions: Question[]
): Question[] {
  return questions.map((question) => {
    const options = question.options;

    if (!options || options.length < 2) {
      return question;
    }

    if (
      question.question_type === "ordering" ||
      question.question_type === "matching"
    ) {
      return question;
    }

    const correct = options.filter(
      (option) => option.is_correct
    );

    const incorrect = options.filter(
      (option) => !option.is_correct
    );

    /*
     * Exactly one correct answer:
     *
     * Example:
     * [A(correct), B, C, D]
     *
     * can become:
     * [C, D, A(correct), B]
     *
     * The option IDs themselves do not change.
     */
    if (correct.length === 1) {
      const shuffledIncorrect =
        shuffle(incorrect);

      const targetIndex = Math.floor(
        Math.random() * options.length
      );

      const randomizedOptions =
        shuffledIncorrect.slice();

      randomizedOptions.splice(
        targetIndex,
        0,
        correct[0]
      );

      return {
        ...question,
        options: randomizedOptions,
      };
    }

    /*
     * Multiple-choice questions can have several
     * correct answers, so shuffle the entire option
     * array rather than trying to place one correct
     * answer.
     */
    if (
      question.question_type ===
      "multiple_choice"
    ) {
      return {
        ...question,
        options: shuffle(options),
      };
    }

    return question;
  });
}