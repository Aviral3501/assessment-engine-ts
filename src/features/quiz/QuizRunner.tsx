import { useEffect, useRef, useState } from "react";
import type {
  Question,
  QuestionResponse,
} from "@/types/question";
import type {
  AnswerRevealMode,
  Attempt,
  QuizMode,
  QuizSession,
  ResultState,
} from "@/types/attempt";
import { Store } from "@/services/store";
import { db } from "@/db/db";
import { uid, nowISO } from "@/utils/id";
import { QuestionRenderer } from "./QuestionRenderer";
import { AnswerReview } from "./AnswerReview";
import {
  TypeBadge,
  DifficultyBadge,
} from "@/components/Badges";
import { CodeBlock } from "@/components/CodeBlock";

export interface QuizSetup {
  mode: QuizMode;
  questions: Question[];
  revealMode: AnswerRevealMode;
}

interface Props {
  session: QuizSetup;
  onFinish: (
    sessionRecord: QuizSession,
    attempts: Attempt[]
  ) => void;
}

type QuizBehavior =
  | "learn"
  | "feedback"
  | "assessment";

const RESULT_COLOR: Record<
  ResultState,
  { bg: string; border: string }
> = {
  correct: {
    bg: "#16261F",
    border: "#4FB07C",
  },
  incorrect: {
    bg: "#2A1917",
    border: "#E2685A",
  },
  partial: {
    bg: "#2A2216",
    border: "#E0A63E",
  },
  unanswered: {
    bg: "#1C242B",
    border: "#5C6C77",
  },
};

function initialQuizBehavior(
  revealMode: AnswerRevealMode
): QuizBehavior {
  return revealMode === "immediate"
    ? "learn"
    : "assessment";
}

