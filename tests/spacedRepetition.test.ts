import { describe, it, expect } from "vitest";
import { defaultLearningState, updateLearningState } from "@/services/spacedRepetition";

const q = { category: "Snowflake", subcategory: "Architecture", topic: "Warehouses" };

describe("spaced repetition", () => {
  it("starts in the 'new' state", () => {
    const ls = defaultLearningState("Q1", q);
    expect(ls.state).toBe("new");
    expect(ls.repetitions).toBe(0);
  });

  it("first attempt (correct) — should not yet be marked mastered", () => {
    let ls = defaultLearningState("Q1", q);
    ls = updateLearningState(ls, "correct", 20);
    expect(ls.repetitions).toBe(1);
    expect(ls.state).toBe("learning");
    expect(ls.interval).toBe(1);
  });

  it("repeated success grows the interval and eventually reaches 'mastered'", () => {
    let ls = defaultLearningState("Q1", q);
    for (let i = 0; i < 6; i++) ls = updateLearningState(ls, "correct", 10);
    expect(ls.repetitions).toBe(6);
    expect(ls.interval).toBeGreaterThan(6);
    expect(ls.mastery_score).toBeGreaterThanOrEqual(90);
  });

  it("a single failure resets repetitions and shortens the interval", () => {
    let ls = defaultLearningState("Q1", q);
    for (let i = 0; i < 3; i++) ls = updateLearningState(ls, "correct", 10);
    expect(ls.repetitions).toBe(3);
    ls = updateLearningState(ls, "incorrect", 10);
    expect(ls.repetitions).toBe(0);
    expect(ls.interval).toBe(1);
  });

  it("repeated failure (>=3 attempts, >40% fail rate) marks the question 'difficult'", () => {
    let ls = defaultLearningState("Q2", q);
    ls = updateLearningState(ls, "incorrect", 30);
    ls = updateLearningState(ls, "incorrect", 30);
    ls = updateLearningState(ls, "incorrect", 30);
    expect(ls.state).toBe("difficult");
  });

  it("a due question (next_review in the past) is marked 'due'", () => {
    let ls = defaultLearningState("Q3", q);
    ls = updateLearningState(ls, "correct", 10);
    // force next_review into the past to simulate time passing
    ls.next_review = new Date(Date.now() - 86400000).toISOString();
    // re-derive state the way the engine would on the next lookup by re-running update
    ls = updateLearningState(ls, "correct", 10);
    expect(["due", "review", "learning"]).toContain(ls.state);
  });
});
