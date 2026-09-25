// Clipboard handoff routes (f06 Stages 1-2, FR-F4/F6/F7; f11 accuracy check, FR-F9). Mounted
// behind requireSession: the sponsor pastes the chat's reply into the PWA, so the session cookie
// is the right credential. The bearer-token /coach/* routes are Stage 3.

import { Hono } from "hono";
import type { CheckBatchResponse, ConflictResponse, IncompleteResponse } from "../../shared/api";
import { correctVocab, issueCheckBatch, NOT_ISSUED } from "../domain/check";
import { ID_CONFLICT, importHandoff, incompleteVocab, reviseVocab } from "../domain/handoff";
import { parseCorrections, parseHandoff, parseRevisions } from "../domain/handoff-input";
import { activeLadderId } from "../domain/settings";
import type { AppEnv } from "../env";
import { invalid, readJson } from "./api-vocab";

export const MAX_INCOMPLETE_LIMIT = 20;

const conflict: ConflictResponse = {
  error: "conflict",
  message: "this handoff_id was already used for a different kind of paste",
};

export const handoffRoutes = new Hono<AppEnv>();

handoffRoutes.post("/api/handoffs", async (c) => {
  const body = await readJson(c);
  if (body === undefined) return invalid(c, { message: "body must be valid JSON" });
  const parsed = parseHandoff(body);
  if (!parsed.ok) return invalid(c, parsed.error);
  const result = await importHandoff(
    c.env.DB,
    parsed.value,
    new Date(),
    await activeLadderId(c.env.DB),
  );
  return result === ID_CONFLICT ? c.json(conflict, 409) : c.json(result);
});

// ?preview=1 plans the fills and writes nothing; without it the fills are saved.
handoffRoutes.post("/api/handoffs/revisions", async (c) => {
  const body = await readJson(c);
  if (body === undefined) return invalid(c, { message: "body must be valid JSON" });
  const parsed = parseRevisions(body);
  if (!parsed.ok) return invalid(c, parsed.error);
  const preview = c.req.query("preview") === "1";
  const result = await reviseVocab(c.env.DB, parsed.value, new Date(), preview);
  return result === ID_CONFLICT ? c.json(conflict, 409) : c.json(result);
});

// f11: selects and records the next check batch. The body is ignored.
handoffRoutes.post("/api/handoffs/check-batch", async (c) => {
  const body: CheckBatchResponse = await issueCheckBatch(c.env.DB, new Date());
  return c.json(body);
});

// f11: ?preview=1 plans the corrections and writes nothing; without it the body carries `accept`
// and the ticked fields and resets are written and the batch is stamped checked.
handoffRoutes.post("/api/handoffs/corrections", async (c) => {
  const body = await readJson(c);
  if (body === undefined) return invalid(c, { message: "body must be valid JSON" });
  const preview = c.req.query("preview") === "1";
  const parsed = parseCorrections(body, preview);
  if (!parsed.ok) return invalid(c, parsed.error);
  const result = await correctVocab(
    c.env.DB,
    parsed.value,
    new Date(),
    await activeLadderId(c.env.DB),
  );
  if (result === NOT_ISSUED) {
    return invalid(c, {
      field: "handoff_id",
      message: "is not a check batch this app issued; copy a fresh check prompt",
    });
  }
  return result === ID_CONFLICT ? c.json(conflict, 409) : c.json(result);
});

handoffRoutes.get("/api/vocab/incomplete", async (c) => {
  const body: IncompleteResponse = await incompleteVocab(c.env.DB, MAX_INCOMPLETE_LIMIT);
  return c.json(body);
});
