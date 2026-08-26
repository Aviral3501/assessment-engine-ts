import { z } from "zod";
import { QUESTION_TYPES, type Question } from "@/types/question";

const optionSchema = z.object({
  id: z.union([z.string(), z.number()]),
  text: z.string().min(1, "option text is required"),
  is_correct: z.boolean(),
  explanation: z.string().optional(),
  correct_position: z.number().optional(),
});

const questionBodySchema = z.object({
  text: z.string().min(1, "question text is required"),
  code: z.string().nullable().optional(),
});

const learningSchema = z
  .object({
    summary: z.string().optional(),
    key_concept: z.string().optional(),
    common_trap: z.string().optional(),
    exam_tip: z.string().optional(),
    misconception: z.string().optional(),
  })
  .optional();

const relevanceSchema = z
  .object({
    snowflake_certification: z.boolean().optional(),
    ibm_assessment: z.boolean().optional(),
    general_data_engineering: z.boolean().optional(),
  })
  .optional();

const sourceSchema = z
  .object({
    type: z.string().optional(),
    reference: z.string().optional(),
  })
  .optional();

/** Base structural schema — does not yet enforce type-specific option-count rules. */
export const questionSchema = z.object({
  id: z.string().min(1, "id is required"),
  category: z.string().min(1, "category is required"),
  subcategory: z.string().optional(),
  topic: z.string().min(1, "topic is required"),
  tags: z.array(z.string()).optional(),
  question_type: z.enum(QUESTION_TYPES, {
    errorMap: () => ({ message: `must be one of: ${QUESTION_TYPES.join(", ")}` }),
  }),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  question: questionBodySchema,
  options: z.array(optionSchema).optional(),
  learning: learningSchema,
  relevance: relevanceSchema,
  source: sourceSchema,
  matching_pairs: z.array(z.object({ left: z.string(), right: z.string(), options: z.array(z.string()).optional() })).optional(),
  accepted_answers: z.array(z.string()).optional(),
  numerical_answer: z.number().optional(),
  tolerance: z.number().optional(),
});

export interface ValidationError {
  id: string;
  field: string;
  reason: string;
}

const OPTIONS_NOT_REQUIRED: readonly string[] = ["short_answer", "numerical"];

/**
 * Validates a single raw question object. Returns a list of field-level
 * errors (empty = valid). Never mutates the input and never silently
 * repairs it — invalid data must surface, not disappear (spec §39, §42).
 */
export function validateQuestion(raw: unknown, index: number): ValidationError[] {
  const idGuess = (raw && typeof raw === "object" && "id" in raw && typeof (raw as any).id === "string")
    ? (raw as any).id
    : `(row ${index})`;

  const structural = questionSchema.safeParse(raw);
  if (!structural.success) {
    return structural.error.issues.map((issue) => ({
      id: idGuess,
      field: issue.path.join(".") || "(root)",
      reason: issue.message,
    }));
  }

  const q = structural.data as Question;
  const errors: ValidationError[] = [];
  const push = (field: string, reason: string) => errors.push({ id: q.id, field, reason });

  const needsOptions = !OPTIONS_NOT_REQUIRED.includes(q.question_type);
  if (needsOptions) {
    if (!q.options || q.options.length < 2) {
      push("options", "expected an array of at least 2 options");
    } else {
      const correctCount = q.options.filter((o) => o.is_correct).length;
      if (["single_choice", "best_answer", "true_false"].includes(q.question_type) && correctCount !== 1) {
        push("options", `${q.question_type} requires exactly 1 correct option, found ${correctCount}`);
      }
      if (q.question_type === "multiple_choice" && correctCount < 1) {
        push("options", "multiple_choice requires at least 1 correct option");
      }
    }
  }

  if (q.question_type === "matching" && (!q.matching_pairs || q.matching_pairs.length < 1)) {
    push("matching_pairs", "matching questions require at least 1 pair");
  }
  if (q.question_type === "numerical" && q.numerical_answer === undefined && !q.options?.some((o) => o.is_correct)) {
    push("numerical_answer", "numerical questions require numerical_answer or a correct option");
  }

  return errors;
}

export interface ImportInvalidEntry {
  question: unknown;
  errors: ValidationError[];
}

export interface ImportAnalysis {
  valid: Question[];
  invalid: ImportInvalidEntry[];
  dupInFile: ValidationError[];
}

/**
 * Validates an entire uploaded array: per-row validation plus
 * in-file duplicate-id detection (spec §39, §41).
 */
export function analyzeImportFile(rawArray: unknown[]): ImportAnalysis {
  const seenIdsInFile = new Map<string, number>();
  const valid: Question[] = [];
  const invalid: ImportInvalidEntry[] = [];
  const dupInFile: ValidationError[] = [];

  rawArray.forEach((raw, idx) => {
    const errors = validateQuestion(raw, idx);
    const id = raw && typeof raw === "object" && "id" in raw ? String((raw as any).id) : undefined;

    if (id) {
      if (seenIdsInFile.has(id)) {
        dupInFile.push({
          id,
          field: "id",
          reason: `duplicate id within uploaded file (first seen at row ${seenIdsInFile.get(id)})`,
        });
      } else {
        seenIdsInFile.set(id, idx);
      }
    }

    if (errors.length) {
      invalid.push({ question: raw, errors });
    } else {
      valid.push(raw as Question);
    }
  });

  return { valid, invalid, dupInFile };
}
