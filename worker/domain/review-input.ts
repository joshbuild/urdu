// Validation for PWA review requests. f06 validates its own handoff shape and then calls the
// review service with the same grade and direction values.

import { REVIEW_DIRECTIONS, type ReviewRequest } from "../../shared/api";
import { GRADES, isGrade } from "../../shared/mastery";
import type { Parsed } from "./vocab-input";

const FIELDS = new Set(["grade", "direction"]);

const fail = (field: string | undefined, message: string) =>
  ({ ok: false, error: { field, message } }) as const;

export function parseReview(body: unknown): Parsed<ReviewRequest> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return fail(undefined, "body must be a JSON object");
  }
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!FIELDS.has(key)) return fail(key, "is not a recognised field");
  }
  if (!isGrade(record.grade)) return fail("grade", `must be one of ${GRADES.join(", ")}`);
  if (!(REVIEW_DIRECTIONS as readonly unknown[]).includes(record.direction)) {
    return fail("direction", `must be one of ${REVIEW_DIRECTIONS.join(", ")}`);
  }
  return {
    ok: true,
    value: { grade: record.grade, direction: record.direction as ReviewRequest["direction"] },
  };
}
