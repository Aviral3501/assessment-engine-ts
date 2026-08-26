import type { Question } from "@/types/question";
import type { LearningState } from "@/types/learning";
import type { Topic } from "@/types/topic";
import { shuffle, topicKeyOf } from "@/utils/id";

/**
 * Pure selection function — given the full state, returns up to `size`
 * questions prioritized: due > incorrect > low-mastery > recently-learned
 * > random reinforcement, restricted to topics marked Covered/Mastered
 * (spec §17-18, §75). Never includes a Not Started topic.
 */
export function selectDailyQuiz(
  questions: Question[],
  learningStates: LearningState[],
  topics: Topic[],
  size: number
): Question[] {
  const coveredKeys = new Set(topics.filter((t) => t.status === "Covered" || t.status === "Mastered").map((t) => t.topicKey));
  const lsMap = new Map(learningStates.map((l) => [l.question_id, l]));
  const eligible = questions.filter((q) => coveredKeys.has(topicKeyOf(q)));

  const due = eligible.filter((q) => lsMap.get(q.id)?.state === "due");
  const incorrectQ = eligible.filter((q) => {
    const l = lsMap.get(q.id);
    return !!l && l.times_incorrect > 0 && l.state !== "due";
  });
  const lowMastery = eligible.filter((q) => {
    const l = lsMap.get(q.id);
    return !!l && l.mastery_score < 50 && l.times_answered > 0 && l.state !== "due";
  });
  const recentlyLearned = eligible.filter((q) => {
    const l = lsMap.get(q.id);
    return !!l && l.repetitions > 0 && l.repetitions < 3 && l.state !== "due";
  });
  const untouched = eligible.filter((q) => {
    const l = lsMap.get(q.id);
    return !l || l.times_answered === 0;
  });

  const buckets: { list: Question[]; take: number }[] = [
    { list: shuffle(due), take: Math.round(size * 0.4) },
    { list: shuffle(incorrectQ), take: Math.round(size * 0.2) },
    { list: shuffle(lowMastery), take: Math.round(size * 0.15) },
    { list: shuffle(recentlyLearned), take: Math.round(size * 0.15) },
    { list: shuffle(untouched.length ? untouched : eligible), take: Math.round(size * 0.1) },
  ];

  const picked: Question[] = [];
  const usedIds = new Set<string>();
  buckets.forEach((b) => {
    let n = 0;
    for (const q of b.list) {
      if (n >= b.take) break;
      if (usedIds.has(q.id)) continue;
      usedIds.add(q.id);
      picked.push(q);
      n++;
    }
  });

  if (picked.length < size) {
    for (const q of shuffle(eligible)) {
      if (picked.length >= size) break;
      if (usedIds.has(q.id)) continue;
      usedIds.add(q.id);
      picked.push(q);
    }
  }

  return picked.slice(0, size);
}
