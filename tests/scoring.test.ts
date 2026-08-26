import { describe, it, expect } from "vitest";
import { scoreAttempt } from "@/services/scoring";
import type { Question } from "@/types/question";

const base: Omit<Question, "question_type" | "options"> = {
  id: "Q1",
  category: "Snowflake",
  subcategory: "Architecture",
  topic: "Warehouses",
  difficulty: 2,
  question: { text: "Sample?" },
};

describe("scoreAttempt — single_choice", () => {
  const q: Question = {
    ...base,
    question_type: "single_choice",
    options: [
      { id: "a", text: "Right", is_correct: true },
      { id: "b", text: "Wrong", is_correct: false },
    ],
  };
  it("marks the correct option as correct", () => {
    expect(scoreAttempt(q, "a").result).toBe("correct");
  });
  it("marks the wrong option as incorrect", () => {
    expect(scoreAttempt(q, "b").result).toBe("incorrect");
  });
  it("marks no answer as unanswered", () => {
    expect(scoreAttempt(q, null).result).toBe("unanswered");
  });
});

describe("scoreAttempt — multiple_choice (partial credit)", () => {
  const q: Question = {
    ...base,
    question_type: "multiple_choice",
    options: [
      { id: "a", text: "1", is_correct: true },
      { id: "b", text: "2", is_correct: true },
      { id: "c", text: "3", is_correct: false },
    ],
  };
  it("all correct options selected -> correct", () => {
    expect(scoreAttempt(q, ["a", "b"]).result).toBe("correct");
  });
  it("some correct options selected -> partial", () => {
    expect(scoreAttempt(q, ["a"]).result).toBe("partial");
  });
  it("only incorrect option selected -> incorrect", () => {
    expect(scoreAttempt(q, ["c"]).result).toBe("incorrect");
  });
  it("1 correct + 1 incorrect selected nets to incorrect (fraction 0)", () => {
    const r = scoreAttempt(q, ["a", "c"]);
    expect(r.result).toBe("incorrect");
    expect(r.score).toBe(0);
  });
});

describe("scoreAttempt — true_false", () => {
  const q: Question = {
    ...base,
    question_type: "true_false",
    options: [
      { id: "true", text: "True", is_correct: true },
      { id: "false", text: "False", is_correct: false },
    ],
  };
  it("correct boolean choice scores correct", () => {
    expect(scoreAttempt(q, "true").result).toBe("correct");
  });
});

describe("scoreAttempt — numerical", () => {
  const q: Question = { ...base, question_type: "numerical", numerical_answer: 42, tolerance: 1, options: [] };
  it("exact match is correct", () => {
    expect(scoreAttempt(q, 42).result).toBe("correct");
  });
  it("within tolerance is correct", () => {
    expect(scoreAttempt(q, 43).result).toBe("correct");
  });
  it("outside tolerance is incorrect", () => {
    expect(scoreAttempt(q, 45).result).toBe("incorrect");
  });
});

describe("scoreAttempt — short_answer", () => {
  const q: Question = { ...base, question_type: "short_answer", accepted_answers: ["clustering key"], options: [] };
  it("is case/whitespace insensitive", () => {
    expect(scoreAttempt(q, "  Clustering Key ").result).toBe("correct");
  });
  it("rejects a wrong answer", () => {
    expect(scoreAttempt(q, "wrong").result).toBe("incorrect");
  });
});

describe("scoreAttempt — ordering", () => {
  const q: Question = {
    ...base,
    question_type: "ordering",
    options: [
      { id: "a", text: "First", is_correct: false, correct_position: 0 },
      { id: "b", text: "Second", is_correct: false, correct_position: 1 },
      { id: "c", text: "Third", is_correct: false, correct_position: 2 },
    ],
  };
  it("exact order is correct", () => {
    expect(scoreAttempt(q, ["a", "b", "c"]).result).toBe("correct");
  });
  it("partially correct order gives partial credit", () => {
    const r = scoreAttempt(q, ["a", "c", "b"]);
    expect(r.result).toBe("partial");
    expect(r.score).toBeCloseTo(1 / 3);
  });
});

describe("scoreAttempt — matching", () => {
  const q: Question = {
    ...base,
    question_type: "matching",
    matching_pairs: [
      { left: "table", right: "full rebuild" },
      { left: "incremental", right: "append/merge" },
    ],
  };
  it("all correct pairs -> correct", () => {
    expect(scoreAttempt(q, { table: "full rebuild", incremental: "append/merge" }).result).toBe("correct");
  });
  it("half correct pairs -> partial", () => {
    expect(scoreAttempt(q, { table: "full rebuild", incremental: "wrong" }).result).toBe("partial");
  });
});