export function QuizRunner({
  session,
  onFinish,
}: Props) {
  const [idx, setIdx] = useState(0);

  const [responses, setResponses] =
    useState<
      Record<string, QuestionResponse>
    >({});

  const [revealed, setRevealed] =
    useState<Record<string, boolean>>({});

  const [attemptsLog, setAttemptsLog] =
    useState<Attempt[]>([]);

  const [bookmarks, setBookmarks] =
    useState<Set<string>>(new Set());

  const [queueOpen, setQueueOpen] =
    useState(true);

  const [quizBehavior, setQuizBehavior] =
    useState<QuizBehavior>(() =>
      initialQuizBehavior(
        session.revealMode
      )
    );

  const [showExplanation, setShowExplanation] =
    useState(true);

  const [startTime] =
    useState(Date.now());

  const sessionIdRef = useRef(
    uid("qs")
  );

  const qStartRef = useRef(
    Date.now()
  );

  useEffect(() => {
    Store.allBookmarks().then((bm) =>
      setBookmarks(
        new Set(
          bm.map(
            (b) => b.question_id
          )
        )
      )
    );
  }, []);

  useEffect(() => {
    qStartRef.current = Date.now();
  }, [idx]);

  const q = session.questions[idx];
  const total = session.questions.length;
  const isLast = idx === total - 1;

  const response = responses[q.id];

  const currentAttempt =
    attemptsLog.find(
      (a) => a.question_id === q.id
    );

  const isRevealed =
    quizBehavior !== "assessment" &&
    !!revealed[q.id];

  function setResponse(
    val: QuestionResponse
  ) {
    setResponses((r) => ({
      ...r,
      [q.id]: val,
    }));
  }

  /**
   * Records the current question when using
   * assessment mode and navigating away from it.
   */
  async function recordAssessmentIfNeeded(
    forQuestion: Question,
    forResponse: QuestionResponse
  ): Promise<Attempt | null> {
    if (
      quizBehavior !== "assessment"
    ) {
      return null;
    }

    const existing =
      attemptsLog.find(
        (a) =>
          a.question_id ===
          forQuestion.id
      );

    if (existing) {
      return existing;
    }

    const timeTaken = Math.round(
      (Date.now() -
        qStartRef.current) /
        1000
    );

    const attempt =
      await Store.recordAttempt({
        question: forQuestion,
        quiz_session_id:
          sessionIdRef.current,
        selected_answers: forResponse,
        timeTakenSec: timeTaken,
      });

    setAttemptsLog((l) => [
      ...l,
      attempt,
    ]);

    return attempt;
  }

  /**
   * Records and reveals the current question
   * for Learn and Feedback modes.
   */
  async function checkAnswer(): Promise<
    Attempt | null
  > {
    if (
      quizBehavior === "assessment" ||
      revealed[q.id]
    ) {
      return currentAttempt ?? null;
    }

    const existing =
      attemptsLog.find(
        (a) =>
          a.question_id === q.id
      );

    if (existing) {
      setRevealed((r) => ({
        ...r,
        [q.id]: true,
      }));

      return existing;
    }

    const timeTaken = Math.round(
      (Date.now() -
        qStartRef.current) /
        1000
    );

    const attempt =
      await Store.recordAttempt({
        question: q,
        quiz_session_id:
          sessionIdRef.current,
        selected_answers: response,
        timeTakenSec: timeTaken,
      });

    setAttemptsLog((l) => [
      ...l,
      attempt,
    ]);

    setRevealed((r) => ({
      ...r,
      [q.id]: true,
    }));

    return attempt;
  }

  async function goTo(
    newIdx: number
  ) {
    if (
      newIdx < 0 ||
      newIdx >= total ||
      newIdx === idx
    ) {
      return;
    }

    await recordAssessmentIfNeeded(
      q,
      response
    );

    setIdx(newIdx);
  }

  function goPrev() {
    void goTo(idx - 1);
  }

  async function goNext() {
    /*
     * Learn:
     * First click checks the answer.
     * Second click moves to the next question.
     */
    if (quizBehavior === "learn") {
      if (!revealed[q.id]) {
        await checkAnswer();
        return;
      }

      if (isLast) {
        await finish();
        return;
      }

      setIdx((i) => i + 1);
      return;
    }

    /*
     * Feedback:
     * First click checks the answer.
     * Second click moves to the next question.
     */
    if (quizBehavior === "feedback") {
      if (!revealed[q.id]) {
        await checkAnswer();
        return;
      }

      if (isLast) {
        await finish();
        return;
      }

      setIdx((i) => i + 1);
      return;
    }

    /*
     * Assessment:
     * Navigation records the attempt but never
     * reveals correctness.
     */
    const newlyRecorded =
      await recordAssessmentIfNeeded(
        q,
        response
      );

    if (isLast) {
      await finish(
        newlyRecorded
          ? [
              ...attemptsLog,
              newlyRecorded,
            ]
          : attemptsLog
      );
      return;
    }

    setIdx((i) => i + 1);
  }

  async function submitAnswer() {
    if (
      quizBehavior !== "learn" ||
      revealed[q.id]
    ) {
      return;
    }

    await checkAnswer();
  }

  async function finish(
    finalAttempts: Attempt[] = attemptsLog
  ) {
    const correct =
      finalAttempts.filter(
        (a) =>
          a.result === "correct"
      ).length;

    const partial =
      finalAttempts.filter(
        (a) =>
          a.result === "partial"
      ).length;

    const incorrect =
      finalAttempts.filter(
        (a) =>
          a.result === "incorrect"
      ).length;

    const sessionRecord: QuizSession = {
      quiz_session_id:
        sessionIdRef.current,

      started_at:
        new Date(
          startTime
        ).toISOString(),

      completed_at: nowISO(),

      mode: session.mode,

      question_ids:
        session.questions.map(
          (qq) => qq.id
        ),

      total_questions: total,

      answered_questions:
        finalAttempts.length,

      correct_questions: correct,

      partial_questions: partial,

      incorrect_questions:
        incorrect,

      score: finalAttempts.length
        ? (correct +
            partial * 0.5) /
          finalAttempts.length
        : 0,

      duration: Math.round(
        (Date.now() -
          startTime) /
          1000
      ),
    };

    await db.quiz_sessions.put(
      sessionRecord
    );

    onFinish(
      sessionRecord,
      finalAttempts
    );
  }

  async function toggleBookmark() {
    await Store.toggleBookmark(
      q.id
    );

    const bm =
      await Store.allBookmarks();

    setBookmarks(
      new Set(
        bm.map(
          (b) => b.question_id
        )
      )
    );
  }

  async function flagQuestion() {
    const reason =
      window.prompt(
        "Flag reason (confusing / questionable / difficult / error / revisit):",
        "revisit"
      );

    if (reason) {
      await Store.addFlag(
        q.id,
        reason
      );
    }
  }

  /*
   * Global quiz keyboard controls.
   *
   * Left / Right:
   *   previous / next question
   *
   * Up / Down:
   *   move through visible answer options
   */
  useEffect(() => {
    function onKeyDown(
      e: KeyboardEvent
    ) {
      if (
        e.key !== "ArrowLeft" &&
        e.key !== "ArrowRight" &&
        e.key !== "ArrowUp" &&
        e.key !== "ArrowDown"
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (
        e.key === "ArrowLeft"
      ) {
        void goPrev();
        return;
      }

      if (
        e.key === "ArrowRight"
      ) {
        void goNext();
        return;
      }

      const optionElements =
        Array.from(
          document.querySelectorAll<HTMLElement>(
            `[data-question-options="${q.id}"] [data-question-option]`
          )
        );

      if (!optionElements.length) {
        return;
      }

      const activeElement =
        document.activeElement as HTMLElement | null;

      let currentIndex =
        optionElements.indexOf(
          activeElement as HTMLElement
        );

      if (currentIndex === -1) {
        currentIndex =
          e.key === "ArrowDown"
            ? -1
            : optionElements.length;
      }

      const nextIndex =
        e.key === "ArrowDown"
          ? Math.min(
              currentIndex + 1,
              optionElements.length - 1
            )
          : Math.max(
              currentIndex - 1,
              0
            );

      optionElements[
        nextIndex
      ]?.focus();
    }

    window.addEventListener(
      "keydown",
      onKeyDown,
      true
    );

    return () => {
      window.removeEventListener(
        "keydown",
        onKeyDown,
        true
      );
    };
  });

  const primaryLabel =
    quizBehavior === "learn"
      ? !isRevealed
        ? "Submit Answer"
        : isLast
          ? "Finish Quiz"
          : "Next →"
      : quizBehavior === "feedback"
        ? !isRevealed
          ? "Check Answer"
          : isLast
            ? "Finish Quiz"
            : "Next →"
        : isLast
          ? "Finish Quiz"
          : "Next →";

  const modeDescription =
    quizBehavior === "learn"
      ? "Submit each answer and study the explanation."
      : quizBehavior === "feedback"
        ? "Check correctness before moving on."
        : "Complete the quiz without feedback until the end.";

  return (
    <div className="fade-in flex gap-5 items-start">
      <div className="flex-1 max-w-3xl min-w-0">
        <div className="flex items-center gap-3 mb-3.5">
          <button
            className="btn btn-sm"
            disabled={idx === 0}
            onClick={goPrev}
            title="Previous (←)"
          >
            ← Prev
          </button>

          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] text-textMuted text-center mb-1">
              Question {idx + 1} /{" "}
              {total}
            </div>

            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: `${
                    ((idx + 1) /
                      total) *
                    100
                  }%`,
                  background:
                    "#4FA3E3",
                }}
              />
            </div>
          </div>

          <button
            className="btn btn-sm"
            onClick={
              toggleBookmark
            }
            title="Bookmark"
          >
            {bookmarks.has(q.id)
              ? "★"
              : "☆"}
          </button>

          <button
            className="btn btn-sm"
            onClick={
              flagQuestion
            }
            title="Flag"
          >
            ⚑
          </button>

          <button
            className="btn btn-sm"
            onClick={() =>
              setQueueOpen(
                (o) => !o
              )
            }
            title="Toggle question queue"
          >
            ▤ Queue
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={() =>
              void goNext()
            }
            title="Next (→)"
          >
            {primaryLabel}
          </button>
        </div>

        <div className="card p-3.5 mb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <div className="label mb-1">
                Quiz Mode
              </div>

              <select
                className="input"
                value={quizBehavior}
                onChange={(e) =>
                  setQuizBehavior(
                    e.target
                      .value as QuizBehavior
                  )
                }
              >
                <option value="learn">
                  Learn
                </option>

                <option value="feedback">
                  Feedback
                </option>

                <option value="assessment">
                  Assessment
                </option>
              </select>
            </div>

            <button
              className="btn"
              type="button"
              onClick={() =>
                setShowExplanation(
                  (v) => !v
                )
              }
              style={{
                marginTop: 18,
              }}
            >
              Explanation:{" "}
              {showExplanation
                ? "ON"
                : "OFF"}
            </button>

            <div className="text-[11.5px] text-textMuted flex-1 min-w-[220px]">
              {modeDescription}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-2.5 flex-wrap">
          <span className="pill bg-surface2 text-textMuted">
            {q.category}
          </span>

          {q.subcategory && (
            <span className="pill bg-surface2 text-textMuted">
              {q.subcategory}
            </span>
          )}

          <span className="pill bg-surface2 text-textMuted">
            {q.topic}
          </span>

          <TypeBadge
            type={q.question_type}
          />

          <DifficultyBadge
            difficulty={q.difficulty}
          />

          {q.question_type ===
            "best_answer" && (
            <span className="pill bg-accentDim text-accent">
              Best Answer
            </span>
          )}
        </div>

        <div className="card p-5">
          <div className="text-[15.5px] leading-relaxed mb-1.5">
            {q.question.text}
          </div>

          {q.question.code && (
            <QuestionRendererCode
              code={q.question.code}
              tags={q.tags}
            />
          )}

          <div className="mt-4">
            <QuestionRenderer
              question={q}
              response={response}
              setResponse={
                setResponse
              }
              disabled={isRevealed}
            />
          </div>

          {quizBehavior ===
            "learn" &&
            !isRevealed && (
              <button
                className="btn btn-primary mt-4.5"
                onClick={
                  submitAnswer
                }
              >
                Submit Answer
              </button>
            )}

          {quizBehavior ===
            "feedback" &&
            !isRevealed && (
              <button
                className="btn btn-primary mt-4.5"
                onClick={() =>
                  void checkAnswer()
                }
              >
                Check Answer
              </button>
            )}

          {isRevealed &&
            currentAttempt && (
              <AnswerReview
                question={q}
                attempt={
                  currentAttempt
                }
                showExplanation={
                  showExplanation
                }
              />
            )}
        </div>
      </div>

      {queueOpen && (
        <div className="card p-3.5 w-[300px] shrink-0 sticky top-0">
          <div className="flex justify-between items-center mb-3">
            <div className="text-[13px] font-bold">
              Queue
            </div>

            <button
              className="btn btn-sm"
              onClick={() =>
                setQueueOpen(false)
              }
            >
              ✕
            </button>
          </div>

          <div
            className="grid gap-1.5"
            style={{
              gridTemplateColumns:
                "repeat(auto-fill, minmax(36px, 1fr))",
            }}
          >
            {session.questions.map(
              (qq, i) => {
                const a =
                  attemptsLog.find(
                    (att) =>
                      att.question_id ===
                      qq.id
                  );

                const isCurrent =
                  i === idx;

                const colors =
                  a
                    ? RESULT_COLOR[
                        quizBehavior ===
                          "assessment"
                          ? "unanswered"
                          : a.result
                      ]
                    : RESULT_COLOR.unanswered;

                return (
                  <button
                    key={qq.id}
                    onClick={() =>
                      void goTo(i)
                    }
                    title={`Question ${
                      i + 1
                    }${
                      a &&
                      quizBehavior !==
                        "assessment"
                        ? ` — ${a.result}`
                        : ""
                    }`}
                    className="relative h-9 rounded-md text-[11px] font-mono flex items-center justify-center text-text"
                    style={{
                      background:
                        colors.bg,

                      border: `1.5px solid ${
                        isCurrent
                          ? "#4FA3E3"
                          : colors.border
                      }`,

                      boxShadow:
                        isCurrent
                          ? "0 0 0 1px #4FA3E3"
                          : "none",
                    }}
                  >
                    {i + 1}

                    {bookmarks.has(
                      qq.id
                    ) && (
                      <span
                        className="absolute top-0 right-0.5 text-[8px]"
                        style={{
                          color:
                            "#E0A63E",
                        }}
                      >
                        ★
                      </span>
                    )}
                  </button>
                );
              }
            )}
          </div>

          <div className="flex gap-3 text-[11px] text-textMuted mt-3 flex-wrap">
            <LegendDot
              color={
                RESULT_COLOR.correct
                  .border
              }
              label="Correct"
            />

            <LegendDot
              color={
                RESULT_COLOR.incorrect
                  .border
              }
              label="Incorrect"
            />

            <LegendDot
              color={
                RESULT_COLOR.partial
                  .border
              }
              label="Partial"
            />

            <LegendDot
              color={
                RESULT_COLOR.unanswered
                  .border
              }
              label="Unattempted"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function LegendDot({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1">
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{
          background: color,
        }}
      />
      {label}
    </span>
  );
}

function QuestionRendererCode({
  code,
  tags,
}: {
  code: string;
  tags?: string[];
}) {
  const language = tags?.includes(
    "python"
  )
    ? "python"
    : "sql";

  return (
    <CodeBlock
      code={code}
      language={language}
    />
  );
}