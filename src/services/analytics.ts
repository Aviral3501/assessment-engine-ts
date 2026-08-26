import type { Attempt } from "@/types/attempt";
import type { LearningState } from "@/types/learning";
import type { Question } from "@/types/question";
import { DEFAULT_SETTINGS } from "@/types/topic";

export function safeAccuracy(correct: number, partial: number, total: number): number | null {
  if (!total) return null;
  return (correct + partial * 0.5) / total;
}

export interface Bucket {
  key: string;
  total: number;
  correct: number;
  partial: number;
  incorrect: number;
  totalTime: number;
  accuracy: number | null;
  avgTime: number;
  sufficientSample: boolean;
}

export function aggregateBy(
  attempts: Attempt[],
  keyFn: (a: Attempt) => string,
  minSample: number = DEFAULT_SETTINGS.minSampleThreshold
): Bucket[] {
  const map = new Map<string, Omit<Bucket, "accuracy" | "avgTime" | "sufficientSample">>();
  attempts.forEach((a) => {
    const key = keyFn(a);
    if (!map.has(key)) map.set(key, { key, total: 0, correct: 0, partial: 0, incorrect: 0, totalTime: 0 });
    const bucket = map.get(key)!;
    bucket.total++;
    if (a.result === "correct") bucket.correct++;
    else if (a.result === "partial") bucket.partial++;
    else if (a.result === "incorrect") bucket.incorrect++;
    bucket.totalTime += a.time_taken || 0;
  });
  return Array.from(map.values()).map((b) => ({
    ...b,
    accuracy: safeAccuracy(b.correct, b.partial, b.total),
    avgTime: b.total ? b.totalTime / b.total : 0,
    sufficientSample: b.total >= minSample,
  }));
}

export interface OverallStats {
  total_questions: number;
  total_attempted: number;
  total_attempts: number;
  overall_accuracy: number | null;
  avg_time: number | null;
  avg_mastery: number | null;
  due_count: number;
}

export interface Analytics {
  overall: OverallStats;
  byCategory: Bucket[];
  bySubcategory: Bucket[];
  byTopic: Bucket[];
  byDifficulty: Bucket[];
  byType: Bucket[];
}

export function buildAnalytics(
  attempts: Attempt[],
  learningStates: LearningState[],
  questions: Question[],
  minSample: number = DEFAULT_SETTINGS.minSampleThreshold
): Analytics {
  const total_attempts = attempts.length;
  const attemptedQIds = new Set(attempts.map((a) => a.question_id));
  const total_attempted = attemptedQIds.size;
  const correct = attempts.filter((a) => a.result === "correct").length;
  const partial = attempts.filter((a) => a.result === "partial").length;
  const overall_accuracy = safeAccuracy(correct, partial, total_attempts);
  const avg_time = total_attempts ? attempts.reduce((s, a) => s + (a.time_taken || 0), 0) / total_attempts : null;
  const avg_mastery = learningStates.length
    ? learningStates.reduce((s, l) => s + (l.mastery_score || 0), 0) / learningStates.length
    : null;
  const due_count = learningStates.filter((l) => l.state === "due").length;

  return {
    overall: { total_questions: questions.length, total_attempted, total_attempts, overall_accuracy, avg_time, avg_mastery, due_count },
    byCategory: aggregateBy(attempts, (a) => a.category, minSample),
    bySubcategory: aggregateBy(attempts, (a) => `${a.category} / ${a.subcategory || "—"}`, minSample),
    byTopic: aggregateBy(attempts, (a) => `${a.category} / ${a.topic}`, minSample),
    byDifficulty: aggregateBy(attempts, (a) => String(a.difficulty_at_attempt), minSample),
    byType: aggregateBy(attempts, (a) => a.question_type, minSample),
  };
}

/** Weak areas — insufficient-sample topics are excluded entirely rather than shown misleadingly (spec §33, §78). */
export function weaknessEngine(byTopic: Bucket[]): Bucket[] {
  return byTopic
    .filter((t) => t.sufficientSample && t.accuracy !== null)
    .sort((a, b) => (a.accuracy as number) - (b.accuracy as number))
    .slice(0, 10);
}

export function strengthEngine(byTopic: Bucket[]): Bucket[] {
  return byTopic
    .filter((t) => t.sufficientSample && t.accuracy !== null)
    .sort((a, b) => (b.accuracy as number) - (a.accuracy as number))
    .slice(0, 10);
}
