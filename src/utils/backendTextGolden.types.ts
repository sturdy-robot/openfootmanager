import type { MessageAction } from "../store/types";

/** The input of a golden case that is an inbox message (the fields the resolvers read). */
export type GoldenMessage = {
  id?: string;
  subject?: string;
  body?: string;
  sender?: string;
  sender_role?: string;
  subject_key?: string;
  body_key?: string;
  sender_key?: string;
  sender_role_key?: string;
  i18n_params?: Record<string, string>;
  actions?: MessageAction[];
};

/** The input of a golden case that is a news article. */
export type GoldenArticle = {
  id?: string;
  headline?: string;
  body?: string;
  source?: string;
  headline_key?: string;
  body_key?: string;
  source_key?: string;
  i18n_params?: Record<string, string>;
};

/** One case: its input and, once written, the English text the frontend makes of it. */
export type GoldenCase =
  | { name: string; kind: "message"; input: GoldenMessage; expected?: unknown }
  | { name: string; kind: "article"; input: GoldenArticle; expected?: unknown };
