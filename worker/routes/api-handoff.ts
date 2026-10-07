// Clipboard handoff routes (f06 Stages 1-2, FR-F4/F6; f11/f13 check, FR-F9, which replaced the
// FR-F7 fill-in routes). Mounted
// behind requireSession: the sponsor pastes the chat's reply into the PWA, so the session cookie
// is the right credential. The bearer-token /coach/* routes are Stage 3.

import { Hono } from "hono";
import type { CheckBatchResponse, ClassifyBatchResponse, ConflictResponse } from "../../shared/api";
import { correctVocab, issueCheckBatch, NOT_ISSUED } from "../domain/check";
import { classifyVocab, issueClassifyBatch, NOT_ISSUED as NOT_CLASSIFY } from "../domain/classify";
import { ID_CONFLICT, importHandoff } from "../domain/handoff";
import {
  parseCheckOptions,
  parseClassify,
  parseClassifyBatch,
  parseCorrections,
  parseHandoff,
} from "../domain/handoff-input";
import { activeLadderId } from "../domain/settings";
import type { AppEnv } from "../env";
import { invalid, readJson } from "./api-vocab";

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

// f11/f13: selects and records the next check batch for the options in the body.
handoffRoutes.post("/api/handoffs/check-batch", async (c) => {
  const body = await readJson(c);
  if (body === undefined) return invalid(c, { message: "body must be valid JSON" });
  const parsed = parseCheckOptions(body);
  if (!parsed.ok) return invalid(c, parsed.error);
  const batch: CheckBatchResponse = await issueCheckBatch(c.env.DB, parsed.value, new Date());
  return c.json(batch);
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

// f18 (FR-L): records the next batch of unclassified items for Copy classify prompt.
handoffRoutes.post("/api/handoffs/classify-batch", async (c) => {
  const body = await readJson(c);
  if (body === undefined) return invalid(c, { message: "body must be valid JSON" });
  const parsed = parseClassifyBatch(body);
  if (!parsed.ok) return invalid(c, parsed.error);
  const batch: ClassifyBatchResponse = await issueClassifyBatch(
    c.env.DB,
    parsed.value.count,
    new Date(),
  );
  return c.json(batch);
});

// f18: ?preview=1 plans the rows and writes nothing; without it `accept` names the ticked rows.
handoffRoutes.post("/api/handoffs/classify", async (c) => {
  const body = await readJson(c);
  if (body === undefined) return invalid(c, { message: "body must be valid JSON" });
  const parsed = parseClassify(body, c.req.query("preview") === "1");
  if (!parsed.ok) return invalid(c, parsed.error);
  const result = await classifyVocab(c.env.DB, parsed.value, new Date());
  if (result === NOT_CLASSIFY) {
    return invalid(c, {
      field: "handoff_id",
      message: "is not a classify batch this app issued; copy a fresh classify prompt",
    });
  }
  return result === ID_CONFLICT ? c.json(conflict, 409) : c.json(result);
});
