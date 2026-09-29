// Review and export routes (FR-A4, PRD §6 Portability). Mounted behind requireSession in
// worker/index.ts.

import { Hono } from "hono";
import type { ConflictResponse, ReviewResponse } from "../../shared/api";
import { GRADES } from "../../shared/mastery";
import { exportVault } from "../domain/export";
import { amendReview, recordReview } from "../domain/review";
import { parseReview } from "../domain/review-input";
import { activeLadderId } from "../domain/settings";
import type { AppEnv } from "../env";
import { invalid, readJson, today } from "./api-vocab";

export const reviewRoutes = new Hono<AppEnv>();

reviewRoutes.post("/api/vocab/:id/reviews", async (c) => {
  const body = await readJson(c);
  if (body === undefined) return invalid(c, { message: "body must be valid JSON" });
  const parsed = parseReview(body);
  if (!parsed.ok) return invalid(c, parsed.error);

  const result = await recordReview(
    c.env.DB,
    c.req.param("id"),
    { ...parsed.value, source: "pwa" },
    new Date(),
    await activeLadderId(c.env.DB),
  );
  if (result.ok) {
    const response: ReviewResponse = { item: result.item, event: result.event };
    return c.json(response, 201);
  }
  if (result.error === "not_found") return c.json({ error: "not_found" }, 404);
  const conflict: ConflictResponse = {
    error: "conflict",
    message: "the item changed while the review was being recorded; reload and try again",
  };
  return c.json(conflict, 409);
});

reviewRoutes.patch("/api/reviews/:id", async (c) => {
  const body = await readJson(c);
  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    !Object.hasOwn(body, "grade") ||
    !GRADES.includes((body as { grade: never }).grade)
  ) {
    return invalid(c, { message: "grade must be a review grade" });
  }
  const result = await amendReview(
    c.env.DB,
    c.req.param("id"),
    (body as { grade: (typeof GRADES)[number] }).grade,
  );
  if (result.ok) {
    const response: ReviewResponse = { item: result.item, event: result.event };
    return c.json(response);
  }
  if (result.error === "not_found") return c.json({ error: "not_found" }, 404);
  const conflict: ConflictResponse = {
    error: "conflict",
    message: "this review can no longer be changed",
  };
  return c.json(conflict, 409);
});

reviewRoutes.get("/api/export", async (c) => {
  const now = new Date();
  const body = await exportVault(c.env.DB, now);
  c.header("Content-Disposition", `attachment; filename="urdu-export-${today(c)}.json"`);
  c.header("Cache-Control", "no-store");
  return c.json(body);
});
