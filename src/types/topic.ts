export const TOPIC_STATUS = ["Not Started", "Studying", "Covered", "Mastered"] as const;
export type TopicStatus = (typeof TOPIC_STATUS)[number];

export interface Topic {
  /** Composite key: `${category}::${subcategory}::${topic}` */
  topicKey: string;
  category: string;
  subcategory: string;
  topic: string;
  status: TopicStatus;
}

export interface Bookmark {
  question_id: string;
  created_at: string;
}

export type FlagReason = "confusing" | "questionable" | "difficult" | "revisit" | "possible_error" | string;

export interface Flag {
  id?: number;
  question_id: string;
  reason: FlagReason;
  note?: string;
  created_at: string;
}

export interface UserSettingRow {
  key: string;
  value: unknown;
}

export interface AppSettings {
  defaultQuizLength: number;
  defaultRevealMode: "immediate" | "end";
  dailyQuizSize: number;
  partialCreditEnabled: boolean;
  minSampleThreshold: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultQuizLength: 20,
  defaultRevealMode: "immediate",
  dailyQuizSize: 20,
  partialCreditEnabled: true,
  minSampleThreshold: 5,
};
