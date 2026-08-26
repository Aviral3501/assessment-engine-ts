import { describe, it, expect } from "vitest";
import { validateQuestion, analyzeImportFile } from "@/services/validation";
import { DEMO_QUESTIONS } from "@/data/demoQuestions";

describe("validateQuestion", () => {
  it("accepts a well-formed question with 0 errors", () => {
    const errors = validateQuestion(DEMO_QUESTIONS[0], 0);
    expect(errors).toHaveLength(0);
  });

  it("rejects an unsupported question_type", () => {
    const bad = { ...DEMO_QUESTIONS[0], question_type: "single" };
    const errors = validateQuestion(bad, 0);
    expect(errors.some((e) => e.field === "question_type")).toBe(true);
  });

  it("rejects an out-of-range difficulty", () => {
    const bad = { ...DEMO_QUESTIONS[0], difficulty: 9 };
    const errors = validateQuestion(bad, 0);
    expect(errors.some((e) => e.field === "difficulty")).toBe(true);
  });

  it("rejects single_choice with more than one correct option", () => {
    const bad = {
      ...DEMO_QUESTIONS[0],
      options: DEMO_QUESTIONS[0].options!.map((o, i) => ({ ...o, is_correct: i < 2 })),
    };
    const errors = validateQuestion(bad, 0);
    expect(errors.some((e) => e.field === "options")).toBe(true);
  });

  it("rejects multiple_choice with zero correct options", () => {
    const bad = {
      ...DEMO_QUESTIONS[1],
      options: DEMO_QUESTIONS[1].options!.map((o) => ({ ...o, is_correct: false })),
    };
    const errors = validateQuestion(bad, 0);
    expect(errors.some((e) => e.field === "options")).toBe(true);
  });

  it("requires at least 2 options for choice-based types", () => {
    const bad = { ...DEMO_QUESTIONS[0], options: [{ id: "a", text: "only one", is_correct: true }] };
    const errors = validateQuestion(bad, 0);
    expect(errors.some((e) => e.field === "options")).toBe(true);
  });
});

describe("analyzeImportFile", () => {
  it("splits valid and invalid rows", () => {
    const bad = { id: "BAD-1", category: "X", topic: "Y", question_type: "single", difficulty: 2, question: { text: "t" } };
    const { valid, invalid } = analyzeImportFile([...DEMO_QUESTIONS, bad]);
    expect(valid).toHaveLength(DEMO_QUESTIONS.length);
    expect(invalid).toHaveLength(1);
  });

  it("detects duplicate ids within the same file", () => {
    const { dupInFile } = analyzeImportFile([DEMO_QUESTIONS[0], DEMO_QUESTIONS[0]]);
    expect(dupInFile).toHaveLength(1);
  });

  it("does not silently drop or repair invalid data", () => {
    const bad = { id: "BAD-2", category: "X", topic: "Y", question_type: "numerical", difficulty: 2, question: { text: "t" } };
    const { valid, invalid } = analyzeImportFile([bad]);
    expect(valid).toHaveLength(0);
    expect(invalid[0].question).toEqual(bad); // original object preserved, untouched
  });
});
