import { useEffect, useMemo, useState } from "react";
import type { Question } from "@/types/question";
import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  QUESTION_TYPES,
} from "@/types/question";
import type {
  AnswerRevealMode,
  QuizMode,
} from "@/types/attempt";
import type { QuestionSet } from "@/types/questionSet";
import { Store } from "@/services/store";
import {
  buildAnalytics,
  weaknessEngine,
} from "@/services/analytics";
import { shuffle } from "@/utils/id";
import type { QuizSetup } from "./QuizRunner";

interface ModeDef {
  key: QuizMode;
  label: string;
  desc: string;
}

function shuffleQuestionOptions(question: Question): Question {
  if (
    !question.options ||
    question.options.length < 2
  ) {
    return question;
  }

  return {
    ...question,
    options: shuffle(question.options),
  };
}

function shuffleWithPositionBalance(
  questions: Question[]
): Question[] {
  const positions = ["A", "B", "C", "D"];

  // Track how many times each position has been used.
  const counts: Record<string, number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
  };

  return questions.map((question, questionIndex) => {
    const options = question.options;

    // No usable options → leave untouched.
    if (!options || options.length < 2) {
      return question;
    }

    // Only balance normal single-correct option questions.
    if (
      question.question_type !== "single_choice" &&
      question.question_type !== "best_answer" &&
      question.question_type !== "scenario" &&
      question.question_type !== "code_output" &&
      question.question_type !== "code_completion"
    ) {
      return question;
    }

    const correct = options.filter(
      (option) => option.is_correct
    );

    const incorrect = options.filter(
      (option) => !option.is_correct
    );

    if (correct.length !== 1) {
      return question;
    }

    /*
     * Give underused positions higher probability.
     *
     * This is deliberately NOT exact balancing.
     * The slight randomness means a quiz can naturally end up
     * 6/5/4/5, 7/4/5/4, etc. instead of always 5/5/5/5.
     */
    const weightedPositions = positions.map(
      (position) => {
        const usage = counts[position];

        // Higher weight for less-used positions.
        // The floor keeps every position possible.
        const weight =
          1 / (1 + usage * 0.65);

        return {
          position,
          weight,
        };
      }
    );

    /*
     * Avoid obvious consecutive repeats.
     * We make the immediately previous position less likely,
     * but do not make it impossible.
     */
    const previousPosition =
      questionIndex > 0
        ? positions.find(
            (p) =>
              counts[p] ===
              Math.max(...Object.values(counts))
          )
        : undefined;

    if (previousPosition) {
      const previous =
        weightedPositions.find(
          (p) =>
            p.position ===
            previousPosition
        );

      if (previous) {
        previous.weight *= 0.35;
      }
    }

    // Weighted random selection.
    const totalWeight =
      weightedPositions.reduce(
        (sum, item) =>
          sum + item.weight,
        0
      );

    let random =
      Math.random() * totalWeight;

    let targetPosition =
      positions[0];

    for (const item of weightedPositions) {
      random -= item.weight;

      if (random <= 0) {
        targetPosition = item.position;
        break;
      }
    }

    counts[targetPosition]++;

    const targetIndex =
      positions.indexOf(
        targetPosition
      );

    // Shuffle incorrect answers normally.
    const shuffledIncorrect =
      incorrect.slice();

    for (
      let i =
        shuffledIncorrect.length - 1;
      i > 0;
      i--
    ) {
      const j = Math.floor(
        Math.random() * (i + 1)
      );

      [
        shuffledIncorrect[i],
        shuffledIncorrect[j],
      ] = [
        shuffledIncorrect[j],
        shuffledIncorrect[i],
      ];
    }

    // Insert the correct option into the chosen
    // visual position.
    const shuffledOptions =
      shuffledIncorrect.slice();

    shuffledOptions.splice(
      Math.min(
        targetIndex,
        shuffledOptions.length
      ),
      0,
      correct[0]
    );

    return {
      ...question,
      options: shuffledOptions,
    };
  });
}
const QUIZ_MODES: ModeDef[] = [
  {
    key: "quick",
    label: "Quick Quiz",
    desc: "Choose a question count and go.",
  },
  {
    key: "topic",
    label: "Topic Quiz",
    desc: "Practice one specific topic.",
  },
  {
    key: "custom",
    label: "Custom Quiz",
    desc: "Filter by any combination of criteria.",
  },
  {
    key: "daily",
    label: "Daily Quiz",
    desc: "Adaptive selection from covered topics.",
  },
  {
    key: "set",
    label: "Question Set",
    desc: "Solve one uploaded batch, in its original order.",
  },
  {
    key: "mistakes",
    label: "Mistake Quiz",
    desc: "Previously incorrect or partial questions.",
  },
  {
    key: "due",
    label: "Due Today",
    desc: "Questions due for spaced-repetition review.",
  },
  {
    key: "unattempted",
    label: "Unattempted",
    desc: "Questions you haven't tried yet.",
  },
  {
    key: "bookmarked",
    label: "Bookmarked",
    desc: "Your saved questions.",
  },
  {
    key: "random",
    label: "Random",
    desc: "Pure random from the full bank.",
  },
  {
    key: "weak",
    label: "Weak Areas",
    desc: "Auto-generated from your weakest topics.",
  },
];

