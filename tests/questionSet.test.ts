import { describe, it, expect } from "vitest";

import { buildQuestionSet } from "@/services/questionSet";

describe("buildQuestionSet", () => {
  it("preserves the given name and question order", () => {
    const set = buildQuestionSet(
      "Snowflake Batch 1",
      ["Q1", "Q2", "Q3"],
      "set_1",
      "2026-08-27T00:00:00.000Z"
    );

    expect(set.name).toBe("Snowflake Batch 1");
    expect(set.question_ids).toEqual(["Q1", "Q2", "Q3"]);
    expect(set.count).toBe(3);
    expect(set.id).toBe("set_1");
  });

  it("falls back to a dated default name when given a blank name", () => {
    const set = buildQuestionSet(
      "   ",
      ["Q1"],
      "set_2",
      "2026-08-27T00:00:00.000Z"
    );

    expect(set.name).toMatch(/^Import /);
  });

  it("count always matches the number of question ids", () => {
    const set = buildQuestionSet(
      "Any",
      ["Q1", "Q2", "Q3", "Q4"],
      "set_3",
      "2026-08-27T00:00:00.000Z"
    );

    expect(set.count).toBe(set.question_ids.length);
  });
});