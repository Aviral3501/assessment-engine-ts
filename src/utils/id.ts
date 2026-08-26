import type { Question } from "@/types/question";

export function uid(prefix?: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return prefix ? `${prefix}_${rand}${time}` : `${rand}${time}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function topicKeyOf(q: Pick<Question, "category" | "subcategory" | "topic">): string {
  return [q.category, q.subcategory ?? "", q.topic ?? ""].join("::");
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