export function QuizSetupPage({
  onStart,
}: {
  onStart: (setup: QuizSetup) => void;
}) {
  const [mode, setMode] =
    useState<QuizMode>("quick");

  const [count, setCount] =
    useState(20);

  const [category, setCategory] =
    useState("");

  const [topic, setTopic] =
    useState("");

  const [difficulty, setDifficulty] =
    useState("");

  const [qtype, setQtype] =
    useState("");

  const [revealMode, setRevealMode] =
    useState<AnswerRevealMode>("immediate");

  const [questions, setQuestions] =
    useState<Question[]>([]);

  const [sets, setSets] =
    useState<QuestionSet[]>([]);

  const [selectedSetId, setSelectedSetId] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  useEffect(() => {
    Store.allQuestions().then(setQuestions);

    Store.allQuestionSets().then((s) => {
      setSets(s);

      setSelectedSetId(
        (prev) =>
          prev ||
          (s.length ? s[0].id : "")
      );
    });
  }, []);

  const categories = useMemo(
    () =>
      [
        ...new Set(
          questions.map((q) => q.category)
        ),
      ],
    [questions]
  );

  const topicOptions = useMemo(
    () =>
      [
        ...new Set(
          questions
            .filter(
              (q) =>
                !category ||
                q.category === category
            )
            .map((q) => q.topic)
        ),
      ],
    [questions, category]
  );

  async function start() {
    setBusy(true);

    let selected: Question[] = [];

    const [
      attempts,
      learningStates,
      bookmarks,
    ] = await Promise.all([
      Store.allAttempts(),
      Store.allLearningStates(),
      Store.allBookmarks(),
    ]);

    const lsMap = new Map(
      learningStates.map((l) => [
        l.question_id,
        l,
      ])
    );

    const bookmarkIds = new Set(
      bookmarks.map((b) => b.question_id)
    );

    const attemptedIds = new Set(
      attempts.map((a) => a.question_id)
    );

    const incorrectIds = new Set(
      attempts
        .filter(
          (a) =>
            a.result === "incorrect" ||
            a.result === "partial"
        )
        .map((a) => a.question_id)
    );

    if (
      mode === "quick" ||
      mode === "random"
    ) {
      selected = shuffle(
        questions
      ).slice(0, count);
    } else if (mode === "topic") {
      selected = shuffle(
        questions.filter(
          (q) =>
            (!category ||
              q.category === category) &&
            (!topic ||
              q.topic === topic)
        )
      ).slice(0, count);
    } else if (mode === "custom") {
      selected = shuffle(
        questions.filter(
          (q) =>
            (!category ||
              q.category === category) &&
            (!topic ||
              q.topic === topic) &&
            (!difficulty ||
              String(q.difficulty) ===
                difficulty) &&
            (!qtype ||
              q.question_type === qtype)
        )
      ).slice(0, count);
    } else if (mode === "daily") {
      selected =
        await Store.buildDailyQuiz(count);
    } else if (mode === "set") {
      if (selectedSetId) {
        selected =
          await Store.getQuestionsForSet(
            selectedSetId
          );
      }
    } else if (mode === "mistakes") {
      selected = shuffle(
        questions.filter((q) =>
          incorrectIds.has(q.id)
        )
      ).slice(0, count);
    } else if (mode === "due") {
      selected = shuffle(
        questions.filter(
          (q) =>
            lsMap.get(q.id)?.state === "due"
        )
      ).slice(0, count);
    } else if (mode === "unattempted") {
      selected = shuffle(
        questions.filter(
          (q) => !attemptedIds.has(q.id)
        )
      ).slice(0, count);
    } else if (mode === "bookmarked") {
      selected = shuffle(
        questions.filter((q) =>
          bookmarkIds.has(q.id)
        )
      ).slice(0, count);
    } else if (mode === "weak") {
      const analytics = buildAnalytics(
        attempts,
        learningStates,
        questions
      );

      const weakTopics =
        weaknessEngine(
          analytics.byTopic
        );

      selected = shuffle(
        questions.filter((q) =>
          weakTopics.some(
            (t) =>
              t.key ===
              `${q.category} / ${q.topic}`
          )
        )
      ).slice(0, count);

      if (!selected.length) {
        selected = shuffle(
          questions
        ).slice(0, count);
      }
    }

    setBusy(false);

    if (!selected.length) {
      window.alert(
        "No questions matched this configuration."
      );
      return;
    }

const randomizedQuestions =
  shuffleWithPositionBalance(selected);

onStart({
  mode,
  questions: randomizedQuestions,
  revealMode,
});

}

  return (
    <div className="fade-in max-w-3xl">
      <div className="text-lg font-bold mb-3.5">
        Start a Quiz
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-5">
        {QUIZ_MODES.map((m) => (
          <button
            key={m.key}
            onClick={() =>
              setMode(m.key)
            }
            className="card text-left p-3.5 cursor-pointer"
            style={{
              borderColor:
                mode === m.key
                  ? "#4FA3E3"
                  : "#202A31",
              background:
                mode === m.key
                  ? "#1C242B"
                  : "#161C21",
            }}
          >
            <div className="text-[13.5px] font-bold mb-0.5">
              {m.label}
            </div>

            <div className="text-[11.5px] text-textMuted">
              {m.desc}
            </div>
          </button>
        ))}
      </div>

      <div className="card p-4 mb-4">
        <div className="text-[13px] font-bold mb-3">
          Configuration
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {mode !== "daily" &&
            mode !== "set" && (
              <div>
                <div className="label mb-1">
                  Question Count
                </div>

                <select
                  className="input"
                  value={count}
                  onChange={(e) =>
                    setCount(
                      Number(e.target.value)
                    )
                  }
                >
                  {[
                    5,
                    10,
                    20,
                    30,
                    50,
                    100,
                  ].map((n) => (
                    <option
                      key={n}
                      value={n}
                    >
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            )}

          {mode === "daily" && (
            <div>
              <div className="label mb-1">
                Daily Question Count
              </div>

              <select
                className="input"
                value={count}
                onChange={(e) =>
                  setCount(
                    Number(e.target.value)
                  )
                }
              >
                {[10, 20, 30, 50].map(
                  (n) => (
                    <option
                      key={n}
                      value={n}
                    >
                      {n}
                    </option>
                  )
                )}
              </select>
            </div>
          )}

          {mode === "set" && (
            <div className="col-span-2">
              <div className="label mb-1">
                Set
              </div>

              {sets.length === 0 ? (
                <div className="text-[13px] text-textMuted">
                  No sets yet — import a question bank first.
                </div>
              ) : (
                <select
                  className="input"
                  value={selectedSetId}
                  onChange={(e) =>
                    setSelectedSetId(
                      e.target.value
                    )
                  }
                >
                  {sets.map((s) => (
                    <option
                      key={s.id}
                      value={s.id}
                    >
                      {s.name} ({s.count})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {(mode === "topic" ||
            mode === "custom") && (
            <div>
              <div className="label mb-1">
                Category
              </div>

              <select
                className="input"
                value={category}
                onChange={(e) => {
                  setCategory(
                    e.target.value
                  );
                  setTopic("");
                }}
              >
                <option value="">
                  Any
                </option>

                {categories.map((c) => (
                  <option
                    key={c}
                    value={c}
                  >
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(mode === "topic" ||
            mode === "custom") && (
            <div>
              <div className="label mb-1">
                Topic
              </div>

              <select
                className="input"
                value={topic}
                onChange={(e) =>
                  setTopic(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Any
                </option>

                {topicOptions.map((t) => (
                  <option
                    key={t}
                    value={t}
                  >
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode === "custom" && (
            <div>
              <div className="label mb-1">
                Difficulty
              </div>

              <select
                className="input"
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Any
                </option>

                {DIFFICULTIES.map(
                  (d) => (
                    <option
                      key={d}
                      value={d}
                    >
                      {DIFFICULTY_LABEL[d]}
                    </option>
                  )
                )}
              </select>
            </div>
          )}

          {mode === "custom" && (
            <div>
              <div className="label mb-1">
                Question Type
              </div>

              <select
                className="input"
                value={qtype}
                onChange={(e) =>
                  setQtype(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Any
                </option>

                {QUESTION_TYPES.map(
                  (t) => (
                    <option
                      key={t}
                      value={t}
                    >
                      {t}
                    </option>
                  )
                )}
              </select>
            </div>
          )}

          <div>
            <div className="label mb-1">
              Answer Reveal
            </div>

            <select
              className="input"
              value={revealMode}
              onChange={(e) =>
                setRevealMode(
                  e.target
                    .value as AnswerRevealMode
                )
              }
            >
              <option value="immediate">
                Immediate feedback
              </option>

              <option value="end">
                End of quiz
              </option>
            </select>
          </div>
        </div>
      </div>

      <button
        className="btn btn-primary px-5.5 py-2.5"
        disabled={busy}
        onClick={start}
      >
        {busy
          ? "Building…"
          : "Start Quiz →"}
      </button>
    </div>
  );
}