import { describe, it, expect } from "vitest";
import { selectDailyQuiz } from "@/services/dailyQuiz";
import { defaultLearningState, updateLearningState } from "@/services/spacedRepetition";
import type { Question } from "@/types/question";
import type { Topic } from "@/types/topic";

function makeQuestion(id: string, category: string, topic: string): Question {
  return {
    id,
    category,
    subcategory: "Sub",
    topic,
    question_type: "single_choice",
    difficulty: 2,
    question: { text: `Question ${id}` },
    options: [
      { id: "a", text: "Right", is_correct: true },
      { id: "b", text: "Wrong", is_correct: false },
    ],
  };
}

describe("selectDailyQuiz", () => {
  it("never includes questions from a topic marked 'Not Started'", () => {
    const covered = makeQuestion("Q1", "Snowflake", "Covered Topic");
    const notStarted = makeQuestion("Q2", "Snowflake", "Untouched Topic");
    const topics: Topic[] = [
      { topicKey: "Snowflake::Sub::Covered Topic", category: "Snowflake", subcategory: "Sub", topic: "Covered Topic", status: "Covered" },
      { topicKey: "Snowflake::Sub::Untouched Topic", category: "Snowflake", subcategory: "Sub", topic: "Untouched Topic", status: "Not Started" },
    ];
    const result = selectDailyQuiz([covered, notStarted], [], topics, 10);
    expect(result.every((q) => q.id !== "Q2")).toBe(true);
  });

  it("returns no duplicate questions within a single session", () => {
    const questions = Array.from({ length: 20 }, (_, i) => makeQuestion(`Q${i}`, "Snowflake", "Topic A"));
    const topics: Topic[] = [{ topicKey: "Snowflake::Sub::Topic A", category: "Snowflake", subcategory: "Sub", topic: "Topic A", status: "Covered" }];
    const result = selectDailyQuiz(questions, [], topics, 15);
    const ids = new Set(result.map((q) => q.id));
    expect(ids.size).toBe(result.length);
  });

  it("prioritizes due questions over untouched ones", () => {
    const dueQ = makeQuestion("DUE1", "Snowflake", "Topic A");
    const untouchedQs = Array.from({ length: 10 }, (_, i) => makeQuestion(`U${i}`, "Snowflake", "Topic A"));
    const topics: Topic[] = [{ topicKey: "Snowflake::Sub::Topic A", category: "Snowflake", subcategory: "Sub", topic: "Topic A", status: "Covered" }];

    let dueState = defaultLearningState("DUE1", dueQ);
    dueState = updateLearningState(dueState, "incorrect", 10);
    dueState.next_review = new Date(Date.now() - 86400000).toISOString();
    dueState.state = "due";

    const result = selectDailyQuiz([dueQ, ...untouchedQs], [dueState], topics, 3);
    expect(result.some((q) => q.id === "DUE1")).toBe(true);
  });

  it("returns an empty array when no topics are covered", () => {
    const questions = [makeQuestion("Q1", "Snowflake", "Topic A")];
    const topics: Topic[] = [{ topicKey: "Snowflake::Sub::Topic A", category: "Snowflake", subcategory: "Sub", topic: "Topic A", status: "Studying" }];
    const result = selectDailyQuiz(questions, [], topics, 10);
    expect(result).toHaveLength(0);
  });
});
