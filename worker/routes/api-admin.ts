// Admin routes (FR-H). Mounted behind requireSession in worker/index.ts: the import runs from
// the sponsor's machine with an unlocked session, so it needs no second secret. If the import
// ever has to run without a device session, that is when a scoped admin token earns its keep.

import { Hono } from "hono";
import { type ImportResponse, MAX_IMPORT_BATCH } from "../../shared/api";
import { importVocab } from "../domain/import";
import { parseImportEnvelope } from "../domain/import-input";
import type { AppEnv } from "../env";
import { invalid, readJson } from "./api-vocab";

export const adminRoutes = new Hono<AppEnv>();

adminRoutes.post("/api/admin/import", async (c) => {
  const body = await readJson(c);
  if (body === undefined) return invalid(c, { message: "body must be valid JSON" });

  const parsed = parseImportEnvelope(body, MAX_IMPORT_BATCH);
  if (!parsed.ok) return invalid(c, parsed.error);

  const result: ImportResponse = await importVocab(c.env.DB, parsed.value, new Date());
  return c.json(result);
});
