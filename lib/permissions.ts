import type { Role } from "./types";

export type Action =
  | "case:create"
  | "case:edit"
  | "case:status"
  | "case:delete"
  | "event:create"
  | "event:edit"
  | "event:delete"
  | "evidence:create"
  | "evidence:edit"
  | "suspect:create"
  | "suspect:edit"
  | "related:create"
  | "related:edit"
  | "node:link"
  | "node:move"
  | "node:delete"
  | "settings:manage";

const PATROL: Action[] = ["case:create", "event:create", "evidence:create", "evidence:edit"];

const DETECTIVE: Action[] = [
  ...PATROL,
  "case:edit",
  "event:edit",
  "event:delete",
  "suspect:create",
  "suspect:edit",
  "related:create",
  "related:edit",
  "node:link",
  "node:move",
];

const ADMIN: Action[] = [
  ...DETECTIVE,
  "case:status",
  "case:delete",
  "node:delete",
  "settings:manage",
];

const MATRIX: Record<Role, Set<Action>> = {
  patrol: new Set(PATROL),
  detective: new Set(DETECTIVE),
  admin: new Set(ADMIN),
};

export function can(role: Role, action: Action) {
  return MATRIX[role].has(action);
}

export const ROLE_LABEL: Record<Role, string> = {
  patrol: "General Patrol",
  detective: "Detective",
  admin: "Administration",
};

export const ROLE_BRIEF: Record<Role, string> = {
  patrol: "View files, open cases, log events, and add evidence.",
  detective: "Edit narratives, work the investigation board, and manage suspects.",
  admin: "Close or reopen files, delete records, and rotate role passwords.",
};
